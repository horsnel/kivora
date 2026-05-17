'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { IconMenu, IconClose, IconDashboard, IconUser, IconLogout, IconChevronDown, IconCheck, IconSearch, IconChat, IconBook, IconCode, IconTrending, IconGlobe, IconWrite, IconHome } from '@/components/Icons'
import { supabasePublic } from '@/lib/supabase'
import { useCurrency } from '@/components/CurrencyToggle'
import { useTranslation } from '@/components/LanguageProvider'

const NAV_LINKS = [
  { label: 'Home',         href: '/welcome',    Icon: IconHome },
  { label: 'Explore',      href: '/',           Icon: IconSearch },
  { label: 'Chat',         href: '/chat',       Icon: IconChat },
  { label: 'StudyDesk',    href: '/study',      Icon: IconBook },
  { label: 'Dev Tools',    href: '/devtools',   Icon: IconCode },
  { label: 'Community',    href: '/community',  Icon: IconChat },
  { label: 'Opportunities', href: '/opportunities', Icon: IconTrending },
]

const NAV_SECONDARY = [
  { label: 'About',   href: '/about',   Icon: IconGlobe },
  { label: 'Blog',    href: '/blog',    Icon: IconWrite },
  { label: 'Admin',   href: '/admin',   Icon: IconDashboard },
]

// Pages that manage their own layout — no shared sidebar
const NO_SIDEBAR = ['/auth']

// Pages where the sidebar is hidden (full-width landing pages)
const MINIMAL_ROUTES = ['/welcome', '/onboarding']

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const pathname = usePathname()
  const currencyDropdownRef = useRef(null)
  const sidebarRef = useRef(null)

  const isMinimal = MINIMAL_ROUTES.some(r => pathname.startsWith(r))
  const hideSidebar = NO_SIDEBAR.some(p => pathname.startsWith(p))

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

  const router = useRouter()

  async function signOut() {
    if (!supabasePublic) return
    await supabasePublic.auth.signOut()
    router.push('/auth')
  }

  // Auth pages manage their own layout — render nothing
  if (hideSidebar) return null

  // Minimal pages (welcome, onboarding) — fixed top bar so it doesn't conflict with the row flex parent
  if (isMinimal) {
    return (
      <>
        {/* Fixed top navigation bar */}
        <nav className="fixed top-0 left-0 right-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#141414]/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 sm:h-14 flex items-center justify-between">
            <Link href="/welcome" className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white" />
                </svg>
              </div>
              <span className="font-bold text-[15px] tracking-tight">
                Ki<span className="text-red-500">vora</span>
              </span>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(({ label, href, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    (href === '/' ? pathname === '/' : pathname.startsWith(href))
                      ? 'bg-[#1a1a1a] text-white'
                      : 'text-[#737373] hover:text-white hover:bg-[#141414]'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </Link>
              ))}
              <div className="w-px h-4 bg-[#262626] mx-1" />
              <InlineCurrencyToggle
                open={currencyOpen}
                setOpen={setCurrencyOpen}
                dropdownRef={currencyDropdownRef}
              />
            </div>

            {/* Mobile: currency only */}
            <div className="flex items-center gap-2 md:hidden">
              <InlineCurrencyToggle
                open={currencyOpen}
                setOpen={setCurrencyOpen}
                dropdownRef={currencyDropdownRef}
              />
            </div>
          </div>
        </nav>

        {/* Mobile hamburger — top-left, same position as other pages */}
        <button
          className="fixed top-3 left-3 md:hidden z-50 w-9 h-9 flex items-center justify-center bg-[#141414] border border-[#262626] rounded-lg text-[#737373] hover:text-white transition-colors"
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
          <SidebarContent user={user} pathname={pathname} signOut={signOut} onClose={() => setMobileOpen(false)} />
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
        <SidebarContent user={user} pathname={pathname} signOut={signOut} onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Mobile hamburger — top-left, only on small screens */}
      <button
        className="fixed top-3 left-3 md:hidden z-30 w-9 h-9 flex items-center justify-center bg-[#141414] border border-[#262626] rounded-lg text-[#737373] hover:text-white transition-colors"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <IconMenu size={14} />
      </button>
    </>
  )
}

/** Shared sidebar content — used by both the main sidebar and the mobile overlay on minimal pages */
function SidebarContent({ user, pathname, signOut, onClose }) {
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const initials = displayName.slice(0, 2).toUpperCase()

  function isActive(href) {
    if (href === '/') return pathname === '/'
    if (href === '/welcome') return pathname === '/welcome'
    return pathname.startsWith(href)
  }

  const linkClass = (href) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive(href)
        ? 'bg-[#1a1a1a] text-white'
        : 'text-[#737373] hover:text-white hover:bg-[#141414]'
    }`

  return (
    <>
      {/* ── Logo + close ── */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <Link href="/welcome" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white" />
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
          {NAV_LINKS.map(({ label, href, Icon }) => (
            <Link
              key={href}
              href={href}
              className={linkClass(href)}
              onClick={onClose}
            >
              <Icon size={14} className="shrink-0" />
              {label}
            </Link>
          ))}

          {/* Divider */}
          <div className="h-px bg-[#1a1a1a] my-2" />

          {NAV_SECONDARY.map(({ label, href, Icon }) => (
            <Link
              key={href}
              href={href}
              className={linkClass(href)}
              onClick={onClose}
            >
              <Icon size={14} className="shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Language switcher ── */}
      <div className="px-2.5 pb-1.5 shrink-0">
        <InlineLanguageSwitcher />
      </div>

      {/* ── Auth section — pinned to bottom ── */}
      <div className="p-2.5 border-t border-[#181818] space-y-1 shrink-0">
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
          Dashboard
        </Link>

        {user && (
          <Link
            href="/profile"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors font-medium ${
              isActive('/profile')
                ? 'bg-[#1a1a1a] text-white'
                : 'text-[#737373] hover:text-white hover:bg-[#141414]'
            }`}
            onClick={onClose}
          >
            <IconUser size={14} />
            Profile
          </Link>
        )}

        {user ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-6 h-6 bg-[#dc2626] rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{displayName}</p>
                <p className="text-[10px] text-[#737373] truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#737373] hover:text-red-400 hover:bg-[#141414] transition-colors font-medium"
            >
              <IconLogout size={14} />
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/auth"
            className="flex items-center justify-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-sm py-2 rounded-lg transition-colors font-semibold"
            onClick={onClose}
          >
            <IconUser size={12} />
            Sign in
          </Link>
        )}
      </div>
    </>
  )
}

/** Inline currency toggle used on the minimal navbar for /welcome */
function InlineCurrencyToggle({ open, setOpen, dropdownRef }) {
  const { currency, selectCurrency, currencies } = useCurrency()

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 sm:gap-1.5 bg-[#141414]/60 border border-[#262626] hover:border-[#3a3a3a] px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-sm text-[#737373] hover:text-white transition-all font-mono"
      >
        <span className="font-sans text-sm font-medium">{currency.symbol}</span>
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
