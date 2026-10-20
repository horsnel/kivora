'use client'

/**
 * Lightbox — shared full-screen image preview.
 *
 * Used by the chat and research text bars: tapping an attached-image
 * thumbnail opens the full picture over a dark backdrop. Closes on
 * backdrop click or Escape. Body scroll is locked while open.
 *
 * Props:
 *  - src: string        image URL / data URL (required to render)
 *  - alt: string        accessibility label
 *  - onClose: () => void
 */

import { useEffect, useCallback } from 'react'
import { IconClose } from '@/components/Icons'

export default function Lightbox({ src, alt = 'Preview', onClose }) {
  const onKey = useCallback((e) => {
    if (e.key === 'Escape') onClose?.()
  }, [onClose])

  useEffect(() => {
    if (!src) return
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [src, onKey])

  if (!src) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/85 backdrop-blur-sm animate-fade-in cursor-zoom-out"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose?.() }}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/[0.08] border border-white/[0.12] text-white/80 hover:text-white hover:bg-white/[0.14] flex items-center justify-center transition-colors"
        aria-label="Close preview"
      >
        <IconClose size={14} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="lightbox-image max-w-full max-h-full w-auto h-auto object-contain rounded-xl shadow-2xl cursor-default"
        data-lightbox-image="true"
      />
    </div>
  )
}
