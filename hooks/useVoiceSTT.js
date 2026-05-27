'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

/* ═══════════════════════════════════════════════════════════════
   useVoiceSTT — Speech-to-Text hook for Kivora
   Two modes:
     • Browser mode (default): Uses SpeechRecognition API
     • Server mode: Sends audio to WhisperX endpoint
   ═══════════════════════════════════════════════════════════════ */

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese (BR)' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'ru-RU', name: 'Russian' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'nl-NL', name: 'Dutch' },
  { code: 'pl-PL', name: 'Polish' },
  { code: 'sv-SE', name: 'Swedish' },
  { code: 'tr-TR', name: 'Turkish' },
]

export function useVoiceSTT({ language = 'en-US', continuous = true, interimResults = true } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState(null)
  const [serverAvailable, setServerAvailable] = useState(false)
  const [micPermission, setMicPermission] = useState('prompt') // 'granted' | 'denied' | 'prompt'

  const recognitionRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const finalTranscriptRef = useRef('')
  const isListeningRef = useRef(false)

  // Check server availability on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkHealth = async () => {
      try {
        const res = await fetch('/api/voice/health', { signal: AbortSignal.timeout(3000) })
        const data = await res.json()
        setServerAvailable(data.status === 'ok' || data.available === true)
      } catch {
        setServerAvailable(false)
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  // Check mic permission on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      navigator.permissions.query({ name: 'microphone' }).then(result => {
        setMicPermission(result.state)
        result.onchange = () => setMicPermission(result.state)
      }).catch(() => {
        // permissions.query not supported — will check on toggle
      })
    } catch {}
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening()
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // ── Browser STT ──
  function startBrowserRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition not supported. Please use Chrome or Edge.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = language

    let finalText = finalTranscriptRef.current

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += transcript + ' '
          finalTranscriptRef.current = finalText
          setTranscript(finalText.trim())
          setInterimTranscript('')
        } else {
          interim += transcript
        }
      }
      if (interim) {
        setInterimTranscript(interim)
      }
    }

    recognition.onerror = (event) => {
      setIsListening(false)
      isListeningRef.current = false

      switch (event.error) {
        case 'not-allowed':
          setError('Microphone access denied. Please allow microphone access in your browser settings.')
          setMicPermission('denied')
          break
        case 'no-speech':
          setError('No speech detected. Please try again.')
          break
        case 'audio-capture':
          setError('No microphone found. Please connect a microphone.')
          break
        case 'network':
          setError('Network error during speech recognition.')
          break
        default:
          setError(`Speech recognition error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      if (isListeningRef.current && continuous) {
        // Auto-restart for continuous mode
        try { recognition.start() } catch {}
      } else {
        setIsListening(false)
        isListeningRef.current = false
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
      setIsListening(true)
      isListeningRef.current = true
      setError(null)
    } catch (e) {
      setError('Failed to start speech recognition.')
    }
  }

  // ── Server STT (WhisperX) ──
  async function startServerRecognition() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await sendToServer(audioBlob)
        audioChunksRef.current = []

        // Continue recording if still listening
        if (isListeningRef.current) {
          try {
            mediaRecorder.start(2000) // Send chunks every 2s
          } catch {}
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(2000) // Chunk every 2s
      setIsListening(true)
      isListeningRef.current = true
      setError(null)
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied.')
        setMicPermission('denied')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found.')
      } else {
        setError('Failed to start recording.')
      }
    }
  }

  async function sendToServer(audioBlob) {
    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')
      formData.append('language', language.split('-')[0]) // en-US → en
      formData.append('model', 'whisperx')

      const res = await fetch('/api/voice/stt', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.text || data.transcript || ''
        if (text) {
          finalTranscriptRef.current += text + ' '
          setTranscript(finalTranscriptRef.current.trim())
        }
      }
    } catch {
      // Silently fail — will retry on next chunk
    }
  }

  // ── Public API ──
  const toggleListening = useCallback(async () => {
    if (isListeningRef.current) {
      stopListening()
      return
    }

    setError(null)

    // Check mic permission first
    try {
      const permResult = await navigator.permissions.query({ name: 'microphone' }).catch(() => null)
      if (permResult?.state === 'denied') {
        setError('Microphone access denied. Please reset in browser settings.')
        setMicPermission('denied')
        return
      }
    } catch {}

    // Request mic access to trigger permission prompt if needed
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setMicPermission('granted')
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied.')
        setMicPermission('denied')
        return
      }
    }

    // Use server STT if available, otherwise browser
    if (serverAvailable) {
      startServerRecognition()
    } else {
      startBrowserRecognition()
    }
  }, [language, continuous, interimResults, serverAvailable])

  function stopListening() {
    // Stop browser recognition
    if (recognitionRef.current) {
      isListeningRef.current = false
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }

    // Stop server recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      isListeningRef.current = false
      try { mediaRecorderRef.current.stop() } catch {}
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }

    setIsListening(false)
    isListeningRef.current = false
  }

  const clearTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    finalTranscriptRef.current = ''
  }, [])

  return {
    isListening,
    toggleListening,
    stopListening,
    transcript,
    interimTranscript,
    error,
    clearTranscript,
    serverAvailable,
    micPermission,
    supportedLanguages: SUPPORTED_LANGUAGES,
  }
}
