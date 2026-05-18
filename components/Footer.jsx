'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'

// Pages that manage their own layout — no shared footer
const NO_FOOTER = ['/chat', '/auth', '/onboarding', '/']

const FOOTER_LINKS = [
  { labelKey: 'footer.home',          href: '/discover' },
  { labelKey: 'footer.explore',       href: '/home' },
  { labelKey: 'footer.chat',          href: '/chat' },
  { labelKey: 'footer.studydesk',     href: '/study' },
  { labelKey: 'footer.devtools',      href: '/devtools' },
  { labelKey: 'footer.opportunities', href: '/opportunities' },
  { labelKey: 'footer.about',         href: '/about' },
  { labelKey: 'footer.blog',          href: '/blog' },
  { labelKey: 'footer.contact',       href: '/contact' },
  { labelKey: 'footer.privacy',       href: '/privacy' },
  { labelKey: 'footer.terms',         href: '/terms' },
]

export default function Footer() {
  const pathname = usePathname()
  const { t } = useTranslation()
  if (pathname === '/' || ['/chat', '/auth', '/onboarding'].some(p => pathname.startsWith(p))) return null

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
          {FOOTER_LINKS.map(({ labelKey, href }) => (
            <Link key={href} href={href} className="hover:text-white transition-colors">
              {t(labelKey)}
            </Link>
          ))}
        </div>

        <p className="text-caption text-[#2e2e2e] whitespace-nowrap">
          © {new Date().getFullYear()} Kivora · product of <Link href="/admin" className="font-black text-[#404040] hover:text-[#737373] transition-colors">O.L.H.M.E.S</Link>
        </p>
      </div>
    </footer>
  )
}
