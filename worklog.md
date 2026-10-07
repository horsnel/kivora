# APEX 2.0 Worklog

---
Task ID: 1
Agent: Main
Task: Implement full APEX 2.0 roadmap — LLM Wiki, Page Lifecycle, Hot Cache, SciMem, Provenance, Dialogic Wiki, Concurrency Safety

Work Log:
- Created Supabase migration (apex-v2-migration.sql) with 7 tables, indexes, RLS policies, and helper functions
- Implemented LLM Wiki Engine (agent/llm_wiki.py) — 460+ lines with full wiki lifecycle management
- Integrated wiki into research_engine.py — cache check before research, wiki compilation after research
- Created 5 Next.js API routes: /api/apex/wiki, /api/apex/cache, /api/apex/verify, /api/apex/dialogue, /api/apex/status
- Updated research page UI with wiki lifecycle badges, cache indicators, and source tier labels
- Pushed all changes to both GitHub repos (kivora + apex-research-agent)

Stage Summary:
- Database: 7 new tables (apex_wiki_pages, apex_wiki_sources, apex_research_cache, apex_claim_verifications, apex_source_provenance, apex_wiki_dialogue, apex_wiki_edit_log)
- Python: LLMWikiEngine class with full CRUD + cache + provenance + dialogue + concurrency
- Research: generate_research_report() now has wiki cache check + wiki compilation steps
- Frontend: Source tier indicators (P1/P2/P3/UNV), wiki lifecycle badges, cache badge
- API: 5 new edge runtime routes for APEX 2.0 features
- Files: apex-v2-migration.sql, agent/llm_wiki.py, 5 API routes, updated page.jsx + research_engine.py

---
Task ID: 2
Agent: Main
Task: APEX 2.1 — Close the gap between backend features and frontend/Worker integration

Work Log:
- Rewired /api/research/route.js with cache-first routing (check Supabase before Worker, store after)
- Added source tier enforcement (P1/P2/P3) to CF Worker with domain-to-tier mapping
- Added tier badges (P1 emerald, P2 blue, P3 amber, UNV gray) to ResearchClient.jsx
- Added cache hit indicator (purple "Cached" badge) and wiki lifecycle badge to report header
- Added query classification (academic/biomedical/tech/finance/general) to CF Worker
- Added academic search providers (Semantic Scholar, Crossref, PubMed) to CF Worker
- Added GitHub repository search for tech queries
- Added wiki dialogue UI panel below report with chat-style messages
- Updated APEX status to v2.1.0 with new feature flags
- Fixed tsconfig.json to exclude apex-research-agent from Next.js build
- Verified Next.js build succeeds (all pages compile)
- Pushed to GitHub (horsnel/kivora main branch)

Stage Summary:
- Cache integration: /api/research now checks cache first → instant responses for repeated queries
- Source tiers: CF Worker classifies all sources with P1/P2/P3/UNV + tierLabel
- Frontend badges: tier badges on sources, cache badge, wiki lifecycle badge all visible
- Query routing: academic queries now search Semantic Scholar + Crossref + PubMed
- Tech queries: search GitHub repositories
- Wiki dialogue: chat-style UI for asking follow-up questions about research
- Version: APEX 2.1.0
- Commit: d1280e3 on horsnel/kivora main

---
Task ID: 3
Agent: Main
Task: Deploy all repos to Cloudflare (Workers + Pages)

Work Log:
- Authenticated with Cloudflare API token (cfut_...) for account odehebuka48@gmail.com
- Deployed research-worker → https://kivora-research.odehebuka48.workers.dev (Version: 293350e7)
- Built Kivora Next.js with @cloudflare/next-on-pages v1.13.16 (32 static pages, 44 edge functions)
- Deployed Kivora Pages → https://kivora.pages.dev (Deployment: c114ba17)
- Created D1 database apex-db (ID: 50f0ec88-23f7-4ca4-a3f4-f6d11b9a8949) for apex-worker
- Commented out R2 and Vectorize bindings in apex-worker wrangler.toml (R2 not enabled on account, Vectorize auth error)
- Deployed apex-worker → https://apex-research-agent.odehebuka48.workers.dev (Version: 1285e722, D1+AI bindings active)
- Verified all 3 deployments are live and responding
- Verified APEX 2.1.0 status endpoint returns all feature flags
- Pushed updated wrangler.toml and worklog to GitHub (commit 86f02f3)

Stage Summary:
- Kivora Pages: https://kivora.pages.dev — LIVE (APEX 2.1.0 with all features)
- Research Worker: https://kivora-research.odehebuka48.workers.dev — LIVE (cache, tier enforcement, query classification, academic routing)
- APEX Worker: https://apex-research-agent.odehebuka48.workers.dev — LIVE (D1 + Workers AI, R2/Vectorize pending account enablement)
- Pending: R2 needs to be enabled in Cloudflare Dashboard for full apex-worker functionality

---
Task ID: 4
Agent: Main + Subagent
Task: Refactor apex-worker to remove R2+Vectorize dependencies (replace with D1-only)

Work Log:
- Analyzed all 9 source files referencing R2 (BUCKET) and Vectorize bindings
- Replaced R2 storage with D1 `content_text` column on wiki_pages and documents tables
- Replaced Vectorize vector search with D1-stored embedding JSON + JS cosine similarity
- Updated types.ts: removed BUCKET/VECTORIZE from Env, added content_text/embedding to DocumentRow
- Rewrote embedder.ts: upsertToVectorize → D1 UPDATE, queryVectorize → D1 SELECT + cosine similarity
- Updated index.ts: removed R2 health check, ingest stores content_text+embedding in D1
- Updated retriever.ts: reads content_text from D1 row instead of R2 bucket
- Updated wiki-engine.ts: stores full wiki content in content_text column, reads from D1
- Updated dialogic-wiki.ts: contradiction pages stored via D1 UPDATE with content_text
- Updated concurrency.ts: merge conflict resolution writes to D1, not R2
- Updated security.ts: adversarial review reads content_text from D1, not R2
- Created migration-r2-to-d1.sql with ALTER TABLE statements
- Applied D1 migration: added content_text and embedding columns to documents and wiki_pages
- Deployed apex-worker v2.1.0 (D1-only, no external service dependencies)
- Pushed to GitHub: horsnel/apex-research-agent (commit 90c9816) and horsnel/kivora (commit f409740)

Stage Summary:
- APEX Worker now runs with ZERO external service dependencies beyond D1 + Workers AI
- Architecture: cloudflare_worker+d1+llm_wiki (was +r2+vectorize)
- D1 migration applied: content_text + embedding columns added
- All 3 services verified healthy:
  - Kivora Pages: https://kivora.pages.dev — LIVE
  - Research Worker: https://kivora-research.odehebuka48.workers.dev — LIVE
  - APEX Worker: https://apex-research-agent.odehebuka48.workers.dev — LIVE (D1+AI only)

---
Task ID: 5
Agent: Main
Task: Integrate Google Colab CLI into Kivora — add GPU/TPU execution capabilities

Work Log:
- Created lib/colab.js — Full Colab API client library (633 lines) with session management, code execution, GPU jobs, keep-alive, OAuth2 flow, file I/O, and Drive mount support
- Created app/api/colab/route.js — Edge runtime API with POST (12 actions: auth-url, status, new, exec, run, stop, sessions, install, ls, download, upload, drivemount, accelerators) + GET (OAuth2 callback)
- Created app/colab/page.jsx + app/colab/ColabClient.jsx — Full React UI with sidebar sessions, accelerator selector, code editor, output panel, template picker, file management, auth flow, toast system
- Added run_on_gpu tool (#26) to lib/toolRegistry.js — Definition, handler wired to lib/colab.js, and TOOL_INSTRUCTIONS documentation
- Added IconGpu and IconTpu to components/Icons.jsx — GPU chip and TPU board icons
- Created colab-sessions-migration.sql — Supabase table with RLS policies for session persistence
- Added /colab nav link to components/Navbar.jsx with IconGpu icon and i18n keys (en, fr, sw, yo)
- Wired chat API (app/api/chat/route.js) to set Colab access token from server env before tool handlers run
- Added run_on_gpu UI indicator (gpuUsed, accelerator) to chat API response metadata
- Added Google Colab env vars to .env.local.example (GOOGLE_COLAB_CLIENT_ID, GOOGLE_COLAB_CLIENT_SECRET, GOOGLE_COLAB_ACCESS_TOKEN)

Stage Summary:
- Core library: lib/colab.js with full Colab CLI integration (OAuth2, sessions, code exec, GPU jobs, file mgmt, Drive mount)
- API: /api/colab with 12 actions + OAuth callback, edge runtime compatible
- Frontend: /colab page with full GPU/TPU IDE (session manager, code editor, output viewer, templates, file browser)
- Chat integration: run_on_gpu tool (tool #26) available in AI chat, server-side token wiring, UI badges
- Database: colab_sessions table for session persistence with RLS
- Navigation: GPU Lab link in sidebar with GPU icon
- Config: Environment variables documented for OAuth setup
- Architecture: Edge-first, compatible with Cloudflare Pages deployment

---
Task ID: 2
Agent: Main
Task: Fix research page still showing "Application error" after first fix attempt

Work Log:
- Discovered the file had been reverted/corrupted to an older version with ALL original bugs
- The import line only had `useState, useEffect, useRef` — missing `useMemo`, `useDeferredValue`, `startTransition`, `memo`
- Old `renderMarkdown` (JSX) was back instead of `markdownToHtml` (HTML string)
- Old `streamReport` (setInterval at 16ms) was back — main freeze cause
- Old `staggerSources` was back — re-render storm cause
- `userScrolledUp` and `streamTimerRef` used but never declared — crash cause
- `activeResearch` stored progress/stage internally with spreading — re-render cause
- Completely rewrote the file with all 11 fixes applied
- Built and deployed successfully to Cloudflare Pages
- Verified page loads (HTTP 200) and JS chunk is valid

Stage Summary:
- Complete rewrite of research/page.jsx (1736 lines)
- All 11 critical bugs fixed in one comprehensive rewrite
- Deployed to https://kivora.pages.dev

---
Task ID: 404-fix-2
Agent: main
Task: Fix 404 on /research?q=... URLs

Work Log:
- Diagnosed: every /research?q=<value> URL returned HTTP 404 fresh, while cached URLs (e.g. ?q=test) returned 200 with stale HTML pointing to deleted JS chunks
- Root cause: my previous deploys uploaded .next/ directly (Next.js server build output) which is NOT compatible with CF Pages for App Router. Without _worker.js + _routes.json, CF Pages treats /research?q=hello as a static file lookup and returns 404
- Fix: ran `npx @cloudflare/next-on-pages` to generate .vercel/output/static/ (CF Pages-compatible output with _worker.js + _routes.json)
- Deployed from .vercel/output/static/ instead of .next/ using `wrangler pages deploy .vercel/output/static --project-name=kivora --branch=main`
- Verified all 5 test URLs return 200: /research, /research?q=hello, /research?q=, /research?q=What+are+the+main+criticisms..., /research?q=test

Stage Summary:
- 404 fixed. The package.json already had the correct scripts: `npm run pages:deploy` (which uses next-on-pages). Going forward, deploys MUST use `npm run pages:deploy` or the equivalent `npx @cloudflare/next-on-pages && npx wrangler pages deploy .vercel/output/static --project-name=kivora --branch=main`. Deploying .next/ directly breaks routing for any URL with query strings.

---
Task ID: hydration-fix-300
Agent: main
Task: Fix React hydration error #300 — site crashes with "Something went wrong" on first load

Work Log:
- Cloned kivora repo from GitHub (horsnel/kivora main branch)
- Investigated all client components for hydration mismatch sources
- Identified 4 root causes:
  1. `@import url(...)` for Google Fonts in globals.css — render-blocking CSS that produces different styles on server vs client during hydration
  2. Missing `suppressHydrationWarning` on `<html>` tag — React 19 crashes on any attribute difference between server and client HTML (browser extensions, CSS-only animations like .grain overlay, etc.)
  3. Module-level `createBrowserClient()` in lib/supabase.js — `@supabase/ssr`'s `isBrowser()` check returns different values on server vs client, creating different singleton behavior
  4. Dead `src/app/` scaffold directory (Z.ai template) conflicting with real `app/` directory
- Applied fixes:
  - Replaced `@import url(...)` with `next/font/google` (Inter, JetBrains Mono) — eliminates render-blocking CSS and guarantees identical font CSS on server & client
  - Added `suppressHydrationWarning` on `<html>` tag — prevents React 19 from crashing on minor attribute differences
  - Converted `supabasePublic` from module-level const to lazy Proxy-based singleton — defers `createBrowserClient()` until first actual use (useEffect/event handler), never during SSR render
  - Removed dead `src/app/` directory (layout.tsx, page.tsx, api/route.ts) — eliminates potential routing confusion
  - Updated CSS variables to reference next/font custom properties (`--font-inter`, `--font-jetbrains`)
  - Improved error boundary with hydration error detection
- Built with `@cloudflare/next-on-pages` and deployed to Cloudflare Pages
- Verified all pages (/ , /chat, /research, /explore) load with zero console errors

Stage Summary:
- Hydration error #300 resolved via 4-pronged fix
- Deployed to https://kivora.pages.dev (commit 04eebda)
- Zero console errors on all tested pages
- Font loading now uses next/font optimization (faster + SSR-safe)
- Supabase client now lazy-initialized (SSR-safe)

---
Task ID: sec-hardening-1
Agent: Main
Task: Security scanner findings — CSP unsafe-inline, CORS, tech-stack disclosure, admin panel, robots.txt

Work Log:
- Hybrid CSP: hash-based (build-time, per-route, via scripts/generate-csp.mjs) for 30 prerendered pages; per-request nonce via middleware for 4 SSR page routes; no unsafe-inline/unsafe-eval anywhere
- generate-csp.mjs also strips x-matched-path/x-nextjs-prerender/x-nextjs-stale-time from _worker.js/index.js (middleware never runs on prerendered short-circuit paths)
- layout.jsx: sw-register + suppress-300 → external files; next.config: poweredByHeader false
- _headers: CSP removed (dual-policy conflict), ACAO override → single origin, /admin* noindex; robots.txt filled
- /api/admin: timing-safe compare + 25/day per-IP failure cap + 400ms delay
- research-worker + sandbox-worker: ACAO wildcard → origin allowlist, deployed (4a2892bb / cfe6f076)
- mermaid self-hosted at public/vendor/mermaid.min.js (jsdelivr allowlist failed real-browser test)
- Commits 31ba957 + d9995dc, deployed via GitHub Actions; verified on prod + real browser (zero CSP violations, hydration intact, Code Explainer end-to-end, mermaid loads, jsdelivr blocked)

Stage Summary:
- All code-fixable scanner findings resolved and production-verified
- Remaining (user/DNS side): SPF/DKIM/DMARC/DNSSEC/CAA records, Cloudflare Access for /admin, secret rotation

---
Task ID: chat-totp-1
Agent: Main
Task: Chat page fixes (something-went-wrong, pro badges, effort toggle, more-models), chat rate limits, admin TOTP, DMARC, full page QA

Work Log:
- Investigated user-reported chat failure: probed prod chat API across 12 payload shapes (plain/proMode/models/focus/tools/stream+json) — core pipeline healthy; identified empty-reply class (provider returns 200 + empty content → client generic fallback) as the "Something went wrong." cause
- Discovered sandbox display layer strips ESC-CSI-like sequences (e.g. bracket-m) — repo files were NEVER corrupted; ground truth via node --check/eslint exit codes; verified write path intact with runtime test
- lib/groq.js: +3 models (deepseek-r1, qwen-qwq, llama-3.2-3b) with pro flags; provider maps extended (siliconflow/openrouter/gemini/sambanova)
- lib/plans.js: proModels feature flag (pro/max/team true, free false)
- app/api/chat/route.js: pro-model gate (402 + upgrade_url for non-Pro incl. anonymous), effort param (low/medium/high → 2048/4096/8192 max_tokens), per-account burst limit (8/min keyed user:<id>), empty-reply retry-without-tools + honest fallback in both tool and normal paths
- app/chat/ChatClient.jsx: ALL_MODELS with Pro badges + lock icons in chip dropdown, settings model page, more-models page; Pro toggle lock badge for non-Pro; effort real state (localStorage persisted, label from state, checkmark moves); upgrade popup; empty-response auto-retry once (same convo, no re-append) + friendly final fallback (replaces chat.error.general usage)
- lib/totp.js: RFC 6238 TOTP (Web Crypto HMAC-SHA1, base32, ±1 step window); RFC vector test 94287082@T=59 PASS
- app/api/admin/route.js: TOTP second factor when ADMIN_TOTP_SECRET set (uniform 403 shape — no factor oracle), day-scoped session token (HMAC password+date) for background refreshes
- app/admin/page.jsx: 2FA code input (progressive), session token persistence, 403 → re-lock flow
- ADMIN_TOTP_SECRET pushed to CF Pages (prod+preview) via API — merge verified (37 env vars intact)
- app/3d/ThreeDClient.jsx: fixed cube-scene cleanup ReferenceError (orbitControls never declared — own pointer-orbit implementation) + 3 duplicate maxDistance keys
- Local workerd smoke (wrangler@4 + nodejs_compat): 13/13 PASS (TOTP flows ×5, pro gates ×3, pages/CSP ×5)
- CF token has NO zone access → DMARC/DNS changes CANNOT be pushed via API; paste-ready list handed to user

Stage Summary:
- Commit b443146 pushed to main (GitHub Actions deploys)
- Chat: Pro badges + gating end-to-end, effort working, more-models connected to real provider models, rate limits: anon 5/day+burst, logged-in credits+8/min burst, pro models Pro-gated server-side
- "Something went wrong" root-caused to empty provider replies; now retried once + honest fallback server-side AND client-side
- Admin: TOTP live (secret ZXJCQ7H6ETWS3IV7SMJD2D23IFJVBWCF — user must add to authenticator)
- DNS-side items (SPF/DKIM/DMARC p=quarantine/DNSSEC/CAA) remain user-dashboard actions
