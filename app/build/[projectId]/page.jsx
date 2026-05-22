'use client'

// Required for CloudFlare Pages edge runtime
export const runtime = 'edge'

import dynamic from 'next/dynamic'

const BuildRoomClient = dynamic(() => import('./BuildRoomClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-[#737373]">Loading Build Room...</p>
      </div>
    </div>
  ),
})

export default function BuildRoomPage() {
  return <BuildRoomClient />
}
