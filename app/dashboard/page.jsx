'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'
import { IconBookmark, IconChat, IconTrash, IconLogout, IconArrowRight, IconUser, IconMail, IconClock, IconCode, IconBook } from '@/components/Icons'

function IconActivity({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 14l3-6 3 4 3-8 3 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Human-readable tool type labels
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

const TOOL_CATEGORIES = {
  chat: 'Chat',
  study_homework: 'StudyDesk',
  study_essay: 'StudyDesk',
  study_research: 'StudyDesk',
  study_citation: 'StudyDesk',
  study_coding: 'StudyDesk',
  devtools_code_explainer: 'DevTools',
  devtools_regex: 'DevTools',
  devtools_json_formatter: 'DevTools',
  devtools_readme: 'DevTools',
  devtools_sql_builder: 'DevTools',
  devtools_api_analyzer: 'DevTools',
}

function formatDuration(ms) {
  if (!ms || ms < 1000) return '<1s'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function formatDurationShort(ms) {
  if (!ms || ms < 1000) return '0m'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saves, setSaves] = useState([])
  const [chats, setChats] = useState([])
  const [messages, setMessages] = useState([])
  const [tab, setTab] = useState('saved')
  const [expandedMsg, setExpandedMsg] = useState(null)
  const [activityData, setActivityData] = useState(null)
  const [activityRange, setActivityRange] = useState('week')

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabasePublic.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUser(user)
    // Check if user has completed onboarding — redirect if not
    const { data: profile } = await supabasePublic.from('profiles').select('onboarding_done').eq('id', user.id).single()
    if (!profile?.onboarding_done) { router.push('/onboarding'); return }
    await Promise.all([loadSaves(user.id), loadChats(user.id), loadMessages(user.id)])
    setLoading(false)
  }

  async function loadSaves(id) {
    const { data } = await supabasePublic.from('saved_results').select('*').eq('user_id', id).order('created_at', { ascending: false })
    if (data) setSaves(data)
  }

  async function loadChats(id) {
    const { data } = await supabasePublic.from('chat_sessions').select('id,messages,updated_at').eq('user_id', id).order('updated_at', { ascending: false }).limit(20)
    if (data) setChats(data)
  }

  async function loadMessages(userId) {
    try {
      const res = await fetch(`/api/messages?user_id=${userId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.submissions || [])
      }
    } catch {}
  }

  async function loadActivity(range) {
    try {
      if (!user) return
      const res = await fetch(`/api/study-sessions?user_id=${user.id}&range=${range || activityRange}`)
      if (res.ok) {
        const data = await res.json()
        setActivityData(data)
      }
    } catch {}
  }

  // Load activity when tab is switched to activity or range changes
  useEffect(() => {
    if (tab === 'activity' && user) loadActivity()
  }, [tab, activityRange, user])

  async function signOut() { await supabasePublic.auth.signOut(); router.push('/auth') }

  async function deleteSave(id) {
    await supabasePublic.from('saved_results').delete().eq('id', id)
    setSaves(p => p.filter(s => s.id !== id))
  }

  async function markRead(id) {
    await fetch(`/api/messages?markRead=${id}`)
    setMessages(p => p.map(m => m.id === id ? { ...m, read: true } : m))
  }

  async function deleteMessage(id) {
    await fetch('/api/messages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setMessages(p => p.filter(m => m.id !== id))
    if (expandedMsg === id) setExpandedMsg(null)
  }

  const unreadCount = messages.filter(m => !m.read).length

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="skeleton w-9 h-9 rounded-xl" />
            <div>
              <div className="skeleton w-24 h-5 rounded mb-1.5" />
              <div className="skeleton w-36 h-3 rounded" />
            </div>
          </div>
          <div className="skeleton w-20 h-7 rounded-lg" />
        </div>
        <div className="grid grid-cols-4 gap-3 mb-7">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton border border-[#262626] rounded-xl px-4 py-3 text-center">
              <div className="skeleton w-8 h-5 rounded mx-auto mb-1.5" />
              <div className="skeleton w-12 h-3 rounded mx-auto" />
            </div>
          ))}
        </div>
        <div className="skeleton border border-[#262626] p-1 rounded-xl mb-6 h-10" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton border border-[#262626] rounded-xl h-16" />
          ))}
        </div>
      </div>
    </div>
  )

  // Compute activity stats for the overview card
  const activitySessions = activityData?.sessions || []
  const totalTimeMs = activityData?.stats?.totalTimeMs || 0
  const totalSessions = activityData?.stats?.totalSessions || 0
  const toolBreakdown = activityData?.stats?.toolBreakdown || {}
  const subjectBreakdown = activityData?.stats?.subjectBreakdown || {}

  // Group tool breakdown by category (Chat, StudyDesk, DevTools)
  const categoryBreakdown = {}
  Object.entries(toolBreakdown).forEach(([tool, data]) => {
    const cat = TOOL_CATEGORIES[tool] || 'Other'
    if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, timeMs: 0 }
    categoryBreakdown[cat].count += data.count
    categoryBreakdown[cat].timeMs += data.timeMs
  })

  // Top subjects sorted by count
  const topSubjects = Object.entries(subjectBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#141414] rounded-xl flex items-center justify-center">
              <IconUser size={14} className="text-[#737373]" />
            </div>
            <div>
              <h1 className="font-semibold text-headline tracking-tight">Dashboard</h1>
              <p className="text-[#737373] text-caption">{user?.email}</p>
            </div>
          </div>
          <button onClick={signOut} className="flex items-center gap-1.5 text-caption text-[#737373] hover:text-white border border-[#262626] hover:border-[#3a3a3a] px-3 py-1.5 rounded-lg transition-all">
            <IconLogout size={14} /> Sign out
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
          {[
            { label: 'Saved', value: saves.length },
            { label: 'Chats', value: chats.length },
            { label: 'Messages', value: messages.length },
            { label: 'Member since', value: user?.created_at ? new Date(user.created_at).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : '—' },
          ].map(s => (
            <div key={s.label} className="bg-[#141414] border border-white/[0.06] rounded-xl px-4 py-3 text-center">
              <div className="font-bold text-headline tracking-tight">{s.value}</div>
              <div className="text-caption text-[#737373] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#141414] border border-[#262626] p-1 rounded-xl mb-6">
          {[
            { id: 'saved', label: 'Saved', shortLabel: 'Saved', Icon: IconBookmark },
            { id: 'chats', label: 'Chat History', shortLabel: 'Chats', Icon: IconChat },
            { id: 'messages', label: `Messages${unreadCount > 0 ? ` (${unreadCount})` : ''}`, shortLabel: unreadCount > 0 ? `Msgs (${unreadCount})` : 'Msgs', Icon: IconMail },
            { id: 'activity', label: 'Activity', shortLabel: 'Activity', Icon: IconActivity },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg text-caption sm:text-body font-medium transition-all whitespace-nowrap ${
                tab === t.id ? 'bg-[#262626] text-white' : 'text-[#737373] hover:text-white'
              }`}>
              <t.Icon size={14} /> <span className="hidden sm:inline">{t.label}</span><span className="sm:hidden">{t.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Saved */}
        {tab === 'saved' && (
          saves.length === 0 ? (
            <Empty icon={<IconBookmark size={20} className="text-[#2e2e2e]" />} title="No saved opportunities" desc="Explore an opportunity and click Save to bookmark it here." action={{ label: 'Start exploring', href: '/' }} router={router} />
          ) : (
            <div className="space-y-2">
              {saves.map(save => (
                <div key={save.id} className="bg-[#141414] border border-white/[0.06] rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                  <button onClick={() => router.push(`/explore/${save.result_slug}`)} className="flex-1 text-left">
                    <div className="text-body text-white hover:text-red-400 transition-colors leading-snug">{save.query}</div>
                    <div className="text-caption text-[#404040] mt-1">Saved {new Date(save.created_at).toLocaleDateString()}</div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => router.push(`/explore/${save.result_slug}`)} className="text-[#404040] hover:text-white transition-colors p-1">
                      <IconArrowRight size={14} />
                    </button>
                    <button onClick={() => deleteSave(save.id)} className="text-[#404040] hover:text-red-500 transition-colors p-1">
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Chats */}
        {tab === 'chats' && (
          chats.length === 0 ? (
            <Empty icon={<IconChat size={20} className="text-[#2e2e2e]" />} title="No chat history" desc="Chat sessions are saved when you're signed in." action={{ label: 'Start a chat', href: '/chat' }} router={router} />
          ) : (
            <div className="space-y-2">
              {chats.map(chat => {
                const msgs = chat.messages || []
                const first = msgs.find(m => m.role === 'user')
                return (
                  <div key={chat.id} className="bg-[#141414] border border-white/[0.06] rounded-xl px-5 py-4">
                    <div className="text-body text-white mb-1 line-clamp-1 leading-snug">{first?.content || 'Chat session'}</div>
                    <div className="flex items-center gap-3 text-caption text-[#404040] font-mono">
                      <span>{msgs.length} msg{msgs.length !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>{new Date(chat.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* Messages */}
        {tab === 'messages' && (
          messages.length === 0 ? (
            <Empty icon={<IconMail size={20} className="text-[#2e2e2e]" />} title="No messages yet" desc="Contact form submissions will appear here." action={{ label: 'View contact page', href: '/contact' }} router={router} />
          ) : (
            <div className="space-y-2">
              {messages.map(msg => (
                <div key={msg.id} className={`bg-[#141414] border rounded-xl px-5 py-4 transition-colors ${msg.read ? 'border-white/[0.06]' : 'border-red-900/30 bg-red-950/10'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!msg.read && <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />}
                        <span className="text-body text-white font-medium truncate">{msg.name || 'Anonymous'}</span>
                        <span className="text-caption text-[#404040] shrink-0">{new Date(msg.created_at).toLocaleDateString()}</span>
                      </div>
                      <a href={`mailto:${msg.email}`} className="text-caption text-red-400 hover:text-red-300 transition-colors">{msg.email}</a>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-caption font-medium text-[#737373] bg-[#1a1a1a] border border-[#262626] px-2 py-0.5 rounded-full">{msg.subject}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          if (expandedMsg === msg.id) { setExpandedMsg(null) }
                          else { setExpandedMsg(msg.id); if (!msg.read) markRead(msg.id) }
                        }}
                        className="text-caption text-[#737373] hover:text-white border border-[#262626] hover:border-[#3a3a3a] px-2.5 py-1 rounded-lg transition-all"
                      >
                        {expandedMsg === msg.id ? 'Hide' : 'View'}
                      </button>
                      <button onClick={() => deleteMessage(msg.id)} className="text-[#404040] hover:text-red-500 transition-colors p-1">
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                  {expandedMsg === msg.id && (
                    <div className="mt-3 pt-3 border-t border-[#262626]">
                      <p className="text-body text-[#d4d4d4] leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* Activity */}
        {tab === 'activity' && (
          !activityData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton border border-[#262626] rounded-xl p-5 h-28" />
                ))}
              </div>
              <div className="skeleton border border-[#262626] rounded-xl p-5 h-48" />
            </div>
          ) : totalSessions === 0 ? (
            <Empty icon={<IconActivity size={20} className="text-[#2e2e2e]" />} title="No activity yet" desc="Use StudyDesk, DevTools, or Chat while signed in to see your stats here." action={{ label: 'Try StudyDesk', href: '/study' }} router={router} />
          ) : (
            <div className="space-y-4">
              {/* Range selector */}
              <div className="flex gap-1 bg-[#141414] border border-[#262626] p-1 rounded-lg">
                {[
                  { id: 'week', label: 'This week' },
                  { id: 'month', label: 'This month' },
                  { id: 'all', label: 'All time' },
                ].map(r => (
                  <button key={r.id} onClick={() => setActivityRange(r.id)}
                    className={`flex-1 py-1.5 px-3 rounded-md text-caption font-medium transition-all ${
                      activityRange === r.id ? 'bg-[#262626] text-white' : 'text-[#737373] hover:text-white'
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Overview stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-red-600/10 rounded-lg flex items-center justify-center">
                      <IconClock size={14} className="text-red-400" />
                    </div>
                    <span className="text-caption text-[#737373]">Time spent</span>
                  </div>
                  <div className="font-bold text-headline tracking-tight">{formatDuration(totalTimeMs)}</div>
                </div>
                <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-red-600/10 rounded-lg flex items-center justify-center">
                      <IconActivity size={14} className="text-red-400" />
                    </div>
                    <span className="text-caption text-[#737373]">Sessions</span>
                  </div>
                  <div className="font-bold text-headline tracking-tight">{totalSessions}</div>
                </div>
                <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-red-600/10 rounded-lg flex items-center justify-center">
                      <IconBook size={14} className="text-red-400" />
                    </div>
                    <span className="text-caption text-[#737373]">Subjects</span>
                  </div>
                  <div className="font-bold text-headline tracking-tight">{Object.keys(subjectBreakdown).length}</div>
                </div>
              </div>

              {/* Category + Subject breakdown — 2 columns on desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Category breakdown */}
                {Object.keys(categoryBreakdown).length > 0 && (
                  <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                    <h3 className="font-semibold text-body mb-4">Tool categories</h3>
                    <div className="space-y-3">
                      {Object.entries(categoryBreakdown)
                        .sort((a, b) => b[1].timeMs - a[1].timeMs)
                        .map(([cat, data]) => {
                        const maxTime = Math.max(...Object.values(categoryBreakdown).map(d => d.timeMs), 1)
                        const pct = Math.round((data.timeMs / maxTime) * 100)
                        return (
                          <div key={cat}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-body text-[#d4d4d4]">{cat}</span>
                              <span className="text-caption text-[#737373] font-mono">{formatDurationShort(data.timeMs)} · {data.count} session{data.count !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                              <div className="h-full bg-red-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Subject breakdown */}
                {topSubjects.length > 0 && (
                  <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                    <h3 className="font-semibold text-body mb-4">Subjects</h3>
                    <div className="flex flex-wrap gap-2">
                      {topSubjects.map(([subject, count]) => (
                        <span key={subject} className="text-caption text-[#d4d4d4] bg-[#1a1a1a] border border-[#262626] px-3 py-1.5 rounded-full font-medium">
                          {subject} <span className="text-[#737373] ml-1">{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent sessions */}
              {activitySessions.length > 0 && (
                <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <h3 className="font-semibold text-body mb-4">Recent sessions</h3>
                  <div className="space-y-2">
                    {activitySessions.slice(0, 15).map(s => {
                      const duration = s.duration_ms || (s.ended_at && s.started_at ? new Date(s.ended_at) - new Date(s.started_at) : null)
                      return (
                        <div key={s.id} className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              TOOL_CATEGORIES[s.tool_type] === 'Chat' ? 'bg-red-500' :
                              TOOL_CATEGORIES[s.tool_type] === 'StudyDesk' ? 'bg-emerald-400' :
                              TOOL_CATEGORIES[s.tool_type] === 'DevTools' ? 'bg-blue-500' : 'bg-[#404040]'
                            }`} />
                            <div className="min-w-0">
                              <div className="text-body text-[#d4d4d4] truncate">{TOOL_LABELS[s.tool_type] || s.tool_type}</div>
                              {s.input_summary && (
                                <div className="text-caption text-[#404040] truncate max-w-[480px]">{s.input_summary}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-caption text-[#737373]">
                            {duration != null && <span className="font-mono">{formatDuration(duration)}</span>}
                            {s.subject && <span className="bg-[#1a1a1a] border border-[#262626] px-2 py-0.5 rounded-full text-caption">{s.subject}</span>}
                            <span>{new Date(s.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </main>
  )
}

function Empty({ icon, title, desc, action, router }) {
  return (
    <div className="text-center py-16">
      <div className="w-10 h-10 bg-[#141414] rounded-xl flex items-center justify-center mx-auto mb-4">{icon}</div>
      <h3 className="font-semibold mb-1.5 tracking-tight">{title}</h3>
      <p className="text-[#737373] text-body mb-4">{desc}</p>
      <button onClick={() => router.push(action.href)} className="text-red-500 hover:text-red-400 text-body flex items-center gap-1 mx-auto">
        {action.label} <IconArrowRight size={14} />
      </button>
    </div>
  )
}
