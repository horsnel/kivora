'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCurrency } from '@/components/CurrencyToggle'
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

  useEffect(() => { if (slug) load() }, [slug])

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

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center space-y-3">
        <IconSpinner size={28} className="text-red-500 mx-auto" />
        <p className="text-[#737373] text-sm">Loading opportunity...</p>
      </div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-[#737373] mb-4 text-sm">This opportunity wasn't found.</p>
        <button onClick={() => router.push('/')} className="text-red-500 hover:text-red-400 text-sm flex items-center gap-1 mx-auto">
          <IconArrowLeft size={13} /> Back to home
        </button>
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[#737373] hover:text-white text-sm mb-8 transition-colors group">
          <IconArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>

        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(data.tags || []).map(tag => (
              <span key={tag} className="text-2xs bg-[#141414] border border-[#262626] px-2.5 py-1 rounded-full text-[#737373] font-mono">
                #{tag}
              </span>
            ))}
          </div>

          <h1 className="text-3xl md:text-[36px] font-bold mb-2.5 leading-tight tracking-tight">{data.title}</h1>
          <p className="text-[#737373] text-[15px] mb-5 leading-relaxed">{data.tagline}</p>

          {/* Metrics */}
          <div className="flex flex-wrap gap-2.5 mb-5">
            <Metric icon={<IconMoney size={14} />} label="Income" value={`${format(data.income_min)}–${format(data.income_max)}/${data.income_period}`} color="green" />
            <Metric icon={<IconLightning size={14} />} label="Time to start" value={`${data.start_days} days`} />
            <Metric icon={<IconTool size={14} />} label="Monthly cost" value={`${format(data.monthly_cost)}/mo`} />
          </div>

          {/* Works in */}
          {(data.works_in || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {data.works_in.map(place => (
                <span key={place} className="flex items-center gap-1 text-2xs bg-[#0d1a10] border border-green-900/30 text-green-500 px-2.5 py-1 rounded-full">
                  <IconCheck size={10} /> {place}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStarted(true)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all press ${
                started ? 'bg-green-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {started ? <><IconCheck size={14} /> Starting this</> : <>Start This <IconArrowLeft size={14} className="rotate-180" /></>}
            </button>
            <button
              onClick={() => setSaved(!saved)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] rounded-xl text-sm text-[#737373] hover:text-white transition-all press"
            >
              {saved ? <IconBookmarkFill size={14} className="text-red-500" /> : <IconBookmark size={14} />}
              {saved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={share}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] rounded-xl text-sm text-[#737373] hover:text-white transition-all press"
            >
              <IconShare size={14} />
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>

          {startCount > 0 && (
            <p className="text-xs text-[#404040] mt-3 flex items-center gap-1.5">
              <IconGlobe size={11} />
              {startCount} people started this opportunity this week
            </p>
          )}
        </div>

        <div className="space-y-8">
          {/* 1 Overview */}
          <Section num="01" title="The Opportunity">
            <div className="prose-dark">
              {(data.overview || '').split('\n\n').map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </Section>

          {/* 2 Cost */}
          <Section num="02" title="What It Actually Costs">
            <div className="bg-[#141414] border border-[#262626] rounded-xl overflow-hidden">
              {(data.cost_breakdown || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3.5 border-b border-[#1a1a1a] last:border-0">
                  <div>
                    <div className="text-sm font-medium">{item.tool}</div>
                    <div className="text-xs text-[#737373] mt-0.5">{item.note}</div>
                  </div>
                  <div className="text-green-400 text-sm font-mono shrink-0 ml-4">
                    {item.cost === 0 ? 'Free' : `${format(item.cost)}/mo`}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#1a1a1a]">
                <span className="text-sm font-semibold">Total monthly</span>
                <span className="text-green-400 font-mono font-bold">{format(data.monthly_cost)}/mo</span>
              </div>
            </div>
            <p className="text-xs text-[#404040] mt-2 flex items-center gap-1">
              <IconCard size={11} /> Prices shown in {currency.code} · Most tools accept international cards
            </p>
          </Section>

          {/* 3 Failure */}
          <Section num="03" title="Why Most People Fail At This">
            <div className="space-y-2">
              {(data.failure_reasons || []).map((reason, i) => (
                <div key={i} className="flex gap-3 bg-[#141414] border border-[#262626] rounded-xl px-5 py-3.5">
                  <IconWarning size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <span className="text-[#d4d4d4] text-sm leading-relaxed">{reason}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* 4 Stack */}
          <Section num="04" title="Works Anywhere Stack">
            <div className="space-y-2">
              {(data.tool_stack || []).map((tool, i) => (
                <div key={i} className="bg-[#141414] border border-[#262626] rounded-xl px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{tool.name}</span>
                        {tool.url && (
                          <a href={tool.url} target="_blank" rel="noopener noreferrer" className="text-[#404040] hover:text-[#737373] transition-colors" onClick={e => e.stopPropagation()}>
                            <IconExternal size={11} />
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-[#737373] mt-0.5">{tool.use}</div>
                    </div>
                    <span className="text-green-400 text-xs font-mono shrink-0">{tool.cost}</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className={`flex items-center gap-1 ${tool.works_without_vpn ? 'text-green-500' : 'text-yellow-500'}`}>
                      <IconVpn size={11} />
                      {tool.works_without_vpn ? 'No VPN needed' : 'May need VPN'}
                    </span>
                    <span className={`flex items-center gap-1 ${tool.accepts_local_payment ? 'text-green-500' : 'text-[#737373]'}`}>
                      <IconCard size={11} />
                      {tool.accepts_local_payment ? 'Local payment OK' : 'USD card needed'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 5 Action Plan */}
          <Section num="05" title="Your Action Plan">
            <div className="space-y-2">
              {(data.action_plan || []).map((step, i) => (
                <div key={i} className="flex gap-4 bg-[#141414] border border-[#262626] rounded-xl px-5 py-3.5">
                  <span className="text-red-500 text-xs font-mono whitespace-nowrap pt-0.5 min-w-[58px] font-semibold">{step.period}</span>
                  <span className="text-[#d4d4d4] text-sm leading-relaxed">{step.task}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="mt-12 border-t border-[#141414] pt-8 text-center">
          <button onClick={() => router.push('/')} className="flex items-center gap-1.5 text-sm text-[#737373] hover:text-white transition-colors mx-auto">
            <IconArrowLeft size={13} /> Back to explore
          </button>
        </div>
      </div>
    </main>
  )
}

function Metric({ icon, label, value, color = 'default' }) {
  return (
    <div className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-3">
      <div className="text-xs text-[#737373] mb-0.5">{label}</div>
      <div className={`flex items-center gap-1.5 font-semibold text-sm ${color === 'green' ? 'text-green-400' : 'text-white'}`}>
        {icon} {value}
      </div>
    </div>
  )
}

function Section({ num, title, children }) {
  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xs font-mono text-red-500 font-semibold">{num}</span>
        <div className="h-px flex-1 bg-[#1a1a1a]" />
        <h2 className="font-semibold text-sm tracking-tight">{title}</h2>
        <div className="h-px flex-1 bg-[#1a1a1a]" />
      </div>
      {children}
    </div>
  )
}
