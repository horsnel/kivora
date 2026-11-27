'use client'

// ── v5.30.39 — Sidebar Search Hub (chat history sidebar, functional) ──
// Pill search input + filter pills that DRIVE the conversation list.
// Restyled per user feedback: pills drop the grey outline (bg-[#161616]
// reads as part of the platform instead of a floating bubble), rounded-xl
// so they sit visually distinct from the strict pill input above, active
// state is a subtle red tint (bg-red-500/10) with red text — no border —
// and hover brightens the dark grey (hover:bg-[#222]). ChatClient passes
// activeFilter/onFilterChange: Recent (last 7 days), Starred (flag from
// the long-press action sheet), Coding (title heuristic). Equal flex-1
// thirds so they can never overflow the sidebar width.
const FILTERS = [
  { id: 'recent', label: 'Recent' },
  { id: 'starred', label: 'Starred' },
  { id: 'coding', label: 'Coding' },
]

export default function SidebarSearchHub({ value, onChange, activeFilter, onFilterChange }) {
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

      {/* Filter pills — equal flex-1 thirds on one line (no overflow), no
          outline, rounded-xl, red-tinted when active. Second tap clears. */}
      <div className="flex flex-nowrap gap-2 w-full mt-2.5">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange?.(activeFilter === f.id ? null : f.id)}
            aria-pressed={activeFilter === f.id}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2 py-1.5 text-[11px] leading-4 font-medium transition-colors ${
              activeFilter === f.id
                ? 'bg-red-500/10 text-red-400'
                : 'bg-[#161616] text-gray-300 hover:bg-[#222]'
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
