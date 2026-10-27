'use client'
// ════════════════════════════════════════════════════════════════════
// BrowserProvider — Kivora Browser as a DevTools-style drawer (v5.24.7)
//
// The browser is no longer a page: it is a global bottom drawer (like the
// terminal drawer in browser DevTools) mounted once in the root layout.
//
// Responsibilities:
//   1. Own open/close state for the drawer (state survives open/close —
//      reopening restores the previous session instantly).
//   2. openBrowser(url) — open the drawer and navigate the active tab.
//      v5.26: the pending navigation is passed to <BrowserApp pending>
//      as a PROP — before this fix the URL was set in context but never
//      reached the engine, so a tapped link opened the drawer WITHOUT
//      loading the site (the reported "link touched → nothing loads").
//   3. v5.26 session restore: the drawer's open state is persisted. If
//      the app is refreshed / swiped away while browsing, the NEXT app
//      start re-opens the drawer on the last visited page automatically
//      (an explicit close marks the session ended — no auto-reopen).
//   4. Global link capture: EVERY cross-origin <a href> on every page is
//      intercepted (capture-phase, before Next.js/anchor default) and
//      routed into the browser drawer instead of leaving the app or
//      spawning a browser tab. mailto/tel/#/same-origin/download links
//      are untouched; any element inside [data-no-browser] opts out.
// ════════════════════════════════════════════════════════════════════
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import BrowserApp from '@/components/BrowserApp'

const BrowserCtx = createContext(null)
const SESS_KEY = 'kv_browser_session_v1'

function readSess() {
  try {
    return JSON.parse(localStorage.getItem(SESS_KEY) || 'null') || {}
  } catch {
    return {}
  }
}

function writeSess(patch) {
  try {
    localStorage.setItem(SESS_KEY, JSON.stringify({ ...readSess(), ...patch, ts: Date.now() }))
  } catch {}
}

export function useBrowser() {
  const ctx = useContext(BrowserCtx)
  if (!ctx) throw new Error('useBrowser must be used inside <BrowserProvider>')
  return ctx
}

export default function BrowserProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(null) // { url, n } — consumed by BrowserApp
  const nRef = useRef(0)

  const openBrowser = useCallback((url) => {
    setOpen(true)
    writeSess({ open: true }) // killed mid-session → auto-restore next launch
    if (url) setPending({ url: String(url), n: ++nRef.current })
  }, [])

  const closeBrowser = useCallback(() => {
    setOpen(false)
    writeSess({ open: false }) // explicit close ends the session
  }, [])

  // ── v5.26 session restore — "the last page always comes back" ──
  // Refresh / app swipe-away while browsing re-opens the drawer on the
  // previously visited pages. Tabs themselves are restored by
  // BrowserApp (kv_browser_tabs_v1); here we only restore open state.
  // Deliberate close (writeSess open:false) disables the auto-reopen.
  useEffect(() => {
    let t
    try {
      const sess = readSess()
      if (sess.open) t = setTimeout(() => setOpen(true), 350) // let the page settle first
    } catch {}
    return () => clearTimeout(t)
  }, [])

  // ── global external-link capture ──────────────────────────────────
  // One delegated capture-phase listener upgrades every cross-origin
  // anchor in the app (community posts, research references, blog cards,
  // explore tools, markdown-rendered links, artifact deploy URLs…) to
  // open inside the browser drawer. Anchors generated AFTER this effect
  // mounts are covered automatically — no per-page wiring needed.
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented) return
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null
      if (!a) return
      if (a.hasAttribute('download')) return
      if (a.closest('[data-no-browser]')) return
      const href = a.getAttribute('href') || ''
      if (!/^https?:\/\//i.test(href)) return
      let external = false
      try {
        external = new URL(href, location.href).origin !== location.origin
      } catch {
        return
      }
      if (!external) return
      e.preventDefault()
      e.stopPropagation()
      openBrowser(new URL(href, location.href).href)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [openBrowser])

  // ── hover prefetch (v5.25 — the browser speed weapon) ─────────────
  // Hovering (or keyboard-focusing) an external link silently fetches it
  // through the proxy ~120ms later. One request does double duty: it
  // warms the edge cache for the upstream site AND caches the rewritten
  // HTML in the browser's HTTP cache, so the real navigation that follows
  // is served near-instantly. Mouse-only (never fires for touch taps),
  // debounced per URL, hard-capped to protect mobile data.
  const prefetchedRef = useRef(new Set())
  useEffect(() => {
    if (typeof window === 'undefined') return
    let hoverable = false
    try {
      hoverable = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    } catch {}
    if (!hoverable) return
    let timer = null
    let pendingUrl = null
    const queue = (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null
      if (!a || a.hasAttribute('download') || a.closest('[data-no-browser]')) return
      const href = a.getAttribute('href') || ''
      if (!/^https?:\/\//i.test(href)) return
      let abs
      try {
        abs = new URL(href, location.href)
      } catch {
        return
      }
      if (abs.origin === location.origin) return
      clearTimeout(timer)
      pendingUrl = abs.href
      timer = setTimeout(() => {
        if (!pendingUrl || prefetchedRef.current.has(pendingUrl)) return
        prefetchedRef.current.add(pendingUrl)
        if (prefetchedRef.current.size > 60) prefetchedRef.current = new Set([...prefetchedRef.current].slice(-30))
        try {
          fetch(`/api/browser/proxy?url=${encodeURIComponent(pendingUrl)}`)
            .then((r) => r.body && r.body.cancel())
            .catch(() => {})
        } catch {}
      }, 120)
    }
    const onOver = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      queue(e)
    }
    document.addEventListener('pointerover', onOver, true)
    document.addEventListener('focusin', queue, true)
    return () => {
      document.removeEventListener('pointerover', onOver, true)
      document.removeEventListener('focusin', queue, true)
      clearTimeout(timer)
    }
  }, [])

  const value = useMemo(() => ({ open, openBrowser, closeBrowser, pending }), [open, openBrowser, closeBrowser, pending])

  return (
    <BrowserCtx.Provider value={value}>
      {children}
      {/* Always mounted (like GlobalCodeRunner) — hidden via transform so
          the browsing session survives open/close cycles. Renders nothing
          on the server; hydrates once. */}
      <BrowserApp open={open} onClose={closeBrowser} pending={pending} />
    </BrowserCtx.Provider>
  )
}
