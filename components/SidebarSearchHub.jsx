'use client'

import { useState } from 'react'

// ── v5.30.38 — Sidebar Search Hub (user spec, chat history sidebar) ──
// Pill search input + side-by-side filter pills. LIVES ONLY in the chat
// history sidebar — the nav drawer stays untouched (v5.30.37 put it in
// the drawer by mistake and was reverted). Controlled input: the chat
// client passes its conversation-search state so typing filters the
// history live, exactly like the old search box did. Pills are equal
// flex-1 thirds on one line — they can never overflow the sidebar width
// (the v5.30.37 nowrap+scroll variant let "Coding" clip off the edge).
const FILTERS = [
  { id: 'recent', label: 'Recent' },
  { id: 'starred', label: 'Starred' },
  { id: 'coding', label: 'Coding' },
]

export default function SidebarSearchHub({ value, onChange }) {
  const [activeFilter, setActiveFilter] = useState(null)

  return (
    <div>
      {/* Search input — large pill, red border + subtle ring on focus */}
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder="Search conversations..."
          aria-label="Search hub"
          className="w-full rounded-full bg-[#161616] border border-gray-700 py-3.5 pl-11 pr-4 text-sm text-gray-200 placeholder-gray-500 outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500"
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      {/* Filter pills — equal flex-1 thirds on one line: they always fit
          the sidebar width (no wrap, no horizontal scroll, no clipping).
          lg:w-72 = 288px − 2×px-4 − 2×gap-2 = 240px → 80px per pill;
          the widest label ("Starred" + star) needs ~73px, so it fits. */}
      <div className="flex flex-nowrap gap-2 w-full mt-2.5">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveFilter(f.id)}
            aria-pressed={activeFilter === f.id}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 py-1.5 text-[11px] leading-4 font-medium transition-colors ${
              activeFilter === f.id
                ? 'bg-[rgba(220,38,38,0.12)] border-red-500/40 text-red-400'
                : 'bg-[#161616] border-gray-700 text-gray-300 hover:bg-[#1f1f1f] hover:text-white'
            }`}
          >
            {f.id === 'starred' && (
              <svg className="text-yellow-400 shrink-0" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}
