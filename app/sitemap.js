export default function sitemap() {
  const BASE = 'https://kivora.pages.dev'

  const staticRoutes = [
    '', '/about', '/blog', '/chat', '/community', '/contact',
    '/dashboard', '/devtools', '/explore', '/research', '/opportunities',
    '/privacy', '/profile', '/reelpen', '/study', '/terms', '/tools',
    '/3d', '/welcome',
  ]

  return staticRoutes.map(route => ({
    url: `${BASE}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1.0 : route === '/about' ? 0.8 : 0.6,
  }))
}
