import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { CurrencyProvider } from '@/components/CurrencyToggle'

export const metadata = {
  title: {
    default: 'Kivora — Intelligence for builders everywhere',
    template: '%s — Kivora',
  },
  description: 'Tools, opportunities, and honest guides for builders worldwide. AI chat, dev tools, study desk, and income opportunities — all free.',
  keywords: 'AI tools, make money online, automation, dev tools, study help, opportunities, Africa, global',
  openGraph: {
    title: 'Kivora — Intelligence for builders everywhere',
    description: 'Tools, opportunities, and honest guides for builders worldwide.',
    type: 'website',
    siteName: 'Kivora',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kivora — Intelligence for builders everywhere',
    description: 'Tools, opportunities, and honest guides for builders worldwide.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="grain bg-[#0a0a0a] text-white min-h-screen antialiased">
        <CurrencyProvider>
          <Navbar />
          <div className="pt-14">
            {children}
          </div>
          <Footer />
        </CurrencyProvider>
      </body>
    </html>
  )
}
