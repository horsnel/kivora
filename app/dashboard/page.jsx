'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'
import { IconBookmark, IconChat, IconTrash, IconArrowRight, IconUser, IconMail, IconClock, IconCode, IconBook, IconFlame, IconTarget, IconPlus, IconClose, IconCheck, IconSearch, IconStar, IconMoney, IconLightning, IconGlobe } from '@/components/Icons'
import { useTranslation } from '@/components/LanguageProvider'

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
  study_notes: 'Study Notes Generator',
  devtools_code_explainer: 'Code Explainer',
  devtools_regex: 'Regex Generator',
  devtools_json_formatter: 'JSON Formatter',
  devtools_readme: 'README Generator',
  devtools_sql_builder: 'SQL Builder',
  devtools_api_analyzer: 'API Analyzer',
  devtools_code_reviewer: 'Code Reviewer',
  devtools_math_solver: 'Math Solver',
  devtools_email_writer: 'Email Writer',
  devtools_cold_email: 'Cold Email',
  devtools_pitch_writer: 'Pitch Writer',
  devtools_job_desc: 'Job Description',
  devtools_sop_writer: 'SOP Writer',
  devtools_terminal: 'Terminal Helper',
  devtools_text_improver: 'Text Improver',
  devtools_translator: 'Translator',
  devtools_summariser: 'Summariser',
  devtools_api_tester: 'API Tester',
  devtools_diff_checker: 'Diff Checker',
  devtools_base64: 'Base64',
  devtools_jwt_decoder: 'JWT Decoder',
  devtools_csv_analyser: 'CSV Analyser',
  devtools_data_to_schema: 'Schema Generator',
  devtools_git_helper: 'Git Helper',
  devtools_env_checker: 'Env Auditor',
  explore: 'Explore',
  reelpen: 'ReelPen',
  vision: 'Vision',
  image_gen: 'Image Generation',
  image3d: '3D Viewer',
  sandbox: 'Sandbox',
}

const TOOL_CATEGORIES = {
  chat: 'Chat',
  study_homework: 'StudyDesk',
  study_essay: 'StudyDesk',
  study_research: 'StudyDesk',
  study_citation: 'StudyDesk',
  study_coding: 'StudyDesk',
  study_notes: 'StudyDesk',
  devtools_code_explainer: 'DevTools',
  devtools_regex: 'DevTools',
  devtools_json_formatter: 'DevTools',
  devtools_readme: 'DevTools',
  devtools_sql_builder: 'DevTools',
  devtools_api_analyzer: 'DevTools',
  devtools_code_reviewer: 'DevTools',
  devtools_math_solver: 'DevTools',
  devtools_email_writer: 'DevTools',
  devtools_cold_email: 'DevTools',
  devtools_pitch_writer: 'DevTools',
  devtools_job_desc: 'DevTools',
  devtools_sop_writer: 'DevTools',
  devtools_terminal: 'DevTools',
  devtools_text_improver: 'DevTools',
  devtools_translator: 'DevTools',
  devtools_summariser: 'DevTools',
  devtools_api_tester: 'DevTools',
  devtools_diff_checker: 'DevTools',
  devtools_base64: 'DevTools',
  devtools_jwt_decoder: 'DevTools',
  devtools_csv_analyser: 'DevTools',
  devtools_data_to_schema: 'DevTools',
  devtools_git_helper: 'DevTools',
  devtools_env_checker: 'DevTools',
  explore: 'Explore',
  reelpen: 'ReelPen',
  vision: 'Vision',
  image_gen: 'Image Gen',
  image3d: '3D Viewer',
  sandbox: 'Sandbox',
}

// Icon colors per category
const CATEGORY_COLORS = {
  Chat: { dot: 'bg-red-500', text: 'text-red-400' },
  StudyDesk: { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  DevTools: { dot: 'bg-blue-400', text: 'text-blue-400' },
  Explore: { dot: 'bg-amber-400', text: 'text-amber-400' },
  ReelPen: { dot: 'bg-pink-400', text: 'text-pink-400' },
  Vision: { dot: 'bg-cyan-400', text: 'text-cyan-400' },
  'Image Gen': { dot: 'bg-purple-400', text: 'text-purple-400' },
  '3D Viewer': { dot: 'bg-indigo-400', text: 'text-indigo-400' },
  Sandbox: { dot: 'bg-yellow-400', text: 'text-yellow-400' },
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

/** Compute streak info from session data */
function computeStreak(sessions) {
  if (!sessions || sessions.length === 0) return { current: 0, best: 0 }

  // Group sessions by date string (YYYY-MM-DD)
  const daySet = new Set()
  sessions.forEach(s => {
    if (s.created_at) {
      const d = new Date(s.created_at)
      daySet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
    }
  })

  const days = [...daySet].sort().reverse() // most recent first
  if (days.length === 0) return { current: 0, best: 0 }

  // Current streak: count consecutive days from today backwards
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`

  let currentStreak = 0
  // Start from today or yesterday (to handle mid-day)
  let checkDate = daySet.has(todayStr) ? today : daySet.has(yesterdayStr) ? yesterday : null
  if (checkDate) {
    while (true) {
      const ds = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`
      if (daySet.has(ds)) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
  }

  // Best streak: find longest consecutive run in all days
  const sortedDays = [...daySet].sort()
  let bestStreak = 1
  let runStreak = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i-1])
    const curr = new Date(sortedDays[i])
    const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24))
    if (diff === 1) {
      runStreak++
      bestStreak = Math.max(bestStreak, runStreak)
    } else {
      runStreak = 1
    }
  }
  if (sortedDays.length === 0) bestStreak = 0

  return { current: currentStreak, best: Math.max(bestStreak, currentStreak) }
}

/** Build weekly heatmap data (last 4 weeks) */
function buildWeeklyHeatmap(sessions) {
  // 7 columns (Mon-Sun), 4 rows (weeks)
  const heatmap = Array.from({ length: 4 }, () => Array.from({ length: 7 }, () => 0))

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayOfWeek = today.getDay() // 0=Sun, 1=Mon...
  const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 0=Mon, 6=Sun

  // Count sessions per day for last 28 days
  const dayCounts = {}
  sessions.forEach(s => {
    if (s.created_at) {
      const d = new Date(s.created_at)
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      dayCounts[ds] = (dayCounts[ds] || 0) + 1
    }
  })

  // Fill in the 4x7 grid
  for (let w = 3; w >= 0; w--) {
    for (let d = 0; d < 7; d++) {
      const daysAgo = (3 - w) * 7 + (adjustedDay - d)
      const cellDate = new Date(today)
      cellDate.setDate(cellDate.getDate() - daysAgo)
      const ds = `${cellDate.getFullYear()}-${String(cellDate.getMonth()+1).padStart(2,'0')}-${String(cellDate.getDate()).padStart(2,'0')}`
      heatmap[w][d] = dayCounts[ds] || 0
    }
  }

  return heatmap
}

export default function DashboardPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saves, setSaves] = useState([])
  const [chats, setChats] = useState([])
  const [messages, setMessages] = useState([])
  const [tab, setTab] = useState('saved')
  const [expandedMsg, setExpandedMsg] = useState(null)
  const [activityData, setActivityData] = useState(null)
  const [activityRange, setActivityRange] = useState('week')
  const [allTimeSessions, setAllTimeSessions] = useState([])

  // ── Goals state (moved from home page) ──
  const [goals, setGoals] = useState([])
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [newGoalType, setNewGoalType] = useState('template')
  const [customGoalTitle, setCustomGoalTitle] = useState('')
  const [customGoalMilestones, setCustomGoalMilestones] = useState('')
  const [showGapAnalysis, setShowGapAnalysis] = useState(null)
  const [gapInput, setGapInput] = useState({ current: '', target: '' })

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabasePublic.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUser(user)
    // Check if user has completed onboarding — redirect if not
    const { data: profile } = await supabasePublic.from('profiles').select('onboarding_done').eq('id', user.id).single()
    if (!profile?.onboarding_done) { router.push('/onboarding'); return }
    await Promise.all([loadSaves(user.id), loadChats(user.id), loadMessages(user.id), loadAllTimeSessions(user.id)])
    // Load goals from localStorage
    try {
      const saved = localStorage.getItem('kv_discover_goals')
      if (saved) setGoals(JSON.parse(saved))
    } catch (_) {}
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

  async function loadAllTimeSessions(userId) {
    try {
      const res = await fetch(`/api/study-sessions?user_id=${userId}&range=all`)
      if (res.ok) {
        const data = await res.json()
        setAllTimeSessions(data.sessions || [])
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

  // Load activity when tab is switched to activity/tools or range changes
  useEffect(() => {
    if ((tab === 'activity' || tab === 'tools') && user) loadActivity()
  }, [tab, activityRange, user])

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

  // ── Goal helpers ──
  const GOAL_TEMPLATES = [
    { label: 'Win a Scholarship', icon: IconStar, milestones: ['Research scholarships', 'Prepare documents', 'Write essays', 'Get recommendations', 'Submit applications', 'Follow up'] },
    { label: 'Land an Internship', icon: IconTarget, milestones: ['Build portfolio', 'Prepare resume', 'Network & apply', 'Practice interviews', 'Accept offer', 'Onboard & perform'] },
    { label: 'Start a Side Hustle', icon: IconMoney, milestones: ['Validate idea', 'Build MVP', 'Find first customers', 'Optimize process', 'Scale revenue', 'Automate'] },
    { label: 'Learn a New Skill', icon: IconLightning, milestones: ['Choose skill & resources', 'Set schedule', 'Practice daily', 'Build projects', 'Get feedback', 'Teach others'] },
    { label: 'Get a Remote Job', icon: IconGlobe, milestones: ['Identify target roles', 'Optimize profiles', 'Build presence', 'Apply strategically', 'Ace interviews', 'Negotiate offer'] },
  ]

  function addTemplateGoal(template) {
    const newGoal = {
      id: Date.now(),
      title: template.label,
      milestones: template.milestones.map(m => ({ text: m, done: false })),
      type: 'template',
      createdAt: new Date().toISOString(),
    }
    setGoals(prev => [newGoal, ...prev])
    setShowGoalModal(false)
  }

  function addCustomGoal() {
    if (!customGoalTitle.trim()) return
    const milestones = customGoalMilestones
      .split('\n').map(s => s.trim()).filter(Boolean)
      .map(text => ({ text, done: false }))
    const newGoal = {
      id: Date.now(),
      title: customGoalTitle.trim(),
      milestones: milestones.length > 0 ? milestones : [{ text: 'Get started', done: false }],
      type: 'custom',
      createdAt: new Date().toISOString(),
    }
    setGoals(prev => [newGoal, ...prev])
    setShowGoalModal(false)
    setCustomGoalTitle('')
    setCustomGoalMilestones('')
  }

  function toggleMilestone(goalId, milestoneIndex) {
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g
      const updated = [...g.milestones]
      updated[milestoneIndex] = { ...updated[milestoneIndex], done: !updated[milestoneIndex].done }
      return { ...g, milestones: updated }
    }))
  }

  function deleteGoal(goalId) {
    setGoals(prev => prev.filter(g => g.id !== goalId))
  }

  function goalProgress(goal) {
    if (!goal.milestones.length) return 0
    return Math.round((goal.milestones.filter(m => m.done).length / goal.milestones.length) * 100)
  }

  // Persist goals
  useEffect(() => {
    try { localStorage.setItem('kv_discover_goals', JSON.stringify(goals)) } catch (_) {}
  }, [goals])

  // Streak calculation from all-time sessions
  const streakInfo = useMemo(() => computeStreak(allTimeSessions), [allTimeSessions])

  // Weekly heatmap from all-time sessions
  const heatmapData = useMemo(() => buildWeeklyHeatmap(allTimeSessions), [allTimeSessions])
  const heatmapMax = useMemo(() => {
    const max = Math.max(...heatmapData.flat(), 1)
    return max
  }, [heatmapData])

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
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

  // Heatmap color for a cell value
  function heatmapColor(count) {
    if (count === 0) return 'bg-[#1a1a1a]'
    const ratio = count / heatmapMax
    if (ratio < 0.25) return 'bg-red-900/40'
    if (ratio < 0.5) return 'bg-red-700/50'
    if (ratio < 0.75) return 'bg-red-600/60'
    return 'bg-red-500/80'
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#141414] rounded-xl flex items-center justify-center">
              <IconUser size={14} className="text-muted" />
            </div>
            <div>
              <h1 className="font-semibold text-headline tracking-tight">{t('dashboard.title')}</h1>
              <p className="text-muted text-caption">{user?.email}</p>
            </div>
          </div>
          <button onClick={() => router.push('/profile')} className="flex items-center gap-1.5 text-caption text-muted hover:text-white border border-[#262626] hover:border-[#3a3a3a] px-3 py-1.5 rounded-lg transition-all">
            <IconUser size={14} /> {t('dashboard.profile')}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-7">
          {[
            { label: t('dashboard.streak'), value: streakInfo.current > 0 ? `${streakInfo.current}d` : '0d', icon: streakInfo.current > 0 ? 'flame' : null },
            { label: 'Goals', value: goals.length },
            { label: t('dashboard.saved'), value: saves.length },
            { label: t('dashboard.chats'), value: chats.length },
            { label: t('dashboard.messages'), value: messages.length },
          ].map(s => (
            <div key={s.label} className="bg-[#141414] border border-white/[0.06] rounded-xl px-4 py-3 text-center">
              <div className="font-bold text-headline tracking-tight">{s.icon === 'flame' && <IconFlame size={14} className="inline text-orange-400" />}{s.icon === 'flame' ? ' ' : ''}{s.value}</div>
              <div className="text-caption text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Streak & Weekly Activity */}
        {allTimeSessions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
            {/* Streak card */}
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-red-600/10 rounded-lg flex items-center justify-center">
                  <IconFlame size={14} className="text-red-400" />
                </div>
                <span className="text-caption text-muted">{t('dashboard.study_streak')}</span>
              </div>
              <div className="flex items-end gap-4">
                <div>
                  <div className="font-bold text-2xl tracking-tight">
                    {streakInfo.current > 0 && <IconFlame size={14} className="inline text-orange-400 mr-1" />}
                    {streakInfo.current}
                  </div>
                  <div className="text-caption text-muted">{t('dashboard.current')}</div>
                </div>
                <div className="border-l border-[#262626] pl-4">
                  <div className="font-bold text-lg text-muted tracking-tight">{streakInfo.best}</div>
                  <div className="text-caption text-muted2">{t('dashboard.best')}</div>
                </div>
              </div>
            </div>

            {/* Weekly Activity Heatmap */}
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-red-600/10 rounded-lg flex items-center justify-center">
                  <IconActivity size={14} className="text-red-400" />
                </div>
                <span className="text-caption text-muted">{t('dashboard.weekly_activity')}</span>
              </div>
              <div className="space-y-1">
                {/* Day labels header */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['M','T','W','T','F','S','S'].map((d, i) => (
                    <div key={i} className="text-[9px] text-muted2 text-center font-medium">{d}</div>
                  ))}
                </div>
                {/* Heatmap rows (week 0 = oldest, week 3 = current) */}
                {heatmapData.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((count, di) => (
                      <div
                        key={di}
                        className={`aspect-square rounded-sm ${heatmapColor(count)} transition-colors`}
                        title={count > 0 ? `${count} session${count !== 1 ? 's' : ''}` : 'No activity'}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] text-muted2">Less</span>
                <div className="flex gap-0.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#1a1a1a]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-red-900/40" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-red-700/50" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-red-600/60" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-red-500/80" />
                </div>
                <span className="text-[9px] text-muted2">More</span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-[#141414] border border-[#262626] p-1 rounded-xl mb-6">
          {[
            { id: 'saved', label: t('dashboard.tab_saved'), shortLabel: t('dashboard.tab_saved'), Icon: IconBookmark },
            { id: 'goals', label: 'Goals', shortLabel: 'Goals', Icon: IconTarget },
            { id: 'tools', label: 'Tools', shortLabel: 'Tools', Icon: IconCode },
            { id: 'chats', label: t('dashboard.tab_chats'), shortLabel: t('dashboard.chats'), Icon: IconChat },
            { id: 'messages', label: `${t('dashboard.tab_messages')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`, shortLabel: unreadCount > 0 ? `Msgs (${unreadCount})` : 'Msgs', Icon: IconMail },
            { id: 'activity', label: t('dashboard.tab_activity'), shortLabel: t('dashboard.tab_activity'), Icon: IconActivity },
          ].map(tabItem => (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg text-caption sm:text-body font-medium transition-all whitespace-nowrap ${
                tab === tabItem.id ? 'bg-[#262626] text-white' : 'text-muted hover:text-white'
              }`}>
              <tabItem.Icon size={14} /> <span className="hidden sm:inline">{tabItem.label}</span><span className="sm:hidden">{tabItem.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Goals */}
        {tab === 'goals' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconTarget size={16} className="text-red-500" />
                <h2 className="font-semibold text-sm tracking-tight text-muted">{t('discover.goals.title')}</h2>
                {goals.length > 0 && (
                  <span className="text-[10px] font-mono text-muted bg-[#141414] px-2 py-0.5 rounded-full">{goals.length}</span>
                )}
              </div>
              <button
                onClick={() => setShowGoalModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors press"
              >
                <IconPlus size={12} /> {t('discover.goals.new')}
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="bg-[#141414] rounded-xl p-8 text-center">
                <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-3">
                  <IconTarget size={18} className="text-muted" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5 tracking-tight text-muted">{t('discover.goals.empty')}</h3>
                <p className="text-muted text-xs mb-4 max-w-xs mx-auto">{t('discover.goals.empty.desc')}</p>
                <button
                  onClick={() => setShowGoalModal(true)}
                  className="text-red-500 hover:text-red-400 text-xs font-medium transition-colors"
                >
                  {t('discover.goals.create_first')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map((goal, gi) => {
                  const progress = goalProgress(goal)
                  const completedSteps = goal.milestones.filter(m => m.done).length
                  const isGapOpen = showGapAnalysis === gi

                  return (
                    <div key={goal.id} className="bg-[#141414] rounded-xl overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center shrink-0">
                              <IconTarget size={14} className="text-red-400" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm tracking-tight truncate text-muted">{goal.title}</h3>
                              <p className="text-[10px] text-muted">{t('discover.goals.milestones', { done: completedSteps, total: goal.milestones.length })}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-mono font-semibold ${progress === 100 ? 'text-green-400' : 'text-muted'}`}>
                              {progress}%
                            </span>
                            <button onClick={() => deleteGoal(goal.id)} className="text-muted2 hover:text-red-400 transition-colors">
                              <IconClose size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-3">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progress}%`,
                              background: progress === 100 ? '#16a34a' : '#dc2626',
                            }}
                          />
                        </div>

                        {/* Milestones */}
                        <div className="space-y-1.5">
                          {goal.milestones.map((m, mi) => (
                            <button
                              key={mi}
                              onClick={() => toggleMilestone(goal.id, mi)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors text-xs ${
                                m.done
                                  ? 'bg-green-500/5'
                                  : 'bg-[#0a0a0a] hover:bg-[#1a1a1a]'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                                m.done ? 'bg-green-600' : 'bg-[#1a1a1a]'
                              }`}>
                                {m.done && <IconCheck size={9} className="text-white" />}
                              </div>
                              <span className={m.done ? 'text-muted line-through' : 'text-[#d4d4d4]'}>{m.text}</span>
                            </button>
                          ))}
                        </div>

                        {/* Gap Analysis toggle */}
                        <button
                          onClick={() => setShowGapAnalysis(isGapOpen ? null : gi)}
                          className="mt-3 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          <IconSearch size={11} />
                          {isGapOpen ? t('discover.goals.gap.hide') : t('discover.goals.gap.show')}
                        </button>
                      </div>

                      {/* Gap Analysis panel */}
                      {isGapOpen && (
                        <div className="border-t border-[#1a1a1a] p-4 bg-[#0d0d0d] animate-fade-in">
                          <p className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-3">{t('discover.goals.gap.title', { title: goal.title })}</p>
                          <div className="space-y-2 mb-3">
                            <div>
                              <label className="text-[10px] text-muted block mb-1">{t('discover.goals.gap.current_label')}</label>
                              <input
                                className="w-full bg-[#141414] border border-[#262626] rounded-lg px-3 py-2 text-xs text-white placeholder-[#404040] focus:outline-none transition-colors"
                                placeholder={t('discover.goals.gap.current_placeholder')}
                                value={gapInput.current}
                                onChange={e => setGapInput(prev => ({ ...prev, current: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted block mb-1">{t('discover.goals.gap.target_label')}</label>
                              <input
                                className="w-full bg-[#141414] border border-[#262626] rounded-lg px-3 py-2 text-xs text-white placeholder-[#404040] focus:outline-none transition-colors"
                                placeholder={t('discover.goals.gap.target_placeholder')}
                                value={gapInput.target}
                                onChange={e => setGapInput(prev => ({ ...prev, target: e.target.value }))}
                              />
                            </div>
                          </div>
                          {gapInput.current && gapInput.target && (
                            <div className="bg-[#141414] rounded-lg p-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-[10px] text-green-400 font-semibold mb-1">{t('discover.goals.gap.have')}</p>
                                  <div className="space-y-1">
                                    {gapInput.current.split(',').map((s, i) => (
                                      <div key={i} className="flex items-center gap-1.5 text-xs text-[#d4d4d4]">
                                        <IconCheck size={10} className="text-green-400 shrink-0" />
                                        {s.trim()}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] text-red-400 font-semibold mb-1">{t('discover.goals.gap.need')}</p>
                                  <div className="space-y-1">
                                    {gapInput.target.split(',').map((s, i) => (
                                      <div key={i} className="flex items-center gap-1.5 text-xs text-[#d4d4d4]">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 shrink-0" />
                                        {s.trim()}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Goal Creation Modal */}
        {showGoalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowGoalModal(false)}>
            <div className="bg-[#141414] rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-[#1a1a1a]">
                <h3 className="font-semibold text-sm tracking-tight text-muted">{t('discover.modal.title')}</h3>
                <button onClick={() => setShowGoalModal(false)} className="text-muted hover:text-white transition-colors">
                  <IconClose size={14} />
                </button>
              </div>

              <div className="flex gap-1 p-4 pb-0">
                <button
                  onClick={() => setNewGoalType('template')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    newGoalType === 'template' ? 'bg-red-600 text-white' : 'bg-[#0a0a0a] text-muted hover:text-white'
                  }`}
                >
                  {t('discover.modal.template')}
                </button>
                <button
                  onClick={() => setNewGoalType('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    newGoalType === 'custom' ? 'bg-red-600 text-white' : 'bg-[#0a0a0a] text-muted hover:text-white'
                  }`}
                >
                  {t('discover.modal.custom')}
                </button>
              </div>

              {newGoalType === 'template' ? (
                <div className="p-4 space-y-2">
                  {GOAL_TEMPLATES.map(template => {
                    const TemplateIcon = template.icon
                    return (
                      <button
                        key={template.label}
                        onClick={() => addTemplateGoal(template)}
                        className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all bg-[#0a0a0a] hover:bg-[#1a1a1a]"
                      >
                        <div className="w-8 h-8 bg-[#141414] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                          <TemplateIcon size={14} className="text-muted" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold mb-1 text-muted">{template.label}</p>
                          <div className="flex flex-wrap gap-1">
                            {template.milestones.map((m, i) => (
                              <span key={i} className="text-[9px] text-muted2 bg-[#141414] px-1.5 py-0.5 rounded">{m}</span>
                            ))}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  <div>
                    <label className="text-[10px] text-muted block mb-1.5">{t('discover.modal.goal_title')}</label>
                    <input
                      className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2.5 text-xs text-white placeholder-[#404040] focus:outline-none transition-colors"
                      placeholder={t('discover.modal.goal_title_placeholder')}
                      value={customGoalTitle}
                      onChange={e => setCustomGoalTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1.5">{t('discover.modal.milestones')}</label>
                    <textarea
                      className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2.5 text-xs text-white placeholder-[#404040] focus:outline-none transition-colors min-h-[120px] resize-none"
                      placeholder={`Build portfolio\nPrepare resume\nApply to 20 companies\nPractice interviews\nAccept offer`}
                      value={customGoalMilestones}
                      onChange={e => setCustomGoalMilestones(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={addCustomGoal}
                    disabled={!customGoalTitle.trim()}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-2.5 rounded-lg text-xs font-semibold transition-colors press"
                  >
                    {t('discover.modal.create')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tools Usage */}
        {tab === 'tools' && (
          !activityData ? (
            <div className="space-y-4">
              <div className="skeleton border border-[#262626] rounded-xl p-5 h-48" />
              <div className="skeleton border border-[#262626] rounded-xl p-5 h-64" />
            </div>
          ) : totalSessions === 0 ? (
            <Empty icon={<IconCode size={20} className="text-[#2e2e2e]" />} title="No tool usage yet" desc="Use any tool on the platform while signed in to see your usage stats here." action={{ label: 'Try a tool', href: '/home' }} router={router} />
          ) : (
            <div className="space-y-4">
              {/* Category overview cards */}
              {Object.keys(categoryBreakdown).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(categoryBreakdown)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([cat, data]) => {
                      const colors = CATEGORY_COLORS[cat] || { dot: 'bg-[#404040]', text: 'text-[#888]' }
                      return (
                        <div key={cat} className="bg-[#141414] border border-white/[0.06] rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                            <span className={`text-[13px] font-semibold ${colors.text}`}>{cat}</span>
                          </div>
                          <div className="text-2xl font-bold tracking-tight text-white">{data.count}</div>
                          <div className="text-[11px] text-muted mt-0.5">session{data.count !== 1 ? 's' : ''} · {formatDurationShort(data.timeMs)}</div>
                        </div>
                      )
                    })}
                </div>
              )}

              {/* Per-tool breakdown */}
              {Object.keys(toolBreakdown).length > 0 && (
                <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <h3 className="font-semibold text-body mb-4 text-muted">Tool Breakdown</h3>
                  <div className="space-y-1.5">
                    {Object.entries(toolBreakdown)
                      .sort((a, b) => b[1].count - a[1].count)
                      .map(([tool, data]) => {
                        const cat = TOOL_CATEGORIES[tool] || 'Other'
                        const colors = CATEGORY_COLORS[cat] || { dot: 'bg-[#404040]', text: 'text-[#888]' }
                        const maxCount = Math.max(...Object.values(toolBreakdown).map(d => d.count), 1)
                        const pct = Math.round((data.count / maxCount) * 100)
                        return (
                          <div key={tool} className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[13px] text-[#d4d4d4] truncate">{TOOL_LABELS[tool] || tool}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11px] font-mono text-muted">{data.count}×</span>
                                  <span className="text-[10px] text-muted2">{formatDurationShort(data.timeMs)}</span>
                                </div>
                              </div>
                              <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${colors.dot} opacity-60`} style={{ width: `${pct}%` }} />
                              </div>
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

        {/* Saved */}
        {tab === 'saved' && (
          saves.length === 0 ? (
            <Empty icon={<IconBookmark size={20} className="text-[#2e2e2e]" />} title={t('dashboard.empty_saved')} desc="Explore an opportunity and click Save to bookmark it here." action={{ label: 'Start exploring', href: '/home' }} router={router} />
          ) : (
            <div className="space-y-2">
              {saves.map(save => (
                <div key={save.id} className="bg-[#141414] border border-white/[0.06] rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                  <button onClick={() => router.push(`/explore/${save.result_slug}`)} className="flex-1 text-left">
                    <div className="text-body text-white hover:text-red-400 transition-colors leading-snug">{save.query}</div>
                    <div className="text-caption text-muted2 mt-1">Saved {new Date(save.created_at).toLocaleDateString()}</div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => router.push(`/explore/${save.result_slug}`)} className="text-muted2 hover:text-white transition-colors p-1">
                      <IconArrowRight size={14} />
                    </button>
                    <button onClick={() => deleteSave(save.id)} className="text-muted2 hover:text-red-500 transition-colors p-1">
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
            <Empty icon={<IconChat size={20} className="text-[#2e2e2e]" />} title={t('dashboard.empty_chats')} desc="Chat sessions are saved when you're signed in." action={{ label: 'Start a chat', href: '/chat' }} router={router} />
          ) : (
            <div className="space-y-2">
              {chats.map(chat => {
                const msgs = chat.messages || []
                const first = msgs.find(m => m.role === 'user')
                return (
                  <div key={chat.id} className="bg-[#141414] border border-white/[0.06] rounded-xl px-5 py-4">
                    <div className="text-body text-white mb-1 line-clamp-1 leading-snug">{first?.content || 'Chat session'}</div>
                    <div className="flex items-center gap-3 text-caption text-muted2 font-mono">
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
            <Empty icon={<IconMail size={20} className="text-[#2e2e2e]" />} title={t('dashboard.empty_messages')} desc="Contact form submissions will appear here." action={{ label: 'View contact page', href: '/contact' }} router={router} />
          ) : (
            <div className="space-y-2">
              {messages.map(msg => (
                <div key={msg.id} className={`bg-[#141414] border rounded-xl px-5 py-4 transition-colors ${msg.read ? 'border-white/[0.06]' : 'border-red-900/30 bg-red-950/10'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!msg.read && <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />}
                        <span className="text-body text-white font-medium truncate">{msg.name || t('dashboard.anonymous')}</span>
                        <span className="text-caption text-muted2 shrink-0">{new Date(msg.created_at).toLocaleDateString()}</span>
                      </div>
                      <a href={`mailto:${msg.email}`} className="text-caption text-red-400 hover:text-red-300 transition-colors">{msg.email}</a>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-caption font-medium text-muted bg-[#1a1a1a] border border-[#262626] px-2 py-0.5 rounded-full">{msg.subject}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          if (expandedMsg === msg.id) { setExpandedMsg(null) }
                          else { setExpandedMsg(msg.id); if (!msg.read) markRead(msg.id) }
                        }}
                        className="text-caption text-muted hover:text-white border border-[#262626] hover:border-[#3a3a3a] px-2.5 py-1 rounded-lg transition-all"
                      >
                        {expandedMsg === msg.id ? t('dashboard.hide') : t('dashboard.view')}
                      </button>
                      <button onClick={() => deleteMessage(msg.id)} className="text-muted2 hover:text-red-500 transition-colors p-1">
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
            <Empty icon={<IconActivity size={20} className="text-[#2e2e2e]" />} title={t('dashboard.empty_activity')} desc="Use StudyDesk, DevTools, or Chat while signed in to see your stats here." action={{ label: 'Try StudyDesk', href: '/study' }} router={router} />
          ) : (
            <div className="space-y-4">
              {/* Range selector */}
              <div className="flex gap-1 bg-[#141414] border border-[#262626] p-1 rounded-lg">
                {[
                  { id: 'week', label: t('dashboard.this_week') },
                  { id: 'month', label: t('dashboard.this_month') },
                  { id: 'all', label: t('dashboard.all_time') },
                ].map(r => (
                  <button key={r.id} onClick={() => setActivityRange(r.id)}
                    className={`flex-1 py-1.5 px-3 rounded-md text-caption font-medium transition-all ${
                      activityRange === r.id ? 'bg-[#262626] text-white' : 'text-muted hover:text-white'
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
                    <span className="text-caption text-muted">{t('dashboard.time_spent')}</span>
                  </div>
                  <div className="font-bold text-headline tracking-tight">{formatDuration(totalTimeMs)}</div>
                </div>
                <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-red-600/10 rounded-lg flex items-center justify-center">
                      <IconActivity size={14} className="text-red-400" />
                    </div>
                    <span className="text-caption text-muted">{t('dashboard.sessions')}</span>
                  </div>
                  <div className="font-bold text-headline tracking-tight">{totalSessions}</div>
                </div>
                <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-red-600/10 rounded-lg flex items-center justify-center">
                      <IconBook size={14} className="text-red-400" />
                    </div>
                    <span className="text-caption text-muted">{t('dashboard.subjects')}</span>
                  </div>
                  <div className="font-bold text-headline tracking-tight">{Object.keys(subjectBreakdown).length}</div>
                </div>
              </div>

              {/* Category + Subject breakdown — 2 columns on desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Category breakdown */}
                {Object.keys(categoryBreakdown).length > 0 && (
                  <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                    <h3 className="font-semibold text-body mb-4 text-muted">{t('dashboard.tool_categories')}</h3>
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
                              <span className="text-caption text-muted font-mono">{formatDurationShort(data.timeMs)} · {data.count} session{data.count !== 1 ? 's' : ''}</span>
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
                    <h3 className="font-semibold text-body mb-4 text-muted">{t('dashboard.subjects')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {topSubjects.map(([subject, count]) => (
                        <span key={subject} className="text-caption text-[#d4d4d4] bg-[#1a1a1a] border border-[#262626] px-3 py-1.5 rounded-full font-medium">
                          {subject} <span className="text-muted ml-1">{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent sessions */}
              {activitySessions.length > 0 && (
                <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5">
                  <h3 className="font-semibold text-body mb-4 text-muted">{t('dashboard.recent_sessions')}</h3>
                  <div className="space-y-2">
                    {activitySessions.slice(0, 15).map(s => {
                      const duration = s.duration_ms || (s.ended_at && s.started_at ? new Date(s.ended_at) - new Date(s.started_at) : null)
                      return (
                        <div key={s.id} className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              (CATEGORY_COLORS[TOOL_CATEGORIES[s.tool_type]] || {}).dot || 'bg-[#404040]'
                            }`} />
                            <div className="min-w-0">
                              <div className="text-body text-[#d4d4d4] truncate">{TOOL_LABELS[s.tool_type] || s.tool_type}</div>
                              {s.input_summary && (
                                <div className="text-caption text-muted2 truncate max-w-[480px]">{s.input_summary}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-caption text-muted">
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
      <h3 className="font-semibold mb-1.5 tracking-tight text-muted">{title}</h3>
      <p className="text-muted text-body mb-4">{desc}</p>
      <button onClick={() => router.push(action.href)} className="text-red-500 hover:text-red-400 text-body flex items-center gap-1 mx-auto">
        {action.label} <IconArrowRight size={14} />
      </button>
    </div>
  )
}
