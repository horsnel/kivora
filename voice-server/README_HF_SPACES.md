---
title: Kivora Voice Server
emoji: 🎙️
colorFrom: purple
colorTo: red
sdk: docker
app_port: 3900
pinned: false
---

# Kivora Voice Server

Voice AI backend with 10 OmniVoice services for the Kivora app.

## Services

| Service | Endpoint | Description |
|---------|----------|-------------|
| TTS | `POST /v1/audio/speech` | Text-to-speech (Edge TTS + Coqui XTTS) |
| STT | `POST /v1/audio/transcriptions` | Speech-to-text (faster-whisper) |
| Translate | `POST /dub/translate` | Translation (Argos + LLM fallback) |
| Clone | `POST /profiles` | Voice cloning profiles |
| Watermark | `POST /watermark/detect` | AI audio watermark detection |
| Isolate | `POST /tools/isolate-vocals` | Vocal isolation (Demucs) |
| Diarize | `POST /tools/diarize` | Speaker diarization (Pyannote) |
| Engines | `GET /engines/{tts,asr,translation}` | List available engines |
| Health | `GET /health` | Server health check |

## Setup

1. Set `HF_TOKEN` in Space Settings > Repository Secrets
2. Optionally set `OMNIVOICE_API_KEY` for authentication
3. The server auto-detects installed packages and gracefully disables unavailable services

## API Docs

Once deployed, visit `/docs` for the interactive Swagger UI.
