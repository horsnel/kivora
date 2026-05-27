# =============================================================================
# Kivora Voice Server - Dockerfile
# One-command cloud deployment: docker build -t kivora-voice . && docker run -p 3900:3900 kivora-voice
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Builder - Install all Python dependencies
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy requirements first for better Docker layer caching
COPY requirements.txt ./

# Create virtual environment and install ALL dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# Install core packages first (lighter, always needed)
RUN pip install --no-cache-dir \
    fastapi>=0.115.0 \
    uvicorn[standard]>=0.32.0 \
    python-multipart>=0.0.12 \
    python-dotenv>=1.0.1 \
    httpx>=0.27.0 \
    soundfile>=0.12.1 \
    numpy>=1.26.0 \
    scipy>=1.14.0 \
    pydub>=0.25.1 \
    edge-tts>=6.1.0 \
    faster-whisper>=1.1.0 \
    argostranslate>=1.9.0

# Install heavy ML packages (these take time but make all 10 services work)
RUN pip install --no-cache-dir \
    torch>=2.1.0 \
    torchaudio>=2.1.0 \
    --index-url https://download.pytorch.org/whl/cpu

# Install AI voice packages
RUN pip install --no-cache-dir \
    TTS>=0.22.0 || echo "Coqui TTS install skipped (may need GPU)" ; \
    pip install --no-cache-dir \
    audioseal || echo "AudioSeal install skipped" ; \
    pip install --no-cache-dir \
    demucs || echo "Demucs install skipped" ; \
    pip install --no-cache-dir \
    pyannote.audio || echo "Pyannote install skipped"

# Copy application source
COPY backend/ ./backend/

# ---------------------------------------------------------------------------
# Stage 2: Runtime - Minimal image with only what's needed
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS runtime

LABEL maintainer="Kivora Team <dev@kivora.app>"
LABEL description="Kivora Voice Server - 10 OmniVoice Voice AI Services"
LABEL org.opencontainers.image.source="https://github.com/horsnel/kivora"
LABEL org.opencontainers.image.title="kivora-voice-server"

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    OMNIVOICE_BIND_HOST=0.0.0.0 \
    PORT=3900

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# Copy application source
COPY --from=builder /build/backend /app/backend

WORKDIR /app

# Create non-root user for security
RUN groupadd -r voiceuser && useradd -r -g voiceuser -d /app -s /sbin/nologin voiceuser \
    && mkdir -p /data && chown -R voiceuser:voiceuser /app /data

# Install Argos Translate language packs at build time (7 languages)
RUN python -c " \
    import argostranslate.package; \
    argostranslate.package.update_package_index(); \
    available = argostranslate.package.get_available_packages(); \
    langs = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja']; \
    installed = []; \
    for p in available: \
        if p.from_code in langs and p.to_code in langs and p.from_code != p.to_code: \
            try: \
                argostranslate.package.install_from_path(p.download()); \
                installed.append(f'{p.from_code}->{p.to_code}'); \
            except: pass; \
    print(f'Installed Argos packs: {len(installed)}'); \
" || echo "Argos language packs install skipped"

# Copy entrypoint script
COPY --chmod=755 <<'ENTRYPOINT' /app/entrypoint.sh
#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3900}"

echo "=========================================="
echo "  Kivora Voice Server - Starting Up"
echo "=========================================="
echo "  Host: 0.0.0.0"
echo "  Port: ${PORT}"
echo "  Data: ${OMNIVOICE_DATA_DIR:-/data}"
echo "  API Key: $([ -n "${OMNIVOICE_API_KEY:-}" ] && echo 'configured' || echo 'not set (open access)')"
echo "  HF Token: $([ -n "${HF_TOKEN:-}" ] && echo 'configured' || echo 'not set')"
echo "=========================================="

exec uvicorn backend.main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --workers ${OMNIVOICE_WORKERS:-1} \
    --log-level ${OMNIVOICE_LOG_LEVEL:-info}
ENTRYPOINT

# Create data directory
VOLUME ["/data"]

# Expose the API port (PORT env var overrides default 3900)
EXPOSE 3900

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=120s \
    CMD curl -f http://localhost:${PORT:-3900}/health || exit 1

# Run as non-root user
USER voiceuser

ENTRYPOINT ["/app/entrypoint.sh"]
