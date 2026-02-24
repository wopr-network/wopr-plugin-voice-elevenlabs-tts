import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock node-fetch before importing the module
vi.mock("node-fetch", async () => {
	const actual =
		await vi.importActual<typeof import("node-fetch")>("node-fetch");
	return {
		...actual,
		default: vi.fn(),
	};
});

import fetch from "node-fetch";

const mockFetch = vi.mocked(fetch);

// Import after mocking
const { ElevenLabsTTSProvider } = await import("../index.js");

describe("ElevenLabsTTSProvider voice cloning", () => {
	let provider: InstanceType<typeof ElevenLabsTTSProvider>;

	beforeEach(() => {
		mockFetch.mockReset();
		provider = new ElevenLabsTTSProvider({
			apiKey: "test-key",
			defaultVoiceId: "default-voice",
		});
	});

	it("uses normal voice when no referenceAudio", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			arrayBuffer: async () => new ArrayBuffer(100),
			text: async () => "",
		} as ReturnType<typeof fetch> extends Promise<infer R> ? R : never);

		const result = await provider.synthesize("Hello");
		expect(result.audio).toBeInstanceOf(Buffer);

		// Should call TTS endpoint with default voice
		const url = mockFetch.mock.calls[0][0] as string;
		expect(url).toContain("/text-to-speech/default-voice");
	});

	it("creates cloned voice when referenceAudio provided", async () => {
		const refAudio = Buffer.from("fake-audio-data");

		// First call: voice clone (POST /voices/add)
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ voice_id: "cloned-voice-123" }),
			text: async () => "",
		} as ReturnType<typeof fetch> extends Promise<infer R> ? R : never);

		// Second call: TTS with cloned voice
		mockFetch.mockResolvedValueOnce({
			ok: true,
			arrayBuffer: async () => new ArrayBuffer(100),
			text: async () => "",
		} as ReturnType<typeof fetch> extends Promise<infer R> ? R : never);

		const result = await provider.synthesize("Hello clone", {
			referenceAudio: refAudio,
		} as Parameters<typeof provider.synthesize>[1]);

		expect(result.audio).toBeInstanceOf(Buffer);

		// First call should be to /voices/add
		const cloneUrl = mockFetch.mock.calls[0][0] as string;
		expect(cloneUrl).toContain("/voices/add");

		// Second call should use the cloned voice ID
		const ttsUrl = mockFetch.mock.calls[1][0] as string;
		expect(ttsUrl).toContain("/text-to-speech/cloned-voice-123");
	});

	it("caches cloned voice ID for same referenceAudio", async () => {
		const refAudio = Buffer.from("same-audio");

		// Clone call
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ voice_id: "cloned-abc" }),
			text: async () => "",
		} as ReturnType<typeof fetch> extends Promise<infer R> ? R : never);
		// TTS call 1
		mockFetch.mockResolvedValueOnce({
			ok: true,
			arrayBuffer: async () => new ArrayBuffer(100),
			text: async () => "",
		} as ReturnType<typeof fetch> extends Promise<infer R> ? R : never);
		// TTS call 2 (no clone call — cached)
		mockFetch.mockResolvedValueOnce({
			ok: true,
			arrayBuffer: async () => new ArrayBuffer(100),
			text: async () => "",
		} as ReturnType<typeof fetch> extends Promise<infer R> ? R : never);

		await provider.synthesize("First", {
			referenceAudio: refAudio,
		} as Parameters<typeof provider.synthesize>[1]);
		await provider.synthesize("Second", {
			referenceAudio: refAudio,
		} as Parameters<typeof provider.synthesize>[1]);

		// Should only have 3 fetch calls (1 clone + 2 TTS), not 4
		expect(mockFetch).toHaveBeenCalledTimes(3);
	});
});

describe("ElevenLabsTTSProvider streamSynthesize voice cloning", () => {
	let provider: InstanceType<typeof ElevenLabsTTSProvider>;

	beforeEach(() => {
		mockFetch.mockReset();
		provider = new ElevenLabsTTSProvider({
			apiKey: "test-key",
			defaultVoiceId: "default-voice",
		});
	});

	it("streams with cloned voice when referenceAudio provided", async () => {
		const refAudio = Buffer.from("streaming-reference-audio");

		// First call: voice clone (POST /voices/add)
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ voice_id: "stream-cloned-voice" }),
			text: async () => "",
		} as ReturnType<typeof fetch> extends Promise<infer R> ? R : never);

		// Second call: streaming TTS with cloned voice
		const audioChunk = Buffer.from("audio-chunk");
		async function* makeStream() {
			yield audioChunk;
		}
		mockFetch.mockResolvedValueOnce({
			ok: true,
			body: makeStream(),
			text: async () => "",
		} as unknown as ReturnType<typeof fetch> extends Promise<infer R>
			? R
			: never);

		const chunks: Buffer[] = [];
		for await (const chunk of provider.streamSynthesize("Hello stream clone", {
			referenceAudio: refAudio,
		} as Parameters<typeof provider.synthesize>[1])) {
			chunks.push(chunk);
		}

		expect(chunks.length).toBeGreaterThan(0);

		// First call should be to /voices/add
		const cloneUrl = mockFetch.mock.calls[0][0] as string;
		expect(cloneUrl).toContain("/voices/add");

		// Second call should use the cloned voice ID for streaming
		const streamUrl = mockFetch.mock.calls[1][0] as string;
		expect(streamUrl).toContain("/text-to-speech/stream-cloned-voice/stream");
	});

	it("uses L1 cache: streamSynthesize reuses voice cloned by synthesize", async () => {
		const refAudio = Buffer.from("shared-cache-audio");

		// 1. synthesize clone call
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ voice_id: "shared-cloned-voice" }),
			text: async () => "",
		} as ReturnType<typeof fetch> extends Promise<infer R> ? R : never);
		// 2. synthesize TTS call
		mockFetch.mockResolvedValueOnce({
			ok: true,
			arrayBuffer: async () => new ArrayBuffer(50),
			text: async () => "",
		} as ReturnType<typeof fetch> extends Promise<infer R> ? R : never);
		// 3. streamSynthesize TTS call (no second clone — L1 cache hit)
		async function* makeStream2() {
			yield Buffer.from("chunk");
		}
		mockFetch.mockResolvedValueOnce({
			ok: true,
			body: makeStream2(),
			text: async () => "",
		} as unknown as ReturnType<typeof fetch> extends Promise<infer R>
			? R
			: never);

		await provider.synthesize("First", {
			referenceAudio: refAudio,
		} as Parameters<typeof provider.synthesize>[1]);

		for await (const _ of provider.streamSynthesize("Second", {
			referenceAudio: refAudio,
		} as Parameters<typeof provider.synthesize>[1])) {
			// consume
		}

		// 3 calls total: 1 clone + 1 synthesize TTS + 1 stream TTS (no second clone)
		expect(mockFetch).toHaveBeenCalledTimes(3);
		const streamUrl = mockFetch.mock.calls[2][0] as string;
		expect(streamUrl).toContain("/text-to-speech/shared-cloned-voice/stream");
	});
});
