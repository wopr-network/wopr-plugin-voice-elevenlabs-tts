/**
 * Type definitions for ElevenLabs TTS provider
 */

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
  description?: string;
  preview_url?: string;
  category?: string;
  settings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

export interface ElevenLabsVoicesResponse {
  voices: ElevenLabsVoice[];
}

export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface ElevenLabsTTSRequest {
  text: string;
  model_id?: string;
  voice_settings?: VoiceSettings;
  pronunciation_dictionary_locators?: Array<{
    pronunciation_dictionary_id: string;
    version_id: string;
  }>;
  seed?: number;
  previous_text?: string;
  next_text?: string;
  language_code?: string;
}

export interface ElevenLabsConfig {
  apiKey: string;
  defaultVoiceId?: string;
  defaultModelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speakerBoost?: boolean;
  outputFormat?: string;
}

/**
 * Voice directive structure from clawdbot talk mode.
 * Can be embedded as JSON in the first line of assistant replies.
 */
export interface VoiceDirective {
  voice?: string;
  voice_id?: string;
  voiceId?: string;
  model?: string;
  model_id?: string;
  modelId?: string;
  speed?: number;
  rate?: number; // Words per minute
  stability?: number;
  similarity?: number;
  style?: number;
  speakerBoost?: boolean;
  seed?: number;
  normalize?: boolean;
  lang?: string;
  language?: string;
  output_format?: string;
  outputFormat?: string;
  latency_tier?: number;
  once?: boolean; // Apply to current reply only
}

/**
 * Extended TTS options including ElevenLabs-specific parameters.
 */
export interface ElevenLabsTTSOptions {
  voice?: string;
  speed?: number;
  rate?: number; // WPM
  stability?: number;
  similarity?: number;
  similarityBoost?: number;
  style?: number;
  speakerBoost?: boolean;
  seed?: number;
  modelId?: string;
  outputFormat?: string;
  language?: string;
  latencyTier?: number;
}

export type ElevenLabsModel =
  | "eleven_v3"
  | "eleven_turbo_v2_5"
  | "eleven_turbo_v2"
  | "eleven_monolingual_v1"
  | "eleven_multilingual_v2"
  | "eleven_multilingual_v1";

export type ElevenLabsOutputFormat =
  | "pcm_16000"
  | "pcm_22050"
  | "pcm_24000"
  | "pcm_44100"
  | "mp3_22050_32"
  | "mp3_44100_32"
  | "mp3_44100_64"
  | "mp3_44100_96"
  | "mp3_44100_128"
  | "mp3_44100_192"
  | "ulaw_8000";
