'use client'

import Link from 'next/link'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'
import { PLANS, PLAN_LIST } from '@/lib/plans'
import {
  IconCheck, IconClose, IconLightning, IconChat, IconMicroscope,
  IconImage, IconBook, IconCode, IconVideo, IconTrending, IconGlobe,
  IconUser, IconArrowRight
} from '@/components/Icons'

// ── Feature list per plan (display only; mirrors PLANS config in lib/credits.js) ──
const FEATURE_MATRIX = [
  { label: 'Daily credits',           get: (p) => `${p.daily}/day`,                                                 all: true },
  { label: 'Monthly credits',         get: (p) => `${p.monthly}/mo`,                                                 all: true },
  { label: 'AI Chat (all models)',    get: (p) => '✓',                                                               all: true },
  { label: 'Quick Research',          get: (p) => '✓',                                                               all: true },
  { label: 'Explore topics',          get: (p) => '✓',                                                               all: true },
  { label: 'Opportunities feed',      get: (p) => '✓',                                                               all: true },
  { label: 'Study Desk',              get: (p) => '✓',                                                               all: true },
  { label: 'Deep Research (multi-phase)', get: (p) => p.features.deepResearch ? '✓' : '—',                           pro: true },
  { label: 'DevTools code generation', get: (p) => p.features.deepResearch ? '✓' : '—',                             pro: true },
  { label: 'ReelPen video scripts',   get: (p) => p.features.deepResearch ? '✓' : '—',                              pro: true },
  { label: 'Image Intelligence (OSINT)', get: (p) => p.features.imageOsint ? '✓' : '—',                             max: true },
  { label: 'Voice TTS / STT',         get: (p) => p.features.voice ? '✓' : '—',                                     max: true },
  { label: 'Custom domain',           get: (p) => p.features.customDomain ? '✓' : '—',                             max: true },
  { label: 'Priority compute',        get: (p) => p.features.priorityCompute ? '✓' : '—',                          max: true },
  { label: 'Team seats (pooled credits)', get: (p) => p.features.teamSeats ? 'Up to 5 seats' : '—',                 team: true },
  { label: 'Storage',                 get: (p) => `${p.storageGB} GB`,                                              all: true },
]

const CREDIT_COSTS = [
  { action: 'Chat message',              cost: 1,   Icon: IconChat },
  { action: 'Chat (reasoning model)',    cost: 3,   Icon: IconChat },
  { action: 'Research — Quick',          cost: 5,   Icon: IconMicroscope },
  { action: 'Research — Deep',           cost: 15,  Icon: IconMicroscope },
  { action: 'Image Intelligence',        cost: 25,  Icon: IconImage },
  { action: 'Explore topic',             cost: 2,   Icon: IconGlobe },
  { action: 'Opportunity generation',    cost: 3,   Icon: IconTrending },
  { action: 'Study session',             cost: 2,   Icon: IconBook },
  { action: 'DevTools code gen',         cost: 3,   Icon: IconCode },
  { action: 'ReelPen video script',      cost: 4,   Icon: IconVideo },
]

function PricingPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState('monthly') // 'monthly' | 'annual'
  const [user, setUser] = useState(null)
  const [currentPlan, setCurrentPlan] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(null) // plan code currently loading
  const [toast, setToast] = useState(null) // { type: 'success' | 'error' | 'pending', message }
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [referralCode, setReferralCode] = useState(null)

  // ── Auth + current plan ──
  useEffect(() => {
    if (!supabasePublic) return
    supabasePublic.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (user) {
        // Fetch current plan
        try {
          const { data: { session } } = await supabasePublic.auth.getSession()
          const res = await fetch('/api/credits/balance', {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          })
          if (res.ok) {
            const data = await res.json()
            setCurrentPlan(data.plan?.code || 'free')
            setReferralCode(data.referral_code)
          }
        } catch (e) { /* ignore */ }
      }
    })
    const { data: { subscription } } = supabasePublic?.auth?.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    }) || { data: { subscription: null } }
    return () => subscription?.unsubscribe()
  }, [])

  // ── Toast from URL params (set by /api/billing/verify redirect) ──
  useEffect(() => {
    const upgrade = searchParams.get('upgrade')
    const plan = searchParams.get('plan')
    if (upgrade === 'success') {
      setToast({
        type: 'success',
        message: `Welcome to ${plan ? PLANS[plan]?.name : 'your new plan'}! Your credits have been refilled.`,
      })
      // Refresh current plan
      if (supabasePublic && user) {
        supabasePublic.auth.getSession().then(async ({ data: { session } }) => {
          const res = await fetch('/api/credits/balance', {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          })
          if (res.ok) {
            const data = await res.json()
            setCurrentPlan(data.plan?.code || 'free')
          }
        })
      }
    } else if (upgrade === 'failed') {
      setToast({ type: 'error', message: `Payment couldn't be verified (${searchParams.get('reason') || 'unknown'}). Please try again or contact support.` })
    } else if (upgrade === 'pending') {
      setToast({ type: 'pending', message: 'Payment received but plan upgrade is pending. If this persists, contact support with your receipt.' })
    }
    if (upgrade) {
      // Clear the query param
      router.replace('/pricing')
    }
  }, [searchParams, user, router])

  // ── Dismiss toast after 6 seconds ──
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  // ── Compute display price ──
  const priceFor = (plan) => {
    if (plan.code === 'free') return 0
    if (billingCycle === 'annual') {
      return Math.round(plan.priceNGN * 12 * 0.8)
    }
    return plan.priceNGN
  }

  // ── Start checkout ──
  async function handleUpgrade(planCode) {
    if (planCode === 'free') return
    if (!user) {
      router.push('/auth?redirect=/pricing')
      return
    }
    if (currentPlan === planCode) {
      setToast({ type: 'error', message: 'You are already on this plan.' })
      return
    }
    setCheckoutLoading(planCode)
    try {
      if (!supabasePublic) { router.push('/auth'); return }
      const { data: { session } } = await supabasePublic.auth.getSession()
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ plan: planCode, billing: billingCycle }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Checkout failed')
      }
      // Redirect to Paystack
      window.location.href = data.authorization_url
    } catch (err) {
      setToast({ type: 'error', message: err.message })
      setCheckoutLoading(null)
    }
  }

  // ── Redeem code ──
  async function handleRedeem(e) {
    e.preventDefault()
    if (!redeemCode.trim() || !user) {
      if (!user) router.push('/auth?redirect=/pricing')
      return
    }
    setRedeemLoading(true)
    try {
      if (!supabasePublic) { router.push('/auth'); return }
      const { data: { session } } = await supabasePublic.auth.getSession()
      const res = await fetch('/api/credits/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ code: redeemCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Redemption failed')
      }
      setToast({ type: 'success', message: data.message })
      setRedeemCode('')
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    } finally {
      setRedeemLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ── Hero ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a1a1a] border border-[#262626] text-xs text-[#a3a3a3] mb-4">
            <IconLightning size={12} className="text-red-500" />
            Credits-based pricing — never worry about tokens
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3">
            Pick the plan that <span className="text-red-500">fits your hustle</span>
          </h1>
          <p className="text-base sm:text-lg text-[#a3a3a3] max-w-2xl mx-auto">
            Every plan includes daily free credits. Upgrade when you need more power — Deep Research, Image Intelligence, voice, or team seats.
          </p>
        </div>

        {/* ── Billing cycle toggle ── */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex p-1 bg-[#141414] border border-[#262626] rounded-xl">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 sm:px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                billingCycle === 'monthly' ? 'bg-[#dc2626] text-white' : 'text-[#a3a3a3] hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 sm:px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                billingCycle === 'annual' ? 'bg-[#dc2626] text-white' : 'text-[#a3a3a3] hover:text-white'
              }`}
            >
              Annual
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                billingCycle === 'annual' ? 'bg-white/20' : 'bg-[#262626]'
              }`}>
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* ── Plan cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {PLAN_LIST.map((plan) => {
            const isCurrent = currentPlan === plan.code
            const isPopular = plan.code === 'pro'
            const displayPrice = priceFor(plan)
            const monthlyEquivalent = billingCycle === 'annual' && plan.code !== 'free'
              ? Math.round(displayPrice / 12)
              : displayPrice

            return (
              <div
                key={plan.code}
                className={`relative rounded-2xl border p-5 flex flex-col ${
                  isPopular
                    ? 'border-red-500/60 bg-gradient-to-b from-[#1a0d0d] to-[#0a0a0a]'
                    : 'border-[#262626] bg-[#0f0f0f]'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-red-500 text-white text-[11px] font-semibold">
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    {plan.code === 'free' ? (
                      <span className="text-3xl font-bold">Free</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold">₦{displayPrice.toLocaleString()}</span>
                        <span className="text-xs text-[#737373]">
                          {billingCycle === 'annual' ? '/yr' : '/mo'}
                        </span>
                      </>
                    )}
                  </div>
                  {billingCycle === 'annual' && plan.code !== 'free' && (
                    <p className="text-[11px] text-[#737373] mt-1">
                      ≈ ₦{monthlyEquivalent.toLocaleString()}/mo
                    </p>
                  )}
                </div>

                <ul className="space-y-2 text-sm mb-6 flex-1">
                  <li className="flex items-center gap-2">
                    <span className="text-red-500 font-semibold">{plan.daily}</span>
                    <span className="text-[#d4d4d4]">credits per day</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500 font-semibold">{plan.monthly}</span>
                    <span className="text-[#d4d4d4]">credits per month</span>
                  </li>
                  <li className="flex items-center gap-2 text-[#a3a3a3]">
                    <IconCheck size={14} className="text-emerald-500" />
                    {plan.storageGB} GB storage
                  </li>
                  {plan.code === 'team' && (
                    <li className="flex items-center gap-2 text-[#a3a3a3]">
                      <IconCheck size={14} className="text-emerald-500" />
                      Up to 5 team seats
                    </li>
                  )}
                  {plan.features.deepResearch && (
                    <li className="flex items-center gap-2 text-[#a3a3a3]">
                      <IconCheck size={14} className="text-emerald-500" />
                      Deep Research
                    </li>
                  )}
                  {plan.features.imageOsint && (
                    <li className="flex items-center gap-2 text-[#a3a3a3]">
                      <IconCheck size={14} className="text-emerald-500" />
                      Image Intelligence
                    </li>
                  )}
                  {plan.features.voice && (
                    <li className="flex items-center gap-2 text-[#a3a3a3]">
                      <IconCheck size={14} className="text-emerald-500" />
                      Voice TTS / STT
                    </li>
                  )}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.code)}
                  disabled={isCurrent || checkoutLoading === plan.code}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-[#1a1a1a] text-[#737373] cursor-not-allowed'
                      : plan.code === 'free'
                      ? 'bg-[#1a1a1a] text-white hover:bg-[#262626]'
                      : 'bg-[#dc2626] hover:bg-red-700 text-white'
                  }`}
                >
                  {isCurrent
                    ? 'Current plan'
                    : checkoutLoading === plan.code
                    ? 'Redirecting...'
                    : plan.code === 'free'
                    ? (user ? 'Your plan' : 'Get started')
                    : `Upgrade to ${plan.name}`}
                </button>
              </div>
            )
          })}
        </div>

        {/* ── Payment trust badges ── */}
        <div className="flex justify-center items-center gap-4 sm:gap-6 mt-8 text-[11px] text-[#737373]">
          <span className="flex items-center gap-1.5">
            <IconCheck size={12} className="text-emerald-500" />
            Secure payment by Paystack
          </span>
          <span className="flex items-center gap-1.5">
            <IconCheck size={12} className="text-emerald-500" />
            Card · Bank transfer · USSD
          </span>
          <span className="flex items-center gap-1.5">
            <IconCheck size={12} className="text-emerald-500" />
            Cancel anytime
          </span>
        </div>
      </div>

      {/* ── Feature comparison table ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <h2 className="text-xl sm:text-2xl font-bold mb-6 text-center">Compare every feature</h2>
        <div className="overflow-x-auto rounded-2xl border border-[#262626] bg-[#0f0f0f]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#262626]">
                <th className="text-left p-4 font-medium text-[#a3a3a3]">Feature</th>
                {PLAN_LIST.map((p) => (
                  <th key={p.code} className="text-center p-4 font-semibold">
                    {p.name}
                    {currentPlan === p.code && (
                      <div className="text-[10px] text-emerald-500 mt-0.5">Your plan</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row, i) => (
                <tr key={i} className={`border-b border-[#1a1a1a] ${i % 2 === 1 ? 'bg-[#0a0a0a]/40' : ''}`}>
                  <td className="p-4 text-[#d4d4d4]">{row.label}</td>
                  {PLAN_LIST.map((p) => (
                    <td key={p.code} className="text-center p-4">
                      <span className={row.get(p) === '—' ? 'text-[#525252]' : 'text-white'}>
                        {row.get(p)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Credit cost explainer ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-t border-[#1a1a1a]">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 text-center">How credits work</h2>
        <p className="text-center text-[#a3a3a3] mb-8 max-w-2xl mx-auto text-sm">
          Every action costs a fixed number of credits — no token math, no surprise bills.
          Credits drain in this order: <span className="text-red-400">daily → monthly → bonus</span>.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CREDIT_COSTS.map(({ action, cost, Icon }) => (
            <div key={action} className="bg-[#0f0f0f] border border-[#262626] rounded-xl p-4 text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
                <Icon size={16} className="text-red-500" />
              </div>
              <div className="text-xs text-[#a3a3a3] mb-1">{action}</div>
              <div className="text-base font-bold text-white">{cost} cr</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Referral + Promo code redemption ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-t border-[#1a1a1a]">
        <div className="bg-[#0f0f0f] border border-[#262626] rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg sm:text-xl font-bold mb-2">Have a referral or promo code?</h2>
          <p className="text-sm text-[#a3a3a3] mb-5">
            Redeem it below to get bonus credits. Referral codes look like <code className="px-1.5 py-0.5 bg-[#1a1a1a] rounded text-red-400">KIV-AB12CD</code>; promo codes are like <code className="px-1.5 py-0.5 bg-[#1a1a1a] rounded text-red-400">LAUNCH100</code>.
          </p>

          {referralCode && (
            <div className="mb-5 p-3 rounded-xl bg-[#1a0d0d] border border-red-500/30">
              <div className="text-xs text-[#a3a3a3] mb-1">Your referral code (share to earn 25 credits per signup):</div>
              <div className="font-mono text-lg font-bold text-red-400">{referralCode}</div>
            </div>
          )}

          <form onSubmit={handleRedeem} className="flex gap-2">
            <input
              type="text"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              placeholder="Enter code"
              className="flex-1 px-4 py-2.5 bg-[#0a0a0a] border border-[#262626] rounded-xl text-white placeholder-[#525252] focus:outline-none focus:border-red-500/50 font-mono uppercase"
              disabled={!user || redeemLoading}
            />
            <button
              type="submit"
              disabled={!user || redeemLoading || !redeemCode.trim()}
              className="px-5 py-2.5 bg-[#dc2626] hover:bg-red-700 disabled:bg-[#262626] disabled:text-[#525252] text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {redeemLoading ? 'Redeeming...' : 'Redeem'}
            </button>
          </form>
          {!user && (
            <p className="text-xs text-[#525252] mt-2">
              <Link href="/auth?redirect=/pricing" className="text-red-400 hover:underline">Sign in</Link> to redeem codes.
            </p>
          )}
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-t border-[#1a1a1a]">
        <h2 className="text-xl sm:text-2xl font-bold mb-6 text-center">FAQ</h2>
        <div className="space-y-4">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="group bg-[#0f0f0f] border border-[#262626] rounded-xl p-4 cursor-pointer">
              <summary className="flex items-center justify-between text-sm font-medium list-none">
                {item.q}
                <span className="text-[#737373] group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-sm text-[#a3a3a3] mt-3 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
        <h2 className="text-xl sm:text-2xl font-bold mb-3">Still on Free?</h2>
        <p className="text-[#a3a3a3] mb-6 text-sm">
          You get 10 free credits every day. Use them on Quick Research, Chat, Explore, and more — no card needed.
        </p>
        <Link
          href="/research"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#dc2626] hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          Start using Kivora <IconArrowRight size={16} />
        </Link>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm">
          <div className={`rounded-xl border p-4 shadow-2xl ${
            toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-700 text-emerald-100' :
            toast.type === 'pending' ? 'bg-amber-950/90 border-amber-700 text-amber-100' :
            'bg-red-950/90 border-red-700 text-red-100'
          }`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 text-sm">
                {toast.message}
              </div>
              <button
                onClick={() => setToast(null)}
                className="text-current opacity-60 hover:opacity-100"
              >
                <IconClose size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#262626] border-t-red-500 rounded-full animate-spin" />
      </div>
    }>
      <PricingPageContent />
    </Suspense>
  )
}

const FAQ_ITEMS = [
  {
    q: 'What happens to my unused credits at the end of the month?',
    a: 'Daily credits reset every 24 hours (use-them-or-lose-them). Monthly subscription credits roll over for one billing cycle when you upgrade, then expire. Bonus credits from referrals and promos never expire.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. Upgrades take effect immediately and your unused monthly credits roll over (one-month only). Downgrades take effect at the end of your current billing cycle — no refunds, but you keep your credits until the cycle ends.',
  },
  {
    q: 'How do I pay?',
    a: 'We use Paystack, which supports Nigerian debit/credit cards, bank transfers, and USSD. Annual subscriptions get a 20% discount. Cancel anytime from your dashboard.',
  },
  {
    q: 'What if I run out of credits mid-month?',
    a: 'You can upgrade to a higher plan at any time. Your unused monthly credits roll over to the next cycle. You can also earn bonus credits through referrals (25 credits per signup) or by redeeming promo codes.',
  },
  {
    q: 'Do credits expire if I cancel?',
    a: 'If you cancel, your plan stays active until the end of your current billing cycle. After that, your account reverts to Free (10 daily + 25 monthly credits). Bonus credits from referrals remain.',
  },
  {
    q: 'Is there a free trial?',
    a: 'The Free plan IS the trial — it never expires. You get 10 free credits every day, enough for ~10 chat messages or 2 quick research queries. Upgrade only when you need more.',
  },
]
