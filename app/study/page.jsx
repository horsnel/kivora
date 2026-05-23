'use client'
import dynamic from 'next/dynamic'

const StudyClient = dynamic(() => import('./StudyClient'), {
  loading: () => (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="skeleton w-36 h-8 rounded mb-2" />
          <div className="skeleton w-64 h-3 rounded" />
        </div>
        <div className="flex flex-wrap gap-2 mb-7">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton w-32 h-9 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="skeleton rounded-xl p-6 h-80" />
          <div className="skeleton rounded-xl p-6 min-h-[400px]" />
        </div>
      </div>
    </main>
  ),
})

export default function StudyPage() {
  return <StudyClient />
}
