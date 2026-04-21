'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'
import { IconCheck, IconSpinner } from '@/components/Icons'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  async function submit() {
    if (!password || password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setStatus('loading')
    setError('')
    try {
      const { error } = await supabasePublic.auth.updateUser({ password })
      if (error) throw error
      setStatus('success')
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (err) {
      setError(err.message || 'Something went wrong')
      setStatus('idle')
    }
  }

  const inputClass = "w-full bg-[#0d0d0d] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-[#404040] transition-colors focus:border-red-500 focus:outline-none"

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white" />
            </svg>
          </div>
          <h1 className="font-bold text-xl tracking-tight">Set new password</h1>
          <p className="text-[#737373] text-xs mt-1.5">Choose a strong password for your account.</p>
        </div>

        {status === 'success' ? (
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 text-center">
            <div className="w-10 h-10 bg-green-950/30 border border-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconCheck size={16} className="text-green-400" />
            </div>
            <h3 className="font-semibold text-sm mb-1">Password updated</h3>
            <p className="text-xs text-[#737373]">Redirecting you to your dashboard...</p>
          </div>
        ) : (
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-xs text-[#737373] block mb-1.5 font-medium">New password</label>
              <input type="password" className={inputClass} placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-[#737373] block mb-1.5 font-medium">Confirm password</label>
              <input type="password" className={inputClass} placeholder="Same as above" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
            </div>

            {error && (
              <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400">{error}</div>
            )}

            <button
              onClick={submit}
              disabled={!password || !confirm || status === 'loading'}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press"
            >
              {status === 'loading' && <IconSpinner size={14} />}
              Update password
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
