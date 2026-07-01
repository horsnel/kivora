# CF Pages GitHub Integration — Setup Guide

> **Goal:** Stop running `bun run pages:build` + `wrangler pages deploy` locally.
> Instead, push to `main` on GitHub → Cloudflare Pages builds it themselves
> with the dashboard env-vars injected at BUILD time → live in ~2 minutes.
>
> This is the **sustainable fix** for the recurring "Authentication is not
> configured" bug caused by `NEXT_PUBLIC_*` vars not being set at build time.

## Why this is better than local deploys

| | Local deploy (current) | CF Pages GitHub integration |
|---|---|---|
| `NEXT_PUBLIC_*` inlining | Manual — easy to forget | Automatic — dashboard injects |
| Build environment | Your shell | CF's build container |
| Rollback | Manual | 1-click in dashboard |
| Preview URLs per PR | No | Yes — every PR gets its own URL |
| Deploy on `git push` | No (you run a script) | Yes — fully automatic |
| Secret rotation | Edit `kivora-deploy.env` locally | Edit in dashboard once, applies everywhere |

## Step-by-step setup

### Step 1 — Make sure the GitHub repo is up to date

```bash
cd /home/z/my-project/kivora
git status
git push origin main
```

If you have unpushed commits, push them now. CF Pages will build from whatever
is on the GitHub branch you connect.

### Step 2 — Open Cloudflare Pages dashboard

1. Go to: **https://dash.cloudflare.com**
2. In the left sidebar, click **Workers & Pages**
3. Find your existing **kivora** project (the one currently at `kivora.pages.dev`)
4. Click into it

> **Do NOT create a new project.** We want to convert the existing direct-upload
> project to a connected-GitHub project. (If CF doesn't let you connect GitHub
> to an existing direct-upload project, you'll need to delete it and recreate
> — see "Option B" at the bottom of this guide.)

### Step 3 — Connect GitHub

1. Inside the kivora project, click the **Settings** tab
2. Scroll to **Build & deployments** → **Build configurations**
3. Look for a "Connect to Git" button (or "Source" → "Connect to Git")
4. Click it → authorize Cloudflare to access your GitHub account
5. Select the **horsnel/kivora** repository

### Step 4 — Configure build settings

| Setting | Value |
|---|---|
| **Production branch** | `main` |
| **Build command** | `bun run pages:build` |
| **Build output directory** | `.vercel/output/static` |
| **Root directory** | `/` (leave blank) |
| **Node version** | `20` (or whatever `package.json` requires) |

> ⚠️ **Important:** The build command MUST be `bun run pages:build` (which runs
> `npx @cloudflare/next-on-pages`), NOT `bun run build` (which runs plain
> `next build` and won't produce a CF Pages-compatible output).

### Step 5 — Set environment variables in the dashboard

This is the critical step. CF Pages will inject these into the build container
at build time, so `NEXT_PUBLIC_*` vars will be properly inlined.

Go to: **Settings** → **Environment variables**

Add these for the **Production** environment:

#### Required (build-time + runtime)

| Variable name | Value | Type |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://asfzdbpfakwpiawhhrby.supabase.co` | Plaintext |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` (full JWT) | Plaintext |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` (full JWT) | **Encrypt** |
| `CF_API_TOKEN` | (not needed for CF's own builds) | — |

#### Required (AI providers — runtime)

| Variable name | Value | Type |
|---|---|---|
| `GROQ_API_KEY` | `gsk_...` | **Encrypt** |
| `GROQ_API_KEY_FALLBACK` | `gsk_...` | **Encrypt** |
| `GROQ_PROXY_URL` | `https://kivora-groq-proxy.vercel.app/api/groq` | Plaintext |
| `GEMINI_API_KEY` | `AIza...` | **Encrypt** |
| `OPENROUTER_API_KEY` | `sk-or-...` | **Encrypt** |
| `ZAI_API_KEY` | (your key) | **Encrypt** |
| `ZAI_BASE_URL` | `https://api.z.ai/api/paas/v4` | Plaintext |
| `ZAI_USER_ID` | (your ID) | Plaintext |

#### Required (search/news — runtime)

| Variable name | Value | Type |
|---|---|---|
| `TAVILY_API_KEY` | `tvly-...` | **Encrypt** |
| `BRAVE_SEARCH_API_KEY` | (your key) | **Encrypt** |
| `NEWSAPI_KEY` | (your key) | **Encrypt** |
| `NEWSDATA_KEY` | (your key) | **Encrypt** |
| `FIRECRAWL_API_KEY` | `fc-...` | **Encrypt** |
| `ALPHAVANTAGE_KEY` | (your key) | **Encrypt** |
| `PIXABAY_KEY` | (your key) | **Encrypt** |

#### Optional (sandbox/billing — runtime)

| Variable name | Value | Type |
|---|---|---|
| `DAYTONA_API_KEY` | (your key) | **Encrypt** |
| `DOCKER_HOST_URL` | (your URL) | Plaintext |
| `KIVORA_SANDBOX_KEY` | (your key) | **Encrypt** |
| `KIVORA_SANDBOX_URL` | (your URL) | Plaintext |
| `PAYSTACK_SECRET_KEY` | `sk_test_...` or `sk_live_...` | **Encrypt** |

> 💡 **Tip:** Click "Encrypt" on any sensitive value. Encrypted vars are
> encrypted at rest with CF's KMS and only decrypted inside the build/runtime
> container.

### Step 6 — Trigger the first build

1. Go back to the **kivora** project → **Deployments** tab
2. Click **Create deployment** → **Git branch** → `main`
3. Or just push any commit to `main`:
   ```bash
   cd /home/z/my-project/kivora
   git commit --allow-empty -m "chore: trigger CF Pages GitHub integration build" 
   git push origin main
   ```
4. Watch the build logs in the dashboard — should take ~30–60s for `bun install`
   + ~15s for `pages:build` + ~10s to upload static assets
5. Once "Success" appears, click the new deployment URL

### Step 7 — Verify Google sign-in works

```bash
# Check the deployed auth chunk for inlined Supabase vars
DEPLOY_URL="https://kivora.pages.dev"
AUTH_CHUNK=$(curl -s "$DEPLOY_URL/auth" | grep -oE '/_next/static/chunks/app/auth/page-[a-f0-9]+\.js' | head -1)
echo "Auth chunk: $AUTH_CHUNK"
curl -s "$DEPLOY_URL$AUTH_CHUNK" | grep -o "asfzdbpfakwpiawhhrby" | head -1
# Should print: asfzdbpfakwpiawhhrby
```

If that prints the Supabase project ID, the integration is working. Visit
`https://kivora.pages.dev/auth` and click "Sign in with Google" to confirm
end-to-end.

## Going forward

Once this is set up, the deploy workflow becomes simply:

```bash
cd /home/z/my-project/kivora
# make your code changes...
git add .
git commit -m "feat: whatever"
git push origin main
# → CF Pages builds & deploys automatically in ~2 minutes
```

No more `kivora-deploy.sh`, no more `wrangler pages deploy`, no more
remembering to `export NEXT_PUBLIC_*` before building.

## Option B — If CF won't let you connect Git to an existing direct-upload project

Some direct-upload projects can't be converted in-place. If the dashboard
won't show a "Connect to Git" button on your existing kivora project:

1. **Rename the old project** (e.g., `kivora-old`) so the name `kivora` is freed up
   - Settings → General → Project name → change to `kivora-old`
   - This keeps your existing deployment URL working until you swap
2. **Create a new project** named `kivora`:
   - Workers & Pages → Create → Pages → Connect to Git
   - Select `horsnel/kivora` repo
   - Use the build settings from Step 4 above
   - Add all env vars from Step 5
3. **Trigger a build** (Step 6)
4. **Verify** the new `kivora.pages.dev` works (Step 7)
5. **Delete the old project** (`kivora-old`) once you're confident the new one works

## Troubleshooting

### "Build failed: Cannot find module '@cloudflare/next-on-pages'"
The build command is wrong. Use `bun run pages:build` (which calls
`npx @cloudflare/next-on-pages`), not `bun run build`.

### Build succeeds but Google sign-in still broken
Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are
set in the dashboard under the **Production** environment (not just Preview).
Then redeploy — env var changes don't apply retroactively to old deployments.

### "Authentication is not configured" still appears
Pull the deployed auth chunk and check:
```bash
curl -s "https://kivora.pages.dev/_next/static/chunks/app/auth/page-$(curl -s https://kivora.pages.dev/auth | grep -oE 'page-[a-f0-9]+' | head -1 | cut -d- -f2).js" \
  | grep -c "asfzdbpfakwpiawhhrby"
```
If it prints `0`, the env vars weren't injected at build time — re-check the
dashboard settings.

### Build runs out of memory
CF Pages free tier has 3GB build memory. If `next-on-pages` OOMs, you may
need to slim down `next.config.js` (disable source maps in production, etc.).

### Want to keep both methods?
You can. The `kivora-deploy.sh` script still works as a fallback for
hotfixes when you can't wait for a Git push to build. Just make sure your
`kivora-deploy.env` file's values match the dashboard's values.
