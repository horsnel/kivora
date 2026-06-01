'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabasePublic } from '@/lib/supabase'
import { IconSpinner, IconCheck } from '@/components/Icons'
import { useTranslation } from '@/components/LanguageProvider'

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}



function AuthForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { t } = useTranslation()
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit() {
    if (!email || !password) { setError(t('auth.error.required')); return }
    if (mode === 'signup' && password.length < 8) { setError(t('auth.error.password_min')); return }
    if (!supabasePublic) { setError('Authentication is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabasePublic.auth.signUp({
          email, password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
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

  async function signInWith(provider) {
    if (!supabasePublic) { setError('Authentication is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'); return }
    setOauthLoading(provider); setError('')
    try {
      const { error } = await supabasePublic.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` }
      })
      if (error) throw error
    } catch (err) {
      setError(err.message || 'Something went wrong')
      setOauthLoading('')
    }
  }

  const inputClass = "w-full bg-[#0d0d0d] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-[#404040] transition-all duration-200 focus:outline-none"

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* ── Success state: full card replacement ── */}
        {success ? (
          <div className="text-center animate-scale-in">
            <div className="w-14 h-14 bg-emerald-950/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <IconCheck size={24} className="text-emerald-400" />
            </div>
            <h1 className="font-semibold text-xl tracking-tight mb-2">{t('auth.check_email')}</h1>
            <p className="text-muted text-sm mb-1">{t('auth.confirmation_sent')}</p>
            <p className="text-white text-sm font-medium mb-6">{email}</p>
            <p className="text-muted2 text-xs leading-relaxed mb-8">
              {t('auth.verify_instruction')}
            </p>
            <button
              onClick={() => { setSuccess(''); setMode('signin') }}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors press"
            >
              {t('auth.signin')}
            </button>
            <p className="text-[#2e2e2e] text-[10px] mt-4">Didn't get the email? Check your spam folder.</p>
          </div>
        ) : (
        <>
        {/* Logo + Back to home on same line */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/research" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-[#dc2626] rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none"><path d="M16 4L6 24L16 18Z" fill="white" opacity="0.95"/><path d="M16 4L26 24L16 18Z" fill="white" opacity="0.55"/><rect x="6" y="26" width="20" height="3" rx="1.5" fill="white" opacity="0.3"/></svg>
            </div>
            <span className="font-bold text-base">Ki<span className="text-red-500">vora</span></span>
          </Link>
          {mode === 'signin' && (
            <Link href="/research" className="text-muted hover:text-white text-xs transition-colors">
              {t('auth.back_home')}
            </Link>
          )}
        </div>

        <div className="mb-8">
          <h1 className="font-semibold text-xl tracking-tight">
            {mode === 'signin' ? t('auth.welcome_back') : t('auth.create_account')}
          </h1>
          <p className="text-muted text-xs mt-1.5">
            {mode === 'signin' ? t('auth.signin_subtitle') : t('auth.signup_subtitle')}
          </p>
        </div>

        <div className="bg-[#141414] rounded-xl p-6 space-y-4">
          {/* OAuth buttons */}
          <button
            onClick={() => signInWith('google')}
            disabled={!!oauthLoading}
            className="w-full flex items-center justify-center gap-2 bg-[#0d0d0d] border border-[#262626] hover:border-[#3a3a3a] py-2.5 rounded-xl text-xs text-[#d4d4d4] font-medium transition-colors disabled:opacity-50"
          >
            {oauthLoading === 'google' ? <IconSpinner size={14} /> : <GoogleIcon />}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#262626]"></div>
            <span className="text-[10px] text-muted2 uppercase tracking-widest">{t('auth.or')}</span>
            <div className="flex-1 h-px bg-[#262626]"></div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="text-xs text-muted block mb-1.5 font-medium">{t('auth.full_name')}</label>
              <input type="text" className={inputClass} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-xs text-muted block mb-1.5 font-medium">{t('auth.email')}</label>
            <input type="email" className={inputClass} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-muted font-medium">{t('auth.password')}</label>
              {mode === 'signin' && <Link href="/auth/reset" className="text-xs text-muted hover:text-white transition-colors">{t('auth.forgot')}</Link>}
            </div>
            <input type="password" className={inputClass} placeholder={mode === 'signup' ? t('auth.password_min') : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {error && <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400">{error}</div>}

          <button onClick={submit} disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press">
            {loading && <IconSpinner size={14} />}
            {mode === 'signin' ? t('auth.signin') : t('auth.create')}
          </button>

          {mode === 'signup' && (
            <p className="text-xs text-muted2 text-center leading-relaxed">
              {t('auth.agreement')}
            </p>
          )}
        </div>

        <div className="text-center mt-5">
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess('') }}
            className="text-xs text-muted hover:text-white transition-colors">
            {mode === 'signin' ? t('auth.no_account') : t('auth.has_account')}
          </button>
        </div>
        <p className="text-center text-xs text-[#2e2e2e] mt-4">
          {t('auth.no_account_needed')}{' '}
          <Link href="/research" className="text-muted2 hover:text-white transition-colors">{t('auth.skip')}</Link>
        </p>
        </>
        )}
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
