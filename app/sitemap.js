// v5.22 — sitemap: static public routes only, deliberately SYNC/STATIC.
// (An async DB-backed version was tried and broke the @cloudflare/next-on-pages
// deploy adapter — metadata routes must stay prerenderable here. Per-post
// URLs are still discoverable via /robots.txt + the community feed; robots
// points scrapers at this file.)
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

// NOTE: /dashboard, /profile, /welcome and /auth are intentionally excluded —
// they're private or auth-gated, and /dashboard is already Disallowed in
// robots.txt (a sitemap entry there contradicts robots).
export default function sitemap() {
  const now = new Date()
  return STATIC_ROUTES.map(({ path, priority, changeFreq }) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: changeFreq,
    priority,
  }))
}
