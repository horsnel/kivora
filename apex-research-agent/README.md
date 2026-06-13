# Apex Research Agent

This worker handles APEX model routing and wiki integration for the Kivora research pipeline.

## D1 Database

The D1 database binding (`DB`) is intentionally empty — it serves as a cache layer
for future use (e.g., caching research results, wiki page lookups). No migrations
are required at this time. When caching is implemented, run:

```bash
wrangler d1 execute apex-research-agent-db --command="CREATE TABLE IF NOT EXISTS cache (...)"
```
