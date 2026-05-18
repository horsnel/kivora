'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'
import { IconCheck, IconArrowRight, IconSpinner } from '@/components/Icons'
import { useTranslation } from '@/components/LanguageProvider'

const STEPS = [
  {
    id: 'goal',
    type: 'single',
    options: [
      { value: 'make_money' },
      { value: 'learn' },
      { value: 'build' },
      { value: 'automate' },
      { value: 'research' },
    ],
  },
  {
    id: 'experience',
    type: 'single',
    options: [
      { value: 'beginner' },
      { value: 'intermediate' },
      { value: 'advanced' },
      { value: 'professional' },
    ],
  },
  {
    id: 'location',
    type: 'single',
    options: [
      { value: 'nigeria' },
      { value: 'ghana' },
      { value: 'kenya' },
      { value: 'south_africa' },
      { value: 'uk' },
      { value: 'usa' },
      { value: 'canada' },
      { value: 'other_africa' },
      { value: 'other' },
    ],
  },
  {
    id: 'interests',
    type: 'multi',
    options: [
      { value: 'youtube_automation' },
      { value: 'content_agency' },
      { value: 'ecommerce' },
      { value: 'saas' },
      { value: 'affiliate' },
      { value: 'freelancing' },
      { value: 'coding' },
      { value: 'finance' },
      { value: 'education' },
      { value: 'automation' },
    ],
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { t } = useTranslation()
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

  function getOptLabel(opt) {
    return t(`onboarding.step.${current.id}.option.${opt.value}.label`)
  }

  function getOptDesc(opt) {
    return t(`onboarding.step.${current.id}.option.${opt.value}.desc`)
  }

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
          <span className="text-xs text-[#737373]">{t('onboarding.step_of', { current: step + 1, total: STEPS.length })}</span>
          <button onClick={skip} className="text-xs text-[#404040] hover:text-[#737373] transition-colors">{t('onboarding.skip')}</button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[#141414] rounded-full mb-8 overflow-hidden">
          <div className="h-full bg-red-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Question */}
        <div className="animate-fade-up" key={step}>
          <h1 className="text-2xl font-semibold tracking-tight mb-1.5">{t(`onboarding.step.${current.id}.question`)}</h1>
          <p className="text-[#737373] text-sm mb-7">{t(`onboarding.step.${current.id}.subtitle`)}</p>

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
                    <div className="font-medium text-sm">{getOptLabel(opt)}</div>
                    {getOptDesc(opt) !== `onboarding.step.${current.id}.option.${opt.value}.desc` && <div className="text-xs mt-0.5 opacity-70">{getOptDesc(opt)}</div>}
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
            {saving ? t('onboarding.setting_up') : step < STEPS.length - 1 ? <>{t('onboarding.continue')} <IconArrowRight size={13} /></> : <>{t('onboarding.finish')} <IconArrowRight size={13} /></>}
          </button>
        </div>
      </div>
    </main>
  )
}
