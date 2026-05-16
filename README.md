# Kivora

> Intelligence for builders everywhere.

A free AI-powered platform with tools, opportunities, and honest guides for builders worldwide.

## Pages

| Route | Description |
|---|---|
| `/welcome` | Marketing landing page |
| `/` | Search-first homepage — type any idea, get a 5-layer guide |
| `/explore/[slug]` | Five-layer opportunity result page |
| `/chat` | Free AI chat (Groq-powered, no login needed) |
| `/study` | StudyDesk — homework, essay, research, citation, coding |
| `/devtools` | Six dev tools — code explainer, regex, JSON, README, SQL, API |
| `/opportunities` | Browse all cached opportunity guides |
| `/dashboard` | Saved results + chat history (requires login) |
| `/auth` | Sign in / Sign up |
| `/auth/reset` | Password reset |
| `/auth/update-password` | Set new password after reset |
| `/auth/callback` | Supabase email confirmation handler |
| `/onboarding` | 4-step new user onboarding flow |
| `/about` | About Kivora |
| `/blog` | Blog index (links to external Hugo blog) |
| `/contact` | Contact form |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |

## Stack

- **Framework:** Next.js 14 (App Router)
- **Hosting:** Cloudflare Pages
- **Database + Auth:** Supabase
- **AI:** Groq (llama-3.3-70b-versatile)
- **Styling:** Tailwind CSS + Inter + JetBrains Mono
- **Icons:** Custom SVG (no emoji, no icon library)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/kivora
cd kivora
npm install
```

### 2. Set up Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Run `supabase-migration.sql` in the SQL Editor
3. In Supabase Auth settings → set Site URL to your domain
4. Add `https://yourdomain.com/auth/callback` to Redirect URLs

### 3. Environment variables

```bash
cp .env.local.example .env.local
# Fill in your keys
```

### 4. Get Groq API key

Sign up free at [console.groq.com](https://console.groq.com)

### 5. Run locally

```bash
npm run dev
```

## Deploy to Cloudflare Pages

| Setting | Value |
|---|---|
| Build command | `npx next build` |
| Output directory | `.next` |
| Node version | `20` |

Add all env vars in the Cloudflare Pages dashboard under **Settings → Environment variables**.

## GitHub Actions secrets needed

For the weekly cron (wiki lint + exchange rates):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`  
- `GROQ_API_KEY`

## Update blog URL

In `app/blog/page.jsx`, update the `BLOG_URL` constant at the top to point to your Hugo blog domain.

## Architecture

```
User searches idea
  → /api/explore checks Supabase cache
  → Cache miss → Groq generates 5-layer JSON guide
  → Cached in explore_cache table
  → Fires wiki ingest (background, non-blocking)

Wiki ingest:
  → Groq extracts entities
  → Upserts wiki_pages in Supabase
  → Rebuilds wiki_index

Auth flow:
  → Sign up → email confirmation → /auth/callback → /onboarding
  → Sign in → check onboarding_done → /dashboard or /onboarding
  → middleware.js guards /dashboard and /onboarding routes

Weekly GitHub Actions cron:
  → update-rates.js refreshes exchange rates in Supabase
  → wiki-lint.js health-checks wiki, auto-creates stubs
```

## License

MIT
