// Kivora Browser — deep-link entry (v5.24.7)
// The browser is a global DevTools-style drawer mounted in the root layout;
// this route simply opens the drawer and returns the user to the app.
import BrowserLauncher from '@/components/browser/BrowserLauncher'

export const metadata = {
  title: 'Kivora Browser',
  description: 'Browse the whole web inside Kivora — tabs, reader mode, bookmarks, night filter, desktop UA. Fast, private, in-app.',
}

export default function BrowserPage() {
  return <BrowserLauncher />
}
