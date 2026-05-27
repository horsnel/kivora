# =============================================================================
# Kivora Voice Server - Custom Dockerfile
# Lightweight API-only build (no frontend) of OmniVoice Studio
# Multi-stage build for minimal image size
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Builder - Install dependencies
# ---------------------------------------------------------------------------
FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime AS builder

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast Python package management
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /build

# Copy dependency specification first for better layer caching
COPY pyproject.toml ./

# Create virtual environment and install dependencies
RUN uv venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# Install Python dependencies via uv (faster than pip)
RUN uv pip install --no-cache -r pyproject.toml || \
    uv pip install --no-cache .

# Copy only backend and omnivoice source directories
COPY backend/ ./backend/
COPY omnivoice/ ./omnivoice/

# If there's a setup.py or the project is installable, install it
RUN if [ -f setup.py ]; then uv pip install --no-cache .; fi

# ---------------------------------------------------------------------------
# Stage 2: Runtime - Minimal image with only what's needed
# ---------------------------------------------------------------------------
FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime AS runtime

# Metadata
LABEL maintainer="Kivora Team <dev@kivora.app>"
LABEL description="Kivora Voice Server - OmniVoice Studio API Backend"
LABEL org.opencontainers.image.source="https://github.com/kivora/voice-server"
LABEL org.opencontainers.image.title="kivora-voice-server"

# Prevent interactive prompts and optimize Python runtime
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    OMNIVOICE_BIND_HOST=0.0.0.0 \
    OMNIVOICE_PORT=3900

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

# Copy application source from builder
COPY --from=builder /build/backend /app/backend
COPY --from=builder /build/omnivoice /app/omnivoice

WORKDIR /app

# Create non-root user for security
RUN groupadd -r voiceuser && useradd -r -g voiceuser -d /app -s /sbin/nologin voiceuser \
    && mkdir -p /data && chown -R voiceuser:voiceuser /app /data

# Copy API key authentication middleware
COPY --chmod=755 <<'MIDDLEWARE' /app/middleware.py
"""
API Key Authentication Middleware for Kivora Voice Server
Validates X-API-Key header against OMNIVOICE_API_KEY env variable.
"""
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class APIKeyMiddleware(BaseHTTPMiddleware):
    """Authenticate requests via X-API-Key header."""

    EXEMPT_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next):
        # Skip auth for health checks and documentation
        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        # If no API key is configured, allow all requests
        expected_key = os.environ.get("OMNIVOICE_API_KEY", "")
        if not expected_key:
            return await call_next(request)

        # Validate the API key from header
        provided_key = request.headers.get("X-API-Key", "")
        if provided_key != expected_key:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key. Provide X-API-Key header."}
            )

        return await call_next(request)
MIDDLEWARE

# Copy entrypoint script
COPY --chmod=755 <<'ENTRYPOINT' /app/entrypoint.sh
#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "  Kivora Voice Server - Starting Up"
echo "=========================================="
echo "  Host: ${OMNIVOICE_BIND_HOST:-0.0.0.0}"
echo "  Port: ${OMNIVOICE_PORT:-3900}"
echo "  Data: ${OMNIVOICE_DATA_DIR:-/data}"
echo "  API Key: $([ -n "${OMNIVOICE_API_KEY:-}" ] && echo 'configured' || echo 'not set (open access)')"
echo "  TTS Backend: ${OMNIVOICE_TTS_BACKEND:-coqui}"
echo "  ASR Backend: ${OMNIVOICE_ASR_BACKEND:-whisper}"
echo "=========================================="

# Download models on first run if data dir is empty
if [ ! -f "${OMNIVOICE_DATA_DIR:-/data}/.models_initialized" ]; then
    echo "First run detected - models will be downloaded on first request..."
fi

exec uvicorn backend.main:app \
    --host "${OMNIVOICE_BIND_HOST:-0.0.0.0}" \
    --port "${OMNIVOICE_PORT:-3900}" \
    --workers ${OMNIVOICE_WORKERS:-1} \
    --loop uvloop \
    --http httptools \
    --log-level ${OMNIVOICE_LOG_LEVEL:-info} \
    --access-log
ENTRYPOINT

# Create data directory
VOLUME ["/data"]

# Expose the API port
EXPOSE 3900

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=120s \
    CMD curl -f http://localhost:3900/health || exit 1

# Run as non-root user
USER voiceuser

ENTRYPOINT ["/app/entrypoint.sh"]
