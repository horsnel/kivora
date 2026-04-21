'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { IconMenu, IconClose, IconDashboard, IconUser } from '@/components/Icons'

const NAV_MAIN = [
  { label: 'Explore',       href: '/' },
  { label: 'Chat',          href: '/chat' },
  { label: 'StudyDesk',     href: '/study' },
  { label: 'Dev Tools',     href: '/devtools' },
  { label: 'Opportunities', href: '/opportunities' },
]

const NAV_SECONDARY = [
  { label: 'About',   href: '/about' },
  { label: 'Blog',    href: '/blog' },
]

// Pages where the navbar is minimal (transparent, no nav links)
const MINIMAL_ROUTES = ['/welcome', '/auth', '/onboarding']

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  const isMinimal = MINIMAL_ROUTES.some(r => pathname.startsWith(r))

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => setOpen(false), [pathname])

  // Minimal navbar for auth/onboarding/welcome — just logo
  if (isMinimal) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/welcome" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-[15px] tracking-tight">
              Ki<span className="text-red-500">vora</span>
            </span>
          </Link>
          <Link href="/" className="text-xs text-[#737373] hover:text-white transition-colors">
            Go to app →
          </Link>
        </div>
      </nav>
    )
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-[#0a0a0a]/96 backdrop-blur-md border-b border-[#181818]'
        : 'bg-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white" />
            </svg>
          </div>
          <span className="font-bold text-[15px] tracking-tight">
            Ki<span className="text-red-500">vora</span>
          </span>
        </Link>

        {/* Desktop nav — main tools */}
        <div className="hidden md:flex items-center gap-0.5">
          {NAV_MAIN.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors font-medium ${
                pathname === n.href
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-[#737373] hover:text-white hover:bg-[#141414]'
              }`}
            >
              {n.label}
            </Link>
          ))}

          {/* Divider */}
          <div className="w-px h-4 bg-[#262626] mx-1" />

          {NAV_SECONDARY.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors font-medium ${
                pathname === n.href
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-[#737373] hover:text-white hover:bg-[#141414]'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors font-medium ${
              pathname === '/dashboard'
                ? 'bg-[#1a1a1a] text-white'
                : 'text-[#737373] hover:text-white hover:bg-[#141414]'
            }`}
          >
            <IconDashboard size={13} />
            Dashboard
          </Link>
          <Link
            href="/auth"
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm px-3.5 py-1.5 rounded-lg transition-colors font-semibold"
          >
            <IconUser size={13} />
            Sign in
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden w-8 h-8 flex items-center justify-center text-[#737373] hover:text-white transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <IconClose size={16} /> : <IconMenu size={16} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#0a0a0a] border-t border-[#141414] px-4 py-3 space-y-0.5 animate-slide-down">
          {[...NAV_MAIN, ...NAV_SECONDARY].map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === n.href
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-[#737373] hover:text-white'
              }`}
            >
              {n.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-[#141414] mt-2 space-y-1.5">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-[#737373] hover:text-white rounded-lg font-medium"
            >
              <IconDashboard size={13} /> Dashboard
            </Link>
            <Link
              href="/auth"
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-red-600 text-white text-sm rounded-lg font-semibold"
            >
              <IconUser size={13} /> Sign in
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
