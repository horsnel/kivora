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

const STORAGE_KEY = 'kivora_tour_done_v1'

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
        overlayOpacity: 0.65,
        smoothScroll: true,
        showProgress: false,
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
