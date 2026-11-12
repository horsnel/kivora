# Lightning AI Deployment Runbook

Self-hosting Kivora's inference on [Lightning AI](https://lightning.ai) via
LitServe. The app's provider chain tries the gateway **first** when
`LIGHTNING_BASE_URL` is set, and **fails open** to the existing cloud
providers (Groq/Cerebras/SambaNova/SiliconFlow/Gemini/OpenRouter/Mistral)
whenever it isn't configured or the deployment is down — so rollout and
rollback are both just env changes in Cloudflare Pages.

## Instance plan (separate Studios per GPU class)

| Studio | GPU | Serves | vRAM |
| --- | --- | --- | --- |
| `kivora-chat-xl` | 1× H100-80GB (or A100-80GB) | `openai/gpt-oss-120b`, `deepseek-r1-distill-llama-70b` (FP8) | ~63GB MXFP4 |
| `kivora-chat-fast` | 1× L4-24GB | `openai/gpt-oss-20b`, `mistral-small-latest` (AWQ) | ~12GB + ~14GB |
| `kivora-vision` | 1× A100-80GB | `qwen/qwen3.8-27b` (multimodal, bf16) | ~54GB |
| `kivora-voice` | 1× L4-24GB | Whisper `large-v3` (`voice_service.py`) | ~3GB fp16 |
| `kivora-image` (optional) | 1× A100-80GB | `FLUX.1-schnell` (diffusers, 4-step) | ~24GB fp16 |

One Studio can host several models if the VRAM fits (chat-fast hosts both of
its rows comfortably; never co-locate the 120B with anything else).

## Steps per Studio

1. Create a Lightning Studio with the GPU class above (their default image
   already has CUDA + PyTorch).
2. Clone the repo and install:
   ```bash
   pip install -r lightning/requirements.txt
   ```
3. Chat/vision instance — run the gateway:
   ```bash
   KIVORA_GATEWAY_API_KEY=<random-40-char-secret> python lightning/service.py
   ```
4. Voice instance — run the transcription server:
   ```bash
   KIVORA_VOICE_API_KEY=<random-40-char-secret> python lightning/voice_service.py
   ```
5. Turn the Studio's public serving URL on (Lightning exposes the process
   port over HTTPS). Copy the public origin.

## Cloudflare Pages cutover (Production environment)

| Variable | Value | Effect |
| --- | --- | --- |
| `LIGHTNING_BASE_URL` | Studio origin, **no** `/v1` (e.g. `https://kivora-chat-xl.lightning.ai`) | chat + research + vision chains try it first |
| `LIGHTNING_API_KEY` | the `KIVORA_GATEWAY_API_KEY` value | Bearer auth on every hop |
| `VOICE_SERVER_URL` | voice Studio origin | `/api/voice/stt` proxies Whisper here |
| `VOICE_API_KEY` | the `KIVORA_VOICE_API_KEY` value | `X-API-Key` header check |

Empty/missing `LIGHTNING_BASE_URL` = instant rollback to the cloud chain;
nothing else changes.

## Smoke test before switching traffic

```bash
curl -s "$BASE/v1/chat/completions" -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d '{"model":"openai/gpt-oss-20b","messages":[{"role":"user","content":"ping"}],"max_tokens":16}'
curl -s "$VOICE/v1/audio/transcriptions" -H "X-API-Key: $VKEY" -F file=@sample.wav -F model=whisperx
```

## Image models (FLUX.1-schnell)

The `/api/image` route currently uses Pollinations → Cloudflare Workers AI →
SiliconFlow. A Lightning instance running diffusers' `FLUX.1-schnell`
(4-step, ~1-2s per 1024px image on an A100) is prepared in `requirements.txt`
as an optional instance; wire it by adding a `lightning` provider hop to
`app/api/image/route.js` (same pattern as `lib/groq.js`) — intentionally not
pre-wired so image cutover can be load-tested separately.

## Keep-on-API (do NOT self-host)

- **3D generation**: `hitem3dv2.1` (api.hitem3d.ai) and `tripo3d`
  (api.tripo3d.ai) are full mesh-reconstruction pipelines — image-to-3D
  isn't a single checkpoint you can LitServe; stay on their APIs.
- **Web translation engines** (argos/nllb/google/deepl): argos/nllb run
  CPU-side already; the rest are external services.
- **The janitor** (`cleanSessionMessages`): deterministic text repair, no
  model. If you later want LLM-assisted repair, it reuses the fast tier
  (`openai/gpt-oss-20b`) — no separate hosting needed.
