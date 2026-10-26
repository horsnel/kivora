// Kivora Browser — full in-web browser (v5.24.6)
// Server wrapper: metadata for the prerendered page; the entire browser
// chrome lives in <BrowserApp /> (client, fixed full-screen overlay).
import BrowserApp from '@/components/BrowserApp'

export const metadata = {
  title: 'Kivora Browser',
  description: 'Browse the whole web inside Kivora — tabs, reader mode, bookmarks, night filter, desktop UA. Fast, private, in-app.',
}

export default function BrowserPage() {
  return <BrowserApp />
}
