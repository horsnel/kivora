'use client'
import { useState, useEffect, useRef } from 'react'
import { IconBook, IconWrite, IconMicroscope, IconCode, IconCopy, IconCheck, IconSpinner } from '@/components/Icons'
import { useSessionTracker } from '@/lib/useSessionTracker'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import Select from '@/components/Select'
import { useTranslation } from '@/components/LanguageProvider'

/* ─── Icon Components ─────────────────────────────────────────── */

function IconCitation({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 2h8l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M11 2v4h3" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M5 7h6M5 9.5h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

function IconFlashcard({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1" y="7" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1"/>
      <rect x="3.5" y="4.5" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1"/>
      <rect x="6" y="2" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1"/>
    </svg>
  )
}

function IconQuiz({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M6.5 6a1.5 1.5 0 113 0c0 .83-1.5 1.17-1.5 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8" cy="10.5" r="0.5" fill="currentColor"/>
    </svg>
  )
}

function IconTimer({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M8 6v3.5l2 1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.5 1.5h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M8 1.5v1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="11" cy="4" r="0.75" fill="currentColor"/>
    </svg>
  )
}

function IconNotes({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M3 5.5h10" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M5.5 2v12" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M7.5 8h3M7.5 10.5h2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

/* ─── Constants ────────────────────────────────────────────────── */

const TOOLS = [
  { id: 'homework',  labelKey: 'study.homework',  Icon: IconBook,      descKey: 'study.homework.desc' },
  { id: 'essay',     labelKey: 'study.essay',     Icon: IconWrite,     descKey: 'study.essay.desc' },
  { id: 'research',  labelKey: 'study.research',  Icon: IconMicroscope,descKey: 'study.research.desc' },
  { id: 'citation',  labelKey: 'study.citation',  Icon: IconCitation,  descKey: 'study.citation.desc' },
  { id: 'coding',    labelKey: 'study.coding',    Icon: IconCode,      descKey: 'study.coding.desc' },
  { id: 'flashcard', labelKey: 'study.flashcard', Icon: IconFlashcard, descKey: 'study.flashcard.desc' },
  { id: 'quiz',      labelKey: 'study.quiz',      Icon: IconQuiz,      descKey: 'study.quiz.desc' },
  { id: 'notes',     labelKey: 'study.notes',     Icon: IconNotes,     descKey: 'study.notes.desc' },
  { id: 'pomodoro',  labelKey: 'study.pomodoro',  Icon: IconTimer,     descKey: 'study.pomodoro.desc' },
]

const SUBJECTS = ['Mathematics','Physics','Chemistry','Biology','History','English','Economics','Computer Science','Statistics','Psychology','Philosophy','Geography']
const CITATION_STYLES = ['APA','MLA','Chicago','Harvard','IEEE','Vancouver']
const ESSAY_LEVELS = ['High School','Undergraduate','Postgraduate','PhD']
const LANGUAGES = ['JavaScript','Python','TypeScript','Java','C++','Go','Rust','SQL','PHP','Swift']
const CODE_LEVELS = ['Beginner','Intermediate','Advanced']
const FLASHCARD_COUNTS = ['5','10','15','20']
const QUIZ_DIFFICULTIES = ['Easy','Medium','Hard']
const QUIZ_COUNTS = ['5','10','15']
const NOTE_STYLES = ['Cornell Notes', 'Outline', 'Mind Map Text', 'Summary']
const POMODORO_MODES = [
  { value: 'pomodoro', labelKey: 'study.pomodoro.mode_pomodoro' },
  { value: 'short', labelKey: 'study.pomodoro.mode_short' },
  { value: 'long', labelKey: 'study.pomodoro.mode_long' },
  { value: 'custom', labelKey: 'study.pomodoro.mode_custom' },
]

/* ─── Helpers ──────────────────────────────────────────────────── */

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    gain.gain.value = 0.3
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    osc.stop(ctx.currentTime + 0.5)
  } catch {}
}

function parseQuiz(text) {
  if (!text) return []
  const questions = []
  const blocks = text.split(/\n(?=Q\d+[:.])/i)
  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trimEnd()).filter(l => l.trim())
    const qMatch = lines[0]?.match(/^Q(\d+)[:.]\s*(.*)/i)
    if (!qMatch) continue
    const num = parseInt(qMatch[1])
    const question = qMatch[2].trim()
    const options = []
    let answer = -1
    let explanation = ''
    let inExplanation = false
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      const optMatch = line.match(/^([A-D])\)\s*(.*)/i)
      if (optMatch) { options.push(optMatch[2].trim()); inExplanation = false; continue }
      const ansMatch = line.match(/^Answer:\s*([A-D])/i)
      if (ansMatch) { answer = ansMatch[1].toUpperCase().charCodeAt(0) - 65; inExplanation = false; continue }
      const expMatch = line.match(/^Explanation:\s*(.*)/i)
      if (expMatch) { explanation = expMatch[1].trim(); inExplanation = true; continue }
      if (inExplanation && line) explanation += ' ' + line
    }
    if (question && options.length >= 2 && answer >= 0) {
      questions.push({ number: num, question, options, answer, explanation })
    }
  }
  return questions
}

function getPomodoroSeconds(mode, minutes) {
  switch (mode) {
    case 'pomodoro': return 25 * 60
    case 'short': return 5 * 60
    case 'long': return 15 * 60
    case 'custom': return (parseInt(minutes) || 25) * 60
    default: return 25 * 60
  }
}

/* ─── Main Component ──────────────────────────────────────────── */

export default function StudyClient() {
  const [active, setActive] = useState('homework')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({
    subject:'Mathematics', question:'', topic:'', level:'Undergraduate',
    text:'', source:'', style:'APA', language:'Python', codeLevel:'Intermediate',
    flashcardSubject: 'Mathematics', flashcardNotes: '', flashcardCount: '10',
    quizSubject: 'Mathematics', quizTopic: '', quizDifficulty: 'Medium', quizCount: '5',
    notesSubject: 'Mathematics', notesTopics: '', notesStyle: 'Cornell Notes',
    pomodoroMinutes: 25, pomodoroMode: 'pomodoro',
  })
  const [validationError, setValidationError] = useState('')

  // Quiz interactive state
  const [quizQuestions, setQuizQuestions] = useState([])
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizChecked, setQuizChecked] = useState(false)

  // Pomodoro timer state
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const [timerDone, setTimerDone] = useState(false)

  const { startSession, endSession, markCopied, markFollowUp } = useSessionTracker()
  const { t } = useTranslation()
  const sessionRef = useRef(null)

  // Computed pomodoro total time
  const pomodoroTotal = getPomodoroSeconds(form.pomodoroMode, form.pomodoroMinutes)

  // Timer interval
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(id)
          setIsRunning(false)
          setTimerDone(true)
          setSessionCount(c => c + 1)
          playBeep()
          if (sessionRef.current) { endSession(sessionRef.current); sessionRef.current = null }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning, endSession])

  // End session on unmount
  useEffect(() => {
    return () => { if (sessionRef.current) endSession(sessionRef.current) }
  }, [endSession])

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    if (validationError) setValidationError('')
    // Reset timer when pomodoro settings change
    if (active === 'pomodoro' && (k === 'pomodoroMode' || k === 'pomodoroMinutes')) {
      setIsRunning(false)
      setTimerDone(false)
      const newMode = k === 'pomodoroMode' ? v : form.pomodoroMode
      const newMinutes = k === 'pomodoroMinutes' ? v : form.pomodoroMinutes
      setTimeLeft(getPomodoroSeconds(newMode, newMinutes))
    }
  }

  function validate() {
    const checks = {
      homework:  { field: form.question, label: t('study.validation.homework') },
      essay:     { field: form.topic, label: t('study.validation.essay') },
      research:  { field: form.text, label: t('study.validation.research') },
      citation:  { field: form.source, label: t('study.validation.citation') },
      coding:    { skip: true },
      flashcard: { field: form.flashcardNotes, label: t('study.validation.flashcard') },
      quiz:      { field: form.quizTopic, label: t('study.validation.quiz') },
      notes:     { field: form.notesTopics, label: t('study.validation.notes') },
      pomodoro:  { skip: true },
    }
    const check = checks[active]
    if (check?.skip) { setValidationError(''); return true }
    if (check && !check.field?.trim()) {
      setValidationError(check.label)
      return false
    }
    setValidationError('')
    return true
  }

  async function run() {
    if (!validate()) return
    if (sessionRef.current) { endSession(sessionRef.current); sessionRef.current = null }
    setLoading(true); setResult('')
    if (active === 'quiz') { setQuizQuestions([]); setQuizAnswers({}); setQuizChecked(false) }
    const inputSummary = form.question || form.topic || form.text?.slice(0,100) || form.source?.slice(0,100) || form.language || form.flashcardNotes?.slice(0,100) || form.quizTopic || form.notesTopics?.slice(0,100) || null
    const subject = active === 'homework' ? form.subject
      : active === 'essay' ? form.level
      : active === 'coding' ? form.language
      : active === 'citation' ? form.style
      : active === 'flashcard' ? form.flashcardSubject
      : active === 'quiz' ? form.quizSubject
      : active === 'notes' ? form.notesSubject
      : null
    sessionRef.current = await startSession(`study_${active}`, subject, inputSummary)
    try {
      const payloads = {
        homework:  { subject: form.subject, question: form.question },
        essay:     { topic: form.topic, level: form.level },
        research:  { text: form.text },
        citation:  { source: form.source, style: form.style },
        coding:    { language: form.language, level: form.codeLevel },
        flashcard: { subject: form.flashcardSubject, notes: form.flashcardNotes, count: form.flashcardCount },
        quiz:      { subject: form.quizSubject, topic: form.quizTopic, difficulty: form.quizDifficulty, count: form.quizCount },
        notes:     { subject: form.notesSubject, topics: form.notesTopics, style: form.notesStyle },
      }
      const res = await fetch('/api/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: active, payload: payloads[active] })
      })
      const data = await res.json()
      setResult(data.result || data.error || t('common.error.general'))
      if (active === 'quiz' && data.result) {
        const parsed = parseQuiz(data.result)
        if (parsed.length > 0) setQuizQuestions(parsed)
      }
    } catch { setResult(t('common.error.network')) }
    setLoading(false)
  }

  function copy() {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (sessionRef.current) markCopied(sessionRef.current)
  }

  // Pomodoro handlers
  async function startPomodoro() {
    if (isRunning) { setIsRunning(false); return }
    setIsRunning(true)
    setTimerDone(false)
    if (sessionRef.current) { endSession(sessionRef.current); sessionRef.current = null }
    sessionRef.current = await startSession('study_pomodoro', form.pomodoroMode, `${form.pomodoroMode === 'custom' ? form.pomodoroMinutes : form.pomodoroMode} min`)
  }

  function resetPomodoro() {
    setIsRunning(false)
    setTimeLeft(pomodoroTotal)
    setTimerDone(false)
    if (sessionRef.current) { endSession(sessionRef.current); sessionRef.current = null }
  }

  const meta = TOOLS.find(tool => tool.id === active)

  const inputClass = "w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#404040] focus:border-red-500 focus:outline-none focus:shadow-[0_0_0_2px_rgba(220,38,38,0.15),0_0_16px_rgba(220,38,38,0.06)] transition-all duration-200"
  const textareaClass = `${inputClass} resize-none leading-relaxed`

  // Quiz score calculation
  const quizScore = quizChecked ? quizQuestions.reduce((acc, q, i) => acc + (quizAnswers[i] === q.answer ? 1 : 0), 0) : 0

  // Progress ring calculations
  const radius = 90
  const circumference = 2 * Math.PI * radius
  const progress = pomodoroTotal > 0 ? timeLeft / pomodoroTotal : 0
  const dashoffset = circumference * (1 - progress)

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8 animate-fade-up">
          <h1 className="text-3xl font-semibold mb-2 tracking-tight">{t('study.title').slice(0,5)}<span className="text-red-500">{t('study.title').slice(5)}</span></h1>
          <p className="text-[#737373] text-sm">{t('study.subtitle')}</p>
        </div>

        {/* Tool tabs */}
        <div className="flex flex-wrap gap-2 mb-7">
          {TOOLS.map(({ id, labelKey, Icon }) => (
            <button key={id} onClick={() => {
              setActive(id); setResult('')
              setQuizQuestions([]); setQuizAnswers({}); setQuizChecked(false)
              if (id === 'pomodoro') {
                setIsRunning(false); setTimerDone(false)
                setTimeLeft(getPomodoroSeconds(form.pomodoroMode, form.pomodoroMinutes))
              }
            }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium border transition-all ${
                active === id ? 'bg-red-600 border-red-600 text-white' : 'bg-[#141414] border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a]'
              }`}>
              <Icon size={13} /> {t(labelKey)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Input */}
          <div className="bg-[#141414] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <meta.Icon size={15} className="text-[#737373]" />
              <div>
                <h2 className="font-semibold text-sm">{t(meta.labelKey)}</h2>
                <p className="text-xs text-[#737373]">{t(meta.descKey)}</p>
              </div>
            </div>

            <div className="space-y-3">
              {active === 'homework' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.subject')}</label>
                  <Select value={form.subject} onChange={v => set('subject', v)} options={SUBJECTS.map(s => ({ value: s, label: s }))} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.question')}</label>
                  <textarea className={`${textareaClass} h-32`} placeholder="Paste your homework question here..." value={form.question} onChange={e => set('question', e.target.value)} /></div>
              </>}

              {active === 'essay' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.topic')}</label>
                  <input className={inputClass} placeholder="e.g. The impact of social media on democracy" value={form.topic} onChange={e => set('topic', e.target.value)} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.level')}</label>
                  <Select value={form.level} onChange={v => set('level', v)} options={ESSAY_LEVELS.map(l => ({ value: l, label: l }))} /></div>
              </>}

              {active === 'research' && (
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.paper')}</label>
                  <textarea className={`${textareaClass} h-48`} placeholder="Paste the full text of the research paper..." value={form.text} onChange={e => set('text', e.target.value)} /></div>
              )}

              {active === 'citation' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.source')}</label>
                  <textarea className={`${textareaClass} h-24`} placeholder="Author, title, year, publisher, URL..." value={form.source} onChange={e => set('source', e.target.value)} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.style')}</label>
                  <Select value={form.style} onChange={v => set('style', v)} options={CITATION_STYLES.map(s => ({ value: s, label: s }))} /></div>
              </>}

              {active === 'coding' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.language')}</label>
                  <Select value={form.language} onChange={v => set('language', v)} options={LANGUAGES.map(l => ({ value: l, label: l }))} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.difficulty')}</label>
                  <Select value={form.codeLevel} onChange={v => set('codeLevel', v)} options={CODE_LEVELS.map(l => ({ value: l, label: l }))} /></div>
              </>}

              {active === 'flashcard' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.subject')}</label>
                  <Select value={form.flashcardSubject} onChange={v => set('flashcardSubject', v)} options={SUBJECTS.map(s => ({ value: s, label: s }))} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.notes')}</label>
                  <textarea className={`${textareaClass} h-28`} placeholder="Enter the topic or paste your notes..." value={form.flashcardNotes} onChange={e => set('flashcardNotes', e.target.value)} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.cards')}</label>
                  <Select value={form.flashcardCount} onChange={v => set('flashcardCount', v)} options={FLASHCARD_COUNTS.map(c => ({ value: c, label: c }))} /></div>
              </>}

              {active === 'quiz' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.subject')}</label>
                  <Select value={form.quizSubject} onChange={v => set('quizSubject', v)} options={SUBJECTS.map(s => ({ value: s, label: s }))} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.quizTopic')}</label>
                  <input className={inputClass} placeholder="e.g. World War II, Organic Chemistry" value={form.quizTopic} onChange={e => set('quizTopic', e.target.value)} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.difficulty')}</label>
                  <Select value={form.quizDifficulty} onChange={v => set('quizDifficulty', v)} options={QUIZ_DIFFICULTIES.map(d => ({ value: d, label: d }))} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.questions')}</label>
                  <Select value={form.quizCount} onChange={v => set('quizCount', v)} options={QUIZ_COUNTS.map(c => ({ value: c, label: c }))} /></div>
              </>}

              {active === 'notes' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.subject')}</label>
                  <Select value={form.notesSubject} onChange={v => set('notesSubject', v)} options={SUBJECTS.map(s => ({ value: s, label: s }))} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">Topics / Key Concepts</label>
                  <textarea className={`${textareaClass} h-28`} placeholder="Enter topics or key concepts to compile into notes..." value={form.notesTopics} onChange={e => set('notesTopics', e.target.value)} /></div>
                <div><label className="text-xs text-[#737373] block mb-1.5">Note Style</label>
                  <Select value={form.notesStyle} onChange={v => set('notesStyle', v)} options={NOTE_STYLES.map(s => ({ value: s, label: s }))} /></div>
              </>}

              {active === 'pomodoro' && <>
                <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.mode')}</label>
                  <div className="flex flex-wrap gap-2">
                    {POMODORO_MODES.map(m => (
                      <button key={m.value} type="button" onClick={() => set('pomodoroMode', m.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          form.pomodoroMode === m.value
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-[#0a0a0a] border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a]'
                        }`}>
                        {t(m.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
                {form.pomodoroMode === 'custom' && (
                  <div><label className="text-xs text-[#737373] block mb-1.5">{t('study.label.minutes')}</label>
                    <input type="number" min="1" max="120" className={inputClass} placeholder="25" value={form.pomodoroMinutes} onChange={e => set('pomodoroMinutes', parseInt(e.target.value) || 25)} /></div>
                )}
              </>}
            </div>

            {validationError && <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400">{validationError}</div>}

            {active !== 'pomodoro' && (
              <button onClick={run} disabled={loading}
                className="mt-5 w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press">
                {loading ? <><IconSpinner size={14} /> {t('common.loading')}</> : `${t('study.generate')} ${t(meta.labelKey)}`}
              </button>
            )}
          </div>

          {/* Output */}
          <div className="bg-[#141414] rounded-xl p-6 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="font-semibold text-sm">
                {active === 'pomodoro' ? t('study.timer') : active === 'quiz' && quizQuestions.length > 0 ? 'Quiz' : t('study.output')}
              </h2>
              {result && active !== 'pomodoro' && !(active === 'quiz' && quizQuestions.length > 0) && (
                <button onClick={copy} className="flex items-center gap-1 text-xs text-[#737373] hover:text-white transition-colors">
                  {copied ? <><IconCheck size={11} className="text-emerald-400" /> {t('common.copied')}</> : <><IconCopy size={11} /> {t('common.copy')}</>}
                </button>
              )}
            </div>

            {/* Pomodoro Timer Display */}
            {active === 'pomodoro' ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="relative mb-6">
                  <svg width="220" height="220">
                    {/* Background circle */}
                    <circle cx="110" cy="110" r={radius} fill="none" stroke="#1a1a1a" strokeWidth="8" />
                    {/* Progress circle */}
                    <circle cx="110" cy="110" r={radius} fill="none"
                      stroke={timerDone ? '#22c55e' : '#dc2626'}
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashoffset}
                      strokeLinecap="round"
                      transform="rotate(-90 110 110)"
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-semibold text-white tracking-wider">{formatTime(timeLeft)}</span>
                    <span className="text-xs text-[#525252] mt-1.5">
                      {form.pomodoroMode === 'pomodoro' ? t('study.pomodoro.focus') : form.pomodoroMode === 'short' ? t('study.pomodoro.short_break') : form.pomodoroMode === 'long' ? t('study.pomodoro.long_break') : t('study.pomodoro.custom')}
                    </span>
                  </div>
                </div>

                {timerDone && (
                  <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-4 py-2.5 text-xs text-emerald-400 mb-4">
                    {t('study.pomodoro.done')}
                  </div>
                )}

                <div className="text-sm text-[#525252] mb-6">
                  {t('study.pomodoro.sessions')} <span className="text-white font-semibold">{sessionCount}</span>
                </div>

                <div className="flex gap-3">
                  <button onClick={startPomodoro}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                    {isRunning ? t('study.pomodoro.pause') : timeLeft === pomodoroTotal ? t('study.pomodoro.start') : t('study.pomodoro.resume')}
                  </button>
                  <button onClick={resetPomodoro}
                    className="bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-[#a3a3a3] hover:text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                    {t('study.pomodoro.reset')}
                  </button>
                </div>
              </div>
            ) : active === 'quiz' && quizQuestions.length > 0 ? (
              /* Interactive Quiz */
              <div className="flex-1 overflow-auto overscroll-behavior-contain space-y-4 max-h-[600px]">
                {quizChecked && (
                  <div className="bg-[#1a1a1a] rounded-xl p-4 text-center shrink-0">
                    <span className="text-lg font-bold text-white">{t('study.quiz.score')} {quizScore}/{quizQuestions.length}</span>
                    <span className="text-[#737373] ml-2">({quizQuestions.length > 0 ? Math.round((quizScore / quizQuestions.length) * 100) : 0}%)</span>
                  </div>
                )}
                {quizQuestions.map((q, qi) => (
                  <div key={qi} className="bg-[#1a1a1a] rounded-xl p-4">
                    <p className="text-sm font-medium text-white mb-3">Q{q.number}: {q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const letter = String.fromCharCode(65 + oi)
                        const isSelected = quizAnswers[qi] === oi
                        const isCorrect = q.answer === oi
                        let optClass = "w-full text-left px-3 py-2 rounded-lg text-sm border transition-all "
                        if (quizChecked) {
                          if (isCorrect) optClass += "bg-emerald-950/30 border-emerald-700/40 text-emerald-300"
                          else if (isSelected && !isCorrect) optClass += "bg-red-950/30 border-red-700/40 text-red-300"
                          else optClass += "bg-[#0a0a0a] border-[#262626] text-[#737373]"
                        } else {
                          optClass += isSelected
                            ? "bg-red-950/30 border-red-600/40 text-red-300"
                            : "bg-[#0a0a0a] border-[#262626] text-[#a3a3a3] hover:border-[#3a3a3a] hover:text-white"
                        }
                        return (
                          <button key={oi} className={optClass}
                            onClick={() => !quizChecked && setQuizAnswers(p => ({ ...p, [qi]: oi }))}>
                            {letter}) {opt}
                          </button>
                        )
                      })}
                    </div>
                    {quizChecked && q.explanation && (
                      <p className="mt-3 text-xs text-[#737373] bg-[#0a0a0a] rounded-lg p-3">{q.explanation}</p>
                    )}
                  </div>
                ))}
                {!quizChecked && (
                  <button onClick={() => setQuizChecked(true)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                    {t('study.quiz.check')}
                  </button>
                )}
                {quizChecked && (
                  <button onClick={() => { setQuizAnswers({}); setQuizChecked(false) }}
                    className="w-full bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-[#a3a3a3] hover:text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                    {t('study.quiz.retake')}
                  </button>
                )}
              </div>
            ) : result ? (
              <MarkdownRenderer content={result} className="flex-1 overflow-auto overscroll-behavior-contain" />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-3">
                    <meta.Icon size={18} className="text-[#2e2e2e]" />
                  </div>
                  <p className="text-[#404040] text-sm">{loading ? t('common.loading') : active === 'pomodoro' ? 'Configure and start your focus session' : t('study.empty_hint')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
