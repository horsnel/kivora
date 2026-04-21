'use client'
import { useState } from 'react'
import { IconCode, IconSearch, IconDatabase, IconBook, IconPulse, IconCopy, IconCheck, IconSpinner } from '@/components/Icons'

function IconBraces({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M5 2H4a1 1 0 00-1 1v3L2 7l1 1v3a1 1 0 001 1h1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 2h1a1 1 0 011 1v3l1 1-1 1v3a1 1 0 01-1 1h-1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconApi({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 5h12M2 8h8M2 11h5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="13" cy="11" r="2" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M15 13l1.5 1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

const TOOLS = [
  { id: 'code_explainer', label: 'Code Explainer', Icon: IconCode,     desc: 'Understand any code instantly' },
  { id: 'regex',          label: 'Regex Generator',Icon: IconSearch,   desc: 'Describe it, get the pattern' },
  { id: 'json_formatter', label: 'JSON Formatter', Icon: IconBraces,   desc: 'Format, validate & analyze' },
  { id: 'readme',         label: 'README Generator',Icon: IconBook,    desc: 'Professional docs in seconds' },
  { id: 'sql_builder',    label: 'SQL Builder',    Icon: IconDatabase,  desc: 'Plain English to SQL query' },
  { id: 'api_analyzer',   label: 'API Analyzer',   Icon: IconApi,       desc: 'Debug & improve API requests' },
]

const LANGUAGES   = ['JavaScript','TypeScript','Python','Go','Rust','Java','C++','PHP','Ruby','Swift','Kotlin','SQL']
const SQL_DIALECTS = ['PostgreSQL','MySQL','SQLite','MSSQL','Oracle','BigQuery']
const HTTP_METHODS = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']

export default function DevToolsPage() {
  const [active, setActive] = useState('code_explainer')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({
    code:'', language:'JavaScript', description:'', regexLang:'JavaScript',
    json:'', info:'', sqlDesc:'', dialect:'PostgreSQL',
    endpoint:'', method:'GET', headers:'', body:'',
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function run() {
    setLoading(true); setResult('')
    try {
      const payloads = {
        code_explainer: { code: form.code, language: form.language },
        regex:          { description: form.description, language: form.regexLang },
        json_formatter: { json: form.json },
        readme:         { info: form.info },
        sql_builder:    { description: form.sqlDesc, dialect: form.dialect },
        api_analyzer:   { endpoint: form.endpoint, method: form.method, headers: form.headers, body: form.body },
      }
      const res = await fetch('/api/devtools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: active, payload: payloads[active] })
      })
      const data = await res.json()
      setResult(data.result || data.error || 'Something went wrong.')
    } catch { setResult('Network error. Please try again.') }
    setLoading(false)
  }

  function copy() { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const meta = TOOLS.find(t => t.id === active)

  const inputClass = "w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"
  const monoClass  = `${inputClass} font-mono`
  const textareaClass = `${inputClass} resize-none leading-relaxed`

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8 animate-fade-up">
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Dev <span className="text-red-500">Tools</span></h1>
          <p className="text-[#737373] text-sm">Six AI-powered tools for developers. Free. No account needed.</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
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
              {active === 'code_explainer' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">Language</label>
                  <select className={inputClass} value={form.language} onChange={e => set('language', e.target.value)}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">Code</label>
                  <textarea className={`${monoClass.replace('px-4','px-4')} h-48 resize-none`} placeholder="Paste your code here..." value={form.code} onChange={e => set('code', e.target.value)} /></div>
              </>}

              {active === 'regex' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">Describe what to match</label>
                  <textarea className={`${textareaClass} h-24`} placeholder="e.g. Nigerian phone numbers starting with 080, 081, 090..." value={form.description} onChange={e => set('description', e.target.value)} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">Language</label>
                  <select className={inputClass} value={form.regexLang} onChange={e => set('regexLang', e.target.value)}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select></div>
              </>}

              {active === 'json_formatter' && (
                <div><label className="text-xs text-[#737373] block mb-1.5">Paste JSON</label>
                  <textarea className={`${textareaClass} h-52 font-mono`} placeholder='{"key": "value"}' value={form.json} onChange={e => set('json', e.target.value)} /></div>
              )}

              {active === 'readme' && (
                <div><label className="text-xs text-[#737373] block mb-1.5">Describe your project</label>
                  <textarea className={`${textareaClass} h-48`} placeholder="Project name, what it does, tech stack, key features, how to install..." value={form.info} onChange={e => set('info', e.target.value)} /></div>
              )}

              {active === 'sql_builder' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">Describe the query</label>
                  <textarea className={`${textareaClass} h-24`} placeholder="e.g. Get all users who signed up in the last 30 days, ordered by most recent, with their total order count" value={form.sqlDesc} onChange={e => set('sqlDesc', e.target.value)} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">SQL Dialect</label>
                  <select className={inputClass} value={form.dialect} onChange={e => set('dialect', e.target.value)}>
                    {SQL_DIALECTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select></div>
              </>}

              {active === 'api_analyzer' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">Endpoint URL</label>
                  <input className={monoClass} placeholder="https://api.example.com/v1/users" value={form.endpoint} onChange={e => set('endpoint', e.target.value)} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">Method</label>
                  <select className={inputClass} value={form.method} onChange={e => set('method', e.target.value)}>
                    {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">Headers (JSON)</label>
                  <textarea className={`${textareaClass} h-14 font-mono`} placeholder='{"Authorization": "Bearer token"}' value={form.headers} onChange={e => set('headers', e.target.value)} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">Body (JSON)</label>
                  <textarea className={`${textareaClass} h-14 font-mono`} placeholder='{"email": "user@example.com"}' value={form.body} onChange={e => set('body', e.target.value)} /></div>
              </>}
            </div>

            <button onClick={run} disabled={loading}
              className="mt-5 w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press">
              {loading ? <><IconSpinner size={14} /> Running...</> : 'Run Tool →'}
            </button>
          </div>

          {/* Output */}
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="font-semibold text-sm">Output</h2>
              {result && (
                <button onClick={copy} className="flex items-center gap-1 text-xs text-[#737373] hover:text-white transition-colors">
                  {copied ? <><IconCheck size={11} className="text-green-500" /> Copied</> : <><IconCopy size={11} /> Copy</>}
                </button>
              )}
            </div>
            {result
              ? <pre className="text-[13px] text-[#d4d4d4] whitespace-pre-wrap leading-relaxed flex-1 overflow-auto font-mono">{result}</pre>
              : <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-3">
                      <meta.Icon size={18} className="text-[#2e2e2e]" />
                    </div>
                    <p className="text-[#404040] text-sm">{loading ? 'Running tool...' : 'Output appears here'}</p>
                  </div>
                </div>
            }
          </div>
        </div>

        <p className="text-center text-xs text-[#2e2e2e] mt-6">All tools are free · Powered by Groq · 10 requests/minute limit</p>
      </div>
    </main>
  )
}
