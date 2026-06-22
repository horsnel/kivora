# Kivora — Supabase + Google OAuth Setup Guide

This guide walks you through configuring **Supabase** (database + auth) and **Google OAuth** so that:

- Users can sign in with Google on `/auth`
- Chat conversations are saved per-user (Supabase `chat_sessions` table)
- Research reports are saved per-user (Supabase `research_reports` table)
- Explore / Opportunities pages pull cached opportunities from Supabase
- Wiki ingestion works (chat & research assistant replies are stored in `wiki_pages`)

---

## Part 1 — Create a Supabase Project

1. Go to **https://supabase.com** → sign in → **New project**
2. Fill in:
   - **Name:** `kivora` (or any name)
   - **Database password:** generate a strong one and **save it**
   - **Region:** pick the one closest to your users
3. Wait ~2 minutes for provisioning to finish

---

## Part 2 — Run the Database Migration

1. In your Supabase dashboard, go to **SQL Editor** → **New query**
2. Open the file `supabase-migration.sql` from this repo
3. Copy the entire contents and paste into the SQL editor
4. Click **Run**

This creates all required tables:
- `profiles` (user info, mirrors `auth.users`)
- `chat_sessions` (per-user chat history)
- `research_reports` (per-user research reports)
- `explore_cache` (cached opportunity guides)
- `wiki_pages`, `apex_wiki_pages`, `apex_research_cache`
- `saved_results`, `contact_submissions`, `page_views`, `study_sessions`, `exchange_rates`
- All RLS policies (users can only see their own data; service role has full access)

---

## Part 3 — Get Your Supabase API Keys

In your Supabase dashboard, go to **Project Settings** (gear icon) → **API**:

| Key | Where to use it |
|---|---|
| **Project URL** (e.g. `https://abcdefgh.supabase.co`) | `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL` |
| **anon public** key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role** key (keep secret!) | `SUPABASE_SERVICE_ROLE_KEY` (server-only) |

> ⚠️ **Never expose the service_role key in the browser.** Only use it in API routes / Workers.

---

## Part 4 — Configure Auth Settings in Supabase

1. In Supabase dashboard → **Authentication** → **URL Configuration**
2. **Site URL:** `https://kivora.pages.dev` (or your custom domain)
3. **Redirect URLs** — add ALL of these:
   - `https://kivora.pages.dev/auth/callback`
   - `http://localhost:3000/auth/callback` (for local dev)

4. Under **Authentication** → **Providers**:
   - **Email:** Enable (already on by default)
   - **Google:** Enable → see Part 5 below

---

## Part 5 — Set Up Google OAuth

### Step 1: Create a Google Cloud Project

1. Go to **https://console.cloud.google.com**
2. Click the project dropdown (top bar) → **New Project**
3. Name it `Kivora Auth` (or any name) → **Create**
4. Make sure your new project is selected in the top bar

### Step 2: Configure the OAuth Consent Screen

1. In Google Cloud Console, go to **APIs & Services** → **OAuth consent screen**
2. Choose **User Type:**
   - **External** — for anyone with a Google account (recommended)
   - **Internal** — only for users inside your Google Workspace
3. Fill in:
   - **App name:** `Kivora`
   - **User support email:** your email
   - **App logo:** (optional, upload the Kivora logo)
   - **Application home page:** `https://kivora.pages.dev`
   - **Application privacy policy URL:** `https://kivora.pages.dev/privacy`
   - **Application terms of service URL:** `https://kivora.pages.dev/terms`
   - **Authorized domains:** `kivora.pages.dev`
   - **Developer contact information:** your email
4. Click **Save and Continue**
5. **Scopes** page — click **Add or Remove Scopes**:
   - Select `userinfo.email` (already checked)
   - Select `userinfo.profile` (already checked)
   - Click **Save and Continue**
6. **Test users** page — add your own Google account email for testing
7. Click **Save and Continue** → review summary → **Back to Dashboard**

> 📌 **Publishing:** While in "Testing" mode, only emails you add to **Test users** can sign in. When ready for public launch, click **Publish App** to move it to "In production" (Google may review it — usually instant for basic scopes).

### Step 3: Create Google OAuth Credentials

1. In Google Cloud Console, go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Choose **Application type:** `Web application`
4. **Name:** `Kivora Web Client`
5. **Authorized JavaScript origins** — add ALL of these:
   - `https://kivora.pages.dev`
   - `http://localhost:3000`
6. **Authorized redirect URIs** — add ALL of these:
   - `https://kivora.pages.dev/auth/callback`
   - `https://kivora.pages.dev/`
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/`
7. Click **Create**
8. A modal appears with your credentials — copy:
   - **Client ID** (ends in `.apps.googleusercontent.com`)
   - **Client Secret**

### Step 4: Enable Google in Supabase

1. Go back to your Supabase dashboard
2. **Authentication** → **Providers** → **Google** → toggle **Enable**
3. Paste the **Client ID** and **Client Secret** from Step 3
4. **Authorized Client IDs** (for native Sign in with Google): paste the same Client ID
5. **Redirect URL** shown by Supabase (looks like `https://abcdefgh.supabase.co/auth/v1/callback`) — copy this
6. Go back to Google Cloud Console → **Credentials** → edit your OAuth client → add the Supabase redirect URL to **Authorized redirect URIs**:
   - `https://abcdefgh.supabase.co/auth/v1/callback`
7. Click **Save** in both Supabase and Google Cloud Console

---

## Part 6 — Set Environment Variables in Cloudflare Pages

1. Go to **https://dash.cloudflare.com** → **Workers & Pages** → **kivora** project → **Settings** → **Environment variables**
2. Add the following (for **Production** environment):

| Variable name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (your anon public key) |
| `SUPABASE_URL` | `https://abcdefgh.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (your service_role key) |
| `GROQ_API_KEY` | (from https://console.groq.com) |
| `CF_API_TOKEN` | (your Cloudflare API token) |
| `CF_ACCOUNT_ID` | `9bd9a7308b74fc0440c7e6cd601f6eef` |

3. (Optional) Add the same variables for **Preview** environment
4. **Important:** After adding env vars, you must **redeploy** the project for them to take effect

### For local development

Create a `.env.local` file in the project root (do NOT commit this file):

```bash
cp .env.local.example .env.local
```

Then fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GROQ_API_KEY=gsk_your-groq-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Run `npm run dev` and visit http://localhost:3000

---

## Part 7 — Set Environment Variables in the Research Worker

The research worker (`kivora-research`) also needs Supabase access for caching & wiki.

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **kivora-research** → **Settings** → **Variables and Secrets**
2. Add:

| Variable name | Type | Value |
|---|---|---|
| `SUPABASE_URL` | Secret | `https://abcdefgh.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | (your service_role key) |
| `GROQ_API_KEY` | Secret | (your Groq key) |
| `TAVILY_API_KEY` | Secret | (your Tavily key from https://tavily.com) |
| `MISTRAL_API_KEY` | Secret | (your Mistral key from https://console.mistral.ai) |

3. **Save and deploy** the worker for changes to take effect

---

## Part 8 — Verify Everything Works

1. Visit `https://kivora.pages.dev/auth`
2. Click **Continue with Google** → should redirect to Google sign-in
3. After signing in, you should be redirected to `/onboarding` (first time) or `/dashboard`
4. Go to `/chat` — send a message → reload the page → your conversation should still be in the sidebar
5. Go to `/research` — run a research query → check Supabase `research_reports` table (you should see a new row)
6. Go to `/opportunities` — should now load cached opportunities (or show "no results" if the table is empty, but NOT a JS error)
7. Go to `/explore` — same as above

---

## Troubleshooting

### "Authentication is not configured" error on /auth
- `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing or wrong in Cloudflare Pages env vars
- Redeploy after setting them

### Google OAuth button does nothing / shows error
- Check that **Redirect URIs** in Google Cloud Console includes `https://kivora.pages.dev/auth/callback`
- Check that the Supabase redirect URL is also in Google's authorized redirect URIs
- Check Supabase → Authentication → Providers → Google is **Enabled** with correct Client ID/Secret

### Opportunities / Explore pages show no data
- This is expected if the `explore_cache` table is empty. Either:
  - Generate opportunities manually via the page UI, OR
  - Run the weekly cron job once to seed data
- If you see a **JavaScript error** (not "no results"), check that `NEXT_PUBLIC_SUPABASE_URL` is set

### Chat conversations don't save
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Cloudflare Pages env vars (server-side)
- Verify the `chat_sessions` table exists (run the migration)
- Check browser console for RLS policy errors

### Research reports don't save to Supabase
- Verify you're signed in (the report is only saved to Supabase if `user.id` is present)
- Check the `research_reports` table in Supabase
- Check browser console — the save is non-blocking so errors are only warnings

### "redirect_uri_mismatch" error from Google
- The redirect URI sent to Google doesn't match what's in Google Cloud Console
- Compare them character-by-character (trailing slash matters!)

---

## Quick Reference — Where to find each credential

| Credential | Where to get it |
|---|---|
| Supabase Project URL | Supabase Dashboard → Project Settings → API |
| Supabase anon key | Supabase Dashboard → Project Settings → API |
| Supabase service_role key | Supabase Dashboard → Project Settings → API |
| Google OAuth Client ID | Google Cloud Console → APIs & Services → Credentials |
| Google OAuth Client Secret | Google Cloud Console → APIs & Services → Credentials |
| Groq API key | https://console.groq.com → API Keys |
| Tavily API key | https://tavily.com → Dashboard |
| Mistral API key | https://console.mistral.ai → API Keys |
| Cloudflare API Token | https://dash.cloudflare.com → My Profile → API Tokens |
