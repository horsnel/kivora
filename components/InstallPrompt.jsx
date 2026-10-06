'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/components/LanguageProvider'

// ── PWA install prompt ─────────────────────────────────────────────
// Android/desktop Chrome: captures beforeinstallprompt and shows a
// native-feeling install card. iOS Safari (no beforeinstallprompt):
// shows Add-to-Home-Screen instructions. Both are dismissible with a
// 14-day cooldown and never shown when already installed/standalone.

const DISMISS_KEY = 'kivora_install_dismissed_at'
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000

export default function InstallPrompt() {
  const { t } = useTranslation()
  const [promptEvent, setPromptEvent] = useState(null)
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIos, setShowIos] = useState(false)

  useEffect(() => {
    let dismissedAt = 0
    try {
      dismissedAt = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10) || 0
    } catch {}
    const recentlyDismissed = dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS

    function isStandalone() {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true
      )
    }
    if (isStandalone()) return

    function onBeforeInstall(e) {
      e.preventDefault()
      setPromptEvent(e)
      if (!recentlyDismissed) {
        setTimeout(() => setShowAndroid(true), 6000)
      }
    }
    function onInstalled() {
      setShowAndroid(false)
      setShowIos(false)
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
    let iosTimer
    if (isIOS && !recentlyDismissed) {
      iosTimer = setTimeout(() => setShowIos(true), 6000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      if (iosTimer) clearTimeout(iosTimer)
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {}
    setShowAndroid(false)
    setShowIos(false)
  }

  async function install() {
    if (!promptEvent) return
    try {
      await promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      if (outcome === 'accepted') dismiss()
    } catch {}
    setPromptEvent(null)
    setShowAndroid(false)
  }

  if (!showAndroid && !showIos) return null

  return (
    <div className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-40 animate-slide-up">
      <div className="bg-[#141414] border border-white/[0.1] rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e02020] to-[#a81c1c] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path d="M16 5L7 23.5L16 18.2Z" fill="#fff" opacity="0.95" />
            <path d="M16 5L25 23.5L16 18.2Z" fill="#fff" opacity="0.55" />
            <rect x="7.5" y="25.4" width="17" height="2.6" rx="1.3" fill="#fff" opacity="0.35" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white tracking-tight">
            {showIos ? t('install.title') : t('install.title')}
          </p>
          <p className="text-xs text-[#8f8f8f] leading-relaxed mt-0.5">
            {showIos ? t('install.ios_desc') : t('install.desc')}
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            {showAndroid && (
              <button
                onClick={install}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors"
              >
                {t('install.button')}
              </button>
            )}
            <button
              onClick={dismiss}
              className="text-[#737373] hover:text-white text-xs font-medium px-2 py-1.5 transition-colors"
            >
              {t('install.dismiss')}
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-[#525252] hover:text-white transition-colors p-1 -m-1"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
