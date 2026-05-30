'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const BuildClient = dynamic(() => import('./BuildClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-[#737373]">Loading Build Studio...</p>
      </div>
    </div>
  ),
})

export default function BuildPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[#737373]">Loading Build Studio...</p>
        </div>
      </div>
    }>
      <BuildClient />
    </Suspense>
  )
}
