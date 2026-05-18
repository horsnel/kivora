'use client'
import Link from 'next/link'
import { IconGlobe, IconCheck, IconMoney, IconCode } from '@/components/Icons'
import { useTranslation } from '@/components/LanguageProvider'

export default function AboutPage() {
  const { t } = useTranslation()

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-14">

        {/* Header */}
        <div className="mb-16 animate-fade-up">
          <h1 className="text-4xl font-semibold tracking-tight mb-5 leading-tight">
            {t('about.hero1')}
            <span className="text-red-500"> {t('about.hero2')}</span>
          </h1>
          <p className="text-[#737373] text-base leading-relaxed">
            {t('about.p1')}
          </p>
        </div>

        {/* Mission */}
        <div className="mb-14">
          <h2 className="font-semibold text-lg tracking-tight mb-4">{t('about.problem')}</h2>
          <div className="space-y-4 text-[#d4d4d4] text-sm leading-relaxed">
            <p>
              {t('about.problem_p1')}
            </p>
            <p>
              {t('about.problem_p2')}
            </p>
            <p>
              {t('about.problem_p3')}
            </p>
          </div>
        </div>

        {/* What we built */}
        <div className="mb-14">
          <h2 className="font-semibold text-lg tracking-tight mb-6">{t('about.what')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { Icon: IconMoney,  title: t('about.what.opportunity'),  desc: t('about.what.opportunity.desc') },
              { Icon: IconCode,   title: t('about.what.devtools'),     desc: t('about.what.devtools.desc') },
              { Icon: IconGlobe,  title: t('about.what.studydesk'),    desc: t('about.what.studydesk.desc') },
              { Icon: IconCheck,  title: t('about.what.chat'),         desc: t('about.what.chat.desc') },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="bg-[#141414] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                    <Icon size={14} className="text-red-400" />
                  </div>
                  <h3 className="font-semibold text-sm">{title}</h3>
                </div>
                <p className="text-xs text-[#737373] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Values */}
        <div className="mb-14">
          <h2 className="font-semibold text-lg tracking-tight mb-6">{t('about.stand')}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {[
              { title: t('about.value1'), desc: t('about.value1.desc') },
              { title: t('about.value2'), desc: t('about.value2.desc') },
              { title: t('about.value3'), desc: t('about.value3.desc') },
              { title: t('about.value4'), desc: t('about.value4.desc') },
            ].map(({ title, desc }) => (
              <div key={title} className="flex gap-4 bg-[#141414] rounded-xl px-5 py-4">
                <div className="w-5 h-5 bg-red-950/30 border border-red-900/30 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <IconCheck size={9} className="text-red-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm mb-1">{title}</div>
                  <div className="text-xs text-[#737373] leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-[#141414] rounded-xl p-8 text-center">
          <h3 className="font-semibold text-xl tracking-tight mb-2">{t('about.cta')}</h3>
          <p className="text-[#737373] text-sm mb-6">{t('about.cta_sub')}</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/blog" className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              {t('about.read_blog')}
            </Link>
            <Link href="/contact" className="bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-white px-5 py-2.5 rounded-xl text-sm transition-colors">
              {t('about.get_in_touch')}
            </Link>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-[#141414] flex flex-wrap gap-4 text-xs text-[#737373]">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
        </div>
      </div>
    </main>
  )
}
