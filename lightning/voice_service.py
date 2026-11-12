# ══════════════════════════════════════════════════════════════════
# Kivora voice server on Lightning AI — Whisper STT (faster-whisper)
# ══════════════════════════════════════════════════════════════════
# The platform's /api/voice/stt route proxies to VOICE_SERVER_URL with an
# OpenAI-compatible POST /v1/audio/transcriptions (multipart: file, model,
# language, response_format). This service implements exactly that shape, so
# cutover is a single env change:
#
#   Run in a Lightning Studio (GPU attached):
#     pip install -r requirements.txt
#     python voice_service.py              # serves :3900
#
#   Then set in Cloudflare Pages (Production env):
#     VOICE_SERVER_URL=https://<voice-studio-domain>
#     VOICE_API_KEY=<same value as VOICE_KEY below>
#
# The route accepts model ∈ {whisperx, whisper-large, whisper-medium,
# whisper-small, whisper-tiny}; all are served by the one faster-whisper
# engine (the requested tier only changes the decode settings below).

import os
import io
import time
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from faster_whisper import WhisperModel

VOICE_KEY = os.environ.get("KIVORA_VOICE_API_KEY", "")  # empty = open endpoint
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "large-v3")  # large-v3 ≈ 3GB VRAM fp16

app = FastAPI(title="Kivora Voice Gateway")
_model = None


def get_model():
    global _model
    if _model is None:
        # compute_dtype float16 fits an L4/A10 24GB GPU comfortably
        _model = WhisperModel(MODEL_SIZE, device="auto", compute_type="float16")
    return _model


def _check_key(x_api_key: str):
    if VOICE_KEY and x_api_key != VOICE_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_SIZE}


@app.post("/v1/audio/transcriptions")
async def transcriptions(
    file: UploadFile = File(...),
    model: str = Form("whisperx"),
    language: str = Form(None),
    response_format: str = Form("json"),
    x_api_key: str = Header(None),
):
    _check_key(x_api_key)
    audio_bytes = await file.read()

    # Decode settings per requested tier (whisperx/whisper-large → best)
    tier = (model or "whisperx").lower()
    beam = {"whisper-tiny": 1, "whisper-small": 2, "whisper-medium": 3}.get(tier, 5)
    vad = tier in ("whisperx", "whisper-large", "whisper-medium")

    started = time.time()
    segments, info = get_model().transcribe(
        io.BytesIO(audio_bytes),
        language=language or None,
        beam_size=beam,
        vad_filter=vad,
    )
    text = "".join(s.text for s in segments)

    if response_format == "verbose_json":
        return {
            "text": text,
            "language": info.language,
            "duration": info.duration,
            "segments": [{"start": s.start, "end": s.end, "text": s.text} for s in []],
            "elapsed_ms": int((time.time() - started) * 1000),
        }
    return {"text": text}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 3900)))
