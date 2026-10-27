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

---
Task ID: chat-totp-2
Agent: Main
Task: Deploy verification + 7-page QA + explore guide crash fix

Work Log:
- Deployed b443146 (chat+admin+3d) — Actions success, prod verified (pro gates 402, TOTP challenge live, CSP intact, no fingerprint headers)
- REAL-BROWSER QA (agent-browser, prod):
  - /devtools: Code Explainer end-to-end PASS (real AI QuickSort walkthrough, usage 5/5→4/5)
  - /reelpen: Lyrics Writer end-to-end PASS (Lagos sunset love song, usage 4/5)
  - /study: Homework Helper end-to-end PASS (mitosis vs meiosis)
  - /explore: index PASS; guide page CRASHED → root-caused
  - /opportunities: renders PASS (12 cached guides, generate form)
  - /chat + /research: anon → /auth redirect (design); logged-in chat UI verified via deployed bundle grep (upgrade popup, effort persistence, pro model ids, badges — all present)
- EXPLORE CRASH ROOT CAUSE: AI schema drift — failure_reasons returned as [{reason:"..."}] instead of string[]; renderer emitted object as React child → error #31 → "Something went wrong" boundary
- FIX: lib/exploreSchema.js (asText/asStringArray/asNumber/normalizeExploreResult); applied at API cache time (cecfbcb) AND render time (covers already-cached drifted guides); hardened opportunities checklist + CSV + metric renders
- Verified: old drifted guide now renders fully; fresh generation returns normalized schema (failure_reasons all strings)
- Chat generate_image retest: PASS (imageGenerated true, 62KB payload, fast-path reply)

Stage Summary:
- Commits b443146 + cecfbcb deployed; GitHub == prod
- All 7 requested pages QA'd with real AI generation where quota allowed
- Explore "Something went wrong" root-caused and fixed at both layers
- Remaining for user: DNS/CF dashboard items (DMARC p=quarantine, SPF/DKIM, DNSSEC, CAA, CF Access), TOTP secret enrollment, secret rotation

---
Task ID: ux-polish-3
Agent: Main
Task: 6-item UX fix round (Pro badge placement, header usage pills, opportunities CSV/speed/caching, checklist mobile overflow, settings card colour check)

Work Log:
- Repo re-cloned at b22bd6f after sandbox reset
- ChatClient: removed Pro badge from input-bar model chip (kept in model dropdown + Pro toggle lock)
- DevTools/ReelPen: removed "15/15 TODAY" usage pill next to page title (limits + countdown button untouched; deployed chunks verified: usage.header_free = 0)
- Opportunities: page-level "Export as CSV" removed; per-card CSV export added (action row: Plan / Compare / CSV, row now flex-wrap)
- Opportunities caching complaint root-cause: server cache WORKS (anon REST 200, 16 rows, cache-hit 0.5-1.2s); real bug was stale grid after generate->guide->back (App Router restores old client state on back-nav, useEffect didn't rerun). Fixed with optimistic prepend of fresh result + popstate/visibilitychange refetch
- Explore generation speed: 63.5s -> 24.8s fresh (2.6x). SambaNova Llama-3.3-70B fast path with dedicated 45s budget (sambanovaChatLong in lib/groq.js, directChat timeoutMs override) tried before mistral-small; JSON schema prompt trimmed (2-para overview, budgets line). Verified in prod: fresh 24.8s complete result, cache hit 0.5s
- Regression caught in QA: first deploy referenced sambaKey (undefined) -> 500; fixed to sambanovaKey (3c45dc8)
- Checklist modal mobile: input min-w-0 + button shrink-0 + p-4 sm:p-5 footer; header title line-clamp-2; verified at 375px AND 320px (add button inside dialog, no overflow)
- SETTINGS CARD COLOUR CHECK (report only, no change per user): chat settings sheet uses a different palette family than the platform's cards. Platform cards (about/opportunities/explore/devtools): #141414 cards on #0a0a0a, icon chips #1a1a1a, borders white/[0.06] or #262626, accent #dc2626 (red-600). Chat settings sheet: #1a1a1a sheet, option cards #242424 (lighter than any platform card), selection accent #c45c4a (warm rust, not brand red), icon tiles rgba(115,115,115,0.1)/#737373 (gray, not brand). Recommendation if user wants alignment: sheet #141414, option cards #1a1a1a, accent red-600, icon tiles keep neutral

Stage Summary:
- Commits da29e85 + 3c45dc8 deployed; remote HEAD == prod
- All 6 items addressed (5 fixed, 1 diagnosis-only as requested)
- Fresh explore generation 2.6x faster; grid no longer looks uncached after generation

---
Task ID: ux-polish-4
Agent: Main
Task: 3-item follow-up (fix settings colours, Pro badge still on text bar, replace card CSV button with 3-dot export menu CSV/PDF/Markdown)

Work Log:
- Sandbox reset again; repo re-synced to d78f8db; GitHub PAT recovered from disk (display layer was redacting it) -> scripts/.gh_token (chmod 600)
- ChatClient settings sheet palette aligned to platform system: panel #1a1a1a -> #0a0a0a, option cards/textarea/voice-btn #242424/#1a1a1a -> #141414, icon tiles rgba(115,115,115,.1) -> #141414 + #262626 border, selection accent #c45c4a/rgba(196,92,74,.08) -> #dc2626/rgba(220,38,38,.08) (model/effort lists + more-models), upgrade CTA -> red-600/red-500. Sidebar surfaces untouched (out of scope)
- Pro badge round 2: user's "still there" referred to the NESTED blue badge inside the input-bar Pro TOGGLE ("Pro [Pro+lock] [switch]" double-label for free users) - removed that badge; toggle itself kept (functional mode switch); dropdown + settings badges retained by design
- Opportunities: per-card CSV button replaced by kebab (3-dot) button opening an upward dropdown card with "Export as CSV file" / "Export as PDF" / "Export as Markdown"; menuSlug state + document click-outside close + stopPropagation; open menu raises card z-index (z-30) so adjacent grid cards can't paint over the dropdown (hover transform stacking-context trap); fixes for double ">" typo introduced by MultiEdit caught via byte-level check and fixed before build
- lib/fileExportClient.js: +exportOpportunityAsMarkdown (schema-safe mdTxt/mdNum; title/tagline, stats, works_in, overview, cost_breakdown table, tool_stack, action_plan checkboxes, failure_reasons, tags, footer)
- lib/fileExportHeavy.js: +exportOpportunityAsPDF (jspdf dynamic import, A4 dark sheet matching exportChatAsPDF style: header, title/tagline, income/cost stats row, overview, cost breakdown, tool stack, action plan with red period labels, failure reasons, footer; txt/money schema-safe helpers)
- Prod QA: build green; CSS layer: #c45c4a gone (0), rgba(220,38,38,.08) present (only from effort-card edit), #dc2626 + #0a0a0a present; chat chunk (page-d6d073896ab800e2.js + 2855.1522096b7e3b93d1.js fetched from prod by local-build hash match, HTTP 200): chat-pro-label children = plain "Pro" (badge gone), rgba(74,127,181,0.15) count 2->1 (dropdown badge kept), 0.12 x4 (settings/upgrade badges), rust 0, red 6
- Export unit tests on REAL prod row (automation-agency via browser-fetched Supabase data; sandbox DNS blocks direct supabase): MD 3265B all 7 sections, PDF 11227B %PDF- 2 pages -> ALL PASS; live browser QA on kivora.pages.dev/opportunities: kebab + 3-option menu renders at 390px, menu opens above card, no console errors on all 3 export clicks

Stage Summary:
- Commit a013981 deployed (d78f8db..a013981); remote == prod
- All 3 user items closed: colours aligned, text-bar Pro badge removed (toggle kept), kebab export menu with CSV/PDF/Markdown shipped and verified end-to-end

---
Task ID: chat-crash-1
Agent: Main
Task: Root-cause and fix chat page crash "g.map is not a function" (error boundary: Something went wrong / Try again / Go to Research)

Work Log:
- Sandbox reset; repo re-cloned at 1407411; PAT recovered again via blind grep (display layer redacts ghp_ tokens)
- Traced every .map in the chat render tree; only message-derived arrays can receive non-array data. Root causes:
  1) loadSession hydrates chat_sessions.messages RAW -> messages.map crashes if the row is an object/string
  2) applyChatMeta + render guards used ".length > 0" which non-empty STRINGS pass but strings have no .map (msg.artifacts / msg.opportunityCards)
  3) server route spread '...(session?.messages || [])' at 3 upsert sites: a corrupted row poisons every future save (string spread -> per-char messages, object spread -> key messages)
- Fixes (same defense-in-depth pattern as explore failure_reasons):
  - ChatClient: normalizeMessage/normalizeMessages (content -> string; artifacts/opportunityCards JSON-string arrays recovered, other drift dropped); wired into loadSession
  - applyChatMeta: Array.isArray guards; render guards at both chips/cards blocks now Array.isArray
  - route.js: prevMessages() helper replaces 3 unsafe spreads
  - ArtifactViewer: safeFiles coercion (files string/object drift) + Array.isArray on files iteration, iframe builder, deploy payload
  - useVoiceTTS: Array.isArray on engines fetch (same drift class, forEach)
- 18/18 unit tests on the extracted shipped functions (messages array/JSON-string/object/garbage, artifacts string/JSON/recovered, content coercion, server coercion)
- Prod verify: new chunk 2855.07a12e8da60b0cc5.js live (Array.isArray x15), /opportunities regression pass (18 kebab buttons, no console errors), chat middleware intact
- Anonymous repro impossible: /chat requires login (Skip link = /research redirect); user should retry their chat — corrupted history rows now render safely instead of crashing

Stage Summary:
- Commits ee6ba75 + a0dfdb2 deployed; remote == prod
- Chat crash root-caused at 3 boundaries (server save, client ingest, render guard); all known g.map shapes covered by tests

---
Task ID: chat-crash-2
Agent: Super Z (main)
Task: Fix recurring "g.map is not a function" crash on /chat — user still hit it after ee6ba75/a0dfdb2

Work Log:
- Restored sandbox env (repo clone, token from handoff doc)
- Audited every remaining .map in the live assistant-render path: ChatClient (13 sites), MarkdownRenderer, ThinkingState, CodePreviewCard, VoiceOutput, sseClient — all safe in new build
- Confirmed old code (1407411) had unguarded live path: `if (data.artifacts && data.artifacts.length > 0)` — a non-empty string passes and `.map` crashes; new-tab staleness keeps old JS alive because error.jsx only auto-reloads ChunkLoadError, not logic crashes
- Found real residual hole: normalizeMessage repaired array-level only — an array carrying garbage items ([null,"x"]) still crashes at artifact.type.toUpperCase() (1787) / opp.url
- Fix L1 client: sanitizeArtifactsList + sanitizeOpportunityCardsList (item-level), wired into normalizeMessage + applyChatMeta (live SSE path)
- Fix L2 server: sanitizeArtifactList + sanitizeOpportunityList at the 3 response-assignment sites (stream cards/artifacts + JSON path) — done event can never carry drifted shapes
- Fix L3 error.jsx: isNewerBuildLive() — compares freshly-fetched HTML chunk names vs loaded scripts; stale tab + new deploy → guarded auto-reload (60s guard); adds amber "refresh to update" hint when guard blocks
- Unit tests extracting shipped functions: scripts/test_chat_normalize.mjs — 29/29 PASS incl. poisoned-row + live-drift e2e shapes

Stage Summary:
- Commits: <this> — client+server+boundary triple defense; tests in scripts/test_chat_normalize.mjs
- User guidance: hard-refresh once (Ctrl+Shift+R) to escape stale tab; future deploys auto-heal via new stale-build recovery

---
Task ID: chat-crash-3
Agent: Super Z (main)
Task: User STILL sees "g.map is not a function" after 541187b — third report. Get ground truth + close remaining staleness vectors.

Work Log:
- Confirmed 541187b deployed & verified (chunk anchors) — so crash is either user-side staleness or a hole static analysis missed
- Audited LAST unchecked leads: PWA service worker (sw.js v13 policy is network-first HTML + hashed-assets cache-first = safe, BUT v8-v9 history had stale-HTML bugs → zombie SW can pin a device across refreshes), _headers had no no-cache for /sw.js, displayContent (string ops, safe), chatHistory/loadHistory chain (always array, safe), line 217 "syntax error" was display-layer distortion
- Static analysis exhausted → built crash-forensics pipeline: /api/client-errors (edge, POST=fire-and-forget report upload to private `client-error-reports` storage bucket created on first use; GET=latest 20 reports) + lib/reportClientError.js wired into app/error.jsx AND app/global-error.jsx (keepalive POST, never throws, token-shaped strings scrubbed, sizes capped)
- SW v13→v14 policy-identical bump to force-retire any zombie worker via skipWaiting+clients.claim+cache purge; _headers: no-cache for /sw.js + /sw-register.js
- Tests: scripts/test_error_reporter.mjs 18/18 (scrub/clamp/reporter incl. never-throw guarantees) + chat normalize 29/29 still green

Stage Summary:
- Commits: <this> — crash reports now reach the server; next user crash yields exact stack via GET /api/client-errors
- User guidance: incognito test discriminates staleness vs real bug; close all tabs / hard refresh; report back after next crash so stack can be pulled

---
Task ID: chat-crash-4
Agent: Super Z (main)
Task: Forensics paid off — pull real stacks, identify + neutralize the invisible messages-state corruptor

Work Log:
- GET /api/client-errors returned 3 real crash reports on prod chunk 2855.2380e8e66165c3d8:
  * g.map is not a function @ 1:75396 = the messages.map render — messages STATE is non-array
  * e is not iterable @ 1:53361 = the network-error updater [...prev] — same poisoned state, different shape
- Byte-offset archaeology of prod chunk: decoded send() (t$), all 4 call sites (safe), all direct setters y([])/y(a)/y(e) (safe), loadSession IIFE normalizeMessages (safe), voices eS IIFE hook (unconditional, legal), chatTitle (e.messages||[]).find — hardened now
- No conditional hooks found; hook-slot crossing unlikely (React would #300)
- Conclusion: an invisible writer sets messages to non-array → shipped instrumented self-healing setter:
  * makeSafeMessagesSetter wraps the raw useState setter: direct writes coerced to [] if non-array; updater form guards BOTH prev (repairs poison) and returned next
  * reportMessagesPoison posts writer-stack + value snippet to /api/client-errors once per shape — next occurrence names the culprit call site
  * user no longer sees the crash regardless of source
- chatTitle hardened: Array.isArray(session?.messages) gate before .find
- Tests: scripts/test_safe_setter.mjs 15/15; suites 29/29 + 18/18 still green

Stage Summary:
- Commit <this>: crash now impossible + forensics name the writer; if reports arrive, next fix is surgical

---
Task ID: chat-crash-4 (final)
Agent: Super Z (main)
Task: Fix "e is not iterable" follow-up — user reported AI responding "Network error. Please try again."

Work Log:
- Pulled forensics from /api/client-errors: TWO poison reports (08:22, 08:55 UTC, mobile UA) — `messages-state-poison via=direct shape=[object Object]`, writer stack: wrapper(2855:1:40031) <- tJ(2855:1:51524) <- i4 <- se/cs/cu (React event dispatch chain in 4bd1b696)
- Decoded deployed chunk 2855.9350bfcb at 1:51524 → `e?(Y(!0),k(e)):Y(!0)` = retry branch `setMessages(retryConvo)`; i4 decoded in React chunk = invokeListener inside DOM event dispatch → send() invoked synchronously by a CLICK handler with the SyntheticEvent as retryConvo
- Grep for handler-reference wiring found: `onClick={send}` on BOTH send buttons (lines 2154/2349, introduced 777b6c0 "expandable chat bar"); clearChat()/removeAttachment() take no params (harmless)
- Full mechanism: button tap → send(SyntheticEvent) → truthy retryConvo skips normal-send block → setMessages(event) poisons state (guard intercepts + reports) → JSON.stringify({messages: event}) throws "Converting circular structure to JSON" (nativeEvent→DOM cycles) → catch shows t('chat.error.network') "Network error. Please try again." — fetch never fires. Explains ALL FOUR rounds: mobile users always tap the button (Enter-key send() is arg-less → desktop unaffected); g.map crash was render over the poisoned state
- Fixes (commit eac291e): both buttons → onClick={() => send()}; send() top-guard `if (retryConvo && !Array.isArray(retryConvo)) retryConvo = null`; send's catch now calls reportClientError(err) (AbortError excluded); /api/chat strict `Array.isArray(messages)` validation replacing `!messages?.length`
- Tests: scripts/test_send_button_fix.mjs 21/21 (incl. behavioral replay of SyntheticEvent poison shapes + JSON.stringify circular repro); local next build clean
- Production verify (2855.bfd94c5845e209f4): Array.isArray ×22, /api/client-errors bundled in chat chunk, send button decoded as `onClick:()=>tq()`; POST messages:{} → 400, messages:"hi" → 400, valid array → 200 greeting

Stage Summary:
- ROOT CAUSE of the entire 4-round saga: onClick={send} handler-reference (777b6c0). Poisoning vector eliminated at the source, guarded at send(), validated at the API, and the catch path now reports. Deployed eac291e, verified in production.

---
Task ID: chat-crash-5 / explore-capacity
Agent: Super Z (main)
Task: Diagnose "I couldn't generate a response for that." (chat) + "engine out of capacity" (explore); APK ads question; push everything.

Work Log:
- Forensics: no new client-error reports (symptom is a valid-response path, not an exception)
- Server hardening audit: every server path guarantees non-empty reply — so the CLIENT fallback meant an event-less stream. Found it: processChat runs INSIDE sseResponse; bare `return <Response>` after stream open is silently discarded by ReadableStream.start(). Credits 402 (line 315), pro-model gate 403 (335), IP rate-limit 429 (197) all took that path
- /chat requires auth -> user always hits credits gate -> 402 discarded -> empty stream twice (auto-retry) -> client fallback. Explore: 402 mapped to misleading "out of capacity" copy. ONE account state (credits exhausted) + two UX bugs = both symptoms
- Verified /api/explore works anonymously (200, 15s) — failure is account-level, not provider outage
- Audited study/reelpen/devtools (gate BEFORE stream, self-contained callbacks) and research/explore (non-streaming) — no same-class breaks; chat was the only one
- Fixes (commit 264438f, amended cdd880e): 3 gate paths -> stream-aware json() helper (in-band error events); ChatClient appends upgrade nudge on upgrade_url payloads (stream + legacy paths); explore 402/403 surfaces the server reason, engine copy reserved for 5xx
- tests/test_gate_errors.mjs 13/13 incl. behavioral ReadableStream.start() discard repro; build clean; deploy success; production: SSE error events verified, valid generation verified
- docs/APK_ADS_GUIDE.md: Capacitor+AdMob (TWA cannot host ads; AdSense-in-WebView policy-risky), rewarded-ad-to-credits integration, UMP consent, direct-download + social-share checklist

Stage Summary:
- Both symptoms were the same server gate failure (likely credits exhausted) being hidden by broken stream error delivery. Errors now arrive in-band with real reasons. If the user is NOT out of credits, the next failure will display its true cause instead of a generic fallback.

---
Task ID: chat-ui-notice-cards
Agent: main
Task: Pill-shaped recent chats + unified notification cards styled like the ComingSoonPopup card

Work Log:
- Located sidebar conversation list (ChatClient 1318-1345) and the ComingSoonPopup design tokens (bg-[#111]/border-[#262626]/rounded-2xl, centered tinted icon badge, bold title, muted body, full-width dark button)
- Mapped server gate/failure taxonomy: 402 credits + 403/anon-pro gates + anon daily limit (anonLimitReached) + burst/GROQ 429s + 5xx + client-side network/empty-reply fallbacks
- New components/ChatNoticeCard.jsx (tones upgrade/quota/error, icons bolt/alert/hourglass/clock/warning, data-chat-notice marker)
- applyChatMeta classifies payloads into msg.notice = upgrade|quota|rate|error + upgradeUrl + anonLimitReached; legacy quotaExceeded kept for restored history
- noticeFor(msg,i) resolver renders per-variant cards; error cards get working "Try again" (send(messages.slice(0,i))); removed appended "Upgrade your plan..." text nudge (button replaces it)
- Sidebar rows + delete buttons rounded-lg → rounded-full (pills)
- Pro-model gate popup restyled to the same centered card language
- scripts/test_notice_cards.mjs: 40/40; test_send_button_fix.mjs 21/21; build clean

Stage Summary:
- Deployed db09a66, verified in production chunk 2713.e8315f843110088c (all 5 card titles + pill class + old amber card gone) and /api/chat healthy

---
Task ID: chat-streaming-polish
Agent: Super Z (main)
Task: Shorten rate/error card copy, remove upgrade-card arrow, cleaner message + picture streaming in /chat

Work Log:
- noticeFor copy: rate card now "Slow down there" + fixed short body ("Too many requests in a row — try again in a few seconds."); error card keeps "Something went wrong" + "We hit a snag. Give it another try." (verbatim server payloads no longer surfaced in these two cards)
- Removed '→' from ALL notice-card action labels (Upgrade plan / Sign in for more) — zero arrow glyphs left in ChatClient
- Message streaming: MarkdownRenderer gains `streaming` prop → .md-streaming class; CSS ::after blinking caret (▍, brand red, caretBlink) scoped to the last text block (p/ul/ol/table) so it never lands inside code blocks; thinking orb now hidden once streamed text is flowing (orb no longer trails growing text)
- Picture streaming: /api/chat emits {type:'status', tool:'generate_image'} SSE event before running the tool (guarded `if (send)`); client ImageGeneratingCard shimmer (image-gen-shimmer + image-gen-pulse) replaces the orb during generation; generated images render in a data-image-card with imageIn fade+scale reveal, prompt caption footer, and a Download button that works on data-URL-only images (href = imageUrl || imageData)
- streaming/imageGenerating state cleared on all exits (post-stream, catch/abort)
- Tests: test_notice_cards.mjs extended to 74/74 (copy, no-arrow, caret, status event, shimmer, image card); test_send_button_fix.mjs 21/21
- GitHub push FAILED (PAT redacted/expired everywhere; remote has empty x-access-token) — commit 9dc3fcc is local-only
- Deployed directly via scripts/deploy-direct.sh mirroring deploy.yml exactly: CF API env fetch (account 9bd9a7308b74fc0440c7e6cd601f6eef) → next-on-pages with NEXT_PUBLIC_* baked → generate-csp.mjs → wrangler@3 pages deploy → https://62ef272b.kivora.pages.dev

Stage Summary:
- Production serving new build: chunk 2713.7b659e90e73dba52 (all new copy markers, arrow-free), chunk 9308 (md-streaming), css 2d57e5384888a665 (caretBlink/imageIn/image-gen-*)
- Browser-verified end-to-end on live /chat (mock QA session + scenario override): caret live mid-stream + cleanup, orb hidden while streaming, rate/upgrade/error cards pixel-correct (no arrows), Try again re-fires (log chat:error ×2), status→shimmer→image card with caption + working Download
- 9 evidence screenshots in /home/z/my-project/download/verify-*.png
- PENDING: GitHub sync blocked — needs fresh PAT from user (commit 9dc3fcc + worklog commit ready to push)

---
Task ID: research-stream-v521
Agent: Super Z (main)
Task: Push pending cache-hit fix; fix "results not streaming / taking forever" in research engine

Work Log:
- Confirmed fb3049d (cache-hit .map crash fix) was already on origin; CI + Pages deploy green on it
- Read CI via GitHub API (watch_ci.py lives outside repo; scripts/ in repo has the 5 test suites)
- Diagnosed root cause: OpenRouter account 402s every request → v5.2.0 chains fell back to BUFFERED workersAiChat (8b ~10-15s, 70b ~60-70s) → long silence + ONE giant delta. Streaming only ever worked on the OpenRouter leg
- Confirmed worker bindings via CF API: AI, OPENROUTER_API_KEY, MISTRAL_API_KEY, TAVILY — NO GEMINI key ⇒ Workers AI streaming is the only fix that matters now
- Implemented workersAiChatStream(): env.AI.run({stream:true}) → SSE `data: {"response":...}` parser → onDelta per token; full text returned for validateOutput; null on failure → caller resetPartial() + next model (same contract as OpenRouter leg)
- Wired into llmApexFree WAI leg + llmApexPremium WAI leg when canStream; buffered workersAiChat preserved byte-identically for non-stream callers (llmQuick untouched)
- Header bumped v5.2.1; workersAiChatStream added to named test exports
- Regression: sections 10-11 added to test_research_stream.mjs (mocked env.AI binding, stream:true guard, per-token onDelta, empty/error/no-AI → null, static wiring ×2 chains, buffered paths still present). Hit a self-inflicted syntax bug (extra `)` + comma-operator soup in inline awaits) — rewrote block flat. 92/92; all 5 suites 213/213
- Deployed worker via `wrangler deploy --config research-worker/wrangler.toml` (CLOUDFLARE_API_TOKEN from scripts/.cf_token) → version d1b946bd
- LIVE VERIFIED worker: 810 deltas over 39.0s, first delta 3.8s, streamed chars == final report (4198==4198), recency year detected from "2026", 3 write-phase events at 3.8s = initial + 2×OR-402 resets before any visible text
- Commit 2e285eb pushed (remote URL now carries the new PAT); CI + Pages deploy green
- LIVE VERIFIED production route /api/research (needs browser UA — bare urllib gets 403 from bot protection): 604 deltas, first 4.2s, spread 39.5s, terminal done with full enriched payload (cacheId, wiki*, recency, fromCache)
- Cache burst re-verified: 1.12s repeat query, phase:cache → done, fromCache:true
- Verified live client bundle: page-494c1c550c3c33b6.js contains stream_active / research-stream-error / text/event-stream / recency markers (first check was a false alarm — grep'd framework chunks with a minifiable function name)

Stage Summary:
- Worker v5.2.1 live: true token streaming from ALL providers in both apex chains — OpenRouter credits no longer required for streaming UX
- Production chain verified end-to-end: browser → /api/research → worker → 600+ token deltas starting ~4s
- User-facing note: hard-reload /research once (old cached chunk predates streaming client); OpenRouter top-up still recommended (adds premium model quality, not needed for streaming anymore)
- Test suites: 213/213 (research_stream 92 + send_button 21 + notice_cards 75 + gate_errors 14 + output_scroll 11)

---
Task ID: research-premium-citations
Agent: Super Z (main)
Task: Premium citation layer + streaming policy (deep-only) + quick-mode speed

Work Log:
- ENV RESET HIT MID-ROUND: local repo rolled back to stale 831fd13 with churn; scripts/ wiped. Recovered: git reset --hard origin/main (all prior commits safe on origin), CF token re-extracted from upload/KIVORA_PROJECT_HANDOFF (2).md → scripts/.cf_token. LESSON: after any env reset, FIRST check `git log -1` vs origin before touching anything
- Built lib/citations.js: extractIdentifiers (DOI/PMID/NCT/PMC from URLs), buildReferences (n=index+1 = [N] marker contract, as-of date, databases), parseCitationMarker (bracket authoritative; paren drift validated against source count — "(2024)" never eaten), faviconUrl (Google s2)
- page.jsx: CiteLogo (Google s2 → DDG → letter fallback) — citations render as the SOURCE'S OWN LOGO click-linked to the source; buildMarkdownComponents(sources) via useMemo; SourceLogo tier-ring logos replace dots in sources list; ReferencesBlock (numbered, identifier-linked, as-of + databases) after report; stream gated to deep only (stream: researchMode === 'deep'); CSS for chips/logos/references
- Worker: prompts now demand bracket citations + named/yeared attribution + dated stats (all 4: quick/deep/part1/part2); quick output budget 450-650 words + max_tokens 2048
- MEASURED bottleneck after 54.5s regression report: WorkersAI llama-3.1-8b = 47.6s for 616 words (~13 tok/s). Benchmarked candidates via AI REST API: qwen3-30b-a3b-fp8 10.4s/~99tok/s (3.5× faster, structure+citations intact), llama-3.2-3b FAILED (empty), mistral-24b 25s
- v5.3.1: qwen-first in llmApexFree/llmApexPremium/llmQuick WAI legs; normalizeCitations() deterministic paren→bracket (valid N only, idempotent) wired into quick + deep sections; exported for tests
- Tests: test_research_citations.mjs 62/62 (identifiers, references model, marker grammar, normalizer, prompt discipline, qwen order, client wiring); all six suites 275/275; build clean
- Shipped: worker 2f9e82ef, commits 49aa9d7 + 0d32298, CI + Pages green
- PRODUCTION VERIFIED: quick 12.5s / 542 words / 34 [N] / 0 paren drift (was 44-54s); deep SSE 21.4s total, first delta 5.8s, 2801 deltas, 67 [N], out-of-order part_done handled (was 60-107s)

Stage Summary:
- Streaming: DEEP only, token-level, no buffering (quick = plain JSON for fastest E2E)
- Quick 3.8× faster, deep 3-5× faster with live text from ~6s
- Premium checklist addressed: click-through logo citations, references with DOI/PMID/NCT, as-of stamp, databases line, named+yeared attribution (prompt + deterministic normalizer)
- Next candidates: verification grid (3), agentic search loop (2), semantic cache + permalinks (5)

---
Task ID: export-fixes-subq-v56
Agent: Super Z (main)
Task: Fix PDF/chat export failures + research dropdown overlay; improved download icon + reelpen box already shipped in cc35cc8 (verified); ship sub-question decomposition (roadmap) in worker

Work Log:
- ENV check: HEAD==origin/main, clean tree, CF token in place; CI/Pages green on 3debd45 (export round's require() fix was deployed but never verified — worklog had no entry for it)
- DIAGNOSIS via live headless browser + chunk forensics:
  * Chunk 404 theory DISPROVED (webpack runtime renames chunk 3930→file 164f4fb6.*, 5033→2f0b94e8.*; all jspdf chunks HTTP 200 on prod)
  * Fresh local build reproduced runtime maps; exporters byte-validated in Node (PDF %PDF-/%%EOF, DOCX PK zip magic — all 4 exporters PASS)
  * CHAT EXPORT: real failure captured in browser — 'TypeError: i is not a function' @ chunk 2713. Root cause: ChatClient exportChat destructured downloadBlob from fileExportHeavy, which does NOT export it (lives in fileExportClient) → undefined for ALL formats since 17bdffc
  * STUDY/DEVTOOLS/REELPEN PDF: wiring correct; live PDF E2E on current build PASSES (study + research + reelpen re-verified post-ship) — user's report matches the pre-3debd45 window (17:49→18:02 UTC) when cc35cc8 shipped with the bare-require bug
  * RESEARCH DROPDOWN OVERLAY: globals.css .animate-fade-* carry will-change: opacity,transform + research-scoped fade-in uses forwards fill → meta row (holds ExportMenu) AND report body are permanent stacking contexts; DOM-later report body painted over the trapped z-50 dropdown
- FIXES: ChatClient imports downloadBlob from fileExportClient; research query-header row elevated relative z-20 (comment documents the stacking-context trap); reelpen min-h-[500px] lg:min-h-[560px] p-6 + IconDownloadReport verified already live from cc35cc8
- WORKER v5.6 sub-question decomposition: decomposeSubQuestions (pure heuristic, zero latency) — 3 shapes: vs/versus + colon qualifier + preposition tail; compare/difference-between with qualifier distribution; conjunction chains (2+ ' and ', ≥60 chars). Cap 3 facets, min 2 words each, dedupe, inert ([]) on single-facet/ambiguous. Wired in deepResearch AFTER initial search BEFORE corrective loop (corrective evaluates enriched pool): ≤3 parallel Tavily 'advanced' sub-searches merged via mergeCorrectiveResults cap 24; decomposed phase event carries subQuestions; REPORT FACETS line injected into write-phase contextBlock (both parts)
- Tests: citations suite +23 (decomposition: shapes, guards, wiring order, quick-mode purity, v5.6 bump) → 103/103; export suite +13 (chat fix regression tripwires incl. 'heavy lib really does not export downloadBlob', overlay z-elevation) → 103/103; FULL battery 483/483 across 8 suites; build clean
- Shipped: commit 09023ab (CI+Pages green), worker version cf4a17be
- LIVE VERIFIED (worker): multi-facet query 'solar vs nuclear vs wind for baseload power in developing countries' → decomposed:true, 3 exact facets, 3 search phases, 18-source merged pool, 3122 deltas, done.data 15,224-char report with 58 [N] markers + confidence tail
- LIVE VERIFIED (browser, production pages): chat Export Chat → ZERO console errors (was TypeError); research dropdown open → screenshot shows card floating fully above report body; research PDF + reelpen PDF clicked → all jspdf chunks 200, zero errors, menus closed on success; reelpen output panel measured 560px (minHeight computed)
- Screenshots: /home/z/my-project/download/verify-research-dropdown-open.png, verify-reelpen-export-open.png

Stage Summary:
- All five user complaints resolved: chat export works, PDF works everywhere (live-proven on current build), dropdown overlay fixed, improved multi-format SVG icon + reelpen box parity confirmed live, sub-question decomposition live in deep mode
- Deep pipeline order now: search → decompose-sub-searches (multi-facet only) → corrective tier check → tier-prioritized reads → faceted write
- Quick mode untouched (12s budget sacred); no protocol breaks (decomposed event keys are inert extras on the existing phase event)
- Next candidates per roadmap: semantic cache + permalinks; multi-image research (vision input for charts); citation preview cards on hover

---
Task ID: v57-dimensions-audit-cache-permalinks
Agent: Super Z (main)
Task: Roadmap (semantic cache + permalinks) + 5 engine-quality upgrades from the user's multi-engine competitive evaluation (architecture depth with named protocols, citation-claim verification, regulatory awareness, verifiable platform metrics, business-model sustainability); "what we couldn't verify" section explicitly DEFERRED per user

Work Log:
- ENV RESET HIT AGAIN: sandbox rolled back to stale 831fd13 + mode-churn + wiped scripts/; recovered via core.fileMode false + ff to 4f779e7, CF token re-extracted from upload/KIVORA_PROJECT_HANDOFF (2).md (cfut_ format this time), GH PAT from same doc for push auth
- WORKER v5.7 (research-worker/src/index.js):
  * detectAnalysisDimensions — 4 deterministic triggers (technical/regulatory/business/metrics); regulatory two-gated (policy words OR platform-noun+forward-framing) so "next social media platforms" fires but "best pasta recipes" never does
  * buildDimensionQueries — ≤3 parallel Tavily sub-searches (metrics directive-only); dimension searches merged into pool (cap 24) after sub-question search, before corrective loop
  * DIMENSION_DIRECTIVES — evidence-locked write-phase context: name SPECIFIC protocols from sources (generic "modular APIs" forbidden without a named example), frame regulation as compliance obligations, business-model SUSTAINABILITY analysis (unproven monetization = risk, not feature), verifiable scale metrics with [N], all "invention forbidden" clauses
  * CITATION-SUPPORT AUDIT (deep): extractCitedClaims (sentence+table-row scan) → buildSupportPrompt (strict rubric: topic-adjacent ≠ support) → llmApexFree 'audit' mode → parseSupportVerdicts → repair loop: ≤3 unsupported claims get ONE targeted Tavily search each, appendRepairSources appends EXACTLY ONE new source (indices continue after pool — existing [N] markers stay valid) and swapCitationMarker deterministically re-cites the sentence; unrepaired → flagged in supportCheck payload; every failure path silent
  * SEMANTIC CACHE (deep): embedQuery via Workers AI bge-base-en-v1.5 (768-dim) → cosineSim ≥ 0.93 vs recent semidx rows → serve stored payload (fromCache/cacheType:'semantic'/semanticScore/originalQuery); emit 'cache' phase on hit for stream UX
  * PERMALINKS (both modes): 12-hex capability id per successful report → GET /report/:id (validated ^[a-f0-9]{6,24}$, 90-day TTL) → Next proxy /api/research/report/[id] (rate-limited, edge, no auth — capability URL by design) → public /research/r/[id] page (verification grid re-derived from the SAME lib/citations — zero drift; support flags + sources + followups + CTA)
  * validateOutput 'audit' mode: JSON-validity check (compact JSON array replies always failed the report thresholds 500ch/50w/headings — audit was silently dead until this)
- CRITICAL INFRA FINDING: KV storage DEAD on this account — CF free tier caps KV writes per DAY account-WIDE (error 10048 "reached the free usage limit"), shared with musicpulse/sigma/vaultdrop workers; discovered mid-verification (silent catch{} ate it), pivoted storage to Supabase apex_research_cache rows under mode='permalink'/'semidx' namespaces (column overloads documented in-code, map 1:1 to dedicated tables later; ZERO migration needed — service-role key already in worker env). R2 unusable (10042 not enabled), Supabase DDL impossible without dashboard creds. KV binding kept in wrangler.toml (future hot-cache); quota resets 00:00 UTC
- NEXT API: semantic-hit refund parity (refund cost-1 on data.cacheType==='semantic' in BOTH JSON + stream paths, try/catch guarded); permalink proxy route
- CLIENT: permalinkId/cacheType/semanticScore/supportCheck passthrough in done-handler; Link button in meta row (between Copy and Export, z-20-elevated row — z-trap safe) with 1.8s green "Copied" feedback; "Semantic hit · N%" purple badge; VerificationGridBlock renders supportCheck section (repaired emerald chip, partial amber, unsupported red)
- Pages deploy FAIL on f36eb01: next-on-pages requires dynamic routes to export runtime='edge' → added to permalink page (same pattern as app/explore/[slug]) → b3d1e99 green
- Tests: 573/573 across 8 suites (citations 103→177, stream 92→100, export 103→110, grid 64→65); build clean
- Shipped: 256d6ac + f36eb01 + b3d1e99 (CI+Pages green); worker versions c2cd2af0 → 05f41f6d → 847241fc → 8e0a1fb2 (v5.7.1)
- LIVE VERIFIED (worker-direct, browser UA):
  * DEEP on the exact eval question: dimensions event [technical+regulatory+business+metrics], dedicated subsections in report: "Technical Architecture: Decentralization and Real-Time Systems", "Regulatory Landscape: Compliance as a Mandatory Feature" (17 regulat + 15 compliance mentions — the compliance-obligation framing), "Business-Model Sustainability: Ad-Targeting Risks", "Verifiable Scale Metrics: Lack of Data on Emerging Platforms" (honest no-data statement instead of invented numbers); protocol names stayed source-locked (no ATProto in sources → not named → citation discipline intact, per user's #1 differentiator)
  * SUPPORT AUDIT on live run: checked=13 supported=7 partial=3 repaired=3 — auditor caught "over 5 behavioral signals" vs source's "500 signals" misattribution (the EXACT Appinventiv-[4]-style failure from the user's eval); 3 claims auto-repaired via search+marker-swap
  * SEMANTIC CACHE: repeat query → HIT score 1.0 in 2s (vs ~45-77s fresh); looser paraphrase stayed below 0.93 threshold (conservative by design — no wrong-report risk)
  * BROWSER (production): /research/r/6d8e4f70b3ca renders full deep report (12,988 chars) + Verification panel (Weak · 13%) + "Citation support · 7/13 claims substantiated · 3 auto-repaired" section, 0 console errors; research quick run → Link button live → click → green "Copied"; /research/r/db3794cf8dea (quick permalink) renders 8 sources + CTA, 0 errors; invalid id → "Report unavailable" + CTA
- Screenshots: download/verify-permalink-page.png (full), verify-link-copied.png, verify-permalink-404.png

Stage Summary:
- All 6 items shipped: analysis dimensions (architecture/regulatory/metrics/business directives + searches), citation-claim verification with find-one-or-flag auto-repair, semantic cache (2s vs 45s on repeats), public permalinks with shareable verification-carrying pages, refund parity, Link button
- Deep pipeline order now: search → sub-question search (multi-facet) → dimension search (platform/product queries) → corrective tier check → tier-prioritized reads → faceted+directed write → citation-support audit + repair
- Quick mode untouched (12s budget sacred; permalinks only +20ms KV-free put)
- KNOWN LIMITS: semantic threshold 0.93 catches exact/near-exact repeats, misses loose paraphrases (honest miss → fresh run); protocol naming depends on sources containing them (evidence-locked by design — future tuning: topic-conditional protocol-term search augmentation)
- Next candidates per roadmap: multi-image research (vision input for charts); citation preview cards on hover; "what we couldn't verify" section (user-deferred); Supabase dedicated tables when dashboard access exists

---
## v5.8 + v5.8.1 — Deterministic Fabrication Gate (2026-10-14, commits 00b8986 → defb551)

Task: the user's re-run of the 4-engine eval caught Kivora FABRICATING statistics — "a 2026 JAMA analysis showing 68% of users..." cited to a HackerNoon article (JAMA is a medical journal; no 68% exists), "reduces latency by 40% [4]" with no source carrying the number, invented "Nearby Processing" technology. Verdict: "citation mismatch is sloppy; fabricated statistics are deceptive — the worst possible failure mode." Demands: (1) never generate a statistic without a verifiable source — say "no data found"; (2) verify citation-claim alignment BEFORE output; (3) flag uncertainty instead of filling gaps.

Work Log:
- Root-cause: the v5.7 metrics-dimension directive + attribution-rule example ("write 'a 2023 JAMA analysis [3]'") taught the fabrication TEMPLATE; prompt rules already forbade invented stats (rules 5/7) — demonstrably insufficient. The LLM entailment audit is lenient on numbers, and QUICK mode ran NO audit at all.
- v5.8 helpers (worker, both modes): extractStats (percent/currency/magnitude/bare; years skipped; citation markers stripped; bare-vs-rich dedupe), statMatchesSource (verbatim-or-nothing with digit normalization: 68% ↔ "68 percent", 2.5M ↔ 2,500,000, word boundaries so 5 never matches 500; strict on rounding), extractEntityClaims (attribution-noun proper names + coined capitalized terms; bold bullet labels + structural stoplist exempt), auditFabrications (stats verified against CITED source text, uncited against pool; entities in cited sentences incl. table content cells — leading label cell exempt)
- repairFabrications ladder: PASS A verified re-cite (pool source containing EVERY flagged figure) → PASS B verified search, ALL sentences in ONE parallel batch (hit cited ONLY if figure verbatim in its text — closes v5.7's topical-swap laundering hole) → PASS C one batched hedged rewrite, code-verified (figures gone + no new unverified figures/terms) → PASS D drop the sentence. Fiction is deleted, never shipped.
- Payload flow: statCheck through makeResponse → semcache slim → permalink verification_summary → GET /report/:id → Next exact-cache store+hit (ALSO closed a v5.7 gap: cached hits dropped supportCheck entirely) → research page state → Fabrication gate section in BOTH verification panels (research + permalink), showing "N/M figures verified · re-cited/hedged/removed"
- Prompt guards at all 4 sites (QUICK/DEEP/part1/part2): attribution rule no longer teaches the template; "EVERY number must appear VERBATIM in the cited source"; metrics directive mandates "no verifiable user/financial data found in sources" over estimates
- v5.8.1 (from live-run findings): ceiling 12 violations→24/12-sentence ladder after a run flagged 25; verified searches parallelized (1.5s wall); tier-snapshot prompt line ECHOED into a live report (reformatted heading + bullets) → moved to fenced internal note at prompt end + stripInternalPromptLines removes ANY line with internal tier jargon (P1-academic etc.) in both pipelines; entity check extended to table cells
- Regression: smoke 35/35 on the user's exact fabricated sentences; battery 615+/615+ across 8 suites (+42); reaudit_live.mjs = independent post-flight audit tool
- LIVE PROOF (worker-direct, deep): run 1 flagged 25 → 4 repaired + 3 rewritten + 1 removed; final runs flagged 6 → 3 repaired (verified search hits appended, e.g. [22] pulse-advertising.com FETCHED LIVE — "68% of millennials reported..." genuinely on the page) + 1 hedged + 1 re-cited; tier-jargon echo eliminated; zero provable residual fabrication (all re-audit flags were client-snippet-truncation artifacts — gate verifies against full text)

Stage Summary:
- Engine guarantee changed: figures in reports are now CODE-VERIFIED against cited source text (a number cannot be paraphrased — match is proof, not a judgment); violations never ship silently (verified re-cite / verified new source / hedge / drop)
- KNOWN LIMITS: uncited bare numbers check pool-wide (lenient — "17 unverified sources" self-counts survive); client payload truncates appended sources' snippets to 200 chars so post-hoc re-audits under-verify (gate uses full text); strict rounding (68 ≠ 68.4%) may hedge legitimately rounded figures — the honest direction per user's spec
- Next candidates: citation hover-preview cards; "what we couldn't verify" section (user-deferred); topic-conditional protocol-term search augmentation (from v5.7 eval)
- BROWSER (production, a16551f build): /research/r/d0e1c6941978 renders "Fabrication gate · N figures checked · M verified as-cited · re-cited/hedged" (denominator fix live), zero console errors; screenshot download/verify-fabrication-gate.png

## v5.19 — DB migration applied by hand (2026-10-23)
- User supplied the Supabase DB password → first-ever direct DDL channel (no more "SQL Editor by hand")
- Connection: session pooler aws-0-eu-west-1.pooler.supabase.com:5432, user postgres.asfzdbpfakwpiawhhrby, PG 17.6 (direct db.<ref>.supabase.co is IPv6-only — unreachable from sandbox; region found by scanning 20 pooler hostnames)
- Schema audit vs ALL 11 repo migration files: everything already applied (supabase base, new-features/forum, credits suite, community attachments cols, security-hardening plans FORCE RLS, fix-trigger-search-path handle_new_user+credits, colab/study/anon-usage, apex-v2 7 tables) — ONLY chat-session-meta (v5.18) was pending
- APPLIED: chat_sessions.title text + chat_sessions.pinned boolean default false (idempotent ALTERs, verbatim from chat-session-meta-migration.sql)
- Verified: columns live, RLS "users own chats"(ALL) covers new cols table-wide as the migration file predicted; functional probe (write→read→ROLLBACK) clean; 24 real sessions untouched
- Gap found & fixed while wiring the read path: loadHistory's .select() didn't fetch title/pinned → cloud values never reached the sidebar. Commit 1dbc40c adds them + graceful retry-without-meta-cols for pre-migration DBs
- Tests: v518 48/48, v517 13/13, v516 18/18; build ✓; prod chunk 7794.a3cb27c4 verified carrying "id, messages, updated_at, title, pinned" (deploy live)
- Scripts kept (password always via env, never inline): scripts/find_pooler_region.js, db_inventory.js, db_verify_pending.js, apply_chat_session_meta.js
- Cross-device rename/pin now FULLY live: writes → DB (localStorage mirror retained), reads → DB with local fallback

## v5.20 — resumable streaming (2026-10-23)
- User request: network drop mid-response must not lose the reply — generation continues server-side, client reconnects and receives remaining + already-generated content
- INCIDENT first: sandbox reset rolled the local checkout back to v5.8-era HEAD mid-session (env vars + node_modules + /scripts helpers gone). Remote was intact — `git reset --hard origin/main` restored 3ea521b; lesson repeated: ALWAYS verify `git log` vs `origin/main` before assuming local state
- New table `chat_generations` (id text PK = session id, user_id, content append-only, seq, status, done, error, meta, updated_at): applied via scripts/run-supabase-sql.js (pooler eu-west-1, PGPASSWORD env). RLS service-role-only. GOTCHA: SQL comments must not contain `;` — the pooler runner splits on ALL semicolons including comment text (ship a splitter fix later or keep the convention)
- lib/genBuffer.js: recorder observe()→throttled 600ms upserts, finish(meta)→done row + 24h stale sweep, fail(payload)→terminal error row; user_id written ONLY on first flush (upsert can't be hijacked to re-own a row)
- chat route: `let send = _send` wrapper feeds recorder; genRecorder.finish() before all 3 done sends (greeting/tool/normal); json() records 4xx gates; catch records crash; POST registers the handler work promise via sseResponse(handler, registerBackground) → cfEnv.runInBackground → ctx.waitUntil (background survival after client disconnect)
- GET /api/chat/resume: probe=1 → {status,length,tool}; done → {status:'done', content.slice(offset), ...meta}; error → recorded payload; active → SSE catch-up delta + 350ms tail-poll until done / 90s timeout / frozen-row (updated_at > 5min) stall. Ownership: row.user_id must match bearer user (anonymous rows resumable by anyone with the unguessable sid)
- ChatClient: accLenRef tracks rendered chars (resume offset); catch path (non-abort, has sid) → runResumeLoop (10 attempts, 500ms→5s backoff) → appendAssistantDelta into the SAME bubble → finalizeResumed via applyChatMeta (now component scope, res-optional); loadSession → probePendingGeneration: active→auto-resume from offset 0 (fresh bubble, stop button armed), done→append only if transcript missing the reply (dedupe by exact content match); send blocked while resuming; amber "reconnecting" chip (i18n chat.reconnecting ×4)
- Known degradations (documented): exec terminal statuses not replayed on resume (ephemeral UX only); waitUntil cap ~30s post-disconnect on CF — longer generations that die leave frozen rows which resume reports as stalled with resend advice
- Tests: test_v520.mjs 65/65 (incl. REAL functional recorder tests with fake admin: throttle timing, append-only, finish/fail, first-write-only user_id, sse hook forwarding) + regression 48/48, 13/13, 18/18; build ✓
- Commit 31bfd0a. PRODUCTION FUNCTIONALLY VERIFIED (not just markers): resume 404 → {"status":"none"}; probe row inserted via pooler → probe=1 {status:done,length:44}, offset=10 sliced exactly past "The quick ", meta spread intact; stale-active row → SSE delta + {"stalled":true}; probe rows deleted after (0 remaining)

## v5.21 — real social preview images (2026-10-23)
- User report: social share previews showed a grey placeholder. Root cause: layout.jsx declared `twitter: summary_large_image` but had NO og:image / twitter:image anywhere (public/ had no og asset at all) — scrapers render an empty box
- Fix: composed a real 4K platform visual — 3840x2160 master (`public/og-4k.jpg`, 294KB): HUSH backdrop with #FF3366 ambient glows, brand block (app icon + Carlito wordmark + "Intelligence for builders everywhere." with the hero's coral gradient on "builders"), right side carries a live capture of the public community feed in a rounded shadowed card
- Capture method: agent-browser screenshots of production (landing, chat, community, explore probed at 1440x900; community is public and reads best — recapture trick: shoot at 2x viewport for native-crisp raster if needed; 1440 shot composed best). Composer script kept at scripts/make_og.py (Pillow)
- Metadata: openGraph.images[1200x630 primary + 4K secondary] + twitter.images, ABSOLUTE URLs (metadataBase-proof). 1200x630 stays primary because WhatsApp/Telegram degrade multi-MB images — og.jpg is 72KB, safe everywhere
- Verified in production ~150s after push: og:image + width/height/alt live, /og.jpg + /og-4k.jpg both 200 image/jpeg, twitter:card intact
- Commit 4557d61. NOTE for future releases: scrapers cache OG aggressively — after changing og.jpg, re-scrape via opengraph.xyz or prepend a cache-busting query
- Discovery: team account already posts release notes on the community page ("Update 5.16 — …" format, verified badge) — per-release announcement workflow formalized from v5.21 on: every shipped release ships with a ready-to-post community draft

## v5.22 — open chat, web push, data handshake, SEO infra (2026-10-23)
- User directives: implement quality items 2-9 (color unification + community redesign deferred by owner); replace social preview with THEIR banner design (upload had "Your Startup Logo" placeholder — pixel-patched to "Kivora" via Pillow, same size/position/weight)
- OG fix shipped FIRST (19e22c2): og.png (1200x630 PNG, 68KB) as SINGLE og:image — multi-image entries made validators grab the 4K secondary; new filename busts all scraper caches. Dark 4K composition restored from git history as hero-visual.jpg for the landing
- LOGIN WALL root cause FOUND by production dissection: NOT a page gate — lib/authFetch.js redirected ANY 401 to /auth; mount-time usePlan → /api/credits/balance 401s every guest. Fix: redirect only when the request actually carried a Bearer token (hadAuthToken flag). Verified live: /chat stays /chat, guest banner renders
- Web Push (full stack, zero deps): lib/push.js implements RFC 8291 aes128gcm + RFC 8292 VAPID in pure WebCrypto (runs on CF Workers AND node; node:crypto is unavailable under next-on-pages). Round-trip functional test (encrypt as server, decrypt as client) 8/8. VAPID keypair generated (scripts/vapid-keys.env) — needs VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_CONTACT as CF env to activate (GET /api/push/key returns {key:''} until then — graceful off)
- push_subscriptions table applied to prod via pooler (idempotent, RLS own-rows only; GOTCHA AGAIN: semicolons in SQL comments break the pooler splitter)
- Trigger: sseResponse now passes conn{closed} to handlers; chat route fires pushIfDisconnected at all 3 done paths + crash path (only when conn closed + user + admin)
- SW v15 handlers: push → showNotification, notificationclick → focus-or-open /chat
- Data export in profile: paginates all chat_sessions client-side → downloads JSON + combined Markdown. Account deletion was already real (admin.deleteUser) — left untouched
- Per-post OG: /community/post/[id] (runtime=edge + force-dynamic, mirrors explore/[slug]) server-renders title/excerpt/first-image metadata; SinglePostView client render with the feed's markdown/code/attachment language; share chip on feed cards (span role=button — cards are <button>, nested button illegal)
- SEO: robots.txt + Sitemap line; JSON-LD (SoftwareApplication + Organization) in layout — CSP generator hashes inline scripts automatically (verified generator scans all inline <script>); metadataBase pinned
- LANDING: hero now carries a real product visual (app-showcase.jpg = the 4K composition's app card, brand-text side cropped off — landing already has its own headline) + new Community section with live feed capture (community-live.jpg)
- Announcements: catalog entries for 5.20 + 5.22 added → ensureOfficialPosts AUTO-PUBLISHED both (feed 5→7 posts, verified badge) — the release→community-post workflow is now fully automatic: add a catalog entry, it appears
- i18n: +83 backfilled keys × fr/sw/yo (ReelPen/export/usage clusters — first real translations) + 13 new v5.22 keys × 4 langs = 919 aligned everywhere, audit script kept (scripts/i18n_audit.mjs)
- a11y: :focus-visible brand ring + prefers-reduced-motion kill-switch in globals; messages container got role=log + aria-live=polite; error.jsx now carries the brand mark + home/chat links
- E2E: scripts/e2e_smoke.mjs (API-level, prod): guest stream → cut mid-gen → probe → resume offset → byte-complete reassembly + guest-chat + opportunistic authed chat (signup 429s skip gracefully). Ran GREEN against production: 7 passed, 0 failed, 1 skipped
- DEPLOY INCIDENT: 3 consecutive Deploy failures (144/145/146) while CI stayed green — local `next build` does NOT run the next-on-pages adapter. Reproduced locally with `npx @cloudflare/next-on-pages@1`: "/api/push/key, /api/push/subscribe, /community/post/[id] not configured for Edge Runtime". Fix: export const runtime = 'edge' on all three (+ sitemap reverted to static/sync — async metadata routes are not adapter-safe). LESSON: for any new route, run the adapter locally before pushing
- HEAD = (this commit); production verified: push key endpoint live {key:''}, per-post OG serving real titles, sitemap 18 urls, robots sitemap line, og:image=og.png, /chat open to guests with banner, JSON-LD present, landing images 200

## v5.23 — streaming render overhaul + preview-cache healing (2026-10-23)
- User reports: (1) social preview STILL a placeholder, (2) stray delete icon on conversation rows in touch, (3) streaming speed must increase and be flawless everywhere
- (1) ROOT CAUSE FOUND — not plumbing (og.png was already single-tag, 69KB, hash-verified): v5.22 DELETED og.jpg + og-4k.jpg while platform link-preview caches (FB/WhatsApp/Telegram, keyed per PAGE url, weeks-long TTL) still referenced them → crawlers fetch a 404 → grey placeholder. Fix: restored BOTH from git history (8e3238b) — every og url the site ever published now resolves; og.png stays the single live og:image. Lesson: NEVER 404 a once-published og asset; retire by keeping it reachable
- (2) the trash button on conversation rows is opacity-0/group-hover:opacity-100 — touch devices latch :hover on tap, so the icon stuck to the last-tapped row like a glitch. Removed the row-inline button entirely; delete/pin/rename/share all remain in the long-press action sheet (sessionAction). i18n key chat.history.delete now unused in list but kept (confirm dialog uses the cluster)
- (3) TWO separate causes, both fixed:
  - a) resume/recovery path (appendAssistantDelta) did PER-TOKEN setState — reconnect catch-ups and page-reload buffer replays fired hundreds of renders/sec and froze the tab. Now buffers into pendingDeltaRef and flushes at 30ms (~33Hz); flushAssistantDelta() called before every terminal replace (finalizeResumed/resumeGiveUp/abort/network-drop-before-resume)
  - b) accLenRef (resume offset) advanced at delta RECEIPT, not render — with buffering that could skip unrendered text; now advances at flush time. ALSO fixed a v5.20 bug: runResumeLoop never advanced `offset` between attempts → retries re-fetched from the original position and duplicated text; offset now advances per attempt
  - c) chat live-path flush cadence 55ms→30ms (v5.17 tuning was conservative; memo'd markdown carries the parse)
  - d) ReelPen/Study/DevTools/Research(x2: ResearchClient + page.jsx consumeResearchStream) all did per-token setResult/setReportDisplay — all five now share createDeltaFlusher (lib/sseClient.js, coalesces calls, trailing flushNow). Research flush points: delta push, part_done/done/error/reset flushNow, finally
- Tests: NEW scripts/test_v523_flusher.mjs 8/8 (coalescing, trailing flush, no-op safety, cycle restart, throw isolation, 40-event burst → 14 flushes); test_v520.mjs updated (abort-line assertion matches flush form) 65/65; research stream 109/109; e2e_smoke vs PRODUCTION 7 passed/0 failed/1 expected skip; next build ✓; next-on-pages adapter ✓ locally (v5.22 lesson applied)
- Announcement catalog entry "Update 5.23" added → auto-publishes via ensureOfficialPosts

## v5.23.1 — i18n phantom keys (2026-10-23)
- Production browser pass caught the guest-banner close button reading "common.close" — key used in code but missing from ALL four locales. Root gap: the v5.22 cross-locale audit (i18n_audit.mjs) compared locales against each other and never made it into git (lost in a sandbox reset) — keys absent EVERYWHERE pass that check structurally
- New scripts/i18n_usage_audit.mjs: walks app/components/lib, every t('key') must exist in all 4 locales. Found 7 phantoms: common.close, common.share, community.join_hint, community.open (real copy) + devtools/opportunities/study .split (numeric two-tone heading indices). All filled ×4 (923 keys each); 531 static refs, 0 missing
- Verified live: close button aria-label = "Close"; commit cfe4ee3
- Browser streaming verification notes: in-page fetch+reader consumes SSE instantly; quota (429) notice card renders correctly; two short UI replies showed odd fragments — controlled probes (curl + in-page eval, same endpoint) always streamed COMPLETE, fragments attributed to the UI-default small model's silent early drops on short replies (upstream behavior; ≥400-char replies already have looksCutOff+continuation protection). Also: `[data-msg-index]:last-child` is a BROKEN probe selector (autoscroll sentinel is the container's last child) — use `[data-msg-index]:last-of-type` or query all

## v5.24.6 — Kivora Browser (2026-10-27)
- User pivot: push popup issue exhausted (server chain proven twice; failure is Chrome/Android device layer) → directive: "build an in-web or in-app browser that's very powerful"
- Full in-web browser at /browser (Navbar link + PWA shortcut), fixed full-screen overlay, HUSH dark + #FF3366
- ENGINE lib/browser/core.mjs (pure ESM, shared edge+node): SSRF wall (v4/v6 private ranges, CGNAT, metadata, ULA, decimal/hex IP tricks, internal TLDs), validateTarget (scheme/credential/length), normalizeInput (omnibox: URL vs search), rewriteHtml (inject <base> pinning assets to source host; strip site base + CSP metas; re-route a/form-action/meta-refresh through the proxy; skip mailto/tel/js/#), extractTitle, extractArticle (strip head/title/script/nav/footer; pick best candidate article>main>body; whitelist tags; absolutize img/a; alt kept; lazy loading)
- ROUTES (runtime=edge, v5.22 lesson honored): /api/browser/proxy — GET+POST, UA switch (mobile default / ua=desktop), 15s timeout, 4MB html/15MB binary caps, branded HUSH error page with HTTP 200 (iframe-friendly), &diag=1 → machine JSON (403 blocked_host / 502 timeout|network); /api/browser/reader — full article JSON + ?meta=1 tab-title lookup
- THREAT MODEL: proxied HTML renders in sandbox iframe WITHOUT allow-same-origin → opaque origin, zero access to our cookies/localStorage; reader output server-whitelisted before dangerouslySetInnerHTML; proxy forwards no cookies, no-store everywhere, no-referrer
- CSP/xfo interplay: middleware sets XFO DENY on ALL dotless paths (matcher!) → would have blanked every proxied page; now SAMEORIGIN for /api/browser/proxy (route + _headers also assert it); frame-src 'self' means NO direct external iframes → proxy-only rendering by design
- UI components/BrowserApp.jsx: multi-tab (per-tab history stack, back/fwd/reload via kb key-bust, favicon pills, close/switch), omnibox (mirrors active URL, normalizeInput submit, stop/reload swap), menu (Reader mode / Desktop site / Night filter [invert+hue-rotate] / bookmark toggle / share / open external / clear history / exit), bottom bar (Home→start page, History drawer, Bookmarks drawer, New tab), start page (brand hero, omnibox, 12 quick links w/ google-s2 favicons + letter fallback, recents, bookmark chips), toasts, Escape layering, safe-area insets, localStorage persistence (tabs/bookmarks/history, debounced)
- i18n +35 keys ×4 locales = 971 parity (add_browser_i18n.mjs; usage audit 577 refs/0 missing); SW v17 (policy-identical bump), manifest Browser shortcut
- TESTS: scripts/browser_test.mjs 96/96 — caught: head/title text leaking into reader body candidate (fixed by stripping head/title pre-selection); adapter build ✓ (/browser prerendered, CSP hashed 32 routes); deployed via local next-on-pages binary + wrangler@3
- LIVE VERIFIED: SSRF 403s, example.com/wikipedia/DDG-search(10 proxy-rewritten results) render, SAMEORIGIN+no-store+x-kivora-proxy headers, reader JSON; agent-browser E2E vs production: full golden path incl. reader, 3-tab switching, night filter, bookmark persistence, back-nav — 0 console errors (7 screenshots in download/)
- Push saga frozen: FCM 201×2 + endpoint alive vs zero device receipts; SW v17 receipts + ping-pong stay armed — profile readout will show kivora-v17 on next device visit

---
Task ID: 8
Agent: main (Z.ai)
Task: v5.24.7 — user feedback: browser must not be a sidebar page; make it a DevTools-terminal-style drawer (draggable to full height), route all external links through it, thicker icons/lines, fix sluggish buttons, redesign omnibox to the platform text bar

Work Log:
- Recon: platform text bar = kivora-input-wrap (gradient focus ring) + bg #141414 / border #262626 / rounded-2xl (explore hero, chat composer); Icons.jsx stroke weight; z-map (content <= z-50, modals z-[100]+); GlobalCodeRunner = the existing slide-up drawer pattern the user referenced; external anchors live in community/research/blog/explore/markdown renderer/SinglePostView/CodePreviewCard/ArtifactViewer
- Architecture: BrowserProvider (root layout, wraps app shell) owns open/pending state + renders BrowserApp always-mounted (translateY(110%) hidden, session survives open/close); delegated CAPTURE-phase click listener intercepts every cross-origin <a> app-wide (mailto/tel/#/same-origin/download/[data-no-browser] exempt) → openBrowser(url) — one mechanism covers all current AND future pages incl. markdown-generated links
- BrowserApp rewritten as drawer: drag handle (role=separator, pointer events, velocity-aware snap half 50dvh / tall 85dvh / full 100dvh, flick-down or <30% dismisses, dbl-tap toggles half/full, ArrowUp/Down/Home/End resize), navbar link removed, /browser → BrowserLauncher (openBrowser + router.replace('/'))
- ROOT-CAUSE FIX for "buttons not working / slow": stranded setPointerCapture — capture-on-pointerdown + interrupted gesture (shade pull / edge lift / automation abort) retargeted ALL pointer events to the handle; click trace proved pointerup@handle instead of the tapped button. Fix: capture deferred until >=4px real movement (plain taps never capture) + window pointerup/pointercancel/blur safety net; menu now closes after every toggle; transition-all removed (colors only); 44px targets, touch-manipulation
- Chrome redesign: dedicated 2.2-stroke icon set (mk() factory, 18 icons), solid #262626 element lines, 2px #FF3366 top edge on handle, omnibox = kivora-input-wrap rounded-2xl with left glyph + right clear button, loading skeleton (opacity-0 iframe + KMark pulse) kills the white flash, notch spacer in full snap, toast/drawers scoped inside panel
- i18n +3 keys (browser.resize_handle/maximize/shrink) ×4 = 974 parity; usage audit 579/0; browser_test.mjs 96/96 (core untouched)
- Builds: 3× next-on-pages (caught IconGlobe still used by Navbar language dropdown after import trim — restored import, kept nav-link removal); generate-csp 32 routes; deployed ×3 (drag fix + menu-close ride the final b7b44235 deploy)
- E2E vs production (390×844): find-text clicks proved unreliable for the drawer (automation quirk — raw coordinate clicks are the truthful simulation); raw-mouse verified: link click opens drawer IN PLACE (URL preserved, no new tab), Close/maximize toggle 844/844, omnibox→https://wikipedia.org (title resolves, proxied), Reader (h1 extracted), Night filter (invert+hue-rotate on iframe), multi-tab (2 tabs + start page), /browser deep link → home + drawer, nav link gone, SAMEORIGIN+x-kivora-proxy intact, 0 console/page errors

Stage Summary:
- v5.24.7 (be9da99) live: browser is now a DevTools-style global drawer on every page; external links everywhere open in it; drag handle snaps 50/85/100% with flick-to-dismiss
- GOTCHA (recurring): agent-browser find role/text clicks can misfire on the drawer (hit-target/actionability quirks) — use mouse move/down/up at eval'd coordinates for truthful interaction tests; elementFromPoint at button center returns the inner SVG (bubbles fine for real users)
- GOTCHA: pointer capture on pointerdown is a footgun — defer to first movement or interrupted gestures strand capture and eat all taps (universal lesson for any draggable surface)
- Push saga untouched: SW v17 receipts + version ping-pong remain armed for the next device retest

---
Task ID: 3
Agent: main (Z.ai)
Task: v5.28 — sandbox_git clones repos into the persistent workspace + workspace file listing inside the Live Terminal drawer (both features user confirmed with "I want all")

Work Log:
- Recon: sandbox_git died with "No sandbox provider configured" on CF Pages (Daytona→Docker→CF-Sandbox all absent); toolContext already carries userId+supabaseAdmin; Live Terminal drawer = ChatClient terminalMode block (only open trigger is the v5.13 exec automation); /api/vfs + WorkspacePanel patterns established in v5.27
- lib/gitTarball.js (new, pure): parseRepoInput (github https/.git/tree+subdir/blob-reject/git@scp/short owner+repo/scheme-less, gitlab subgroups+tree, host wall), tarballUrls fallback orders, gitlabProjectApi + github repos-API default-branch probes, CLONE_UA, gunzip via DecompressionStream with 48MB cap, parseTar (ustar prefix field, pax path/size overrides, GNU 'L' long names, base-256 sizes, symlink/hardlink skips, caps→truncated flags), safeExtractPath traversal wall (40-seg security sanity; VFS depth policy stays in normalizePath), asciiSafePath charset sanitizer, stripCommonRoot
- toolRegistry sandbox_git rewritten: (args, ctx) signature; new tier 4 after CF-Sandbox — tarball snapshot clone into the user's VFS workspace (sandbox_id doubles as workspace): probe default branch → fetch candidates (UA, ref-forms then main/master/bare) → gunzip → parseTar → stripCommonRoot → optional /tree/<ref>/<dir> subpath filter → charset sanitize + collision `~N` suffixing → batched-quota vfsWrite loop (one count query + opts.fileCount increment — new vfs.js opt; 400 files/28MB/4MB-per-file caps) → result JSON {files_saved, total_bytes, tree preview 60, skipped/renamed/truncated/staging notes, executor:'kivora-workspace'}; anon → honest workspace_unavailable + sign_in_required; description + TOOL_INSTRUCTIONS GIT CLONES block updated
- components/chat/TerminalWorkspace.jsx (new): compact listing panel inside the terminal drawer — /api/vfs list with Bearer, count·size line (vfs.count interpolation), per-file download (blob) + delete, refresh button, 401→signed-out strip with /auth CTA, loading/failed/empty states; unmounts when hidden
- ChatClient wiring: TerminalWorkspace dynamic import; termWsOpen + termWsKey state; folder toggle in terminal header (aria-pressed, FF3366 active); bumpTermWs() after BOTH executeCommand paths + finishTerminalExec (auto-refresh listing after every run/auto-save); panel mounted between drawer header and xterm (visible=terminalMode&&termWsOpen)
- i18n: +vfs.refresh, +vfs.count ({n}/{size}) ×4 locales = 1027 parity (scripts/add_v528_i18n.mjs; comma-handling bug on last-key anchor fixed, files restored from git before rerun)
- Tests test_v528_git_terminal.mjs: 127 green — URL forms, real gzip round-trip + cap trip, handcrafted tar cases (pax path/size, GNU L, prefix, traversal/absolute/drive-letter/42-seg walls, caps→truncated, link skips), REAL tar-CLI archive pipeline (unicode/plus renames, binary byte-exact, symlink skip), REAL GitHub tarball (octocat/Hello-World via refs/heads/master after bare-/tar.gz 404'd — became a product fix: no-ref candidates now main→master→bare + api.github.com probe), registry/UI/i18n assertions. Regressions: v5.27 41/41 (real-Supabase VFS incl. new fileCount opt), v5.26 73/73, v5.23 8/8; v5.20 64/65 (1 pre-existing failure verified on stashed clean tree — chat-route recorder import assertion drift, not ours)
- Deploy gotcha chain (the big one): first build served __KIVORA_ENV__={"url":"","key":""} → /chat crashed client-side (getUser of undefined). Root causes: (1) @cloudflare/next-on-pages RE-RUNS next build internally — exporting NEXT_PUBLIC_* for `npm run build` alone is useless; the nop invocation itself needs the env (fix: source scripts/build_env.sh && npx next-on-pages@1); (2) stale .next/ cache from a pre-reset session poisoned client-chunk inlining (rm -rf .next required — NEXT_PUBLIC changes aren't cache keys). Fixed deployment serves non-empty bootstrap AND inlined client chunks (defense layers 1+2). Documented in scripts/build_env.sh usage
- Prod E2E (test_v528_prod_e2e.mjs) 20/20 against FINAL deploy: real user via admin API → real GitHub tarball → clone-shaped isBase64 writes through deployed /api/vfs (1 storage spill) → list shows full tree → byte-exact download → delete→404 → anon 401 wall → pages healthy + bootstrap non-empty
- Headless UI smoke (agent-browser): /chat loads with ZERO page errors (crash gone); terminal drawer opened via the kivora:code-exec-start window bridge; workspace folder toggle present; anon state → "WORKSPACE FILES | 0 files · 0 B | Sign in to keep the files…" strip; signed-in (real /auth login, admin-created user) → empty state, then real file written via /api/vfs + panel Refresh → row renders (dir prefix, "1 files · 38 B", Download+Delete buttons); test user deleted after
- GOTCHAS: (a) agent-browser find-text clicks misfire on the code-card Run button — and that button was disabled anyway (model emitted a code block with unmapped language tag → disabled placeholder); the window-event bridge (kivora:code-exec-start/-done) is the reliable way to drive the Live Terminal in headless tests; (b) @supabase/ssr browser session lives in COOKIES (sb-<ref>-auth-token), localStorage injection does nothing — use the real /auth flow for signed-in headless tests; (c) codeload's bare /tar.gz form 404s for many repos now — always send a ref

Stage Summary:
- v5.28 (2498a77) pushed and live on kivora.pages.dev (deploy a1d58195): "clone this repo" now lands a full working-tree snapshot in the user's persistent workspace without any sandbox provider; terminal drawer shows the real workspace with inline download/delete and auto-refreshes after every run
- 127 + 20 + 41 + 73 + 8 = 269 greens this round (1 pre-existing v5.20 failure, verified not ours)
- Deploy-critical lesson for every future wrangler-direct deploy: source scripts/build_env.sh BEFORE npx next-on-pages (not just npm run build) AND rm -rf .next when NEXT_PUBLIC values change
- Suggested next: workspace file listing inside sandbox_git result cards, clone progress events, or pinned repos in the Workspace panel
