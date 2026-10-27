#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# build_env.sh — v5.27 lesson: wrangler-direct builds run LOCALLY, so
# NEXT_PUBLIC_* vars must be exported BEFORE `npm run build`. Without
# them the prerendered layout injects an empty window.__KIVORA_ENV__
# and the Supabase browser client never bootstraps (chat crashed for
# fresh visitors — fixed 2026-10-28).
# Values are PUBLIC by design (shipped to every browser). Source of
# truth: CF Pages project settings (plain_text vars, readable via API).
# Usage: source scripts/build_env.sh && npm run build
# ════════════════════════════════════════════════════════════════════
export NEXT_PUBLIC_SUPABASE_URL="https://asfzdbpfakwpiawhhrby.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZnpkYnBmYWt3cGlhd2hocmJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTkyMDEsImV4cCI6MjA5NjgzNTIwMX0.o3URcLqseAz73ihycPk1byX_gK6Nz6GsrFqRP_u-Fr8"
