# Kivora Voice Server

> Docker-based deployment of the [OmniVoice Studio](https://github.com/debpalash/omnivoice-studio) FastAPI backend — the voice AI backbone for the Kivora web application.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Kivora Web App                        │
│              (Next.js on port 3000)                      │
└────────────────────┬────────────────────────────────────┘
                     │  X-API-Key header
                     │  /api/tts/* /api/asr/* etc.
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Caddy Reverse Proxy                         │
│         (TLS termination, auth, rate-limit, CORS)        │
│                  port 443 / 3901                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           OmniVoice Studio Container                     │
│         (FastAPI + Uvicorn on port 3900)                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │  TTS Service  │  ASR Service  │  8 More Services │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │      AI Models (downloaded to /data volume)      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

The voice server runs as an isolated Docker container on a dedicated bridge network (`kivora-voice`). Caddy sits in front, handling automatic HTTPS, API key authentication, rate limiting, CORS, and WebSocket proxying for streaming TTS.

---

## Prerequisites

| Requirement | CPU Mode | GPU Mode |
|---|---|---|
| **Docker Engine** | >= 20.10 | >= 20.10 |
| **Docker Compose** | V2 (plugin) | V2 (plugin) |
| **NVIDIA GPU** | Not required | CUDA 12.0+ compatible |
| **NVIDIA Driver** | Not required | >= 525.60.13 |
| **NVIDIA Container Toolkit** | Not required | Required |
| **RAM** | >= 8 GB | >= 16 GB |
| **Disk** | >= 20 GB free | >= 20 GB free |
| **Hugging Face Token** | Required | Required |

### Installing NVIDIA Container Toolkit (GPU mode)

```bash
# Ubuntu / Debian
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

---

## Quick Start

### 1. Clone and Configure

```bash
cd voice-server
cp .env.example .env
nano .env
```

**Required settings:**

```env
# Generate an API key
OMNIVOICE_API_KEY=$(openssl rand -hex 32)

# Get from https://huggingface.co/settings/tokens
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxx
```

### 2. Deploy

```bash
# Make deploy script executable
chmod +x deploy.sh

# CPU mode (no GPU required)
./deploy.sh cpu start

# GPU mode (requires NVIDIA GPU + Container Toolkit)
./deploy.sh gpu start
```

### 3. Verify

```bash
# Check health
curl http://localhost:3900/health

# Test TTS (replace YOUR_API_KEY with your OMNIVOICE_API_KEY)
curl -X POST http://localhost:3900/api/tts/synthesize \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from Kivora Voice Server!", "language": "en"}' \
  --output test.wav

# Test ASR
curl -X POST http://localhost:3900/api/asr/transcribe \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "audio=@test.wav" \
  -F "language=en"
```

### 4. Manage

```bash
./deploy.sh cpu status     # Check status
./deploy.sh cpu logs       # View logs
./deploy.sh cpu restart    # Restart server
./deploy.sh cpu update     # Update to latest image
./deploy.sh cpu stop       # Stop server
```

---

## Configuration Options

All configuration is managed through the `.env` file. See [`.env.example`](.env.example) for the complete list with documentation.

### Key Configuration Categories

| Category | Key Variables | Description |
|---|---|---|
| **Core** | `OMNIVOICE_API_KEY`, `HF_TOKEN` | Authentication and model access |
| **TTS** | `OMNIVOICE_TTS_BACKEND`, `OMNIVOICE_COQUI_MODEL` | Text-to-speech engine selection |
| **ASR** | `OMNIVOICE_ASR_BACKEND`, `OMNIVOICE_WHISPER_MODEL` | Speech recognition engine |
| **Audio** | `OMNIVOICE_SAMPLE_RATE`, `OMNIVOICE_OUTPUT_FORMAT` | Output audio parameters |
| **Performance** | `OMNIVOICE_WORKERS`, `OMNIVOICE_LOG_LEVEL` | Server tuning |
| **GPU** | `NVIDIA_VISIBLE_DEVICES`, `OMNIVOICE_CUDA_MEMORY_FRACTION` | GPU resource allocation |
| **Security** | `OMNIVOICE_AUTH_ENABLED`, `OMNIVOICE_CORS_ORIGINS` | Access control |

---

## API Endpoints Reference

The OmniVoice Studio backend exposes 10 service categories through its FastAPI interface.

### 1. Text-to-Speech (TTS)

| Endpoint | Method | Description |
|---|---|---|
| `/api/tts/synthesize` | POST | Synthesize speech from text |
| `/api/tts/stream` | POST | Stream synthesized audio (WebSocket) |
| `/api/tts/voices` | GET | List available voices/speakers |
| `/api/tts/models` | GET | List loaded TTS models |
| `/api/tts/clone` | POST | Clone a voice from reference audio |

**Request body** (`/api/tts/synthesize`):
```json
{
  "text": "Hello, world!",
  "language": "en",
  "speaker_id": "default",
  "speed": 1.0,
  "output_format": "wav",
  "sample_rate": 24000
}
```

### 2. Automatic Speech Recognition (ASR)

| Endpoint | Method | Description |
|---|---|---|
| `/api/asr/transcribe` | POST | Transcribe audio file to text |
| `/api/asr/transcribe/stream` | POST | Stream transcription of audio chunks |
| `/api/asr/languages` | GET | List supported languages |

**Request** (`/api/asr/transcribe`): multipart form with `audio` file and optional `language` field.

### 3. Voice Cloning

| Endpoint | Method | Description |
|---|---|---|
| `/api/voice/clone` | POST | Create a voice clone from reference audio |
| `/api/voice/list` | GET | List all cloned voices |
| `/api/voice/{voice_id}` | GET | Get details of a cloned voice |
| `/api/voice/{voice_id}` | DELETE | Delete a cloned voice |

### 4. Language Detection

| Endpoint | Method | Description |
|---|---|---|
| `/api/language/detect` | POST | Detect the language of audio input |
| `/api/language/detect/text` | POST | Detect the language of text input |

### 5. Speech Translation

| Endpoint | Method | Description |
|---|---|---|
| `/api/translate/speech` | POST | Translate speech from one language to another |
| `/api/translate/text` | POST | Translate text between languages |
| `/api/translate/languages` | GET | List supported translation pairs |

### 6. Audio Processing

| Endpoint | Method | Description |
|---|---|---|
| `/api/audio/enhance` | POST | Enhance audio quality (noise reduction) |
| `/api/audio/convert` | POST | Convert audio between formats |
| `/api/audio/segment` | POST | Segment audio by voice activity |
| `/api/audio/diarize` | POST | Speaker diarization (identify speakers) |

### 7. Pronunciation

| Endpoint | Method | Description |
|---|---|---|
| `/api/pronunciation/phonemize` | POST | Convert text to phonemes |
| `/api/pronunciation/align` | POST | Force-align audio with transcript |

### 8. Emotion Detection

| Endpoint | Method | Description |
|---|---|---|
| `/api/emotion/detect` | POST | Detect emotion from speech audio |
| `/api/emotion/tts` | POST | Synthesize speech with specified emotion |

### 9. Model Management

| Endpoint | Method | Description |
|---|---|---|
| `/api/models/list` | GET | List all loaded/downloaded models |
| `/api/models/download` | POST | Download a specific model |
| `/api/models/{model_id}/status` | GET | Check model loading status |
| `/api/models/{model_id}/unload` | POST | Unload a model from memory |

### 10. System

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check (no auth required) |
| `/api/system/info` | GET | System information (GPU, RAM, models) |
| `/api/system/metrics` | GET | Performance metrics |
| `/docs` | GET | OpenAPI interactive documentation |
| `/openapi.json` | GET | OpenAPI schema |

---

## Supported TTS Engines

| Engine | Backend Value | GPU | Streaming | Voice Cloning | Multilingual | Quality |
|---|---|---|---|---|---|---|
| **Coqui TTS** | `coqui` | Yes | Yes | Yes (XTTS) | Yes | High |
| **MLX Audio** | `mlx_audio` | Apple Silicon | Yes | Yes | Limited | High |
| **ElevenLabs** | `elevenlabs` | Cloud | Yes | Yes | Yes | Highest |
| **OpenAI** | `openai` | Cloud | Yes | No | Yes | High |
| **MeloTTS** | `melotts` | Yes | No | No | Yes | Medium |
| **Parler-TTS** | `parler` | Yes | Yes | No | Limited | High |
| **StyleTTS2** | `styletts2` | Yes | Yes | Yes | No | Very High |
| **Bark** | `bark` | Yes | Yes | No | Yes | Medium |
| **Edge TTS** | `edge` | No (cloud) | Yes | No | Yes | Medium |
| **Fish Speech** | `fish_speech` | Yes | Yes | Yes | Yes | High |

### Recommended Configurations

**Best quality (GPU required):**
```env
OMNIVOICE_TTS_BACKEND=coqui
OMNIVOICE_COQUI_MODEL=tts_models/multilingual/multi-dataset/xtts_v2
```

**Fastest CPU inference:**
```env
OMNIVOICE_TTS_BACKEND=melotts
```

**Cloud-based (no local GPU):**
```env
OMNIVOICE_TTS_BACKEND=elevenlabs
ELEVENLABS_API_KEY=your_key_here
```

**Apple Silicon:**
```env
OMNIVOICE_TTS_BACKEND=mlx_audio
OMNIVOICE_MLX_AUDIO_MODEL=mlx-community/csm-1b
```

---

## Hardware Requirements

### CPU Mode

| Component | Minimum | Recommended |
|---|---|---|
| **CPU** | 4 cores | 8+ cores (AVX2 support) |
| **RAM** | 8 GB | 16 GB |
| **Disk** | 20 GB | 50 GB SSD |
| **Network** | Broadband | Low-latency connection |

> **Note:** CPU inference is significantly slower. TTS latency may be 5-15 seconds per sentence. ASR is more tolerable at 1-3x realtime with `faster_whisper` and the `small` model.

### GPU Mode

| Component | Minimum | Recommended |
|---|---|---|
| **GPU** | NVIDIA 8 GB VRAM | NVIDIA 16+ GB VRAM |
| **GPU Models** | RTX 3060, T4, L4 | RTX 4080, A100, H100 |
| **CPU** | 4 cores | 8+ cores |
| **RAM** | 16 GB | 32 GB |
| **Disk** | 20 GB | 50 GB SSD |
| **CUDA** | 12.0+ | 12.4+ |

**VRAM usage by model:**

| Model | VRAM Required | Notes |
|---|---|---|
| Whisper `tiny` | ~1 GB | Fast but less accurate |
| Whisper `base` | ~1.5 GB | Good balance for real-time |
| Whisper `small` | ~2.5 GB | Recommended for most use cases |
| Whisper `medium` | ~5 GB | High accuracy |
| Whisper `large-v3` | ~10 GB | Best accuracy, slow without GPU |
| Coqui XTTS v2 | ~4 GB | Multilingual with voice cloning |
| StyleTTS2 | ~3 GB | Highest naturalness |
| Fish Speech 1.5 | ~6 GB | Fast multilingual |

---

## Troubleshooting

### Container won't start

```bash
# Check container logs
./deploy.sh cpu logs

# Check if port is already in use
sudo lsof -i :3900

# Verify Docker is running
docker info
```

### Health check keeps failing

```bash
# Check if the app started correctly
docker logs kivora-voice-server 2>&1 | tail -50

# Common issues:
# 1. HF_TOKEN not set or invalid - models can't download
# 2. Insufficient RAM/VRAM - model loading fails
# 3. Disk full - can't store downloaded models

# Manually check health
docker exec kivora-voice-server curl -f http://localhost:3900/health
```

### GPU not detected

```bash
# Verify NVIDIA driver
nvidia-smi

# Verify Container Toolkit
docker run --rm --gpus all nvidia/cuda:12.8.0-base-ubuntu22.04 nvidia-smi

# Check container GPU access
docker exec kivora-voice-server-gpu nvidia-smi
```

### Out of VRAM

```bash
# Reduce model size
# In .env:
OMNIVOICE_WHISPER_MODEL=small       # instead of large-v3
OMNIVOICE_COQUI_MODEL=tts_models/en/ljspeech/tacotron2-DDC  # instead of xtts_v2

# Or limit CUDA memory
OMNIVOICE_CUDA_MEMORY_FRACTION=0.7
```

### Slow first request

This is normal. On the first request, models are downloaded from Hugging Face and loaded into memory. Subsequent requests will be fast. To pre-load:

```bash
# Trigger model download
curl -X POST http://localhost:3900/api/models/download \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model_id": "tts_models/multilingual/multi-dataset/xtts_v2"}'
```

### CORS errors from frontend

```bash
# Ensure OMNIVOICE_CORS_ORIGINS includes your frontend URL
# In .env:
OMNIVOICE_CORS_ORIGINS=https://kivora.app,https://www.kivora.app,http://localhost:3000

# Restart after changing .env
./deploy.sh cpu restart
```

---

## Security Considerations

### API Key Authentication

- **Always set `OMNIVOICE_API_KEY`** in production. Without it, the API is completely open.
- Generate a strong key: `openssl rand -hex 32`
- The key is passed via the `X-API-Key` HTTP header on every request.
- Health check and documentation endpoints (`/health`, `/docs`, `/openapi.json`) are exempt from auth.

### Network Isolation

- The voice server runs on an isolated Docker bridge network (`kivora-voice`, subnet `172.30.0.0/16`).
- Only the mapped port (3900) is accessible from the host.
- In production, place Caddy in front and do not expose port 3900 directly.

### HTTPS / TLS

- Caddy automatically provisions TLS certificates via Let's Encrypt.
- TLS 1.2 and 1.3 are the only allowed protocols.
- Modern cipher suites only; weak ciphers are disabled.

### Rate Limiting

- Default: 30 requests/second per IP for general endpoints.
- TTS endpoints: 10 requests/second per IP (due to GPU cost).
- Configure via `OMNIVOICE_RATE_LIMIT` and `OMNIVOICE_TTS_RATE_LIMIT` in `.env`.

### Hugging Face Token

- `HF_TOKEN` is required for downloading gated models.
- Store it securely in `.env` (never commit to version control).
- The token is only used during model download, not for inference.

### Data Persistence

- Models and cloned voices are stored in the `kivora-voice-data` Docker volume.
- Back up regularly: `docker run --rm -v kivora-voice-data:/data -v $(pwd):/backup alpine tar czf /backup/voice-data-backup.tar.gz /data`
- Restore: `docker run --rm -v kivora-voice-data:/data -v $(pwd):/backup alpine tar xzf /backup/voice-data-backup.tar.gz -C /`

---

## File Reference

| File | Purpose |
|---|---|
| `docker-compose.yml` | Docker Compose configuration (CPU + GPU profiles) |
| `Dockerfile` | Custom lightweight API-only build (multi-stage) |
| `Caddyfile` | Caddy reverse proxy with TLS, auth, rate-limiting |
| `.env.example` | Template for environment variables |
| `deploy.sh` | Deployment and management script |
| `README.md` | This documentation |

---

## License

This deployment configuration is provided under the MIT License. The OmniVoice Studio upstream project has its own license — see [github.com/debpalash/omnivoice-studio](https://github.com/debpalash/omnivoice-studio) for details.
