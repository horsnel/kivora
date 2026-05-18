'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'
import { IconDashboard, IconUser, IconChat, IconSearch, IconMail, IconBook, IconSpinner, IconClock } from '@/components/Icons'

function IconShield({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1.5L2 4v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M6 8l1.5 1.5L10.5 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const TOOL_LABELS = {
  chat: 'AI Chat',
  study_homework: 'Homework Helper',
  study_essay: 'Essay Outliner',
  study_research: 'Research Summarizer',
  study_citation: 'Citation Generator',
  study_coding: 'Coding Practice',
  devtools_code_explainer: 'Code Explainer',
  devtools_regex: 'Regex Generator',
  devtools_json_formatter: 'JSON Formatter',
  devtools_readme: 'README Generator',
  devtools_sql_builder: 'SQL Builder',
  devtools_api_analyzer: 'API Analyzer',
}

const ADMIN_PASSWORD = 'Ebuka457'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [data, setData] = useState(null)

  // Password gate state
  const [unlocked, setUnlocked] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)

  // Check sessionStorage for persisted unlock
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('kivora-admin-unlocked') === '1') {
      setUnlocked(true)
    }
  }, [])

  useEffect(() => {
    if (unlocked) checkAuth()
  }, [unlocked])

  function handlePasswordSubmit(e) {
    e.preventDefault()
    if (passwordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem('kivora-admin-unlocked', '1')
      setUnlocked(true)
      setPasswordError(false)
    } else {
      setPasswordError(true)
    }
  }

  // ── Password gate screen ──
  if (!unlocked) return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-[#141414] border border-white/[0.06] rounded-2xl p-8">
          <div className="w-12 h-12 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-5">
            <IconShield size={20} className="text-[#525252]" />
          </div>
          <h2 className="font-semibold text-[17px] text-white text-center mb-1.5 tracking-tight">Admin Access</h2>
          <p className="text-[13px] text-[#737373] text-center mb-6">Enter the admin password to continue</p>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
              placeholder="Password"
              autoFocus
              className={`w-full bg-[#0a0a0a] border ${passwordError ? 'border-red-500/60' : 'border-[#262626]'} rounded-xl px-4 py-3 text-[15px] text-white placeholder-[#525252] outline-none focus:border-white/[0.15] transition-colors mb-1`}
            />
            {passwordError && (
              <p className="text-[12px] text-red-400 mb-3 px-1">Incorrect password</p>
            )}
            <button
              type="submit"
              className="w-full bg-[#dc2626] hover:bg-red-700 text-white text-[14px] font-semibold py-3 rounded-xl transition-colors mt-3"
            >
              Unlock
            </button>
          </form>
        </div>
        <button
          onClick={() => router.push('/discover')}
          className="text-[#525252] hover:text-[#a3a3a3] text-[13px] flex items-center justify-center gap-1 mx-auto mt-5 transition-colors"
        >
          ← Back to Kivora
        </button>
      </div>
    </main>
  )

  async function checkAuth() {
    try {
      if (!supabasePublic) { setForbidden(true); setLoading(false); return }
      const { data: { user } } = await supabasePublic.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUser(user)

      // Fetch admin data
      const res = await fetch('/api/admin', {
        headers: { 'x-user-id': user.id },
      })
      if (res.status === 403) { setForbidden(true); setLoading(false); return }
      if (!res.ok) throw new Error('Failed to fetch admin data')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error('[admin]', err)
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="skeleton w-9 h-9 rounded-xl" />
          <div>
            <div className="skeleton w-28 h-5 rounded mb-1.5" />
            <div className="skeleton w-40 h-3 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-7">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton border border-[#262626] rounded-xl p-5 h-28" />
          ))}
        </div>
        <div className="skeleton border border-[#262626] rounded-xl p-5 h-64" />
      </div>
    </div>
  )

  if (forbidden) return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-center py-20">
          <div className="w-12 h-12 bg-[#141414] rounded-xl flex items-center justify-center mx-auto mb-4">
            <IconShield size={20} className="text-[#2e2e2e]" />
          </div>
          <h3 className="font-semibold text-headline mb-2 tracking-tight">Admin access required</h3>
          <p className="text-[#737373] text-body mb-6">You don&apos;t have permission to view this page.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-red-500 hover:text-red-400 text-body flex items-center gap-1 mx-auto"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </main>
  )

  const metrics = data?.metrics || {}
  const recentSignups = data?.recentSignups || []
  const recentActivity = data?.recentActivity || []

  const metricCards = [
    { label: 'Users', value: metrics.totalUsers, Icon: IconUser },
    { label: 'Chat Sessions', value: metrics.totalChats, Icon: IconChat },
    { label: 'Explore Cache', value: metrics.totalExplore, Icon: IconSearch },
    { label: 'Contacts', value: metrics.totalContacts, Icon: IconMail },
    { label: 'Study Sessions', value: metrics.totalSessions, Icon: IconBook },
  ]

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 animate-fade-up">
          <div className="w-9 h-9 bg-[#141414] rounded-xl flex items-center justify-center">
            <IconDashboard size={14} className="text-[#737373]" />
          </div>
          <div>
            <h1 className="font-semibold text-headline tracking-tight">Admin Dashboard</h1>
            <p className="text-[#737373] text-caption">Platform-wide metrics and activity</p>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-7 animate-fade-up animate-fade-up-1">
          {metricCards.map(m => (
            <div key={m.label} className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-red-600/10 rounded-lg flex items-center justify-center">
                  <m.Icon size={14} className="text-red-400" />
                </div>
              </div>
              <div className="font-bold text-headline tracking-tight">{m.value?.toLocaleString() ?? '–'}</div>
              <div className="text-caption text-[#737373] mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-up animate-fade-up-2">
          {/* Recent signups */}
          <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
            <h3 className="font-semibold text-body-sm mb-4">Recent signups</h3>
            {recentSignups.length === 0 ? (
              <p className="text-[#404040] text-caption py-8 text-center">No users yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recentSignups.map(u => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 bg-red-600 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                        {(u.display_name || u.email || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-body-sm text-[#d4d4d4] truncate">
                          {u.display_name || u.email?.split('@')[0] || 'User'}
                        </div>
                        <div className="text-[10px] text-[#404040] truncate">{u.email}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-[#525252] shrink-0">
                      {new Date(u.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
            <h3 className="font-semibold text-body-sm mb-4">Recent activity</h3>
            {recentActivity.length === 0 ? (
              <p className="text-[#404040] text-caption py-8 text-center">No activity yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recentActivity.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
                    <div className="min-w-0">
                      <div className="text-body-sm text-[#d4d4d4] truncate">
                        {TOOL_LABELS[s.tool_type] || s.tool_type}
                      </div>
                      {s.subject && (
                        <span className="text-[10px] bg-[#1a1a1a] border border-[#262626] px-2 py-0.5 rounded-full text-[#737373] inline-block mt-0.5">
                          {s.subject}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#525252] shrink-0 ml-3">
                      {new Date(s.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
