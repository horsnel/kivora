'use client'
import Link from 'next/link'
import { useTranslation } from '@/components/LanguageProvider'

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none"><path d="M16 4L6 24L16 18Z" fill="white" opacity="0.95"/><path d="M16 4L26 24L16 18Z" fill="white" opacity="0.55"/><rect x="6" y="26" width="20" height="3" rx="1.5" fill="white" opacity="0.3"/></svg>
          </div>
          <span className="font-bold text-base">Ki<span className="text-red-500">vora</span></span>
        </div>

        {/* 404 */}
        <div className="text-[120px] font-bold leading-none tracking-tighter text-[#141414] mb-4 select-none">
          404
        </div>

        <h1 className="text-xl font-semibold tracking-tight mb-3">{t('notfound.title')}</h1>
        <p className="text-[#737373] text-sm mb-8 leading-relaxed">
          {t('notfound.description')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/home" className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            {t('notfound.explore')}
          </Link>
          <Link href="/" className="bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] text-white px-5 py-2.5 rounded-xl text-sm transition-colors">
            {t('notfound.home')}
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-[#404040]">
          <Link href="/chat" className="hover:text-white transition-colors">{t('notfound.chat')}</Link>
          <Link href="/study" className="hover:text-white transition-colors">{t('notfound.studydesk')}</Link>
          <Link href="/devtools" className="hover:text-white transition-colors">{t('notfound.devtools')}</Link>
          <Link href="/opportunities" className="hover:text-white transition-colors">{t('notfound.opportunities')}</Link>
        </div>
      </div>
    </main>
  )
}
