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
//   3. Global link capture: EVERY cross-origin <a href> on every page is
//      intercepted (capture-phase, before Next.js/anchor default) and
//      routed into the browser drawer instead of leaving the app or
//      spawning a browser tab. mailto/tel/#/same-origin/download links
//      are untouched; any element inside [data-no-browser] opts out.
// ════════════════════════════════════════════════════════════════════
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import BrowserApp from '@/components/BrowserApp'

const BrowserCtx = createContext(null)

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
    if (url) setPending({ url: String(url), n: ++nRef.current })
  }, [])

  const closeBrowser = useCallback(() => setOpen(false), [])

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

  const value = useMemo(() => ({ open, openBrowser, closeBrowser, pending }), [open, openBrowser, closeBrowser, pending])

  return (
    <BrowserCtx.Provider value={value}>
      {children}
      {/* Always mounted (like GlobalCodeRunner) — hidden via transform so
          the browsing session survives open/close cycles. Renders nothing
          on the server; hydrates once. */}
      <BrowserApp open={open} onClose={closeBrowser} />
    </BrowserCtx.Provider>
  )
}
