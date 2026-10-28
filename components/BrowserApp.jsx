'use client'
// ════════════════════════════════════════════════════════════════════
// BrowserApp — Kivora Browser as a DevTools-style bottom drawer (v5.24.7)
//
// Mounted once by BrowserProvider (root layout) on every page. Appears
// exactly like the terminal drawer in browser DevTools:
//   - slides up from the bottom edge over the current page
//   - drag handle on top: drag to any height, release snaps to
//     half (50dvh) / tall (85dvh) / full (100dvh); drag down to dismiss
//   - double-tap the handle toggles half ↔ full
//   - session survives open/close (component stays mounted, tabbed state
//     persists) — the page behind stays alive at partial heights
//
// Engine (unchanged from v5.24.6, hardened):
//   - multi-tab with per-tab history (back/forward/reload)
//   - omnibox styled with the platform's kivora-input-wrap text bar
//   - all sites render through /api/browser/proxy in a sandboxed
//     opaque-origin iframe (CSP frame-src 'self' compatible)
//   - reader mode, night filter, desktop UA, bookmarks, history, share
//   - thick 2.2-stroke icon set + solid #262626 element lines to match
//     the platform's visual weight
// ════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import { normalizeInput } from '@/lib/browser/core.mjs'
import StartPage, { faviconFor } from '@/components/browser/StartPage'
import DevToolsDock from '@/components/browser/DevToolsDock'
import { XGlyph } from '@/components/BackButton'
import MarkdownRenderer from '@/components/MarkdownRenderer'

const TABS_KEY = 'kv_browser_tabs_v1'
const SESS_KEY = 'kv_browser_session_v1' // { activeId, open, ts } — shared with BrowserProvider
const BM_KEY = 'kv_browser_bms_v1'
const HIST_KEY = 'kv_browser_hist_v1'
const HIST_CAP = 150

const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const freshTab = () => ({ id: newId(), ks: freshKsId(), hist: [null], hi: 0, title: '', reader: false, night: false, desktop: false, key: 0, mounted: true })

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null')
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}

// ── thick icon set — every chrome icon drawn at stroke 2.2 so the whole
//    browser matches the platform's visual weight (user ask: "platform
//    icons are thick, elements are thicker lines") ─────────────────────
const mk = (children, filled) =>
  function Icon({ size = 18, className = '' }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? 'currentColor' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {children}
      </svg>
    )
  }

const IconBack = mk(<path d="M15 19l-7-7 7-7" />)   // reference design #1 — chevron-back
const IconFwd = mk(<path d="M9 5l7 7-7 7" />)
const IconX = mk(<path d="M6 18L18 6M6 6l12 12" />) // reference design #2 — soft-circle X path
const IconPlus = mk(<><path d="M12 5v14" /><path d="M5 12h14" /></>)
const IconReload = mk(<><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>)
const IconMoon = mk(<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z" />)
const IconDesktop = mk(<><rect x="2.5" y="4" width="19" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>)
const IconDots = mk(<><circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" /></>)
const IconHome = mk(<><path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>)
const IconSparkle = mk(<><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" /></>)
const IconClock = mk(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>)
const IconTrash = mk(<><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></>)
const IconCode = mk(<><path d="M8 6l-6 6 6 6" /><path d="M16 6l6 6-6 6" /></>)
const IconBook = mk(<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />)
const IconShare = mk(<><path d="M12 3v13" /><path d="M8 7l4-4 4 4" /><path d="M5 12v8h14v-8" /></>)
const IconExternal = mk(<><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M19 14v6H4V5h6" /></>)
const IconBm = mk(<path d="M6 3h12v18l-6-4.5L6 21V3Z" />)
const IconBmFill = mk(<path d="M6 3h12v18l-6-4.5L6 21V3Z" />, true)
const IconSearch = mk(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>)
const IconGlobe = mk(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18Z" /></>)
const IconChevUp = mk(<path d="M6 15l6-6 6 6" />)
const IconChevDown = mk(<path d="M6 9l6 6 6-6" />)
const IconSpinner = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`} aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.2" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
)
const KMark = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path d="M16 4L6 24L16 18Z" fill="#FF3366" opacity="0.95" />
    <path d="M16 4L26 24L16 18Z" fill="#FF3366" opacity="0.55" />
  </svg>
)

const SNAPS = ['half', 'tall', 'full']
const PCT = { half: 0.5, tall: 0.85, full: 1 }

// v5.30 — stable per-device browser-session id. The service worker keys
// the cookie jar on it (Cache API), so signed-in sites survive browser
// open/close just like a real browser profile. Not tied to the account:
// cookies are a device concept, like localStorage.
// v5.30.3 — PER-TAB COOKIE PROFILES: every TAB carries its own `ks`
// (persisted in the tab object), so each tab is an isolated site-session
// profile — sign in as two different users in two tabs, no bleed. The
// device-level id below remains as the fallback for tabs created before
// per-tab profiles existed.
const KS_KEY = 'kv_browser_ks_v1'
function freshKsId() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return 'ks' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
function browserSessionId() {
  try {
    let v = localStorage.getItem(KS_KEY)
    if (!v || !/^ks[\w-]{8,64}$/.test(v)) {
      v = freshKsId()
      localStorage.setItem(KS_KEY, v)
    }
    return v
  } catch {
    return 'ks-fallback'
  }
}

export default function BrowserApp({ open, onClose, pending }) {
  const { t, lang } = useTranslation()
  const ksRef = useRef(null)
  if (!ksRef.current) ksRef.current = browserSessionId()

  const [tabs, setTabs] = useState(null) // null = not hydrated yet
  const [activeId, setActiveId] = useState(null)
  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawer, setDrawer] = useState(null) // 'bookmarks' | 'history' | 'ai' | null
  // v5.30.3 — page-aware AI actions (summarize / links / facts / translate)
  const [aiRes, setAiRes] = useState(null) // { task, url, loading, result, error }
  const [bookmarks, setBookmarks] = useState([])
  const [history, setHistory] = useState([])
  const [toast, setToast] = useState('')
  const [readerState, setReaderState] = useState({ loading: false, data: null })

  // ── DevTools (per-tab data via ref store + global UI state) ──
  const [dtOpen, setDtOpen] = useState(false)
  const [dtCollapsed, setDtCollapsed] = useState(false)
  const [dtTab, setDtTab] = useState('console')
  const dtStore = useRef(new Map()) // tabId → { console, net, tree, perf, meta, findCount, pickerOn, picked }
  const [, setDtTick] = useState(0)
  const dt = activeId ? dtStore.current.get(activeId) || null : null

  // ── drawer geometry ──
  const [snap, setSnap] = useState('half')
  const [dragging, setDragging] = useState(false)
  const [dragH, setDragH] = useState(null)

  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const readerCacheRef = useRef(new Map())
  const toastTimer = useRef(null)
  const dragRef = useRef(null)
  const dragHRef = useRef(null)
  const lastHandleTap = useRef(0)
  const frameRefs = useRef({}) // tabId → iframe element

  const activeTab = (tabs || []).find((x) => x.id === activeId) || null
  const activeUrl = activeTab ? activeTab.hist[activeTab.hi] : null

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }, [])

  // ── DevTools per-tab store helpers (MUST precede every effect that
  //    references them — a later declaration is a TDZ crash, v5.25.1) ──
  const freshDt = () => ({ console: [], net: [], tree: null, perf: null, meta: null, findCount: null, pickerOn: false, picked: null })
  const dtMut = useCallback((tabId, fn) => {
    if (!tabId) return
    let s = dtStore.current.get(tabId)
    if (!s) {
      s = freshDt()
      dtStore.current.set(tabId, s)
    }
    fn(s)
    setDtTick((v) => v + 1)
  }, [])
  const dtReset = useCallback((tabId) => {
    if (tabId) dtStore.current.set(tabId, freshDt())
  }, [])
  const sendToAgent = useCallback(
    (cmd, tabId) => {
      const id = tabId || activeId
      const win = id && frameRefs.current[id] && frameRefs.current[id].contentWindow
      if (!win) return
      try {
        win.postMessage({ __kv_dt: 1, side: 'dock', ...cmd }, '*')
      } catch {}
    },
    [activeId]
  )

  // ── engine ──
  const patchTab = useCallback((id, patch) => {
    setTabs((prev) => (prev || []).map((x) => (x.id === id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)))
  }, [])

  // ── hydrate (once) — v5.26: restore the LAST-ACTIVE tab, not tab #1 ──
  // Tabs persist to localStorage; the session key adds which tab was on
  // screen when the app went away. Only the restored active tab mounts
  // up front — the freshTab() spread defaults mounted:true, so every
  // restored tab would otherwise load its iframe SIMULTANEOUSLY on
  // refresh (N parallel proxy fetches on mobile data). Inactive tabs
  // mount lazily on activateTab(), exactly like brand-new ones.
  useEffect(() => {
    const savedTabs = loadJSON(TABS_KEY, [])
    const bms = loadJSON(BM_KEY, [])
    const hist = loadJSON(HIST_KEY, [])
    const sess = loadJSON(SESS_KEY, null)
    setBookmarks(Array.isArray(bms) ? bms : [])
    setHistory(Array.isArray(hist) ? hist : [])
    const clean = (Array.isArray(savedTabs) ? savedTabs : [])
      .filter((x) => x && Array.isArray(x.hist) && x.hist.length)
      .map((x) => ({ ...freshTab(), ...x, loading: false, mounted: false }))
    const initTabs = clean.length ? clean : [freshTab()]
    const want = sess && sess.activeId
    const act = initTabs.find((x) => x.id === want) || initTabs.find((x) => x.hist[x.hi]) || initTabs[0]
    act.mounted = true
    setTabs(initTabs)
    setActiveId(act.id)
  }, [])

  // ── persist (debounced) — tabs + the last-active tab id (v5.26) ──
  useEffect(() => {
    if (!tabs) return
    const id = setTimeout(() => {
      try {
        localStorage.setItem(TABS_KEY, JSON.stringify(tabs.map(({ loading, mounted, ...rest }) => rest)))
        localStorage.setItem(BM_KEY, JSON.stringify(bookmarks))
        localStorage.setItem(HIST_KEY, JSON.stringify(history))
        try {
          localStorage.setItem(SESS_KEY, JSON.stringify({ ...(loadJSON(SESS_KEY, {}) || {}), activeId, ts: Date.now() }))
        } catch {}
      } catch {}
    }, 250)
    return () => clearTimeout(id)
  }, [tabs, bookmarks, history, activeId])

  // ── Escape: close inner layers first, then the drawer itself ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (menuOpen) return setMenuOpen(false)
      if (drawer) return setDrawer(null)
      if (open) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen, drawer, open, onClose])

  // ── openBrowser(url) requests from the global link capture ──
  useEffect(() => {
    if (!pending || !tabs) return
    setMenuOpen(false)
    setDrawer(null)
    dtReset(activeId)
    setTabs((prev) =>
      (prev || []).map((x) => {
        if (x.id !== activeId) return x
        const hist = x.hist.slice(0, x.hi + 1)
        hist.push(pending.url)
        return { ...x, hist, hi: hist.length - 1, title: '', key: x.key + 1, loading: true, reader: false, mounted: true }
      })
    )
    setHistory((prev) => [{ url: pending.url, title: '', ts: Date.now() }, ...prev.filter((h) => h.url !== pending.url)].slice(0, HIST_CAP))
  }, [pending?.n]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── agent message bus (the ONLY channel into the sandboxed frames) ──
  useEffect(() => {
    const onMsg = (e) => {
      let d = e.data
      if (typeof d === 'string') {
        try {
          d = JSON.parse(d)
        } catch {
          return
        }
      }
      if (!d || d.__kv_dt !== 1 || d.side !== 'agent') return
      // attribute the message to the iframe it came from
      let tid = null
      for (const [id, el] of Object.entries(frameRefs.current)) {
        if (el && el.contentWindow === e.source) {
          tid = id
          break
        }
      }
      if (!tid) return
      switch (d.type) {
        case 'hello':
          dtMut(tid, (s) => {
            if (d.meta) s.meta = d.meta
            if (Array.isArray(d.replay?.console) && d.replay.console.length && !s.console.length) s.console = d.replay.console.slice(-300)
            if (Array.isArray(d.replay?.net) && d.replay.net.length && !s.net.length) s.net = d.replay.net.slice(-300)
          })
          if (d.meta?.title) {
            patchTab(tid, (x) => (x.hist[x.hi] ? { title: String(d.meta.title).slice(0, 80) } : {}))
            setHistory((prev) => prev.map((h) => (h.url === (d.meta && d.meta.url) && !h.title ? { ...h, title: String(d.meta.title).slice(0, 80) } : h)))
          }
          break
        case 'nav':
          if (d.title) patchTab(tid, (x) => (x.hist[x.hi] ? { title: String(d.title).slice(0, 80) } : {}))
          break
        case 'console':
        case 'error':
          dtMut(tid, (s) => {
            s.console = [...s.console, { level: d.level || 'log', args: d.args || [], ts: d.ts || Date.now() }].slice(-300)
          })
          break
        case 'net':
          dtMut(tid, (s) => {
            s.net = [...s.net, { method: d.method, url: d.url, status: d.status, ms: d.ms }].slice(-300)
          })
          break
        case 'perf':
          dtMut(tid, (s) => {
            s.perf = d
          })
          break
        case 'inspect':
          dtMut(tid, (s) => {
            s.tree = d.tree || null
          })
          break
        case 'eval':
          dtMut(tid, (s) => {
            s.console = [...s.console, { level: d.ok ? 'eval-ok' : 'eval-err', args: d.ok ? [d.value == null ? '' : d.value] : [{ s: d.error || 'Error' }], ts: Date.now() }].slice(-300)
          })
          break
        case 'find':
          dtMut(tid, (s) => {
            s.findCount = typeof d.count === 'number' ? d.count : null
          })
          break
        case 'picked':
          dtMut(tid, (s) => {
            s.picked = d.node || null
            s.pickerOn = false
          })
          break
        case 'close':
          // error pages post this from their "Back to Kivora" button —
          // the only sane exit from inside the opaque-origin frame
          onClose()
          break
        default:
          break
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [dtMut, patchTab, onClose])

  // ── DevTools perf subscription + on-demand inspect ──
  useEffect(() => {
    if (!dtOpen || !activeId) return
    const win = frameRefs.current[activeId] && frameRefs.current[activeId].contentWindow
    if (!win) return
    try {
      win.postMessage({ __kv_dt: 1, side: 'dock', type: 'perfSub', on: true }, '*')
    } catch {}
    return () => {
      try {
        win.postMessage({ __kv_dt: 1, side: 'dock', type: 'perfSub', on: false }, '*')
      } catch {}
    }
  }, [dtOpen, activeId])

  useEffect(() => {
    if (!dtOpen || dtTab !== 'elements' || !activeId) return
    const s = dtStore.current.get(activeId)
    if (s && !s.tree) sendToAgent({ type: 'inspect' })
  }, [dtOpen, dtTab, activeId, sendToAgent])

  // ── omnibox mirrors the active tab's URL ──
  useEffect(() => {
    if (!inputFocused) setInput(activeUrl || '')
  }, [activeUrl, activeId, inputFocused])

  const navigate = useCallback(
    (rawUrl, opts = {}) => {
      const url = rawUrl || null // null → start page
      setMenuOpen(false)
      setDrawer(null)
      setTabs((prev) => {
        if (!prev) return prev
        return prev.map((x) => {
          if (x.id !== activeId) return x
          if (url === null) return { ...x, hist: [null], hi: 0, title: '', reader: false, key: x.key + 1, loading: false }
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
      if (url) {
        dtReset(activeId) // new document — fresh DevTools buffers
        setAiRes(null) // fresh page → fresh page-actions panel
        setHistory((prev) => [{ url, title: '', ts: Date.now() }, ...prev.filter((h) => h.url !== url)].slice(0, HIST_CAP))
      }
    },
    [activeId, dtReset]
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
    dtReset(activeTab.id)
    patchTab(activeTab.id, (x) => ({ key: x.key + 1, loading: !!x.hist[x.hi] }))
  }, [activeTab, patchTab, dtReset])

  const stop = useCallback(() => {
    if (!activeTab) return
    patchTab(activeTab.id, { loading: false })
  }, [activeTab, patchTab])

  // ── v5.30.3 page-aware AI actions ────────────────────────────────
  // One POST per action; the answer renders as markdown in the drawer.
  // Server metering: anonymous 5/day, free 15/day (same family as
  // DevTools) — the drawer surfaces the daily-limit error verbatim.
  const runPageAction = useCallback(
    async (task) => {
      if (!activeUrl || aiRes?.loading) return
      setAiRes({ task, url: activeUrl, loading: true })
      try {
        const r = await fetch('/api/browser/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: activeUrl, task, lang }),
        })
        const d = await r.json().catch(() => ({}))
        setAiRes({ task, url: activeUrl, loading: false, result: d.result, error: d.error })
      } catch {
        setAiRes({ task, url: activeUrl, loading: false, error: 'Network error — try again.' })
      }
    },
    [activeUrl, aiRes?.loading, lang]
  )

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
      dtStore.current.delete(id)
      delete frameRefs.current[id]
      const list = (tabs || []).filter((x) => x.id !== id)
      const next = list.length ? list : [freshTab()]
      if (id === activeId) {
        const nx = next[Math.max(0, next.length - 1)]
        setActiveId(nx.id)
        // land on a lazily-restored tab → mount it now (blank otherwise)
        setTabs(next.map((x) => (x.id === nx.id && !x.mounted ? { ...x, mounted: true } : x)))
      } else {
        setTabs(next)
      }
    },
    [activeId, tabs]
  )

  const activateTab = useCallback((id) => {
    setActiveId(id)
    setTabs((prev) => (prev || []).map((x) => (x.id === id && !x.mounted ? { ...x, mounted: true } : x)))
  }, [])

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
    setMenuOpen(false)
    if (!activeUrl) return
    if (isBookmarked) {
      setBookmarks((prev) => prev.filter((b) => b.url !== activeUrl))
      showToast(t('browser.bookmark_removed'))
    } else {
      setBookmarks((prev) => [{ url: activeUrl, title: activeTab?.title || activeUrl, ts: Date.now() }, ...prev].slice(0, 200))
      showToast(t('browser.bookmark_added'))
    }
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

  // ── drag-to-resize (DevTools drawer behavior) ──
  // Capture is DEFERRED until the pointer actually moves ≥4px. Capturing on
  // pointerdown alone made an interrupted gesture (shade pull, edge lift,
  // automation abort) strand the capture: every later tap was retargeted to
  // the handle and toolbar buttons went dead — the classic "buttons don't
  // work until a second tap" bug. A plain tap now never captures.
  const onHandlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    const panel = panelRef.current
    if (!panel) return
    dragRef.current = {
      startY: e.clientY,
      startH: panel.getBoundingClientRect().height,
      vh: window.innerHeight || 800,
      lastY: e.clientY,
      lastT: performance.now(),
      v: 0,
      moved: false,
      pid: e.pointerId,
      captured: false,
    }
  }

  const onHandlePointerMove = (e) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.pid) return
    if (!d.captured) {
      if (Math.abs(e.clientY - d.startY) < 4) return // simple tap — never capture
      d.captured = true
      try {
        e.currentTarget.setPointerCapture(d.pid)
      } catch {}
      setDragging(true)
    }
    const dy = d.startY - e.clientY // up = grow
    const h = Math.min(d.vh, Math.max(96, d.startH + dy))
    const now = performance.now()
    const dt = now - d.lastT
    if (dt > 24) {
      d.v = (d.lastY - e.clientY) / dt // > 0 = expanding
      d.lastY = e.clientY
      d.lastT = now
    }
    if (Math.abs(dy) > 4) d.moved = true
    dragHRef.current = h
    setDragH(h)
  }

  const onHandlePointerUp = (e) => {
    const d = dragRef.current
    if (!d) return
    if (d.captured && e && e.currentTarget) {
      try {
        e.currentTarget.releasePointerCapture(d.pid)
      } catch {}
    }
    dragRef.current = null
    setDragging(false)
    const h = dragHRef.current != null ? dragHRef.current : d.startH
    dragHRef.current = null
    setDragH(null)
    if (!d.captured || !d.moved) return // tap on handle = no-op
    const vh = d.vh
    if (h >= vh * 0.9) setSnap('full')
    else if (h < vh * 0.3) onClose() // dragged nearly shut
    else if (d.v < -0.7 && h < vh * 0.72) onClose() // fast downward flick
    else setSnap(h > vh * 0.66 ? 'tall' : 'half')
  }

  // Safety net — if a pointerup/cancel never reaches the handle (OS gesture
  // interruption, tab switch, edge lift), drop any drag state so the chrome
  // can never stay stuck in a capturing/dragging mode.
  useEffect(() => {
    const cleanup = () => {
      if (!dragRef.current) return
      dragRef.current = null
      dragHRef.current = null
      setDragH(null)
      setDragging(false)
    }
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
    window.addEventListener('blur', cleanup)
    return () => {
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      window.removeEventListener('blur', cleanup)
    }
  }, [])

  const onHandleDoubleClick = () => {
    const now = Date.now()
    if (now - lastHandleTap.current < 350) {
      setSnap((s) => (s === 'full' ? 'half' : 'full'))
      lastHandleTap.current = 0
      return
    }
    lastHandleTap.current = now
  }

  const cycleSnap = (dir) => {
    const i = SNAPS.indexOf(snap)
    const next = SNAPS[Math.min(SNAPS.length - 1, Math.max(0, i + dir))]
    if (dir < 0 && i === 0) onClose()
    else setSnap(next)
  }

  const onHandleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      cycleSnap(1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      cycleSnap(-1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setSnap('full')
    } else if (e.key === 'End') {
      e.preventDefault()
      onClose()
    }
  }

  const canBack = activeTab && activeTab.hi > 0
  const canFwd = activeTab && activeTab.hi < activeTab.hist.length - 1
  const heightStyle = dragH != null ? `${dragH}px` : `${Math.round(PCT[snap] * 100)}dvh`

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9990] touch-manipulation"
      style={{
        transform: open ? 'translateY(0)' : 'translateY(110%)',
        visibility: open ? 'visible' : 'hidden',
        transition: dragging
          ? 'none'
          : `transform 340ms cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear ${open ? '0s' : '340ms'}`,
        pointerEvents: open ? 'auto' : 'none',
      }}
      inert={open ? undefined : true}
      aria-hidden={!open}
    >
      <div
        ref={panelRef}
        role="application"
        aria-label={t('browser.title')}
        className={`relative flex flex-col overflow-hidden bg-[#0d0d0d] border-t-2 border-[#FF3366] shadow-[0_-12px_48px_rgba(0,0,0,0.65)] select-none ${
          snap === 'full' && !dragging ? 'rounded-t-none' : 'rounded-t-2xl'
        }`}
        style={{
          height: heightStyle,
          willChange: dragging ? 'height' : undefined,
          transition: dragging ? 'none' : 'height 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* notch/status-bar clearance in full mode */}
        {snap === 'full' && !dragging && <div className="shrink-0 h-[env(safe-area-inset-top)]" />}

        {/* ═══ drag handle — the DevTools-style grab bar ═══ */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('browser.resize_handle')}
          tabIndex={0}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          onDoubleClick={onHandleDoubleClick}
          onKeyDown={onHandleKeyDown}
          className="group relative shrink-0 h-10 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none outline-none focus-visible:bg-white/[0.04]"
        >
          <div className={`w-12 h-1.5 rounded-full transition-colors ${dragging ? 'bg-[#FF3366]' : 'bg-white/25 group-hover:bg-white/45'}`} />
          <span className="absolute left-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#525252] hidden sm:block">
            {t('browser.title')}
          </span>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSnap((s) => (s === 'full' ? 'half' : 'full'))}
              aria-label={snap === 'full' ? t('browser.shrink') : t('browser.maximize')}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#a3a3a3] hover:text-white hover:bg-white/[0.07] active:scale-95 transition-colors"
            >
              {snap === 'full' ? <IconChevDown size={17} /> : <IconChevUp size={17} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="w-9 h-9 rounded-full bg-[#1c1c1c] text-[#a3a3a3] hover:bg-[#262626] hover:text-[#fafafa] active:scale-95 flex items-center justify-center transition-all duration-200"
            >
              <XGlyph size={15} />
            </button>
          </div>
        </div>

        {/* ═══ toolbar ═══ */}
        <header className="relative shrink-0 bg-[#111111] border-y border-[#262626]">
          <div className="flex items-center gap-1 px-2 py-2">
            <button
              type="button"
              onClick={goBack}
              disabled={!canBack}
              aria-label={t('browser.back')}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[#d4d4d4] disabled:text-[#3f3f3f] hover:bg-white/[0.07] hover:text-white active:scale-95 transition-colors"
            >
              <IconBack size={19} />
            </button>
            <button
              type="button"
              onClick={goForward}
              disabled={!canFwd}
              aria-label={t('browser.forward')}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[#d4d4d4] disabled:text-[#3f3f3f] hover:bg-white/[0.07] hover:text-white active:scale-95 transition-colors"
            >
              <IconFwd size={19} />
            </button>

            {/* omnibox — the platform's own text bar (kivora-input-wrap) */}
            <form onSubmit={submitInput} className="flex-1 min-w-0 px-0.5" role="search">
              <div className="relative kivora-input-wrap rounded-2xl">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#525252] pointer-events-none z-10">
                  {activeUrl ? <IconGlobe size={15} /> : <IconSearch size={15} />}
                </span>
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
                  className="w-full bg-[#141414] border border-[#262626] rounded-2xl pl-10 pr-9 h-11 text-[13.5px] text-white placeholder:text-[#525252] transition-all focus:outline-none"
                />
                {input && (
                  <button
                    type="button"
                    onClick={() => {
                      setInput('')
                      inputRef.current?.focus()
                    }}
                    aria-label={t('common.close')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/[0.08] flex items-center justify-center text-[#a3a3a3] hover:text-white z-10"
                  >
                    <IconX size={10} />
                  </button>
                )}
              </div>
            </form>

            {activeTab?.loading ? (
              <button
                type="button"
                onClick={stop}
                aria-label={t('browser.stop')}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[#d4d4d4] hover:bg-white/[0.07] hover:text-white active:scale-95 transition-colors"
              >
                <IconX size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={reload}
                aria-label={t('browser.reload')}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[#d4d4d4] hover:bg-white/[0.07] hover:text-white active:scale-95 transition-colors"
              >
                <IconReload size={17} />
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={t('browser.menu')}
                aria-expanded={menuOpen}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  menuOpen ? 'bg-white/[0.1] text-white' : 'text-[#d4d4d4] hover:bg-white/[0.07] hover:text-white'
                } active:scale-95`}
              >
                <IconDots size={18} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-11 z-40 w-60 rounded-2xl bg-[#161616] border border-[#2e2e2e] shadow-2xl shadow-black/70 py-1.5 overflow-hidden">
                    {[
                      {
                        icon: <IconBook size={17} />,
                        label: t('browser.reader'),
                        on: !!activeTab?.reader,
                        disabled: !activeUrl,
                        act: () => {
                          setMenuOpen(false)
                          patchTab(activeId, (x) => ({ reader: !x.reader }))
                        },
                      },
                      {
                        icon: <IconDesktop size={17} />,
                        label: t('browser.desktop'),
                        on: !!activeTab?.desktop,
                        disabled: !activeUrl,
                        act: () => {
                          setMenuOpen(false)
                          patchTab(activeId, (x) => ({ desktop: !x.desktop, key: x.key + 1, loading: true }))
                        },
                      },
                      {
                        icon: <IconMoon size={17} />,
                        label: t('browser.night'),
                        on: !!activeTab?.night,
                        disabled: !activeUrl,
                        act: () => {
                          setMenuOpen(false)
                          patchTab(activeId, (x) => ({ night: !x.night }))
                        },
                      },
                      {
                        icon: <IconCode size={17} />,
                        label: t('bdt.open_devtools'),
                        on: dtOpen,
                        disabled: !activeUrl,
                        act: () => {
                          setMenuOpen(false)
                          setDtOpen((v) => !v)
                        },
                      },
                      { divider: true },
                      {
                        icon: isBookmarked ? <IconBmFill size={17} className="text-[#FF3366]" /> : <IconBm size={17} />,
                        label: isBookmarked ? t('browser.remove_bookmark') : t('browser.add_bookmark'),
                        disabled: !activeUrl,
                        act: toggleBookmark,
                      },
                      { icon: <IconShare size={17} />, label: t('browser.share'), disabled: !activeUrl, act: shareCurrent },
                      {
                        icon: <IconExternal size={17} />,
                        label: t('browser.open_external'),
                        disabled: !activeUrl,
                        act: () => {
                          setMenuOpen(false)
                          window.open(activeUrl, '_blank', 'noopener,noreferrer')
                        },
                      },
                      { divider: true },
                      { icon: <IconTrash size={17} />, label: t('browser.clear_history'), disabled: !history.length, act: clearHistory },
                    ].map((item, i) =>
                      item.divider ? (
                        <div key={`d${i}`} className="my-1.5 border-t border-[#262626]" />
                      ) : (
                        <button
                          type="button"
                          key={item.label}
                          onClick={item.act}
                          disabled={item.disabled}
                          className={`w-full flex items-center gap-3.5 px-4 py-3 text-[13.5px] transition-colors ${
                            item.on ? 'text-[#FF3366]' : 'text-[#d4d4d4]'
                          } ${item.disabled ? 'opacity-40' : 'hover:bg-white/[0.06]'}`}
                        >
                          {item.icon}
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.on && <span className="w-2 h-2 rounded-full bg-[#FF3366]" />}
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          {activeTab?.loading && <div className="absolute -bottom-px inset-x-0 h-0.5 bg-[#FF3366] animate-pulse" />}
        </header>

        {/* ═══ tab strip ═══ */}
        <nav
          className="shrink-0 bg-[#0d0d0d] border-b border-[#262626] flex items-center gap-1.5 px-2 py-1.5 overflow-x-auto no-scrollbar"
          aria-label={t('browser.tabs')}
        >
          {(tabs || []).map((x) => (
            <button
              type="button"
              key={x.id}
              onClick={() => activateTab(x.id)}
              className={`group shrink-0 flex items-center gap-1.5 h-9 max-w-[160px] rounded-xl px-2.5 border transition-colors ${
                x.id === activeId ? 'bg-[#1c1c1c] border-[#FF3366]/60 text-white' : 'bg-[#141414] border-[#262626] text-[#a3a3a3] hover:text-[#e5e5e5]'
              }`}
            >
              {x.hist[x.hi] ? (
                <img src={faviconFor(x.hist[x.hi])} alt="" width="14" height="14" className="rounded-sm shrink-0" onError={(e) => (e.target.style.visibility = 'hidden')} />
              ) : (
                <KMark size={13} />
              )}
              <span className="text-[11.5px] truncate flex-1 text-left">
                {x.hist[x.hi] ? x.title || new URL(x.hist[x.hi]).hostname : t('browser.new_tab_short')}
              </span>
              <span
                role="button"
                aria-label={t('browser.close_tab')}
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(x.id)
                }}
                className="shrink-0 -mr-0.5 w-5 h-5 rounded-md flex items-center justify-center hover:bg-white/10 text-[#737373] hover:text-white"
              >
                <IconX size={10} />
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={newTab}
            aria-label={t('browser.new_tab')}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[#d4d4d4] hover:bg-white/[0.07] hover:text-white transition-colors"
          >
            <IconPlus size={17} />
          </button>
        </nav>

        {/* ═══ content — the full tab stack stays mounted (session keep-alive) ═══ */}
        <main className={`flex-1 min-h-0 relative bg-[#0d0d0d] ${dragging ? 'pointer-events-none' : ''}`}>
          {/* iframe stack: one sandboxed frame per mounted tab, hidden while
              inactive. Switching tabs NEVER reloads a visited page. */}
          {(tabs || []).map((x) => {
            const u = x.hist[x.hi]
            if (!x.mounted || !u) return null
            return (
              <div
                key={x.id}
                className="absolute inset-0"
                style={{
                  display: x.id === activeId && !x.reader ? 'block' : 'none',
                  ...(x.night ? { filter: 'invert(0.92) hue-rotate(180deg)' } : {}),
                }}
              >
                <iframe
                  ref={(el) => {
                    frameRefs.current[x.id] = el
                  }}
                  src={`/api/browser/proxy?url=${encodeURIComponent(u)}${x.desktop ? '&ua=desktop' : ''}&lang=${lang}&ks=${x.ks || ksRef.current}&kb=${x.key || 0}`}
                  title={x.title || u || 'Kivora Browser'}
                  onLoad={() => patchTab(x.id, { loading: false })}
                  onError={() => patchTab(x.id, { loading: false })}
                  sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
                  referrerPolicy="no-referrer"
                  allow="fullscreen"
                  className="w-full h-full border-0 bg-white"
                />
              </div>
            )
          })}

          {/* loading skeleton — no white flash between navigations */}
          {activeTab?.loading && activeUrl && (
            <div className="absolute inset-0 z-10 bg-[#0d0d0d] flex flex-col items-center justify-center gap-4 pointer-events-none">
              <div className="w-12 h-12 rounded-2xl bg-[#FF3366]/10 border border-[#FF3366]/25 flex items-center justify-center animate-pulse">
                <KMark size={22} />
              </div>
              <div className="w-40 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-[#FF3366]/70 animate-pulse" />
              </div>
            </div>
          )}

          {/* start page — overlay so sibling tabs' frames stay alive */}
          {!activeUrl && (
            <div className="absolute inset-0 z-10 bg-[#0d0d0d]">
              <StartPage onNavigate={(u) => navigate(u)} recents={history} bookmarks={bookmarks} t={t} />
            </div>
          )}

          {/* reader mode — overlay above the live frame */}
          {activeUrl && activeTab?.reader && (
            <div className="absolute inset-0 z-20 bg-[#0d0d0d]">
              {readerState.loading ? (
                <div className="h-full flex items-center justify-center">
                  <IconSpinner size={20} className="text-[#FF3366]" />
                </div>
              ) : readerState.data && !readerState.data.err && readerState.data.html ? (
                <div className="h-full overflow-y-auto overscroll-contain select-text">
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
                    className="mx-auto max-w-2xl px-5 pt-7 pb-24 [&_h1]:text-[22px] [&_h1]:font-semibold [&_h1]:text-white [&_h1]:mt-7 [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-6 [&_h2]:mb-2.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#fafafa] [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-[#fafafa] [&_h5]:text-sm [&_h5]:font-semibold [&_h5]:text-[#a3a3a3] [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:text-[#737373] [&_p]:text-[15px] [&_p]:leading-7 [&_p]:text-[#d4d4d4] [&_p]:my-3.5 [&_li]:text-[14px] [&_li]:leading-6 [&_li]:text-[#d4d4d4] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3 [&_a]:text-[#FF3366] [&_a]:underline [&_a]:decoration-[#FF3366]/40 [&_img]:rounded-xl [&_img]:my-4 [&_img]:max-w-full [&_img]:h-auto [&_blockquote]:border-l-2 [&_blockquote]:border-[#FF3366]/60 [&_blockquote]:pl-4 [&_blockquote]:my-4 [&_blockquote]:text-[#a3a3a3] [&_pre]:bg-[#111111] [&_pre]:border [&_pre]:border-[#262626] [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:text-[12px] [&_code]:text-[13px] [&_table]:w-full [&_table]:text-[13px] [&_td]:border-t [&_td]:border-[#262626] [&_td]:px-2 [&_td]:py-1.5 [&_th]:border-t [&_th]:border-[#262626] [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_figure]:my-5 [&_figcaption]:text-[11px] [&_figcaption]:text-[#525252] [&_figcaption]:text-center [&_figcaption]:mt-2"
                  >
                    {readerState.data.title && <h1 className="!mt-0">{readerState.data.title}</h1>}
                    <div dangerouslySetInnerHTML={{ __html: readerState.data.html }} />
                  </article>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
                  <IconBook size={28} className="text-[#3a3a3a]" />
                  <p className="text-sm text-[#737373]">{t('browser.reader_empty')}</p>
                  <button
                    type="button"
                    onClick={() => patchTab(activeId, { reader: false })}
                    className="mt-1 px-5 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#2e2e2e] text-[13px] text-[#d4d4d4] hover:text-white transition-colors"
                  >
                    {t('browser.exit_reader')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══ DevTools dock — agent-backed inspector over the page ═══ */}
          {dtOpen && activeUrl && (
            <DevToolsDock
              t={t}
              collapsed={dtCollapsed}
              onToggleCollapse={() => setDtCollapsed((v) => !v)}
              onClose={() => setDtOpen(false)}
              state={dt || { console: [], net: [] }}
              onSend={(cmd) => sendToAgent(cmd)}
              onClearConsole={() => dtMut(activeId, (s) => { s.console = [] })}
              onTabChange={(id) => setDtTab(id)}
              canInspect={!!activeUrl}
            />
          )}
        </main>

        {/* ═══ bottom bar ═══ */}
        <footer className="shrink-0 bg-[#111111] border-t border-[#262626] pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5">
            {[
              { icon: <IconHome size={20} />, label: t('browser.home'), act: () => navigate(null) },
              { icon: <IconClock size={20} />, label: t('browser.history'), act: () => setDrawer('history') },
              {
                icon: isBookmarked ? <IconBmFill size={20} className="text-[#FF3366]" /> : <IconBm size={20} />,
                label: t('browser.bookmarks'),
                act: () => setDrawer('bookmarks'),
              },
              { icon: <IconSparkle size={20} className={aiRes?.loading ? 'text-[#FF3366] animate-pulse' : ''} />, label: t('browser.ai.actions'), act: () => setDrawer('ai') },
              { icon: <IconPlus size={20} />, label: `${t('browser.new_tab_short')}${(tabs || []).length > 1 ? ` · ${(tabs || []).length}` : ''}`, act: newTab },
            ].map((b) => (
              <button
                type="button"
                key={b.label}
                onClick={b.act}
                className="flex flex-col items-center gap-1 py-3 text-[#a3a3a3] hover:text-white active:scale-95 transition-colors min-h-[56px] justify-center"
              >
                {b.icon}
                <span className="text-[10px] leading-none max-w-[92px] truncate">{b.label}</span>
              </button>
            ))}
          </div>
        </footer>

        {/* ═══ bookmarks / history drawers (scoped to the browser panel) ═══ */}
        {drawer && (
          <div className="absolute inset-0 z-50" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(null)} />
            <div className="absolute left-0 right-0 bottom-0 max-h-[70%] flex flex-col rounded-t-2xl bg-[#131313] border-t border-[#2e2e2e] shadow-2xl shadow-black/70">
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#262626]">
                <h2 className="text-sm font-semibold text-white">{drawer === 'ai' ? t('browser.ai.title') : drawer === 'bookmarks' ? t('browser.bookmarks') : t('browser.history')}</h2>
                <div className="flex items-center gap-2">
                  {drawer === 'history' && history.length > 0 && (
                    <button type="button" onClick={clearHistory} className="text-[11px] text-[#737373] hover:text-[#FF3366] transition-colors">
                      {t('browser.clear_history')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDrawer(null)}
                    aria-label={t('common.close')}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:bg-white/[0.06] hover:text-white transition-colors"
                  >
                    <IconX size={15} />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto overscroll-contain px-2 py-2">
                {drawer === 'ai' ? (
                  /* v5.30.3 — page-aware AI actions panel */
                  <div className="px-2 pb-2">
                    {!activeUrl ? (
                      <p className="px-2 py-10 text-center text-[13px] text-[#525252]">{t('browser.ai.hint')}</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            ['summarize', t('browser.ai.summarize')],
                            ['links', t('browser.ai.links')],
                            ['facts', t('browser.ai.facts')],
                            ['translate', t('browser.ai.translate')],
                          ].map(([task, label]) => (
                            <button
                              key={task}
                              type="button"
                              disabled={aiRes?.loading}
                              onClick={() => runPageAction(task)}
                              className={`h-10 rounded-xl text-[12.5px] font-medium border transition-colors disabled:opacity-50 ${
                                aiRes?.task === task
                                  ? 'bg-[#FF3366]/15 border-[#FF3366]/40 text-white'
                                  : 'bg-[#1a1a1a] border-[#262626] hover:border-[#3a3a3a] text-[#e5e5e5]'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 min-h-[80px] rounded-xl bg-[#0f0f0f] border border-[#262626] p-4">
                          {aiRes?.loading ? (
                            <div className="flex items-center gap-2.5 text-[12.5px] text-[#737373]">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="animate-spin text-[#FF3366]"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.2" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                              {t('browser.ai.running')}
                            </div>
                          ) : aiRes?.error ? (
                            <p className="text-[12.5px] text-[#ff6b81] leading-relaxed">{aiRes.error}</p>
                          ) : aiRes?.result ? (
                            <div className="text-[13px] max-h-[46dvh] overflow-y-auto overscroll-contain">
                              <MarkdownRenderer content={aiRes.result} />
                            </div>
                          ) : (
                            <p className="text-[12.5px] text-[#525252]">{activeUrl}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : drawer === 'bookmarks' ? (
                  bookmarks.length ? (
                    bookmarks.map((b) => (
                      <div key={b.url} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04]">
                        <img src={faviconFor(b.url)} alt="" width="16" height="16" className="rounded shrink-0" onError={(e) => (e.target.style.visibility = 'hidden')} />
                        <button
                          type="button"
                          onClick={() => {
                            setDrawer(null)
                            navigate(b.url)
                          }}
                          className="flex-1 min-w-0 text-left"
                        >
                          <span className="block text-[13px] text-[#e5e5e5] truncate">{b.title || b.url}</span>
                          <span className="block text-[11px] text-[#525252] truncate">{b.url}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBookmarks((prev) => prev.filter((x) => x.url !== b.url))}
                          aria-label={t('browser.remove_bookmark')}
                          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#525252] hover:text-[#FF3366] transition-colors"
                        >
                          <IconTrash size={15} />
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
                      <button
                        type="button"
                        onClick={() => {
                          setDrawer(null)
                          navigate(h.url)
                        }}
                        className="flex-1 min-w-0 text-left"
                      >
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

        {/* ═══ toast (scoped to the panel) ═══ */}
        {toast && (
          <div role="status" className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full bg-[#1f1f1f] border border-[#2e2e2e] text-[12px] text-white shadow-xl shadow-black/50">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
