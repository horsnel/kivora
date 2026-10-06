'use client'
import { useEffect, useRef } from 'react'
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

const STORAGE_KEY = 'kivora_tour_done_v1'

export default function TourGuide() {
  const { t } = useTranslation()
  const driverRef = useRef(null)
  // keep latest translator without re-binding the listener
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    function startTour() {
      if (driverRef.current) return // already running
      const tt = tRef.current
      const desktop =
        typeof window !== 'undefined' &&
        window.matchMedia('(min-width: 1024px)').matches

      const step = (element, titleKey, descKey) => ({
        element,
        popover: { title: tt(titleKey), description: tt(descKey) },
      })
      const card = (titleKey, descKey) => ({
        popover: { title: tt(titleKey), description: tt(descKey) },
      })

      const steps = [card('tour.welcome_title', 'tour.welcome_desc')]

      if (desktop) {
        steps.push(
          step('[data-tour="nav-explore"]', 'tour.explore_title', 'tour.explore_desc'),
          step('[data-tour="nav-chat"]', 'tour.chat_title', 'tour.chat_desc'),
          step('[data-tour="nav-community"]', 'tour.community_title', 'tour.community_desc'),
          step('[data-tour="nav-study"]', 'tour.study_title', 'tour.study_desc'),
          step('[data-tour="nav-devtools"]', 'tour.devtools_title', 'tour.devtools_desc'),
          step('[data-tour="nav-reelpen"]', 'tour.reelpen_title', 'tour.reelpen_desc'),
          step('[data-tour="nav-profile"]', 'tour.profile_title', 'tour.profile_desc')
        )
      } else {
        // Mobile — centered cards, no element spotlight
        steps.push(
          card('tour.chat_title', 'tour.chat_desc'),
          card('tour.community_title', 'tour.community_desc'),
          card('tour.study_title', 'tour.study_desc'),
          card('tour.devtools_title', 'tour.devtools_desc')
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
          try {
            localStorage.setItem(STORAGE_KEY, '1')
          } catch {}
        },
      })
      driverRef.current = instance
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
