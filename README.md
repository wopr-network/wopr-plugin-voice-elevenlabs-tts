# WOPR ElevenLabs TTS Plugin

High-quality text-to-speech using the ElevenLabs API with streaming support.

## Features

- **Streaming TTS**: Low-latency streaming synthesis for real-time voice output
- **Voice Selection**: Dynamic voice listing from ElevenLabs API
- **Voice Parameters**: Full control over stability, similarity boost, style, and speaker boost
- **Multiple Models**: Support for all ElevenLabs models (eleven_v3, eleven_turbo_v2_5, etc.)
- **Speed Control**: Adjustable speech rate
- **Multiple Formats**: PCM and MP3 output formats

## Installation

```bash
cd ~/wopr-project/plugins/wopr-plugin-voice-elevenlabs-tts
npm install
npm run build
```

## Configuration

### Environment Variables

Required:
- `ELEVENLABS_API_KEY`: Your ElevenLabs API key (get one at https://elevenlabs.io)

Optional:
- `ELEVENLABS_VOICE_ID`: Default voice ID
- `ELEVENLABS_MODEL_ID`: Default model (default: `eleven_turbo_v2_5`)

### Example Usage

```typescript
import { ElevenLabsTTSProvider } from "wopr-plugin-voice-elevenlabs-tts";

const provider = new ElevenLabsTTSProvider({
  apiKey: process.env.ELEVENLABS_API_KEY,
  defaultVoiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
  defaultModelId: "eleven_turbo_v2_5",
  stability: 0.5,
  similarityBoost: 0.75,
  speakerBoost: true,
});

// Batch synthesis
const result = await provider.synthesize("Hello, World!", {
  voice: "21m00Tcm4TlvDq8ikWAM",
  speed: 1.0,
  format: "pcm_s16le",
});

// Streaming synthesis (for low latency)
for await (const chunk of provider.streamSynthesize("This is a longer text...", {
  voice: "21m00Tcm4TlvDq8ikWAM",
})) {
  // Play chunk immediately for minimal latency
  playAudioChunk(chunk);
}

// List available voices
await provider.fetchVoices();
console.log(provider.voices);
```

## Voice Parameters

Based on clawdbot talk mode implementation:

### Stability
- **Range**: 0.0 to 1.0
- **eleven_v3 only**: Supports discrete values: 0.0, 0.5, 1.0
- **Other models**: Accept full 0..1 range
- **Default**: 0.5
- **Description**: Controls consistency vs expressiveness

### Similarity Boost
- **Range**: 0.0 to 1.0
- **Default**: 0.75
- **Description**: How closely to match the original voice

### Style
- **Range**: 0.0 to 1.0
- **Default**: undefined (uses voice default)
- **Description**: Style exaggeration level

### Speaker Boost
- **Type**: Boolean
- **Default**: true
- **Description**: Enhance speaker characteristics

### Speed/Rate
- **Speed**: Multiplier (0.25 - 4.0)
- **Rate**: Words per minute (WPM)
- **Default**: 1.0 (normal speed)

## Supported Models

- `eleven_v3`: Latest multilingual model (high quality, discrete stability values)
- `eleven_turbo_v2_5`: Fast model with low latency (recommended for real-time)
- `eleven_turbo_v2`: Previous fast model
- `eleven_monolingual_v1`: Original English-only model
- `eleven_multilingual_v2`: Multilingual model v2

## Output Formats

ElevenLabs supports multiple output formats:

- `pcm_16000`: 16kHz PCM (Android low-latency)
- `pcm_22050`: 22.05kHz PCM
- `pcm_24000`: 24kHz PCM (Android)
- `pcm_44100`: 44.1kHz PCM (macOS/iOS default)
- `mp3_44100_128`: MP3 at 44.1kHz, 128kbps

The plugin automatically maps WOPR audio formats:
- `pcm_s16le` → `pcm_44100`
- `mp3` → `mp3_44100_128`

## Voice Directives (Talk Mode)

The plugin supports voice directives in assistant replies (from clawdbot talk mode):

```json
{"voice":"21m00Tcm4TlvDq8ikWAM","speed":1.2,"once":true}
```

Supported keys:
- `voice` / `voice_id` / `voiceId`: Voice ID
- `model` / `model_id` / `modelId`: Model ID
- `speed`, `rate`: Speech rate
- `stability`, `similarity`, `style`, `speakerBoost`: Voice parameters
- `once`: Apply to current reply only (don't change default)

## API Reference

### `ElevenLabsTTSProvider`

Implements the WOPR `TTSProvider` interface.

#### Constructor

```typescript
new ElevenLabsTTSProvider(config: Partial<ElevenLabsConfig>)
```

#### Methods

- `synthesize(text: string, options?: TTSOptions): Promise<TTSSynthesisResult>`
  - Synthesize entire text to audio buffer

- `streamSynthesize(text: string, options?: TTSOptions): AsyncGenerator<Buffer>`
  - Stream audio chunks for low-latency playback

- `fetchVoices(): Promise<Voice[]>`
  - Fetch available voices from ElevenLabs API
  - Cached for 1 hour

- `healthCheck(): Promise<boolean>`
  - Check API connectivity

- `validateConfig(): void`
  - Validate configuration (throws on invalid)

## Integration with WOPR

The plugin registers automatically when loaded:

```typescript
import register from "wopr-plugin-voice-elevenlabs-tts";

// In your WOPR plugin initialization
register(ctx);
```

The `ctx.registerTTSProvider()` method makes this provider available to all WOPR voice channels.

## References

- ElevenLabs API: https://elevenlabs.io/docs/api-reference
- Clawdbot Talk Mode: `/home/tsavo/wopr-project/reference/clawdbot-1154/docs/nodes/talk.md`
- WOPR Voice Types: `/home/tsavo/wopr/src/voice/types.ts`

## License

MIT
