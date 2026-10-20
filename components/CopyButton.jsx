'use client'

/**
 * CopyButton — HUSH-style copy pill shared across output cards
 * (ReelPen, DevTools, StudyDesk, Research).
 *
 * Visual: rounded-full bordered pill, neutral by default, shifts to the
 * #FF3366 accent on hover/active — matching the HUSH card language
 * (Inter-grade small text, pill radius, accent hover borders).
 *
 * Behaviour: writes to clipboard, flips to a check state for ~2s and
 * fires a HUSH top toast ("Copied to clipboard") via FeedbackToast.
 *
 * Props:
 *  - getText: () => string     (preferred) resolves text at click time
 *  - value: string             static text alternative to getText
 *  - label / copiedLabel       button + toast text (i18n-resolved by caller)
 *  - onCopied: () => void      extra callback after a successful copy
 *  - compact: icon-only pill (no label)
 *  - className                 extra classes on the button
 */

import { useRef, useState } from 'react'
import { IconCheck, IconCopy } from '@/components/Icons'
import { showFeedback } from '@/components/FeedbackToast'

export default function CopyButton({
  getText,
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  onCopied,
  compact = false,
  title,
  className = '',
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)

  const handleCopy = async () => {
    const text = typeof getText === 'function' ? getText() : (value ?? '')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard API can be missing on http:// or older webviews —
      // legacy execCommand fallback keeps the button functional.
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch { return }
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
    showFeedback({ variant: 'toast', message: copiedLabel || label })
    if (onCopied) onCopied()
  }

  return (
    <button
      onClick={handleCopy}
      title={title || label}
      aria-label={title || label}
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all duration-200 active:scale-[0.96] ${
        copied
          ? 'border-[#FF3366]/60 text-[#FF3366] bg-[#FF3366]/[0.07]'
          : 'border-[#2a2a2a] bg-[#0a0a0a]/60 text-[#a3a3a3] hover:border-[#FF3366]/60 hover:text-[#FF3366] hover:bg-[#FF3366]/[0.05]'
      } ${className}`}
    >
      {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
      {!compact && <span>{copied ? copiedLabel : label}</span>}
    </button>
  )
}
