'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabasePublic } from '@/lib/supabase'
import { IconArrowLeft, IconCheck, IconSpinner } from '@/components/Icons'

export default function ResetPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [error, setError] = useState('')

  async function submit() {
    if (!email) return
    setStatus('loading')
    setError('')
    try {
      const { error } = await supabasePublic.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })
      if (error) throw error
      setStatus('success')
    } catch (err) {
      setError(err.message || 'Something went wrong')
      setStatus('error')
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link
          href="/auth"
          className="flex items-center gap-1.5 text-[#737373] hover:text-white text-xs mb-8 transition-colors group"
        >
          <IconArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to sign in
        </Link>

        <div className="text-center mb-8">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white" />
            </svg>
          </div>
          <h1 className="font-bold text-xl tracking-tight">Reset your password</h1>
          <p className="text-[#737373] text-xs mt-1.5">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {status === 'success' ? (
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 text-center">
            <div className="w-10 h-10 bg-green-950/30 border border-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconCheck size={16} className="text-green-400" />
            </div>
            <h3 className="font-semibold text-sm mb-2">Check your email</h3>
            <p className="text-xs text-[#737373] leading-relaxed">
              We sent a password reset link to <span className="text-white">{email}</span>.
              Check your inbox and spam folder.
            </p>
            <Link
              href="/auth"
              className="inline-block mt-5 text-xs text-red-500 hover:text-red-400 transition-colors"
            >
              Back to sign in →
            </Link>
          </div>
        ) : (
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-xs text-[#737373] block mb-1.5 font-medium">
                Email address
              </label>
              <input
                type="email"
                className="w-full bg-[#0d0d0d] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-[#404040] transition-colors focus:border-red-500 focus:outline-none"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>

            {error && (
              <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={!email || status === 'loading'}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press"
            >
              {status === 'loading' && <IconSpinner size={14} />}
              Send reset link
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
