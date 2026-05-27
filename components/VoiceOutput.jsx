'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { IconSpeaker } from '@/components/Icons'

/* ═══════════════════════════════════════════════════════════════
   VoiceOutput — Speaker button for AI chat messages
   Click to hear AI response spoken aloud with animated waveform
   ═══════════════════════════════════════════════════════════════ */

// Waveform bars component
function WaveformBars({ active, size = 14 }) {
  const barCount = 3
  return (
    <div className="flex items-center gap-[2px]" style={{ height: size, width: size }}>
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: 2,
            height: '100%',
            background: active
              ? 'linear-gradient(180deg, #a855f7, #ef4444)'
              : 'currentColor',
            opacity: active ? 1 : 0.4,
            transform: active ? 'scaleY(0.5)' : 'scaleY(1)',
            animation: active ? `voiceBar${i} 0.6s ease-in-out infinite alternate` : 'none',
            transition: 'transform 0.2s ease, opacity 0.2s ease',
          }}
        />
      ))}
      <style>{`
        @keyframes voiceBar0 {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
        @keyframes voiceBar1 {
          0% { transform: scaleY(0.6); }
          100% { transform: scaleY(0.3); }
        }
        @keyframes voiceBar2 {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(0.8); }
        }
      `}</style>
    </div>
  )
}

export default function VoiceOutput({ text, className = '', onSpeak, onStop, isSpeaking: externalIsSpeaking }) {
  const [internalSpeaking, setInternalSpeaking] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const synthRef = useRef(null)
  const utteranceRef = useRef(null)

  const isSpeaking = externalIsSpeaking !== undefined ? externalIsSpeaking : internalSpeaking

  // Initialize browser speech
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [])

  const handleSpeak = useCallback(() => {
    if (!text?.trim()) return

    if (isSpeaking) {
      // Stop
      if (synthRef.current) {
        synthRef.current.cancel()
      }
      setInternalSpeaking(false)
      onStop?.()
      return
    }

    // Use external handler if provided
    if (onSpeak) {
      onSpeak(text)
      return
    }

    // Built-in browser TTS
    const synth = synthRef.current || window.speechSynthesis
    if (!synth) return

    synth.cancel() // Cancel any ongoing speech

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1

    // Try to find a good voice
    const voices = synth.getVoices()
    const enVoice = voices.find(v => v.lang.startsWith('en') && v.localService)
      || voices.find(v => v.lang.startsWith('en'))
    if (enVoice) utterance.voice = enVoice

    utterance.onstart = () => setInternalSpeaking(true)
    utterance.onend = () => setInternalSpeaking(false)
    utterance.onerror = () => setInternalSpeaking(false)

    utteranceRef.current = utterance
    synth.speak(utterance)
  }, [text, isSpeaking, onSpeak, onStop])

  // Stop when component unmounts
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [])

  return (
    <div className="relative inline-flex">
      <button
        onClick={handleSpeak}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`
          inline-flex items-center justify-center
          rounded-md transition-all duration-200
          ${isSpeaking
            ? 'text-white shadow-lg shadow-purple-500/20'
            : 'text-[var(--muted)] hover:text-[var(--text-2)] hover:bg-white/5'
          }
          ${className}
        `}
        style={{
          width: 28,
          height: 28,
          ...(isSpeaking ? {
            background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(239,68,68,0.2))',
            border: '1px solid rgba(168,85,247,0.3)',
          } : {}),
        }}
        aria-label={isSpeaking ? 'Stop listening' : 'Listen'}
        title={isSpeaking ? 'Stop listening' : 'Listen'}
      >
        {isSpeaking ? (
          <WaveformBars active size={14} />
        ) : (
          <IconSpeaker size={14} />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="
            absolute bottom-full left-1/2 -translate-x-1/2 mb-2
            px-2 py-1 rounded-md text-[10px] font-medium
            bg-[var(--surface-3)] text-[var(--text-2)]
            border border-[var(--border-2)]
            whitespace-nowrap pointer-events-none
            animate-fade-in z-50
          "
        >
          {isSpeaking ? 'Stop listening' : 'Listen'}
        </div>
      )}
    </div>
  )
}
