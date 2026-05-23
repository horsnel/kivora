'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { IconMenu, IconClose, IconDashboard, IconUser, IconLogout, IconChevronDown, IconCheck, IconSearch, IconChat, IconBook, IconCode, IconTrending, IconGlobe, IconWrite } from '@/components/Icons'
import { supabasePublic } from '@/lib/supabase'
import { useCurrency } from '@/components/CurrencyToggle'

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

// Pages that manage their own layout — no shared navbar
const NO_NAVBAR = ['/auth', '/chat']

// Pages where the navbar is minimal (transparent, no nav links)
const MINIMAL_ROUTES = ['/welcome', '/onboarding']

// Pages where the navbar scrolls with the page (not fixed overlay)
const SCROLL_ROUTES = ['/welcome']

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [user, setUser] = useState(null)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const pathname = usePathname()
  const currencyDropdownRef = useRef(null)

  const isMinimal = MINIMAL_ROUTES.some(r => pathname.startsWith(r))
  const isScrollable = SCROLL_ROUTES.some(r => pathname.startsWith(r))
  const hideNavbar = NO_NAVBAR.some(p => pathname.startsWith(p))

  // Auth state
  useEffect(() => {
    if (!supabasePublic) return
    supabasePublic.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabasePublic.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // Scrolling now happens inside the app shell's scroll container, not the window
    const scrollEl = document.getElementById('app-scroll-container')
    const fn = () => setScrolled((scrollEl?.scrollTop || window.scrollY) > 10)
    if (scrollEl) {
      scrollEl.addEventListener('scroll', fn)
      return () => scrollEl.removeEventListener('scroll', fn)
    } else {
      window.addEventListener('scroll', fn)
      return () => window.removeEventListener('scroll', fn)
    }
  }, [])

  useEffect(() => setOpen(false), [pathname])

  // Close currency dropdown on click outside
  useEffect(() => {
    if (!currencyOpen) return
    function handleClick(e) {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target)) {
        setCurrencyOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [currencyOpen])

  // Close currency dropdown on route change
  useEffect(() => setCurrencyOpen(false), [pathname])

  const router = useRouter()

  async function signOut() {
    if (!supabasePublic) return
    await supabasePublic.auth.signOut()
    router.push('/auth')
  }

  // Auth pages manage their own header — render nothing
  if (hideNavbar) return null

  // Minimal navbar for onboarding/welcome — just logo + currency toggle
  if (isMinimal) {
    return (
      <nav className={`${isScrollable ? 'relative' : 'fixed top-0 left-0 right-0 z-50'} bg-transparent`}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
          <Link href="/welcome" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-headline-sm tracking-tight">
              Ki<span className="text-red-500">vora</span>
            </span>
          </Link>

          {/* Inline currency toggle for welcome page */}
          {isScrollable && <InlineCurrencyToggle
            open={currencyOpen}
            setOpen={setCurrencyOpen}
            dropdownRef={currencyDropdownRef}
          />}
        </div>
      </nav>
    )
  }

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      open
        ? 'bg-[#0a0a0a]'
        : scrolled
          ? 'bg-[#0a0a0a]/96 backdrop-blur-md'
          : 'bg-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white" />
            </svg>
          </div>
          <span className="font-bold text-headline-sm tracking-tight">
            Ki<span className="text-red-500">vora</span>
          </span>
        </Link>

        {/* Desktop nav — main tools */}
        <div className="hidden md:flex items-center gap-0.5">
          <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body transition-colors font-medium text-[#737373] hover:text-white hover:bg-[#141414]"><IconSearch size={14} />Explore</Link>
          <Link href="/chat" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body transition-colors font-medium text-[#737373] hover:text-white hover:bg-[#141414]"><IconChat size={14} />Chat</Link>
          <Link href="/study" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body transition-colors font-medium text-[#737373] hover:text-white hover:bg-[#141414]"><IconBook size={14} />StudyDesk</Link>
          <Link href="/devtools" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body transition-colors font-medium text-[#737373] hover:text-white hover:bg-[#141414]"><IconCode size={14} />Dev Tools</Link>
          <Link href="/opportunities" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body transition-colors font-medium text-[#737373] hover:text-white hover:bg-[#141414]"><IconTrending size={14} />Opportunities</Link>

          {/* Divider */}
          <div className="w-px h-4 bg-[#262626] mx-1" />

          <Link href="/about" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body transition-colors font-medium text-[#737373] hover:text-white hover:bg-[#141414]"><IconGlobe size={14} />About</Link>
          <Link href="/blog" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body transition-colors font-medium text-[#737373] hover:text-white hover:bg-[#141414]"><IconWrite size={14} />Blog</Link>
        </div>

        {/* Right side — auth aware */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body transition-colors font-medium ${
              pathname === '/dashboard'
                ? 'bg-[#1a1a1a] text-white'
                : 'text-[#737373] hover:text-white hover:bg-[#141414]'
            }`}
          >
            <IconDashboard size={14} />
            Dashboard
          </Link>
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1a1a]">
                <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                  {initials}
                </div>
                <span className="text-caption text-[#d4d4d4] font-medium max-w-[100px] truncate">{displayName}</span>
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-1 text-[#525252] hover:text-red-400 px-2 py-1 rounded-lg text-caption transition-colors"
                title="Sign out"
              >
                <IconLogout size={14} />
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-body px-3.5 py-1.5 rounded-lg transition-colors font-semibold"
            >
              <IconUser size={14} />
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden w-8 h-8 flex items-center justify-center text-[#737373] hover:text-white transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <IconClose size={14} /> : <IconMenu size={14} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#0a0a0a] px-4 py-3 space-y-0.5 animate-slide-down">
          <Link href="/" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-body font-medium transition-colors text-[#737373] hover:text-white"><IconSearch size={16} />Explore</Link>
          <Link href="/chat" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-body font-medium transition-colors text-[#737373] hover:text-white"><IconChat size={16} />Chat</Link>
          <Link href="/study" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-body font-medium transition-colors text-[#737373] hover:text-white"><IconBook size={16} />StudyDesk</Link>
          <Link href="/devtools" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-body font-medium transition-colors text-[#737373] hover:text-white"><IconCode size={16} />Dev Tools</Link>
          <Link href="/opportunities" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-body font-medium transition-colors text-[#737373] hover:text-white"><IconTrending size={16} />Opportunities</Link>
          <Link href="/about" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-body font-medium transition-colors text-[#737373] hover:text-white"><IconGlobe size={16} />About</Link>
          <Link href="/blog" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-body font-medium transition-colors text-[#737373] hover:text-white"><IconWrite size={16} />Blog</Link>
          <div className="pt-2 border-t border-[#141414] mt-2 space-y-1.5">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2.5 text-body text-[#737373] hover:text-white rounded-lg font-medium"
            >
              <IconDashboard size={14} /> Dashboard
            </Link>
            {user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-caption text-white font-medium truncate">{displayName}</p>
                    <p className="text-caption text-[#525252] truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 px-3 py-2.5 text-body text-[#737373] hover:text-red-400 rounded-lg font-medium w-full"
                >
                  <IconLogout size={14} /> Sign out
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-red-600 text-white text-body rounded-lg font-semibold"
              >
                <IconUser size={14} /> Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

/** Inline currency toggle used in the minimal navbar on scrollable pages like /welcome */
function InlineCurrencyToggle({ open, setOpen, dropdownRef }) {
  const { currency, selectCurrency, currencies } = useCurrency()

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 sm:gap-1.5 bg-[#141414]/60 border border-[#262626] hover:border-[#3a3a3a] px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-caption text-[#737373] hover:text-white transition-all font-mono"
      >
        <span className="font-sans text-caption font-medium">{currency.symbol}</span>
        <span>{currency.code}</span>
        <IconChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#141414] border border-[#262626] rounded-xl overflow-hidden shadow-2xl animate-scale-in z-50">
          <div className="py-1">
            {currencies.map(c => (
              <button
                key={c.code}
                onClick={() => { selectCurrency(c); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-caption hover:bg-[#1a1a1a] transition-colors ${
                  currency.code === c.code ? 'text-red-400' : 'text-[#737373] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono w-8">{c.code}</span>
                  <span className="text-[#404040]">{c.symbol}</span>
                </div>
                {currency.code === c.code && <IconCheck size={12} className="text-red-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
