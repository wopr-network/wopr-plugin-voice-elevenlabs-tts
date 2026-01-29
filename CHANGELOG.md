# Changelog

All notable changes to the WOPR ElevenLabs TTS Plugin will be documented in this file.

## [1.0.0] - 2024-01-29

### Added
- Initial implementation of ElevenLabs TTS provider for WOPR
- Full TTSProvider interface implementation
- Streaming synthesis support with low-latency optimizations
- Voice directive parsing (compatible with clawdbot talk mode)
- Dynamic voice listing from ElevenLabs API
- Comprehensive voice parameter support:
  - Stability (discrete values for eleven_v3)
  - Similarity boost
  - Style exaggeration
  - Speaker boost
  - Speech rate (speed/WPM)
  - Seed for reproducibility
  - Language selection
  - Latency tier control
- Multiple output formats:
  - PCM (16kHz, 22.05kHz, 24kHz, 44.1kHz)
  - MP3 (various bitrates)
- Model support:
  - eleven_v3 (multilingual)
  - eleven_turbo_v2_5 (fast, low-latency)
  - eleven_turbo_v2
  - eleven_monolingual_v1
  - eleven_multilingual_v2
- Health check endpoint
- Voice cache (1 hour TTL)
- Example usage scripts
- Comprehensive documentation

### Features
- Parse voice directives from first line JSON (clawdbot compatibility)
- Merge options from multiple sources (config, options, directives)
- Validate parameters based on model constraints
- Automatic format mapping between WOPR and ElevenLabs formats
- Environment variable configuration
- Plugin auto-registration

### References
- Based on clawdbot PR 1154 talk mode implementation
- WOPR voice plugin types specification
- ElevenLabs API v1 documentation
