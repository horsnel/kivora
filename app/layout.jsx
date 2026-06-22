import './globals.css'
import Script from 'next/script'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import PageContent from '@/components/PageContent'
import { CurrencyProvider } from '@/components/CurrencyToggle'
import { LanguageProvider } from '@/components/LanguageProvider'

export const metadata = {
  title: {
    default: 'Kivora | Intelligence for builders everywhere',
    template: '%s | Kivora',
  },
  description: 'Tools, opportunities, and honest guides for builders worldwide. AI chat, dev tools, study desk, and income opportunities, all free.',
  keywords: 'AI tools, make money online, automation, dev tools, study help, opportunities, Africa, global',
  openGraph: {
    title: 'Kivora | Intelligence for builders everywhere',
    description: 'Tools, opportunities, and honest guides for builders worldwide.',
    type: 'website',
    siteName: 'Kivora',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kivora | Intelligence for builders everywhere',
    description: 'Tools, opportunities, and honest guides for builders worldwide.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
}

// Viewport / theme-color — moved here from manual <head> to avoid SSR/hydration
// mismatches under Next.js 15 + React 19 (manual <head> + metadata export is
// an anti-pattern that throws hydration errors in React 19).
export const viewport = {
  themeColor: '#dc2626',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="grain bg-[#0a0a0a] text-white antialiased">
        <LanguageProvider>
          <CurrencyProvider>
            {/* App shell: full viewport, sidebar + content side by side */}
            <div className="h-dvh flex flex-col lg:flex-row overflow-hidden">
              <Navbar />
              <PageContent>
                {children}
                <Footer />
              </PageContent>
            </div>
          </CurrencyProvider>
        </LanguageProvider>
        {/* Service worker registration — using next/script (strategy=afterInteractive)
            to avoid inline dangerouslySetInnerHTML hydration mismatches under React 19. */}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            });
          }
        `}</Script>
      </body>
    </html>
  )
}
