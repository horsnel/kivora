'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/components/CurrencyToggle'
import { useTranslation } from '@/components/LanguageProvider'
import { supabasePublic } from '@/lib/supabase'
import {
  IconTarget, IconFlame, IconLightning, IconTrending, IconSearch,
  IconArrowRight, IconCheck, IconClose, IconPlus, IconSpinner,
  IconMoney, IconTool, IconBookmark, IconBookmarkFill,
  IconEye, IconStar, IconGlobe
} from '@/components/Icons'

// ── "Did You Know?" fact library ──
const FACTS = [
  'The Gates Millennium Scholarship has funded over 20,000 scholars since 1999, covering full graduate and undergraduate costs.',
  'Most internship applications close 3–4 months before the start date — start searching in October for summer roles.',
  'Over 60% of freelance developers found their first client through personal networks, not job boards.',
  'The average Fulbright Scholar receives $35,000+ in funding for a year of research or study abroad.',
  'Remote work listings have increased by 350% since 2020, with tech and marketing leading the way.',
  'Chevening Scholarships fund over 1,500 leaders from 160 countries each year for UK-based master\'s degrees.',
  'Only 12% of scholarship applicants follow up after submitting — doing so can double your chances.',
  'The top 5% of Etsy sellers earn over $50,000/year from digital products alone.',
  'FreeCodeCamp certifications are recognized by employers at Google, Apple, and Microsoft for entry-level roles.',
  'DAAD scholarships fund over 100,000 international students annually for study in Germany — many programs are in English.',
  'Building a portfolio with 3 strong projects is more impactful than a resume with 10 shallow ones.',
  'The Rhodes Scholarship covers all expenses for 2–3 years of study at Oxford — and accepts applicants under 24 from 60+ countries.',
  'Side projects that solve a real problem are 4x more likely to get you hired than traditional applications.',
  'Most Y Combinator startups are founded by people who met in university or at previous jobs.',
  'GitHub Sponsors and Open Collective let you earn from open-source work — some developers make $5,000+/month.',
]

// ── Goal templates ──
const GOAL_TEMPLATES = [
  { label: 'Win a Scholarship', icon: IconStar, milestones: ['Research scholarships', 'Prepare documents', 'Write essays', 'Get recommendations', 'Submit applications', 'Follow up'] },
  { label: 'Land an Internship', icon: IconTarget, milestones: ['Build portfolio', 'Prepare resume', 'Network & apply', 'Practice interviews', 'Accept offer', 'Onboard & perform'] },
  { label: 'Start a Side Hustle', icon: IconMoney, milestones: ['Validate idea', 'Build MVP', 'Find first customers', 'Optimize process', 'Scale revenue', 'Automate'] },
  { label: 'Learn a New Skill', icon: IconLightning, milestones: ['Choose skill & resources', 'Set schedule', 'Practice daily', 'Build projects', 'Get feedback', 'Teach others'] },
  { label: 'Get a Remote Job', icon: IconGlobe, milestones: ['Identify target roles', 'Optimize profiles', 'Build presence', 'Apply strategically', 'Ace interviews', 'Negotiate offer'] },
]

// ── Swipe filter options ──
const FIELD_FILTERS = ['all', 'tech', 'business', 'creative', 'education', 'finance']
const TYPE_FILTERS = ['all', 'scholarship', 'internship', 'fellowship', 'job', 'side_hustle']

export default function DiscoverPage() {
  const router = useRouter()
  const { format } = useCurrency()
  const [user, setUser] = useState(null)

  // ── Data ──
  const [opportunities, setOpportunities] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  // ── Did You Know ──
  const [factIndex, setFactIndex] = useState(0)

  // ── Goals ──
  const [goals, setGoals] = useState([])
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [newGoalType, setNewGoalType] = useState('template')
  const [customGoalTitle, setCustomGoalTitle] = useState('')
  const [customGoalMilestones, setCustomGoalMilestones] = useState('')

  // ── Gap Analysis ──
  const [showGapAnalysis, setShowGapAnalysis] = useState(null)
  const [gapInput, setGapInput] = useState({ current: '', target: '' })

  // ── Swipe Discovery ──
  const [swipeIndex, setSwipeIndex] = useState(0)
  const [swipeDirection, setSwipeDirection] = useState(null)
  const [savedOpps, setSavedOpps] = useState([])
  const [skippedOpps, setSkippedOpps] = useState([])
  const [fieldFilter, setFieldFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  // ── Auth ──
  useEffect(() => {
    if (!supabasePublic) return
    supabasePublic.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  // ── Load data ──
  useEffect(() => { loadOpportunities() }, [])

  // ── Load goals from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kv_discover_goals')
      if (saved) setGoals(JSON.parse(saved))
      const savedOppsLocal = localStorage.getItem('kv_discover_saved_opps')
      if (savedOppsLocal) setSavedOpps(JSON.parse(savedOppsLocal))
    } catch (_) {}
  }, [])

  // ── Persist goals ──
  useEffect(() => {
    try { localStorage.setItem('kv_discover_goals', JSON.stringify(goals)) } catch (_) {}
  }, [goals])

  // ── Persist saved opps ──
  useEffect(() => {
    try { localStorage.setItem('kv_discover_saved_opps', JSON.stringify(savedOpps)) } catch (_) {}
  }, [savedOpps])

  // ── Rotate facts ──
  useEffect(() => {
    const timer = setInterval(() => {
      setFactIndex(prev => (prev + 1) % FACTS.length)
    }, 12000)
    return () => clearInterval(timer)
  }, [])

  const { t } = useTranslation()

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('discover.greeting.morning')
    if (h < 18) return t('discover.greeting.afternoon')
    return t('discover.greeting.evening')
  }

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || t('discover.builder')

  async function loadOpportunities() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/explore_cache?select=slug,query,result,views,category,created_at&order=views.desc&limit=50`,
        { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` } }
      )
      const data = await res.json()
      if (Array.isArray(data)) setOpportunities(data)
    } catch (_) {}
    setDataLoading(false)
  }

  // ── Goal helpers ──
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

  // ── Swipe helpers ──
  const filteredSwipeOpps = opportunities.filter(opp => {
    if (skippedOpps.includes(opp.slug)) return false
    if (fieldFilter !== 'all') {
      const tags = (opp.result?.tags || []).map(tg => tg.toLowerCase())
      const cat = (opp.category || '').toLowerCase()
      const q = (opp.query || '').toLowerCase()
      const fl = fieldFilter.toLowerCase()
      if (!tags.some(tg => tg.includes(fl)) && !cat.includes(fl) && !q.includes(fl)) return false
    }
    if (typeFilter !== 'all') {
      const q = (opp.query || '').toLowerCase()
      const tags = (opp.result?.tags || []).map(tg => tg.toLowerCase())
      const tl = typeFilter.toLowerCase()
      if (!q.includes(tl) && !tags.some(tg => tg.includes(tl))) return false
    }
    return true
  })

  function handleSwipe(direction) {
    const currentOpp = filteredSwipeOpps[swipeIndex]
    if (!currentOpp) return
    setSwipeDirection(direction)
    if (direction === 'right') {
      setSavedOpps(prev => prev.includes(currentOpp.slug) ? prev : [...prev, currentOpp.slug])
    } else {
      setSkippedOpps(prev => [...prev, currentOpp.slug])
    }
    setTimeout(() => {
      setSwipeIndex(prev => prev + 1)
      setSwipeDirection(null)
    }, 300)
  }

  function undoSwipe() {
    if (swipeIndex <= 0) return
    const prevOpp = filteredSwipeOpps[swipeIndex - 1]
    if (prevOpp) {
      setSkippedOpps(prev => prev.filter(s => s !== prevOpp.slug))
      setSavedOpps(prev => prev.filter(s => s !== prevOpp.slug))
    }
    setSwipeIndex(prev => prev - 1)
  }

  // ── Opportunity of the Day ──
  const oppOfDay = opportunities.length > 0
    ? opportunities[new Date().getDate() % opportunities.length]
    : null

  // ── Featured (top 8) ──
  const featured = opportunities.slice(0, 8)

  // ── Progress ring stats ──
  const profileCompletion = user ? 65 : 0
  const goalsProgress = goals.length > 0
    ? Math.round(goals.reduce((sum, g) => sum + goalProgress(g), 0) / goals.length)
    : 0
  const oppsExplored = opportunities.length
  const savedCount = savedOpps.length

  return (
    <main className="min-h-screen bg-[#0a0a0a] pb-12">

      {/* ═══════════════════════════════════════════════
          Section 1: Greeting + Did You Know
      ═══════════════════════════════════════════════ */}
      <section className="max-w-4xl mx-auto px-4 pt-6 pb-2 animate-fade-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {getGreeting()}, <span className="text-red-500">{displayName}</span>
            </h1>
            <p className="text-[#737373] text-sm mt-0.5">{t('discover.greeting.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#737373] shrink-0">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full pulse-dot" />
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>

        {/* Did You Know? — invisible border card */}
        <div className="bg-[#141414] rounded-xl p-4 flex items-start gap-3 group">
          <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
            <IconLightning size={14} className="text-red-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-red-400 font-semibold mb-1">{t('discover.didyouknow')}</p>
            <p className="text-sm text-[#d4d4d4] leading-relaxed transition-all duration-300">{FACTS[factIndex]}</p>
          </div>
          <button
            onClick={() => setFactIndex(prev => (prev + 1) % FACTS.length)}
            className="text-[#737373] hover:text-white transition-colors shrink-0 mt-1"
            title={t('discover.next_fact')}
          >
            <IconArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          Section 2: Progress Rings
      ═══════════════════════════════════════════════ */}
      <section className="max-w-4xl mx-auto px-4 py-5 animate-fade-up animate-fade-up-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ProgressRing value={profileCompletion} label={t('discover.progress.profile')} color="#dc2626" />
          <ProgressRing value={goalsProgress} label={t('discover.progress.goals')} color="#f59e0b" />
          <ProgressRing value={Math.min(100, oppsExplored)} label={t('discover.progress.available')} color="#3b82f6" subtitle={t('discover.progress.opps', { count: oppsExplored })} />
          <ProgressRing value={savedCount > 0 ? 100 : 0} label={t('discover.progress.saved')} color="#16a34a" subtitle={`${savedCount}`} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          Section 3: Goal Mapper / Roadmap
      ═══════════════════════════════════════════════ */}
      <section className="max-w-4xl mx-auto px-4 py-3 animate-fade-up animate-fade-up-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <IconTarget size={16} className="text-red-500" />
            <h2 className="text-base font-semibold tracking-tight">{t('discover.goals.title')}</h2>
            {goals.length > 0 && (
              <span className="text-[10px] font-mono text-[#737373] bg-[#141414] px-2 py-0.5 rounded-full">{goals.length}</span>
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
              <IconTarget size={18} className="text-[#737373]" />
            </div>
            <h3 className="font-semibold text-sm mb-1.5 tracking-tight">{t('discover.goals.empty')}</h3>
            <p className="text-[#737373] text-xs mb-4 max-w-xs mx-auto">{t('discover.goals.empty.desc')}</p>
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
                  {/* Goal header */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center shrink-0">
                          <IconTarget size={14} className="text-red-400" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm tracking-tight truncate">{goal.title}</h3>
                          <p className="text-[10px] text-[#737373]">{t('discover.goals.milestones', { done: completedSteps, total: goal.milestones.length })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-mono font-semibold ${progress === 100 ? 'text-green-400' : 'text-[#737373]'}`}>
                          {progress}%
                        </span>
                        <button onClick={() => deleteGoal(goal.id)} className="text-[#404040] hover:text-red-400 transition-colors">
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
                          <span className={m.done ? 'text-[#737373] line-through' : 'text-[#d4d4d4]'}>{m.text}</span>
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
                      <p className="text-[10px] uppercase tracking-widest text-[#737373] font-semibold mb-3">{t('discover.goals.gap.title', { title: goal.title })}</p>
                      <div className="space-y-2 mb-3">
                        <div>
                          <label className="text-[10px] text-[#737373] block mb-1">{t('discover.goals.gap.current_label')}</label>
                          <input
                            className="w-full bg-[#141414] border border-[#262626] rounded-lg px-3 py-2 text-xs text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"
                            placeholder={t('discover.goals.gap.current_placeholder')}
                            value={gapInput.current}
                            onChange={e => setGapInput(prev => ({ ...prev, current: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#737373] block mb-1">{t('discover.goals.gap.target_label')}</label>
                          <input
                            className="w-full bg-[#141414] border border-[#262626] rounded-lg px-3 py-2 text-xs text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"
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
      </section>

      {/* ═══════════════════════════════════════════════
          Section 4: Opportunity of the Day
      ═══════════════════════════════════════════════ */}
      {oppOfDay && (
        <section className="max-w-4xl mx-auto px-4 py-3 animate-fade-up animate-fade-up-3">
          <div className="flex items-center gap-2 mb-3">
            <IconStar size={14} className="text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">{t('discover.opp_of_day')}</span>
          </div>
          <div className="bg-[#141414] rounded-xl p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[60px] pointer-events-none" />
            <div className="relative">
              <h3 className="font-semibold text-sm sm:text-base tracking-tight leading-snug mb-1.5 max-w-md">
                {oppOfDay.result?.title || oppOfDay.query}
              </h3>
              <div className="flex items-center gap-3 text-xs text-[#737373] mb-3">
                <span className="flex items-center gap-1"><IconEye size={11} />{(oppOfDay.views || 0).toLocaleString()} views</span>
                {(oppOfDay.result?.tags || []).slice(0, 2).map(tag => (
                  <span key={tag} className="text-[10px] font-mono text-[#404040] bg-[#0a0a0a] px-2 py-0.5 rounded-full">#{tag}</span>
                ))}
              </div>
              {oppOfDay.result && (
                <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
                  <div className="flex items-center gap-1.5 text-[#d4d4d4] font-medium">
                    <IconMoney size={13} className="text-green-400" />
                    {format(oppOfDay.result.income_min || 0)}–{format(oppOfDay.result.income_max || 0)}
                    <span className="text-[#737373]">/{oppOfDay.result.income_period || 'mo'}</span>
                  </div>
                  <span className="flex items-center gap-1 text-[#737373]"><IconLightning size={11} />{oppOfDay.result.start_days}d to start</span>
                  <span className="flex items-center gap-1 text-[#737373]"><IconTool size={11} />{format(oppOfDay.result.monthly_cost || 0)}/mo</span>
                </div>
              )}
              <button
                onClick={() => router.push(`/explore/${oppOfDay.slug}`)}
                className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors"
              >
                {t('discover.opp.view_opportunity')} <IconArrowRight size={12} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          Section 5: Featured Opportunities Carousel
      ═══════════════════════════════════════════════ */}
      {featured.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 py-3 animate-fade-up animate-fade-up-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IconFlame size={14} className="text-red-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#737373]">{t('discover.featured')}</span>
            </div>
            <Link href="/opportunities" className="text-xs text-red-500 hover:text-red-400 transition-colors flex items-center gap-1">
              {t('discover.opp.view_all')} <IconArrowRight size={11} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory -mx-4 px-4">
            {featured.map(opp => (
              <button
                key={opp.slug}
                onClick={() => router.push(`/explore/${opp.slug}`)}
                className="bg-[#141414] rounded-xl p-4 text-left transition-all group hover:bg-[#1a1a1a] min-w-[200px] sm:min-w-[220px] snap-start shrink-0"
              >
                <h4 className="font-semibold text-xs mb-2 group-hover:text-red-400 transition-colors line-clamp-2 leading-snug tracking-tight">
                  {opp.result?.title || opp.query}
                </h4>
                {opp.result && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[#d4d4d4] text-xs font-medium">
                      <IconMoney size={12} />
                      {format(opp.result.income_min || 0)}–{format(opp.result.income_max || 0)}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#737373]">
                      <span className="flex items-center gap-0.5"><IconLightning size={10} />{opp.result.start_days}d</span>
                      <span className="flex items-center gap-0.5"><IconEye size={10} />{(opp.views || 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {(opp.result?.tags || []).slice(0, 2).map(tag => (
                    <span key={tag} className="text-[9px] font-mono text-[#404040] bg-[#0a0a0a] px-1.5 py-0.5 rounded-full">#{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          Section 6: Swipe Discovery
      ═══════════════════════════════════════════════ */}
      <section className="max-w-4xl mx-auto px-4 py-3 animate-fade-up animate-fade-up-5">
        <div className="flex items-center gap-2 mb-3">
          <IconTrending size={14} className="text-red-500" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#737373]">{t('discover.discover')}</span>
        </div>

        {/* Filters */}
        <div className="space-y-2 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {FIELD_FILTERS.map(f => (
              <button key={f} onClick={() => { setFieldFilter(f); setSwipeIndex(0) }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                  fieldFilter === f ? 'bg-red-600 text-white' : 'bg-[#141414] text-[#737373] hover:text-white hover:bg-[#1a1a1a]'
                }`}>
                {t(`discover.filter.${f}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map(tf => (
              <button key={tf} onClick={() => { setTypeFilter(tf); setSwipeIndex(0) }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                  typeFilter === tf ? 'bg-red-600 text-white' : 'bg-[#141414] text-[#737373] hover:text-white hover:bg-[#1a1a1a]'
                }`}>
                {t(`discover.filter.${tf}`)}
              </button>
            ))}
          </div>
        </div>

        {dataLoading ? (
          <div className="bg-[#141414] rounded-xl p-8 text-center">
            <IconSpinner size={16} className="text-red-500 mx-auto mb-2" />
            <p className="text-xs text-[#737373]">{t('discover.swipe.loading')}</p>
          </div>
        ) : filteredSwipeOpps.length === 0 || swipeIndex >= filteredSwipeOpps.length ? (
          <div className="bg-[#141414] rounded-xl p-8 text-center">
            <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-3">
              <IconCheck size={16} className="text-green-400" />
            </div>
            <h3 className="font-semibold text-sm mb-1.5 tracking-tight">
              {filteredSwipeOpps.length === 0 ? t('discover.swipe.empty') : t('discover.swipe.all_seen')}
            </h3>
            <p className="text-[#737373] text-xs mb-4">
              {savedOpps.length > 0 ? t('discover.swipe.saved_count', { count: savedOpps.length }) : t('discover.swipe.change_filters')}
            </p>
            {savedOpps.length > 0 && (
              <Link href="/opportunities" className="text-red-500 hover:text-red-400 text-xs font-medium transition-colors">
                {t('discover.swipe.view_saved')}
              </Link>
            )}
          </div>
        ) : (
          <div>
            <p className="text-[10px] text-[#404040] font-mono mb-2">
              {t('discover.swipe.of', { current: swipeIndex + 1, total: filteredSwipeOpps.length })}
            </p>

            {(() => {
              const opp = filteredSwipeOpps[swipeIndex]
              const isSaved = savedOpps.includes(opp.slug)
              return (
                <div className={`bg-[#141414] rounded-xl p-5 sm:p-6 transition-all duration-300 ${
                  swipeDirection === 'right' ? 'translate-x-[120%] opacity-0' :
                  swipeDirection === 'left' ? '-translate-x-[120%] opacity-0' : ''
                }`}>
                  <div className="mb-3">
                    <h3 className="font-semibold text-sm sm:text-base tracking-tight leading-snug mb-1">
                      {opp.result?.title || opp.query}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] text-[#737373]">
                      <span className="flex items-center gap-0.5"><IconEye size={10} />{(opp.views || 0).toLocaleString()}</span>
                      {(opp.result?.tags || []).slice(0, 3).map(tag => (
                        <span key={tag} className="font-mono text-[#404040] bg-[#0a0a0a] px-1.5 py-0.5 rounded-full">#{tag}</span>
                      ))}
                    </div>
                  </div>

                  {opp.result && (
                    <div className="space-y-2 mb-5">
                      <div className="flex items-center gap-1.5 text-sm text-[#d4d4d4] font-medium">
                        <IconMoney size={14} className="text-green-400" />
                        {format(opp.result.income_min || 0)} – {format(opp.result.income_max || 0)}
                        <span className="text-[#737373] text-xs">/{opp.result.income_period || 'mo'}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#737373]">
                        <span className="flex items-center gap-1"><IconLightning size={12} />{opp.result.start_days} days to start</span>
                        <span className="flex items-center gap-1"><IconTool size={12} />{format(opp.result.monthly_cost || 0)}/mo</span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSwipe('left')}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0a0a0a] text-[#737373] hover:text-white hover:bg-[#1a1a1a] transition-all text-xs font-medium press"
                    >
                      {t('discover.swipe.skip')}
                    </button>
                    <button
                      onClick={() => handleSwipe('right')}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600/10 text-green-400 hover:bg-green-600/20 transition-all text-xs font-semibold press"
                    >
                      {isSaved ? <IconBookmarkFill size={13} /> : <IconBookmark size={13} />}
                      {t('discover.swipe.save')}
                    </button>
                    <Link
                      href={`/explore/${opp.slug}`}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all text-xs font-semibold press"
                    >
                      {t('discover.swipe.explore')} <IconArrowRight size={11} />
                    </Link>
                  </div>
                </div>
              )
            })()}

            {swipeIndex > 0 && (
              <button onClick={undoSwipe} className="mt-2 text-[10px] text-[#737373] hover:text-white transition-colors flex items-center gap-1 mx-auto">
                {t('discover.swipe.undo')}
              </button>
            )}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════
          Goal Creation Modal
      ═══════════════════════════════════════════════ */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowGoalModal(false)}>
          <div className="bg-[#141414] rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[#1a1a1a]">
              <h3 className="font-semibold text-sm tracking-tight">{t('discover.modal.title')}</h3>
              <button onClick={() => setShowGoalModal(false)} className="text-[#737373] hover:text-white transition-colors">
                <IconClose size={14} />
              </button>
            </div>

            <div className="flex gap-1 p-4 pb-0">
              <button
                onClick={() => setNewGoalType('template')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  newGoalType === 'template' ? 'bg-red-600 text-white' : 'bg-[#0a0a0a] text-[#737373] hover:text-white'
                }`}
              >
                {t('discover.modal.template')}
              </button>
              <button
                onClick={() => setNewGoalType('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  newGoalType === 'custom' ? 'bg-red-600 text-white' : 'bg-[#0a0a0a] text-[#737373] hover:text-white'
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
                        <TemplateIcon size={14} className="text-[#737373]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold mb-1">{template.label}</p>
                        <div className="flex flex-wrap gap-1">
                          {template.milestones.map((m, i) => (
                            <span key={i} className="text-[9px] text-[#404040] bg-[#141414] px-1.5 py-0.5 rounded">{m}</span>
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
                  <label className="text-[10px] text-[#737373] block mb-1.5">{t('discover.modal.goal_title')}</label>
                  <input
                    className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2.5 text-xs text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"
                    placeholder={t('discover.modal.goal_title_placeholder')}
                    value={customGoalTitle}
                    onChange={e => setCustomGoalTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#737373] block mb-1.5">{t('discover.modal.milestones')}</label>
                  <textarea
                    className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2.5 text-xs text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors min-h-[120px] resize-none"
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
    </main>
  )
}

// ── Progress Ring Component ──
function ProgressRing({ value, label, color, subtitle }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="bg-[#141414] rounded-xl p-4 flex flex-col items-center">
      <div className="relative w-16 h-16 mb-2">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="#1a1a1a" strokeWidth="3" />
          <circle
            cx="32" cy="32" r={radius} fill="none"
            stroke={color} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold font-mono" style={{ color }}>{value}%</span>
        </div>
      </div>
      <p className="text-[10px] text-[#737373] font-medium">{label}</p>
      {subtitle && <p className="text-[9px] text-[#404040] font-mono">{subtitle}</p>}
    </div>
  )
}
