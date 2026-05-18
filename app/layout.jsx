import './globals.css'
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
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: '/manifest.webmanifest',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#dc2626" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="grain bg-[#0a0a0a] text-white antialiased">
        <LanguageProvider>
          <CurrencyProvider>
            {/* App shell: full viewport, sidebar + content side by side */}
            <div className="h-dvh flex overflow-hidden">
              <Navbar />
              <PageContent>
                {children}
                <Footer />
              </PageContent>
            </div>
          </CurrencyProvider>
        </LanguageProvider>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            });
          }
        `}} />
      </body>
    </html>
  )
}
