'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/components/CurrencyToggle'
import { useTranslation } from '@/components/LanguageProvider'
import { IconMoney, IconLightning, IconTool, IconSearch, IconFilter, IconEye, IconArrowRight, IconSpinner, IconPlus, IconCheck, IconClose, IconTrending } from '@/components/Icons'

const CATEGORY_KEYS = ['all','automation','content','youtube','ecommerce','affiliate','freelance','saas','finance','education','africa','developer']

// Inline icon: Calculator
function IconCalc({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="1.5" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <rect x="4" y="3.5" width="8" height="3" rx="0.75" stroke="currentColor" strokeWidth="1"/>
      <circle cx="5" cy="9.5" r=".75" fill="currentColor"/>
      <circle cx="8" cy="9.5" r=".75" fill="currentColor"/>
      <circle cx="11" cy="9.5" r=".75" fill="currentColor"/>
      <circle cx="5" cy="12" r=".75" fill="currentColor"/>
      <circle cx="8" cy="12" r=".75" fill="currentColor"/>
      <circle cx="11" cy="12" r=".75" fill="currentColor"/>
    </svg>
  )
}

// Inline icon: Checklist
function IconChecklist({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M4 5h2M4 8h2M4 11h2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M5 4.5l.5.5L7 3.5M5 7.5l.5.5L7 6.5M5 10.5l.5.5L7 9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.5 5H12M8.5 8H12M8.5 11H12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

// Inline icon: Compare / Columns
function IconCompare({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="2" width="5.5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <rect x="9" y="2" width="5.5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M4 5.5v1M4 9v1M12 5.5v1M12 9v1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

// Inline icon: Add step
function IconAddStep({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export default function OpportunitiesPage() {
  const router = useRouter()
  const { format, currency, convert } = useCurrency()
  const { t } = useTranslation()
  const [opps, setOpps] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('All')
  const [search, setSearch] = useState('')
  const [genQuery, setGenQuery] = useState('')
  const [generating, setGenerating] = useState(false)

  // ── Feature 1: Income Calculator ──
  const [calcMin, setCalcMin] = useState(0)
  const [calcMax, setCalcMax] = useState(5000)
  const [calcPeriod, setCalcPeriod] = useState('monthly')

  // ── Feature 2: Checklist ──
  const [checklistSlug, setChecklistSlug] = useState(null)
  const [checkedSteps, setCheckedSteps] = useState({})
  const [customSteps, setCustomSteps] = useState({})
  const [newStepText, setNewStepText] = useState('')

  // ── Feature 3: Comparison ──
  const [compareSlugs, setCompareSlugs] = useState([])
  const [showCompare, setShowCompare] = useState(false)

  useEffect(() => { load() }, [])
  useEffect(() => { filter() }, [opps, cat, search])

  // Load checklist state from localStorage
  useEffect(() => {
    try {
      const savedChecked = localStorage.getItem('kv_checklist_checked')
      if (savedChecked) setCheckedSteps(JSON.parse(savedChecked))
      const savedCustom = localStorage.getItem('kv_checklist_custom')
      if (savedCustom) setCustomSteps(JSON.parse(savedCustom))
    } catch (_) {}
  }, [])

  // Persist checklist state to localStorage
  const persistChecked = useCallback((updated) => {
    setCheckedSteps(updated)
    try { localStorage.setItem('kv_checklist_checked', JSON.stringify(updated)) } catch (_) {}
  }, [])

  const persistCustom = useCallback((updated) => {
    setCustomSteps(updated)
    try { localStorage.setItem('kv_checklist_custom', JSON.stringify(updated)) } catch (_) {}
  }, [])

  async function load() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/explore_cache?select=slug,query,result,views,category,created_at&order=views.desc&limit=100`,
        { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` } }
      )
      const data = await res.json()
      if (Array.isArray(data)) setOpps(data)
    } catch (_) {}
    setLoading(false)
  }

  function filter() {
    let list = [...opps]
    if (cat !== 'All') list = list.filter(o =>
      o.category?.toLowerCase().includes(cat.toLowerCase()) ||
      (o.result?.tags || []).some(t => t.toLowerCase().includes(cat.toLowerCase()))
    )
    if (search) list = list.filter(o =>
      o.query?.toLowerCase().includes(search.toLowerCase()) ||
      o.result?.title?.toLowerCase().includes(search.toLowerCase())
    )
    setFiltered(list)
  }

  async function generate() {
    if (!genQuery.trim() || generating) return
    setGenerating(true)
    try {
      const res = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: genQuery.trim() })
      })
      const data = await res.json()
      if (data.slug) router.push(`/explore/${data.slug}`)
    } catch (_) {}
    setGenerating(false)
  }

  // ── Income Calculator helpers ──
  const periodMultipliers = { daily: 30, weekly: 4.3, monthly: 1 }
  const multiplier = periodMultipliers[calcPeriod] || 1
  const projections = {
    '1 month': { min: Math.round(calcMin * multiplier), max: Math.round(calcMax * multiplier) },
    '6 months': { min: Math.round(calcMin * multiplier * 6), max: Math.round(calcMax * multiplier * 6) },
    '12 months': { min: Math.round(calcMin * multiplier * 12), max: Math.round(calcMax * multiplier * 12) },
  }
  const maxProjection = projections['12 months'].max || 1

  // Compact format for projection cards — abbreviates large numbers
  function formatCompact(usd) {
    const val = convert(usd)
    if (val >= 1_000_000_000) return `${currency.symbol}${(val / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
    if (val >= 1_000_000) return `${currency.symbol}${(val / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    if (val >= 100_000) return `${currency.symbol}${(val / 1_000).toFixed(0)}K`
    if (val >= 10_000) return `${currency.symbol}${(val / 1_000).toFixed(1).replace(/\.0$/, '')}K`
    return `${currency.symbol}${val.toLocaleString()}`
  }

  function fillCalcFromOpp(opp) {
    if (opp.result) {
      setCalcMin(opp.result.income_min || 0)
      setCalcMax(opp.result.income_max || 5000)
      const p = (opp.result.income_period || 'month').toLowerCase()
      if (p.includes('day')) setCalcPeriod('daily')
      else if (p.includes('week')) setCalcPeriod('weekly')
      else setCalcPeriod('monthly')
    }
  }

  // ── Checklist helpers ──
  const checklistOpp = checklistSlug ? opps.find(o => o.slug === checklistSlug) : null
  const actionPlanSteps = checklistOpp?.result?.action_plan
    ? (Array.isArray(checklistOpp.result.action_plan)
        ? checklistOpp.result.action_plan.map((s, i) =>
            typeof s === 'string' ? { period: `Step ${i + 1}`, task: s } : { period: s.period || `Step ${i + 1}`, task: s.task || '' }
          )
        : [])
    : []
  const allSteps = [...actionPlanSteps, ...(customSteps[checklistSlug] || []).map((t, i) => ({ period: 'Custom', task: t }))]
  const checkedForSlug = checkedSteps[checklistSlug] || []
  const completedCount = checkedForSlug.length
  const totalSteps = allSteps.length

  function toggleStep(idx) {
    const current = checkedSteps[checklistSlug] || []
    const updated = current.includes(idx) ? current.filter(i => i !== idx) : [...current, idx]
    persistChecked({ ...checkedSteps, [checklistSlug]: updated })
  }

  function addCustomStep() {
    if (!newStepText.trim() || !checklistSlug) return
    const current = customSteps[checklistSlug] || []
    persistCustom({ ...customSteps, [checklistSlug]: [...current, newStepText.trim()] })
    setNewStepText('')
  }

  // ── Comparison helpers ──
  const compareOpps = compareSlugs.map(s => opps.find(o => o.slug === s)).filter(Boolean)

  function toggleCompare(slug) {
    setCompareSlugs(prev =>
      prev.includes(slug)
        ? prev.filter(s => s !== slug)
        : prev.length < 3 ? [...prev, slug] : prev
    )
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-10">
        <div className="mb-6 animate-fade-up">
          <h1 className="text-display font-semibold mb-2 tracking-tight">{t('opportunities.title').slice(0, parseInt(t('opportunities.split')))}<span className="text-red-500">{t('opportunities.title').slice(parseInt(t('opportunities.split')))}</span></h1>
          <p className="text-muted text-body-sm mt-0.5">{t('opportunities.browse', { count: opps.length })}</p>
        </div>

        {/* Generate new */}
        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 mb-10">
          <p className="text-caption text-muted font-medium mb-3 flex items-center gap-1.5"><IconPlus size={12} /> {t('opportunities.generate_new')}</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2 pointer-events-none" />
              <input
                className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl pl-9 pr-4 py-3 text-body text-white placeholder-muted2 focus:border-red-500 focus:outline-none transition-colors"
                placeholder="e.g. Build a legal document business with Claude..."
                value={genQuery}
                onChange={e => setGenQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generate()}
              />
            </div>
            <button onClick={generate} disabled={generating || !genQuery.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-5 py-3 rounded-xl text-body font-semibold transition-colors flex items-center gap-2 press whitespace-nowrap">
              {generating ? <IconSpinner size={14} /> : <IconArrowRight size={14} />}
              {generating ? t('opportunities.generating') : t('opportunities.generate')}
            </button>
          </div>
        </div>

        {/* ── Feature 1: Income Calculator ── */}
        <div className="bg-[#141414] rounded-xl p-7 sm:p-8 mb-10">
          <p className="text-caption text-muted font-medium mb-4 flex items-center gap-1.5"><IconCalc size={12} /> {t('opportunities.income_calc')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            {/* Min slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-caption text-muted2">{t('opportunities.min_income')}</span>
                <span className="text-caption text-muted2 font-mono">{formatCompact(calcMin)}</span>
              </div>
              <input type="range" min={0} max={10000000} step={100} value={calcMin}
                onChange={e => setCalcMin(Number(e.target.value))}
                className="w-full h-1.5 bg-[#262626] rounded-full appearance-none cursor-pointer accent-red-500
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-red-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer" />
            </div>
            {/* Max slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-caption text-muted2">{t('opportunities.max_income')}</span>
                <span className="text-caption text-muted2 font-mono">{formatCompact(calcMax)}</span>
              </div>
              <input type="range" min={0} max={10000000} step={100} value={calcMax}
                onChange={e => setCalcMax(Number(e.target.value))}
                className="w-full h-1.5 bg-[#262626] rounded-full appearance-none cursor-pointer accent-red-500
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-red-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer" />
            </div>
          </div>

          {/* Period selector */}
          <div className="flex gap-2 mb-6">
            {['daily', 'weekly', 'monthly'].map(p => (
              <button key={p} onClick={() => setCalcPeriod(p)}
                className={`px-3 py-1.5 rounded-full text-caption font-medium border transition-all ${
                  calcPeriod === p ? 'bg-red-600 border-red-600 text-white' : 'bg-[#0a0a0a] border-[#262626] text-muted hover:text-white hover:border-[#3a3a3a]'
                }`}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Projection cards + bar chart */}
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(projections).map(([label, { min, max }]) => {
              const barHeight = maxProjection > 0 ? Math.max(8, (Math.log10(max + 1) / Math.log10(maxProjection + 1)) * 100) : 8
              const barMinHeight = maxProjection > 0 ? Math.max(8, (Math.log10(min + 1) / Math.log10(maxProjection + 1)) * 100) : 8
              return (
                <div key={label} className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-4 text-center overflow-hidden">
                  <p className="text-caption text-muted2 mb-2">{label}</p>
                  <div className="flex items-end justify-center gap-1.5 h-20 mb-3">
                    <div className="flex flex-col items-center gap-0.5 w-8">
                      <div className="w-full bg-[#262626] rounded-sm relative" style={{ height: `${barHeight}%` }}>
                        <div className="absolute bottom-0 left-0 right-0 bg-red-500/30 rounded-sm" style={{ height: `${barMinHeight}%` }} />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 w-8">
                      <div className="w-full bg-red-500/70 rounded-sm relative" style={{ height: `${barMinHeight}%` }} />
                    </div>
                  </div>
                  <p className="text-xs sm:text-body text-muted2 font-semibold whitespace-nowrap">{formatCompact(min)}</p>
                  <p className="text-caption text-muted2 whitespace-nowrap">to {formatCompact(max)}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <IconSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted2 pointer-events-none" />
            <input
              className="w-full bg-[#141414] border border-[#262626] rounded-xl pl-9 pr-4 py-3 text-body text-white placeholder-muted2 focus:border-red-500 focus:outline-none transition-colors"
              placeholder={t('opportunities.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {CATEGORY_KEYS.map(c => {
            const label = c === 'all' ? t('opportunities.cat.all') : t(`opportunities.cat.${c}`)
            const catValue = c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)
            return (
            <button key={c} onClick={() => setCat(catValue)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-caption font-medium border transition-all ${
                cat === catValue ? 'bg-red-600 border-red-600 text-white' : 'bg-[#141414] border-[#262626] text-muted hover:text-white hover:border-[#3a3a3a]'
              }`}>
              {c === 'all' && <IconFilter size={12} />}
              {label}
            </button>
            )
          })}
        </div>

        {!loading && <p className="text-caption text-muted2 mb-4 font-mono">{filtered.length} {cat !== 'All' ? t('opportunities.results_in', { cat }) : t('opportunities.results')}</p>}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton bg-[#141414] rounded-xl h-32" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(opp => {
              const isComparing = compareSlugs.includes(opp.slug)
              return (
                <div key={opp.slug}
                  className={`bg-[#141414] border border-white/[0.06] rounded-xl p-5 sm:p-6 text-left transition-all group hover:-translate-y-0.5 hover:bg-[#161616] relative ${
                    isComparing ? '!border-red-500/50' : ''
                  }`}>
                  {/* Card main area - clickable */}
                  <button onClick={() => router.push(`/explore/${opp.slug}`)} className="w-full text-left">
                    <h3 className="font-semibold text-sm mb-2 group-hover:text-red-400 transition-colors line-clamp-2 leading-snug tracking-tight text-muted">
                      {opp.result?.title || opp.query}
                    </h3>
                    {opp.result && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[#d4d4d4] text-body font-medium">
                          <IconMoney size={14} />
                          {format(opp.result.income_min || 0)}–{format(opp.result.income_max || 0)}
                          <span className="text-muted2 text-caption font-normal">/{opp.result.income_period || 'mo'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-caption text-muted2">
                          <span className="flex items-center gap-1"><IconLightning size={12} />{opp.result.start_days}d</span>
                          <span className="flex items-center gap-1"><IconTool size={12} />{format(opp.result.monthly_cost || 0)}/mo</span>
                          <span className="flex items-center gap-1"><IconEye size={12} />{(opp.views || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </button>

                  <div className="flex flex-wrap gap-1 mt-3">
                    {(opp.result?.tags || []).slice(0, 2).map(tag => (
                      <span key={tag} className="text-caption text-muted2 bg-[#0a0a0a] px-2 py-0.5 rounded-full font-mono">#{tag}</span>
                    ))}
                  </div>

                  {/* Action buttons row */}
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/[0.04]">
                    {/* Fill calculator */}
                    <button onClick={(e) => { e.stopPropagation(); fillCalcFromOpp(opp) }}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-caption text-muted2 hover:text-white hover:bg-[#0a0a0a] transition-colors"
                      title="Use in income calculator">
                      <IconCalc size={12} />
                      <span>{t('opportunities.calc')}</span>
                    </button>

                    {/* Open checklist */}
                    <button onClick={(e) => { e.stopPropagation(); setChecklistSlug(opp.slug) }}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-caption text-muted2 hover:text-white hover:bg-[#0a0a0a] transition-colors"
                      title="Action plan checklist">
                      <IconChecklist size={12} />
                      <span>{t('opportunities.plan')}</span>
                    </button>

                    {/* Compare toggle */}
                    <button onClick={(e) => { e.stopPropagation(); toggleCompare(opp.slug) }}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-caption transition-colors ${
                        isComparing ? 'text-red-400 bg-red-500/10' : 'text-muted2 hover:text-white hover:bg-[#0a0a0a]'
                      }`}
                      title={isComparing ? 'Remove from comparison' : 'Add to comparison'}>
                      <IconCompare size={12} />
                      <span>{isComparing ? t('opportunities.added') : t('opportunities.compare_short')}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-10 h-10 bg-[#141414] rounded-xl flex items-center justify-center mx-auto mb-3">
              <IconSearch size={20} className="text-[#2e2e2e]" />
            </div>
            <h3 className="font-semibold text-sm mb-1.5 tracking-tight text-muted">{t('opportunities.no_results')}</h3>
            <p className="text-muted text-body mb-4">{search ? t('opportunities.no_matches', { search }) : t('opportunities.no_cat_results')}</p>
            <button onClick={() => { setSearch(''); setCat('All') }} className="text-red-500 hover:text-red-400 text-body">{t('opportunities.clear_filters')}</button>
          </div>
        )}
      </div>

      {/* ── Feature 2: Checklist Modal ── */}
      {checklistSlug && checklistOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setChecklistSlug(null)}>
          <div className="bg-[#141414] border border-[#262626] rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div>
                <h3 className="font-semibold text-sm tracking-tight line-clamp-1 text-muted">{checklistOpp.result?.title || checklistOpp.query}</h3>
                <p className="text-caption text-muted2 mt-0.5">{t('opportunities.action_plan')}</p>
              </div>
              <button onClick={() => setChecklistSlug(null)} className="text-muted2 hover:text-white transition-colors p-1">
                <IconClose size={16} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="px-5 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-caption text-muted2">{completedCount}/{totalSteps} {t('opportunities.steps_completed')}</span>
                <span className="text-caption text-white font-mono">{totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#262626] rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all duration-300"
                  style={{ width: `${totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0}%` }} />
              </div>
            </div>

            {/* Steps list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2 min-h-0">
              {allSteps.map((step, idx) => {
                const isChecked = checkedForSlug.includes(idx)
                return (
                  <button key={idx} onClick={() => toggleStep(idx)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                      isChecked ? 'bg-red-500/5 border border-red-500/10' : 'bg-[#0a0a0a] border border-[#262626] hover:border-[#3a3a3a]'
                    }`}>
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isChecked ? 'bg-red-600 border-red-600' : 'border-[#3a3a3a]'
                    }`}>
                      {isChecked && <IconCheck size={10} className="text-white" />}
                    </div>
                    <div className="min-w-0">
                      <span className="text-caption text-muted2 font-mono block">{step.period}</span>
                      <span className={`text-body ${isChecked ? 'text-muted line-through' : 'text-white'}`}>{step.task}</span>
                    </div>
                  </button>
                )
              })}

              {allSteps.length === 0 && (
                <p className="text-center text-muted text-body py-8">{t('opportunities.no_steps')}</p>
              )}
            </div>

            {/* Add custom step */}
            <div className="p-5 border-t border-white/[0.06]">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2 text-body text-white placeholder-muted2 focus:border-red-500 focus:outline-none transition-colors"
                  placeholder={t('opportunities.add_step')}
                  value={newStepText}
                  onChange={e => setNewStepText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomStep()}
                />
                <button onClick={addCustomStep} disabled={!newStepText.trim()}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                  <IconPlus size={12} />
                  <span className="text-caption font-semibold">{t('opportunities.add')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Feature 3: Compare floating button ── */}
      {compareSlugs.length >= 2 && !showCompare && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-scale-in">
          <button onClick={() => setShowCompare(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl text-body font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20 press">
            <IconCompare size={14} />
            {t('opportunities.compare')} ({compareSlugs.length})
          </button>
        </div>
      )}

      {/* ── Feature 3: Comparison Modal ── */}
      {showCompare && compareOpps.length >= 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCompare(false)}>
          <div className="bg-[#141414] border border-[#262626] rounded-xl w-full max-w-4xl max-h-[85vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06] sticky top-0 bg-[#141414] z-10">
              <div className="flex items-center gap-2">
                <IconCompare size={16} className="text-red-500" />
                <h3 className="font-semibold text-sm tracking-tight text-muted">{t('opportunities.compare_title')}</h3>
              </div>
              <button onClick={() => setShowCompare(false)} className="text-muted2 hover:text-white transition-colors p-1">
                <IconClose size={16} />
              </button>
            </div>

            {/* Comparison table */}
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 pr-4 text-caption text-muted2 font-medium w-32">{t('opportunities.attribute')}</th>
                    {compareOpps.map(opp => (
                      <th key={opp.slug} className="pb-3 px-4 text-body text-white font-semibold min-w-[200px]">
                        <div className="line-clamp-2">{opp.result?.title || opp.query}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Income Range */}
                  <tr className="border-b border-white/[0.04]">
                    <td className="py-3 pr-4 text-caption text-muted2 font-medium flex items-center gap-1.5"><IconMoney size={12} /> {t('opportunities.income')}</td>
                    {compareOpps.map(opp => (
                      <td key={opp.slug} className="py-3 px-4 text-body text-white">
                        {format(opp.result?.income_min || 0)} – {format(opp.result?.income_max || 0)}
                        <span className="text-muted2 text-caption">/{opp.result?.income_period || 'mo'}</span>
                      </td>
                    ))}
                  </tr>
                  {/* Monthly Cost */}
                  <tr className="border-b border-white/[0.04]">
                    <td className="py-3 pr-4 text-caption text-muted2 font-medium flex items-center gap-1.5"><IconTool size={12} /> {t('opportunities.monthly_cost')}</td>
                    {compareOpps.map(opp => (
                      <td key={opp.slug} className="py-3 px-4 text-body text-white">
                        {format(opp.result?.monthly_cost || 0)}<span className="text-muted2 text-caption">/mo</span>
                      </td>
                    ))}
                  </tr>
                  {/* Startup Time */}
                  <tr className="border-b border-white/[0.04]">
                    <td className="py-3 pr-4 text-caption text-muted2 font-medium flex items-center gap-1.5"><IconLightning size={12} /> {t('opportunities.start_time')}</td>
                    {compareOpps.map(opp => (
                      <td key={opp.slug} className="py-3 px-4 text-body text-white">
                        {opp.result?.start_days || '?'} {t('opportunities.days')}
                      </td>
                    ))}
                  </tr>
                  {/* Tags */}
                  <tr>
                    <td className="py-3 pr-4 text-caption text-muted2 font-medium flex items-center gap-1.5"><IconTrending size={12} /> {t('opportunities.tags')}</td>
                    {compareOpps.map(opp => (
                      <td key={opp.slug} className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(opp.result?.tags || []).map(tag => (
                            <span key={tag} className="text-caption text-muted2 bg-[#0a0a0a] px-2 py-0.5 rounded-full font-mono">#{tag}</span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-white/[0.06] flex items-center justify-between">
              <button onClick={() => { setCompareSlugs([]); setShowCompare(false) }}
                className="text-caption text-muted2 hover:text-white transition-colors">
                {t('opportunities.clear_all')}
              </button>
              <button onClick={() => setShowCompare(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-caption font-semibold transition-colors">
                {t('opportunities.done')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
