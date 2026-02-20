# wopr-plugin-voice-elevenlabs-tts

ElevenLabs TTS (text-to-speech) capability provider for WOPR.

## Commands

```bash
npm run build     # tsc
npm run check     # biome check + tsc --noEmit (run before committing)
npm run format    # biome format --write src/
npm test          # vitest run
```

## Architecture

```
src/
  index.ts    # Plugin entry — registers TTS capability provider
  types.ts    # Plugin-local types
  example.ts  # Usage example (not production code)
```

## Key Details

- Implements the `tts` capability provider from `@wopr-network/plugin-types`
- ElevenLabs API key configured via plugin config schema
- Voice ID selectable via config (defaults to a sensible voice)
- Returns audio as a Buffer/stream — the core handles playback routing
- **Gotcha**: ElevenLabs streams audio in chunks. Handle partial audio correctly — don't buffer the entire response before returning.
- Hosted capability: users pay per character. This is a revenue-generating capability.

## Plugin Contract

Imports only from `@wopr-network/plugin-types`. Never import from `@wopr-network/wopr` core.

## Issue Tracking

All issues in **Linear** (team: WOPR). Issue descriptions start with `**Repo:** wopr-network/wopr-plugin-voice-elevenlabs-tts`.

## Session Memory

At the start of every WOPR session, **read `~/.wopr-memory.md` if it exists.** It contains recent session context: which repos were active, what branches are in flight, and how many uncommitted changes exist. Use it to orient quickly without re-investigating.

The `Stop` hook writes to this file automatically at session end. Only non-main branches are recorded — if everything is on `main`, nothing is written for that repo.