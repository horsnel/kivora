'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'
import { IconUser, IconCheck, IconSpinner, IconGlobe, IconMapPin, IconLink } from '@/components/Icons'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
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
      setToast({ type: 'success', message: 'Profile updated!' })
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to update profile' })
    }
    setSaving(false)
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const displayName = form.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''
  const initials = displayName.slice(0, 2).toUpperCase()

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
            <h1 className="font-semibold text-headline tracking-tight">Profile</h1>
            <p className="text-[#737373] text-caption">Manage your account details</p>
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
                <label className="text-xs text-[#737373] block mb-1.5 font-medium text-left">Avatar URL</label>
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
                <label className="text-xs text-[#737373] block mb-1.5 font-medium">Display name</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Your display name"
                  value={form.display_name}
                  onChange={e => set('display_name', e.target.value)}
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="text-xs text-[#737373] block mb-1.5 font-medium">Email</label>
                <div className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-2.5 text-sm text-[#525252] cursor-not-allowed">
                  {user?.email}
                </div>
                <p className="text-[10px] text-[#404040] mt-1">Email cannot be changed here</p>
              </div>

              {/* Bio */}
              <div>
                <label className="text-xs text-[#737373] block mb-1.5 font-medium">Bio</label>
                <textarea
                  className={`${inputClass} h-24 resize-none leading-relaxed`}
                  placeholder="Tell us about yourself..."
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                  maxLength={300}
                />
                <p className="text-[10px] text-[#404040] mt-1 text-right">{form.bio.length}/300</p>
              </div>

              {/* Location + Website row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5 font-medium">Location</label>
                  <div className="relative">
                    <IconMapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#404040]" />
                    <input
                      type="text"
                      className={`${inputClass} pl-9`}
                      placeholder="Lagos, Nigeria"
                      value={form.location}
                      onChange={e => set('location', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5 font-medium">Website</label>
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
                {saving ? <><IconSpinner size={14} /> Saving...</> : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
