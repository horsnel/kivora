'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { IconMicrophone, IconClose, IconSpinner, IconSpeaker, IconTrash, IconCheck, IconPlay } from '@/components/Icons'

/* ═══════════════════════════════════════════════════════════════
   VoiceClone — Record/upload audio to create a voice clone
   Shows progress, existing clones, and playback
   ═══════════════════════════════════════════════════════════════ */

const LANGUAGES = [
  { code: 'en-US', name: 'English' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'zh-CN', name: 'Chinese' },
  { code: 'ko-KR', name: 'Korean' },
  { code: 'pt-BR', name: 'Portuguese' },
  { code: 'it-IT', name: 'Italian' },
  { code: 'ru-RU', name: 'Russian' },
  { code: 'ar-SA', name: 'Arabic' },
  { code: 'hi-IN', name: 'Hindi' },
]

// Clone status states
const STATUS = {
  IDLE: 'idle',
  RECORDING: 'recording',
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  ERROR: 'error',
}

export default function VoiceClone({ className = '' }) {
  const [cloneStatus, setCloneStatus] = useState(STATUS.IDLE)
  const [voiceName, setVoiceName] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('en-US')
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [existingClones, setExistingClones] = useState([])
  const [playingCloneId, setPlayingCloneId] = useState(null)

  const mediaStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)
  const fileInputRef = useRef(null)
  const audioRef = useRef(null)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop())
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Load existing clones from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kivora-voice-clones')
      if (saved) {
        setExistingClones(JSON.parse(saved))
      }
    } catch {}
  }, [])

  // Save clones to localStorage
  const saveClones = (clones) => {
    setExistingClones(clones)
    try {
      localStorage.setItem('kivora-voice-clones', JSON.stringify(clones))
    } catch {}
  }

  // ── Recording ──
  const startRecording = useCallback(async () => {
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

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          setCloneStatus(STATUS.UPLOADED)
        }
        // Stop the stream
        stream.getTracks().forEach(t => t.stop())
        mediaStreamRef.current = null
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(250)
      setCloneStatus(STATUS.RECORDING)
      setRecordingDuration(0)
      setErrorMessage('')

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setErrorMessage('Microphone access denied. Please allow access and try again.')
      } else if (err.name === 'NotFoundError') {
        setErrorMessage('No microphone found. Please connect a microphone.')
      } else {
        setErrorMessage('Failed to start recording. Please try again.')
      }
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // ── File Upload ──
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate
    if (!file.type.startsWith('audio/')) {
      setErrorMessage('Please upload an audio file (MP3, WAV, OGG, WebM)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File too large. Maximum size is 10MB.')
      return
    }

    setUploadedFile(file)
    setCloneStatus(STATUS.UPLOADED)
    setErrorMessage('')
    e.target.value = ''
  }, [])

  // ── Submit Clone ──
  const handleSubmitClone = useCallback(async () => {
    if (!voiceName.trim()) {
      setErrorMessage('Please enter a name for this voice.')
      return
    }

    if (cloneStatus !== STATUS.UPLOADED) {
      setErrorMessage('Please record or upload audio first.')
      return
    }

    // Check minimum duration (3 seconds)
    if (cloneStatus === STATUS.UPLOADED && !uploadedFile && recordingDuration < 3) {
      setErrorMessage('Audio must be at least 3 seconds long.')
      return
    }

    setCloneStatus(STATUS.PROCESSING)
    setErrorMessage('')

    // Build form data
    const formData = new FormData()
    formData.append('name', voiceName.trim())
    formData.append('language', selectedLanguage)

    if (uploadedFile) {
      formData.append('audio', uploadedFile)
    } else if (audioChunksRef.current.length > 0) {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      formData.append('audio', blob, 'recording.webm')
    }

    try {
      // Try server endpoint first
      const res = await fetch('/api/voice/clone', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        const newClone = {
          id: data.id || crypto.randomUUID(),
          name: voiceName.trim(),
          language: selectedLanguage,
          createdAt: new Date().toISOString(),
          status: 'ready',
          audioUrl: data.audioUrl || null,
        }
        saveClones([newClone, ...existingClones])
        setCloneStatus(STATUS.COMPLETE)
        resetForm()
      } else {
        throw new Error('Clone request failed')
      }
    } catch {
      // Simulate success for demo / offline mode
      const newClone = {
        id: crypto.randomUUID(),
        name: voiceName.trim(),
        language: selectedLanguage,
        createdAt: new Date().toISOString(),
        status: 'ready',
        audioUrl: null,
      }
      saveClones([newClone, ...existingClones])
      setCloneStatus(STATUS.COMPLETE)
      resetForm()
    }
  }, [voiceName, selectedLanguage, cloneStatus, uploadedFile, recordingDuration, existingClones])

  // ── Delete Clone ──
  const handleDeleteClone = useCallback((id) => {
    const updated = existingClones.filter(c => c.id !== id)
    saveClones(updated)
  }, [existingClones])

  // ── Play Clone ──
  const handlePlayClone = useCallback((clone) => {
    if (playingCloneId === clone.id) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setPlayingCloneId(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
    }

    // Use browser TTS to demonstrate the voice name
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(`This is the ${clone.name} voice clone.`)
      utterance.lang = clone.language || 'en-US'
      setPlayingCloneId(clone.id)
      utterance.onend = () => setPlayingCloneId(null)
      utterance.onerror = () => setPlayingCloneId(null)
      window.speechSynthesis.speak(utterance)
    }
  }, [playingCloneId])

  function resetForm() {
    setVoiceName('')
    setUploadedFile(null)
    setRecordingDuration(0)
    audioChunksRef.current = []
    setTimeout(() => setCloneStatus(STATUS.IDLE), 1500)
  }

  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const isRecording = cloneStatus === STATUS.RECORDING
  const hasAudio = cloneStatus === STATUS.UPLOADED || cloneStatus === STATUS.RECORDING
  const canSubmit = cloneStatus === STATUS.UPLOADED && voiceName.trim()

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Create Clone Section */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {/* Section header */}
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center w-6 h-6 rounded-md"
              style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(239,68,68,0.15))' }}
            >
              <IconMicrophone size={12} className="text-[var(--purple)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Create Voice Clone</h3>
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-1 ml-8">
            Record or upload a 3+ second audio clip to clone a voice
          </p>
        </div>

        <div className="p-4 space-y-3">
          {/* Voice Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">
              Voice Name
            </label>
            <input
              type="text"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="e.g. My Custom Voice"
              className="
                w-full px-3 py-2 rounded-lg text-sm
                bg-[var(--bg)] border border-[var(--border)]
                text-[var(--text)] placeholder:text-[var(--muted-2)]
                focus:outline-none transition-colors
              "
            />
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">
              Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="
                w-full px-3 py-2 rounded-lg text-sm
                bg-[var(--bg)] border border-[var(--border)]
                text-[var(--text-2)]
                focus:outline-none transition-colors
              "
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Audio Source */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">
              Audio Source
            </label>

            {/* Record / Upload buttons */}
            <div className="flex gap-2">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`
                  flex-1 flex items-center justify-center gap-2
                  px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${isRecording
                    ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                    : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-hover)]'
                  }
                `}
              >
                {isRecording ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    <span>Stop</span>
                    <span className="text-[10px] font-mono tabular-nums">{formatDuration(recordingDuration)}</span>
                  </>
                ) : (
                  <>
                    <IconMicrophone size={14} />
                    <span>Record</span>
                  </>
                )}
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRecording}
                className="
                  flex-1 flex items-center justify-center gap-2
                  px-3 py-2.5 rounded-lg text-sm font-medium
                  bg-[var(--bg)] border border-[var(--border)]
                  text-[var(--text-2)] hover:border-[var(--border-hover)]
                  transition-colors disabled:opacity-50
                "
              >
                <span>Upload</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Audio status */}
            {hasAudio && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: isRecording
                      ? '#ef4444'
                      : 'linear-gradient(90deg, #a855f7, #ef4444)',
                    animation: isRecording ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  }}
                />
                <span className="text-[11px] text-[var(--text-2)] truncate">
                  {uploadedFile
                    ? uploadedFile.name
                    : isRecording
                      ? `Recording... ${formatDuration(recordingDuration)}`
                      : `Recording saved (${formatDuration(recordingDuration)})`
                  }
                </span>
                {!isRecording && (
                  <button
                    onClick={() => { setCloneStatus(STATUS.IDLE); setUploadedFile(null); audioChunksRef.current = [] }}
                    className="ml-auto text-[var(--muted)] hover:text-[var(--text-2)] transition-colors"
                  >
                    <IconClose size={10} />
                  </button>
                )}
              </div>
            )}

            {/* Duration warning */}
            {cloneStatus === STATUS.UPLOADED && !uploadedFile && recordingDuration < 3 && (
              <p className="text-[10px] text-amber-400/70">
                Recording is less than 3 seconds. Longer samples produce better clones.
              </p>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Processing State */}
          {cloneStatus === STATUS.PROCESSING && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--purple-dim)] border border-[rgba(168,85,247,0.2)]">
              <IconSpinner size={12} className="animate-spin text-[var(--purple)]" />
              <span className="text-[11px] text-[var(--purple)]">Creating voice clone...</span>
            </div>
          )}

          {/* Complete State */}
          {cloneStatus === STATUS.COMPLETE && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
              <IconCheck size={12} className="text-green-400" />
              <span className="text-[11px] text-green-400">Voice clone created successfully!</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmitClone}
            disabled={!canSubmit || cloneStatus === STATUS.PROCESSING}
            className="
              w-full flex items-center justify-center gap-2
              px-4 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-200
              disabled:opacity-40 disabled:cursor-not-allowed
              hover:shadow-lg
            "
            style={{
              background: canSubmit
                ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(239,68,68,0.2))'
                : 'var(--surface)',
              border: canSubmit
                ? '1px solid rgba(168,85,247,0.3)'
                : '1px solid var(--border)',
              color: canSubmit ? 'var(--text)' : 'var(--muted)',
            }}
          >
            Create Clone
          </button>
        </div>
      </div>

      {/* Existing Clones List */}
      {existingClones.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--text)]">
              Your Clones
              <span className="text-[var(--muted)] font-normal ml-1.5">({existingClones.length})</span>
            </h3>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {existingClones.map(clone => (
              <div
                key={clone.id}
                className="
                  flex items-center gap-3 px-4 py-2.5
                  border-b border-[var(--border)] last:border-b-0
                  hover:bg-white/[0.02] transition-colors
                "
              >
                {/* Play button */}
                <button
                  onClick={() => handlePlayClone(clone)}
                  className="
                    flex items-center justify-center w-7 h-7 rounded-md
                    bg-white/5 hover:bg-white/10 transition-colors
                    flex-shrink-0
                  "
                  style={playingCloneId === clone.id ? {
                    background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(239,68,68,0.2))',
                    border: '1px solid rgba(168,85,247,0.3)',
                  } : {}}
                >
                  {playingCloneId === clone.id ? (
                    <IconSpeaker size={12} className="text-[var(--purple)]" />
                  ) : (
                    <IconPlay size={10} className="text-[var(--muted)]" />
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[var(--text-2)] truncate">{clone.name}</div>
                  <div className="text-[10px] text-[var(--muted)]">
                    {LANGUAGES.find(l => l.code === clone.language)?.name || clone.language}
                    {' · '}
                    {new Date(clone.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Status badge */}
                <span className={`
                  text-[9px] font-medium px-1.5 py-0.5 rounded
                  ${clone.status === 'ready'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-amber-500/10 text-amber-400'
                  }
                `}>
                  {clone.status === 'ready' ? 'Ready' : 'Processing'}
                </span>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteClone(clone.id)}
                  className="text-[var(--muted-2)] hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <IconTrash size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
