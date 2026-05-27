#!/usr/bin/env bash
# =============================================================================
# Kivora Voice Server - Deployment Script
# =============================================================================
# Manages the OmniVoice Studio Docker deployment for Kivora
#
# Usage:
#   ./deploy.sh [cpu|gpu] [start|stop|restart|status|logs|update]
#
# Examples:
#   ./deploy.sh cpu start        # Start voice server in CPU mode
#   ./deploy.sh gpu start        # Start voice server with GPU acceleration
#   ./deploy.sh gpu status       # Check GPU server status
#   ./deploy.sh cpu logs         # View CPU server logs
#   ./deploy.sh gpu update       # Pull latest image and restart GPU server
#   ./deploy.sh gpu stop         # Stop GPU server
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
CONTAINER_NAME_CPU="kivora-voice-server"
CONTAINER_NAME_GPU="kivora-voice-server-gpu"
HEALTH_TIMEOUT=300  # seconds to wait for health check
HEALTH_INTERVAL=5   # seconds between health check attempts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║          Kivora Voice Server - Deployment Tool          ║"
    echo "║          OmniVoice Studio FastAPI Backend               ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} ${BOLD}$1${NC}"
}

check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        log_error "  See: https://docs.docker.com/get-docker/"
        exit 1
    fi
    log_info "Docker found: $(docker --version)"

    # Check Docker Compose
    if docker compose version &> /dev/null; then
        log_info "Docker Compose (V2): $(docker compose version --short)"
    elif command -v docker-compose &> /dev/null; then
        log_info "Docker Compose (V1): $(docker-compose --version)"
    else
        log_error "Docker Compose is not installed."
        log_error "  See: https://docs.docker.com/compose/install/"
        exit 1
    fi

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Start it with: sudo systemctl start docker"
        exit 1
    fi
    log_info "Docker daemon is running"
}

check_gpu_prerequisites() {
    log_step "Checking GPU prerequisites..."

    # Check NVIDIA driver
    if ! command -v nvidia-smi &> /dev/null; then
        log_error "NVIDIA driver not found. GPU mode requires an NVIDIA GPU with drivers installed."
        log_error "  See: https://www.nvidia.com/Download/index.aspx"
        exit 1
    fi
    log_info "NVIDIA driver found: $(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1)"

    # Check NVIDIA Container Toolkit
    if ! command -v nvidia-container-toolkit &> /dev/null && \
       ! dpkg -l nvidia-container-toolkit &> /dev/null 2>&1; then
        log_error "NVIDIA Container Toolkit is not installed."
        log_error "  Install it: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
        log_error "  Ubuntu/Debian: sudo apt-get install -y nvidia-container-toolkit"
        exit 1
    fi
    log_info "NVIDIA Container Toolkit is installed"

    # Show GPU info
    local gpu_count
    gpu_count=$(nvidia-smi --query-gpu=name --format=csv,noheader | wc -l)
    local gpu_name
    gpu_name=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
    local gpu_mem
    gpu_mem=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader | head -1)
    log_info "GPU detected: ${gpu_name} (${gpu_mem})"
    if [ "$gpu_count" -gt 1 ]; then
        log_info "Total GPUs available: ${gpu_count}"
    fi
}

validate_env() {
    log_step "Validating environment configuration..."

    if [ ! -f "${ENV_FILE}" ]; then
        log_warn "No .env file found. Creating from .env.example..."
        if [ -f "${SCRIPT_DIR}/.env.example" ]; then
            cp "${SCRIPT_DIR}/.env.example" "${ENV_FILE}"
            log_warn "Created .env from template. Please edit it with your configuration:"
            log_warn "  nano ${ENV_FILE}"
            log_warn ""
            log_warn "Required variables to set:"
            log_warn "  - OMNIVOICE_API_KEY  (generate: openssl rand -hex 32)"
            log_warn "  - HF_TOKEN           (from https://huggingface.co/settings/tokens)"
        else
            log_error "No .env.example found. Cannot create .env file."
            exit 1
        fi
    fi

    # Source the env file for validation
    set -a
    source "${ENV_FILE}"
    set +a

    # Check critical variables
    local missing=()

    if [ -z "${HF_TOKEN:-}" ]; then
        missing+=("HF_TOKEN")
    fi

    if [ -z "${OMNIVOICE_API_KEY:-}" ]; then
        log_warn "OMNIVOICE_API_KEY is not set - API will be open (no authentication)"
        log_warn "  Generate one: openssl rand -hex 32"
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${missing[@]}"; do
            log_error "  - ${var}"
        done
        log_error "Please edit ${ENV_FILE} and set the required values."
        exit 1
    fi

    log_info "Environment configuration validated"
}

pull_image() {
    log_step "Pulling the latest OmniVoice Studio image..."
    docker compose --profile "${PROFILE}" pull 2>&1 | tail -5
    log_info "Image pull complete"
}

wait_for_health() {
    local container_name="$1"
    local elapsed=0

    log_step "Waiting for voice server to become healthy (timeout: ${HEALTH_TIMEOUT}s)..."

    while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "not_found")

        case "$status" in
            healthy)
                log_info "Voice server is ${GREEN}HEALTHY${NC}!"
                return 0
                ;;
            unhealthy)
                log_error "Voice server is UNHEALTHY. Check logs with: ./deploy.sh ${PROFILE} logs"
                return 1
                ;;
            starting|not_found)
                printf "\r${CYAN}[WAITING]${NC} %ds elapsed..." "$elapsed"
                sleep $HEALTH_INTERVAL
                elapsed=$((elapsed + HEALTH_INTERVAL))
                ;;
        esac
    done

    echo ""
    log_error "Health check timed out after ${HEALTH_TIMEOUT}s"
    log_error "Check the logs: ./deploy.sh ${PROFILE} logs"
    return 1
}

do_start() {
    print_banner
    check_prerequisites

    if [ "${PROFILE}" = "gpu" ]; then
        check_gpu_prerequisites
    fi

    validate_env
    pull_image

    log_step "Starting voice server (${PROFILE} mode)..."
    docker compose --profile "${PROFILE}" --env-file "${ENV_FILE}" up -d

    local container_name
    if [ "${PROFILE}" = "gpu" ]; then
        container_name="${CONTAINER_NAME_GPU}"
    else
        container_name="${CONTAINER_NAME_CPU}"
    fi

    if wait_for_health "${container_name}"; then
        show_status
    fi
}

do_stop() {
    log_step "Stopping voice server (${PROFILE} mode)..."
    docker compose --profile "${PROFILE}" down
    log_info "Voice server stopped"
}

do_restart() {
    log_step "Restarting voice server (${PROFILE} mode)..."
    docker compose --profile "${PROFILE}" --env-file "${ENV_FILE}" restart
    log_info "Voice server restarted"
}

show_status() {
    print_banner
    echo -e "${BOLD}Voice Server Status (${PROFILE} mode)${NC}"
    echo "────────────────────────────────────────"

    local container_name
    if [ "${PROFILE}" = "gpu" ]; then
        container_name="${CONTAINER_NAME_GPU}"
    else
        container_name="${CONTAINER_NAME_CPU}"
    fi

    # Container status
    local running
    running=$(docker ps -q -f "name=${container_name}" 2>/dev/null || true)

    if [ -n "${running}" ]; then
        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "unknown")
        local uptime
        uptime=$(docker inspect --format='{{.State.StartedAt}}' "$container_name" 2>/dev/null || echo "unknown")

        echo -e "  Container:  ${GREEN}RUNNING${NC}"
        echo -e "  Health:     ${health}"
        echo -e "  Started:    ${uptime}"

        # GPU info (if applicable)
        if [ "${PROFILE}" = "gpu" ]; then
            echo ""
            echo -e "  ${BOLD}GPU Utilization:${NC}"
            docker exec "${container_name}" nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu --format=csv,noheader 2>/dev/null || echo "  (Unable to query GPU)"
        fi

        # Quick health check
        echo ""
        echo -e "  ${BOLD}API Health Check:${NC}"
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3900/health" 2>/dev/null || echo "000")
        if [ "${http_code}" = "200" ]; then
            echo -e "  HTTP /health:  ${GREEN}${http_code} OK${NC}"
        else
            echo -e "  HTTP /health:  ${RED}${http_code}${NC}"
        fi

        # Resource usage
        echo ""
        echo -e "  ${BOLD}Resource Usage:${NC}"
        docker stats --no-stream --format "  CPU: {{.CPUPerc}}  RAM: {{.MemUsage}}  Net: {{.NetIO}}" "${container_name}" 2>/dev/null || echo "  (Unable to query stats)"
    else
        echo -e "  Container:  ${RED}STOPPED${NC}"
    fi

    # Volume info
    echo ""
    echo -e "  ${BOLD}Persistent Volume:${NC}"
    docker volume inspect kivora-voice-data --format '  Mount: {{.Mountpoint}}  Size: ' 2>/dev/null && \
        du -sh "$(docker volume inspect kivora-voice-data --format '{{.Mountpoint}}' 2>/dev/null)" 2>/dev/null || \
        echo "  (Volume not found or empty)"

    echo ""
}

show_logs() {
    local container_name
    if [ "${PROFILE}" = "gpu" ]; then
        container_name="${CONTAINER_NAME_GPU}"
    else
        container_name="${CONTAINER_NAME_CPU}"
    fi

    log_info "Showing logs for ${container_name} (Ctrl+C to exit)..."
    docker compose --profile "${PROFILE}" logs -f --tail 100
}

do_update() {
    print_banner
    log_step "Updating voice server (${PROFILE} mode)..."

    # Pull latest image
    pull_image

    # Recreate containers with new image
    log_step "Recreating containers with updated image..."
    docker compose --profile "${PROFILE}" --env-file "${ENV_FILE}" up -d --force-recreate

    local container_name
    if [ "${PROFILE}" = "gpu" ]; then
        container_name="${CONTAINER_NAME_GPU}"
    else
        container_name="${CONTAINER_NAME_CPU}"
    fi

    if wait_for_health "${container_name}"; then
        log_info "Update complete!"
    else
        log_error "Update failed. Rolling back..."
        docker compose --profile "${PROFILE}" --env-file "${ENV_FILE}" down
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

usage() {
    print_banner
    echo "Usage: $0 [PROFILE] [COMMAND]"
    echo ""
    echo "Profiles:"
    echo "  cpu    Run on CPU only (slower inference, no GPU required)"
    echo "  gpu    Run with NVIDIA GPU acceleration (requires nvidia drivers)"
    echo ""
    echo "Commands:"
    echo "  start     Start the voice server"
    echo "  stop      Stop the voice server"
    echo "  restart   Restart the voice server"
    echo "  status    Show server status and health"
    echo "  logs      Follow server logs"
    echo "  update    Pull latest image and restart"
    echo ""
    echo "Examples:"
    echo "  $0 cpu start        # Start in CPU mode"
    echo "  $0 gpu start        # Start with GPU acceleration"
    echo "  $0 gpu status       # Check GPU server status"
    echo "  $0 cpu logs         # View CPU server logs"
    echo "  $0 gpu update       # Update and restart GPU server"
}

# Parse arguments
PROFILE="${1:-}"
COMMAND="${2:-}"

if [ -z "${PROFILE}" ] || [ -z "${COMMAND}" ]; then
    usage
    exit 1
fi

# Validate profile
case "${PROFILE}" in
    cpu|gpu) ;;
    *)
        log_error "Invalid profile: ${PROFILE}. Use 'cpu' or 'gpu'."
        usage
        exit 1
        ;;
esac

# Validate command
case "${COMMAND}" in
    start)   do_start ;;
    stop)    do_stop ;;
    restart) do_restart ;;
    status)  show_status ;;
    logs)    show_logs ;;
    update)  do_update ;;
    *)
        log_error "Invalid command: ${COMMAND}"
        usage
        exit 1
        ;;
esac
