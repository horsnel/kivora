'use client'
// ── Shared plan-awareness hook ──────────────────────────────────────
// Lets pages show Pro/Max badges and enforce gates BEFORE an API call,
// instead of letting users discover them via a 403. Backed by
// /api/credits/balance (authFetch attaches the Supabase token); results
// are cached module-level for 60s so several widgets share one fetch.
//
//   const { plan, signedIn, allows, refresh } = usePlan()
//   allows('free') → everyone; allows('pro') → Pro and above;
//   allows('premium') → Max/Team. Signed-out users only pass 'free'.

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/authFetch'

const RANK = { free: 0, pro: 1, max: 2, team: 3 }
const TTL_MS = 60_000

let _cache = null // { plan, ts }
let _inflight = null

export async function fetchPlan(force = false) {
  if (!force && _cache && Date.now() - _cache.ts < TTL_MS) return _cache.plan
  if (!force && _inflight) return _inflight
  _inflight = (async () => {
    try {
      const res = await authFetch('/api/credits/balance')
      if (res.ok) {
        const data = await res.json().catch(() => null)
        const plan = data?.plan?.code
        if (plan && RANK[plan] !== undefined) {
          _cache = { plan, ts: Date.now() }
          return plan
        }
      }
    } catch { /* offline / anon — fall through */ }
    return null // null = signed out or unknown → treated as 'free'
  })()
  const out = await _inflight
  _inflight = null
  return out
}

export function usePlan() {
  const [plan, setPlan] = useState(_cache?.plan ?? null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    fetchPlan().then(p => {
      if (!active) return
      if (p) setPlan(p)
      setReady(true)
    })
    return () => { active = false }
  }, [])

  const rank = plan ? (RANK[plan] ?? 0) : 0
  const allows = (tier) => {
    if (!tier || tier === 'free') return true
    if (!plan) return false            // signed out — nothing above free
    const need = tier === 'premium' ? RANK.max : (RANK[tier] ?? RANK.pro)
    return rank >= need
  }

  return {
    plan: plan || 'free',
    signedIn: plan !== null,
    ready,
    allows,
    refresh: () => fetchPlan(true).then(p => { if (p) setPlan(p) }),
  }
}
