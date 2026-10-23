import { getSupabaseAdmin } from '@/lib/supabase'
import { getEnvVar } from '@/lib/cfEnv'

// ════════════════════════════════════════════════════════════════════
// KIVORA OFFICIAL — the platform's verified identity + auto-poster
// ════════════════════════════════════════════════════════════════════
// The community feed carries an official "Kivora" account (verified badge)
// that posts product updates and tips AUTOMATICALLY: every time the feed
// is requested, this module makes sure every announcement in the catalog
// below exists — new entries appear on the community page the moment they
// are added to the catalog. No cron, no manual posting, no dashboard.
//
// Identity bootstrap is fully runtime: the official account is a REAL
// auth user (forum_posts.user_id has an FK to profiles(id), which itself
// FKs to auth.users — a fake UUID would violate the chain). On first run
// we look the user up by email and create it through the Admin API when
// missing (the on_auth_user_created trigger creates the profile row).
//
// Everything here is best-effort: any failure logs a warning and leaves
// the feed fully functional. Official verification on the client is
// driven by the `author_verified` flag this module's annotations add to
// posts/replies in GET /api/forum.

export const OFFICIAL_EMAIL = 'official@kivora.app'
export const OFFICIAL_NAME = 'Kivora'

// ── Announcement catalog ─────────────────────────────────────────────
// Add a new entry here → it appears on the community page automatically.
// `date` is the announcement's publish date (ISO) — real release dates,
// so the feed timeline stays honest.
export const ANNOUNCEMENTS = [
  {
    title: 'Welcome to the Kivora Community',
    date: '2026-10-15T09:00:00.000Z',
    body: `Welcome! This is the official Kivora community — a place to share what you build, ask questions, and swap tips with other creators.

A few ground rules to keep things useful:

- Show your work: screenshots, links and code welcome
- Search before asking — your question may already be answered
- Be kind. No spam, no self-promo dumps, no AI slop

The Kivora team posts product updates and tips from this verified account. Say hi in the replies and tell everyone what you're working on.`,
  },
  {
    title: 'Pro tips — getting more out of Kivora',
    date: '2026-10-17T12:00:00.000Z',
    body: `A few features that are easy to miss:

1. Long-press any reply bubble to copy it or export the whole conversation as Markdown, PDF, Word or HTML.
2. Drop a file into chat and ask about it — the AI reads documents, images and code.
3. Research mode cites every claim. Click a citation chip to jump to the exact source, and check the verification panel to see which claims were independently corroborated.
4. The Run button on any code block executes it in a live sandbox terminal — no local setup needed.

Got a favorite workflow? Post it below — the best tips get featured in future updates.`,
  },
  {
    title: 'Update 5.15 — the image engine, rebuilt',
    date: '2026-10-21T18:00:00.000Z',
    body: `Image generation got a full reliability pass this week:

- A crash that turned one flaky image request into a chat-wide error is fixed.
- Image providers now rotate automatically: when one is rate-limited, the next takes over within the same request.
- The generation card was redesigned — gradient frame, aurora canvas, live stage labels — and failures now say so honestly instead of faking it.

This update also hardened every tool under the hood: web search, code execution and site deployment all got the same protection. If you spot anything odd, drop it in this thread.`,
  },
  {
    title: 'Update 5.16 — Run any code, anywhere',
    date: '2026-10-23T09:00:00.000Z',
    body: `The headline: every code block in Kivora now runs.

- Hit Run on any snippet — in chat, in research reports, in study notes — and a live terminal slides up, executes the code, and shows the output. Python, JavaScript, TypeScript, Bash, SQL, Go, Rust, C, C++, Java, Ruby, PHP.
- No setup, no copy-paste into an IDE. The terminal follows you across pages and closes when you're done.
- Replies no longer stop mid-thought: the engine now detects a truncated answer and finishes it automatically.
- Images lose the watermark on every supported provider, and the community you're reading right now now carries official Kivora updates from this verified account.

Try it: ask the chat for a quicksort in Python and hit Run. Report anything broken below — we read everything.`,
  },
  {
    title: 'Try it now — your first Run',
    date: '2026-10-23T15:00:00.000Z',
    body: `Every code block in Kivora now has a **Run** button — including this one, right here in the community.

Hit Run below and watch the terminal do its thing:

\`\`\`python
# Quicksort — the classic. Hit Run to execute it live.
def quicksort(xs):
    if len(xs) <= 1:
        return xs
    pivot, rest = xs[0], xs[1:]
    lo = [x for x in rest if x < pivot]
    hi = [x for x in rest if x >= pivot]
    return quicksort(lo) + [pivot] + quicksort(hi)

import random
sample = [random.randint(1, 99) for _ in range(12)]
print("input: ", sample)
print("sorted:", quicksort(sample))
\`\`\`

No setup, no copy-paste — the terminal opens right where you are and runs the snippet on a live sandbox. It works the same everywhere: chat answers, research reports, and community posts like this one.

If a snippet ever fails to run, tell us in the replies and we'll fix it fast.`,
  },
  {
    title: 'Update 5.20 — replies that survive a bad network',
    date: '2026-10-23T19:00:00.000Z',
    body: `The headline: a dropped connection no longer kills your answer.

- Generation now continues server-side, even if you go offline mid-reply.
- Reconnect and the rest of the answer flows straight into the same bubble.
- Refreshed the page? Open the chat — it picks up where it left off.
- Works on mobile and for anonymous sessions too.

No more lost responses. Ask, go offline, come back — Kivora finished the thought. Report anything odd in this thread.`,
  },
  {
    title: 'Update 5.22 — open chat, push notifications, and a data handshake',
    date: '2026-10-23T21:00:00.000Z',
    body: `Three quality-of-life leaps in one release:

- **Chat is now open to everyone.** No sign-in wall: land on /chat and start typing as a guest (5 messages/day, then a friendly nudge). A slim banner reminds you to sign in if you want history saved across devices.
- **Web Push is live.** Enable notifications on your profile — if a reply finishes generating while you're offline, Kivora taps your shoulder the moment it's done. No more checking back manually.
- **Your data is yours.** One click on your profile exports every conversation as JSON and Markdown. Account deletion was already there; now leaving with your work is easy too.

Also in this release: per-post share cards for the community (paste any post link — it unfurls with its own preview), a sitemap + structured data for search engines, a real product visual on the landing page, and an accessibility pass on the chat stream.

As always — try it, break it, tell us below. We read everything.`,
  },
  {
    title: 'Update 5.23 — streaming that keeps up with the model',
    date: '2026-10-24T08:00:00.000Z',
    body: `This release is about the feel of the product — specifically, the moment you hit send and watch the reply arrive.

- **Smoother streaming, everywhere.** Chat, Research, ReelPen, Study and DevTools now render AI output in cohesive ~33Hz frames instead of raw token-by-token updates. Fast models used to outrun the renderer — long replies visibly stuttered and froze as they grew. That's gone: text now lands as evenly and continuously as the model thinks, no matter how long the response gets.
- **Recovery without echoes.** Fixed a bug where a reply restored after a flaky connection could come back with duplicated chunks, and stop-button tails now always land instead of vanishing mid-sentence.
- **Link previews, fully healed.** Social platforms cache previews aggressively — some were still pointing at an old image URL that no longer existed (the infamous grey placeholder). Every preview URL the site ever published now resolves, so shares show the right card on every platform regardless of when they were cached.
- **Cleaner conversation list.** The stray delete icon that latched onto whichever conversation you last tapped is gone. Pin, rename, share and delete all still live in the long-press menu where they belong.

Stream a long reply and watch how it moves — that's the release. Feedback welcome below.`,
  },
]

// ── Identity cache (per isolate) ──
let _officialId = null
let _officialIdFailedAt = 0
let _lastEnsureRun = 0
let _lastIdentityError = ''
const ENSURE_INTERVAL_MS = 10 * 60 * 1000 // at most once per 10 min per isolate

function officialPassword() {
  // Random per-creation password — nobody logs into this account; identity
  // is server-side only. crypto.randomUUID exists in the CF Workers runtime.
  return `kiv_${crypto.randomUUID().replace(/-/g, '')}A1!`
}

// Best-effort official user id — null when unavailable (never throws).
// Primary: Admin API createUser (sets email_confirm directly). Fallback:
// public /auth/v1/signup — with email confirmation ON the session is not
// returned, but the auth.users row IS created (unconfirmed), and the
// on_auth_user_created trigger inserts the profile — which is all the
// forum_posts FK chain needs. Nobody ever logs into this account.
export async function getOfficialId(admin, verbose = false) {
  if (_officialId) return _officialId
  if (Date.now() - _officialIdFailedAt < 5 * 60 * 1000) return null // cool down after failures
  try {
    const db = admin || getSupabaseAdmin()
    if (!db) throw new Error('no admin client')
    // profiles.email is where the trigger stores the signup email
    const { data, error: selErr } = await db.from('profiles').select('id').eq('email', OFFICIAL_EMAIL).limit(1).maybeSingle()
    if (selErr) throw new Error(`profiles lookup: ${selErr.message}`)
    if (data?.id) {
      _officialId = data.id
      return _officialId
    }
    // Create the real auth user — the handle_new_user trigger inserts the
    // profile row, so the FK chain forum_posts → profiles → auth.users holds.
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email: OFFICIAL_EMAIL,
      password: officialPassword(),
      email_confirm: true,
      user_metadata: { full_name: OFFICIAL_NAME },
    }).catch(e => ({ error: e }))
    if (created?.user?.id) {
      _officialId = created.user.id
      console.log(`[kivora-official] created official account (admin api) ${_officialId}`)
      return _officialId
    }
    if (verbose && createErr) console.warn(`[kivora-official] admin createUser failed: ${String(createErr.message || createErr).slice(0, 160)}`)
    // Fallback: public signup (row lands unconfirmed — fine for our needs)
    const restUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || await getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || '').replace(/\/$/, '')
    if (!restUrl) throw new Error(`createUser failed (${String(createErr?.message || 'unknown').slice(0, 80)}) and no SUPABASE_URL for signup fallback`)
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || ''
    const signupRes = await fetch(`${restUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ email: OFFICIAL_EMAIL, password: officialPassword(), data: { full_name: OFFICIAL_NAME } }),
      signal: AbortSignal.timeout(10000),
    })
    const signupJson = await signupRes.json().catch(() => null)
    const newId = signupJson?.user?.id || (signupJson?.id || null)
    if (!signupRes.ok || !newId) {
      // Dead-end healing: "User already registered" from BOTH paths means the
      // account exists but profiles.email lookup missed it (trigger never
      // fired, or profile row predates the email column). Recover the id via
      // the Admin users list instead of failing forever.
      const combined = `${String(createErr?.message || '')} ${String(JSON.stringify(signupJson || {}))}`
      if (/already registered|already exists|been taken/i.test(combined)) {
        let listId = null
        let listErr = ''
        try {
          const { data: listed, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
          if (error) listErr = error.message
          const hit = (listed?.users || []).find(u => String(u.email || '').toLowerCase() === OFFICIAL_EMAIL)
          if (hit?.id) {
            // Heal the profile row if the trigger never created one
            const { error: healErr } = await db.from('profiles').upsert(
              { id: hit.id, email: OFFICIAL_EMAIL },
              { onConflict: 'id' }
            )
            if (!healErr || /duplicate|exists/i.test(String(healErr.message || ''))) {
              listId = hit.id
              console.log(`[kivora-official] recovered existing official account ${listId}`)
            } else if (verbose) {
              listErr = `profile heal: ${healErr.message}`
            }
          }
        } catch (e) {
          listErr = String(e?.message || e)
        }
        if (listId) {
          _officialId = listId
          return listId
        }
        throw new Error(`already-registered but unrecoverable (listUsers: ${String(listErr).slice(0, 100)})`)
      }
      throw new Error(`signup fallback HTTP ${signupRes.status}: ${String(JSON.stringify(signupJson)).slice(0, 120)}`)
    }
    // Trigger should have created the profile — verify (brief retry for the
    // async trigger)
    let profileId = null
    for (let i = 0; i < 3 && !profileId; i++) {
      await new Promise(r => setTimeout(r, 400))
      const { data: p } = await db.from('profiles').select('id').eq('id', newId).limit(1).maybeSingle()
      profileId = p?.id || null
    }
    if (!profileId) {
      // Trigger didn't fire (e.g. trigger missing) — insert the profile row
      // directly. Service role bypasses RLS; the FK to auth.users is satisfied.
      const { error: insErr } = await db.from('profiles').insert({ id: newId, email: OFFICIAL_EMAIL })
      if (insErr && !/duplicate|exists/i.test(String(insErr.message))) {
        throw new Error(`profile insert: ${insErr.message}`)
      }
    }
    _officialId = newId
    console.log(`[kivora-official] created official account (signup) ${newId}`)
    return newId
  } catch (err) {
    _officialIdFailedAt = Date.now()
    console.warn('[kivora-official] identity unavailable:', String(err?.message || err).slice(0, 160))
    if (verbose) _lastIdentityError = String(err?.message || err).slice(0, 200)
    return null
  }
}

// Make sure every announcement in the catalog exists on the feed. Runs at
// most once per ENSURE_INTERVAL_MS per isolate; individual insert failures
// skip that announcement until the next cycle. `opts.force` bypasses the
// throttle (debug param only); `opts.verbose` returns a full result object.
export async function ensureOfficialPosts(admin, opts = {}) {
  const db = admin || getSupabaseAdmin()
  const verbose = !!opts.verbose
  const result = { ok: false, officialId: null, posted: 0, existing: 0, skipped: [], identityError: '' }
  if (!db) { if (verbose) result.identityError = 'no admin client'; return result }
  const now = Date.now()
  if (!opts.force && now - _lastEnsureRun < ENSURE_INTERVAL_MS) {
    result.ok = true
    result.throttled = true
    return result
  }
  _lastEnsureRun = now

  try {
    const officialId = await getOfficialId(db, verbose)
    result.officialId = officialId
    result.identityError = _lastIdentityError
    if (!officialId) return result

    // Titles already posted by the official account (one query)
    const { data: existing, error: selErr } = await db
      .from('forum_posts')
      .select('id, title')
      .eq('user_id', officialId)
    if (selErr) throw selErr
    const existingTitles = new Set((existing || []).map(p => p.title))
    result.existing = (existing || []).length

    let posted = 0
    for (const ann of ANNOUNCEMENTS) {
      if (existingTitles.has(ann.title)) continue
      const { error } = await db.from('forum_posts').insert({
        user_id: officialId,
        title: ann.title,
        body: ann.body,
        author_name: OFFICIAL_NAME,
        created_at: ann.date,
      })
      if (error) {
        const msg = String(error.message || error).slice(0, 160)
        console.warn(`[kivora-official] post "${ann.title}" skipped: ${msg}`)
        if (verbose) result.skipped.push({ title: ann.title, error: msg })
        continue
      }
      posted += 1
    }
    if (posted > 0) console.log(`[kivora-official] ${posted} announcement(s) published`)
    result.posted = posted
    result.ok = true
    return result
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 200)
    console.warn('[kivora-official] ensure failed:', msg)
    if (verbose) { result.error = msg; result.identityError = result.identityError || msg }
    return result
  }
}
