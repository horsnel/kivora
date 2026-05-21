'use client'

import dynamic from 'next/dynamic'

// Lazy-load Three.js — only loads when user visits /3d
const ThreeDViewer = dynamic(() => import('./ThreeDClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-[#737373]">Loading 3D Viewer...</p>
      </div>
    </div>
  ),
})

export default function ThreeDPage() {
  return <ThreeDViewer />
}
