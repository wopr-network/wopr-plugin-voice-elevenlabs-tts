# Voice Directive Quick Reference

Voice directives allow the assistant to control TTS parameters dynamically by embedding a JSON object in the first line of the reply.

## Basic Format

```json
{"voice":"21m00Tcm4TlvDq8ikWAM","speed":1.2,"once":true}
This is the text that will be spoken.
```

The JSON line is automatically stripped before synthesis.

## All Supported Keys

### Voice Selection
```json
{"voice": "21m00Tcm4TlvDq8ikWAM"}
// Aliases: voice_id, voiceId
```

### Model Selection
```json
{"model": "eleven_turbo_v2_5"}
// Aliases: model_id, modelId
// Options: eleven_v3, eleven_turbo_v2_5, eleven_turbo_v2, etc.
```

### Speed Control
```json
{"speed": 1.2}
// Range: 0.25 - 4.0
// Alternative: {"rate": 180}  // Words per minute (base 150 WPM)
```

### Voice Parameters
```json
{
  "stability": 0.5,     // 0.0, 0.5, 1.0 for eleven_v3; 0..1 for others
  "similarity": 0.75,   // 0..1 (how closely to match voice)
  "style": 0.5,         // 0..1 (style exaggeration)
  "speakerBoost": true  // Boolean (enhance speaker characteristics)
}
```

### Advanced Options
```json
{
  "seed": 12345,          // Integer 0-4294967295 (reproducibility)
  "language": "en",       // Language code
  "output_format": "pcm_44100",  // Audio format
  "latency_tier": 0       // 0-4 (0 = lowest latency)
}
// Aliases: lang, outputFormat, latency_tier
```

### Temporary Override
```json
{"voice":"EXAVITQu4vr4xnSDxMaL","once":true}
```

The `once: true` flag applies the directive to the current reply only, without changing the default voice.

## Common Examples

### Change Voice (Persistent)
```json
{"voice":"21m00Tcm4TlvDq8ikWAM"}
Hello, I'm now speaking with Rachel's voice.
```

### Change Voice (One-Time)
```json
{"voice":"EXAVITQu4vr4xnSDxMaL","once":true}
This line uses Bella's voice, but the next reply will use the default.
```

### Slow Down
```json
{"speed":0.8}
Speaking... more... slowly... now.
```

### Speed Up
```json
{"rate":200}
Speaking quickly at 200 words per minute!
```

### Expressive Speech
```json
{"stability":0.0,"style":1.0}
This will be very expressive and variable!
```

### Consistent Speech
```json
{"stability":1.0,"style":0.0}
This will be very consistent and monotone.
```

### Switch Model
```json
{"model":"eleven_v3"}
Using the latest eleven_v3 model for higher quality.
```

### Low Latency Streaming
```json
{"latency_tier":0,"model":"eleven_turbo_v2_5"}
Optimized for real-time streaming with lowest latency.
```

### Full Control
```json
{"voice":"21m00Tcm4TlvDq8ikWAM","model":"eleven_turbo_v2_5","speed":1.1,"stability":0.5,"similarity":0.75,"style":0.3,"speakerBoost":true,"latency_tier":0}
This reply uses all available parameters for fine-grained control.
```

## Popular Voices

From ElevenLabs default library:

```json
{"voice":"21m00Tcm4TlvDq8ikWAM"}  // Rachel - calm, clear
{"voice":"AZnzlk1XvdvUeBnXmlld"}  // Domi - strong, confident
{"voice":"EXAVITQu4vr4xnSDxMaL"}  // Bella - soft, gentle
{"voice":"ErXwobaYiN019PkySvjV"}  // Antoni - well-rounded
{"voice":"MF3mGyEYCl7XYWbV9V6O"}  // Elli - energetic
{"voice":"TxGEqnHWrfWFTfGW9XjX"}  // Josh - deep, serious
{"voice":"VR6AewLTigWG4xSOukaG"}  // Arnold - strong, authoritative
{"voice":"pNInz6obpgDQGcFmaJgB"}  // Adam - narrative
{"voice":"yoZ06aMxZJJ28mfd3POQ"}  // Sam - dynamic
```

## Model Comparison

| Model | Speed | Quality | Latency | Stability Values |
|-------|-------|---------|---------|------------------|
| eleven_v3 | Medium | Highest | Medium | 0.0, 0.5, 1.0 only |
| eleven_turbo_v2_5 | Fastest | High | Lowest | 0..1 continuous |
| eleven_turbo_v2 | Fast | High | Low | 0..1 continuous |
| eleven_multilingual_v2 | Medium | High | Medium | 0..1 continuous |
| eleven_monolingual_v1 | Medium | Good | Medium | 0..1 continuous |

## Tips

1. **Start Simple**: Begin with just `{"voice":"id"}` and add parameters as needed
2. **Use `once: true`**: For character voices or temporary changes
3. **eleven_v3 Stability**: Remember discrete values (0.0, 0.5, 1.0) only
4. **Streaming**: Use `latency_tier: 0` with turbo models for real-time
5. **Consistency**: Use `seed` for reproducible output
6. **Speed**: Use `rate` (WPM) for natural speed, `speed` for multiplier
7. **Unknown Keys**: Will be logged as warnings but won't break synthesis

## Validation

All parameters are validated and clamped to safe ranges:

- **speed**: 0.25 - 4.0
- **rate**: Converted to speed (base 150 WPM)
- **stability**: 0..1 (quantized for eleven_v3)
- **similarity, style**: 0..1
- **seed**: 0 - 4294967295 (integer)
- **latency_tier**: 0 - 4 (integer)

Invalid values are automatically corrected to the nearest valid value.
