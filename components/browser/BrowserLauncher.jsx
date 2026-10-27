'use client'
// Kivora Browser deep-link launcher (v5.24.7) — the browser is a global
// drawer now, so /browser simply opens the drawer and returns the user to
// where they came from (default: home). PWA shortcuts and shared links
// keep working.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBrowser } from '@/components/browser/BrowserProvider'

export default function BrowserLauncher() {
  const { openBrowser } = useBrowser()
  const router = useRouter()

  useEffect(() => {
    openBrowser()
    router.replace('/')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
