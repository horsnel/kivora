// v5.22 — dynamic sitemap: static public routes + community posts.
// Post URLs keep lastModified from each post's created_at so scrapers see
// honest freshness; new announcements appear here automatically.
import { getSupabaseAdmin } from '@/lib/supabase'

const BASE = 'https://kivora.pages.dev'

const STATIC_ROUTES = [
  { path: '', priority: 1.0, changeFreq: 'daily' },
  { path: '/explore', priority: 0.9, changeFreq: 'daily' },
  { path: '/chat', priority: 0.9, changeFreq: 'weekly' },
  { path: '/community', priority: 0.8, changeFreq: 'hourly' },
  { path: '/blog', priority: 0.7, changeFreq: 'weekly' },
  { path: '/study', priority: 0.7, changeFreq: 'weekly' },
  { path: '/devtools', priority: 0.7, changeFreq: 'weekly' },
  { path: '/opportunities', priority: 0.8, changeFreq: 'daily' },
  { path: '/reelpen', priority: 0.6, changeFreq: 'weekly' },
  { path: '/colab', priority: 0.6, changeFreq: 'weekly' },
  { path: '/tools', priority: 0.6, changeFreq: 'weekly' },
  { path: '/3d', priority: 0.6, changeFreq: 'weekly' },
  { path: '/research', priority: 0.7, changeFreq: 'weekly' },
  { path: '/pricing', priority: 0.6, changeFreq: 'monthly' },
  { path: '/about', priority: 0.4, changeFreq: 'monthly' },
  { path: '/contact', priority: 0.4, changeFreq: 'monthly' },
  { path: '/privacy', priority: 0.3, changeFreq: 'yearly' },
  { path: '/terms', priority: 0.3, changeFreq: 'yearly' },
]

export default async function sitemap() {
  const now = new Date()
  const entries = STATIC_ROUTES.map(({ path, priority, changeFreq }) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: changeFreq,
    priority,
  }))

  try {
    const admin = getSupabaseAdmin()
    if (admin) {
      const { data: posts } = await admin
        .from('forum_posts')
        .select('id, created_at')
        .order('created_at', { ascending: false })
        .limit(500)
      for (const p of posts || []) {
        entries.push({
          url: `${BASE}/community/post/${p.id}`,
          lastModified: p.created_at ? new Date(p.created_at) : now,
          changeFrequency: 'weekly',
          priority: 0.5,
        })
      }
    }
  } catch {
    // Sitemap stays static-only when the DB is unreachable — never throws.
  }

  return entries
}
