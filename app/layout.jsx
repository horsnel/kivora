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
  // Preconnect hints moved here from manual <head> to avoid hydration
  // mismatches under Next.js 15 + React 19 (manual <head> children
  // conflict with Next.js's managed <head>).
  other: {
    'preconnect:fonts-google': 'https://fonts.googleapis.com',
    'preconnect:fonts-gstatic': 'https://fonts.gstatic.com',
  },
}

// Viewport / theme-color — exported separately per Next.js 15 convention
export const viewport = {
  themeColor: '#dc2626',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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
