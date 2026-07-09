import './globals.css'
import Script from 'next/script'
import { Inter, JetBrains_Mono } from 'next/font/google'
import Navbar from '@/components/Navbar'
import NavbarErrorBoundary from '@/components/NavbarErrorBoundary'
import ProvidersErrorBoundary from '@/components/ProvidersErrorBoundary'
import Footer from '@/components/Footer'
import PageContent from '@/components/PageContent'
import { CurrencyProvider } from '@/components/CurrencyToggle'
import { LanguageProvider } from '@/components/LanguageProvider'

// ── Font optimization via next/font ──
// Using next/font instead of @import url() in globals.css to:
// 1. Eliminate render-blocking external CSS request
// 2. Guarantee identical font CSS on server & client (fixes hydration mismatch)
// 3. Automatic font-display: swap + preloading
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

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

// suppressHydrationWarning on <html> prevents React 19 from crashing
// when browser extensions, user preferences, or CSS-only animations
// (like the .grain overlay) cause minor attribute/text differences
// between server and client HTML. Recommended fix per Next.js docs.
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} grain bg-[#0a0a0a] text-white antialiased`}>
        <ProvidersErrorBoundary>
          <LanguageProvider>
            <CurrencyProvider>
              {/* App shell: full viewport, sidebar + content side by side */}
              <div className="h-dvh flex flex-col lg:flex-row overflow-hidden">
                <NavbarErrorBoundary>
                  <Navbar />
                </NavbarErrorBoundary>
                <PageContent>
                  {children}
                  <Footer />
                </PageContent>
              </div>
            </CurrencyProvider>
          </LanguageProvider>
        </ProvidersErrorBoundary>
        {/* Service worker registration — using next/script (strategy=afterInteractive)
            to avoid inline dangerouslySetInnerHTML hydration mismatches under React 19. */}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            });
          }
        `}</Script>
        {/* Transient error #300 suppressor for @cloudflare/next-on-pages + React 19.
            The deprecated adapter sometimes produces raw RSC objects during client-side
            navigation that React can't render. This patches console.error to downgrade
            the known transient #300 errors from error to debug level, reducing noise
            while the ProvidersErrorBoundary auto-retries and recovers. */}
        <Script id="suppress-transient-300" strategy="afterInteractive">{`
          (function() {
            var origError = console.error;
            var suppressUntil = 0;
            var navStart = Date.now();

            // Track navigation timing
            var origPushState = history.pushState;
            var origReplaceState = history.replaceState;
            history.pushState = function() { navStart = Date.now(); return origPushState.apply(this, arguments); };
            history.replaceState = function() { navStart = Date.now(); return origReplaceState.apply(this, arguments); };

            // Also track popstate (back/forward)
            window.addEventListener('popstate', function() { navStart = Date.now(); });

            console.error = function() {
              var msg = Array.prototype.slice.call(arguments).join(' ');
              var isTransient300 = msg.indexOf('Objects are not valid as a React child') !== -1
                || msg.indexOf('#300') !== -1;
              var isDuringNav = (Date.now() - navStart) < 3000;

              if (isTransient300 && isDuringNav) {
                // Downgrade to debug during navigation — the error boundary handles recovery
                if (console.debug) console.debug('[suppressed transient #300]', msg);
                return;
              }
              return origError.apply(console, arguments);
            };
          })();
        `}</Script>
      </body>
    </html>
  )
}
