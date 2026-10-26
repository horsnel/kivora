'use client'
// ════════════════════════════════════════════════════════════════════
// StartPage — Kivora Browser new-tab surface (v5.24.6)
// Branded search hero + quick links + recents. HUSH dark, #FF3366 accent.
// ════════════════════════════════════════════════════════════════════
import { useState } from 'react'

export const QUICK_LINKS = [
  { name: 'Google', url: 'https://www.google.com' },
  { name: 'YouTube', url: 'https://www.youtube.com' },
  { name: 'Wikipedia', url: 'https://www.wikipedia.org' },
  { name: 'X', url: 'https://x.com' },
  { name: 'Instagram', url: 'https://www.instagram.com' },
  { name: 'Facebook', url: 'https://www.facebook.com' },
  { name: 'Reddit', url: 'https://www.reddit.com' },
  { name: 'GitHub', url: 'https://github.com' },
  { name: 'Jumia', url: 'https://www.jumia.com.ng' },
  { name: 'BBC News', url: 'https://www.bbc.com/news' },
  { name: 'WhatsApp', url: 'https://web.whatsapp.com' },
  { name: 'Amazon', url: 'https://www.amazon.com' },
]

export function faviconFor(url) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`
  } catch {
    return ''
  }
}

export default function StartPage({ onNavigate, recents, bookmarks, t }) {
  const [q, setQ] = useState('')
  const [imgErr, setImgErr] = useState({})

  const submit = (e) => {
    e.preventDefault()
    if (q.trim()) onNavigate(q.trim())
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-[#0a0a0a]">
      <div className="mx-auto w-full max-w-xl px-5 pt-14 pb-24">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#141414] border border-white/[0.08] flex items-center justify-center shadow-[0_0_40px_rgba(255,51,102,0.15)]">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FF3366" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-[#fafafa]">
            Kivora <span className="text-[#FF3366]">Browser</span>
          </h1>
          <p className="mt-1 text-xs text-[#737373]">{t('browser.tagline')}</p>
        </div>

        {/* Omnibox */}
        <form onSubmit={submit} className="mt-7" role="search">
          <div className="flex items-center gap-2.5 bg-[#141414] border border-white/[0.08] focus-within:border-[#FF3366]/60 rounded-2xl px-4 h-12 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('browser.url_placeholder')}
              aria-label={t('browser.url_placeholder')}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className="flex-1 bg-transparent outline-none text-sm text-[#fafafa] placeholder:text-[#525252]"
            />
          </div>
        </form>

        {/* Quick links */}
        <h2 className="mt-9 mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#525252]">{t('browser.quick_links')}</h2>
        <div className="grid grid-cols-4 gap-2.5">
          {QUICK_LINKS.map((l) => (
            <button
              key={l.name}
              onClick={() => onNavigate(l.url)}
              className="group flex flex-col items-center gap-1.5 rounded-xl bg-[#111111] border border-white/[0.05] hover:border-white/[0.14] active:scale-95 transition-all px-1 py-3"
            >
              <span className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-white/[0.06] flex items-center justify-center overflow-hidden">
                {imgErr[l.url] ? (
                  <span className="text-xs font-bold text-[#FF3366]">{l.name[0]}</span>
                ) : (
                  <img
                    src={faviconFor(l.url)}
                    alt=""
                    width="20"
                    height="20"
                    loading="lazy"
                    onError={() => setImgErr((s) => ({ ...s, [l.url]: true }))}
                  />
                )}
              </span>
              <span className="text-[10px] text-[#a3a3a3] group-hover:text-white truncate max-w-full px-0.5">{l.name}</span>
            </button>
          ))}
        </div>

        {/* Bookmarks */}
        {bookmarks?.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#525252]">{t('browser.bookmarks')}</h2>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {bookmarks.slice(0, 12).map((b) => (
                <button
                  key={b.url}
                  onClick={() => onNavigate(b.url)}
                  className="shrink-0 flex items-center gap-2 rounded-full bg-[#141414] border border-white/[0.07] hover:border-white/[0.16] pl-1.5 pr-3.5 py-1.5 transition-colors"
                >
                  <img src={faviconFor(b.url)} alt="" width="16" height="16" className="rounded" onError={(e) => (e.target.style.visibility = 'hidden')} />
                  <span className="text-xs text-[#d4d4d4] max-w-[120px] truncate">{b.title || b.url}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Recents */}
        {recents?.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#525252]">{t('browser.recent')}</h2>
            <div className="space-y-1">
              {recents.slice(0, 6).map((h, i) => (
                <button
                  key={`${h.url}-${i}`}
                  onClick={() => onNavigate(h.url)}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                >
                  <img src={faviconFor(h.url)} alt="" width="16" height="16" className="rounded shrink-0" onError={(e) => (e.target.style.visibility = 'hidden')} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-[#d4d4d4] truncate">{h.title || h.url}</span>
                    <span className="block text-[11px] text-[#525252] truncate">{h.url}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
