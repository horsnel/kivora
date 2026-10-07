'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabasePublic } from '@/lib/supabase'
import { IconLightning } from '@/components/Icons'

/**
 * CreditPill — the dashboard stats-grid tile showing the user's credit
 * balance. Styled to match the sibling stat boxes (streak / goals / saved
 * / chats / messages): bold value on top, caption label below. Shows total
 * credits (daily + monthly + bonus); the plan name appears on hover and
 * clicking navigates to /pricing. Renders a placeholder tile while the
 * balance loads so the grid doesn't jump.
 */
export default function CreditPill() {
  const [balance, setBalance] = useState(null)
  const [plan, setPlan] = useState(null)

  // ── Fetch balance ──
  async function refresh() {
    if (!supabasePublic) return
    try {
      const { data: { session } } = await supabasePublic.auth.getSession()
      if (!session?.access_token) return
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
    }
  }

  useEffect(() => {
    // Defer first refresh to avoid triggering during navigation re-render
    const initTimer = setTimeout(() => refresh(), 100)

    // Refresh on auth state changes
    let subscription
    if (supabasePublic) {
      const { data } = supabasePublic.auth.onAuthStateChange(() => {
        refresh()
      })
      subscription = data.subscription
    }

    // Refresh every 60 seconds while the page is open
    const interval = setInterval(refresh, 60000)

    // Refresh when the tab regains focus
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)

    return () => {
      clearTimeout(initTimer)
      subscription?.unsubscribe()
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const total = balance?.total
  const isLow = total <= 5

  if (!balance || !plan) {
    // Placeholder tile while loading — keeps the stats grid stable
    return (
      <div className="bg-[#141414] border border-white/[0.06] rounded-xl px-4 py-3 text-center">
        <div className="font-bold text-headline tracking-tight text-muted">—</div>
        <div className="text-caption text-muted mt-0.5">Credits</div>
      </div>
    )
  }

  return (
    <Link
      href="/pricing"
      title={plan.name ? `${plan.name} plan — click to manage` : 'Credits'}
      className="block bg-[#141414] border border-white/[0.06] hover:border-white/[0.15] rounded-xl px-4 py-3 text-center transition-colors"
    >
      <div className="font-bold text-headline tracking-tight flex items-center justify-center gap-1">
        <IconLightning size={14} className={isLow ? 'text-red-400' : 'text-red-500'} />
        {total}
      </div>
      <div className="text-caption text-muted mt-0.5">Credits</div>
    </Link>
  )
}
