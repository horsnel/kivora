'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'
import { IconCheck, IconArrowRight, IconSpinner } from '@/components/Icons'

const STEPS = [
  {
    id: 'goal',
    question: 'What brings you to Kivora?',
    subtitle: 'We\'ll personalize your experience based on this.',
    type: 'single',
    options: [
      { value: 'make_money',  label: 'Make money with AI',       desc: 'Side hustles, automation businesses, income streams' },
      { value: 'learn',       label: 'Learn and study',          desc: 'Homework help, research, coding practice' },
      { value: 'build',       label: 'Build a product or SaaS',  desc: 'Dev tools, technical guides, API resources' },
      { value: 'automate',    label: 'Automate my business',     desc: 'Workflows, bots, system automation' },
      { value: 'research',    label: 'Research and explore',     desc: 'Market research, opportunities, trends' },
    ],
  },
  {
    id: 'experience',
    question: 'How would you describe your experience level?',
    subtitle: 'This helps us show you the right depth of content.',
    type: 'single',
    options: [
      { value: 'beginner',      label: 'Just getting started',   desc: 'I\'m new to AI and building online' },
      { value: 'intermediate',  label: 'Some experience',        desc: 'I\'ve tried a few things, want to go deeper' },
      { value: 'advanced',      label: 'Experienced builder',    desc: 'I build regularly and want advanced content' },
      { value: 'professional',  label: 'Working professional',   desc: 'I use AI tools in my day-to-day work' },
    ],
  },
  {
    id: 'location',
    question: 'Where are you building from?',
    subtitle: 'Helps us recommend tools that work in your region.',
    type: 'single',
    options: [
      { value: 'nigeria',      label: 'Nigeria' },
      { value: 'ghana',        label: 'Ghana' },
      { value: 'kenya',        label: 'Kenya' },
      { value: 'south_africa', label: 'South Africa' },
      { value: 'uk',           label: 'United Kingdom' },
      { value: 'usa',          label: 'United States' },
      { value: 'canada',       label: 'Canada' },
      { value: 'other_africa', label: 'Other African country' },
      { value: 'other',        label: 'Somewhere else' },
    ],
  },
  {
    id: 'interests',
    question: 'Which topics interest you most?',
    subtitle: 'Pick as many as you like.',
    type: 'multi',
    options: [
      { value: 'youtube_automation', label: 'YouTube Automation' },
      { value: 'content_agency',     label: 'Content Agency' },
      { value: 'ecommerce',          label: 'E-Commerce' },
      { value: 'saas',               label: 'SaaS & Micro-tools' },
      { value: 'affiliate',          label: 'Affiliate Marketing' },
      { value: 'freelancing',        label: 'AI Freelancing' },
      { value: 'coding',             label: 'Coding & Dev' },
      { value: 'finance',            label: 'Finance & Investing' },
      { value: 'education',          label: 'Education & Study' },
      { value: 'automation',         label: 'Business Automation' },
    ],
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabasePublic.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth')
      else setUser(user)
    })
  }, [])

  const current = STEPS[step]
  const selected = answers[current?.id]
  const isMulti = current?.type === 'multi'

  function toggle(value) {
    if (isMulti) {
      const prev = answers[current.id] || []
      const next = prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      setAnswers(p => ({ ...p, [current.id]: next }))
    } else {
      setAnswers(p => ({ ...p, [current.id]: value }))
    }
  }

  function isSelected(value) {
    if (isMulti) return (answers[current.id] || []).includes(value)
    return answers[current.id] === value
  }

  function canAdvance() {
    if (isMulti) return (answers[current.id] || []).length > 0
    return !!answers[current.id]
  }

  async function advance() {
    if (!canAdvance()) return
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      await finish()
    }
  }

  async function finish() {
    setSaving(true)
    try {
      await supabasePublic.from('profiles').update({
        onboarding_done: true,
        onboarding_goal: answers.goal,
        onboarding_experience: answers.experience,
        onboarding_location: answers.location,
        onboarding_interests: answers.interests || [],
      }).eq('id', user.id)
    } catch (_) {}
    router.push('/dashboard')
  }

  function skip() {
    router.push('/dashboard')
  }

  const progress = ((step + 1) / STEPS.length) * 100

  if (!user) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-5 h-5 border border-[#262626] border-t-red-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-600 rounded-md flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white"/></svg>
            </div>
            <span className="font-bold text-sm">Ki<span className="text-red-500">vora</span></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#737373]">{step + 1} of {STEPS.length}</span>
            <button onClick={skip} className="text-xs text-[#404040] hover:text-[#737373] transition-colors">Skip</button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[#141414] rounded-full mb-8 overflow-hidden">
          <div className="h-full bg-red-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Question */}
        <div className="animate-fade-up" key={step}>
          <h1 className="text-2xl font-bold tracking-tight mb-1.5">{current.question}</h1>
          <p className="text-[#737373] text-sm mb-7">{current.subtitle}</p>

          <div className={`grid gap-2 mb-8 ${isMulti ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {current.options.map(opt => (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={`text-left rounded-xl border px-4 py-3.5 transition-all ${
                  isSelected(opt.value)
                    ? 'bg-red-950/20 border-red-600 text-white'
                    : 'bg-[#141414] border-[#262626] text-[#737373] hover:border-[#3a3a3a] hover:text-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{opt.label}</div>
                    {opt.desc && <div className="text-xs mt-0.5 opacity-70">{opt.desc}</div>}
                  </div>
                  {isSelected(opt.value) && (
                    <div className="w-4 h-4 bg-red-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <IconCheck size={9} className="text-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={advance}
            disabled={!canAdvance() || saving}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press"
          >
            {saving ? <IconSpinner size={14} /> : null}
            {saving ? 'Setting up your account...' : step < STEPS.length - 1 ? <>Continue <IconArrowRight size={13} /></> : <>Finish setup <IconArrowRight size={13} /></>}
          </button>
        </div>
      </div>
    </main>
  )
}
