'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { IconMenu, IconClose, IconDashboard, IconUser, IconChevronDown, IconCheck, IconSearch, IconChat, IconBook, IconCode, IconTrending, IconGlobe, IconHome, IconVideo, IconEye } from '@/components/Icons'
import { supabasePublic } from '@/lib/supabase'
import { useCurrency } from '@/components/CurrencyToggle'
import { useTranslation } from '@/components/LanguageProvider'

const NAV_LINKS = [
  { labelKey: 'nav.home',         href: '/home',       Icon: IconHome },
  { labelKey: 'nav.explore',      href: '/explore',    Icon: IconSearch },
  { labelKey: 'nav.chat',         href: '/chat',       Icon: IconChat },
  { labelKey: 'nav.studydesk',    href: '/study',      Icon: IconBook },
  { labelKey: 'nav.reelpen',      href: '/reelpen',    Icon: IconVideo },
  { labelKey: 'nav.devtools',     href: '/devtools',   Icon: IconCode },
  { labelKey: 'nav.3dviewer',     href: '/3d',         Icon: IconEye },
  { labelKey: 'nav.community',    href: '/community',  Icon: IconChat },
  { labelKey: 'nav.opportunities', href: '/opportunities', Icon: IconTrending },
]

// About, Blog, Admin links removed from sidebar — About & Blog are in the footer, Admin is via O.L.H.M.E.S in footer

// Pages that manage their own layout — no shared sidebar
const NO_SIDEBAR = ['/auth', '/', '/onboarding', '/chat']

// Pages where the sidebar is hidden (full-width landing pages)
const MINIMAL_ROUTES = []

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const pathname = usePathname()
  const currencyDropdownRef = useRef(null)
  const sidebarRef = useRef(null)

  const isMinimal = MINIMAL_ROUTES.some(r => pathname.startsWith(r))
  const hideSidebar = pathname === '/' || pathname.startsWith('/auth') || pathname.startsWith('/onboarding') || pathname.startsWith('/chat')

  // Auth state
  useEffect(() => {
    if (!supabasePublic) return
    supabasePublic.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabasePublic.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Close mobile sidebar on route change
  useEffect(() => setMobileOpen(false), [pathname])

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

  // Close mobile sidebar on click outside
  useEffect(() => {
    if (!mobileOpen) return
    function handleClick(e) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [mobileOpen])

  // Auth pages manage their own layout — render nothing
  if (hideSidebar) return null

  // Minimal pages (welcome, onboarding) — fixed top bar so it doesn't conflict with the row flex parent
  if (isMinimal) {
    return (
      <>
        {/* Fixed top navigation bar */}
        <nav className="fixed top-0 left-0 right-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#141414]/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 sm:h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                  <path d="M16 4L6 24L16 18Z" fill="white" opacity="0.95" />
                  <path d="M16 4L26 24L16 18Z" fill="white" opacity="0.55" />
                  <rect x="6" y="26" width="20" height="3" rx="1.5" fill="white" opacity="0.3" />
                </svg>
              </div>
              <span className="font-bold text-[15px] tracking-tight">
                Ki<span className="text-red-500">vora</span>
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              <NavLinks pathname={pathname} onClose={() => {}} minimal />
            </div>
          </div>
        </nav>

        {/* Mobile hamburger — top-left, same position as other pages */}
        <button
          className="fixed top-3 left-3 md:hidden z-50 w-9 h-9 flex items-center justify-center bg-[#141414]/90 backdrop-blur-sm border border-[#262626] rounded-lg text-[#737373] hover:text-white transition-colors"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <IconMenu size={14} />
        </button>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
        )}
        <aside
          ref={sidebarRef}
          className={`fixed z-50 md:hidden top-0 left-0 h-full w-60 bg-[#0f0f0f] border-r border-[#181818] flex flex-col transition-transform duration-200 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SidebarContent user={user} pathname={pathname} onClose={() => setMobileOpen(false)} currencyOpen={currencyOpen} setCurrencyOpen={setCurrencyOpen} currencyDropdownRef={currencyDropdownRef} />
        </aside>
      </>
    )
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — full height, always visible on desktop, slide-in on mobile */}
      <aside
        ref={sidebarRef}
        className={`fixed md:relative z-50 md:z-auto top-0 left-0 h-full w-60 bg-[#0f0f0f] border-r border-[#181818] flex flex-col transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <SidebarContent user={user} pathname={pathname} onClose={() => setMobileOpen(false)} currencyOpen={currencyOpen} setCurrencyOpen={setCurrencyOpen} currencyDropdownRef={currencyDropdownRef} />
      </aside>

      {/* Mobile hamburger — top-left, only on small screens */}
      <button
        className="fixed top-3 left-3 md:hidden z-50 w-9 h-9 flex items-center justify-center bg-[#141414]/90 backdrop-blur-sm border border-[#262626] rounded-lg text-[#737373] hover:text-white transition-colors"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <IconMenu size={14} />
      </button>
    </>
  )
}

/** Nav links using translations */
function NavLinks({ pathname, onClose, minimal, user }) {
  const { t } = useTranslation()
  const linkClass = (href) => {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
    if (minimal) {
      return `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-[#1a1a1a] text-white' : 'text-[#737373] hover:text-white hover:bg-[#141414]'
      }`
    }
    return `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-[#1a1a1a] text-white' : 'text-[#737373] hover:text-white hover:bg-[#141414]'
    }`
  }

  return NAV_LINKS.map(({ labelKey, href, Icon }) => {
    // Community link only visible for logged-in users
    if (href === '/community' && !user) return null
    return (
      <Link
        key={href}
        href={href}
        className={linkClass(href)}
        onClick={onClose}
      >
        <Icon size={minimal ? 13 : 14} className={minimal ? '' : 'shrink-0'} />
        {t(labelKey)}
      </Link>
    )
  })
}

/** Shared sidebar content — used by both the main sidebar and the mobile overlay on minimal pages */
function SidebarContent({ user, pathname, onClose, currencyOpen, setCurrencyOpen, currencyDropdownRef }) {
  const { t } = useTranslation()
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const initials = displayName.slice(0, 2).toUpperCase()

  function isActive(href) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* ── Logo + close ── */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <Link href="/home" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                <path d="M16 4L6 24L16 18Z" fill="white" opacity="0.95" />
                <path d="M16 4L26 24L16 18Z" fill="white" opacity="0.55" />
                <rect x="6" y="26" width="20" height="3" rx="1.5" fill="white" opacity="0.3" />
              </svg>
            </div>
            <span className="font-bold text-[15px] tracking-tight">
              Ki<span className="text-red-500">vora</span>
            </span>
          </Link>
          <button
            className="md:hidden w-7 h-7 flex items-center justify-center text-[#737373] hover:text-white transition-colors"
            onClick={onClose}
          >
            <IconClose size={14} />
          </button>
        </div>
      </div>

      {/* ── Nav links ── */}
      <div className="flex-1 overflow-y-auto overscroll-behavior-contain px-2.5 min-h-0">
        <div className="space-y-0.5">
          <NavLinks pathname={pathname} onClose={onClose} user={user} />
        </div>
      </div>

      {/* ── Language switcher + Currency toggle ── */}
      <div className="px-2.5 pb-1.5 shrink-0 space-y-0.5">
        <InlineCurrencyToggle
          open={currencyOpen}
          setOpen={setCurrencyOpen}
          dropdownRef={currencyDropdownRef}
        />
        <InlineLanguageSwitcher />
      </div>

      {/* ── Auth section — pinned to bottom ── */}
      <div className="p-2.5 border-t border-[#181818] space-y-1 shrink-0">
        {user && (
          <Link
            href="/dashboard"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors font-medium ${
              isActive('/dashboard')
                ? 'bg-[#1a1a1a] text-white'
                : 'text-[#737373] hover:text-white hover:bg-[#141414]'
            }`}
            onClick={onClose}
          >
            <IconDashboard size={14} />
            {t('nav.dashboard')}
          </Link>
        )}

        {user ? (
          <Link
            href="/profile"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isActive('/profile')
                ? 'bg-[#1a1a1a]'
                : 'hover:bg-[#141414]'
            }`}
            onClick={onClose}
          >
            <div className="w-6 h-6 bg-[#dc2626] rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white font-medium truncate">{displayName}</p>
              <p className="text-[10px] text-[#737373] truncate">{user.email}</p>
            </div>
          </Link>
        ) : (
          <Link
            href="/auth"
            className="flex items-center justify-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-sm py-2 rounded-lg transition-colors font-semibold"
            onClick={onClose}
          >
            <IconUser size={12} />
            {t('nav.signin')}
          </Link>
        )}
      </div>
    </>
  )
}

/** Inline currency toggle used in the sidebar */
function InlineCurrencyToggle({ open, setOpen, dropdownRef }) {
  const { currency, selectCurrency, currencies } = useCurrency()

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#737373] hover:text-white hover:bg-[#141414] transition-colors font-medium"
      >
        <span className="font-sans text-sm font-medium">{currency.symbol}</span>
        <span>{currency.code}</span>
        <IconChevronDown size={12} className={`ml-auto transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-full bg-[#141414] border border-[#262626] rounded-xl overflow-hidden shadow-2xl animate-scale-in z-50">
          <div className="py-1">
            {currencies.map(c => (
              <button
                key={c.code}
                onClick={() => { selectCurrency(c); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[#1a1a1a] transition-colors ${
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

/** Language switcher for the sidebar */
function InlineLanguageSwitcher() {
  const { lang, setLang, languages } = useTranslation()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const currentLang = languages.find(l => l.code === lang) || languages[0]

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#737373] hover:text-white hover:bg-[#141414] transition-colors font-medium"
      >
        <IconGlobe size={14} className="shrink-0" />
        <span>{currentLang.nativeLabel}</span>
        <IconChevronDown size={12} className={`ml-auto transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-full bg-[#141414] border border-[#262626] rounded-xl overflow-hidden shadow-2xl animate-scale-in z-50">
          <div className="py-1">
            {languages.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[#1a1a1a] transition-colors ${
                  lang === l.code ? 'text-red-400' : 'text-[#737373] hover:text-white'
                }`}
              >
                <span>{l.nativeLabel}</span>
                {lang === l.code && <IconCheck size={12} className="text-red-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
