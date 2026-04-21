'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabasePublic } from '@/lib/supabase'
import { IconSpinner, IconArrowLeft, IconCheck } from '@/components/Icons'

function AuthForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit() {
    if (!email || !password) { setError('Email and password are required'); return }
    if (mode === 'signup' && password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabasePublic.auth.signUp({
          email, password,
          options: { data: { full_name: name } }
        })
        if (error) throw error
        if (data.user && !data.user.email_confirmed_at) {
          setSuccess('Account created! Check your email to confirm, then sign in.')
        } else {
          router.push('/onboarding')
        }
      } else {
        const { error } = await supabasePublic.auth.signInWithPassword({ email, password })
        if (error) throw error
        const { data: { user } } = await supabasePublic.auth.getUser()
        const { data: profile } = await supabasePublic.from('profiles').select('onboarding_done').eq('id', user.id).single()
        router.push(profile?.onboarding_done ? '/dashboard' : '/onboarding')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    }
    setLoading(false)
  }

  const inputClass = "w-full bg-[#0d0d0d] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-[#404040] transition-colors"

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/welcome" className="flex items-center gap-1.5 text-[#737373] hover:text-white text-xs mb-8 transition-colors group">
          <IconArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to home
        </Link>

        <div className="text-center mb-8">
          <Link href="/welcome" className="inline-flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white"/></svg>
            </div>
            <span className="font-bold text-base">Ki<span className="text-red-500">vora</span></span>
          </Link>
          <h1 className="font-bold text-xl tracking-tight">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-[#737373] text-xs mt-1.5">
            {mode === 'signin' ? 'Sign in to access your saved results' : 'Free forever. No credit card required.'}
          </p>
        </div>

        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="text-xs text-[#737373] block mb-1.5 font-medium">Full name</label>
              <input type="text" className={inputClass} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-xs text-[#737373] block mb-1.5 font-medium">Email address</label>
            <input type="email" className={inputClass} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#737373] font-medium">Password</label>
              {mode === 'signin' && <Link href="/auth/reset" className="text-xs text-[#737373] hover:text-white transition-colors">Forgot?</Link>}
            </div>
            <input type="password" className={inputClass} placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {error && <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400">{error}</div>}
          {success && (
            <div className="bg-green-950/30 border border-green-900/40 rounded-xl px-4 py-2.5 text-xs text-green-400 flex items-start gap-2">
              <IconCheck size={12} className="shrink-0 mt-0.5" /> {success}
            </div>
          )}

          <button onClick={submit} disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press">
            {loading && <IconSpinner size={14} />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          {mode === 'signup' && (
            <p className="text-xs text-[#404040] text-center leading-relaxed">
              By signing up you agree to our{' '}
              <Link href="/terms" className="text-[#737373] hover:text-white">Terms</Link> and{' '}
              <Link href="/privacy" className="text-[#737373] hover:text-white">Privacy Policy</Link>.
            </p>
          )}
        </div>

        <div className="text-center mt-5">
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess('') }}
            className="text-xs text-[#737373] hover:text-white transition-colors">
            {mode === 'signin' ? "No account yet? Sign up free →" : 'Already have an account? Sign in →'}
          </button>
        </div>
        <p className="text-center text-xs text-[#2e2e2e] mt-4">
          All tools work without an account.{' '}
          <Link href="/" className="text-[#404040] hover:text-white transition-colors">Skip →</Link>
        </p>
      </div>
    </main>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-5 h-5 border border-[#262626] border-t-red-500 rounded-full animate-spin" /></div>}>
      <AuthForm />
    </Suspense>
  )
}
