'use client'

// ── Coming Soon Popup ──────────────────────────────────────────
// A modal overlay that tells users a feature is coming soon.
// Used to gate premium features (voice, etc.) for non-Max/Team users.

export default function ComingSoonPopup({ feature, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-[#111] border border-[#262626] rounded-2xl p-6 sm:p-8 max-w-sm w-[90vw] text-center shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#1a1a1a] text-[#737373] hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg>
        </button>

        {/* Icon */}
        <div className="w-12 h-12 bg-red-950/30 border border-red-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>

        <h3 className="text-lg font-bold text-white mb-2">Coming Soon</h3>
        <p className="text-sm text-[#a3a3a3] mb-4">
          {feature || 'This feature'} is currently in development and will be available in a future update.
          Stay tuned!
        </p>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-white rounded-xl text-sm font-medium transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
