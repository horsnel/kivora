# Model Hosting Inventory — what powers Kivora (v5.30.21)

Every model the platform calls, pulled from the actual call sites (`app/api/**`,
`lib/groq.js`, `lib/mistral.js`). Use this as the checklist for the Lightning AI
deployment (`lightning/deploy.md` has the GPU plan and cutover steps).

## 1. Chat + research + vision (must host)

Reads/writes go through the multi-provider chain in `lib/groq.js`; these four
IDs are what clients send and what every route (`/api/chat`, `/api/research`,
`/api/research-fallback`, `/api/vision`, `/api/wiki/*`, `/api/browser/ask`)
requests:

| Canonical ID | Product name | Purpose | Call sites | Self-host footprint |
| --- | --- | --- | --- | --- |
| `openai/gpt-oss-120b` | Nova 3 | Primary chat + research reports + wiki query | `lib/groq.js` `MODEL`; groq-primary, siliconflow, sambanova, gemini, openrouter hops | MoE ~117B (5.1B active), ~63GB MXFP4 → **1×H100-80GB or A100-80GB** |
| `openai/gpt-oss-20b` | Nova 1.9 | Free/fast chat, `groq-fast` quota-relief hop, legacy-ID mapping target | `MODEL_FAST`, groq-fast hop | MoE ~21B, ~12GB MXFP4 → **1×L4-24GB** |
| `qwen/qwen3.8-27b` | Nova Vision | Image attachments in chat (tool use + JSON mode), research image forensics (`analyzeImageAttachments`), vision chain primary | `VISION_MODEL`; chat vision chain; `/api/research` line 222; `/api/vision` | 27B dense multimodal → **1×A100-80GB** bf16 |
| `deepseek-r1-distill-llama-70b` | DeepSeek R1 (Pro-only, gated server-side) | Reasoning tier | `ALLOWED_MODELS[3]`; mapped on sambanova/siliconflow/gemini/openrouter hops | 70B dense → **2×A100-80GB** bf16 / 1×H100-80GB FP8 |

## 2. Mistral ladder (must host — powers devtools/study/reelpen/explore/browser-ask)

`lib/mistral.js` walks this ladder on every request; the gateway serves the
canonical IDs, so host at least the rungs that actually fire (Small is the
workhorse; the 403'd Large is auto-skipped today):

| ID | Purpose | Footprint |
| --- | --- | --- |
| `mistral-small-latest` | **Primary** — devtools agent, study desk, reelpen scripts, explore cards, browser ask; vision-capable (3.x) | 24B → **1×A100-40GB** |
| `open-mistral-nemo` | Fallback rung (12B) | 12B → shares the L4 |
| `ministral-8b-latest` / `ministral-3b-latest` | Fast/last-resort rungs | 8B / 3B → shares the L4 |
| `mistral-medium-latest` | Higher-quality rung (served when quota allows) | optional, 1×A100-40GB slot |
| `mistral-large-latest` | 403 tier-blocked today (code 1910) — host only if you upgrade intent | 123B → 4×A100-80GB (not recommended) |

## 3. Image generation (optional host)

| ID | Purpose | Call sites |
| --- | --- | --- |
| `FLUX.1-schnell` (Pollinations `flux`, CF `@cf/black-forest-labs/flux-1-schnell`, SiliconFlow `black-forest-labs/FLUX.1-schnell`) | `/api/image` chat images; `/api/image3d` first-stage prompt render; chat inline art | 12B DiT, 4-step → **1×A100-80GB** if self-hosted; currently 3 free API providers |

## 4. Voice (move to Lightning — already a self-hosted shape)

| ID | Purpose | Call sites |
| --- | --- | --- |
| `whisperx` / `whisper-large` / `whisper-medium` / `whisper-small` / `whisper-tiny` | `/api/voice/stt` transcription tiers | Proxy → `VOICE_SERVER_URL` `/v1/audio/transcriptions`; `lightning/voice_service.py` serves them all with one `large-v3` engine → **1×L4-24GB** |

## 5. Translation engines (stay as-is)

`/api/voice/translate` engines: `argos`, `nllb` (local, CPU), `google`,
`deepl`, `openai` (LLM pass → Groq chat completions). When Lightning hosts
gpt-oss-20b, point the LLM pass at it or keep the Groq key — no new model.

## 6. 3D generation (keep on vendor APIs)

| ID | Purpose |
| --- | --- |
| `hitem3dv2.1` (api.hitem3d.ai, primary) | image-to-3D mesh for `/api/image3d` |
| `tripo3d` (api.tripo3d.ai, fallback) | same |

These are full mesh-reconstruction pipelines, not single checkpoints — keep
them on their APIs.

## 7. The janitor (no model needed)

The chat janitor (`cleanSessionMessages`, fence repair, failure-notice
pruning, rerun truncation) is deterministic JavaScript — it needs **zero** GPU
time. If you ever want LLM-assisted repair of broken stored replies, reuse
`openai/gpt-oss-20b`; it doesn't merit its own deployment.

## Summary — the hosting list

1. `openai/gpt-oss-120b` — chat flagship (H100/A100 80GB)
2. `openai/gpt-oss-20b` — fast tier (L4 24GB)
3. `qwen/qwen3.8-27b` — vision (A100 80GB)
4. `deepseek-r1-distill-llama-70b` — Pro reasoning (H100 80GB FP8)
5. `mistral-small-latest` (+ Nemo/Ministral rungs) — devtools/study/reelpen/explore (A100 40GB)
6. `FLUX.1-schnell` — images (optional, A100 80GB)
7. Whisper `large-v3` (serving the whisperx tier family) — voice (L4 24GB)

That's **7 deployments** (3 GPU classes can co-locate → realistically 4-5
Studios). Env cutover: `LIGHTNING_BASE_URL` + `LIGHTNING_API_KEY` (+ voice:
`VOICE_SERVER_URL` + `VOICE_API_KEY`), fail-open to the cloud chain.
