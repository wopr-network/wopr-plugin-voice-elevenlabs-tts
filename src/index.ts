/**
 * ElevenLabs TTS Provider for WOPR
 *
 * Implements the WOPR TTSProvider interface using ElevenLabs streaming API.
 * Based on clawdbot PR 1154 talk mode implementation.
 */

import type { WOPRPlugin, WOPRPluginContext } from "@wopr-network/plugin-types";
import fetch from "node-fetch";
import type {
	AudioFormat,
	ElevenLabsConfig,
	ElevenLabsTTSOptions,
	ElevenLabsTTSRequest,
	ElevenLabsVoice,
	ElevenLabsVoicesResponse,
	TTSOptions,
	TTSProvider,
	TTSSynthesisResult,
	Voice,
	VoiceDirective,
	VoicePluginMetadata,
} from "./types.js";
import { getWebMCPHandlers, getWebMCPToolDeclarations } from "./webmcp.js";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate stability parameter based on model.
 * eleven_v3 only supports 0.0, 0.5, 1.0; others accept 0..1 range.
 */
function validateStability(
	value: number | undefined,
	modelId?: string,
): number | undefined {
	if (value === undefined) return undefined;
	if (modelId === "eleven_v3") {
		const valid = [0.0, 0.5, 1.0];
		const closest = valid.reduce((prev, curr) =>
			Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev,
		);
		return closest;
	}
	return Math.max(0, Math.min(1, value));
}

/**
 * Validate unit range (0..1) for similarity_boost, style parameters.
 */
function validateUnit(value: number | undefined): number | undefined {
	if (value === undefined) return undefined;
	return Math.max(0, Math.min(1, value));
}

/**
 * Validate seed (must be integer between 0 and 4294967295).
 */
function validateSeed(value: number | undefined): number | undefined {
	if (value === undefined) return undefined;
	return Math.max(0, Math.min(4294967295, Math.floor(value)));
}

/**
 * Validate latency tier (0..4).
 */
function validateLatencyTier(value: number | undefined): number | undefined {
	if (value === undefined) return undefined;
	return Math.max(0, Math.min(4, Math.floor(value)));
}

/**
 * Resolve speed parameter from either speed multiplier or rate (WPM).
 * Speed is a multiplier (0.5 - 2.0), rate is words-per-minute.
 */
function resolveSpeed(speed?: number, rateWPM?: number): number | undefined {
	if (speed !== undefined) {
		return Math.max(0.25, Math.min(4.0, speed));
	}
	if (rateWPM !== undefined) {
		// Average speaking rate is ~150 WPM
		const baseWPM = 150;
		return Math.max(0.25, Math.min(4.0, rateWPM / baseWPM));
	}
	return undefined;
}

/**
 * Map WOPR AudioFormat to ElevenLabs output_format.
 */
function mapAudioFormat(format?: AudioFormat): string {
	if (!format) return "pcm_44100";

	switch (format) {
		case "pcm_s16le":
			return "pcm_44100";
		case "mp3":
			return "mp3_44100_128";
		case "opus":
		case "ogg_opus":
			return "ulaw_8000"; // ElevenLabs doesn't support Opus directly
		default:
			return "pcm_44100";
	}
}

/**
 * Parse ElevenLabs output format string to extract sample rate.
 */
function parseSampleRate(format: string): number {
	const match = format.match(/(\d+)/);
	return match ? parseInt(match[1], 10) : 44100;
}

/**
 * Parse voice directive from text (first line JSON).
 * Returns { directive, stripped, unknownKeys }.
 */
function parseVoiceDirective(text: string): {
	directive: VoiceDirective | null;
	stripped: string;
	unknownKeys: string[];
} {
	const lines = text.split("\n");
	const firstLine = lines[0]?.trim() || "";

	if (!firstLine.startsWith("{") || !firstLine.endsWith("}")) {
		return { directive: null, stripped: text, unknownKeys: [] };
	}

	try {
		const parsed = JSON.parse(firstLine) as Record<string, unknown>;
		const knownKeys = new Set([
			"voice",
			"voice_id",
			"voiceId",
			"model",
			"model_id",
			"modelId",
			"speed",
			"rate",
			"stability",
			"similarity",
			"style",
			"speakerBoost",
			"seed",
			"normalize",
			"lang",
			"language",
			"output_format",
			"outputFormat",
			"latency_tier",
			"once",
		]);

		const unknownKeys = Object.keys(parsed).filter((k) => !knownKeys.has(k));
		const directive = parsed as VoiceDirective;
		const stripped = lines.slice(1).join("\n");

		return { directive, stripped, unknownKeys };
	} catch {
		return { directive: null, stripped: text, unknownKeys: [] };
	}
}

/**
 * Merge TTSOptions with ElevenLabs-specific options.
 */
function mergeOptions(
	base: TTSOptions | undefined,
	extended: ElevenLabsTTSOptions | undefined,
): ElevenLabsTTSOptions {
	return {
		voice: extended?.voice || base?.voice,
		speed: extended?.speed || base?.speed,
		rate: extended?.rate,
		stability: extended?.stability,
		similarity: extended?.similarity || extended?.similarityBoost,
		style: extended?.style,
		speakerBoost: extended?.speakerBoost,
		seed: extended?.seed,
		modelId: extended?.modelId,
		outputFormat: extended?.outputFormat,
		language: extended?.language,
		latencyTier: extended?.latencyTier,
	};
}

// =============================================================================
// ElevenLabs TTS Provider
// =============================================================================

export class ElevenLabsTTSProvider implements TTSProvider {
	readonly metadata: VoicePluginMetadata = {
		name: "elevenlabs",
		version: "1.0.0",
		type: "tts",
		description:
			"ElevenLabs high-quality text-to-speech with streaming support",
		capabilities: ["streaming", "voice-selection", "voice-parameters"],
		local: false,
		requires: {
			env: ["ELEVENLABS_API_KEY"],
		},
		install: [
			{
				kind: "manual",
				instructions: "Sign up at https://elevenlabs.io and get your API key",
				label: "Get ElevenLabs API key",
			},
		],
		primaryEnv: "ELEVENLABS_API_KEY",
		emoji: "🔊",
		homepage: "https://elevenlabs.io",
	};

	private config: ElevenLabsConfig;
	private cachedVoices: Voice[] = [];
	private voicesCachedAt: number = 0;
	private readonly VOICE_CACHE_TTL = 3600000; // 1 hour
	private readonly BASE_URL = "https://api.elevenlabs.io/v1";

	constructor(config: Partial<ElevenLabsConfig>) {
		const apiKey = config.apiKey || process.env.ELEVENLABS_API_KEY || "";
		if (!apiKey) {
			throw new Error("ELEVENLABS_API_KEY is required");
		}

		this.config = {
			apiKey,
			defaultVoiceId: config.defaultVoiceId,
			defaultModelId: config.defaultModelId || "eleven_turbo_v2_5",
			stability: config.stability ?? 0.5,
			similarityBoost: config.similarityBoost ?? 0.75,
			style: config.style,
			speakerBoost: config.speakerBoost ?? true,
		};
	}

	get voices(): Voice[] {
		return this.cachedVoices;
	}

	get currentModelId(): string {
		return this.config.defaultModelId || "eleven_turbo_v2_5";
	}

	validateConfig(): void {
		if (!this.config.apiKey) {
			throw new Error("ELEVENLABS_API_KEY is required");
		}
	}

	/**
	 * Fetch available voices from ElevenLabs API.
	 */
	async fetchVoices(): Promise<Voice[]> {
		const now = Date.now();
		if (
			this.cachedVoices.length > 0 &&
			now - this.voicesCachedAt < this.VOICE_CACHE_TTL
		) {
			return this.cachedVoices;
		}

		const response = await fetch(`${this.BASE_URL}/voices`, {
			headers: {
				"xi-api-key": this.config.apiKey,
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch voices: ${response.statusText}`);
		}

		const data = (await response.json()) as ElevenLabsVoicesResponse;

		this.cachedVoices = data.voices.map((v) => ({
			id: v.voice_id,
			name: v.name,
			language: v.labels?.language,
			gender: v.labels?.gender as "male" | "female" | "neutral" | undefined,
			description: v.description,
		}));

		this.voicesCachedAt = now;
		return this.cachedVoices;
	}

	async synthesize(
		text: string,
		options?: TTSOptions,
	): Promise<TTSSynthesisResult> {
		// Parse voice directive if present
		const { directive, stripped, unknownKeys } = parseVoiceDirective(text);
		const cleanText = stripped || text;

		if (unknownKeys.length > 0) {
			console.warn(
				`[ElevenLabs] Unknown directive keys: ${unknownKeys.join(", ")}`,
			);
		}

		// Merge options with directive
		const opts = mergeOptions(options, {
			voice: directive?.voiceId || directive?.voice_id || directive?.voice,
			speed: directive?.speed,
			rate: directive?.rate,
			stability: directive?.stability,
			similarity: directive?.similarity,
			style: directive?.style,
			speakerBoost: directive?.speakerBoost,
			seed: directive?.seed,
			modelId: directive?.modelId || directive?.model_id || directive?.model,
			outputFormat: directive?.outputFormat || directive?.output_format,
			language: directive?.lang || directive?.language,
			latencyTier: directive?.latency_tier,
		} as ElevenLabsTTSOptions);

		const voiceId = opts.voice || this.config.defaultVoiceId;
		if (!voiceId) {
			throw new Error("Voice ID is required");
		}

		const modelId =
			opts.modelId || this.config.defaultModelId || "eleven_turbo_v2_5";
		const outputFormat = opts.outputFormat || mapAudioFormat(options?.format);
		const sampleRate = options?.sampleRate || parseSampleRate(outputFormat);

		const requestBody: ElevenLabsTTSRequest = {
			text: cleanText,
			model_id: modelId,
			voice_settings: {
				stability: validateStability(
					opts.stability ?? this.config.stability,
					modelId,
				),
				similarity_boost: validateUnit(
					opts.similarity ?? this.config.similarityBoost,
				),
				style: validateUnit(opts.style ?? this.config.style),
				use_speaker_boost: opts.speakerBoost ?? this.config.speakerBoost,
			},
			seed: validateSeed(opts.seed),
			language_code: opts.language,
		};

		const queryParams = new URLSearchParams({ output_format: outputFormat });
		if (opts.latencyTier !== undefined) {
			queryParams.set(
				"optimize_streaming_latency",
				validateLatencyTier(opts.latencyTier)!.toString(),
			);
		}

		const url = `${this.BASE_URL}/text-to-speech/${voiceId}?${queryParams}`;
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"xi-api-key": this.config.apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(
				`ElevenLabs TTS failed: ${response.statusText} - ${error}`,
			);
		}

		const arrayBuffer = await response.arrayBuffer();
		const audio = Buffer.from(arrayBuffer);

		// Estimate duration (rough calculation based on text length)
		// Average speaking rate: ~150 words/min = ~2.5 words/sec
		const words = cleanText.split(/\s+/).length;
		const speedMultiplier = opts.speed || 1.0;
		const durationMs = ((words / 2.5) * 1000) / speedMultiplier;

		return {
			audio,
			format: options?.format || "pcm_s16le",
			sampleRate,
			durationMs,
		};
	}

	/**
	 * Stream TTS synthesis for long text with low latency.
	 */
	async *streamSynthesize(
		text: string,
		options?: TTSOptions,
	): AsyncGenerator<Buffer> {
		// Parse voice directive if present
		const { directive, stripped, unknownKeys } = parseVoiceDirective(text);
		const cleanText = stripped || text;

		if (unknownKeys.length > 0) {
			console.warn(
				`[ElevenLabs] Unknown directive keys: ${unknownKeys.join(", ")}`,
			);
		}

		// Merge options with directive
		const opts = mergeOptions(options, {
			voice: directive?.voiceId || directive?.voice_id || directive?.voice,
			speed: directive?.speed,
			rate: directive?.rate,
			stability: directive?.stability,
			similarity: directive?.similarity,
			style: directive?.style,
			speakerBoost: directive?.speakerBoost,
			seed: directive?.seed,
			modelId: directive?.modelId || directive?.model_id || directive?.model,
			outputFormat: directive?.outputFormat || directive?.output_format,
			language: directive?.lang || directive?.language,
			latencyTier: directive?.latency_tier,
		} as ElevenLabsTTSOptions);

		const voiceId = opts.voice || this.config.defaultVoiceId;
		if (!voiceId) {
			throw new Error("Voice ID is required");
		}

		const modelId =
			opts.modelId || this.config.defaultModelId || "eleven_turbo_v2_5";
		const outputFormat = opts.outputFormat || mapAudioFormat(options?.format);
		const speed = resolveSpeed(opts.speed, opts.rate);

		const requestBody: ElevenLabsTTSRequest = {
			text: cleanText,
			model_id: modelId,
			voice_settings: {
				stability: validateStability(
					opts.stability ?? this.config.stability,
					modelId,
				),
				similarity_boost: validateUnit(
					opts.similarity ?? this.config.similarityBoost,
				),
				style: validateUnit(opts.style ?? this.config.style),
				use_speaker_boost: opts.speakerBoost ?? this.config.speakerBoost,
			},
			seed: validateSeed(opts.seed),
			language_code: opts.language,
		};

		const queryParams = new URLSearchParams({ output_format: outputFormat });

		// Optimize streaming latency
		if (opts.latencyTier !== undefined) {
			queryParams.set(
				"optimize_streaming_latency",
				validateLatencyTier(opts.latencyTier)!.toString(),
			);
		} else {
			queryParams.set("optimize_streaming_latency", "0"); // Default to lowest latency for streaming
		}

		const url = `${this.BASE_URL}/text-to-speech/${voiceId}/stream?${queryParams}`;
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"xi-api-key": this.config.apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(
				`ElevenLabs TTS streaming failed: ${response.statusText} - ${error}`,
			);
		}

		if (!response.body) {
			throw new Error("Response body is null");
		}

		// Stream audio chunks from node-fetch ReadableStream
		for await (const chunk of response.body) {
			yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		}
	}

	async healthCheck(): Promise<boolean> {
		try {
			const response = await fetch(`${this.BASE_URL}/voices`, {
				headers: {
					"xi-api-key": this.config.apiKey,
				},
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	async shutdown(): Promise<void> {
		// No cleanup needed for HTTP-based provider
	}
}

// =============================================================================
// Plugin Registration
// =============================================================================

let _provider: ElevenLabsTTSProvider | null = null;

// Extended with getManifest/getWebMCPHandlers for webui bindPluginLifecycle()
const plugin: WOPRPlugin & {
	getManifest(): { webmcpTools: ReturnType<typeof getWebMCPToolDeclarations> };
	getWebMCPHandlers(): Record<
		string,
		(input: Record<string, unknown>) => Promise<unknown>
	>;
} = {
	name: "voice-elevenlabs-tts",
	version: "1.0.0",
	description: "ElevenLabs high-quality text-to-speech",

	async init(ctx: WOPRPluginContext) {
		_provider = new ElevenLabsTTSProvider({
			apiKey: process.env.ELEVENLABS_API_KEY,
		});

		// Initialize voice cache on startup (fire-and-forget)
		_provider.fetchVoices().catch((err: Error) => {
			console.warn(
				"Failed to fetch ElevenLabs voices on startup:",
				err.message,
			);
		});

		ctx.registerExtension("tts", _provider);

		// registerCapabilityProvider exists at runtime but not yet in published types
		if (
			"registerCapabilityProvider" in ctx &&
			typeof (ctx as any).registerCapabilityProvider === "function"
		) {
			try {
				(ctx as any).registerCapabilityProvider("tts", {
					id: _provider.metadata.name,
					name: _provider.metadata.description || _provider.metadata.name,
				});
			} catch (err) {
				console.warn(
					"Failed to register TTS capability provider:",
					err instanceof Error ? err.message : err,
				);
			}
		}
	},

	getManifest() {
		return { webmcpTools: getWebMCPToolDeclarations() };
	},

	getWebMCPHandlers() {
		if (!_provider) return {};
		return getWebMCPHandlers(_provider, _provider.currentModelId);
	},

	async shutdown() {
		if (_provider) {
			await _provider.shutdown();
			_provider = null;
		}
	},
};

export default plugin;

// =============================================================================
// Exports
// =============================================================================

export type {
	AudioFormat,
	ElevenLabsConfig,
	ElevenLabsModel,
	ElevenLabsOutputFormat,
	ElevenLabsTTSOptions,
	TTSOptions,
	TTSProvider,
	TTSSynthesisResult,
	Voice,
	VoiceDirective,
	VoicePluginMetadata,
} from "./types.js";
