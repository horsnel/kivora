'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Pages that manage their own layout — no shared footer
const NO_FOOTER = ['/chat', '/auth', '/onboarding', '/welcome']

export default function Footer() {
  const pathname = usePathname()
  if (NO_FOOTER.some(p => pathname.startsWith(p))) return null

  return (
    <footer className="border-t border-[#141414] mt-16 py-8">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <Link href="/welcome" className="flex items-center gap-2 group">
          <div className="w-5 h-5 bg-red-600 rounded-md flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white" />
            </svg>
          </div>
          <span className="font-bold text-xs group-hover:text-white transition-colors">
            Ki<span className="text-red-500">vora</span>
          </span>
        </Link>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[#737373]">
          {[
            ['Explore',       '/'],
            ['Chat',          '/chat'],
            ['StudyDesk',     '/study'],
            ['Dev Tools',     '/devtools'],
            ['Opportunities', '/opportunities'],
            ['About',         '/about'],
            ['Blog',          '/blog'],
            ['Contact',       '/contact'],
            ['Privacy',       '/privacy'],
            ['Terms',         '/terms'],
          ].map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-white transition-colors">
              {label}
            </Link>
          ))}
        </div>

        <p className="text-xs text-[#2e2e2e] whitespace-nowrap">
          © {new Date().getFullYear()} Kivora
        </p>
      </div>
    </footer>
  )
}
