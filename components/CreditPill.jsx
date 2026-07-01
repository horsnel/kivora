'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'
import { IconLightning, IconChevronDown } from '@/components/Icons'

/**
 * CreditPill — Shows the user's current credit balance in the sidebar.
 *
 * Displays total credits available (daily + monthly + bonus), with a small
 * breakdown tooltip on hover. Clicking navigates to /pricing.
 *
 * Hidden for anonymous users and on auth/chat/onboarding pages (matches
 * the Navbar's hideSidebar logic).
 */
export default function CreditPill({ compact = false }) {
  const pathname = usePathname() ?? ''
  const [balance, setBalance] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  // Hide on auth/chat/onboarding pages
  const shouldHide =
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/chat')

  // ── Fetch balance ──
  async function refresh() {
    if (!supabasePublic) return
    try {
      const { data: { session } } = await supabasePublic.auth.getSession()
      if (!session?.access_token) {
        setLoading(false)
        return
      }
      const res = await fetch('/api/credits/balance', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setBalance(data.balance)
        setPlan(data.plan)
      }
    } catch (e) {
      // silent fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (shouldHide) return
    refresh()

    // Refresh on auth state changes
    if (!supabasePublic) return
    const { data: { subscription } } = supabasePublic.auth.onAuthStateChange(() => {
      refresh()
    })

    // Refresh every 60 seconds while the page is open
    const interval = setInterval(refresh, 60000)

    // Refresh when the tab regains focus
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)

    return () => {
      subscription?.unsubscribe()
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [shouldHide, pathname])

  if (shouldHide || loading || !balance || !plan) return null

  const total = balance.total
  const isLow = total <= 5

  return (
    <div className="relative">
      <Link
        href="/pricing"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
          isLow
            ? 'bg-red-950/40 border border-red-500/30 text-red-300 hover:bg-red-950/60'
            : 'bg-[#1a1a1a] text-[#d4d4d4] hover:bg-[#262626]'
        }`}
      >
        <IconLightning size={12} className={isLow ? 'text-red-400' : 'text-red-500'} />
        <span className="font-semibold">{total}</span>
        <span className="text-[9px] sm:text-[10px] text-[#737373] uppercase tracking-wide hidden sm:inline">credits</span>
      </Link>

      {expanded && (
        <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-[#141414] border border-[#262626] rounded-xl overflow-hidden shadow-2xl z-50">
          <div className="p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#737373]">Plan</span>
              <span className="text-white font-semibold uppercase">{plan.name}</span>
            </div>
            <div className="border-t border-[#262626] my-1.5"></div>
            <div className="flex items-center justify-between">
              <span className="text-[#737373]">Daily</span>
              <span className="text-white">{balance.daily}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#737373]">Monthly</span>
              <span className="text-white">{balance.monthly}</span>
            </div>
            {balance.bonus > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[#737373]">Bonus</span>
                <span className="text-emerald-400">{balance.bonus}</span>
              </div>
            )}
            <div className="border-t border-[#262626] my-1.5"></div>
            <div className="flex items-center justify-between font-semibold">
              <span className="text-[#a3a3a3]">Total</span>
              <span className="text-white">{total}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-[#262626]">
              <Link
                href="/pricing"
                className="block w-full text-center py-1.5 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                {total <= 5 ? 'Get more credits →' : 'Manage plan →'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
