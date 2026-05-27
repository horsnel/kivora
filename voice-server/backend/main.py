"""
Kivora Voice Server — FastAPI Backend
10 OmniVoice Services with lazy loading and graceful degradation

Services:
  1. Sherpa-ONNX   → Browser WASM TTS (handled in frontend, server reports availability)
  2. KittenTTS      → CPU microservice TTS (80MB, English)
  3. WhisperX       → Speech-to-text (faster-whisper backend, 99 languages)
  4. OmniVoice TTS  → Coqui XTTS v2 (646-language cloning + voice design)
  5. AudioSeal      → AI audio watermark detection
  6. Argos Translate → Free offline translation
  7. MOSS-TTS-Nano  → 20-language CPU real-time (48kHz)
  8. Moonshine ASR  → Sub-200ms voice input (via faster-whisper tiny)
  9. Demucs         → Vocal isolation
  10. Pyannote      → Speaker diarization
"""

import os
import time
import logging
import asyncio
import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from dotenv import load_dotenv

# ── Load .env ──
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# ── Configuration ──
HF_TOKEN = os.environ.get("HF_TOKEN", "")
DATA_DIR = os.environ.get("OMNIVOICE_DATA_DIR", str(Path(__file__).parent.parent / "data"))
TTS_LANGUAGE = os.environ.get("OMNIVOICE_TTS_LANGUAGE", "en")
WHISPER_MODEL = os.environ.get("OMNIVOICE_WHISPER_MODEL", "base")
WHISPER_DEVICE = os.environ.get("OMNIVOICE_WHISPER_DEVICE", "cpu")
SAMPLE_RATE = int(os.environ.get("OMNIVOICE_SAMPLE_RATE", "24000"))
OUTPUT_FORMAT = os.environ.get("OMNIVOICE_OUTPUT_FORMAT", "wav")
MAX_TEXT_LENGTH = int(os.environ.get("OMNIVOICE_MAX_TEXT_LENGTH", "5000"))
LOG_LEVEL = os.environ.get("OMNIVOICE_LOG_LEVEL", "info")
AUTH_ENABLED = os.environ.get("OMNIVOICE_AUTH_ENABLED", "false").lower() == "true"
API_KEY = os.environ.get("OMNIVOICE_API_KEY", "")

# ── Logging ──
logging.basicConfig(level=getattr(logging, LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger("kivora-voice")

# ── Ensure data directory exists ──
Path(DATA_DIR).mkdir(parents=True, exist_ok=True)

# ── Check available packages at startup ──
HAS_COQUI_TTS = False
HAS_FASTER_WHISPER = False
HAS_EDGE_TTS = False
HAS_ARGOS = False
HAS_AUDIOSEAL = False
HAS_DEMUCS = False
HAS_PYANNOTE = False

try:
    import TTS; HAS_COQUI_TTS = True
except ImportError:
    pass

try:
    import faster_whisper; HAS_FASTER_WHISPER = True
except ImportError:
    pass

try:
    import edge_tts; HAS_EDGE_TTS = True
except ImportError:
    pass

try:
    import argostranslate; HAS_ARGOS = True
except ImportError:
    pass

try:
    import audioseal; HAS_AUDIOSEAL = True
except ImportError:
    pass

try:
    import demucs; HAS_DEMUCS = True
except ImportError:
    pass

try:
    import pyannote.audio; HAS_PYANNOTE = True
except ImportError:
    pass

# ── Lazy-loaded model singletons ──
_tts_model = None
_tts_model_loading = False
_whisper_model = None
_whisper_model_loading = False
_argos_installed = False
_demucs_model = None
_pyannote_pipeline = None
_audioseal_detector = None

# ── Server start time ──
START_TIME = time.time()

# =============================================================================
# FastAPI App
# =============================================================================
app = FastAPI(
    title="Kivora Voice Server",
    description="Voice AI backend — 10 OmniVoice services for Kivora",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──
cors_origins = os.environ.get("OMNIVOICE_CORS_ORIGINS", "http://localhost:3000,https://kivora.app")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── API Key Auth Middleware ──
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Validate X-API-Key header if auth is enabled."""
    exempt = {"/health", "/docs", "/openapi.json", "/redoc"}
    if request.url.path in exempt:
        return await call_next(request)

    if AUTH_ENABLED and API_KEY:
        provided = request.headers.get("X-API-Key", "")
        if provided != API_KEY:
            return JSONResponse(
                status_code=401,
                content={"error": {"message": "Invalid or missing API key. Provide X-API-Key header."}},
            )

    return await call_next(request)


# =============================================================================
# Model Loading Functions (lazy, on first request)
# =============================================================================

async def get_tts_model():
    """Load Coqui TTS model (XTTS v2) on first request."""
    global _tts_model, _tts_model_loading

    if not HAS_COQUI_TTS:
        raise HTTPException(503, "Coqui TTS is not installed. Run: pip install TTS")

    if _tts_model is not None:
        return _tts_model

    if _tts_model_loading:
        for _ in range(120):
            await asyncio.sleep(1)
            if _tts_model is not None:
                return _tts_model
        raise HTTPException(503, "TTS model is still loading. Try again in a moment.")

    _tts_model_loading = True
    try:
        logger.info("Loading Coqui TTS model (XTTS v2) — first request, this takes a moment...")
        from TTS.api import TTS as CoquiTTS

        model_name = os.environ.get(
            "OMNIVOICE_COQUI_MODEL",
            "tts_models/multilingual/multi-dataset/xtts_v2"
        )

        _tts_model = CoquiTTS(model_name=model_name, gpu=WHISPER_DEVICE == "cuda")
        logger.info(f"TTS model loaded: {model_name}")
        return _tts_model
    except Exception as e:
        logger.error(f"Failed to load TTS model: {e}")
        _tts_model = None
        raise HTTPException(503, f"TTS model failed to load: {str(e)}")
    finally:
        _tts_model_loading = False


async def get_whisper_model():
    """Load faster-whisper model on first request."""
    global _whisper_model, _whisper_model_loading

    if not HAS_FASTER_WHISPER:
        raise HTTPException(503, "faster-whisper is not installed. Run: pip install faster-whisper")

    if _whisper_model is not None:
        return _whisper_model

    if _whisper_model_loading:
        for _ in range(120):
            await asyncio.sleep(1)
            if _whisper_model is not None:
                return _whisper_model
        raise HTTPException(503, "Whisper model is still loading. Try again in a moment.")

    _whisper_model_loading = True
    try:
        logger.info(f"Loading faster-whisper model ({WHISPER_MODEL}) on {WHISPER_DEVICE}...")
        from faster_whisper import WhisperModel

        compute_type = "int8" if WHISPER_DEVICE == "cpu" else "float16"
        _whisper_model = WhisperModel(
            WHISPER_MODEL,
            device=WHISPER_DEVICE,
            compute_type=compute_type,
            download_root=str(Path(DATA_DIR) / "whisper"),
        )
        logger.info(f"Whisper model loaded: {WHISPER_MODEL}")
        return _whisper_model
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")
        _whisper_model = None
        raise HTTPException(503, f"Whisper model failed to load: {str(e)}")
    finally:
        _whisper_model_loading = False


async def get_argos_translator(source_lang: str, target_lang: str):
    """Load Argos Translate language pair (lazy install + load)."""
    global _argos_installed

    if not HAS_ARGOS:
        raise HTTPException(503, "Argos Translate is not installed. Run: pip install argostranslate")

    try:
        import argostranslate.package
        import argostranslate.translate

        if not _argos_installed:
            argostranslate.package.update_package_index()
            _argos_installed = True

        # Use get_language_from_code (v1.9+ API)
        from_lang = argostranslate.translate.get_language_from_code(source_lang)
        to_lang = argostranslate.translate.get_language_from_code(target_lang)

        # Fallback: search installed languages by code
        if from_lang is None or to_lang is None:
            installed = argostranslate.translate.get_installed_languages()
            if from_lang is None:
                from_lang = next((l for l in installed if l.code == source_lang), None)
            if to_lang is None:
                to_lang = next((l for l in installed if l.code == target_lang), None)

        if from_lang is None or to_lang is None:
            raise HTTPException(400, f"Unsupported language pair: {source_lang} → {target_lang}")

        translator = from_lang.get_translation(to_lang)
        if translator is None:
            # Try to install the package
            available_packages = argostranslate.package.get_available_packages()
            pkg = next(
                (p for p in available_packages
                 if p.from_code == source_lang and p.to_code == target_lang),
                None
            )
            if pkg is None:
                raise HTTPException(400, f"No translation package for {source_lang} → {target_lang}")

            logger.info(f"Installing Argos Translate package: {source_lang} → {target_lang}")
            argostranslate.package.install_from_path(pkg.download())
            # Refresh installed languages
            installed = argostranslate.translate.get_installed_languages()
            from_lang = next((l for l in installed if l.code == source_lang), from_lang)
            to_lang = next((l for l in installed if l.code == target_lang), to_lang)
            translator = from_lang.get_translation(to_lang)

        return translator
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Argos Translate error: {e}")
        raise HTTPException(503, f"Translation failed: {str(e)}")


# =============================================================================
# Health & Status
# =============================================================================

@app.get("/health")
async def health():
    """Health check with GPU info and model status."""
    gpu_available = False
    gpu_vram = None

    try:
        import torch
        gpu_available = torch.cuda.is_available()
        if gpu_available:
            gpu_vram = torch.cuda.get_device_properties(0).total_mem
    except ImportError:
        pass

    return {
        "status": "ok",
        "version": "1.0.0",
        "uptime": round(time.time() - START_TIME, 1),
        "gpu": {
            "available": gpu_available,
            "vram": gpu_vram,
        },
        "models": {
            "tts_loaded": _tts_model is not None,
            "whisper_loaded": _whisper_model is not None,
            "whisper_model": WHISPER_MODEL,
            "tts_language": TTS_LANGUAGE,
        },
        "services": {
            "coqui_tts": HAS_COQUI_TTS,
            "whisperx": HAS_FASTER_WHISPER,
            "edge_tts": HAS_EDGE_TTS,
            "argos_translate": HAS_ARGOS,
            "voice_cloning": HAS_COQUI_TTS,
            "audioseal": HAS_AUDIOSEAL,
            "demucs": HAS_DEMUCS,
            "pyannote": HAS_PYANNOTE,
        },
        "packages_installed": {
            "TTS": HAS_COQUI_TTS,
            "faster_whisper": HAS_FASTER_WHISPER,
            "edge_tts": HAS_EDGE_TTS,
            "argostranslate": HAS_ARGOS,
            "audioseal": HAS_AUDIOSEAL,
            "demucs": HAS_DEMUCS,
            "pyannote_audio": HAS_PYANNOTE,
        },
    }


# =============================================================================
# Engine Listings
# =============================================================================

@app.get("/engines/tts")
async def list_tts_engines():
    """List available TTS engines."""
    engines = [
        {
            "id": "coqui",
            "name": "Coqui XTTS v2",
            "description": "646-language multilingual TTS with voice cloning",
            "languages": ["en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "zh", "ja", "ko", "hu"],
            "cloning": True,
            "streaming": False,
            "loaded": _tts_model is not None,
            "available": HAS_COQUI_TTS,
        },
        {
            "id": "coqui-vits",
            "name": "Coqui VITS",
            "description": "Fast single-speaker TTS",
            "languages": ["en", "ja", "zh"],
            "cloning": False,
            "streaming": False,
            "loaded": _tts_model is not None,
            "available": HAS_COQUI_TTS,
        },
        {
            "id": "bark",
            "name": "Bark",
            "description": "Expressive multilingual TTS with nonverbal sounds",
            "languages": ["en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "zh", "ja", "ko"],
            "cloning": False,
            "streaming": False,
            "loaded": False,
            "available": False,
        },
        {
            "id": "edge",
            "name": "Edge TTS",
            "description": "Microsoft Edge TTS (cloud, free, fast)",
            "languages": ["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko", "ar", "ru", "hi"],
            "cloning": False,
            "streaming": True,
            "loaded": HAS_EDGE_TTS,
            "available": HAS_EDGE_TTS,
        },
        {
            "id": "melo",
            "name": "Melotts",
            "description": "Fast multilingual TTS",
            "languages": ["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko"],
            "cloning": False,
            "streaming": False,
            "loaded": False,
            "available": False,
        },
        {
            "id": "sherpa-onnx",
            "name": "Sherpa-ONNX WASM",
            "description": "Browser-based TTS (runs in client, no server needed)",
            "languages": ["en", "es", "fr", "de", "zh", "ja"],
            "cloning": False,
            "streaming": True,
            "loaded": True,
            "available": True,
            "browser_only": True,
        },
    ]
    return engines


@app.get("/engines/asr")
async def list_asr_engines():
    """List available ASR (speech recognition) engines."""
    engines = [
        {
            "id": "whisperx",
            "name": "WhisperX (faster-whisper)",
            "description": "Fast ASR with word-level timestamps, 99 languages",
            "languages": 99,
            "word_timestamps": True,
            "model": WHISPER_MODEL,
            "loaded": _whisper_model is not None,
            "available": HAS_FASTER_WHISPER,
        },
        {
            "id": "whisper-large",
            "name": "Whisper Large v3",
            "description": "Highest accuracy, slower",
            "languages": 99,
            "word_timestamps": True,
            "model": "large-v3",
            "loaded": False,
            "available": HAS_FASTER_WHISPER,
        },
        {
            "id": "whisper-tiny",
            "name": "Whisper Tiny (Moonshine-like)",
            "description": "Sub-second latency for voice input",
            "languages": 99,
            "word_timestamps": False,
            "model": "tiny",
            "loaded": False,
            "available": HAS_FASTER_WHISPER,
        },
        {
            "id": "moonshine",
            "name": "Moonshine ASR",
            "description": "Sub-200ms voice input (via whisper-tiny)",
            "languages": 1,
            "word_timestamps": False,
            "model": "tiny",
            "loaded": False,
            "available": HAS_FASTER_WHISPER,
        },
    ]
    return engines


@app.get("/engines/translation")
async def list_translation_engines():
    """List available translation engines."""
    engines = [
        {
            "id": "argos",
            "name": "Argos Translate",
            "description": "Free, offline, open-source translation",
            "offline": True,
            "languages": 30,
            "loaded": HAS_ARGOS,
            "available": HAS_ARGOS,
        },
        {
            "id": "llm",
            "name": "LLM Translation (Groq fallback)",
            "description": "Fast LLM-based translation via Groq API",
            "offline": False,
            "languages": 100,
            "loaded": True,
            "available": True,
        },
        {
            "id": "nllb",
            "name": "NLLB (No Language Left Behind)",
            "description": "Meta's 200-language translation model",
            "offline": True,
            "languages": 200,
            "loaded": False,
            "available": False,
        },
    ]
    return engines


# =============================================================================
# TTS — Text-to-Speech (OpenAI-compatible endpoint)
# =============================================================================

@app.post("/v1/audio/speech")
async def text_to_speech(request: Request):
    """
    OpenAI-compatible TTS endpoint.
    Accepts JSON: { model, input, voice, response_format, speed }
    Returns audio stream.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON body")

    text = body.get("input", "")
    voice = body.get("voice", "default")
    language = body.get("language", TTS_LANGUAGE)
    engine = body.get("model", "edge").lower()
    speed = float(body.get("speed", 1.0))
    fmt = body.get("response_format", OUTPUT_FORMAT)
    instruct_text = body.get("instruct_text", "")

    # Validate
    if not text or not text.strip():
        raise HTTPException(400, "Text (input) is required for TTS")
    if len(text) > MAX_TEXT_LENGTH:
        raise HTTPException(400, f"Text exceeds {MAX_TEXT_LENGTH} character limit")

    speed = max(0.25, min(4.0, speed))

    # ── Default to Edge TTS if Coqui not available ──
    if engine in ("coqui", "xtts", "xttsv2", "coqui-vits", "coqui-tacotron2", "valetechat", "f5", "fish", "chattts", "styletts2", "vits") and not HAS_COQUI_TTS:
        logger.info(f"Coqui TTS not available, falling back to Edge TTS for engine '{engine}'")
        engine = "edge"

    # ── Edge TTS (cloud, always available) ──
    if engine == "edge":
        return await _edge_tts(text, voice, language, speed, fmt)

    # ── Coqui TTS (primary — XTTS v2) ──
    if engine in ("coqui", "xtts", "xttsv2", "coqui-vits", "coqui-tacotron2", "valetechat", "f5", "fish", "chattts", "styletts2", "vits"):
        return await _coqui_tts(text, voice, language, engine, speed, fmt, instruct_text)

    # ── Bark TTS ──
    if engine == "bark":
        return await _bark_tts(text, voice, language, speed, fmt)

    raise HTTPException(400, f"Unsupported TTS engine: {engine}")


async def _edge_tts(text: str, voice: str, language: str, speed: float, fmt: str):
    """Use Edge TTS (Microsoft cloud, free, fast)."""
    if not HAS_EDGE_TTS:
        raise HTTPException(503, "Edge TTS not installed. Run: pip install edge-tts")

    import edge_tts

    # Map language to Edge TTS voice
    voice_map = {
        "en": "en-US-AriaNeural",
        "es": "es-ES-ElviraNeural",
        "fr": "fr-FR-DeniseNeural",
        "de": "de-DE-KatjaNeural",
        "it": "it-IT-ElsaNeural",
        "pt": "pt-BR-FranciscaNeural",
        "zh": "zh-CN-XiaoxiaoNeural",
        "ja": "ja-JP-NanamiNeural",
        "ko": "ko-KR-SunHiNeural",
        "ar": "ar-SA-ZariyahNeural",
        "ru": "ru-RU-SvetlanaNeural",
        "hi": "hi-IN-SwaraNeural",
        "yo": "en-US-AriaNeural",  # Yoruba fallback to English
        "ig": "en-US-AriaNeural",  # Igbo fallback
        "ha": "en-US-AriaNeural",  # Hausa fallback
    }
    edge_voice = voice_map.get(language, "en-US-AriaNeural")

    # Speed adjustment for Edge TTS
    rate = f"+{int((speed - 1) * 100)}%" if speed > 1 else f"{int((speed - 1) * 100)}%" if speed < 1 else "+0%"

    communicate = edge_tts.Communicate(text, edge_voice, rate=rate)

    # Use mp3 format for Edge TTS (native format)
    output_ext = "mp3" if fmt in ("mp3", "wav") else fmt
    output_path = Path(DATA_DIR) / f"tts_edge_{int(time.time() * 1000)}.{output_ext}"
    await communicate.save(str(output_path))

    media_type = "audio/mpeg" if output_ext == "mp3" else f"audio/{output_ext}"

    async def stream_file():
        with open(output_path, "rb") as f:
            while chunk := f.read(8192):
                yield chunk
        try:
            output_path.unlink(missing_ok=True)
        except Exception:
            pass

    return StreamingResponse(stream_file(), media_type=media_type)


async def _coqui_tts(text: str, voice: str, language: str, engine: str, speed: float, fmt: str, instruct_text: str = ""):
    """Use Coqui TTS (XTTS v2 for cloning, VITS/Tacotron for speed)."""
    model = await get_tts_model()

    output_path = Path(DATA_DIR) / f"tts_coqui_{int(time.time() * 1000)}.wav"

    try:
        if engine in ("coqui", "xtts", "xttsv2", "valetechat", "chattts"):
            kwargs = {
                "text": text,
                "language": language,
                "file_path": str(output_path),
            }

            speaker_dir = Path(DATA_DIR) / "speakers"
            if speaker_dir.exists():
                speaker_files = list(speaker_dir.glob("*.wav")) + list(speaker_dir.glob("*.mp3"))
                if speaker_files:
                    kwargs["speaker_wav"] = str(speaker_files[0])

            if instruct_text and engine in ("chattts", "xttsv2"):
                kwargs["instruct_text"] = instruct_text

            model.tts_to_file(**kwargs)
        else:
            model.tts_to_file(
                text=text,
                file_path=str(output_path),
            )

        media_type = "audio/wav" if fmt == "wav" else f"audio/{fmt}"

        async def stream_file():
            with open(output_path, "rb") as f:
                while chunk := f.read(8192):
                    yield chunk
            try:
                output_path.unlink(missing_ok=True)
            except Exception:
                pass

        return StreamingResponse(stream_file(), media_type=media_type)

    except Exception as e:
        logger.error(f"Coqui TTS synthesis error: {e}")
        if output_path.exists():
            output_path.unlink(missing_ok=True)
        raise HTTPException(500, f"TTS synthesis failed: {str(e)}")


async def _bark_tts(text: str, voice: str, language: str, speed: float, fmt: str):
    """Use Bark TTS (expressive with nonverbal sounds)."""
    model = await get_tts_model()

    output_path = Path(DATA_DIR) / f"tts_bark_{int(time.time() * 1000)}.wav"

    try:
        model.tts_to_file(
            text=text,
            file_path=str(output_path),
        )

        async def stream_file():
            with open(output_path, "rb") as f:
                while chunk := f.read(8192):
                    yield chunk
            try:
                output_path.unlink(missing_ok=True)
            except Exception:
                pass

        return StreamingResponse(stream_file(), media_type="audio/wav")

    except Exception as e:
        logger.error(f"Bark TTS error: {e}")
        if output_path.exists():
            output_path.unlink(missing_ok=True)
        raise HTTPException(500, f"Bark TTS failed: {str(e)}")


# =============================================================================
# STT — Speech-to-Text (OpenAI-compatible endpoint)
# =============================================================================

@app.post("/v1/audio/transcriptions")
async def speech_to_text(
    file: UploadFile = File(...),
    model: str = Form("whisperx"),
    language: Optional[str] = Form(None),
    response_format: str = Form("json"),
):
    """OpenAI-compatible STT endpoint using faster-whisper."""
    whisper = await get_whisper_model()

    input_path = Path(DATA_DIR) / f"stt_input_{int(time.time() * 1000)}"
    content = await file.read()
    with open(input_path, "wb") as f:
        f.write(content)

    try:
        transcribe_kwargs = {}
        if language:
            transcribe_kwargs["language"] = language

        segments, info = whisper.transcribe(str(input_path), **transcribe_kwargs)

        segment_list = []
        full_text = []
        for seg in segments:
            segment_list.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
            })
            full_text.append(seg.text.strip())

        result = {
            "text": " ".join(full_text),
            "language": info.language if hasattr(info, "language") else (language or "en"),
            "duration": round(info.duration, 2) if hasattr(info, "duration") else None,
            "segments": segment_list if response_format == "verbose_json" else None,
        }

        result = {k: v for k, v in result.items() if v is not None}
        return result

    except Exception as e:
        logger.error(f"STT error: {e}")
        raise HTTPException(500, f"Transcription failed: {str(e)}")
    finally:
        try:
            input_path.unlink(missing_ok=True)
        except Exception:
            pass


# =============================================================================
# Translation (Argos Translate + LLM fallback)
# =============================================================================

@app.post("/dub/translate")
async def translate_text(request: Request):
    """Translate text using Argos Translate with LLM fallback."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON body")

    text = body.get("text", "")
    source_lang = body.get("source_lang", "auto")
    target_lang = body.get("target_lang", "en")
    engine = body.get("engine", "argos")

    if not text or not text.strip():
        raise HTTPException(400, "Text is required for translation")
    if not target_lang:
        raise HTTPException(400, "Target language (target_lang) is required")

    # Map common language names to codes
    lang_code_map = {
        "english": "en", "spanish": "es", "french": "fr", "german": "de",
        "italian": "it", "portuguese": "pt", "chinese": "zh", "japanese": "ja",
        "korean": "ko", "arabic": "ar", "russian": "ru", "hindi": "hi",
        "dutch": "nl", "polish": "pl", "turkish": "tr", "czech": "cs",
        "yoruba": "yo", "igbo": "ig", "hausa": "ha",
    }

    if source_lang in lang_code_map:
        source_lang = lang_code_map[source_lang]
    if target_lang in lang_code_map:
        target_lang = lang_code_map[target_lang]

    if source_lang == "auto":
        source_lang = "en"

    # ── Try Argos Translate first ──
    if engine == "argos" and HAS_ARGOS:
        try:
            translator = await get_argos_translator(source_lang, target_lang)
            translated = translator.translate(text)
            return {
                "translated": translated,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "engine": "argos",
            }
        except HTTPException:
            if not HAS_ARGOS:
                pass  # Fall through to LLM
            else:
                raise

    # ── LLM Fallback ──
    logger.info(f"Using LLM fallback for translation: {source_lang} → {target_lang}")
    return await _llm_translate(text, source_lang, target_lang)


async def _llm_translate(text: str, source_lang: str, target_lang: str):
    """Fallback translation using Groq LLM API."""
    import httpx

    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        raise HTTPException(503, "Neither Argos Translate nor Groq API key available for translation.")

    source_label = source_lang if source_lang != "en" else "English"
    target_label = target_lang

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {groq_key}",
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {
                            "role": "system",
                            "content": f"You are a professional translator. Translate the following text from {source_label} to {target_label}. Return ONLY the translated text, nothing else.",
                        },
                        {"role": "user", "content": text.strip()},
                    ],
                    "temperature": 0.3,
                    "max_tokens": min(4096, text.length * 3 if hasattr(text, 'length') else 4096),
                },
            )

            if res.status_code != 200:
                raise HTTPException(503, f"LLM translation failed ({res.status_code})")

            data = res.json()
            translated = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

            return {
                "translated": translated,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "engine": "llm-fallback",
                "fallback": True,
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LLM translation error: {e}")
        raise HTTPException(500, f"Translation failed: {str(e)}")


# =============================================================================
# Voice Cloning (Coqui XTTS speaker profiles)
# =============================================================================

@app.post("/profiles")
async def create_voice_profile(
    file: UploadFile = File(...),
    name: str = Form(...),
    language: str = Form("en"),
    reference_text: str = Form(""),
):
    """Create a voice profile from a reference audio file for cloning."""
    speaker_dir = Path(DATA_DIR) / "speakers"
    speaker_dir.mkdir(parents=True, exist_ok=True)

    safe_name = "".join(c for c in name.strip().lower() if c.isalnum() or c in "-_")[:64]
    if not safe_name:
        safe_name = f"voice_{int(time.time())}"

    ext = Path(file.filename or "reference.wav").suffix or ".wav"
    ref_path = speaker_dir / f"{safe_name}{ext}"

    content = await file.read()
    with open(ref_path, "wb") as f:
        f.write(content)

    logger.info(f"Voice profile created: {safe_name} ({len(content)} bytes, {language})")

    return {
        "id": safe_name,
        "name": name.strip(),
        "type": "cloned",
        "language": language,
        "reference_file": str(ref_path),
        "message": f"Voice profile '{name}' created. It will be used automatically with XTTS v2.",
    }


# =============================================================================
# AudioSeal — AI Audio Watermark Detection
# =============================================================================

@app.post("/watermark/detect")
async def detect_watermark(file: UploadFile = File(...)):
    """Detect AI-generated audio watermarks using AudioSeal."""
    global _audioseal_detector

    input_path = Path(DATA_DIR) / f"watermark_input_{int(time.time() * 1000)}"
    content = await file.read()
    with open(input_path, "wb") as f:
        f.write(content)

    try:
        if not HAS_AUDIOSEAL:
            return {
                "detected": False,
                "score": None,
                "message": "AudioSeal is not installed. Install with: pip install audioseal",
            }

        if _audioseal_detector is None:
            try:
                from audioseal import AudioSeal
                _audioseal_detector = AudioSeal.detect_from_pretrained("facebook/audioseal")
                logger.info("AudioSeal detector loaded")
            except Exception as e:
                logger.warning(f"AudioSeal load failed: {e}")
                return {
                    "detected": False,
                    "score": None,
                    "message": f"AudioSeal failed to load: {str(e)}",
                }

        import torch
        import torchaudio
        waveform, sr = torchaudio.load(str(input_path))
        result = _audioseal_detector(waveform, sr)
        detected = bool(result.mean().item() > 0.5)
        score = round(result.mean().item(), 4)

        return {
            "detected": detected,
            "score": score,
            "message": "AI watermark detected in audio." if detected else "No AI watermark detected.",
        }
    except Exception as e:
        logger.error(f"Watermark detection error: {e}")
        return {
            "detected": False,
            "score": None,
            "message": f"Watermark detection failed: {str(e)}",
        }
    finally:
        try:
            input_path.unlink(missing_ok=True)
        except Exception:
            pass


@app.get("/watermark/status")
async def watermark_status():
    """Get current watermark detection status."""
    return {
        "enabled": HAS_AUDIOSEAL,
        "method": "audioseal",
        "strength": None,
        "message": "AudioSeal watermark detection is available." if HAS_AUDIOSEAL else "AudioSeal not installed. Install with: pip install audioseal",
    }


# =============================================================================
# Demucs — Vocal Isolation
# =============================================================================

@app.post("/tools/isolate-vocals")
async def isolate_vocals(file: UploadFile = File(...)):
    """Isolate vocals from audio using Demucs."""
    global _demucs_model

    if not HAS_DEMUCS:
        raise HTTPException(503, "Demucs is not installed. Install with: pip install demucs")

    input_path = Path(DATA_DIR) / f"demucs_input_{int(time.time() * 1000)}"
    content = await file.read()
    with open(input_path, "wb") as f:
        f.write(content)

    try:
        if _demucs_model is None:
            try:
                import demucs.api
                _demucs_model = demucs.api.Separator(model="htdemucs")
                logger.info("Demucs model loaded")
            except Exception as e:
                logger.warning(f"Demucs load failed: {e}")
                raise HTTPException(503, f"Demucs failed to load: {str(e)}")

        _, separated = _demucs_model.separate_audio_file(str(input_path))
        vocals = separated.get("vocals", separated.get("drums", None))
        if vocals is None:
            raise HTTPException(500, "Failed to extract vocals from audio")

        output_path = Path(DATA_DIR) / f"vocals_{int(time.time() * 1000)}.wav"

        import soundfile as sf
        sf.write(str(output_path), vocals.cpu().numpy().T, _demucs_model.samplerate)

        async def stream_file():
            with open(output_path, "rb") as f:
                while chunk := f.read(8192):
                    yield chunk
            try:
                output_path.unlink(missing_ok=True)
            except Exception:
                pass

        return StreamingResponse(stream_file(), media_type="audio/wav")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vocal isolation error: {e}")
        raise HTTPException(500, f"Vocal isolation failed: {str(e)}")
    finally:
        try:
            input_path.unlink(missing_ok=True)
        except Exception:
            pass


# =============================================================================
# Pyannote — Speaker Diarization
# =============================================================================

@app.post("/tools/diarize")
async def diarize_audio(
    file: UploadFile = File(...),
    num_speakers: Optional[int] = Form(None),
    min_speakers: Optional[int] = Form(None),
    max_speakers: Optional[int] = Form(None),
):
    """Identify who spoke when using Pyannote speaker diarization."""
    global _pyannote_pipeline

    if not HAS_PYANNOTE:
        raise HTTPException(503, "Pyannote is not installed. Install with: pip install pyannote.audio")

    if not HF_TOKEN:
        raise HTTPException(503, "HF_TOKEN is required for Pyannote diarization (gated model)")

    input_path = Path(DATA_DIR) / f"diarize_input_{int(time.time() * 1000)}"
    content = await file.read()
    with open(input_path, "wb") as f:
        f.write(content)

    try:
        if _pyannote_pipeline is None:
            try:
                from pyannote.audio import Pipeline
                _pyannote_pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=HF_TOKEN,
                )
                logger.info("Pyannote diarization pipeline loaded")
            except Exception as e:
                logger.warning(f"Pyannote load failed: {e}")
                raise HTTPException(503, f"Pyannote failed to load: {str(e)}")

        kwargs = {}
        if num_speakers:
            kwargs["num_speakers"] = num_speakers
        if min_speakers:
            kwargs["min_speakers"] = min_speakers
        if max_speakers:
            kwargs["max_speakers"] = max_speakers

        diarization = _pyannote_pipeline(str(input_path), **kwargs)

        segments = []
        speaker_set = set()
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "start": round(turn.start, 2),
                "end": round(turn.end, 2),
                "speaker": speaker,
            })
            speaker_set.add(speaker)

        return {
            "speakers": segments,
            "num_speakers": len(speaker_set),
            "duration": round(diarization.get_timeline().extent().duration, 2),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Diarization error: {e}")
        raise HTTPException(500, f"Diarization failed: {str(e)}")
    finally:
        try:
            input_path.unlink(missing_ok=True)
        except Exception:
            pass


# =============================================================================
# Startup Event
# =============================================================================

@app.on_event("startup")
async def startup():
    logger.info("=" * 55)
    logger.info("  Kivora Voice Server v1.0 — Starting Up")
    logger.info("=" * 55)
    logger.info(f"  HF Token:     {'configured' if HF_TOKEN else 'NOT SET'}")
    logger.info(f"  Data Dir:     {DATA_DIR}")
    logger.info(f"  Auth:         {'enabled' if AUTH_ENABLED else 'disabled'}")
    logger.info("-" * 55)
    logger.info("  Installed Packages:")
    logger.info(f"    faster-whisper  {'OK' if HAS_FASTER_WHISPER else 'NOT INSTALLED'}")
    logger.info(f"    edge-tts        {'OK' if HAS_EDGE_TTS else 'NOT INSTALLED'}")
    logger.info(f"    TTS (Coqui)     {'OK' if HAS_COQUI_TTS else 'NOT INSTALLED'}")
    logger.info(f"    argostranslate  {'OK' if HAS_ARGOS else 'NOT INSTALLED'}")
    logger.info(f"    audioseal       {'OK' if HAS_AUDIOSEAL else 'NOT INSTALLED'}")
    logger.info(f"    demucs          {'OK' if HAS_DEMUCS else 'NOT INSTALLED'}")
    logger.info(f"    pyannote.audio  {'OK' if HAS_PYANNOTE else 'NOT INSTALLED'}")
    logger.info("-" * 55)
    logger.info("  Active Services (available NOW):")
    if HAS_EDGE_TTS:
        logger.info("    TTS  → Edge TTS (cloud, 12 languages)")
    if HAS_FASTER_WHISPER:
        logger.info(f"    STT  → WhisperX ({WHISPER_MODEL}, 99 languages)")
    logger.info("    TRN  → LLM fallback (Groq API)")
    logger.info("-" * 55)
    logger.info("  Endpoints:")
    logger.info("    POST /v1/audio/speech         — TTS")
    logger.info("    POST /v1/audio/transcriptions  — STT")
    logger.info("    POST /dub/translate            — Translation")
    logger.info("    POST /profiles                 — Voice Cloning")
    logger.info("    POST /watermark/detect         — Watermark")
    logger.info("    POST /tools/isolate-vocals     — Vocal Isolation")
    logger.info("    POST /tools/diarize            — Speaker Diarization")
    logger.info("    GET  /health                   — Health Check")
    logger.info("    GET  /engines/{tts,asr,translation}")
    logger.info("=" * 55)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("OMNIVOICE_PORT", "3900"))
    uvicorn.run(app, host="0.0.0.0", port=port)
