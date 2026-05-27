'use client'
import Link from 'next/link'
import {
  IconMoney, IconCode, IconChat, IconBook, IconGlobe, IconSearch, IconTool
} from '@/components/Icons'
import { useTranslation } from '@/components/LanguageProvider'

export default function ToolsPage() {
  const { t } = useTranslation()

  const FEATURES = [
    { Icon: IconSearch, title: t('welcome.features.opportunity'), desc: t('welcome.features.opportunity.desc') },
    { Icon: IconChat, title: t('welcome.features.chat'), desc: t('welcome.features.chat.desc') },
    { Icon: IconBook, title: t('welcome.features.studydesk'), desc: t('welcome.features.studydesk.desc') },
    { Icon: IconCode, title: t('welcome.features.devtools'), desc: t('welcome.features.devtools.desc') },
    { Icon: IconGlobe, title: t('welcome.features.global'), desc: t('welcome.features.global.desc') },
    { Icon: IconMoney, title: t('welcome.features.income'), desc: t('welcome.features.income.desc') },
  ]

  const STEPS = [
    { n: '01', title: t('welcome.how.step1.title'), desc: t('welcome.how.step1.desc') },
    { n: '02', title: t('welcome.how.step2.title'), desc: t('welcome.how.step2.desc') },
    { n: '03', title: t('welcome.how.step3.title'), desc: t('welcome.how.step3.desc') },
  ]

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-14">

        {/* Header */}
        <div className="mb-14 animate-fade-up">
          <p className="text-caption text-muted font-medium mb-3 flex items-center gap-1.5">
            <IconTool size={12} /> Tools & Features
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4 leading-tight">
            Everything built for<br />
            <span className="text-red-500">builders</span> everywhere.
          </h1>
          <p className="text-muted text-base leading-relaxed max-w-xl">
            Kivora brings together AI chat, code execution, income discovery, and learning tools — all in one platform.
          </p>
        </div>

        {/* How It Works */}
        <div className="mb-14">
          <h2 className="font-semibold text-lg tracking-tight mb-6">{t('welcome.how.title')}</h2>
          <div className="space-y-3">
            {STEPS.map(step => (
              <div key={step.n} className="flex gap-4 bg-[#141414] rounded-xl p-5">
                <span className="text-red-500 font-mono text-sm font-bold shrink-0 mt-0.5 w-6">{step.n}</span>
                <div>
                  <h3 className="font-semibold text-sm mb-1.5 tracking-tight text-muted">{step.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tools & Features */}
        <div className="mb-14">
          <h2 className="font-semibold text-lg tracking-tight mb-6">{t('welcome.features.title')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="bg-[#141414] rounded-xl p-5 transition-colors group">
                <div className="w-9 h-9 bg-[#1a1a1a] rounded-xl flex items-center justify-center mb-4 group-hover:bg-red-950/20 transition-colors">
                  <Icon size={16} className="text-muted group-hover:text-red-400 transition-colors" />
                </div>
                <h3 className="font-semibold text-sm mb-2 tracking-tight text-muted">{title}</h3>
                <p className="text-muted text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-[#141414] rounded-xl p-5 sm:p-8 text-center">
          <h3 className="font-semibold text-xl tracking-tight mb-2 text-muted">Ready to get started?</h3>
          <p className="text-muted text-sm mb-6">Access all tools for free. No credit card required.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/auth?mode=signup" className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Create free account
            </Link>
            <Link href="/chat" className="bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-white px-5 py-2.5 rounded-xl text-sm transition-colors">
              Try AI Chat
            </Link>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-[#141414] flex flex-wrap gap-4 text-xs text-muted">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
        </div>
      </div>
    </main>
  )
}
