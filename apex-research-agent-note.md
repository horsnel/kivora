# Apex Research Agent

The `apex-research-agent` is a Cloudflare Worker submodule that serves as the fallback research provider for Kivora.

## D1 Database

The D1 database bound to this worker is **intentionally empty**. It serves as a cache layer that will be populated on-demand as research results are stored. No seeding or migration is required — the worker creates tables on first write.

## Endpoints

- `POST /research` — Fallback research endpoint (called by Kivora when the primary worker fails)
