import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white"/></svg>
          </div>
          <span className="font-bold text-base">Ki<span className="text-red-500">vora</span></span>
        </div>

        {/* 404 */}
        <div className="text-[120px] font-bold leading-none tracking-tighter text-[#141414] mb-4 select-none">
          404
        </div>

        <h1 className="text-xl font-bold tracking-tight mb-3">Page not found</h1>
        <p className="text-[#737373] text-sm mb-8 leading-relaxed">
          This page doesn't exist or has been moved. Let's get you back somewhere useful.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            Go to explore →
          </Link>
          <Link href="/welcome" className="bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] text-white px-5 py-2.5 rounded-xl text-sm transition-colors">
            Back to home
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-[#404040]">
          <Link href="/chat" className="hover:text-white transition-colors">Chat</Link>
          <Link href="/study" className="hover:text-white transition-colors">StudyDesk</Link>
          <Link href="/devtools" className="hover:text-white transition-colors">Dev Tools</Link>
          <Link href="/opportunities" className="hover:text-white transition-colors">Opportunities</Link>
        </div>
      </div>
    </main>
  )
}
