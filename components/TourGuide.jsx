'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { supabasePublic } from '@/lib/supabase'
import { useTranslation } from '@/components/LanguageProvider'

// ── Interactive guided tour for new users ──────────────────────────
// Auto-starts once for signed-in users arriving on /dashboard (the
// post-auth hub), and can be replayed anytime via the "Replay tour"
// button in the sidebar, which dispatches 'kivora:start-tour'.
//
// Desktop: spotlight highlights the real sidebar links. Mobile: the
// sidebar is hidden, so the tour falls back to centered cards only —
// no element targeting, nothing to break on small screens.
//
// Every feature step carries an "Open page" button that navigates to
// the highlighted page and ends the tour, so the tour doubles as a
// launcher for each tool.
//
// v5.30 — the popover card got the full HUSH treatment: bigger card,
// spring pop-in animation, animated accent bar, step progress pill,
// real buttons (Open page / Back / Next) with hover-lift + press
// feedback, soft-circle close like the DevTools dock, and a spotlight
// with breathing room (stagePadding/stageRadius). All driver chrome is
// restyled via the kv-tour-pop class — zero driver.js internals forked.

const STORAGE_KEY = 'kivora_tour_done_v1'

// One stylesheet for the whole tour, injected once per page load.
const TOUR_CSS = `
.kv-tour-pop.driver-popover {
  background: #111111;
  border: 1px solid #262626;
  border-radius: 20px;
  padding: 24px 26px 20px;
  width: max-content;
  max-width: min(440px, calc(100vw - 40px));
  min-width: min(340px, calc(100vw - 40px));
  color: #e2e2e2;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.45);
  animation: kvTourPop 380ms cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: center;
  overflow: visible;
}
@keyframes kvTourPop {
  0%   { opacity: 0; transform: translateY(14px) scale(0.92); filter: blur(2px); }
  60%  { opacity: 1; }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
.kv-tour-pop .driver-popover-title {
  color: #fafafa;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
  margin: 2px 0 10px;
  padding-right: 28px;
}
.kv-tour-pop .driver-popover-title::before {
  content: '';
  display: block;
  width: 30px;
  height: 3px;
  border-radius: 999px;
  margin-bottom: 12px;
  background: linear-gradient(90deg, #FF3366, #ff7a9c);
  animation: kvTourBar 2.4s ease-in-out infinite;
}
@keyframes kvTourBar {
  0%, 100% { transform: scaleX(1); opacity: 1; }
  50%      { transform: scaleX(0.55); opacity: 0.6; }
}
.kv-tour-pop .driver-popover-description {
  color: #a3a3a3;
  font-size: 14px;
  line-height: 1.65;
  margin-bottom: 4px;
}
/* "Open page" launcher — rendered inside the description HTML */
.kv-tour-pop .tour-open-wrap { margin-top: 14px; }
.kv-tour-pop .tour-open-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  border-radius: 12px;
  background: #FF3366;
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-decoration: none;
  cursor: pointer;
  transition: transform 180ms cubic-bezier(0.22,1,0.36,1), box-shadow 180ms, background 180ms;
  box-shadow: 0 6px 20px rgba(255,51,102,0.28);
}
.kv-tour-pop .tour-open-link::after {
  content: '→';
  font-size: 13px;
  line-height: 1;
  transition: transform 180ms cubic-bezier(0.22,1,0.36,1);
}
.kv-tour-pop .tour-open-link:hover {
  background: #ff4d78;
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgba(255,51,102,0.4);
}
.kv-tour-pop .tour-open-link:hover::after { transform: translateX(3px); }
.kv-tour-pop .tour-open-link:active { transform: translateY(0) scale(0.97); }
/* Footer: progress pill left, Back/Next right (driver renders progress
   as the footer's first child, navBtns flex-grow:1 → natural layout) */
.kv-tour-pop .driver-popover-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #262626;
  flex-direction: row;
  justify-content: space-between;
}
.kv-tour-pop .driver-popover-navigation-btns {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  flex-grow: 0;
  justify-content: flex-end;
}
.kv-tour-pop .driver-popover-navigation-btns button + button { margin-left: 0; }
.kv-tour-pop .driver-popover-progress-text {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(255,51,102,0.07);
  border: 1px solid rgba(255,51,102,0.2);
  color: rgba(255,51,102,0.85);
  margin-right: auto;
}
.kv-tour-pop .driver-popover-navigation-btns button {
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 9px 18px;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 150ms cubic-bezier(0.22,1,0.36,1), background 150ms, border-color 150ms, color 150ms;
}
.kv-tour-pop .driver-popover-navigation-btns button.driver-popover-next-btn {
  background: #FF3366;
  color: #fff;
  border: 1px solid transparent;
  box-shadow: 0 4px 14px rgba(255,51,102,0.25);
}
.kv-tour-pop .driver-popover-navigation-btns button.driver-popover-next-btn:hover {
  background: #ff4d78;
  transform: translateY(-1px);
}
.kv-tour-pop .driver-popover-navigation-btns button.driver-popover-next-btn:active { transform: scale(0.96); }
.kv-tour-pop .driver-popover-navigation-btns button.driver-popover-prev-btn {
  background: #1a1a1a;
  color: #a3a3a3;
  border: 1px solid #262626;
}
.kv-tour-pop .driver-popover-navigation-btns button.driver-popover-prev-btn:hover {
  border-color: #3a3a3a;
  color: #fafafa;
}
.kv-tour-pop .driver-popover-navigation-btns button.driver-popover-prev-btn:active { transform: scale(0.96); }
.kv-tour-pop .driver-popover-footer .driver-popover-btn-disabled {
  opacity: 0.45;
  pointer-events: none;
}
/* Soft-circle close — the DevTools dock glyph (content is a text ×) */
.kv-tour-pop .driver-popover-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  top: 14px;
  right: 14px;
  border-radius: 999px;
  background: #1c1c1c;
  color: #a3a3a3;
  border: 1px solid #262626;
  font-size: 15px;
  line-height: 1;
  transition: background 150ms, color 150ms, transform 150ms, border-color 150ms;
}
.kv-tour-pop .driver-popover-close-btn:hover {
  background: #262626;
  color: #fafafa;
  border-color: #3a3a3a;
  transform: scale(1.08);
}
/* Arrow pointing at the spotlight */
.kv-tour-pop.driver-popover .driver-popover-arrow {
  border-color: transparent;
}
.kv-tour-pop.driver-popover .driver-popover-arrow-side-bottom.driver-popover-arrow {
  border-bottom-color: #111111;
}
.kv-tour-pop.driver-popover .driver-popover-arrow-side-top.driver-popover-arrow {
  border-top-color: #111111;
}
.kv-tour-pop.driver-popover .driver-popover-arrow-side-left.driver-popover-arrow {
  border-left-color: #111111;
}
.kv-tour-pop.driver-popover .driver-popover-arrow-side-right.driver-popover-arrow {
  border-right-color: #111111;
}
/* Spotlight: give the highlighted element breathing room */
.kv-tour-stage-fixed { will-change: transform; }
`

let styleInjected = false
function injectTourCss() {
  if (styleInjected) return
  styleInjected = true
  const el = document.createElement('style')
  el.setAttribute('data-kv-tour', 'v5.30')
  el.textContent = TOUR_CSS
  document.head.appendChild(el)
}

export default function TourGuide() {
  const { t } = useTranslation()
  const router = useRouter()
  const driverRef = useRef(null)
  // keep latest translator without re-binding the listener
  const tRef = useRef(t)

  useEffect(() => {
    // One handler per component lifetime — added while a tour runs,
    // removed on destroy and on unmount. "Open page" links navigate
    // with the router and end the tour.
    function onTourLinkClick(e) {
      const link = e.target?.closest?.('.tour-open-link')
      if (!link) return
      e.preventDefault()
      e.stopImmediatePropagation() // beat driver.js's own document click handler
      const route = link.getAttribute('data-route')
      const inst = driverRef.current
      try {
        inst?.destroy() // triggers onDestroyed cleanup
      } catch {}
      if (route) router.push(route)
    }

    function startTour() {
      if (driverRef.current) return // already running
      const tt = tRef.current
      injectTourCss()
      const desktop =
        typeof window !== 'undefined' &&
        window.matchMedia('(min-width: 1024px)').matches

      // Appends an "Open page" action to a description — driver.js renders
      // popover descriptions as HTML, and clicks inside the description are
      // not swallowed by the popover's button handling.
      const withRoute = (descKey, route) =>
        `${tt(descKey)}<div class="tour-open-wrap"><a class="tour-open-link" data-route="${route}" role="button" tabindex="0">${tt('tour.open_page')}</a></div>`

      const step = (element, titleKey, descKey, route) => ({
        element,
        popover: {
          title: tt(titleKey),
          description: route ? withRoute(descKey, route) : tt(descKey),
        },
      })
      const card = (titleKey, descKey, route) => ({
        popover: {
          title: tt(titleKey),
          description: route ? withRoute(descKey, route) : tt(descKey),
        },
      })

      const steps = [card('tour.welcome_title', 'tour.welcome_desc')]

      if (desktop) {
        steps.push(
          step('[data-tour="nav-explore"]', 'tour.explore_title', 'tour.explore_desc', '/explore'),
          step('[data-tour="nav-chat"]', 'tour.chat_title', 'tour.chat_desc', '/chat'),
          step('[data-tour="nav-community"]', 'tour.community_title', 'tour.community_desc', '/community'),
          step('[data-tour="nav-study"]', 'tour.study_title', 'tour.study_desc', '/study'),
          step('[data-tour="nav-devtools"]', 'tour.devtools_title', 'tour.devtools_desc', '/devtools'),
          step('[data-tour="nav-reelpen"]', 'tour.reelpen_title', 'tour.reelpen_desc', '/reelpen'),
          step('[data-tour="nav-profile"]', 'tour.profile_title', 'tour.profile_desc', '/profile')
        )
      } else {
        // Mobile — centered cards, no element spotlight (sidebar is hidden)
        steps.push(
          card('tour.chat_title', 'tour.chat_desc', '/chat'),
          card('tour.community_title', 'tour.community_desc', '/community'),
          card('tour.study_title', 'tour.study_desc', '/study'),
          card('tour.devtools_title', 'tour.devtools_desc', '/devtools')
        )
      }

      steps.push(card('tour.done_title', 'tour.done_desc'))

      const instance = driver({
        allowClose: true,
        overlayOpacity: 0.7,
        smoothScroll: true,
        showProgress: true,
        progressText: '{{current}} / {{total}}',
        stagePadding: 10,
        stageRadius: 16,
        popoverClass: 'kv-tour-pop',
        nextBtnText: tt('tour.next'),
        prevBtnText: tt('tour.back'),
        doneBtnText: tt('tour.done'),
        steps,
        onDestroyed: () => {
          driverRef.current = null
          document.removeEventListener('click', onTourLinkClick, true)
          try {
            localStorage.setItem(STORAGE_KEY, '1')
          } catch {}
        },
      })
      driverRef.current = instance
      document.addEventListener('click', onTourLinkClick, true)

      instance.drive()
    }

    function onReplay() {
      startTour()
    }
    window.addEventListener('kivora:start-tour', onReplay)

    let timer
    let cancelled = false

    // Auto-start once, for signed-in users on the dashboard
    async function maybeAutoStart() {
      let done = false
      try {
        done = localStorage.getItem(STORAGE_KEY) === '1'
      } catch {}
      if (done) return
      if (!window.location.pathname.startsWith('/dashboard')) return

      // wait for auth to settle so the dashboard doesn't redirect mid-tour
      try {
        if (supabasePublic) {
          const { data } = await supabasePublic.auth.getUser()
          if (!data?.user) return
        }
      } catch {
        return
      }
      if (cancelled) return
      if (!window.location.pathname.startsWith('/dashboard')) return
      timer = setTimeout(() => {
        if (!cancelled) startTour()
      }, 1200)
    }
    maybeAutoStart()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      window.removeEventListener('kivora:start-tour', onReplay)
      document.removeEventListener('click', onTourLinkClick, true)
      if (driverRef.current) {
        try {
          driverRef.current.destroy()
        } catch {}
        driverRef.current = null
      }
    }
  }, [])

  return null
}
