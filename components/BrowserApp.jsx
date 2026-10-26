'use client'
// ════════════════════════════════════════════════════════════════════
// BrowserApp — Kivora Browser (v5.24.6)
//
// A full in-web browser rendered as a fixed full-screen surface:
//   - multi-tab engine with per-tab history (back / forward / reload)
//   - omnibox: URL or search (DuckDuckGo), normalized by the same
//     core.mjs rules the server enforces
//   - every site renders through /api/browser/proxy inside a sandboxed
//     opaque-origin iframe (CSP frame-src 'self' compatible, XSS-safe)
//   - reader mode via /api/browser/reader (server-side extraction)
//   - bookmarks + history in localStorage, share, open-externally,
//     desktop-UA toggle, night filter, safe-area aware chrome
// ════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { normalizeInput } from '@/lib/browser/core.mjs'
import StartPage, { faviconFor } from '@/components/browser/StartPage'
import {
  IconArrowLeft,
  IconArrowRight,
  IconClose,
  IconPlus,
  IconBookmark,
  IconBookmarkFill,
  IconShare,
  IconExternal,
  IconTrash,
  IconHome,
  IconClock,
  IconDotsVertical,
  IconSpinner,
  IconBook,
} from '@/components/Icons'

const TABS_KEY = 'kv_browser_tabs_v1'
const BM_KEY = 'kv_browser_bms_v1'
const HIST_KEY = 'kv_browser_hist_v1'
const HIST_CAP = 150

const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const freshTab = () => ({ id: newId(), hist: [null], hi: 0, title: '', reader: false, night: false, desktop: false, key: 0 })

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null')
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}

// ── tiny local icons (not in the shared set) ──────────────────────
const IconReload = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
)
const IconMoon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z" />
  </svg>
)
const IconDesktop = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="2.5" y="4" width="19" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
)

export default function BrowserApp() {
  const { t } = useTranslation()
  const router = useRouter()

  const [tabs, setTabs] = useState(null) // null = not hydrated yet
  const [activeId, setActiveId] = useState(null)
  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawer, setDrawer] = useState(null) // 'bookmarks' | 'history' | null
  const [bookmarks, setBookmarks] = useState([])
  const [history, setHistory] = useState([])
  const [toast, setToast] = useState('')
  const [readerState, setReaderState] = useState({ loading: false, data: null })

  const inputRef = useRef(null)
  const readerCacheRef = useRef(new Map()) // `${tabId}|${url}` → reader payload
  const toastTimer = useRef(null)

  const activeTab = (tabs || []).find((x) => x.id === activeId) || null
  const activeUrl = activeTab ? activeTab.hist[activeTab.hi] : null

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }, [])

  // ── hydrate ──
  useEffect(() => {
    const savedTabs = loadJSON(TABS_KEY, [])
    const bms = loadJSON(BM_KEY, [])
    const hist = loadJSON(HIST_KEY, [])
    setBookmarks(Array.isArray(bms) ? bms : [])
    setHistory(Array.isArray(hist) ? hist : [])
    const clean = (Array.isArray(savedTabs) ? savedTabs : [])
      .filter((x) => x && Array.isArray(x.hist) && x.hist.length)
      .map((x) => ({ ...freshTab(), ...x, loading: false }))
    const initTabs = clean.length ? clean : [freshTab()]
    setTabs(initTabs)
    setActiveId(initTabs[0].id)
  }, [])

  // ── persist (debounced) ──
  useEffect(() => {
    if (!tabs) return
    const id = setTimeout(() => {
      try {
        localStorage.setItem(TABS_KEY, JSON.stringify(tabs.map(({ loading, ...rest }) => rest)))
        localStorage.setItem(BM_KEY, JSON.stringify(bookmarks))
        localStorage.setItem(HIST_KEY, JSON.stringify(history))
      } catch {}
    }, 400)
    return () => clearTimeout(id)
  }, [tabs, bookmarks, history])

  // ── lock page scroll behind the overlay ──
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ── Escape closes chrome layers ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setDrawer(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── omnibox mirrors the active tab's URL ──
  useEffect(() => {
    if (!inputFocused) setInput(activeUrl || '')
  }, [activeUrl, activeId, inputFocused])

  // ── helpers ──
  const patchTab = useCallback((id, patch) => {
    setTabs((prev) => (prev || []).map((x) => (x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)))
  }, [])

  const recordHistory = useCallback((url, title) => {
    if (!url) return
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.url !== url)
      return [{ url, title: title || '', ts: Date.now() }, ...filtered].slice(0, HIST_CAP)
    })
  }, [])

  // ── navigation core ──
  const navigate = useCallback(
    (rawUrl, opts = {}) => {
      const url = rawUrl || null // null → start page
      setMenuOpen(false)
      setDrawer(null)
      setTabs((prev) => {
        if (!prev) return prev
        return prev.map((x) => {
          if (x.id !== activeId) return x
          if (url === null) return { ...x, hist: [null], hi: 0, title: '', key: x.key + 1, loading: false }
          if (opts.replace) {
            const hist = x.hist.slice()
            hist[x.hi] = url
            return { ...x, hist, title: '', key: x.key + 1, loading: true }
          }
          const hist = x.hist.slice(0, x.hi + 1)
          hist.push(url)
          return { ...x, hist, hi: hist.length - 1, title: '', key: x.key + 1, loading: true }
        })
      })
      if (url) recordHistory(url, '')
    },
    [activeId, recordHistory]
  )

  const goBack = useCallback(() => {
    if (!activeTab || activeTab.hi <= 0) return
    const hi = activeTab.hi - 1
    patchTab(activeTab.id, (x) => ({ hi, key: x.key + 1, loading: true, title: '' }))
  }, [activeTab, patchTab])

  const goForward = useCallback(() => {
    if (!activeTab || activeTab.hi >= activeTab.hist.length - 1) return
    const hi = activeTab.hi + 1
    patchTab(activeTab.id, (x) => ({ hi, key: x.key + 1, loading: true, title: '' }))
  }, [activeTab, patchTab])

  const reload = useCallback(() => {
    if (!activeTab) return
    patchTab(activeTab.id, (x) => ({ key: x.key + 1, loading: !!x.hist[x.hi] }))
  }, [activeTab, patchTab])

  const stop = useCallback(() => {
    if (!activeTab) return
    patchTab(activeTab.id, { loading: false })
  }, [activeTab, patchTab])

  const newTab = useCallback(() => {
    const tab = freshTab()
    setTabs((prev) => [...(prev || []), tab])
    setActiveId(tab.id)
    setMenuOpen(false)
    setDrawer(null)
    setTimeout(() => inputRef.current?.blur(), 0)
  }, [])

  const closeTab = useCallback(
    (id) => {
      setTabs((prev) => {
        const list = (prev || []).filter((x) => x.id !== id)
        const next = list.length ? list : [freshTab()]
        if (id === activeId) setActiveId(next[Math.max(0, next.length - 1)].id)
        return next
      })
    },
    [activeId]
  )

  const exitBrowser = useCallback(() => {
    router.push('/dashboard')
  }, [router])

  // ── per-URL effects for the ACTIVE tab ──
  const fxUrl = activeTab ? activeUrl : null
  const fxKey = `${activeId}|${fxUrl || ''}`

  // tab title via reader meta
  useEffect(() => {
    if (!fxUrl) return
    let dead = false
    fetch(`/api/browser/reader?meta=1&url=${encodeURIComponent(fxUrl)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!dead && d?.ok && d.title) {
          patchTab(activeId, (x) => (x.hist[x.hi] === fxUrl ? { title: String(d.title).slice(0, 80) } : {}))
          setHistory((prev) => prev.map((h) => (h.url === fxUrl && !h.title ? { ...h, title: String(d.title).slice(0, 80) } : h)))
        }
      })
      .catch(() => {})
    return () => {
      dead = true
    }
  }, [fxKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // reader mode payload
  useEffect(() => {
    if (!activeTab || !activeTab.reader || !fxUrl) {
      setReaderState({ loading: false, data: null })
      return
    }
    const ck = `${activeId}|${fxUrl}`
    const hit = readerCacheRef.current.get(ck)
    if (hit) {
      setReaderState({ loading: false, data: hit })
      return
    }
    setReaderState({ loading: true, data: null })
    let dead = false
    fetch(`/api/browser/reader?url=${encodeURIComponent(fxUrl)}`)
      .then((r) => r.json())
      .then((d) => {
        const payload = d?.ok ? { title: d.title || '', html: d.html || '', wc: d.wordCount || 0, empty: !d.html } : { err: d?.reason || 'error' }
        readerCacheRef.current.set(ck, payload)
        if (!dead) setReaderState({ loading: false, data: payload })
      })
      .catch(() => {
        const payload = { err: 'network_error' }
        readerCacheRef.current.set(ck, payload)
        if (!dead) setReaderState({ loading: false, data: payload })
      })
    return () => {
      dead = true
    }
  }, [fxKey, activeTab?.reader]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── omnibox submit ──
  const submitInput = (e) => {
    e.preventDefault()
    const q = input.trim()
    if (!q) return
    inputRef.current?.blur()
    const { url } = normalizeInput(q)
    if (url) navigate(url)
  }

  // ── bookmarks ──
  const isBookmarked = activeUrl && bookmarks.some((b) => b.url === activeUrl)
  const toggleBookmark = () => {
    if (!activeUrl) return
    if (isBookmarked) {
      setBookmarks((prev) => prev.filter((b) => b.url !== activeUrl))
      showToast(t('browser.bookmark_removed'))
    } else {
      setBookmarks((prev) => [{ url: activeUrl, title: activeTab?.title || activeUrl, ts: Date.now() }, ...prev].slice(0, 200))
      showToast(t('browser.bookmark_added'))
    }
    setMenuOpen(false)
  }

  const shareCurrent = async () => {
    setMenuOpen(false)
    if (!activeUrl) return
    try {
      if (navigator.share) await navigator.share({ title: activeTab?.title || 'Kivora Browser', url: activeUrl })
      else {
        await navigator.clipboard.writeText(activeUrl)
        showToast(t('browser.copied'))
      }
    } catch {}
  }

  const clearHistory = () => {
    setHistory([])
    setDrawer(null)
    showToast(t('browser.history_cleared'))
  }

  // ── iframe src (kb busts identical-URL reloads) ──
  const iframeSrc = activeUrl
    ? `/api/browser/proxy?url=${encodeURIComponent(activeUrl)}${activeTab?.desktop ? '&ua=desktop' : ''}&kb=${activeTab?.key || 0}`
    : null

  if (!tabs) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex items-center justify-center">
        <IconSpinner size={22} className="text-[#FF3366]" />
      </div>
    )
  }

  const canBack = activeTab && activeTab.hi > 0
  const canFwd = activeTab && activeTab.hi < activeTab.hist.length - 1

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col select-none" role="application" aria-label={t('browser.title')}>
      {/* ── toolbar ── */}
      <header className="shrink-0 bg-[#0f0f0f] border-b border-white/[0.06] pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-1.5 px-2.5 py-2">
          <button onClick={goBack} disabled={!canBack} aria-label={t('browser.back')} className="w-9 h-9 rounded-xl flex items-center justify-center text-[#a3a3a3] disabled:text-[#3a3a3a] hover:bg-white/[0.06] transition-colors">
            <IconArrowLeft size={17} />
          </button>
          <button onClick={goForward} disabled={!canFwd} aria-label={t('browser.forward')} className="w-9 h-9 rounded-xl flex items-center justify-center text-[#a3a3a3] disabled:text-[#3a3a3a] hover:bg-white/[0.06] transition-colors">
            <IconArrowRight size={17} />
          </button>

          <form onSubmit={submitInput} className="flex-1 min-w-0">
            <div className="flex items-center gap-2 bg-[#161616] border border-white/[0.07] focus-within:border-[#FF3366]/60 rounded-xl h-9 px-3 transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#525252" strokeWidth="2" strokeLinecap="round" className="shrink-0" aria-hidden="true">
                {activeUrl ? <path d="M12 2a10 10 0 0 0 0 20 10 10 0 0 0 0-20Zm0 0c2.5 2.4 4 5.9 4 10s-1.5 7.6-4 10c-2.5-2.4-4-5.9-4-10s1.5-7.6 4-10ZM2.5 9.5h19M2.5 14.5h19" /> : <circle cx="11" cy="11" r="7" />}
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={(e) => {
                  setInputFocused(true)
                  e.target.select()
                }}
                onBlur={() => setInputFocused(false)}
                placeholder={t('browser.url_placeholder')}
                aria-label={t('browser.url_placeholder')}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                inputMode="url"
                className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-[#fafafa] placeholder:text-[#525252]"
              />
            </div>
          </form>

          {activeTab?.loading ? (
            <button onClick={stop} aria-label={t('browser.stop')} className="w-9 h-9 rounded-xl flex items-center justify-center text-[#a3a3a3] hover:bg-white/[0.06] transition-colors">
              <IconClose size={15} />
            </button>
          ) : (
            <button onClick={reload} aria-label={t('browser.reload')} className="w-9 h-9 rounded-xl flex items-center justify-center text-[#a3a3a3] hover:bg-white/[0.06] transition-colors">
              <IconReload size={15} />
            </button>
          )}
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} aria-label={t('browser.menu')} aria-expanded={menuOpen} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${menuOpen ? 'bg-white/[0.08] text-white' : 'text-[#a3a3a3] hover:bg-white/[0.06]'}`}>
              <IconDotsVertical size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-10 z-20 w-56 rounded-2xl bg-[#161616] border border-white/[0.09] shadow-2xl shadow-black/60 py-1.5 overflow-hidden">
                  {[
                    {
                      icon: <IconBook size={15} />,
                      label: t('browser.reader'),
                      on: !!activeTab?.reader,
                      disabled: !activeUrl,
                      act: () => patchTab(activeId, (x) => ({ reader: !x.reader })),
                    },
                    {
                      icon: <IconDesktop size={15} />,
                      label: t('browser.desktop'),
                      on: !!activeTab?.desktop,
                      disabled: !activeUrl,
                      act: () => patchTab(activeId, (x) => ({ desktop: !x.desktop, key: x.key + 1, loading: true })),
                    },
                    {
                      icon: <IconMoon size={15} />,
                      label: t('browser.night'),
                      on: !!activeTab?.night,
                      disabled: !activeUrl,
                      act: () => patchTab(activeId, (x) => ({ night: !x.night })),
                    },
                    { divider: true },
                    {
                      icon: isBookmarked ? <IconBookmarkFill size={15} className="text-[#FF3366]" /> : <IconBookmark size={15} />,
                      label: isBookmarked ? t('browser.remove_bookmark') : t('browser.add_bookmark'),
                      disabled: !activeUrl,
                      act: toggleBookmark,
                    },
                    { icon: <IconShare size={15} />, label: t('browser.share'), disabled: !activeUrl, act: shareCurrent },
                    {
                      icon: <IconExternal size={15} />,
                      label: t('browser.open_external'),
                      disabled: !activeUrl,
                      act: () => {
                        setMenuOpen(false)
                        window.open(activeUrl, '_blank', 'noopener,noreferrer')
                      },
                    },
                    { divider: true },
                    { icon: <IconTrash size={15} />, label: t('browser.clear_history'), disabled: !history.length, act: clearHistory },
                    { icon: <IconClose size={15} />, label: t('browser.exit'), act: exitBrowser },
                  ].map((item, i) =>
                    item.divider ? (
                      <div key={`d${i}`} className="my-1.5 border-t border-white/[0.06]" />
                    ) : (
                      <button
                        key={item.label}
                        onClick={item.act}
                        disabled={item.disabled}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors ${
                          item.on ? 'text-[#FF3366]' : 'text-[#d4d4d4]'
                        } ${item.disabled ? 'opacity-40' : 'hover:bg-white/[0.05]'}`}
                      >
                        {item.icon}
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.on && <span className="w-1.5 h-1.5 rounded-full bg-[#FF3366]" />}
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {activeTab?.loading && <div className="h-0.5 bg-[#FF3366]/70 animate-pulse" />}
      </header>

      {/* ── tab strip ── */}
      <nav className="shrink-0 bg-[#0c0c0c] border-b border-white/[0.05] flex items-center gap-1 px-2 py-1.5 overflow-x-auto no-scrollbar" aria-label={t('browser.tabs')}>
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setActiveId(x.id)}
            className={`group shrink-0 flex items-center gap-1.5 h-8 max-w-[150px] rounded-lg px-2.5 border transition-colors ${
              x.id === activeId ? 'bg-[#1a1a1a] border-[#FF3366]/50 text-white' : 'bg-[#111111] border-white/[0.05] text-[#737373] hover:text-[#a3a3a3]'
            }`}
          >
            {x.hist[x.hi] ? (
              <img src={faviconFor(x.hist[x.hi])} alt="" width="14" height="14" className="rounded-sm shrink-0" onError={(e) => (e.target.style.visibility = 'hidden')} />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF3366" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
              </svg>
            )}
            <span className="text-[11px] truncate flex-1 text-left">{x.hist[x.hi] ? x.title || new URL(x.hist[x.hi]).hostname : t('browser.new_tab_short')}</span>
            <span
              role="button"
              aria-label={t('browser.close_tab')}
              onClick={(e) => {
                e.stopPropagation()
                closeTab(x.id)
              }}
              className="shrink-0 -mr-0.5 w-4 h-4 rounded flex items-center justify-center hover:bg-white/10 text-[#525252] hover:text-white"
            >
              <IconClose size={10} />
            </span>
          </button>
        ))}
        <button onClick={newTab} aria-label={t('browser.new_tab')} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#a3a3a3] hover:bg-white/[0.06] transition-colors">
          <IconPlus size={15} />
        </button>
      </nav>

      {/* ── content ── */}
      <main className="flex-1 min-h-0 relative bg-[#0a0a0a]">
        {!activeUrl ? (
          <StartPage onNavigate={(u) => navigate(u)} recents={history} bookmarks={bookmarks} t={t} />
        ) : activeTab?.reader ? (
          readerState.loading ? (
            <div className="h-full flex items-center justify-center">
              <IconSpinner size={20} className="text-[#FF3366]" />
            </div>
          ) : readerState.data && !readerState.data.err && readerState.data.html ? (
            <div className="h-full overflow-y-auto overscroll-contain">
              <article
                onClick={(e) => {
                  const a = e.target.closest && e.target.closest('a')
                  if (a && a.href) {
                    e.preventDefault()
                    try {
                      navigate(new URL(a.href).href)
                    } catch {}
                  }
                }}
                className="mx-auto max-w-2xl px-5 pt-7 pb-24 select-text [&_h1]:text-[22px] [&_h1]:font-semibold [&_h1]:text-white [&_h1]:mt-7 [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-6 [&_h2]:mb-2.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#fafafa] [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-[#fafafa] [&_h5]:text-sm [&_h5]:font-semibold [&_h5]:text-[#a3a3a3] [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:text-[#737373] [&_p]:text-[15px] [&_p]:leading-7 [&_p]:text-[#d4d4d4] [&_p]:my-3.5 [&_li]:text-[14px] [&_li]:leading-6 [&_li]:text-[#d4d4d4] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3 [&_a]:text-[#FF3366] [&_a]:underline [&_a]:decoration-[#FF3366]/40 [&_img]:rounded-xl [&_img]:my-4 [&_img]:max-w-full [&_img]:h-auto [&_blockquote]:border-l-2 [&_blockquote]:border-[#FF3366]/60 [&_blockquote]:pl-4 [&_blockquote]:my-4 [&_blockquote]:text-[#a3a3a3] [&_pre]:bg-[#111111] [&_pre]:border [&_pre]:border-white/[0.07] [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:text-[12px] [&_code]:text-[13px] [&_table]:w-full [&_table]:text-[13px] [&_td]:border-t [&_td]:border-white/[0.08] [&_td]:px-2 [&_td]:py-1.5 [&_th]:border-t [&_th]:border-white/[0.08] [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_figure]:my-5 [&_figcaption]:text-[11px] [&_figcaption]:text-[#525252] [&_figcaption]:text-center [&_figcaption]:mt-2"
              >
                {readerState.data.title && <h1 className="!mt-0">{readerState.data.title}</h1>}
                <div dangerouslySetInnerHTML={{ __html: readerState.data.html }} />
              </article>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
              <IconBook size={26} className="text-[#3a3a3a]" />
              <p className="text-sm text-[#737373]">{t('browser.reader_empty')}</p>
              <button onClick={() => patchTab(activeId, { reader: false })} className="mt-1 px-5 py-2 rounded-xl bg-[#1a1a1a] border border-white/[0.08] text-[13px] text-[#d4d4d4] hover:text-white transition-colors">
                {t('browser.exit_reader')}
              </button>
            </div>
          )
        ) : (
          <iframe
            key={`${activeId}-${activeTab?.key || 0}`}
            src={iframeSrc}
            title={activeTab?.title || activeUrl || 'Kivora Browser'}
            onLoad={() => patchTab(activeId, { loading: false })}
            onError={() => patchTab(activeId, { loading: false })}
            sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
            referrerPolicy="no-referrer"
            allow="fullscreen"
            className={`w-full h-full border-0 bg-white ${activeTab?.night ? 'kivora-night' : ''}`}
            style={activeTab?.night ? { filter: 'invert(0.92) hue-rotate(180deg)' } : undefined}
          />
        )}
      </main>

      {/* ── bottom bar ── */}
      <footer className="shrink-0 bg-[#0f0f0f] border-t border-white/[0.06] pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4">
          {[
            { icon: <IconHome size={18} />, label: t('browser.home'), act: () => navigate(null) },
            { icon: <IconClock size={18} />, label: t('browser.history'), act: () => setDrawer('history') },
            {
              icon: isBookmarked ? <IconBookmarkFill size={18} className="text-[#FF3366]" /> : <IconBookmark size={18} />,
              label: t('browser.bookmarks'),
              act: () => setDrawer('bookmarks'),
            },
            { icon: <IconPlus size={18} />, label: `${t('browser.new_tab_short')}${tabs.length > 1 ? ` · ${tabs.length}` : ''}`, act: newTab },
          ].map((b) => (
            <button key={b.label} onClick={b.act} className="flex flex-col items-center gap-1 py-2.5 text-[#737373] hover:text-[#d4d4d4] active:scale-95 transition-all min-h-[52px] justify-center">
              {b.icon}
              <span className="text-[10px] leading-none max-w-[90px] truncate">{b.label}</span>
            </button>
          ))}
        </div>
      </footer>

      {/* ── drawers ── */}
      {drawer && (
        <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(null)} />
          <div className="absolute left-0 right-0 bottom-0 max-h-[68vh] flex flex-col rounded-t-2xl bg-[#131313] border-t border-white/[0.09] shadow-2xl shadow-black/70">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.05]">
              <h2 className="text-sm font-semibold text-white">{drawer === 'bookmarks' ? t('browser.bookmarks') : t('browser.history')}</h2>
              <div className="flex items-center gap-2">
                {drawer === 'history' && history.length > 0 && (
                  <button onClick={clearHistory} className="text-[11px] text-[#737373] hover:text-[#FF3366] transition-colors">
                    {t('browser.clear_history')}
                  </button>
                )}
                <button onClick={() => setDrawer(null)} aria-label={t('common.close')} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#737373] hover:bg-white/[0.06] hover:text-white transition-colors">
                  <IconClose size={14} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto overscroll-contain px-2 py-2">
              {drawer === 'bookmarks' ? (
                bookmarks.length ? (
                  bookmarks.map((b) => (
                    <div key={b.url} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04]">
                      <img src={faviconFor(b.url)} alt="" width="16" height="16" className="rounded shrink-0" onError={(e) => (e.target.style.visibility = 'hidden')} />
                      <button onClick={() => navigate(b.url)} className="flex-1 min-w-0 text-left">
                        <span className="block text-[13px] text-[#e5e5e5] truncate">{b.title || b.url}</span>
                        <span className="block text-[11px] text-[#525252] truncate">{b.url}</span>
                      </button>
                      <button
                        onClick={() => setBookmarks((prev) => prev.filter((x) => x.url !== b.url))}
                        aria-label={t('browser.remove_bookmark')}
                        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[#525252] hover:text-[#FF3366] transition-colors"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="px-4 py-10 text-center text-[13px] text-[#525252]">{t('browser.no_bookmarks')}</p>
                )
              ) : history.length ? (
                history.map((h, i) => (
                  <div key={`${h.url}-${i}`} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04]">
                    <img src={faviconFor(h.url)} alt="" width="16" height="16" className="rounded shrink-0" onError={(e) => (e.target.style.visibility = 'hidden')} />
                    <button onClick={() => navigate(h.url)} className="flex-1 min-w-0 text-left">
                      <span className="block text-[13px] text-[#e5e5e5] truncate">{h.title || h.url}</span>
                      <span className="block text-[11px] text-[#525252] truncate">{h.url}</span>
                    </button>
                  </div>
                ))
              ) : (
                <p className="px-4 py-10 text-center text-[13px] text-[#525252]">{t('browser.no_history')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── toast ── */}
      {toast && (
        <div role="status" className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[120] px-4 py-2 rounded-full bg-[#1f1f1f] border border-white/[0.1] text-[12px] text-white shadow-xl shadow-black/50">
          {toast}
        </div>
      )}
    </div>
  )
}
