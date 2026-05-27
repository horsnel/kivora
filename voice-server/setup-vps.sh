#!/bin/bash
# =============================================================================
# Kivora Voice Server — One-Command VPS Setup
#
# Usage (on your VPS):
#   curl -fsSL https://raw.githubusercontent.com/horsnel/kivora/main/voice-server/setup-vps.sh | bash
#
# Or after cloning:
#   cd kivora/voice-server && bash setup-vps.sh
#
# What it does:
#   1. Installs system dependencies (Python, ffmpeg, etc.)
#   2. Creates virtual environment
#   3. Installs ALL 9 Python packages
#   4. Downloads Argos Translate language packs
#   5. Creates systemd service (auto-starts on boot)
#   6. Starts the voice server
#   7. Prints connection info
# =============================================================================

set -e

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Config ──
VOICE_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$VOICE_DIR/.venv"
DATA_DIR="$VOICE_DIR/data"
SERVICE_NAME="kivora-voice"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
HF_TOKEN="${HF_TOKEN:-}"

echo ""
echo -e "${PURPLE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║     🎙️  Kivora Voice Server — VPS Auto-Setup       ║${NC}"
echo -e "${PURPLE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: System Dependencies ──
echo -e "${CYAN}[1/7] Installing system dependencies...${NC}"
if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq python3 python3-pip python3-venv ffmpeg git curl > /dev/null 2>&1
elif command -v yum &>/dev/null; then
    sudo yum install -y python3 python3-pip ffmpeg git curl > /dev/null 2>&1
elif command -v dnf &>/dev/null; then
    sudo dnf install -y python3 python3-pip ffmpeg git curl > /dev/null 2>&1
fi
echo -e "  ${GREEN}✓${NC} System dependencies installed"

# ── Step 2: Virtual Environment ──
echo -e "${CYAN}[2/7] Setting up Python virtual environment...${NC}"
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"
pip install --upgrade pip setuptools wheel > /dev/null 2>&1
echo -e "  ${GREEN}✓${NC} Virtual environment ready"

# ── Step 3: Install Python Packages ──
echo -e "${CYAN}[3/7] Installing Python packages (this takes a few minutes)...${NC}"

# Detect GPU
HAS_GPU=false
if command -v nvidia-smi &>/dev/null; then
    HAS_GPU=true
    echo -e "  ${YELLOW}⚡ GPU detected — installing CUDA PyTorch${NC}"
fi

# Core packages (always needed)
CORE_PKGS="fastapi uvicorn python-multipart python-dotenv httpx"

# Voice AI packages
VOICE_PKGS="faster-whisper edge-tts argostranslate"

# Heavy packages (optional but installed)
HEAVY_PKGS="audioseal demucs pyannote.audio coqui-tts"

# Install core first
echo -e "  ${YELLOW}→${NC} Installing core packages..."
pip install $CORE_PKGS > /dev/null 2>&1

# Install PyTorch (CPU or GPU)
if [ "$HAS_GPU" = true ]; then
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121 > /dev/null 2>&1
else
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu > /dev/null 2>&1
fi
echo -e "  ${GREEN}✓${NC} Core packages installed"

# Install voice packages
echo -e "  ${YELLOW}→${NC} Installing voice packages (Whisper, Edge TTS, Argos Translate)..."
pip install $VOICE_PKGS > /dev/null 2>&1
echo -e "  ${GREEN}✓${NC} Voice packages installed"

# Install heavy packages one by one (better error reporting)
echo -e "  ${YELLOW}→${NC} Installing heavy packages (AudioSeal, Demucs, Pyannote, Coqui TTS)..."
for pkg in $HEAVY_PKGS; do
    echo -n "  Installing $pkg... "
    if pip install "$pkg" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}✗ (skipped — will work without it)${NC}"
    fi
done

# Fix transformers compatibility for Coqui TTS
pip install "transformers<5" > /dev/null 2>&1 || true

echo -e "  ${GREEN}✓${NC} All Python packages installed"

# ── Step 4: Configure Environment ──
echo -e "${CYAN}[4/7] Configuring environment...${NC}"
mkdir -p "$DATA_DIR" "$VOICE_DIR/logs"

if [ ! -f "$VOICE_DIR/.env" ]; then
    cat > "$VOICE_DIR/.env" << EOF
# Kivora Voice Server Configuration
HF_TOKEN=${HF_TOKEN}
OMNIVOICE_DATA_DIR=${DATA_DIR}
OMNIVOICE_WHISPER_DEVICE=$([ "$HAS_GPU" = true ] && echo "cuda" || echo "cpu")
OMNIVOICE_WHISPER_MODEL=base
OMNIVOICE_TTS_LANGUAGE=en
OMNIVOICE_PORT=3900
OMNIVOICE_AUTH_ENABLED=false
OMNIVOICE_CORS_ORIGINS=http://localhost:3000,https://kivora.app
EOF
fi
echo -e "  ${GREEN}✓${NC} Environment configured"

# ── Step 5: Download Argos Language Packs ──
echo -e "${CYAN}[5/7] Downloading translation language packs...${NC}"
python3 << 'PYEOF' 2>/dev/null || true
import argostranslate.package
import argostranslate.translate

argostranslate.package.update_package_index()
available = argostranslate.package.get_available_packages()

# Key language pairs (bidirectional)
pairs = [
    ('en', 'es'), ('es', 'en'),
    ('en', 'fr'), ('fr', 'en'),
    ('en', 'de'), ('de', 'en'),
    ('en', 'pt'), ('pt', 'en'),
    ('en', 'zh'), ('zh', 'en'),
    ('en', 'ja'), ('ja', 'en'),
]

installed = argostranslate.translate.get_installed_languages()
installed_codes = set()
for lang in installed:
    for trans in lang.translations_from:
        installed_codes.add((lang.code, trans.to_lang.code))

count = 0
for from_code, to_code in pairs:
    if (from_code, to_code) in installed_codes:
        count += 1
        continue
    pkg = next((p for p in available if p.from_code == from_code and p.to_code == to_code), None)
    if pkg:
        try:
            argostranslate.package.install_from_path(pkg.download())
            count += 1
        except:
            pass

print(f"  {count} language packs ready")
PYEOF
echo -e "  ${GREEN}✓${NC} Translation packs installed"

# ── Step 6: Create Systemd Service ──
echo -e "${CYAN}[6/7] Creating systemd service (auto-start on boot)...${NC}"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Kivora Voice Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${VOICE_DIR}
Environment=PATH=${VENV_DIR}/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=${VENV_DIR}/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 3900 --log-level info
Restart=always
RestartSec=5
StandardOutput=append:${VOICE_DIR}/logs/server.log
StandardError=append:${VOICE_DIR}/logs/server.log

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME" > /dev/null 2>&1
echo -e "  ${GREEN}✓${NC} Systemd service created and enabled"

# ── Step 7: Start the Server ──
echo -e "${CYAN}[7/7] Starting the voice server...${NC}"
sudo systemctl start "$SERVICE_NAME" 2>/dev/null || {
    # Fallback: start manually if no sudo
    cd "$VOICE_DIR"
    nohup "$VENV_DIR/bin/python" -m uvicorn backend.main:app \
        --host 0.0.0.0 --port 3900 --log-level info \
        > logs/server.log 2>&1 &
    echo $! > logs/server.pid
}

# Wait for server to be ready
echo -n "  Waiting for server"
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:3900/health > /dev/null 2>&1; then
        echo ""
        break
    fi
    echo -n "."
    sleep 1
done

# ── Show Results ──
if curl -sf http://127.0.0.1:3900/health > /dev/null 2>&1; then
    echo ""
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║        🎉  Kivora Voice Server is LIVE!              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Get server IP
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_VPS_IP")
    GPU_STATUS=$([ "$HAS_GPU" = true ] && echo "🟢 GPU" || echo "🟡 CPU-only")

    echo -e "  ${CYAN}Server:${NC}    http://${SERVER_IP}:3900"
    echo -e "  ${CYAN}Health:${NC}    http://${SERVER_IP}:3900/health"
    echo -e "  ${CYAN}API Docs:${NC}  http://${SERVER_IP}:3900/docs"
    echo -e "  ${CYAN}Mode:${NC}      ${GPU_STATUS}"
    echo ""

    # Show active services
    HEALTH=$(curl -sf http://127.0.0.1:3900/health)
    echo -e "  ${PURPLE}Active Services:${NC}"
    echo "$HEALTH" | python3 -c "
import json, sys
d = json.load(sys.stdin)
icons = {'coqui_tts': '🗣️  Coqui TTS', 'whisperx': '👂 WhisperX STT',
         'edge_tts': '🔊 Edge TTS', 'argos_translate': '🌍 Argos Translate',
         'voice_cloning': '🧬 Voice Cloning', 'audioseal': '🔒 AudioSeal',
         'demucs': '🎵 Demucs', 'pyannote': '👥 Pyannote'}
for k, v in d.get('services', {}).items():
    name = icons.get(k, k)
    status = '✅' if v else '⬜'
    print(f'    {status} {name}')
" 2>/dev/null

    echo ""
    echo -e "  ${YELLOW}Endpoints:${NC}"
    echo "    POST /v1/audio/speech          — Text-to-Speech"
    echo "    POST /v1/audio/transcriptions   — Speech-to-Text"
    echo "    POST /dub/translate             — Translation"
    echo "    POST /profiles                  — Voice Cloning"
    echo "    POST /watermark/detect          — AI Watermark Detection"
    echo "    POST /tools/isolate-vocals      — Vocal Isolation"
    echo "    POST /tools/diarize             — Speaker Diarization"
    echo ""
    echo -e "  ${YELLOW}Management:${NC}"
    echo "    sudo systemctl restart kivora-voice   — Restart"
    echo "    sudo systemctl stop kivora-voice      — Stop"
    echo "    sudo systemctl status kivora-voice    — Status"
    echo "    tail -f ${VOICE_DIR}/logs/server.log  — View logs"
    echo ""

    # Remind about HF token if not set
    if [ -z "$HF_TOKEN" ]; then
        echo -e "  ${RED}⚠️  Set HF_TOKEN in .env for Pyannote diarization${NC}"
        echo -e "     echo 'HF_TOKEN=hf_YOUR_TOKEN' >> ${VOICE_DIR}/.env"
        echo -e "     sudo systemctl restart kivora-voice"
        echo ""
    fi

else
    echo ""
    echo -e "${RED}Server failed to start. Check logs:${NC}"
    echo "  tail -f ${VOICE_DIR}/logs/server.log"
    exit 1
fi
