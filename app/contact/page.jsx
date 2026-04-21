'use client'
import { useState } from 'react'
import Link from 'next/link'
import { IconArrowLeft, IconCheck, IconSpinner } from '@/components/Icons'

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

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit() {
    if (!form.email || !form.message) return
    setStatus('loading')
    // In production: wire to a form service like Formspree, Resend, or your own API route
    // Simulating success for now
    await new Promise(r => setTimeout(r, 1200))
    setStatus('success')
  }

  const inputClass = "w-full bg-[#0d0d0d] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-[#404040] transition-colors focus:border-red-500 focus:outline-none"

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="mb-10">
          <Link href="/welcome" className="flex items-center gap-1.5 text-[#737373] hover:text-white text-xs transition-colors group">
            <IconArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to home
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Left */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-4">Get in touch</h1>
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
                  <div className="w-8 h-8 bg-[#141414] border border-[#262626] rounded-lg flex items-center justify-center shrink-0">
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
              <div className="bg-[#141414] border border-[#262626] rounded-2xl p-8 text-center h-full flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-green-950/30 border border-green-900/40 rounded-full flex items-center justify-center mb-4">
                  <IconCheck size={20} className="text-green-400" />
                </div>
                <h3 className="font-semibold text-base mb-2">Message sent</h3>
                <p className="text-[#737373] text-sm">Thanks for reaching out. We'll get back to you soon.</p>
                <button onClick={() => { setStatus('idle'); setForm({ name: '', email: '', subject: 'General question', message: '' }) }}
                  className="mt-6 text-xs text-[#737373] hover:text-white transition-colors">
                  Send another message
                </button>
              </div>
            ) : (
              <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4">
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5 font-medium">Name</label>
                  <input type="text" className={inputClass} placeholder="Your name" value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5 font-medium">Email <span className="text-red-500">*</span></label>
                  <input type="email" className={inputClass} placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5 font-medium">Subject</label>
                  <select className={inputClass} value={form.subject} onChange={e => set('subject', e.target.value)}>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1.5 font-medium">Message <span className="text-red-500">*</span></label>
                  <textarea className={`${inputClass} h-32 resize-none leading-relaxed`} placeholder="What can we help you with?" value={form.message} onChange={e => set('message', e.target.value)} />
                </div>
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
