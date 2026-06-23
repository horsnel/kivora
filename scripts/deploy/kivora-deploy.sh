#!/usr/bin/env bash
# =============================================================================
# kivora-deploy.sh — Safe Kivora → Cloudflare Pages deploy script
# =============================================================================
# Purpose:
#   Builds and deploys Kivora to Cloudflare Pages, guaranteeing that
#   NEXT_PUBLIC_* env vars are inlined into the client bundle at BUILD time
#   (the #1 cause of broken Google sign-in / Supabase auth on previous deploys).
#
# Features:
#   1. Loads env vars from a local gitignored file (default: kivora-deploy.env)
#   2. Validates required vars BEFORE building (fails fast with a clear message)
#   3. Sets NEXT_PUBLIC_* vars in the shell so Next.js inlines them at build time
#   4. Verifies the inlined chunks after build (grep for project ID + JWT prefix)
#   5. Deploys via `wrangler pages deploy`
#   6. Supports --dry-run to validate without deploying
#   7. Supports --no-build to deploy an existing .vercel/output/static dir
#
# Usage:
#   ./kivora-deploy.sh                    # full build + deploy
#   ./kivora-deploy.sh --dry-run          # validate env + build only, no deploy
#   ./kivora-deploy.sh --no-build         # deploy existing build output
#   ./kivora-deploy.sh --env /path/to/env # use a specific env file
#   ./kivora-deploy.sh --project kivora   # override CF Pages project name
#
# Env file format (kivora-deploy.env):
#   NEXT_PUBLIC_SUPABASE_URL=https://asfzdbpfakwpiawhhrby.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
#   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...   # server-side, NOT inlined
#   CF_API_TOKEN=cf_...                                  # for wrangler
#   CF_ACCOUNT_ID=abcd1234                               # for wrangler
#   # Optional: AI / search API keys (server-side, runtime-only)
#   GROQ_API_KEY=gsk_...
#   GROQ_API_KEY_FALLBACK=gsk_...
#   GROQ_PROXY_URL=https://kivora-groq-proxy.vercel.app/api/groq
#   # ... etc
#
# IMPORTANT:
#   - This script MUST be run from a shell that has bun and wrangler installed.
#   - The kivora-deploy.env file MUST be gitignored (it contains secrets).
#   - NEVER commit kivora-deploy.env to git.
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Defaults & arg parsing
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/kivora-deploy.env"
PROJECT_NAME="kivora"
KIVORA_REPO_DIR="${KIVORA_REPO_DIR:-/home/z/my-project/kivora}"
BUILD_OUTPUT_DIR=".vercel/output/static"
DRY_RUN=0
NO_BUILD=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR]${NC} $*" >&2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)    DRY_RUN=1; shift ;;
    --no-build)   NO_BUILD=1; shift ;;
    --env)        ENV_FILE="$2"; shift 2 ;;
    --project)    PROJECT_NAME="$2"; shift 2 ;;
    --repo)       KIVORA_REPO_DIR="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,40p' "$0"
      exit 0
      ;;
    *)
      err "Unknown argument: $1"
      exit 2
      ;;
  esac
done

# -----------------------------------------------------------------------------
# Step 1: Locate and load the env file
# -----------------------------------------------------------------------------
log "Kivora deploy script starting"

if [[ ! -f "$ENV_FILE" ]]; then
  err "Env file not found: $ENV_FILE"
  err ""
  err "Create one from the template:"
  err "  cp ${SCRIPT_DIR}/kivora-deploy.env.example $ENV_FILE"
  err "  # Then edit $ENV_FILE and fill in your secret values"
  err ""
  err "Or pass --env /path/to/your/env/file"
  exit 1
fi

log "Loading env from: $ENV_FILE"
# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

# -----------------------------------------------------------------------------
# Step 2: Validate required env vars (fail fast BEFORE building)
# -----------------------------------------------------------------------------
log "Validating required env vars..."

REQUIRED_BUILD_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)
REQUIRED_DEPLOY_VARS=(
  "CF_API_TOKEN"
)

# Optional but recommended server-side vars (warn if missing, don't fail)
OPTIONAL_VARS=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "GROQ_API_KEY"
  "GROQ_PROXY_URL"
  "GEMINI_API_KEY"
  "OPENROUTER_API_KEY"
  "TAVILY_API_KEY"
  "BRAVE_SEARCH_API_KEY"
)

MISSING=0
for var in "${REQUIRED_BUILD_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    err "Missing required build-time env var: $var"
    MISSING=1
  fi
done

if [[ "$NO_BUILD" -eq 0 ]] || [[ "$DRY_RUN" -eq 0 ]]; then
  # CF_API_TOKEN needed both for dry-run (if building) and real deploy
  if [[ -z "${CF_API_TOKEN:-}" ]]; then
    err "Missing required deploy env var: CF_API_TOKEN"
    MISSING=1
  fi
fi

if [[ $MISSING -eq 1 ]]; then
  err ""
  err "Required env vars are missing. Edit $ENV_FILE and try again."
  exit 1
fi
ok "All required env vars present"

# Warn about optional vars
for var in "${OPTIONAL_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    warn "Optional env var not set: $var (some features may not work)"
  fi
done

# Quick sanity check on the Supabase URL
if [[ ! "$NEXT_PUBLIC_SUPABASE_URL" =~ ^https://[a-z0-9]+\.supabase\.co$ ]]; then
  err "NEXT_PUBLIC_SUPABASE_URL doesn't look like a Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
  err "Expected format: https://<project-id>.supabase.co"
  exit 1
fi
SUPABASE_PROJECT_ID=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's|https://([a-z0-9]+)\.supabase\.co|\1|')
ok "Supabase project ID: $SUPABASE_PROJECT_ID"

# Quick sanity check on the anon key (JWT prefix)
if [[ ! "$NEXT_PUBLIC_SUPABASE_ANON_KEY" =~ ^eyJ ]]; then
  err "NEXT_PUBLIC_SUPABASE_ANON_KEY doesn't look like a JWT (should start with 'eyJ')"
  exit 1
fi
ok "Supabase anon key looks like a JWT"

# -----------------------------------------------------------------------------
# Step 3: Verify the kivora repo exists and deps are installed
# -----------------------------------------------------------------------------
if [[ ! -d "$KIVORA_REPO_DIR" ]]; then
  err "Kivora repo not found at: $KIVORA_REPO_DIR"
  err "Set KIVORA_REPO_DIR env var or pass --repo /path/to/kivora"
  exit 1
fi

if [[ ! -f "$KIVORA_REPO_DIR/lib/supabase.js" ]]; then
  err "Expected file not found: $KIVORA_REPO_DIR/lib/supabase.js"
  err "Is this actually the Kivora repo?"
  exit 1
fi
ok "Kivora repo found at: $KIVORA_REPO_DIR"

cd "$KIVORA_REPO_DIR"

if [[ ! -d node_modules ]]; then
  log "node_modules missing — running bun install..."
  if ! command -v bun >/dev/null 2>&1; then
    err "bun is not installed. Install it first: https://bun.sh"
    exit 1
  fi
  bun install --frozen-lockfile
  ok "Dependencies installed"
else
  ok "node_modules present"
fi

# -----------------------------------------------------------------------------
# Step 4: Build (with NEXT_PUBLIC_* vars inlined)
# -----------------------------------------------------------------------------
if [[ "$NO_BUILD" -eq 1 ]]; then
  log "--no-build flag set — skipping build step"
  if [[ ! -d "$BUILD_OUTPUT_DIR" ]]; then
    err "Build output not found at: $BUILD_OUTPUT_DIR"
    err "Run without --no-build first, or run 'bun run pages:build' manually"
    exit 1
  fi
else
  log "Building with NEXT_PUBLIC_* env vars inlined..."
  log "  NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL"

  # Export the NEXT_PUBLIC_* vars so they get inlined into the client bundle
  export NEXT_PUBLIC_SUPABASE_URL
  export NEXT_PUBLIC_SUPABASE_ANON_KEY

  # Run the build
  if ! bun run pages:build; then
    err "Build failed"
    exit 1
  fi
  ok "Build completed"

  # -------------------------------------------------------------------------
  # Step 5: Verify inlining succeeded (the WHOLE POINT of this script)
  # -------------------------------------------------------------------------
  log "Verifying NEXT_PUBLIC_* vars were inlined into client chunks..."

  AUTH_CHUNK=$(find "$BUILD_OUTPUT_DIR/_next/static/chunks/app/auth" \
                 -name 'page-*.js' 2>/dev/null | head -1)

  if [[ -z "$AUTH_CHUNK" ]]; then
    err "Auth page chunk not found under $BUILD_OUTPUT_DIR/_next/static/chunks/app/auth/"
    err "This usually means the build didn't complete or the output structure changed."
    exit 1
  fi

  log "Checking chunk: $(basename "$AUTH_CHUNK")"

  # Check 1: Supabase project ID must be present
  if ! grep -q "$SUPABASE_PROJECT_ID" "$AUTH_CHUNK"; then
    err "Supabase project ID ($SUPABASE_PROJECT_ID) NOT found in auth chunk"
    err "This means NEXT_PUBLIC_SUPABASE_URL was NOT inlined at build time."
    err "Google sign-in will be broken. Aborting deploy."
    err ""
    err "Debug: ensure 'export NEXT_PUBLIC_SUPABASE_URL' ran before 'bun run pages:build'"
    exit 1
  fi
  ok "Supabase project ID inlined correctly"

  # Check 2: Anon key JWT must be present
  # Use first 20 chars of the JWT to avoid grep issues with the full string
  ANON_KEY_PREFIX="${NEXT_PUBLIC_SUPABASE_ANON_KEY:0:20}"
  if ! grep -q "$ANON_KEY_PREFIX" "$AUTH_CHUNK"; then
    err "Supabase anon key JWT NOT found in auth chunk"
    err "This means NEXT_PUBLIC_SUPABASE_ANON_KEY was NOT inlined at build time."
    err "Google sign-in will be broken. Aborting deploy."
    exit 1
  fi
  ok "Supabase anon key inlined correctly"

  # Check 3: Also verify a couple other client-side pages that use supabasePublic
  # (onboarding, opportunities, layout — anything that imports lib/supabase.js)
  for page in onboarding opportunities; do
    PAGE_CHUNK=$(find "$BUILD_OUTPUT_DIR/_next/static/chunks/app/$page" \
                   -name 'page-*.js' 2>/dev/null | head -1)
    if [[ -n "$PAGE_CHUNK" ]] && ! grep -q "$SUPABASE_PROJECT_ID" "$PAGE_CHUNK"; then
      warn "Supabase project ID missing from $page chunk: $(basename "$PAGE_CHUNK")"
      warn "  (May be OK if this page doesn't use supabasePublic directly, but check.)"
    fi
  done
  ok "Inlining verification passed — Google sign-in will work"
fi

# -----------------------------------------------------------------------------
# Step 6: Deploy via wrangler pages deploy
# -----------------------------------------------------------------------------
if [[ "$DRY_RUN" -eq 1 ]]; then
  warn ""
  warn "============================================================"
  warn "  --dry-run flag set — SKIPPING actual deploy"
  warn "============================================================"
  warn ""
  log "Build output ready at: $BUILD_OUTPUT_DIR"
  log "To deploy for real, re-run without --dry-run"
  exit 0
fi

log "Deploying to Cloudflare Pages (project: $PROJECT_NAME)..."

# Export the deploy-time vars
export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN"
if [[ -n "${CF_ACCOUNT_ID:-}" ]]; then
  export CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID"
fi

# Run the deploy
DEPLOY_OUTPUT=$(npx wrangler pages deploy "$BUILD_OUTPUT_DIR" \
                  --project-name="$PROJECT_NAME" 2>&1) || {
  err "wrangler pages deploy failed:"
  echo "$DEPLOY_OUTPUT" >&2
  exit 1
}

# Extract the deployment URL from wrangler's output
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-z0-9]+\.'"$PROJECT_NAME"'\.pages\.dev' | head -1)

ok ""
ok "============================================================"
ok "  DEPLOY SUCCESSFUL"
ok "============================================================"
ok ""
ok "  Production URL:  https://$PROJECT_NAME.pages.dev"
if [[ -n "$DEPLOY_URL" ]]; then
  ok "  This deployment: $DEPLOY_URL"
fi
ok ""
ok "  To verify Google sign-in works:"
ok "    1. Open https://$PROJECT_NAME.pages.dev/auth"
ok "    2. Click 'Sign in with Google'"
ok "    3. Should redirect to Google's OAuth consent screen"
ok ""

log "Done."
