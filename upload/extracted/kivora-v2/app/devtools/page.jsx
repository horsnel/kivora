'use client'
import { useState } from 'react'
import {
  IconCode, IconSearch, IconDatabase, IconBook, IconCopy, IconCheck,
  IconSpinner, IconMoney, IconGlobe, IconLightning, IconTool, IconChat
} from '@/components/Icons'

// ── Inline SVG icons for tools not in the main library ────────────────
function Ico({ path, size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d={path} stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const I = {
  Braces:    (p) => <Ico size={p.size} className={p.className} path="M5 2H4a1 1 0 00-1 1v3L2 7l1 1v3a1 1 0 001 1h1M11 2h1a1 1 0 011 1v3l1 1-1 1v3a1 1 0 01-1 1h-1" />,
  Api:       (p) => <Ico size={p.size} className={p.className} path="M2 5h12M2 8h8M2 11h5M13 9a2 2 0 110 4 2 2 0 010-4zM15 13l1.5 1.5" />,
  Color:     (p) => <Ico size={p.size} className={p.className} path="M8 2a6 6 0 100 12A6 6 0 008 2zM8 2v12M2 8h12" />,
  Hash:      (p) => <Ico size={p.size} className={p.className} path="M5 2L3 14M13 2l-2 12M1 6h14M1 10h14" />,
  Diff:      (p) => <Ico size={p.size} className={p.className} path="M2 4h12M2 8h6M2 12h9M11 7l3 3-3 3" />,
  Zap:       (p) => <Ico size={p.size} className={p.className} path="M9 2L4 9h4l-1 5 5-7H8l1-5z" />,
  FileText:  (p) => <Ico size={p.size} className={p.className} path="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2zM9 2v4h4M5 8h6M5 11h4" />,
  Translate: (p) => <Ico size={p.size} className={p.className} path="M2 4h7M5 2v2M3 8c0 1.5 1 3 2.5 3M5 8c0 1.5.7 2.7 1.5 3M9 14l1.5-4 1.5 4M10 12.5h2M14 4l-4 6M14 4l-2 2" />,
  Shield:    (p) => <Ico size={p.size} className={p.className} path="M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4l5-2z" />,
  Terminal:  (p) => <Ico size={p.size} className={p.className} path="M3 4l4 4-4 4M9 12h4" />,
  Palette:   (p) => <Ico size={p.size} className={p.className} path="M8 2a6 6 0 00-1 12c.6 0 1-.4 1-1v-.5c0-.3.2-.5.5-.5H10a2 2 0 000-4c-.4 0-.7-.2-.8-.5A6 6 0 008 2z" />,
  Compress:  (p) => <Ico size={p.size} className={p.className} path="M5 9H2v5h5v-3M9 2h5v5h-3M5 5L2 2M14 14l-3-3" />,
  Clock:     (p) => <Ico size={p.size} className={p.className} path="M8 2a6 6 0 100 12A6 6 0 008 2zM8 5v3l2 2" />,
  Mail:      (p) => <Ico size={p.size} className={p.className} path="M2 4h12v8H2zM2 4l6 5 6-5" />,
}

// ── Tool definitions by category ─────────────────────────────────────
const CATEGORIES = [
  {
    id: 'code',
    label: 'Code',
    color: '#3b82f6',
    tools: [
      { id: 'code_explainer', label: 'Code Explainer',    Icon: (p) => <IconCode {...p} />,      desc: 'Understand any code block instantly' },
      { id: 'code_reviewer',  label: 'Code Reviewer',     Icon: (p) => <I.Shield {...p} />,      desc: 'Spot bugs, security issues, and improvements' },
      { id: 'regex',          label: 'Regex Generator',   Icon: (p) => <IconSearch {...p} />,    desc: 'Describe it in English, get the pattern' },
      { id: 'sql_builder',    label: 'SQL Builder',       Icon: (p) => <IconDatabase {...p} />,  desc: 'Plain English to SQL query' },
      { id: 'terminal',       label: 'Terminal Helper',   Icon: (p) => <I.Terminal {...p} />,    desc: 'Explain or generate shell commands' },
      { id: 'git_helper',     label: 'Git Helper',        Icon: (p) => <I.Hash {...p} />,        desc: 'Explain git commands and workflows' },
    ]
  },
  {
    id: 'data',
    label: 'Data',
    color: '#a855f7',
    tools: [
      { id: 'json_formatter', label: 'JSON Formatter',    Icon: (p) => <I.Braces {...p} />,      desc: 'Format, validate and analyse JSON' },
      { id: 'csv_analyser',   label: 'CSV Analyser',      Icon: (p) => <I.Diff {...p} />,        desc: 'Analyse CSV data and suggest insights' },
      { id: 'data_to_schema', label: 'Schema Generator',  Icon: (p) => <IconDatabase {...p} />,  desc: 'Generate database schema from description' },
      { id: 'api_analyzer',   label: 'API Analyzer',      Icon: (p) => <I.Api {...p} />,         desc: 'Debug and improve API requests' },
      { id: 'env_checker',    label: 'Env File Auditor',  Icon: (p) => <I.Shield {...p} />,      desc: 'Audit .env files for security issues' },
    ]
  },
  {
    id: 'content',
    label: 'Content & Docs',
    color: '#16a34a',
    tools: [
      { id: 'readme',         label: 'README Generator',  Icon: (p) => <IconBook {...p} />,      desc: 'Professional docs from a description' },
      { id: 'email_writer',   label: 'Email Writer',      Icon: (p) => <I.Mail {...p} />,        desc: 'Write professional emails fast' },
      { id: 'text_improver',  label: 'Text Improver',     Icon: (p) => <I.FileText {...p} />,    desc: 'Rewrite any text for clarity and tone' },
      { id: 'translator',     label: 'Translator',        Icon: (p) => <I.Translate {...p} />,   desc: 'Translate text to any language' },
      { id: 'summariser',     label: 'Summariser',        Icon: (p) => <I.Compress {...p} />,    desc: 'Summarise long text into key points' },
    ]
  },
  {
    id: 'business',
    label: 'Business',
    color: '#f59e0b',
    tools: [
      { id: 'pitch_writer',   label: 'Pitch Writer',      Icon: (p) => <I.Zap {...p} />,         desc: 'Write investor or client pitches' },
      { id: 'job_desc',       label: 'Job Description',   Icon: (p) => <I.FileText {...p} />,    desc: 'Write job posts that attract great hires' },
      { id: 'sop_writer',     label: 'SOP Writer',        Icon: (p) => <I.Clock {...p} />,       desc: 'Create standard operating procedures' },
      { id: 'cold_email',     label: 'Cold Email',        Icon: (p) => <I.Mail {...p} />,        desc: 'Write cold outreach that gets replies' },
    ]
  },
]

const ALL_TOOLS = CATEGORIES.flatMap(c => c.tools.map(t => ({ ...t, category: c.id })))

const LANGUAGES    = ['JavaScript','TypeScript','Python','Go','Rust','Java','C++','PHP','Ruby','Swift','Kotlin','SQL','Bash']
const SQL_DIALECTS = ['PostgreSQL','MySQL','SQLite','MSSQL','Oracle','BigQuery']
const HTTP_METHODS = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']
const TONES        = ['Professional','Casual','Friendly','Direct','Persuasive','Apologetic','Urgent']
const LANGUAGES_HUMAN = ['English','French','Yoruba','Igbo','Hausa','Swahili','Zulu','Arabic','Spanish','German','Portuguese','Chinese','Japanese','Hindi']

export default function DevToolsPage() {
  const [activeCat, setActiveCat]   = useState('code')
  const [active, setActive]         = useState('code_explainer')
  const [result, setResult]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [copied, setCopied]         = useState(false)
  const [form, setForm] = useState({
    // code tools
    code: '', language: 'JavaScript',
    reviewCode: '', reviewLang: 'JavaScript',
    description: '', regexLang: 'JavaScript',
    sqlDesc: '', dialect: 'PostgreSQL',
    terminalCmd: '', terminalContext: 'Linux/Mac',
    gitCmd: '',
    // data tools
    json: '',
    csvData: '', csvGoal: '',
    schemaDesc: '',
    endpoint: '', method: 'GET', headers: '', body: '',
    envContent: '',
    // content tools
    info: '',
    emailContext: '', emailTone: 'Professional', emailRecipient: '',
    textInput: '', textGoal: 'Improve clarity',
    translateText: '', targetLang: 'French',
    summariseText: '', summariseStyle: 'Bullet points',
    // business tools
    pitchProduct: '', pitchAudience: '', pitchAsk: '',
    jobTitle: '', jobResponsibilities: '', jobRequirements: '',
    sopProcess: '', sopRole: '',
    coldTarget: '', coldProduct: '', coldObservation: '',
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const currentCat = CATEGORIES.find(c => c.id === activeCat)
  const currentTool = ALL_TOOLS.find(t => t.id === active)

  async function run() {
    setLoading(true); setResult('')
    try {
      const res = await fetch('/api/devtools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: active, payload: form })
      })
      const data = await res.json()
      setResult(data.result || data.error || 'Something went wrong.')
    } catch { setResult('Network error. Please try again.') }
    setLoading(false)
  }

  function copy() {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function selectTool(toolId, catId) {
    setActive(toolId)
    setActiveCat(catId)
    setResult('')
  }

  const inp   = "w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"
  const mono  = `${inp} font-mono`
  const ta    = `${inp} resize-none leading-relaxed`
  const tamono= `${inp} resize-none leading-relaxed font-mono`

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <h1 className="text-3xl font-bold mb-1.5 tracking-tight">
            Dev <span className="text-red-500">Tools</span>
          </h1>
          <p className="text-[#737373] text-sm">
            20 AI-powered tools for developers, writers, and builders. Free. No account needed.
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setActiveCat(cat.id); setActive(cat.tools[0].id); setResult('') }}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                activeCat === cat.id
                  ? 'text-[#0a0a0a] border-transparent'
                  : 'bg-[#141414] border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a]'
              }`}
              style={activeCat === cat.id ? { background: cat.color, borderColor: cat.color } : {}}
            >
              {cat.label}
              <span className="ml-1.5 text-xs opacity-70 font-normal">{cat.tools.length}</span>
            </button>
          ))}
        </div>

        {/* Tool pills within active category */}
        <div className="flex flex-wrap gap-2 mb-6">
          {currentCat.tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => selectTool(tool.id, activeCat)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active === tool.id
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-[#141414] border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a]'
              }`}
            >
              <tool.Icon size={12} /> {tool.label}
            </button>
          ))}
        </div>

        {/* Split panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Input Panel ─────────────────────────────────── */}
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center border border-[#262626]">
                <currentTool.Icon size={15} className="text-[#737373]" />
              </div>
              <div>
                <h2 className="font-semibold text-sm tracking-tight">{currentTool.label}</h2>
                <p className="text-xs text-[#737373]">{currentTool.desc}</p>
              </div>
            </div>

            <div className="space-y-3">

              {/* ─── CODE TOOLS ─────────────────── */}

              {active === 'code_explainer' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Language</label>
                  <select className={inp} value={form.language} onChange={e => set('language', e.target.value)}>
                    {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Paste your code</label>
                  <textarea className={`${tamono} h-52`} placeholder="Paste any code here..." value={form.code} onChange={e => set('code', e.target.value)} />
                </div>
              </>}

              {active === 'code_reviewer' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Language</label>
                  <select className={inp} value={form.reviewLang} onChange={e => set('reviewLang', e.target.value)}>
                    {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Code to review</label>
                  <textarea className={`${tamono} h-52`} placeholder="Paste the code you want reviewed..." value={form.reviewCode} onChange={e => set('reviewCode', e.target.value)} />
                </div>
              </>}

              {active === 'regex' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">What should the pattern match?</label>
                  <textarea className={`${ta} h-24`} placeholder="e.g. Nigerian phone numbers starting with 070, 080, 081, 090..." value={form.description} onChange={e => set('description', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Language</label>
                  <select className={inp} value={form.regexLang} onChange={e => set('regexLang', e.target.value)}>
                    {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </>}

              {active === 'sql_builder' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Describe the query</label>
                  <textarea className={`${ta} h-24`} placeholder="e.g. Get all users who signed up in the last 30 days with their total order count, sorted by most recent" value={form.sqlDesc} onChange={e => set('sqlDesc', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">SQL Dialect</label>
                  <select className={inp} value={form.dialect} onChange={e => set('dialect', e.target.value)}>
                    {SQL_DIALECTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </>}

              {active === 'terminal' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Context</label>
                  <select className={inp} value={form.terminalContext} onChange={e => set('terminalContext', e.target.value)}>
                    {['Linux/Mac','Windows','Docker','AWS CLI','Git Bash'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Command or task</label>
                  <textarea className={`${tamono} h-28`} placeholder="e.g. find all .env files in this folder and subfolders but not in node_modules" value={form.terminalCmd} onChange={e => set('terminalCmd', e.target.value)} />
                </div>
              </>}

              {active === 'git_helper' && (
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Git question or task</label>
                  <textarea className={`${ta} h-36`} placeholder="e.g. How do I squash my last 4 commits into one? / What does this error mean: fatal: refusing to merge unrelated histories" value={form.gitCmd} onChange={e => set('gitCmd', e.target.value)} />
                </div>
              )}

              {/* ─── DATA TOOLS ─────────────────── */}

              {active === 'json_formatter' && (
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Paste JSON</label>
                  <textarea className={`${tamono} h-56`} placeholder={'{"key": "value"}'} value={form.json} onChange={e => set('json', e.target.value)} />
                </div>
              )}

              {active === 'csv_analyser' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Paste CSV data (first 20 rows is enough)</label>
                  <textarea className={`${tamono} h-40`} placeholder={"name,email,plan,created_at\nAlex,alex@example.com,pro,2026-01-01"} value={form.csvData} onChange={e => set('csvData', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">What do you want to know? (optional)</label>
                  <input className={inp} placeholder="e.g. Which plan has the most users? Any patterns in the data?" value={form.csvGoal} onChange={e => set('csvGoal', e.target.value)} />
                </div>
              </>}

              {active === 'data_to_schema' && (
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Describe your data model</label>
                  <textarea className={`${ta} h-44`} placeholder={"e.g. An e-commerce platform with products, customers, orders, and order items. Customers can have multiple addresses. Products have categories and images."} value={form.schemaDesc} onChange={e => set('schemaDesc', e.target.value)} />
                </div>
              )}

              {active === 'api_analyzer' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Endpoint URL</label>
                  <input className={mono} placeholder="https://api.example.com/v1/users" value={form.endpoint} onChange={e => set('endpoint', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Method</label>
                  <select className={inp} value={form.method} onChange={e => set('method', e.target.value)}>
                    {HTTP_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Headers (JSON)</label>
                  <textarea className={`${tamono} h-14`} placeholder='{"Authorization": "Bearer token"}' value={form.headers} onChange={e => set('headers', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Body (JSON)</label>
                  <textarea className={`${tamono} h-14`} placeholder='{"email": "user@example.com"}' value={form.body} onChange={e => set('body', e.target.value)} />
                </div>
              </>}

              {active === 'env_checker' && (
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Paste your .env file (sensitive values will not be stored)</label>
                  <textarea className={`${tamono} h-52`} placeholder={"DATABASE_URL=...\nJWT_SECRET=...\nNEXT_PUBLIC_API_URL=..."} value={form.envContent} onChange={e => set('envContent', e.target.value)} />
                </div>
              )}

              {/* ─── CONTENT TOOLS ─────────────────── */}

              {active === 'readme' && (
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Describe your project</label>
                  <textarea className={`${ta} h-52`} placeholder={"Project name, what it does, tech stack, key features, how to install and use it..."} value={form.info} onChange={e => set('info', e.target.value)} />
                </div>
              )}

              {active === 'email_writer' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Recipient (role or name)</label>
                  <input className={inp} placeholder="e.g. CEO of a logistics company / potential client" value={form.emailRecipient} onChange={e => set('emailRecipient', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Tone</label>
                  <select className={inp} value={form.emailTone} onChange={e => set('emailTone', e.target.value)}>
                    {TONES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">What does the email need to say?</label>
                  <textarea className={`${ta} h-32`} placeholder="Bullet points or a rough description. e.g. Following up on the proposal I sent Tuesday. Asking if they have questions. Suggesting a call this week." value={form.emailContext} onChange={e => set('emailContext', e.target.value)} />
                </div>
              </>}

              {active === 'text_improver' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Goal</label>
                  <select className={inp} value={form.textGoal} onChange={e => set('textGoal', e.target.value)}>
                    {['Improve clarity','Make more professional','Make more concise','Fix grammar','Make more persuasive','Simplify for non-experts','Make more engaging'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Your text</label>
                  <textarea className={`${ta} h-44`} placeholder="Paste the text you want improved..." value={form.textInput} onChange={e => set('textInput', e.target.value)} />
                </div>
              </>}

              {active === 'translator' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Target language</label>
                  <select className={inp} value={form.targetLang} onChange={e => set('targetLang', e.target.value)}>
                    {LANGUAGES_HUMAN.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Text to translate</label>
                  <textarea className={`${ta} h-44`} placeholder="Paste the text to translate..." value={form.translateText} onChange={e => set('translateText', e.target.value)} />
                </div>
              </>}

              {active === 'summariser' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Summary style</label>
                  <select className={inp} value={form.summariseStyle} onChange={e => set('summariseStyle', e.target.value)}>
                    {['Bullet points','One paragraph','Executive summary','Tweet thread','ELI5 (simple)','Key quotes only'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Text to summarise</label>
                  <textarea className={`${ta} h-44`} placeholder="Paste an article, report, meeting notes, or any long text..." value={form.summariseText} onChange={e => set('summariseText', e.target.value)} />
                </div>
              </>}

              {/* ─── BUSINESS TOOLS ─────────────────── */}

              {active === 'pitch_writer' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Product or service</label>
                  <textarea className={`${ta} h-24`} placeholder="What you're pitching — the product, service, or idea. What it does, who it's for." value={form.pitchProduct} onChange={e => set('pitchProduct', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Audience</label>
                  <input className={inp} placeholder="e.g. Seed-stage investors / a potential enterprise client / a strategic partner" value={form.pitchAudience} onChange={e => set('pitchAudience', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">The ask</label>
                  <input className={inp} placeholder="e.g. $150,000 pre-seed / a 30-minute meeting / a pilot contract" value={form.pitchAsk} onChange={e => set('pitchAsk', e.target.value)} />
                </div>
              </>}

              {active === 'job_desc' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Job title</label>
                  <input className={inp} placeholder="e.g. Senior Backend Engineer / Content Manager / Operations Lead" value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Key responsibilities</label>
                  <textarea className={`${ta} h-24`} placeholder="3–5 bullet points of what this person will own..." value={form.jobResponsibilities} onChange={e => set('jobResponsibilities', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Requirements (must-have)</label>
                  <textarea className={`${ta} h-20`} placeholder="Skills, experience, and tools required..." value={form.jobRequirements} onChange={e => set('jobRequirements', e.target.value)} />
                </div>
              </>}

              {active === 'sop_writer' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Process to document</label>
                  <textarea className={`${ta} h-28`} placeholder="e.g. How to onboard a new client: from signed contract to first deliverable. Includes Slack setup, project creation in Notion, first call, questionnaire." value={form.sopProcess} onChange={e => set('sopProcess', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Who follows this SOP?</label>
                  <input className={inp} placeholder="e.g. Junior account manager / any new team member / the founder" value={form.sopRole} onChange={e => set('sopRole', e.target.value)} />
                </div>
              </>}

              {active === 'cold_email' && <>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">Who you're emailing (role + industry)</label>
                  <input className={inp} placeholder="e.g. Operations manager at a mid-sized Lagos logistics company" value={form.coldTarget} onChange={e => set('coldTarget', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">What you offer</label>
                  <input className={inp} placeholder="e.g. WhatsApp automation that handles customer queries automatically" value={form.coldProduct} onChange={e => set('coldProduct', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5">One specific observation about their business (optional but powerful)</label>
                  <textarea className={`${ta} h-20`} placeholder="e.g. I noticed on their Google listing that customers complained about slow WhatsApp response times..." value={form.coldObservation} onChange={e => set('coldObservation', e.target.value)} />
                </div>
              </>}

            </div>

            <button onClick={run} disabled={loading}
              className="mt-5 w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press">
              {loading ? <><IconSpinner size={14} /> Running...</> : `Run ${currentTool.label} →`}
            </button>
          </div>

          {/* ── Output Panel ─────────────────────────────────── */}
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 flex flex-col min-h-[560px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="font-semibold text-sm">Output</h2>
              {result && (
                <button onClick={copy} className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-white transition-colors">
                  {copied
                    ? <><IconCheck size={11} className="text-green-500" /> Copied</>
                    : <><IconCopy size={11} /> Copy</>}
                </button>
              )}
            </div>

            {result
              ? <pre className="text-[13px] text-[#d4d4d4] whitespace-pre-wrap leading-relaxed flex-1 overflow-auto font-mono">{result}</pre>
              : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-[#1a1a1a] border border-[#262626] rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <currentTool.Icon size={20} className="text-[#2e2e2e]" />
                    </div>
                    <p className="text-[#404040] text-sm">{loading ? 'Running...' : 'Output appears here'}</p>
                    <p className="text-[#2e2e2e] text-xs mt-1">Fill in the form and click Run</p>
                  </div>
                </div>
              )
            }
          </div>
        </div>

        {/* All tools quick reference */}
        <div className="mt-10 border-t border-[#141414] pt-10">
          <h2 className="font-bold text-base tracking-tight mb-6">All 20 tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CATEGORIES.map(cat => (
              <div key={cat.id} className="bg-[#141414] border border-[#262626] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-5 rounded-full" style={{ background: cat.color }} />
                  <h3 className="font-semibold text-sm">{cat.label}</h3>
                </div>
                <ul className="space-y-1.5">
                  {cat.tools.map(tool => (
                    <li key={tool.id}>
                      <button
                        onClick={() => selectTool(tool.id, cat.id)}
                        className={`w-full text-left text-xs flex items-center gap-2 py-1 px-2 rounded-lg transition-colors ${
                          active === tool.id
                            ? 'text-red-400 bg-red-950/20'
                            : 'text-[#737373] hover:text-white hover:bg-[#1a1a1a]'
                        }`}
                      >
                        <tool.Icon size={11} className="shrink-0" />
                        {tool.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-[#2e2e2e] mt-8">
          All tools free · Powered by Groq · 10 requests/minute limit
        </p>
      </div>
    </main>
  )
}
