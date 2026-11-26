'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── v5.30.37 — Sidebar Search Hub (user spec) ────────────────────────
// Large pill search input + a single row of filter pills, rendered at
// the top of the nav drawer above the nav links (Explore stays right
// below). The input is a gateway to /explore, the app's search surface —
// it takes no query param yet, so Enter routes there plain. The filters
// are selectable chips with local state only; no list reacts to them yet.
const FILTERS = [
  { id: 'recent', label: 'Recent' },
  { id: 'starred', label: 'Starred' },
  { id: 'coding', label: 'Coding' },
]

export default function SidebarSearchHub({ onClose }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState(null)

  function go() {
    router.push('/explore')
    onClose?.()
  }

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
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); go() } }}
          placeholder="Search..."
          aria-label="Search hub"
          className="w-full rounded-full bg-[#161616] border border-gray-700 py-3.5 pl-11 pr-4 text-sm text-gray-200 placeholder-gray-500 outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500"
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      {/* Filter pills — strictly one line: flex-nowrap + overflow-x-auto
          (scrollbar hidden via the global .scrollbar-none utility) */}
      <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-none mt-2.5">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveFilter(f.id)}
            aria-pressed={activeFilter === f.id}
            className={`flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] leading-4 font-medium transition-colors ${
              activeFilter === f.id
                ? 'bg-[rgba(220,38,38,0.12)] border-red-500/40 text-red-400'
                : 'bg-[#161616] border-gray-700 text-gray-300 hover:bg-[#1f1f1f] hover:text-white'
            }`}
          >
            {f.id === 'starred' && (
              <svg className="text-yellow-400 shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
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
