'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'
import { IconUser, IconCheck, IconSpinner, IconGlobe, IconMapPin, IconLink, IconWarning, IconLogout } from '@/components/Icons'
import { useTranslation } from '@/components/LanguageProvider'

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
          avatar_url: profile.avatar_url || '',
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
      setToast({ type: 'success', message: t('profile.updated') })
    } catch (err) {
      setToast({ type: 'error', message: err.message || t('profile.update_failed') })
    }
    setSaving(false)
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      const res = await fetch('/api/profile/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
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

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const displayName = form.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const initials = displayName.slice(0, 2).toUpperCase()

  const { browser, os } = parseUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'

  const inputClass = "w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-10">
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
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 animate-fade-up">
          <div className="w-9 h-9 bg-[#141414] rounded-xl flex items-center justify-center">
            <IconUser size={14} className="text-[#737373]" />
          </div>
          <div>
            <h1 className="font-semibold text-headline tracking-tight">{t('profile.title')}</h1>
            <p className="text-[#737373] text-caption">{t('profile.subtitle')}</p>
          </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — Avatar card */}
          <div className="lg:col-span-1">
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 text-center">
              {form.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.avatar_url}
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
              <h3 className="font-semibold text-body-sm mb-1">{displayName || 'Your name'}</h3>
              <p className="text-[#737373] text-caption truncate">{user?.email}</p>
              <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
                <label className="text-xs text-[#737373] block mb-1.5 font-medium text-left">{t('profile.avatar')}</label>
                <input
                  type="url"
                  className={inputClass}
                  placeholder="https://example.com/avatar.jpg"
                  value={form.avatar_url}
                  onChange={e => set('avatar_url', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Right — Form */}
          <div className="lg:col-span-2">
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 space-y-5">
              {/* Display name */}
              <div>
                <label className="text-xs text-[#737373] block mb-1.5 font-medium">{t('profile.display_name')}</label>
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
                <label className="text-xs text-[#737373] block mb-1.5 font-medium">{t('profile.email')}</label>
                <div className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-2.5 text-sm text-[#525252] cursor-not-allowed">
                  {user?.email}
                </div>
                <p className="text-[10px] text-[#404040] mt-1">{t('profile.email_cannot_change')}</p>
              </div>

              {/* Bio */}
              <div>
                <label className="text-xs text-[#737373] block mb-1.5 font-medium">{t('profile.bio')}</label>
                <textarea
                  className={`${inputClass} h-24 resize-none leading-relaxed`}
                  placeholder={t('profile.bio_placeholder')}
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                  maxLength={300}
                />
                <p className="text-[10px] text-[#404040] mt-1 text-right">{form.bio.length}/300</p>
              </div>

              {/* Location + Website row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5 font-medium">{t('profile.location')}</label>
                  <div className="relative">
                    <IconMapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#404040]" />
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
                  <label className="text-xs text-[#737373] block mb-1.5 font-medium">{t('profile.website')}</label>
                  <div className="relative">
                    <IconGlobe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#404040]" />
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
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                  <IconMonitor size={14} className="text-[#737373]" />
                </div>
                <h2 className="font-semibold text-sm">{t('profile.sessions')}</h2>
              </div>

              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-950/30 rounded-lg flex items-center justify-center">
                      <IconMonitor size={14} className="text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm text-white font-medium">{t('profile.current_session')}</div>
                      <div className="text-xs text-[#737373]">{browser} on {os}</div>
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
                <p className="text-[10px] text-[#404040] mt-2 text-center">This will invalidate all active sessions across all devices</p>
              </div>
            </div>

            {/* Sign Out */}
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                  <IconLogout size={14} className="text-[#737373]" />
                </div>
                <h2 className="font-semibold text-sm">{t('profile.sign_out')}</h2>
              </div>
              <p className="text-xs text-[#737373] mb-4">
                Sign out of your account on this device. You can always sign back in later.
              </p>
              <button
                onClick={signOutAll}
                className="w-full bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-[#a3a3a3] hover:text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <IconLogout size={14} /> Sign out
              </button>
            </div>

            {/* Danger Zone */}
            <div className="bg-[#141414] border border-red-900/30 rounded-xl p-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-red-950/30 rounded-lg flex items-center justify-center">
                  <IconWarning size={14} className="text-red-400" />
                </div>
                <h2 className="font-semibold text-sm text-red-400">{t('profile.danger_zone')}</h2>
              </div>

              {!showDeleteDialog ? (
                <>
                  <p className="text-xs text-[#737373] mb-4">
                    Once you delete your account, there is no going back. All your data — profile, saved results, chat history, and study sessions — will be permanently removed.
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
                    <p className="text-xs text-[#737373] mb-3">
                      {t('profile.delete_description')} Type <span className="text-red-400 font-mono font-bold">DELETE</span> to confirm.
                    </p>
                    <input
                      type="text"
                      className="w-full bg-[#0a0a0a] border border-red-900/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"
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
