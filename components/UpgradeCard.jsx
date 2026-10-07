'use client'

import Link from 'next/link'
import { IconLock, IconArrowRight, IconUser } from '@/components/Icons'

// ── UpgradeCard — shared plan-gate UI ───────────────────────────────
// Rendered by any page when a plan-gated feature rejects the request with
// the shared 403 payload from lib/credits.js → requireFeatureAccess():
//   { reason: 'sign_in_required' | 'upgrade_required', needed_plan, ... }
//
// Props:
//   gate    — the parsed 403 JSON body (truthy → card renders)
//   onDismiss — optional close handler
export default function UpgradeCard({ gate, onDismiss }) {
  if (!gate) return null
  const signIn = gate.reason === 'sign_in_required'
  const planName = gate.needed_plan
    ? gate.needed_plan.charAt(0).toUpperCase() + gate.needed_plan.slice(1)
    : 'Pro'

  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-10 px-6 my-4 rounded-2xl border border-[#262626] bg-[#0f0f0f]">
      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
        <IconLock size={18} />
      </div>
      <div>
        <p className="font-semibold text-[15px] text-white">
          {signIn ? `${planName} feature — sign in to continue` : `${planName} feature`}
        </p>
        <p className="text-[13px] text-[#737373] mt-1 max-w-sm">
          {gate.error ||
            (signIn
              ? `Sign in with a ${planName} plan to use this feature.`
              : `This feature is part of the ${planName} plan. Upgrade to unlock it.`)}
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        {signIn && (
          <Link
            href="/auth"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-white text-sm font-medium transition-colors"
          >
            <IconUser size={14} />
            Sign in
          </Link>
        )}
        <Link
          href="/pricing"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-semibold transition-colors"
        >
          Upgrade to {planName}
          <IconArrowRight size={14} />
        </Link>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-[12px] text-[#525252] hover:text-[#737373] transition-colors"
        >
          Dismiss
        </button>
      )}
    </div>
  )
}
