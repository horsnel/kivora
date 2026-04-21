'use client'
import { useState } from 'react'
import { IconBook, IconWrite, IconMicroscope, IconCode, IconCopy, IconCheck, IconSpinner } from '@/components/Icons'

function IconCitation({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 2h8l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M11 2v4h3" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M5 7h6M5 9.5h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

const TOOLS = [
  { id: 'homework', label: 'Homework Helper',     Icon: IconBook,       desc: 'Step-by-step help on any subject' },
  { id: 'essay',    label: 'Essay Outliner',       Icon: IconWrite,      desc: 'Build structured outlines fast' },
  { id: 'research', label: 'Research Summarizer',  Icon: IconMicroscope, desc: 'Paste a paper, get the key points' },
  { id: 'citation', label: 'Citation Generator',   Icon: IconCitation,   desc: 'APA, MLA, Chicago, Harvard' },
  { id: 'coding',   label: 'Coding Practice',      Icon: IconCode,       desc: 'Practice problems with hints' },
]

const SUBJECTS = ['Mathematics','Physics','Chemistry','Biology','History','English','Economics','Computer Science','Statistics','Psychology','Philosophy','Geography']
const CITATION_STYLES = ['APA','MLA','Chicago','Harvard','IEEE','Vancouver']
const ESSAY_LEVELS = ['High School','Undergraduate','Postgraduate','PhD']
const LANGUAGES = ['JavaScript','Python','TypeScript','Java','C++','Go','Rust','SQL','PHP','Swift']
const CODE_LEVELS = ['Beginner','Intermediate','Advanced']

export default function StudyPage() {
  const [active, setActive] = useState('homework')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({ subject:'Mathematics', question:'', topic:'', level:'Undergraduate', text:'', source:'', style:'APA', language:'Python', codeLevel:'Intermediate' })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function run() {
    setLoading(true); setResult('')
    try {
      const payloads = {
        homework: { subject: form.subject, question: form.question },
        essay:    { topic: form.topic, level: form.level },
        research: { text: form.text },
        citation: { source: form.source, style: form.style },
        coding:   { language: form.language, level: form.codeLevel },
      }
      const res = await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: active, payload: payloads[active] })
      })
      const data = await res.json()
      setResult(data.result || data.error || 'Something went wrong.')
    } catch { setResult('Network error. Please try again.') }
    setLoading(false)
  }

  function copy() { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const meta = TOOLS.find(t => t.id === active)

  const inputClass = "w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"
  const textareaClass = `${inputClass} resize-none leading-relaxed`

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8 animate-fade-up">
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Study<span className="text-red-500">Desk</span></h1>
          <p className="text-[#737373] text-sm">AI-powered tools for students, researchers, and professors. Free, no account needed.</p>
        </div>

        {/* Tool tabs */}
        <div className="flex flex-wrap gap-2 mb-7">
          {TOOLS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => { setActive(id); setResult('') }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium border transition-all ${
                active === id ? 'bg-red-600 border-red-600 text-white' : 'bg-[#141414] border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a]'
              }`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Input */}
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <meta.Icon size={15} className="text-[#737373]" />
              <div>
                <h2 className="font-semibold text-sm">{meta.label}</h2>
                <p className="text-xs text-[#737373]">{meta.desc}</p>
              </div>
            </div>

            <div className="space-y-3">
              {active === 'homework' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">Subject</label>
                  <select className={inputClass} value={form.subject} onChange={e => set('subject', e.target.value)}>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">Your Question</label>
                  <textarea className={`${textareaClass} h-32`} placeholder="Paste your homework question here..." value={form.question} onChange={e => set('question', e.target.value)} /></div>
              </>}

              {active === 'essay' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">Essay Topic</label>
                  <input className={inputClass} placeholder="e.g. The impact of social media on democracy" value={form.topic} onChange={e => set('topic', e.target.value)} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">Academic Level</label>
                  <select className={inputClass} value={form.level} onChange={e => set('level', e.target.value)}>
                    {ESSAY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select></div>
              </>}

              {active === 'research' && (
                <div><label className="text-xs text-[#737373] block mb-1.5">Paper or Article Text</label>
                  <textarea className={`${textareaClass} h-48`} placeholder="Paste the full text of the research paper..." value={form.text} onChange={e => set('text', e.target.value)} /></div>
              )}

              {active === 'citation' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">Source Information</label>
                  <textarea className={`${textareaClass} h-24`} placeholder="Author, title, year, publisher, URL..." value={form.source} onChange={e => set('source', e.target.value)} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">Citation Style</label>
                  <select className={inputClass} value={form.style} onChange={e => set('style', e.target.value)}>
                    {CITATION_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
              </>}

              {active === 'coding' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">Language</label>
                  <select className={inputClass} value={form.language} onChange={e => set('language', e.target.value)}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">Difficulty</label>
                  <select className={inputClass} value={form.codeLevel} onChange={e => set('codeLevel', e.target.value)}>
                    {CODE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select></div>
              </>}
            </div>

            <button onClick={run} disabled={loading}
              className="mt-5 w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press">
              {loading ? <><IconSpinner size={14} /> Generating...</> : `Generate ${meta.label}`}
            </button>
          </div>

          {/* Output */}
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="font-semibold text-sm">Output</h2>
              {result && (
                <button onClick={copy} className="flex items-center gap-1 text-xs text-[#737373] hover:text-white transition-colors">
                  {copied ? <><IconCheck size={11} className="text-green-500" /> Copied</> : <><IconCopy size={11} /> Copy</>}
                </button>
              )}
            </div>
            {result
              ? <pre className="text-[13px] text-[#d4d4d4] whitespace-pre-wrap leading-relaxed flex-1 overflow-auto font-sans">{result}</pre>
              : <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-3">
                      <meta.Icon size={18} className="text-[#2e2e2e]" />
                    </div>
                    <p className="text-[#404040] text-sm">{loading ? 'Generating...' : 'Fill in the form and click Generate'}</p>
                  </div>
                </div>
            }
          </div>
        </div>
      </div>
    </main>
  )
}
