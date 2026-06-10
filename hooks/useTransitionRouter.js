'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Hook that wraps router.push/replace in document.startViewTransition()
 * for browsers that support it. Falls back to normal navigation otherwise.
 *
 * With Next.js experimental.viewTransition enabled, <Link> components
 * automatically use view transitions. This hook is for imperative navigations
 * (e.g., onClick handlers, programmatic redirects).
 */
export function useTransitionRouter() {
  const router = useRouter()

  const push = useCallback((href, options) => {
    if (typeof document !== 'undefined' && document.startViewTransition) {
      document.startViewTransition(() => {
        router.push(href, options)
      })
    } else {
      router.push(href, options)
    }
  }, [router])

  const replace = useCallback((href, options) => {
    if (typeof document !== 'undefined' && document.startViewTransition) {
      document.startViewTransition(() => {
        router.replace(href, options)
      })
    } else {
      router.replace(href, options)
    }
  }, [router])

  const back = useCallback(() => {
    if (typeof document !== 'undefined' && document.startViewTransition) {
      document.startViewTransition(() => {
        router.back()
      })
    } else {
      router.back()
    }
  }, [router])

  return { push, replace, back, refresh: router.refresh }
}
