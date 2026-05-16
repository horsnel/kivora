'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

// Required for CloudFlare Pages edge runtime
export const runtime = 'edge'
import { useCurrency } from '@/components/CurrencyToggle'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { supabasePublic } from '@/lib/supabase'
import {
  IconMoney, IconLightning, IconTool, IconArrowLeft, IconCheck,
  IconShare, IconBookmark, IconBookmarkFill, IconVpn, IconCard,
  IconWarning, IconExternal, IconGlobe, IconSpinner
} from '@/components/Icons'

export default function ExplorePage() {
  const { slug } = useParams()
  const router = useRouter()
  const { format, currency } = useCurrency()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [started, setStarted] = useState(false)
  const [saved, setSaved] = useState(false)
  const [startCount, setStartCount] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (slug) load() }, [slug])

  useEffect(() => {
    if (!slug || !supabasePublic) return
    supabasePublic.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      try {
        const res = await fetch(`/api/save?slug=${slug}&user_id=${user.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.saved) setSaved(true)
        }
      } catch {}
    })
  }, [slug])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/explore_cache?slug=eq.${slug}&select=*&limit=1`,
        { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` } }
      )
      const rows = await res.json()
      if (rows?.[0]) {
        setData(rows[0].result)
        setStartCount(Math.floor((rows[0].views || 1) * 0.09))
      }
    } catch (_) {}
    setLoading(false)
  }

  function share() {
    if (navigator.share) navigator.share({ title: data?.title, url: window.location.href })
    else { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  async function toggleSave() {
    if (!supabasePublic) return
    const { data: { user } } = await supabasePublic.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setSaving(true)
    try {
      if (saved) {
        await fetch('/api/save', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, resultSlug: slug }),
        })
        setSaved(false)
      } else {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, query: data?.title || slug, resultSlug: slug }),
        })
        if (res.ok) setSaved(true)
      }
    } catch {}
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="skeleton w-16 h-4 rounded mb-6" />
        <div className="animate-fade-up">
          <div className="flex gap-1.5 mb-3">
            <div className="skeleton w-16 h-5 rounded-full" />
            <div className="skeleton w-20 h-5 rounded-full" />
            <div className="skeleton w-14 h-5 rounded-full" />
          </div>
          <div className="skeleton w-3/4 h-8 rounded mb-3" />
          <div className="skeleton w-1/2 h-4 rounded mb-5" />
          <div className="flex gap-2 mb-5">
            <div className="skeleton w-32 h-14 rounded-xl" />
            <div className="skeleton w-28 h-14 rounded-xl" />
            <div className="skeleton w-24 h-14 rounded-xl" />
          </div>
        </div>
        <div className="space-y-8 mt-8">
          {['01','02','03'].map(n => (
            <div key={n}>
              <div className="flex items-center gap-3 mb-4">
                <div className="skeleton w-6 h-3 rounded" />
                <div className="h-px flex-1 bg-[#1a1a1a]" />
                <div className="skeleton w-32 h-3 rounded" />
                <div className="h-px flex-1 bg-[#1a1a1a]" />
              </div>
              <div className="space-y-2">
                <div className="skeleton border border-[#262626] rounded-xl h-16 w-full" />
                <div className="skeleton border border-[#262626] rounded-xl h-16 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-muted mb-4 text-body">This opportunity wasn't found.</p>
        <button onClick={() => router.push('/')} className="text-red-500 hover:text-red-400 text-body flex items-center gap-1 mx-auto">
          <IconArrowLeft size={14} /> Back to home
        </button>
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6 sm:mb-8 animate-fade-up">
          <div className="flex flex-wrap gap-1.5 mb-2 sm:mb-3">
            {(data.tags || []).map(tag => (
              <span key={tag} className="text-caption bg-[#141414] border border-[#262626] px-2.5 py-1 rounded-full text-muted font-mono">
                #{tag}
              </span>
            ))}
          </div>

          <h1 className="text-display sm:text-display-lg md:text-[34px] font-semibold mb-2 sm:mb-2.5 leading-tight tracking-tight text-[#E5E7EB]">{data.title}</h1>
          <p className="text-muted text-body sm:text-body mb-4 sm:mb-5 leading-relaxed">{data.tagline}</p>

          {/* Metrics */}
          <div className="flex flex-wrap gap-2 sm:gap-2.5 mb-4 sm:mb-5">
            <Metric icon={<IconMoney size={14} />} label="Income" value={`${format(data.income_min)}–${format(data.income_max)}/${data.income_period}`} />
            <Metric icon={<IconLightning size={14} />} label="Time to start" value={`${data.start_days} days`} />
            <Metric icon={<IconTool size={14} />} label="Monthly cost" value={`${format(data.monthly_cost)}/mo`} />
          </div>

          {/* Works in */}
          {(data.works_in || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4 sm:mb-6">
              {data.works_in.map(place => (
                <span key={place} className="flex items-center gap-1 text-caption bg-[#0d1520] border border-slate-700/30 text-slate-400 px-2.5 py-1 rounded-full">
                  <IconCheck size={12} /> {place}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap w-full">
            <button
              onClick={() => setStarted(true)}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-body font-semibold transition-all press ${
                started ? 'bg-slate-500 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {started ? <><IconCheck size={14} /> Starting this</> : <>Start This <IconArrowLeft size={14} className="rotate-180" /></>}
            </button>
            <button
              onClick={toggleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] rounded-xl text-body text-muted hover:text-white transition-all press disabled:opacity-50"
            >
              {saving ? <IconSpinner size={14} /> : saved ? <IconBookmarkFill size={14} className="text-red-500" /> : <IconBookmark size={14} />}
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={share}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] rounded-xl text-body text-muted hover:text-white transition-all press"
            >
              <IconShare size={14} />
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>

          {startCount > 0 && (
            <p className="text-caption text-muted2 mt-3 flex items-center gap-1.5">
              <IconGlobe size={12} />
              {startCount} people started this opportunity this week
            </p>
          )}
        </div>

        <div className="space-y-6 sm:space-y-8">
          <Section num="01" title="The Opportunity">
            <MarkdownRenderer content={data.overview || ''} />
          </Section>

          <Section num="02" title="What It Actually Costs">
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl overflow-hidden">
              {(data.cost_breakdown || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/[0.04] last:border-0">
                  <div className="min-w-0 mr-3">
                    <div className="text-body font-medium truncate text-[#D1D5DB]">{item.tool}</div>
                    <div className="text-caption text-muted mt-0.5 truncate">{item.note}</div>
                  </div>
                  <div className="text-slate-400 text-body font-mono shrink-0">
                    {item.cost === 0 ? 'Free' : `${format(item.cost)}/mo`}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 bg-[#1a1a1a]">
                <span className="text-body font-semibold text-[#D1D5DB]">Total monthly</span>
                <span className="text-slate-400 font-mono font-bold">{format(data.monthly_cost)}/mo</span>
              </div>
            </div>
            <p className="text-caption text-muted2 mt-2 flex items-center gap-1">
              <IconCard size={12} /> Prices shown in {currency.code} · Most tools accept international cards
            </p>
          </Section>

          <Section num="03" title="Why Most People Fail At This">
            <div className="space-y-2">
              {(data.failure_reasons || []).map((reason, i) => (
                <div key={i} className="flex gap-3 bg-[#141414] border border-white/[0.06] rounded-xl px-4 sm:px-5 py-3.5 sm:py-4">
                  <IconWarning size={14} className="text-amber-500/70 shrink-0 mt-0.5" />
                  <span className="text-[#A1A1AA] text-body leading-relaxed">{reason}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section num="04" title="Works Anywhere Stack">
            <div className="space-y-2">
              {(data.tool_stack || []).map((tool, i) => (
                <div key={i} className="bg-[#141414] border border-white/[0.06] rounded-xl px-4 sm:px-5 py-3.5 sm:py-4">
                  <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-body text-[#D1D5DB]">{tool.name}</span>
                        {tool.url && (
                          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="text-muted2 hover:text-muted transition-colors" onClick={e => e.stopPropagation()}>
                            <IconExternal size={12} />
                          </a>
                        )}
                      </div>
                      <div className="text-caption text-muted mt-0.5">{tool.use}</div>
                    </div>
                    <span className="text-slate-400 text-caption font-mono shrink-0">{tool.cost}</span>
                  </div>
                  <div className="flex gap-3 text-caption">
                    <span className={`flex items-center gap-1 ${tool.works_without_vpn ? 'text-slate-400' : 'text-amber-500/70'}`}>
                      <IconVpn size={12} />
                      {tool.works_without_vpn ? 'No VPN needed' : 'May need VPN'}
                    </span>
                    <span className={`flex items-center gap-1 ${tool.accepts_local_payment ? 'text-slate-400' : 'text-muted'}`}>
                      <IconCard size={12} />
                      {tool.accepts_local_payment ? 'Local payment OK' : 'USD card needed'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section num="05" title="Your Action Plan">
            <div className="space-y-2">
              {(data.action_plan || []).map((step, i) => (
                <div key={i} className="timeline-step flex gap-3 sm:gap-4 bg-[#141414] border border-white/[0.06] rounded-xl px-4 sm:px-5 py-3.5 sm:py-4">
                  <span className="text-slate-500 text-caption font-mono whitespace-nowrap pt-0.5 min-w-[52px] sm:min-w-[58px] font-semibold">{step.period}</span>
                  <span className="text-[#A1A1AA] text-body leading-relaxed">{step.task}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="mt-8 sm:mt-12 border-t border-[#141414] pt-6 sm:pt-8 text-center">
          <button onClick={() => router.push('/')} className="flex items-center gap-1.5 text-body text-muted hover:text-white transition-colors mx-auto">
            <IconArrowLeft size={14} /> Back to explore
          </button>
        </div>
      </div>
    </main>
  )
}

function Metric({ icon, label, value }) {
  return (
    <div className="bg-[#141414] border border-white/[0.06] rounded-xl px-4 py-3">
      <div className="text-caption text-muted mb-0.5">{label}</div>
      <div className="flex items-center gap-1.5 font-medium text-body-sm text-[#D1D5DB]">
        {icon} {value}
      </div>
    </div>
  )
}

function Section({ num, title, children }) {
  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <span className="text-caption font-mono text-[#525252] font-semibold">{num}</span>
        <div className="h-px flex-1 bg-[#1a1a1a]" />
        <h2 className="font-semibold text-caption sm:text-body tracking-tight whitespace-nowrap">{title}</h2>
        <div className="h-px flex-1 bg-[#1a1a1a]" />
      </div>
      {children}
    </div>
  )
}
