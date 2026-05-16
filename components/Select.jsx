'use client'
import { useState, useRef, useEffect } from 'react'
import { IconChevronDown, IconCheck } from '@/components/Icons'

/**
 * Custom dropdown select matching the CurrencyToggle design.
 * - bg-[#141414] rounded-xl container with shadow-2xl
 * - animate-scale-in on open
 * - Items: hover:bg-[#1a1a1a], selected item: text-red-400 + checkmark
 * - Click outside to close
 */
export default function Select({ value, onChange, options, placeholder, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selected = options.find(o => o.value === value)
  const label = selected?.label || placeholder || 'Select...'

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white transition-colors focus:border-red-500 focus:outline-none focus:shadow-[0_0_0_2px_rgba(220,38,38,0.15)]"
      >
        <span className={selected ? 'text-white' : 'text-[#404040]'}>{label}</span>
        <IconChevronDown size={12} className={`text-[#525252] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#141414] border border-[#262626] rounded-xl overflow-hidden shadow-2xl animate-scale-in z-50">
          <div className="py-1 max-h-56 overflow-y-auto overscroll-behavior-contain scrollbar-none">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-sm transition-colors ${
                  value === opt.value
                    ? 'text-red-400'
                    : 'text-[#737373] hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                <span>{opt.label}</span>
                {value === opt.value && <IconCheck size={12} className="text-red-400 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
