# ElevenLabs TTS Plugin - Implementation Summary

## Overview

This plugin ports the ElevenLabs TTS functionality from clawdbot PR 1154 to the WOPR voice plugin format. It provides high-quality text-to-speech with streaming support, voice directives, and comprehensive parameter control.

## File Structure

```
wopr-plugin-voice-elevenlabs-tts/
├── src/
│   ├── index.ts           # Main provider implementation
│   ├── types.ts           # TypeScript type definitions
│   └── example.ts         # Usage examples
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript configuration
├── .env.example           # Environment variable template
├── .gitignore            # Git ignore rules
├── README.md             # User documentation
├── CHANGELOG.md          # Version history
└── IMPLEMENTATION.md     # This file
```

## Implementation Details

### 1. TTSProvider Interface (`src/index.ts`)

Implements all required methods from `/home/tsavo/wopr/src/voice/types.ts`:

- `metadata`: Plugin metadata with dependency requirements
- `voices`: Cached voice list (1-hour TTL)
- `validateConfig()`: Configuration validation
- `synthesize()`: Batch synthesis
- `streamSynthesize()`: Streaming synthesis (optional)
- `healthCheck()`: API connectivity check (optional)
- `shutdown()`: Cleanup (optional)

### 2. Voice Directive Support

Based on clawdbot talk mode (`docs/nodes/talk.md`):

```json
{"voice":"21m00Tcm4TlvDq8ikWAM","speed":1.2,"stability":0.5,"once":true}
```

Supported keys:
- `voice` / `voice_id` / `voiceId`: Voice identifier
- `model` / `model_id` / `modelId`: Model selection
- `speed`, `rate`: Speech rate control
- `stability`: Voice stability (0.0, 0.5, 1.0 for eleven_v3)
- `similarity`: Similarity boost (0..1)
- `style`: Style exaggeration (0..1)
- `speakerBoost`: Speaker characteristic enhancement
- `seed`: Reproducibility seed
- `language` / `lang`: Language code
- `output_format` / `outputFormat`: Audio format
- `latency_tier`: Latency optimization (0..4)
- `once`: Apply to current reply only

### 3. Voice Parameters

#### Stability
- **eleven_v3**: Discrete values only (0.0, 0.5, 1.0)
- **Other models**: Full range (0..1)
- Validated and clamped based on model

#### Similarity Boost
- Range: 0..1
- Controls voice matching accuracy

#### Style
- Range: 0..1
- Style exaggeration level

#### Speaker Boost
- Boolean flag
- Enhances speaker characteristics

#### Speed/Rate
- Speed: Multiplier (0.25 - 4.0)
- Rate: Words per minute (WPM)
- Converts WPM to speed multiplier (base 150 WPM)

### 4. Model Support

All ElevenLabs models supported:

| Model | Description | Use Case |
|-------|-------------|----------|
| `eleven_v3` | Latest multilingual | High quality, discrete stability |
| `eleven_turbo_v2_5` | Fast turbo (default) | Real-time, low latency |
| `eleven_turbo_v2` | Previous turbo | Fast synthesis |
| `eleven_monolingual_v1` | English only | Original model |
| `eleven_multilingual_v2` | Multilingual v2 | Multi-language support |

### 5. Output Formats

WOPR format mapping:

| WOPR Format | ElevenLabs Format | Sample Rate |
|-------------|-------------------|-------------|
| `pcm_s16le` | `pcm_44100` | 44.1 kHz |
| `mp3` | `mp3_44100_128` | 44.1 kHz |
| `opus` | `ulaw_8000` (fallback) | 8 kHz |

Direct ElevenLabs formats also supported:
- `pcm_16000`, `pcm_22050`, `pcm_24000`, `pcm_44100`
- `mp3_*` variants (multiple bitrates)
- `ulaw_8000`

### 6. Streaming Implementation

Streaming endpoint: `/v1/text-to-speech/{voice_id}/stream`

Features:
- AsyncGenerator pattern for chunk delivery
- Optimized latency tier (default 0 for lowest latency)
- ReadableStream processing via fetch API
- Proper cleanup with reader.releaseLock()

### 7. Voice Listing

Dynamic voice fetching:
- API endpoint: `/v1/voices`
- 1-hour cache TTL
- Voice metadata: id, name, language, gender, description
- Automatic cache refresh

### 8. Configuration

Multiple configuration sources (priority order):

1. Voice directive in text (highest)
2. Method options parameter
3. Provider config
4. Environment variables (lowest)

Environment variables:
- `ELEVENLABS_API_KEY` (required)
- `ELEVENLABS_VOICE_ID` (optional default)
- `ELEVENLABS_MODEL_ID` (optional default)

### 9. Plugin Registration

Auto-registration pattern:

```typescript
export default function register(ctx: any) {
  const provider = new ElevenLabsTTSProvider({ ... });
  ctx.registerTTSProvider(provider);
}
```

Called by WOPR plugin loader with `VoicePluginContext`.

## Key Features

1. **Full Clawdbot Compatibility**: Voice directives work exactly as in talk mode
2. **Streaming Support**: Low-latency streaming for real-time applications
3. **Parameter Validation**: Model-specific validation (e.g., eleven_v3 stability)
4. **Voice Management**: Dynamic voice listing with caching
5. **Format Flexibility**: Multiple audio formats with automatic mapping
6. **Error Handling**: Comprehensive error messages and fallbacks
7. **Type Safety**: Full TypeScript typing with exported types

## Testing

See `src/example.ts` for:
- Batch synthesis
- Streaming synthesis
- Voice listing
- Health checks
- Different voice parameters

## Integration with WOPR

The plugin integrates via:

1. `ctx.registerTTSProvider(provider)` - Registration
2. Voice channels call `ctx.getTTS()` - Retrieval
3. Standard `TTSProvider` interface - Usage

## References

- **Clawdbot Talk Mode**: `/home/tsavo/wopr-project/reference/clawdbot-1154/docs/nodes/talk.md`
- **WOPR Voice Types**: `/home/tsavo/wopr/src/voice/types.ts`
- **ElevenLabs API**: https://elevenlabs.io/docs/api-reference/text-to-speech
- **Clawdbot TTS Runtime**: `/home/tsavo/wopr-project/reference/clawdbot-1154/apps/macos/Sources/Clawdbot/TalkModeRuntime.swift`

## Next Steps

To use this plugin:

1. Install dependencies: `npm install`
2. Build: `npm run build`
3. Set `ELEVENLABS_API_KEY` environment variable
4. Load plugin in WOPR configuration
5. Plugin auto-registers on load

The plugin is ready for integration with WOPR voice channels (Discord, Telegram, etc.).
