'use client'
import { useState } from 'react'
import { IconCheck, IconSpinner } from '@/components/Icons'
import Select from '@/components/Select'

const SUBJECTS = [
  'General question',
  'Bug report',
  'Feature request',
  'Partnership',
  'Press inquiry',
  'Privacy or legal',
  'Other',
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: 'General question', message: '' })
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    if (touched[k]) validateField(k, v)
  }

  function handleBlur(k, value) {
    setTouched(p => ({ ...p, [k]: true }))
    validateField(k, value)
  }

  function validateField(k, v) {
    setErrors(prev => {
      const next = { ...prev }
      if (k === 'email') {
        if (!v?.trim()) next.email = 'Email is required'
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) next.email = 'Enter a valid email address'
        else delete next.email
      }
      if (k === 'message') {
        if (!v?.trim()) next.message = 'Message is required'
        else if (v.trim().length < 10) next.message = 'Message must be at least 10 characters'
        else delete next.message
      }
      return next
    })
  }

  function hasErrors() {
    const e = {}
    if (!form.email?.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address'
    if (!form.message?.trim()) e.message = 'Message is required'
    else if (form.message.trim().length < 10) e.message = 'Message must be at least 10 characters'
    setErrors(e)
    setTouched({ email: true, message: true })
    return Object.keys(e).length > 0
  }

  async function submit() {
    if (hasErrors()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        if (data.error) setErrors({ form: data.error })
        return
      }
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  const inputClass = "w-full bg-[#0d0d0d] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-[#404040] transition-all duration-200 focus:border-red-500 focus:outline-none focus:shadow-[0_0_0_2px_rgba(220,38,38,0.15),0_0_16px_rgba(220,38,38,0.06)]"
  const errorInputClass = "w-full bg-[#0d0d0d] border border-red-900/60 rounded-xl px-4 py-3 text-sm text-white placeholder-[#404040] transition-all duration-200 focus:border-red-500 focus:outline-none focus:shadow-[0_0_0_2px_rgba(220,38,38,0.15),0_0_16px_rgba(220,38,38,0.06)]"

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Left */}
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-4">Get in touch</h1>
            <p className="text-[#737373] text-sm leading-relaxed mb-8">
              Have a question, found a bug, or want to work together? We read every message.
            </p>

            <div className="space-y-5">
              {[
                { label: 'General',    email: 'hello@kivora.com',   desc: 'Questions and feedback' },
                { label: 'Privacy',    email: 'privacy@kivora.com', desc: 'Data and privacy requests' },
                { label: 'Legal',      email: 'legal@kivora.com',   desc: 'Terms and legal matters' },
                { label: 'Press',      email: 'press@kivora.com',   desc: 'Media and press inquiries' },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-[#141414] rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono text-[#404040]">{c.label[0]}</span>
                  </div>
                  <div>
                    <a href={`mailto:${c.email}`} className="text-sm font-medium hover:text-red-400 transition-colors">{c.email}</a>
                    <p className="text-xs text-[#737373]">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 pt-8 border-t border-[#141414]">
              <p className="text-xs text-[#737373]">We typically respond within 1–2 business days.</p>
            </div>
          </div>

          {/* Right — Form */}
          <div>
            {status === 'success' ? (
              <div className="bg-[#141414] rounded-xl p-8 text-center h-full flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-emerald-950/30 border border-emerald-900/40 rounded-full flex items-center justify-center mb-4">
                  <IconCheck size={20} className="text-emerald-400" />
                </div>
                <h3 className="font-semibold text-base mb-2">Message sent</h3>
                <p className="text-[#737373] text-sm">Thanks for reaching out. We'll get back to you soon.</p>
                <button onClick={() => { setStatus('idle'); setForm({ name: '', email: '', subject: 'General question', message: '' }) }}
                  className="mt-6 text-xs text-[#737373] hover:text-white transition-colors">
                  Send another message
                </button>
              </div>
            ) : (
              <div className="bg-[#141414] rounded-xl p-6 space-y-4">
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5 font-medium">Name</label>
                  <input type="text" className={inputClass} placeholder="Your name" value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5 font-medium">Email <span className="text-red-500">*</span></label>
                  <input type="email" className={errors.email ? errorInputClass : inputClass} placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} onBlur={e => handleBlur('email', e.target.value)} />
                  {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5 font-medium">Subject</label>
                  <Select value={form.subject} onChange={v => set('subject', v)} options={SUBJECTS.map(s => ({ value: s, label: s }))} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5 font-medium">Message <span className="text-red-500">*</span></label>
                  <textarea className={`${errors.message ? errorInputClass : inputClass} h-32 resize-none leading-relaxed`} placeholder="What can we help you with?" value={form.message} onChange={e => set('message', e.target.value)} onBlur={e => handleBlur('message', e.target.value)} />
                  {errors.message && <p className="text-xs text-red-400 mt-1">{errors.message}</p>}
                </div>
                {errors.form && <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400">{errors.form}</div>}
                {status === 'error' && !errors.form && <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400">Something went wrong. Please try again.</div>}
                <button
                  onClick={submit}
                  disabled={!form.email || !form.message || status === 'loading'}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press"
                >
                  {status === 'loading' ? <><IconSpinner size={14} /> Sending...</> : 'Send message'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
