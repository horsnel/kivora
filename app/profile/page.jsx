'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import { internalAvatarUrl, resolveAvatarUrl } from '@/lib/avatar'
import { IconCheck, IconSpinner, IconGlobe, IconMapPin, IconLink, IconWarning, IconLogout, IconPulse, IconDownload } from '@/components/Icons'
import { useTranslation } from '@/components/LanguageProvider'

const PRESET_AVATARS = [
  'Alex', 'Jordan', 'Sam', 'Riley', 'Casey',
  'Morgan', 'Quinn', 'Avery', 'Taylor', 'Blake',
  'Cameron', 'Drew', 'Emery', 'Finley', 'Harper',
  'Kai', 'Logan', 'Parker', 'Reese', 'Skyler',
].map(name => ({
  name,
  url: internalAvatarUrl(name),
}))

function IconShield({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1.5L2.5 4v4c0 3.5 2.5 6 5.5 7 3-1 5.5-3.5 5.5-7V4L8 1.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M6 8l1.5 1.5L10 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconMonitor({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2.5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M5.5 13h5M8 10.5V13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

function parseUserAgent(ua) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown' }
  let browser = 'Unknown'
  let os = 'Unknown'

  if (ua.includes('Firefox/')) browser = 'Firefox'
  else if (ua.includes('Edg/')) browser = 'Edge'
  else if (ua.includes('Chrome/')) browser = 'Chrome'
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari'

  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

  return { browser, os }
}

export default function ProfilePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  // v5.22 — push notifications + data export
  const [pushState, setPushState] = useState('unknown') // off | enabled | blocked | unsupported | busy
  const [testState, setTestState] = useState('idle') // v5.24 push test button: idle | busy
  const [exportState, setExportState] = useState(null) // null | busy | done | error
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [toast, setToast] = useState(null) // { type: 'success'|'error', message: string }
  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    location: '',
    website: '',
    avatar_url: '',
  })

  useEffect(() => { checkAuth() }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  async function checkAuth() {
    try {
      if (!supabasePublic) { router.push('/auth'); return }
      const { data: { user } } = await supabasePublic.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUser(user)

      const { data: profile } = await supabasePublic
        .from('profiles')
        .select('display_name, bio, location, website, avatar_url')
        .eq('id', user.id)
        .single()

      if (profile) {
        setForm({
          display_name: profile.display_name || '',
          bio: profile.bio || '',
          location: profile.location || '',
          website: profile.website || '',
          // Normalize legacy external URLs (e.g. old dicebear links) to the
          // self-hosted route so the raw external link is never shown/kept
          avatar_url: resolveAvatarUrl(profile.avatar_url) || '',
        })
      }
    } catch (err) {
      console.error('[profile] auth error:', err)
      router.push('/auth')
      return
    }
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    try {
      const { error } = await supabasePublic
        .from('profiles')
        .update({
          display_name: form.display_name || null,
          bio: form.bio || null,
          location: form.location || null,
          website: form.website || null,
          avatar_url: form.avatar_url || null,
        })
        .eq('id', user.id)

      if (error) throw error
      // Sync the sidebars if the avatar (or any field) was part of the save
      window.dispatchEvent(new CustomEvent('kivora:avatar-updated', { detail: resolveAvatarUrl(form.avatar_url) || '' }))
      setToast({ type: 'success', message: t('profile.updated') })
    } catch (err) {
      setToast({ type: 'error', message: err.message || t('profile.update_failed') })
    }
    setSaving(false)
  }

  // ── Avatar — instant persist + live sidebar sync ──
  // Picking an avatar saves it right away (no need to hunt for the Save
  // button) and broadcasts 'kivora:avatar-updated' so every mounted
  // UserAvatar (main sidebar, chat sidebar) updates without a reload.
  async function persistAvatar(url) {
    if (!user) return
    try {
      const { error } = await supabasePublic
        .from('profiles')
        .update({ avatar_url: url || null })
        .eq('id', user.id)
      if (error) throw error
      window.dispatchEvent(new CustomEvent('kivora:avatar-updated', { detail: resolveAvatarUrl(url) || '' }))
      setToast({ type: 'success', message: t('profile.avatar_saved') })
    } catch (err) {
      setToast({ type: 'error', message: err.message || t('profile.update_failed') })
    }
  }

  function pickAvatar(url) {
    set('avatar_url', url)
    setShowAvatarPicker(false)
    persistAvatar(url)
  }

  function shuffleAvatar() {
    // Random self-hosted avatar — the seed only ever lives on our domain
    const seed = 'kv-' + Math.random().toString(36).slice(2, 8)
    pickAvatar(internalAvatarUrl(seed))
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      const res = await authFetch('/api/profile/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete account')
      await supabasePublic.auth.signOut()
      router.push('/')
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to delete account' })
      setShowDeleteDialog(false)
      setDeleteConfirm('')
    }
    setDeleting(false)
  }

  async function signOutAll() {
    try {
      await supabasePublic.auth.signOut()
      router.push('/auth')
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to sign out' })
    }
  }

  // ── v5.22 Web Push notifications ────────────────────────────────
  // "Your reply finished generating while you were offline" lives here:
  // one toggle, one subscription, stored server-side against the account.
  const urlBase64ToUint8Array = (b64) => {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4)
    const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }

  async function refreshPushState() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setPushState('unsupported'); return
      }
      if (Notification.permission === 'denied') { setPushState('blocked'); return }
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      setPushState(sub ? 'enabled' : 'off')
      // v5.24 — server repair: a browser subscription can exist while the
      // server row is missing (e.g. push was first enabled before the
      // push_subscriptions migration ran, or the row was pruned). The toggle
      // would then read "on" while the server has nothing to deliver to.
      // Idempotent, silent re-upsert heals that drift.
      if (sub) {
        try {
          const { data: { session } } = await supabasePublic.auth.getSession()
          if (session?.user) {
            await authFetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription: sub.toJSON() }),
            })
          }
        } catch {}
      }
    } catch { setPushState('off') }
  }

  async function enablePush() {
    setPushState('busy')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setPushState(perm === 'denied' ? 'blocked' : 'off'); return }
      const { key } = await (await fetch('/api/push/key')).json()
      if (!key) { setPushState('unsupported'); return }
      const reg = await navigator.serviceWorker.getRegistration()
        || await navigator.serviceWorker.register('/sw.js')
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        })
      }
      const res = await authFetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      if (!res.ok) throw new Error('subscribe failed')
      setPushState('enabled')
      setToast({ type: 'success', message: t('profile.notifications_enabled') || 'Push notifications are on' })
    } catch (err) {
      setPushState(Notification.permission === 'denied' ? 'blocked' : 'off')
      setToast({ type: 'error', message: err.message || 'Could not enable notifications' })
    }
  }

  async function disablePush() {
    setPushState('busy')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe().catch(() => {})
        await authFetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {})
      }
    } catch {}
    setPushState('off')
  }

  // v5.24 — one-click push-chain diagnostic. Sends a real notification via
  // /api/push/test and translates the structured verdict into a toast:
  // success, "nothing registered" (with the toggle reset to match server
  // truth), or a failure carrying the server-side reason.
  async function testPush() {
    setTestState('busy')
    try {
      const res = await authFetch('/api/push/test', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        setToast({ type: 'success', message: t('profile.push_test_sent') || 'Test sent — check your device for the notification' })
      } else if (data?.reason === 'no_subscriptions') {
        setPushState('off') // the toggle was ahead of server truth — align it
        setToast({ type: 'error', message: t('profile.push_test_none') || 'No device is registered to your account yet — turn push off and on again, then allow the browser permission prompt' })
      } else {
        const why = data?.reason || data?.error || `HTTP ${res.status}`
        setToast({ type: 'error', message: `${t('profile.push_test_fail') || 'Push test failed'} (${why})` })
      }
    } catch (err) {
      setToast({ type: 'error', message: `${t('profile.push_test_fail') || 'Push test failed'} (${err.message || 'network'})` })
    } finally {
      setTestState('idle')
    }
  }

  // ── v5.22 data export — every conversation as JSON + Markdown ──
  async function exportMyData() {
    setExportState('busy')
    try {
      const { data: { session } } = await supabasePublic.auth.getSession()
      if (!session?.user) throw new Error('not signed in')
      const PAGE = 100
      let all = []
      while (true) {
        const { data, error } = await supabasePublic
          .from('chat_sessions')
          .select('id, messages, title, pinned, updated_at')
          .eq('user_id', session.user.id)
          .order('updated_at', { ascending: false })
          .range(all.length, all.length + PAGE - 1)
        if (error) throw error
        if (!data?.length) break
        all = all.concat(data)
        if (data.length < PAGE) break
      }
      const stamp = new Date().toISOString().slice(0, 10)
      const jsonBlob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), sessions: all }, null, 2)], { type: 'application/json' })
      triggerDownload(jsonBlob, `kivora-export-${stamp}.json`)

      const md = all.map(s => {
        const title = s.title || 'Conversation'
        const msgs = Array.isArray(s.messages) ? s.messages : []
        const body = msgs.map(m => `**${m.role === 'user' ? 'You' : 'Kivora'}:** ${typeof m.content === 'string' ? m.content : ''}`).join('\n\n')
        return `## ${title}\n\n_${s.updated_at ? s.updated_at.slice(0, 10) : ''}_\n\n${body || '_(empty)_'}\n`
      }).join('\n---\n\n')
      const mdBlob = new Blob([`# Kivora conversations\n\n${md}`], { type: 'text/markdown' })
      triggerDownload(mdBlob, `kivora-conversations-${stamp}.md`)
      setExportState('done')
      setToast({ type: 'success', message: t('profile.export_done') || 'Export ready — check your downloads' })
    } catch (err) {
      setExportState('error')
      setToast({ type: 'error', message: err.message || (t('profile.export_failed') || 'Export failed') })
    }
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  // Reflect the browser's actual push state on mount (and when the tab returns)
  useEffect(() => {
    refreshPushState()
    const onVis = () => { if (document.visibilityState === 'visible') refreshPushState() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const displayName = form.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const initials = displayName.slice(0, 2).toUpperCase()

  const { browser, os } = parseUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'

  const inputClass = "w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#404040] focus:outline-none transition-colors"

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="skeleton w-9 h-9 rounded-xl" />
          <div>
            <div className="skeleton w-24 h-5 rounded mb-1.5" />
            <div className="skeleton w-36 h-3 rounded" />
          </div>
        </div>
        <div className="skeleton border border-[#262626] rounded-xl p-6 h-96" />
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <h1 className="text-display font-semibold mb-2 tracking-tight">{t('profile.title')}</h1>
          <p className="text-muted text-body-sm mt-0.5">{t('profile.subtitle')}</p>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium animate-slide-down flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-950/30 border border-emerald-900/40 text-emerald-400'
              : 'bg-red-950/30 border border-red-900/40 text-red-400'
          }`}>
            {toast.type === 'success' && <IconCheck size={14} />}
            {toast.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left — Avatar card */}
          <div className="lg:col-span-1">
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 text-center">
              {form.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveAvatarUrl(form.avatar_url)}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-2 border-[#262626]"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                />
              ) : null}
              <div
                className={`w-20 h-20 bg-red-600 rounded-full mx-auto mb-4 items-center justify-center text-2xl font-bold text-white ${form.avatar_url ? 'hidden' : 'flex'}`}
              >
                {initials}
              </div>
              <h3 className="font-semibold text-body-sm mb-1 text-muted">{displayName || 'Your name'}</h3>
              <p className="text-muted text-caption truncate">{user?.email}</p>
              <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
                {/* Choose Avatar button */}
                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(v => !v)}
                  className="w-full bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-[#a3a3a3] hover:text-white py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1.5L2.5 4v4c0 3.5 2.5 6 5.5 7 3-1 5.5-3.5 5.5-7V4L8 1.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
                    <path d="M6 8l1.5 1.5L10 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {showAvatarPicker ? t('profile.hide_avatars') : t('profile.choose_avatar')}
                </button>

                {/* Avatar picker grid — clicking picks AND saves instantly */}
                {showAvatarPicker && (
                  <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 mb-3">
                    <div className="grid grid-cols-5 gap-3 justify-items-center">
                      {PRESET_AVATARS.map(({ name, url }) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => pickAvatar(url)}
                          className={`w-12 h-12 rounded-full cursor-pointer hover:ring-2 hover:ring-red-500/50 transition-all ${
                            resolveAvatarUrl(form.avatar_url) === url
                              ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-[#0a0a0a]'
                              : ''
                          }`}
                          title={name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={name}
                            className="w-full h-full rounded-full"
                          />
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={shuffleAvatar}
                      className="mt-3 w-full bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-[#a3a3a3] hover:text-white py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/></svg>
                      {t('profile.shuffle')}
                    </button>
                  </div>
                )}

                {/* Custom URL — shows the internal link, never a raw external one */}
                <label className="text-xs text-muted block mb-1.5 font-medium text-left">{t('profile.custom_url')}</label>
                <input
                  type="url"
                  className={inputClass}
                  placeholder="https://example.com/avatar.jpg"
                  value={resolveAvatarUrl(form.avatar_url)}
                  onChange={e => set('avatar_url', e.target.value)}
                />
                <p className="text-[10px] text-muted2 mt-1.5">{t('profile.custom_url_hint')}</p>
              </div>
            </div>
          </div>

          {/* Right — Form */}
          <div className="lg:col-span-2">
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 space-y-5">
              {/* Display name */}
              <div>
                <label className="text-xs text-muted block mb-1.5 font-medium">{t('profile.display_name')}</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder={t('profile.display_name_placeholder')}
                  value={form.display_name}
                  onChange={e => set('display_name', e.target.value)}
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="text-xs text-muted block mb-1.5 font-medium">{t('profile.email')}</label>
                <div className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-2.5 text-sm text-[#525252] cursor-not-allowed">
                  {user?.email}
                </div>
                <p className="text-[10px] text-muted2 mt-1">{t('profile.email_cannot_change')}</p>
              </div>

              {/* Bio */}
              <div>
                <label className="text-xs text-muted block mb-1.5 font-medium">{t('profile.bio')}</label>
                <textarea
                  className={`${inputClass} h-24 resize-none leading-relaxed`}
                  placeholder={t('profile.bio_placeholder')}
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                  maxLength={300}
                />
                <p className="text-[10px] text-muted2 mt-1 text-right">{form.bio.length}/300</p>
              </div>

              {/* Location + Website row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted block mb-1.5 font-medium">{t('profile.location')}</label>
                  <div className="relative">
                    <IconMapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
                    <input
                      type="text"
                      className={`${inputClass} pl-9`}
                      placeholder={t('profile.location_placeholder')}
                      value={form.location}
                      onChange={e => set('location', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5 font-medium">{t('profile.website')}</label>
                  <div className="relative">
                    <IconGlobe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2" />
                    <input
                      type="url"
                      className={`${inputClass} pl-9`}
                      placeholder="https://yoursite.com"
                      value={form.website}
                      onChange={e => set('website', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={save}
                disabled={saving}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press"
              >
                {saving ? <><IconSpinner size={14} /> {t('profile.saving')}</> : t('profile.save')}
              </button>
            </div>

            {/* Session Management */}
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                  <IconMonitor size={14} className="text-muted" />
                </div>
                <h2 className="font-semibold text-sm tracking-tight text-muted">{t('profile.sessions')}</h2>
              </div>

              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-950/30 rounded-lg flex items-center justify-center">
                      <IconMonitor size={14} className="text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm text-white font-medium">{t('profile.current_session')}</div>
                      <div className="text-xs text-muted">{browser} on {os}</div>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-full">{t('profile.active')}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#525252]">
                  <span>{t('profile.last_active')} {lastSignIn}</span>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={signOutAll}
                  className="w-full bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-[#a3a3a3] hover:text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <IconLogout size={14} /> {t('profile.sign_out_all')}
                </button>
                <p className="text-[10px] text-muted2 mt-2 text-center">This will invalidate all active sessions across all devices</p>
              </div>
            </div>

            {/* Sign Out */}
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                  <IconLogout size={14} className="text-muted" />
                </div>
                <h2 className="font-semibold text-sm tracking-tight text-muted">{t('profile.sign_out')}</h2>
              </div>
              <p className="text-xs text-muted mb-4">
                Sign out of your account on this device. You can always sign back in later.
              </p>
              <button
                onClick={signOutAll}
                className="w-full bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-[#a3a3a3] hover:text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <IconLogout size={14} /> Sign out
              </button>
            </div>

            {/* Notifications (v5.22 Web Push) */}
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                  <IconPulse size={14} className="text-muted" />
                </div>
                <h2 className="font-semibold text-sm tracking-tight text-muted">{t('profile.notifications') || 'Notifications'}</h2>
              </div>
              <p className="text-xs text-muted mb-4">
                {t('profile.notifications_desc') || 'Get a push when a background reply finishes generating after you go offline.'}
              </p>
              {pushState === 'unsupported' ? (
                <p className="text-xs text-[#525252] bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-3">{t('profile.notifications_unsupported') || "This browser doesn't support push notifications."}</p>
              ) : pushState === 'blocked' ? (
                <p className="text-xs text-amber-300/90 bg-amber-950/20 border border-amber-900/30 rounded-xl px-4 py-3">{t('profile.notifications_blocked') || 'Notifications are blocked in your browser settings — unblock this site to turn them on.'}</p>
              ) : (
                <>
                  <button
                    onClick={pushState === 'enabled' ? disablePush : enablePush}
                    disabled={pushState === 'busy'}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                      pushState === 'enabled'
                        ? 'bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 hover:bg-emerald-950/50'
                        : 'bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-[#a3a3a3] hover:text-white'
                    } disabled:opacity-60`}
                  >
                    {pushState === 'busy' ? <IconSpinner size={14} /> : <IconPulse size={14} />}
                    {pushState === 'enabled'
                      ? (t('profile.notifications_enabled') || 'Push notifications are on')
                      : (t('profile.notifications_enable') || 'Enable push notifications')}
                  </button>
                  {pushState === 'enabled' && (
                    <button
                      onClick={testPush}
                      disabled={testState === 'busy'}
                      className="mt-2 w-full bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-[#a3a3a3] hover:text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {testState === 'busy' ? <IconSpinner size={14} /> : <IconCheck size={14} />}
                      {t('profile.push_test') || 'Send test notification'}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Your data (v5.22 export) */}
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                  <IconDownload size={14} className="text-muted" />
                </div>
                <h2 className="font-semibold text-sm tracking-tight text-muted">{t('profile.your_data') || 'Your data'}</h2>
              </div>
              <p className="text-xs text-muted mb-4">
                {t('profile.export_desc') || 'Download every conversation as JSON and Markdown — yours to keep or take anywhere.'}
              </p>
              <button
                onClick={exportMyData}
                disabled={exportState === 'busy'}
                className="w-full bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-[#a3a3a3] hover:text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {exportState === 'busy' ? <><IconSpinner size={14} /> {t('profile.exporting') || 'Preparing your export…'}</> : <><IconDownload size={14} /> {t('profile.export_data') || 'Export my data'}</>}
              </button>
            </div>

            {/* Danger Zone */}
            <div className="bg-[#141414] border border-red-900/30 rounded-xl p-6 mt-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-red-950/30 rounded-lg flex items-center justify-center">
                  <IconWarning size={14} className="text-red-400" />
                </div>
                <h2 className="font-semibold text-sm text-red-400">{t('profile.danger_zone')}</h2>
              </div>

              {!showDeleteDialog ? (
                <>
                  <p className="text-xs text-muted mb-4">
                    Once you delete your account, there is no going back. All your data, including profile, saved results, chat history, and study sessions, will be permanently removed.
                  </p>
                  <button
                    onClick={() => setShowDeleteDialog(true)}
                    className="w-full bg-red-950/30 border border-red-900/40 hover:bg-red-950/50 text-red-400 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    {t('profile.delete_account')}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4">
                    <p className="text-sm text-red-300 mb-3 font-medium">{t('profile.delete_confirm')}</p>
                    <p className="text-xs text-muted mb-3">
                      {t('profile.delete_description')} Type <span className="text-red-400 font-mono font-bold">DELETE</span> to confirm.
                    </p>
                    <input
                      type="text"
                      className="w-full bg-[#0a0a0a] border border-red-900/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#404040] focus:outline-none transition-colors"
                      placeholder='Type "DELETE" to confirm'
                      value={deleteConfirm}
                      onChange={e => setDeleteConfirm(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowDeleteDialog(false); setDeleteConfirm('') }}
                      className="flex-1 bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-[#a3a3a3] hover:text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    >
                      {t('profile.cancel')}
                    </button>
                    <button
                      onClick={deleteAccount}
                      disabled={deleteConfirm !== 'DELETE' || deleting}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      {deleting ? <><IconSpinner size={14} /> {t('profile.deleting')}</> : t('profile.delete_my_account')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
