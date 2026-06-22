'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'

// Pages that manage their own layout — no shared footer
const NO_FOOTER = ['/chat', '/auth', '/onboarding', '/', '/research']

const FOOTER_LINKS = [
  { labelKey: 'footer.research',       href: '/research' },
  { labelKey: 'footer.explore',       href: '/explore' },
  { labelKey: 'footer.chat',          href: '/chat' },
  { labelKey: 'footer.studydesk',     href: '/study' },
  { labelKey: 'footer.devtools',      href: '/devtools' },
  { labelKey: 'footer.opportunities', href: '/opportunities' },
  { label: 'Tools & Features',        href: '/tools' },
  { label: 'Pricing',                 href: '/pricing' },
  { labelKey: 'footer.about',         href: '/about' },
  { labelKey: 'footer.blog',          href: '/blog' },
  { labelKey: 'footer.contact',       href: '/contact' },
  { labelKey: 'footer.privacy',       href: '/privacy' },
  { labelKey: 'footer.terms',         href: '/terms' },
]

export default function Footer() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const [clickCount, setClickCount] = useState(0)
  const clickTimer = useRef(null)

  if (pathname === '/' || ['/chat', '/auth', '/onboarding', '/research'].some(p => pathname.startsWith(p))) return null

  // Double-click handler for hidden admin access
  function handleOlhmesClick() {
    if (clickTimer.current) clearTimeout(clickTimer.current)
    const newCount = clickCount + 1
    setClickCount(newCount)
    if (newCount >= 2) {
      setClickCount(0)
      router.push('/admin')
    } else {
      clickTimer.current = setTimeout(() => setClickCount(0), 400)
    }
  }

  // Cleanup timer on unmount
  useEffect(() => () => clickTimer.current && clearTimeout(clickTimer.current), [])

  return (
    <footer className="border-t border-[#141414] mt-12 sm:mt-16 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-5 h-5 bg-[#dc2626] rounded-md flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 32 32" fill="none">
              <path d="M16 4L6 24L16 18Z" fill="white" opacity="0.95" />
              <path d="M16 4L26 24L16 18Z" fill="white" opacity="0.55" />
              <rect x="6" y="26" width="20" height="3" rx="1.5" fill="white" opacity="0.3" />
            </svg>
          </div>
          <span className="font-bold text-caption group-hover:text-white transition-colors">
            Ki<span className="text-red-500">vora</span>
          </span>
        </Link>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-caption text-[#737373]">
          {FOOTER_LINKS.map(({ labelKey, label, href }) => (
            <Link key={href} href={href} className="hover:text-white transition-colors">
              {label || t(labelKey)}
            </Link>
          ))}
          {/* X (Twitter) profile link */}
          <a
            href="https://x.com/menshlyglobal"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors inline-flex items-center gap-1"
            aria-label="Follow us on X"
            title="Follow us on X"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="inline-block">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            X
          </a>
        </div>

        <p className="text-caption text-[#2e2e2e] whitespace-nowrap select-none">
          © {new Date().getFullYear()} Kivora · product of{' '}
          <span
            onClick={handleOlhmesClick}
            className="font-black text-[#2e2e2e] hover:text-[#525252] transition-colors cursor-default select-none"
            title=""
            role="button"
            tabIndex={-1}
            aria-hidden="true"
          >
            O.L.H.M.E.S
          </span>
        </p>
      </div>
    </footer>
  )
}
