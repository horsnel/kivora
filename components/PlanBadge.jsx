import { IconLock } from '@/components/Icons'

// ── PlanBadge — small "Pro"/"Max" lock chip for gated controls ──────
// Shown BEFORE the click so users see which tier a feature belongs to,
// instead of discovering it via a 403. plan: 'Pro' | 'Max' | 'Free'
export default function PlanBadge({ plan = 'Pro', className = '' }) {
  if (plan === 'Free') return null
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 whitespace-nowrap ${className}`}
    >
      <IconLock size={9} />
      {plan}
    </span>
  )
}
