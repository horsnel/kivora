'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import { IconEye, IconMaximize, IconMinimize } from '@/components/Icons'

const SCENES = [
  {
    id: 'moon',
    label: 'Moon',
    src: '/3d-scenes/moon.html',
    description: 'Interactive 3D Moon with procedural textures and NASA data',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
      </svg>
    ),
  },
  {
    id: 'deepspace',
    label: 'Deep Space',
    src: '/3d-scenes/deepspace.html',
    description: 'Nebula exploration with Hubble telescope imagery',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="12" r="6" strokeDasharray="2 3" />
        <circle cx="12" cy="12" r="10" strokeDasharray="1 4" />
      </svg>
    ),
  },
  {
    id: 'cube',
    label: 'Rubik\'s Cube',
    src: '/3d-scenes/cube.html',
    description: 'Interactive 3x3 Rubik\'s Cube with face rotation',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </svg>
    ),
  },
]

export default function ThreeDClient() {
  const { t } = useTranslation()
  const [activeScene, setActiveScene] = useState('moon')
  const [fullscreen, setFullscreen] = useState(false)
  const containerRef = useRef(null)
  const iframeRef = useRef(null)

  const currentScene = SCENES.find((s) => s.id === activeScene)

  const toggleFullscreen = useCallback(() => {
    if (!fullscreen && containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
      setFullscreen(true)
    } else if (document.exitFullscreen) {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }, [fullscreen])

  const handleFullscreenChange = useCallback(() => {
    setFullscreen(!!document.fullscreenElement)
  }, [])

  // Listen for fullscreen changes (e.g. user presses Escape)
  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [handleFullscreenChange])

  return (
    <div
      ref={containerRef}
      className={`bg-[#0a0a0a] text-white ${fullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'}`}
    >
      {/* Header bar */}
      <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]/95 backdrop-blur-md z-20 relative">
        <div className="max-w-full mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center">
              <IconEye size={14} className="text-white" />
            </div>
            <h1 className="font-bold text-sm tracking-tight">
              3D <span className="text-red-500">Viewer</span>
            </h1>
          </div>

          {/* Scene tabs */}
          <div className="hidden sm:flex items-center gap-1 bg-[#111111] rounded-lg p-0.5 border border-[#1a1a1a]">
            {SCENES.map((scene) => (
              <button
                key={scene.id}
                onClick={() => setActiveScene(scene.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  activeScene === scene.id
                    ? 'bg-[#dc2626] text-white shadow-sm'
                    : 'text-[#737373] hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                {scene.icon}
                {scene.label}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 bg-[#111111] border border-[#1a1a1a] hover:border-[#2a2a2a] text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              {fullscreen ? <IconMinimize size={12} /> : <IconMaximize size={12} />}
              {fullscreen ? 'Exit' : 'Fullscreen'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile scene selector */}
      <div className="sm:hidden border-b border-[#1a1a1a] bg-[#0d0d0d] p-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {SCENES.map((scene) => (
            <button
              key={scene.id}
              onClick={() => setActiveScene(scene.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                activeScene === scene.id
                  ? 'bg-[#dc2626] text-white'
                  : 'bg-[#111111] text-[#737373] hover:text-white border border-[#1a1a1a]'
              }`}
            >
              {scene.icon}
              {scene.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3D iframe container */}
      <div className={`${fullscreen ? 'h-[calc(100vh-48px)]' : 'h-[calc(100vh-96px)] sm:h-[calc(100vh-48px)]'} relative bg-black`}>
        <iframe
          ref={iframeRef}
          key={activeScene}
          src={currentScene.src}
          className="w-full h-full border-0"
          allow="fullscreen"
          title={`${currentScene.label} 3D Viewer`}
          loading="lazy"
        />

        {/* Scene info overlay — bottom left */}
        <div className="absolute bottom-3 left-3 bg-[#0a0a0a]/70 backdrop-blur-md border border-[#1a1a1a] rounded-lg px-3 py-2 pointer-events-none max-w-[260px]">
          <p className="text-[11px] font-semibold text-white/80 mb-0.5">{currentScene.label}</p>
          <p className="text-[10px] text-[#737373] leading-relaxed">{currentScene.description}</p>
        </div>

        {/* Loading indicator */}
        <div className="absolute top-3 right-3 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-[#0a0a0a]/70 backdrop-blur-md border border-[#1a1a1a] rounded-full px-2.5 py-1">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-[#525252]">WebGL</span>
          </div>
        </div>
      </div>
    </div>
  )
}