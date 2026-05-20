'use client'
import { useState, useEffect, useRef } from 'react'
import {
  IconCode, IconSearch, IconDatabase, IconBook, IconCopy, IconCheck,
  IconSpinner, IconMoney, IconGlobe, IconLightning, IconTool, IconChat
} from '@/components/Icons'
import Select from '@/components/Select'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { useSessionTracker } from '@/lib/useSessionTracker'
import { useTranslation } from '@/components/LanguageProvider'
import { stripMarkdown } from '@/lib/stripMarkdown'

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
  Hash:      (p) => <Ico size={p.size} className={p.className} path="M5 2L3 14M13 2l-2 12M1 6h14M1 10h14" />,
  Diff:      (p) => <Ico size={p.size} className={p.className} path="M2 4h12M2 8h6M2 12h9M11 7l3 3-3 3" />,
  Zap:       (p) => <Ico size={p.size} className={p.className} path="M9 2L4 9h4l-1 5 5-7H8l1-5z" />,
  FileText:  (p) => <Ico size={p.size} className={p.className} path="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2zM9 2v4h4M5 8h6M5 11h4" />,
  Translate: (p) => <Ico size={p.size} className={p.className} path="M2 4h7M5 2v2M3 8c0 1.5 1 3 2.5 3M5 8c0 1.5.7 2.7 1.5 3M9 14l1.5-4 1.5 4M10 12.5h2M14 4l-4 6M14 4l-2 2" />,
  Shield:    (p) => <Ico size={p.size} className={p.className} path="M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4l5-2z" />,
  Terminal:  (p) => <Ico size={p.size} className={p.className} path="M3 4l4 4-4 4M9 12h4" />,
  Compress:  (p) => <Ico size={p.size} className={p.className} path="M5 9H2v5h5v-3M9 2h5v5h-3M5 5L2 2M14 14l-3-3" />,
  Clock:     (p) => <Ico size={p.size} className={p.className} path="M8 2a6 6 0 100 12A6 6 0 008 2zM8 5v3l2 2" />,
  Mail:      (p) => <Ico size={p.size} className={p.className} path="M2 4h12v8H2zM2 4l6 5 6-5" />,
  Calc:     (p) => <Ico size={p.size} className={p.className} path="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1zM6 2v12M2 7h12M2 10h12M9 7v3M9 10v3" />,
}

// ── Tool definitions by category ─────────────────────────────────────
const CATEGORIES = [
  {
    id: 'code',
    labelKey: 'devtools.cat.code',
    color: '#3b82f6',
    tools: [
      { id: 'code_explainer', labelKey: 'devtools.code_explainer',    Icon: (p) => <IconCode {...p} />,      descKey: 'devtools.code_explainer.desc' },
      { id: 'code_reviewer',  labelKey: 'devtools.code_reviewer',     Icon: (p) => <I.Shield {...p} />,      descKey: 'devtools.code_reviewer.desc' },
      { id: 'regex',          labelKey: 'devtools.regex',             Icon: (p) => <IconSearch {...p} />,    descKey: 'devtools.regex.desc' },
      { id: 'sql_builder',    labelKey: 'devtools.sql_builder',       Icon: (p) => <IconDatabase {...p} />,  descKey: 'devtools.sql_builder.desc' },
      { id: 'terminal',       labelKey: 'devtools.terminal',          Icon: (p) => <I.Terminal {...p} />,    descKey: 'devtools.terminal.desc' },
      { id: 'git_helper',     labelKey: 'devtools.git_helper',        Icon: (p) => <I.Hash {...p} />,        descKey: 'devtools.git_helper.desc' },
      { id: 'regex_tester',   labelKey: 'devtools.regex_tester',      Icon: (p) => <IconSearch {...p} />,    descKey: 'devtools.regex_tester.desc' },
      { id: 'diff_checker',   labelKey: 'devtools.diff_checker',      Icon: (p) => <I.Diff {...p} />,        descKey: 'devtools.diff_checker.desc' },
    ]
  },
  {
    id: 'data',
    labelKey: 'devtools.cat.data',
    color: '#a855f7',
    tools: [
      { id: 'json_formatter', labelKey: 'devtools.json_formatter',    Icon: (p) => <I.Braces {...p} />,      descKey: 'devtools.json_formatter.desc' },
      { id: 'csv_analyser',   labelKey: 'devtools.csv_analyser',      Icon: (p) => <I.Diff {...p} />,        descKey: 'devtools.csv_analyser.desc' },
      { id: 'data_to_schema', labelKey: 'devtools.data_to_schema',    Icon: (p) => <IconDatabase {...p} />,  descKey: 'devtools.data_to_schema.desc' },
      { id: 'api_analyzer',   labelKey: 'devtools.api_analyzer',      Icon: (p) => <I.Api {...p} />,         descKey: 'devtools.api_analyzer.desc' },
      { id: 'env_checker',    labelKey: 'devtools.env_checker',       Icon: (p) => <I.Shield {...p} />,      descKey: 'devtools.env_checker.desc' },
      { id: 'jwt_decoder',    labelKey: 'devtools.jwt_decoder',       Icon: (p) => <I.Shield {...p} />,      descKey: 'devtools.jwt_decoder.desc' },
      { id: 'base64',         labelKey: 'devtools.base64',            Icon: (p) => <I.Braces {...p} />,      descKey: 'devtools.base64.desc' },
      { id: 'api_tester',     labelKey: 'devtools.api_tester',        Icon: (p) => <I.Api {...p} />,         descKey: 'devtools.api_tester.desc' },
    ]
  },
  {
    id: 'content',
    labelKey: 'devtools.cat.content',
    color: '#16a34a',
    tools: [
      { id: 'readme',         labelKey: 'devtools.readme',            Icon: (p) => <IconBook {...p} />,      descKey: 'devtools.readme.desc' },
      { id: 'email_writer',   labelKey: 'devtools.email_writer',      Icon: (p) => <I.Mail {...p} />,        descKey: 'devtools.email_writer.desc' },
      { id: 'text_improver',  labelKey: 'devtools.text_improver',     Icon: (p) => <I.FileText {...p} />,    descKey: 'devtools.text_improver.desc' },
      { id: 'translator',     labelKey: 'devtools.translator',        Icon: (p) => <I.Translate {...p} />,   descKey: 'devtools.translator.desc' },
      { id: 'summariser',     labelKey: 'devtools.summariser',        Icon: (p) => <I.Compress {...p} />,    descKey: 'devtools.summariser.desc' },
    ]
  },
  {
    id: 'business',
    labelKey: 'devtools.cat.business',
    color: '#f59e0b',
    tools: [
      { id: 'pitch_writer',   labelKey: 'devtools.pitch_writer',      Icon: (p) => <I.Zap {...p} />,         descKey: 'devtools.pitch_writer.desc' },
      { id: 'job_desc',       labelKey: 'devtools.job_desc',          Icon: (p) => <I.FileText {...p} />,    descKey: 'devtools.job_desc.desc' },
      { id: 'sop_writer',     labelKey: 'devtools.sop_writer',        Icon: (p) => <I.Clock {...p} />,       descKey: 'devtools.sop_writer.desc' },
      { id: 'cold_email',     labelKey: 'devtools.cold_email',        Icon: (p) => <I.Mail {...p} />,        descKey: 'devtools.cold_email.desc' },
    ]
  },
  {
    id: 'education',
    labelKey: 'devtools.cat.education',
    color: '#06b6d4',
    tools: [
      { id: 'math_solver',    labelKey: 'devtools.math_solver',       Icon: (p) => <I.Calc {...p} />,        descKey: 'devtools.math_solver.desc' },
    ]
  },
]

const ALL_TOOLS = CATEGORIES.flatMap(c => c.tools.map(tool => ({ ...tool, category: c.id })))

const LANGUAGES    = ['JavaScript','TypeScript','Python','Go','Rust','Java','C++','PHP','Ruby','Swift','Kotlin','SQL','Bash']
const SQL_DIALECTS = ['PostgreSQL','MySQL','SQLite','MSSQL','Oracle','BigQuery']
const HTTP_METHODS = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']
const TONES        = ['Professional','Casual','Friendly','Direct','Persuasive','Apologetic','Urgent']
const LANGUAGES_HUMAN = ['English','French','Yoruba','Igbo','Hausa','Swahili','Zulu','Arabic','Spanish','German','Portuguese','Chinese','Japanese','Hindi']

export default function DevToolsClient() {
  const [activeCat, setActiveCat]   = useState('code')
  const [active, setActive]         = useState('code_explainer')
  const [result, setResult]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [copied, setCopied]         = useState(false)
  const [diffResult, setDiffResult] = useState(null)
  const [apiTestResult, setApiTestResult] = useState(null)
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
    // new tools
    jwtToken: '',
    base64Input: '', base64Mode: 'encode',
    regexPattern: '', regexFlags: 'g', regexTestString: '',
    // diff checker
    diffOriginal: '', diffModified: '',
    // api tester
    apiTesterUrl: '', apiTesterMethod: 'GET', apiTesterHeaders: '', apiTesterBody: '',
    // math solver
    mathEquation: '', mathContext: '',
  })
  const [validationError, setValidationError] = useState('')
  const { startSession, endSession, markCopied } = useSessionTracker()
  const sessionRef = useRef(null)
  const { t } = useTranslation()

  // End session on unmount
  useEffect(() => {
    return () => { if (sessionRef.current) endSession(sessionRef.current) }
  }, [])

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    if (validationError) setValidationError('')
  }

  // Validation for all 26 tools
  function validate() {
    const checks = {
      code_explainer:  { field: form.code, validationKey: 'devtools.validation.code_explainer' },
      code_reviewer:   { field: form.reviewCode, validationKey: 'devtools.validation.code_reviewer' },
      regex:           { field: form.description, validationKey: 'devtools.validation.regex' },
      sql_builder:     { field: form.sqlDesc, validationKey: 'devtools.validation.sql_builder' },
      terminal:        { field: form.terminalCmd, validationKey: 'devtools.validation.terminal' },
      git_helper:      { field: form.gitCmd, validationKey: 'devtools.validation.git_helper' },
      regex_tester:    { field: form.regexPattern, validationKey: 'devtools.validation.regex_tester' },
      json_formatter:  { field: form.json, validationKey: 'devtools.validation.json_formatter' },
      csv_analyser:    { field: form.csvData, validationKey: 'devtools.validation.csv_analyser' },
      data_to_schema:  { field: form.schemaDesc, validationKey: 'devtools.validation.data_to_schema' },
      api_analyzer:    { field: form.endpoint, validationKey: 'devtools.validation.api_analyzer' },
      env_checker:     { field: form.envContent, validationKey: 'devtools.validation.env_checker' },
      jwt_decoder:     { field: form.jwtToken, validationKey: 'devtools.validation.jwt_decoder' },
      base64:          { field: form.base64Input, validationKey: 'devtools.validation.base64' },
      readme:          { field: form.info, validationKey: 'devtools.validation.readme' },
      email_writer:    { field: form.emailContext, validationKey: 'devtools.validation.email_writer' },
      text_improver:   { field: form.textInput, validationKey: 'devtools.validation.text_improver' },
      translator:      { field: form.translateText, validationKey: 'devtools.validation.translator' },
      summariser:      { field: form.summariseText, validationKey: 'devtools.validation.summariser' },
      pitch_writer:    { field: form.pitchProduct, validationKey: 'devtools.validation.pitch_writer' },
      job_desc:        { field: form.jobTitle, validationKey: 'devtools.validation.job_desc' },
      sop_writer:      { field: form.sopProcess, validationKey: 'devtools.validation.sop_writer' },
      cold_email:      { field: form.coldTarget, validationKey: 'devtools.validation.cold_email' },
      diff_checker:    { field: form.diffOriginal, validationKey: 'devtools.validation.diff_checker' },
      api_tester:      { field: form.apiTesterUrl, validationKey: 'devtools.validation.api_tester' },
      math_solver:     { field: form.mathEquation, validationKey: 'devtools.validation.math_solver' },
    }
    const check = checks[active]
    if (check && !check.field?.trim()) {
      setValidationError(t(check.validationKey))
      return false
    }
    setValidationError('')
    return true
  }

  // Derive session metadata from current tool + form
  function getSessionMeta() {
    const map = {
      code_explainer:  { summary: form.code, subject: form.language },
      code_reviewer:   { summary: form.reviewCode, subject: form.reviewLang },
      regex:           { summary: form.description, subject: form.regexLang },
      sql_builder:     { summary: form.sqlDesc, subject: form.dialect },
      terminal:        { summary: form.terminalCmd, subject: form.terminalContext },
      git_helper:      { summary: form.gitCmd, subject: null },
      regex_tester:    { summary: form.regexPattern, subject: form.regexFlags },
      json_formatter:  { summary: form.json, subject: null },
      csv_analyser:    { summary: form.csvData, subject: null },
      data_to_schema:  { summary: form.schemaDesc, subject: null },
      api_analyzer:    { summary: form.endpoint, subject: form.method },
      env_checker:     { summary: form.envContent, subject: null },
      jwt_decoder:     { summary: form.jwtToken, subject: null },
      base64:          { summary: form.base64Input, subject: form.base64Mode },
      readme:          { summary: form.info, subject: null },
      email_writer:    { summary: form.emailContext, subject: form.emailTone },
      text_improver:   { summary: form.textInput, subject: form.textGoal },
      translator:      { summary: form.translateText, subject: form.targetLang },
      summariser:      { summary: form.summariseText, subject: form.summariseStyle },
      pitch_writer:    { summary: form.pitchProduct, subject: null },
      job_desc:        { summary: form.jobTitle, subject: null },
      sop_writer:      { summary: form.sopProcess, subject: null },
      cold_email:      { summary: form.coldTarget, subject: null },
      diff_checker:    { summary: form.diffOriginal, subject: null },
      api_tester:      { summary: form.apiTesterUrl, subject: form.apiTesterMethod },
      math_solver:     { summary: form.mathEquation, subject: null },
    }
    const meta = map[active] || {}
    return {
      inputSummary: (meta.summary || '').slice(0, 100) || null,
      subject: meta.subject || null,
    }
  }

  // ── Line-by-line diff algorithm ──────────────────────────────────
  function computeDiff(original, modified) {
    const origLines = original.split('\n')
    const modLines = modified.split('\n')
    // Build LCS-based diff using simple DP
    const m = origLines.length, n = modLines.length
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = origLines[i - 1] === modLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
    // Backtrack to produce diff lines
    const result = []
    let i = m, j = n
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
        result.unshift({ type: 'unchanged', line: origLines[i - 1] })
        i--; j--
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.unshift({ type: 'added', line: modLines[j - 1] })
        j--
      } else {
        result.unshift({ type: 'removed', line: origLines[i - 1] })
        i--
      }
    }
    return result
  }

  async function run() {
    if (!validate()) return
    // End previous session if exists
    if (sessionRef.current) { endSession(sessionRef.current); sessionRef.current = null }
    setLoading(true); setResult(''); setDiffResult(null); setApiTestResult(null)
    // Start new session (silently fails for anonymous)
    const { inputSummary, subject } = getSessionMeta()
    sessionRef.current = await startSession(`devtools_${active}`, subject, inputSummary)

    // ── Client-side: Diff Checker ──────────────────────────────
    if (active === 'diff_checker') {
      const diff = computeDiff(form.diffOriginal, form.diffModified)
      setDiffResult(diff)
      setLoading(false)
      return
    }

    // ── Client-side: API Tester ────────────────────────────────
    if (active === 'api_tester') {
      const start = performance.now()
      try {
        let parsedHeaders = {}
        if (form.apiTesterHeaders.trim()) {
          try { parsedHeaders = JSON.parse(form.apiTesterHeaders) }
          catch { setApiTestResult({ error: 'Invalid headers JSON' }); setLoading(false); return }
        }
        const fetchOpts = { method: form.apiTesterMethod, headers: parsedHeaders }
        if (!['GET', 'HEAD'].includes(form.apiTesterMethod) && form.apiTesterBody.trim()) {
          fetchOpts.body = form.apiTesterBody
          if (!parsedHeaders['Content-Type'] && !parsedHeaders['content-type']) {
            parsedHeaders['Content-Type'] = 'application/json'
            fetchOpts.headers = parsedHeaders
          }
        }
        const res = await fetch(form.apiTesterUrl, fetchOpts)
        const elapsed = Math.round(performance.now() - start)
        const resHeaders = {}
        res.headers.forEach((v, k) => { resHeaders[k] = v })
        let resBody = ''
        try { resBody = await res.text() } catch { resBody = '[Could not read response body]' }
        let bodyFormatted = resBody
        let isJson = false
        try { bodyFormatted = JSON.stringify(JSON.parse(resBody), null, 2); isJson = true } catch {}
        setApiTestResult({ status: res.status, statusText: res.statusText, time: elapsed, headers: resHeaders, body: bodyFormatted, isJson })
      } catch (err) {
        setApiTestResult({ error: err.message || 'Request failed (possible CORS issue)' })
      }
      setLoading(false)
      return
    }

    // ── Server-side: AI tools ──────────────────────────────────
    try {
      const res = await fetch('/api/devtools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: active, payload: form })
      })
      const data = await res.json()
      setResult(data.result || data.error || t('common.error.general'))
    } catch { setResult(t('common.error.network')) }
    setLoading(false)
  }

  function copy() {
    navigator.clipboard.writeText(stripMarkdown(result))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (sessionRef.current) markCopied(sessionRef.current)
  }

  function selectTool(toolId, catId) {
    setActive(toolId)
    setActiveCat(catId)
    setResult('')
    setDiffResult(null)
    setApiTestResult(null)
    setValidationError('')
  }

  const currentCat = CATEGORIES.find(c => c.id === activeCat)
  const currentTool = ALL_TOOLS.find(tool => tool.id === active)

  const inp   = "w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"
  const mono  = `${inp} font-mono`
  const ta    = `${inp} resize-none leading-relaxed`
  const tamono= `${inp} resize-none leading-relaxed font-mono`

  // ── Live computations for new tools ──────────────────────────────
  function buildHighlightedParts(text, pattern, flags) {
    if (!pattern || !text) return [{ text, match: false }]
    try {
      const re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g')
      const parts = []
      let lastIndex = 0
      let m
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue }
        if (m.index > lastIndex) parts.push({ text: text.slice(lastIndex, m.index), match: false })
        parts.push({ text: m[0], match: true })
        lastIndex = m.index + m[0].length
      }
      if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), match: false })
      return parts.length ? parts : [{ text, match: false }]
    } catch {
      return [{ text, match: false }]
    }
  }

  const jwtDecoded = (() => {
    if (active !== 'jwt_decoder' || !form.jwtToken.trim()) return null
    try {
      const parts = form.jwtToken.trim().split('.')
      if (parts.length !== 3) return { error: 'Invalid JWT: must have 3 parts separated by dots' }
      const decode = (s) => { let b = s.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; return atob(b) }
      const header = JSON.parse(decode(parts[0]))
      const payload = JSON.parse(decode(parts[1]))
      const now = Math.floor(Date.now() / 1000)
      return {
        header,
        payload,
        expDate: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : null,
        expired: payload.exp ? now > payload.exp : null,
        iatDate: payload.iat ? new Date(payload.iat * 1000).toLocaleString() : null,
        nbfDate: payload.nbf ? new Date(payload.nbf * 1000).toLocaleString() : null,
      }
    } catch {
      return { error: "Could not decode: ensure it's a valid JWT" }
    }
  })()

  const regexMatches = (() => {
    if (active !== 'regex_tester' || !form.regexPattern || !form.regexTestString) return null
    try {
      const flags = form.regexFlags.includes('g') ? form.regexFlags : form.regexFlags + 'g'
      const re = new RegExp(form.regexPattern, flags)
      const matches = []
      let match
      while ((match = re.exec(form.regexTestString)) !== null) {
        matches.push({ value: match[0], index: match.index, groups: match.slice(1) })
        if (match[0].length === 0) { re.lastIndex++; break }
      }
      return matches
    } catch {
      return null
    }
  })()

  const base64Result = (() => {
    if (active !== 'base64' || !form.base64Input.trim()) return null
    try {
      if (form.base64Mode === 'encode') return btoa(unescape(encodeURIComponent(form.base64Input)))
      else return decodeURIComponent(escape(atob(form.base64Input.trim())))
    } catch {
      return '__ERROR__'
    }
  })()

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-10">

        {/* Header */}
        <div className="mb-6 animate-fade-up">
          <h1 className="text-display font-semibold mb-2 tracking-tight">
            {t('devtools.title').slice(0, parseInt(t('devtools.split')))}<span className="text-red-500">{t('devtools.title').slice(parseInt(t('devtools.split')))}</span>
          </h1>
          <p className="text-muted text-body-sm mt-0.5">
            {t('devtools.subtitle')}
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setActiveCat(cat.id); setActive(cat.tools[0].id); setResult(''); setValidationError('') }}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                activeCat === cat.id
                  ? 'text-[#0a0a0a] border-transparent'
                  : 'bg-[#141414] border-[#262626] text-muted hover:text-white hover:border-[#3a3a3a]'
              }`}
              style={activeCat === cat.id ? { background: cat.color, borderColor: cat.color } : {}}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>

        {/* Tool pills within active category */}
        <div className="flex flex-wrap gap-2 mb-7">
          {currentCat.tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => selectTool(tool.id, activeCat)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active === tool.id
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-[#141414] border-[#262626] text-muted hover:text-white hover:border-[#3a3a3a]'
              }`}
            >
              <tool.Icon size={12} /> {t(tool.labelKey)}
            </button>
          ))}
        </div>

        {/* Split panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Input Panel ─────────────────────────────────── */}
          <div className="bg-[#141414] rounded-xl p-7">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                <currentTool.Icon size={15} className="text-muted" />
              </div>
              <div>
                <h2 className="font-semibold text-sm tracking-tight text-muted">{t(currentTool.labelKey)}</h2>
                <p className="text-xs text-muted">{t(currentTool.descKey)}</p>
              </div>
            </div>

            <div className="space-y-3">

              {/* ─── CODE TOOLS ─────────────────── */}

              {active === 'code_explainer' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.language')}</label>
                  <Select value={form.language} onChange={v => set('language', v)} options={LANGUAGES.map(l => ({ value: l, label: l }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.code')}</label>
                  <textarea className={`${tamono} h-52`} placeholder="Paste any code here..." value={form.code} onChange={e => set('code', e.target.value)} />
                </div>
              </>}

              {active === 'code_reviewer' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.language')}</label>
                  <Select value={form.reviewLang} onChange={v => set('reviewLang', v)} options={LANGUAGES.map(l => ({ value: l, label: l }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.code_to_review')}</label>
                  <textarea className={`${tamono} h-52`} placeholder="Paste the code you want reviewed..." value={form.reviewCode} onChange={e => set('reviewCode', e.target.value)} />
                </div>
              </>}

              {active === 'regex' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.pattern_match')}</label>
                  <textarea className={`${ta} h-24`} placeholder="e.g. Nigerian phone numbers starting with 070, 080, 081, 090..." value={form.description} onChange={e => set('description', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.language')}</label>
                  <Select value={form.regexLang} onChange={v => set('regexLang', v)} options={LANGUAGES.map(l => ({ value: l, label: l }))} />
                </div>
              </>}

              {active === 'sql_builder' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.describe_query')}</label>
                  <textarea className={`${ta} h-24`} placeholder="e.g. Get all users who signed up in the last 30 days with their total order count, sorted by most recent" value={form.sqlDesc} onChange={e => set('sqlDesc', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.sql_dialect')}</label>
                  <Select value={form.dialect} onChange={v => set('dialect', v)} options={SQL_DIALECTS.map(d => ({ value: d, label: d }))} />
                </div>
              </>}

              {active === 'terminal' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.context')}</label>
                  <Select value={form.terminalContext} onChange={v => set('terminalContext', v)} options={['Linux/Mac','Windows','Docker','AWS CLI','Git Bash'].map(c => ({ value: c, label: c }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.command')}</label>
                  <textarea className={`${tamono} h-28`} placeholder="e.g. find all .env files in this folder and subfolders but not in node_modules" value={form.terminalCmd} onChange={e => set('terminalCmd', e.target.value)} />
                </div>
              </>}

              {active === 'git_helper' && (
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.git_task')}</label>
                  <textarea className={`${ta} h-36`} placeholder="e.g. How do I squash my last 4 commits into one? / What does this error mean: fatal: refusing to merge unrelated histories" value={form.gitCmd} onChange={e => set('gitCmd', e.target.value)} />
                </div>
              )}

              {active === 'regex_tester' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.regex_pattern')}</label>
                  <input className={mono} placeholder="e.g. \b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b" value={form.regexPattern} onChange={e => set('regexPattern', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.flags')}</label>
                  <Select value={form.regexFlags} onChange={v => set('regexFlags', v)} options={['g','gi','gm','gs','gim','gims','i','im','m','s'].map(f => ({ value: f, label: f }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.test_string')}</label>
                  <textarea className={`${ta} h-32`} placeholder="Enter text to test against the pattern..." value={form.regexTestString} onChange={e => set('regexTestString', e.target.value)} />
                </div>
              </>}

              {active === 'diff_checker' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.original_text')}</label>
                  <textarea className={`${tamono} h-36`} placeholder="Paste the original text here..." value={form.diffOriginal} onChange={e => set('diffOriginal', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.modified_text')}</label>
                  <textarea className={`${tamono} h-36`} placeholder="Paste the modified text here..." value={form.diffModified} onChange={e => set('diffModified', e.target.value)} />
                </div>
              </>}

              {/* ─── DATA TOOLS ─────────────────── */}

              {active === 'json_formatter' && (
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.paste_json')}</label>
                  <textarea className={`${tamono} h-56`} placeholder={'{"key": "value"}'} value={form.json} onChange={e => set('json', e.target.value)} />
                </div>
              )}

              {active === 'csv_analyser' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.paste_csv')}</label>
                  <textarea className={`${tamono} h-40`} placeholder={"name,email,plan,created_at\nAlex,alex@example.com,pro,2026-01-01"} value={form.csvData} onChange={e => set('csvData', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.csv_goal')}</label>
                  <input className={inp} placeholder="e.g. Which plan has the most users? Any patterns in the data?" value={form.csvGoal} onChange={e => set('csvGoal', e.target.value)} />
                </div>
              </>}

              {active === 'data_to_schema' && (
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.describe_data')}</label>
                  <textarea className={`${ta} h-44`} placeholder={"e.g. An e-commerce platform with products, customers, orders, and order items. Customers can have multiple addresses. Products have categories and images."} value={form.schemaDesc} onChange={e => set('schemaDesc', e.target.value)} />
                </div>
              )}

              {active === 'api_analyzer' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.endpoint')}</label>
                  <input className={mono} placeholder="https://api.example.com/v1/users" value={form.endpoint} onChange={e => set('endpoint', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.method')}</label>
                  <Select value={form.method} onChange={v => set('method', v)} options={HTTP_METHODS.map(m => ({ value: m, label: m }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.headers')}</label>
                  <textarea className={`${tamono} h-14`} placeholder='{"Authorization": "Bearer token"}' value={form.headers} onChange={e => set('headers', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.body')}</label>
                  <textarea className={`${tamono} h-14`} placeholder='{"email": "user@example.com"}' value={form.body} onChange={e => set('body', e.target.value)} />
                </div>
              </>}

              {active === 'env_checker' && (
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.paste_env')}</label>
                  <textarea className={`${tamono} h-52`} placeholder={"DATABASE_URL=...\nJWT_SECRET=...\nNEXT_PUBLIC_API_URL=..."} value={form.envContent} onChange={e => set('envContent', e.target.value)} />
                </div>
              )}

              {active === 'jwt_decoder' && (
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.paste_jwt')}</label>
                  <textarea className={`${tamono} h-52`} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" value={form.jwtToken} onChange={e => set('jwtToken', e.target.value)} />
                </div>
              )}

              {active === 'base64' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.mode')}</label>
                  <Select value={form.base64Mode} onChange={v => set('base64Mode', v)} options={[{ value: 'encode', label: t('devtools.label.encode') }, { value: 'decode', label: t('devtools.label.decode') }]} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{form.base64Mode === 'encode' ? t('devtools.label.text_to_encode') : t('devtools.label.base64_to_decode')}</label>
                  <textarea className={`${tamono} h-40`} placeholder={form.base64Mode === 'encode' ? 'Enter text to encode...' : 'Enter Base64 string to decode...'} value={form.base64Input} onChange={e => set('base64Input', e.target.value)} />
                </div>
              </>}

              {active === 'api_tester' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.url')}</label>
                  <input className={mono} placeholder="https://api.example.com/v1/users" value={form.apiTesterUrl} onChange={e => set('apiTesterUrl', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.method')}</label>
                  <Select value={form.apiTesterMethod} onChange={v => set('apiTesterMethod', v)} options={HTTP_METHODS.map(m => ({ value: m, label: m }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.headers')}</label>
                  <textarea className={`${tamono} h-14`} placeholder='{"Authorization": "Bearer token"}' value={form.apiTesterHeaders} onChange={e => set('apiTesterHeaders', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.body')}</label>
                  <textarea className={`${tamono} h-14`} placeholder='{"email": "user@example.com"}' value={form.apiTesterBody} onChange={e => set('apiTesterBody', e.target.value)} />
                </div>
              </>}

              {/* ─── CONTENT TOOLS ─────────────────── */}

              {active === 'readme' && (
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.describe_project')}</label>
                  <textarea className={`${ta} h-52`} placeholder={"Project name, what it does, tech stack, key features, how to install and use it..."} value={form.info} onChange={e => set('info', e.target.value)} />
                </div>
              )}

              {active === 'email_writer' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.recipient')}</label>
                  <input className={inp} placeholder="e.g. CEO of a logistics company / potential client" value={form.emailRecipient} onChange={e => set('emailRecipient', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.tone')}</label>
                  <Select value={form.emailTone} onChange={v => set('emailTone', v)} options={TONES.map(tn => ({ value: tn, label: tn }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.email_content')}</label>
                  <textarea className={`${ta} h-32`} placeholder="Bullet points or a rough description. e.g. Following up on the proposal I sent Tuesday. Asking if they have questions. Suggesting a call this week." value={form.emailContext} onChange={e => set('emailContext', e.target.value)} />
                </div>
              </>}

              {active === 'text_improver' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.goal')}</label>
                  <Select value={form.textGoal} onChange={v => set('textGoal', v)} options={['Improve clarity','Make more professional','Make more concise','Fix grammar','Make more persuasive','Simplify for non-experts','Make more engaging'].map(g => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.your_text')}</label>
                  <textarea className={`${ta} h-44`} placeholder="Paste the text you want improved..." value={form.textInput} onChange={e => set('textInput', e.target.value)} />
                </div>
              </>}

              {active === 'translator' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.target_lang')}</label>
                  <Select value={form.targetLang} onChange={v => set('targetLang', v)} options={LANGUAGES_HUMAN.map(l => ({ value: l, label: l }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.text_to_translate')}</label>
                  <textarea className={`${ta} h-44`} placeholder="Paste the text to translate..." value={form.translateText} onChange={e => set('translateText', e.target.value)} />
                </div>
              </>}

              {active === 'summariser' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.summary_style')}</label>
                  <Select value={form.summariseStyle} onChange={v => set('summariseStyle', v)} options={['Bullet points','One paragraph','Executive summary','Tweet thread','ELI5 (simple)','Key quotes only'].map(s => ({ value: s, label: s }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.text_to_summarise')}</label>
                  <textarea className={`${ta} h-44`} placeholder="Paste an article, report, meeting notes, or any long text..." value={form.summariseText} onChange={e => set('summariseText', e.target.value)} />
                </div>
              </>}

              {/* ─── BUSINESS TOOLS ─────────────────── */}

              {active === 'pitch_writer' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.pitch_product')}</label>
                  <textarea className={`${ta} h-24`} placeholder="What you're pitching: the product, service, or idea. What it does, who it's for." value={form.pitchProduct} onChange={e => set('pitchProduct', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.pitch_audience')}</label>
                  <input className={inp} placeholder="e.g. Seed-stage investors / a potential enterprise client / a strategic partner" value={form.pitchAudience} onChange={e => set('pitchAudience', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.pitch_ask')}</label>
                  <input className={inp} placeholder="e.g. $150,000 pre-seed / a 30-minute meeting / a pilot contract" value={form.pitchAsk} onChange={e => set('pitchAsk', e.target.value)} />
                </div>
              </>}

              {active === 'job_desc' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.job_title')}</label>
                  <input className={inp} placeholder="e.g. Senior Backend Engineer / Content Manager / Operations Lead" value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.job_responsibilities')}</label>
                  <textarea className={`${ta} h-24`} placeholder="3–5 bullet points of what this person will own..." value={form.jobResponsibilities} onChange={e => set('jobResponsibilities', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.job_requirements')}</label>
                  <textarea className={`${ta} h-20`} placeholder="Skills, experience, and tools required..." value={form.jobRequirements} onChange={e => set('jobRequirements', e.target.value)} />
                </div>
              </>}

              {active === 'sop_writer' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.sop_process')}</label>
                  <textarea className={`${ta} h-28`} placeholder="e.g. How to onboard a new client: from signed contract to first deliverable. Includes Slack setup, project creation in Notion, first call, questionnaire." value={form.sopProcess} onChange={e => set('sopProcess', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.sop_role')}</label>
                  <input className={inp} placeholder="e.g. Junior account manager / any new team member / the founder" value={form.sopRole} onChange={e => set('sopRole', e.target.value)} />
                </div>
              </>}

              {active === 'cold_email' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.cold_target')}</label>
                  <input className={inp} placeholder="e.g. Operations manager at a mid-sized Lagos logistics company" value={form.coldTarget} onChange={e => set('coldTarget', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.cold_product')}</label>
                  <input className={inp} placeholder="e.g. WhatsApp automation that handles customer queries automatically" value={form.coldProduct} onChange={e => set('coldProduct', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.cold_observation')}</label>
                  <textarea className={`${ta} h-20`} placeholder="e.g. I noticed on their Google listing that customers complained about slow WhatsApp response times..." value={form.coldObservation} onChange={e => set('coldObservation', e.target.value)} />
                </div>
              </>}

              {/* ─── EDUCATION TOOLS ─────────────────── */}

              {active === 'math_solver' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.equation')}</label>
                  <textarea className={`${tamono} h-28`} placeholder="e.g. Solve x² + 5x + 6 = 0" value={form.mathEquation} onChange={e => set('mathEquation', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('devtools.label.math_context')}</label>
                  <input className={inp} placeholder="e.g. Find all real roots" value={form.mathContext} onChange={e => set('mathContext', e.target.value)} />
                </div>
              </>}

            </div>

            {validationError && <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400 mt-3">{validationError}</div>}

            <button onClick={run} disabled={loading}
              className="mt-5 w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press">
              {loading ? <><IconSpinner size={14} /> {t('devtools.running')}</> : `${t('common.run')} ${t(currentTool.labelKey)} `}
            </button>

            {/* ── Live display: JWT Decoder ─────────────── */}
            {active === 'jwt_decoder' && form.jwtToken.trim() && (
              <div className="mt-4 space-y-3">
                <h3 className="text-xs text-muted font-semibold uppercase tracking-wider">{t('devtools.decoded_token')}</h3>
                {jwtDecoded?.error ? (
                  <div className="bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2 text-xs text-red-400">{jwtDecoded.error}</div>
                ) : jwtDecoded ? (
                  <>
                    <div>
                      <span className="text-xs text-muted">{t('devtools.jwt_header')}</span>
                      <pre className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3 text-xs font-mono text-emerald-400 overflow-auto max-h-28 mt-1">{JSON.stringify(jwtDecoded.header, null, 2)}</pre>
                    </div>
                    <div>
                      <span className="text-xs text-muted">{t('devtools.jwt_payload')}</span>
                      <pre className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3 text-xs font-mono text-red-400 overflow-auto max-h-36 mt-1">{JSON.stringify(jwtDecoded.payload, null, 2)}</pre>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {jwtDecoded.expDate && (
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${jwtDecoded.expired ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          <span className="text-muted">{jwtDecoded.expired ? t('devtools.jwt_expired') : t('devtools.jwt_valid')}</span>
                          <span className="text-[#525252]">{jwtDecoded.expDate}</span>
                        </div>
                      )}
                      {jwtDecoded.iatDate && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          <span className="text-muted">{t('devtools.jwt_issued')}</span>
                          <span className="text-[#525252]">{jwtDecoded.iatDate}</span>
                        </div>
                      )}
                      {jwtDecoded.nbfDate && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-700" />
                          <span className="text-muted">{t('devtools.jwt_not_before')}</span>
                          <span className="text-[#525252]">{jwtDecoded.nbfDate}</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {/* ── Live display: Base64 ──────────────────── */}
            {active === 'base64' && form.base64Input.trim() && (
              <div className="mt-4 space-y-3">
                <h3 className="text-xs text-muted font-semibold uppercase tracking-wider">{form.base64Mode === 'encode' ? t('devtools.encoded_result') : t('devtools.decoded_result')}</h3>
                {base64Result === '__ERROR__' ? (
                  <div className="bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2 text-xs text-red-400">{t('devtools.invalid_base64', { mode: form.base64Mode })}</div>
                ) : base64Result ? (
                  <pre className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3 text-xs font-mono text-emerald-400 overflow-auto max-h-32 whitespace-pre-wrap break-all">{base64Result}</pre>
                ) : null}
              </div>
            )}

            {/* ── Live display: Regex Tester ────────────── */}
            {active === 'regex_tester' && form.regexPattern && form.regexTestString && (
              <div className="mt-4 space-y-3">
                <h3 className="text-xs text-muted font-semibold uppercase tracking-wider">{t('devtools.matches')}</h3>
                {regexMatches === null ? (
                  <div className="bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2 text-xs text-red-400">{t('devtools.invalid_regex')}</div>
                ) : (
                  <>
                    <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3 text-sm overflow-auto max-h-36 whitespace-pre-wrap font-mono">
                      {buildHighlightedParts(form.regexTestString, form.regexPattern, form.regexFlags).map((part, i) =>
                        part.match
                          ? <mark key={i} className="bg-yellow-500/30 text-yellow-300 rounded px-0.5">{part.text}</mark>
                          : <span key={i}>{part.text}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span>{regexMatches.length} {t('devtools.match')}{regexMatches.length !== 1 ? 'es' : ''}</span>
                      {regexMatches.some(m => m.groups.length > 0) && (
                        <span>{regexMatches.reduce((acc, m) => acc + m.groups.length, 0)} {t('devtools.captured_group')}{regexMatches.reduce((acc, m) => acc + m.groups.length, 0) !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {regexMatches.length > 0 && (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {regexMatches.map((m, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-[#525252] w-5 text-right">{i + 1}</span>
                            <span className="text-yellow-300 font-mono">&quot;{m.value}&quot;</span>
                            <span className="text-[#525252]">at {m.index}</span>
                            {m.groups.filter(g => g != null).length > 0 && (
                              <span className="text-muted">[{m.groups.filter(g => g != null).map(g => `"${g}"`).join(', ')}]</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Output Panel ─────────────────────────────────── */}
          <div className="bg-[#141414] rounded-xl p-6 flex flex-col min-h-[560px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="font-semibold text-sm text-muted">{t('devtools.output')}</h2>
              {result && (
                <button onClick={copy} className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors">
                  {copied
                    ? <><IconCheck size={11} className="text-emerald-400" /> {t('common.copied')}</>
                    : <><IconCopy size={11} /> {t('common.copy')}</>}
                </button>
              )}
            </div>

            {result
              ? <MarkdownRenderer content={result} className="flex-1 overflow-auto overscroll-behavior-contain" />
              : diffResult
              ? (
                <div className="flex-1 overflow-auto">
                  <div className="space-y-0.5 font-mono text-xs">
                    {diffResult.map((line, i) => (
                      <div key={i} className={`px-3 py-0.5 ${
                        line.type === 'added'
                          ? 'bg-emerald-950/30 text-emerald-400'
                          : line.type === 'removed'
                          ? 'bg-red-950/30 text-red-400'
                          : 'text-[#525252]'
                      }`}>
                        <span className="inline-block w-5 text-right mr-2 select-none opacity-50">
                          {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
                        </span>
                        {line.line || ' '}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {t('devtools.diff_added')} ({diffResult.filter(l => l.type === 'added').length})</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> {t('devtools.diff_removed')} ({diffResult.filter(l => l.type === 'removed').length})</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#525252]" /> {t('devtools.diff_unchanged')} ({diffResult.filter(l => l.type === 'unchanged').length})</span>
                  </div>
                </div>
              )
              : apiTestResult
              ? (
                <div className="flex-1 overflow-auto space-y-4">
                  {apiTestResult.error ? (
                    <div className="bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2 text-xs text-red-400">{apiTestResult.error}</div>
                  ) : (
                    <>
                      {/* Status + Time */}
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          apiTestResult.status < 300 ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40'
                          : apiTestResult.status < 400 ? 'bg-red-950/40 text-red-400 border border-red-900/40'
                          : 'bg-red-950/40 text-red-400 border border-red-900/40'
                        }`}>
                          {apiTestResult.status} {apiTestResult.statusText}
                        </span>
                        <span className="text-xs text-muted">{apiTestResult.time}ms</span>
                      </div>
                      {/* Headers */}
                      <div>
                        <h3 className="text-xs text-muted font-semibold uppercase tracking-wider mb-1.5">{t('devtools.label.headers')}</h3>
                        <pre className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3 text-xs font-mono text-red-400 overflow-auto max-h-28">{Object.entries(apiTestResult.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}</pre>
                      </div>
                      {/* Body */}
                      <div>
                        <h3 className="text-xs text-muted font-semibold uppercase tracking-wider mb-1.5">{t('devtools.label.body')}</h3>
                        <pre className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-3 text-xs font-mono text-emerald-400 overflow-auto max-h-64 whitespace-pre-wrap break-all">{apiTestResult.body}</pre>
                      </div>
                    </>
                  )}
                </div>
              )
              : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-3">
                      <currentTool.Icon size={20} className="text-[#2e2e2e]" />
                    </div>
                    <p className="text-muted2 text-sm">{loading ? t('devtools.running') : t('devtools.output_appears_here')}</p>
                    <p className="text-[#2e2e2e] text-xs mt-1">{t('devtools.fill_and_run')}</p>
                  </div>
                </div>
              )
            }
          </div>
        </div>

        {/* All tools quick reference */}
        <div className="mt-10 border-t border-[#141414] pt-10">
          <h2 className="font-semibold text-base tracking-tight mb-6 text-muted">{t('devtools.all_tools')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CATEGORIES.map(cat => (
              <div key={cat.id} className="bg-[#141414] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-5 rounded-full" style={{ background: cat.color }} />
                  <h3 className="font-semibold text-sm text-muted">{t(cat.labelKey)}</h3>
                </div>
                <ul className="space-y-1.5">
                  {cat.tools.map(tool => (
                    <li key={tool.id}>
                      <button
                        onClick={() => selectTool(tool.id, cat.id)}
                        className={`w-full text-left text-xs flex items-center gap-2 py-1 px-2 rounded-lg transition-colors ${
                          active === tool.id
                            ? 'text-red-400 bg-red-950/20'
                            : 'text-muted hover:text-white hover:bg-[#1a1a1a]'
                        }`}
                      >
                        <tool.Icon size={11} className="shrink-0" />
                        {t(tool.labelKey)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-[#2e2e2e] mt-8">
          {t('devtools.footer_tagline')}
        </p>
      </div>
    </main>
  )
}
