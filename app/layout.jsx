import './globals.css'
import Script from 'next/script'
import { getEnvVar } from '@/lib/cfEnv'
import { Inter, JetBrains_Mono } from 'next/font/google'
import Navbar from '@/components/Navbar'
import NavbarErrorBoundary from '@/components/NavbarErrorBoundary'
import ProvidersErrorBoundary from '@/components/ProvidersErrorBoundary'
import Footer from '@/components/Footer'
import PageContent from '@/components/PageContent'
import { CurrencyProvider } from '@/components/CurrencyToggle'
import { LanguageProvider } from '@/components/LanguageProvider'
import TourGuide from '@/components/TourGuide'

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
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
  // NOTE: no external font preconnects — fonts are self-hosted via
  // next/font (Inter + JetBrains Mono), so no Google Fonts requests exist.
}

// Viewport / theme-color — exported separately per Next.js 15 convention
export const viewport = {
  themeColor: '#dc2626',
}

// ── Runtime env bootstrap for the browser ──
// NEXT_PUBLIC_* vars are INLINED at build time. Direct-upload deploys to
// Cloudflare Pages can be built without them, which left supabasePublic
// permanently null in the browser. The GitHub Actions deploy workflow now
// exports the CF project env (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are stored
// as plain_text — they are public-by-design) so builds always inline them.
// This bootstrap script additionally injects the two PUBLIC values from the
// server env at render time, so even an env-less build serves a working
// client. lib/supabase.js reads window.__KIVORA_ENV__ before falling back
// to build-time values. Both values are public (anon key), so embedding
// them in the served HTML is safe.
// NOTE: no `force-dynamic` here — pages stay statically prerendered, which
// is what next-on-pages expects (dynamic routes would each need
// `export const runtime = 'edge'`).
export default async function RootLayout({ children }) {
  const bootUrl = (await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')) || (await getEnvVar('SUPABASE_URL')) || ''
  const bootKey = (await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')) || (await getEnvVar('SUPABASE_ANON_KEY')) || ''
  const bootPayload = JSON.stringify({ url: bootUrl, key: bootKey }).replace(/</g, '\\u003c')

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} grain bg-[#0a0a0a] text-white antialiased`}>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: `window.__KIVORA_ENV__=${bootPayload}` }}
        />
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
            {/* Guided tour — inside LanguageProvider so it can translate; auto-starts for new users on /dashboard, replayable from the sidebar */}
            <TourGuide />
          </LanguageProvider>
        </ProvidersErrorBoundary>
        {/* Service worker registration — external /sw-register.js (next/script,
            strategy=afterInteractive). Kept as an external file so the
            hash-based CSP on prerendered pages can allow it via script-src 'self'
            (runtime-injected INLINE scripts would be blocked without a nonce). */}
        <Script id="sw-register" src="/sw-register.js" strategy="afterInteractive" />
        {/* Transient error #300 suppressor — external /suppress-300.js (same CSP
            rationale as above). Patches console.error to downgrade the known
            transient #300 errors during client-side navigation. */}
        <Script id="suppress-transient-300" src="/suppress-300.js" strategy="afterInteractive" />
        {/* (transient #300 suppressor moved to /suppress-300.js — see above) */}
      </body>
    </html>
  )
}
