'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/components/CurrencyToggle'
import { IconMoney, IconLightning, IconTool, IconSearch, IconFilter, IconEye, IconArrowRight, IconSpinner, IconPlus } from '@/components/Icons'

const CATEGORIES = ['All','Automation','Content','YouTube','E-Commerce','Affiliate','Freelance','SaaS','Finance','Education','Africa','Developer']

export default function OpportunitiesPage() {
  const router = useRouter()
  const { format } = useCurrency()
  const [opps, setOpps] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('All')
  const [search, setSearch] = useState('')
  const [genQuery, setGenQuery] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => { load() }, [])
  useEffect(() => { filter() }, [opps, cat, search])

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

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8 animate-fade-up">
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Opportunity <span className="text-red-500">Engine</span></h1>
          <p className="text-[#737373] text-sm">Browse {opps.length} cached guides or generate a new one.</p>
        </div>

        {/* Generate new */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-5 mb-7">
          <p className="text-xs text-[#737373] font-medium mb-3 flex items-center gap-1.5"><IconPlus size={12} /> Generate a new opportunity guide</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#404040] pointer-events-none" />
              <input
                className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"
                placeholder="e.g. Build a legal document business with Claude..."
                value={genQuery}
                onChange={e => setGenQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generate()}
              />
            </div>
            <button onClick={generate} disabled={generating || !genQuery.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 press whitespace-nowrap">
              {generating ? <IconSpinner size={13} /> : <IconArrowRight size={13} />}
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <IconSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#404040] pointer-events-none" />
            <input
              className="w-full bg-[#141414] border border-[#262626] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"
              placeholder="Search opportunities..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                cat === c ? 'bg-red-600 border-red-600 text-white' : 'bg-[#141414] border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a]'
              }`}>
              {c === 'All' && <IconFilter size={10} />}
              {c}
            </button>
          ))}
        </div>

        {!loading && <p className="text-xs text-[#404040] mb-4 font-mono">{filtered.length} results{cat !== 'All' ? ` in ${cat}` : ''}</p>}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton bg-[#141414] border border-[#262626] rounded-2xl h-32" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(opp => (
              <button key={opp.slug} onClick={() => router.push(`/explore/${opp.slug}`)}
                className="bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] rounded-2xl p-5 text-left transition-all group hover:bg-[#161616]">
                <h3 className="font-semibold text-sm mb-3 group-hover:text-red-400 transition-colors line-clamp-2 leading-snug tracking-tight">
                  {opp.result?.title || opp.query}
                </h3>
                {opp.result && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-green-400 text-sm font-semibold">
                      <IconMoney size={13} />
                      {format(opp.result.income_min || 0)}–{format(opp.result.income_max || 0)}
                      <span className="text-[#404040] text-xs font-normal">/{opp.result.income_period || 'mo'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#404040]">
                      <span className="flex items-center gap-1"><IconLightning size={10} />{opp.result.start_days}d</span>
                      <span className="flex items-center gap-1"><IconTool size={10} />{format(opp.result.monthly_cost || 0)}/mo</span>
                      <span className="flex items-center gap-1"><IconEye size={10} />{(opp.views || 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1 mt-3">
                  {(opp.result?.tags || []).slice(0, 2).map(tag => (
                    <span key={tag} className="text-2xs text-[#404040] bg-[#0a0a0a] px-2 py-0.5 rounded-full font-mono">#{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-10 h-10 bg-[#141414] border border-[#262626] rounded-xl flex items-center justify-center mx-auto mb-3">
              <IconSearch size={18} className="text-[#2e2e2e]" />
            </div>
            <h3 className="font-semibold mb-1.5 tracking-tight">No results found</h3>
            <p className="text-[#737373] text-sm mb-4">{search ? `No matches for "${search}"` : 'No opportunities in this category yet'}</p>
            <button onClick={() => { setSearch(''); setCat('All') }} className="text-red-500 hover:text-red-400 text-sm">Clear filters</button>
          </div>
        )}
      </div>
    </main>
  )
}
