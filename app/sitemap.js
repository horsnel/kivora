export default function sitemap() {
  const BASE = 'https://kivora.pages.dev'

  const staticRoutes = [
    '', '/about', '/blog', '/chat', '/contact',
    '/devtools', '/opportunities', '/privacy',
    '/study', '/terms', '/welcome',
  ]

  return staticRoutes.map(route => ({
    url: `${BASE}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1.0 : route === '/about' ? 0.8 : 0.6,
  }))
}
