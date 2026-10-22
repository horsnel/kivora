import { getSupabaseAdmin } from '@/lib/supabase'

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
]

// ── Identity cache (per isolate) ──
let _officialId = null
let _officialIdFailedAt = 0
let _lastEnsureRun = 0
const ENSURE_INTERVAL_MS = 10 * 60 * 1000 // at most once per 10 min per isolate

function officialPassword() {
  // Random per-creation password — nobody logs into this account; identity
  // is server-side only. crypto.randomUUID exists in the CF Workers runtime.
  return `kiv_${crypto.randomUUID().replace(/-/g, '')}A1!`
}

// Best-effort official user id — null when unavailable (never throws).
// Two rounds of fallback favicon-style lookups keep this cheap.
export async function getOfficialId(admin) {
  if (_officialId) return _officialId
  if (Date.now() - _officialIdFailedAt < 5 * 60 * 1000) return null // cool down after failures
  try {
    const db = admin || getSupabaseAdmin()
    if (!db) return null
    // profiles.email is where the trigger stores the signup email
    const { data } = await db.from('profiles').select('id').eq('email', OFFICIAL_EMAIL).limit(1).maybeSingle()
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
    })
    if (createErr || !created?.user?.id) throw new Error(createErr?.message || 'createUser returned no user')
    _officialId = created.user.id
    console.log(`[kivora-official] created official account ${_officialId}`)
    return _officialId
  } catch (err) {
    _officialIdFailedAt = Date.now()
    console.warn('[kivora-official] identity unavailable:', String(err?.message || err).slice(0, 140))
    return null
  }
}

// Make sure every announcement in the catalog exists on the feed. Runs at
// most once per ENSURE_INTERVAL_MS per isolate; individual insert failures
// skip that announcement until the next cycle.
export async function ensureOfficialPosts(admin) {
  const db = admin || getSupabaseAdmin()
  if (!db) return
  const now = Date.now()
  if (now - _lastEnsureRun < ENSURE_INTERVAL_MS) return
  _lastEnsureRun = now

  try {
    const officialId = await getOfficialId(db)
    if (!officialId) return

    // Titles already posted by the official account (one query)
    const { data: existing, error: selErr } = await db
      .from('forum_posts')
      .select('id, title')
      .eq('user_id', officialId)
    if (selErr) throw selErr
    const existingTitles = new Set((existing || []).map(p => p.title))

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
        console.warn(`[kivora-official] post "${ann.title}" skipped: ${String(error.message || error).slice(0, 120)}`)
        continue
      }
      posted += 1
    }
    if (posted > 0) console.log(`[kivora-official] ${posted} announcement(s) published`)
  } catch (err) {
    console.warn('[kivora-official] ensure failed:', String(err?.message || err).slice(0, 140))
  }
}
