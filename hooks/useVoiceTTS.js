'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

/* ═══════════════════════════════════════════════════════════════
   useVoiceTTS — Text-to-Speech hook for Kivora
   Two modes:
     • Browser mode (default): Uses SpeechSynthesis API
     • Server mode: Calls /api/voice/tts for high-quality TTS
   ═══════════════════════════════════════════════════════════════ */

// Simple language detection heuristic
function detectLanguage(text) {
  // CJK characters
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN'
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja-JP'
  if (/[\uac00-\ud7af]/.test(text)) return 'ko-KR'
  // Cyrillic
  if (/[\u0400-\u04ff]/.test(text)) return 'ru-RU'
  // Arabic
  if (/[\u0600-\u06ff]/.test(text)) return 'ar-SA'
  // Hindi
  if (/[\u0900-\u097f]/.test(text)) return 'hi-IN'
  // French accents
  if (/[àâçéèêëîïôùûüÿñœæ]/i.test(text)) return 'fr-FR'
  // Spanish
  if (/[¿¡ñ]/.test(text)) return 'es-ES'
  // German
  if (/[äöüß]/i.test(text)) return 'de-DE'
  // Portuguese
  if (/[ãõç]/i.test(text)) return 'pt-BR'
  return 'en-US'
}

// Default browser engine definition
const BROWSER_ENGINE = {
  id: 'browser',
  name: 'Browser TTS',
  languages: ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN', 'ru-RU', 'ar-SA', 'hi-IN'],
  features: ['free', 'low-latency'],
}

// Audio cache for server TTS
const audioCache = new Map()
const MAX_CACHE_SIZE = 50

function cacheKey(text, voice, speed) {
  return `${text.slice(0, 100)}|${voice}|${speed}`
}

export function useVoiceTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentEngine, setCurrentEngine] = useState('browser')
  const [engines, setEngines] = useState([BROWSER_ENGINE])
  const [voices, setVoices] = useState([])
  const [currentVoice, setCurrentVoice] = useState('')
  const [speed, setSpeed] = useState(1.0)
  const [serverAvailable, setServerAvailable] = useState(false)

  const synthRef = useRef(null)
  const audioContextRef = useRef(null)
  const currentAudioRef = useRef(null)
  const utteranceRef = useRef(null)
  const speakQueueRef = useRef([])
  const isSpeakingRef = useRef(false)

  // Initialize browser speech synthesis
  useEffect(() => {
    if (typeof window === 'undefined') return

    const synth = window.speechSynthesis
    if (synth) {
      synthRef.current = synth
      loadBrowserVoices(synth)

      // Voices can load async in some browsers
      synth.onvoiceschanged = () => loadBrowserVoices(synth)
    }

    return () => {
      if (synth) synth.onvoiceschanged = null
      stop()
    }
  }, [])

  // Check server availability
  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkHealth = async () => {
      try {
        const res = await fetch('/api/voice/health', { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
          const data = await res.json()
          setServerAvailable(data.status === 'ok' || data.available === true)

          // Fetch available engines
          if (data.available || data.engines) {
            try {
              const engRes = await fetch('/api/voice/engines', { signal: AbortSignal.timeout(3000) })
              if (engRes.ok) {
                const engData = await engRes.json()
                if (engData.engines && engData.engines.length > 0) {
                  setEngines(prev => {
                    // Merge server engines, avoiding duplicates
                    const existing = new Set(prev.map(e => e.id))
                    const merged = [...prev]
                    engData.engines.forEach(e => {
                      if (!existing.has(e.id)) merged.push(e)
                    })
                    return merged
                  })
                }
              }
            } catch {
              // Engines endpoint optional
            }
          }
        } else {
          setServerAvailable(false)
        }
      } catch {
        setServerAvailable(false)
      }
    }

    checkHealth()
    // Re-check every 30s
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  // Load voices when engine changes
  useEffect(() => {
    if (currentEngine === 'browser') {
      loadBrowserVoices(synthRef.current)
    } else if (serverAvailable) {
      loadServerVoices(currentEngine)
    }
  }, [currentEngine, serverAvailable])

  function loadBrowserVoices(synth) {
    if (!synth) return
    const browserVoices = synth.getVoices()
    const mapped = browserVoices.map(v => ({
      id: v.voiceURI,
      name: v.name,
      lang: v.lang,
      local: v.localService,
    }))
    setVoices(mapped)
    // Auto-select a good default
    if (mapped.length > 0 && !currentVoice) {
      const enVoice = mapped.find(v => v.lang.startsWith('en') && v.local)
        || mapped.find(v => v.lang.startsWith('en'))
        || mapped[0]
      if (enVoice) setCurrentVoice(enVoice.id)
    }
  }

  async function loadServerVoices(engineId) {
    try {
      const res = await fetch(`/api/voice/voices?engine=${engineId}`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json()
        if (data.voices) {
          setVoices(data.voices.map(v => ({
            id: v.id,
            name: v.name || v.id,
            lang: v.language || v.lang || 'en-US',
            local: false,
          })))
          if (data.voices.length > 0) {
            setCurrentVoice(data.voices[0].id)
          }
        }
      }
    } catch {
      // Fall back to empty voice list
      setVoices([])
    }
  }

  // ── Browser TTS ──
  function speakBrowser(text, options = {}) {
    return new Promise((resolve) => {
      const synth = synthRef.current
      if (!synth) { resolve(); return }

      const utterance = new SpeechSynthesisUtterance(text)
      const voiceRate = options.speed || speed

      // Set voice
      const browserVoices = synth.getVoices()
      const selectedVoice = browserVoices.find(v => v.voiceURI === (options.voice || currentVoice))
      if (selectedVoice) {
        utterance.voice = selectedVoice
      } else {
        // Auto-detect language
        utterance.lang = detectLanguage(text)
      }

      utterance.rate = Math.max(0.5, Math.min(2.0, voiceRate))
      utterance.pitch = options.pitch || 1
      utterance.volume = options.volume || 1

      utterance.onend = () => {
        setIsSpeaking(false)
        isSpeakingRef.current = false
        processQueue()
        resolve()
      }

      utterance.onerror = () => {
        setIsSpeaking(false)
        isSpeakingRef.current = false
        processQueue()
        resolve()
      }

      utteranceRef.current = utterance
      setIsSpeaking(true)
      isSpeakingRef.current = true
      synth.speak(utterance)
    })
  }

  // ── Server TTS ──
  async function speakServer(text, options = {}) {
    const voiceId = options.voice || currentVoice
    const voiceSpeed = options.speed || speed
    const key = cacheKey(text, voiceId, voiceSpeed)

    let audioBuffer

    // Check cache
    if (audioCache.has(key)) {
      audioBuffer = audioCache.get(key)
    } else {
      try {
        const res = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            input: text,  // OpenAI-compatible field
            engine: currentEngine,
            model: currentEngine,  // OpenAI-compatible field
            voice: voiceId,
            speed: voiceSpeed,
            language: detectLanguage(text).split('-')[0],  // en-US → en
            response_format: 'mp3',
          }),
        })

        if (!res.ok) throw new Error('TTS request failed')

        const blob = await res.blob()
        audioBuffer = await blob.arrayBuffer()

        // Cache it
        if (audioCache.size >= MAX_CACHE_SIZE) {
          const firstKey = audioCache.keys().next().value
          audioCache.delete(firstKey)
        }
        audioCache.set(key, audioBuffer)
      } catch {
        // Fallback to browser TTS
        return speakBrowser(text, options)
      }
    }

    return new Promise((resolve) => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
        }
        const ctx = audioContextRef.current

        ctx.decodeAudioData(audioBuffer.slice(0), (buffer) => {
          const source = ctx.createBufferSource()
          source.buffer = buffer
          source.playbackRate.value = Math.max(0.5, Math.min(2.0, voiceSpeed))
          source.connect(ctx.destination)

          source.onended = () => {
            setIsSpeaking(false)
            isSpeakingRef.current = false
            processQueue()
            resolve()
          }

          setIsSpeaking(true)
          isSpeakingRef.current = true
          source.start(0)
          currentAudioRef.current = source
        }, () => {
          setIsSpeaking(false)
          isSpeakingRef.current = false
          processQueue()
          resolve()
        })
      } catch {
        setIsSpeaking(false)
        isSpeakingRef.current = false
        resolve()
      }
    })
  }

  // ── Queue processing ──
  function processQueue() {
    if (speakQueueRef.current.length > 0) {
      const next = speakQueueRef.current.shift()
      speakInternal(next.text, next.options, next.resolve)
    }
  }

  function speakInternal(text, options, resolve) {
    if (isSpeakingRef.current && !options?.interrupt) {
      // Queue it
      speakQueueRef.current.push({ text, options, resolve })
      return
    }

    if (currentEngine === 'browser' || !serverAvailable) {
      speakBrowser(text, options).then(resolve)
    } else {
      speakServer(text, options).then(resolve)
    }
  }

  // ── Public API ──
  const speak = useCallback((text, options = {}) => {
    if (!text?.trim()) return Promise.resolve()

    return new Promise((resolve) => {
      // Stop current speech if interrupting
      if (isSpeakingRef.current && options.interrupt !== false) {
        stop()
        // Small delay to let stop propagate
        setTimeout(() => speakInternal(text, options, resolve), 50)
      } else {
        speakInternal(text, options, resolve)
      }
    })
  }, [currentEngine, serverAvailable, currentVoice, speed])

  const stop = useCallback(() => {
    // Stop browser TTS
    if (synthRef.current) {
      synthRef.current.cancel()
    }
    // Stop server TTS audio
    if (currentAudioRef.current) {
      try { currentAudioRef.current.stop() } catch {}
      currentAudioRef.current = null
    }
    // Clear queue
    speakQueueRef.current = []
    setIsSpeaking(false)
    isSpeakingRef.current = false
  }, [])

  const setEngine = useCallback((id) => {
    // Stop current speech when switching engines
    stop()
    setCurrentEngine(id)
    setCurrentVoice('')
  }, [stop])

  const setVoiceHandler = useCallback((id) => {
    setCurrentVoice(id)
  }, [])

  const setSpeedHandler = useCallback((val) => {
    setSpeed(Math.max(0.5, Math.min(2.0, val)))
  }, [])

  return {
    speak,
    stop,
    isSpeaking,
    engines,
    currentEngine,
    setEngine,
    voices,
    currentVoice,
    setVoice: setVoiceHandler,
    speed,
    setSpeed: setSpeedHandler,
    serverAvailable,
  }
}
