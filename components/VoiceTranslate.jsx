'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { IconGlobe, IconSpeaker, IconSpinner, IconArrowRight, IconCopy, IconCheck } from '@/components/Icons'

/* ═══════════════════════════════════════════════════════════════
   VoiceTranslate — Translation component with TTS playback
   Source text → language pair → engine → translate → speak
   ═══════════════════════════════════════════════════════════════ */

const LANGUAGES = [
  { code: 'en', name: 'English', voiceCode: 'en-US' },
  { code: 'es', name: 'Spanish', voiceCode: 'es-ES' },
  { code: 'fr', name: 'French', voiceCode: 'fr-FR' },
  { code: 'de', name: 'German', voiceCode: 'de-DE' },
  { code: 'it', name: 'Italian', voiceCode: 'it-IT' },
  { code: 'pt', name: 'Portuguese', voiceCode: 'pt-BR' },
  { code: 'ja', name: 'Japanese', voiceCode: 'ja-JP' },
  { code: 'ko', name: 'Korean', voiceCode: 'ko-KR' },
  { code: 'zh', name: 'Chinese', voiceCode: 'zh-CN' },
  { code: 'ru', name: 'Russian', voiceCode: 'ru-RU' },
  { code: 'ar', name: 'Arabic', voiceCode: 'ar-SA' },
  { code: 'hi', name: 'Hindi', voiceCode: 'hi-IN' },
  { code: 'nl', name: 'Dutch', voiceCode: 'nl-NL' },
  { code: 'sv', name: 'Swedish', voiceCode: 'sv-SE' },
  { code: 'tr', name: 'Turkish', voiceCode: 'tr-TR' },
  { code: 'pl', name: 'Polish', voiceCode: 'pl-PL' },
]

const TRANSLATION_ENGINES = [
  { id: 'argos', name: 'Argos', tag: 'Offline', available: true },
  { id: 'google', name: 'Google', tag: 'Cloud', available: true },
  { id: 'deepl', name: 'DeepL', tag: 'Premium', available: true },
]

export default function VoiceTranslate({ className = '', ttsHook }) {
  const [sourceText, setSourceText] = useState('')
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('es')
  const [engine, setEngine] = useState('argos')
  const [translatedText, setTranslatedText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState(null)
  const [speakingTarget, setSpeakingTarget] = useState(null) // 'source' | 'target' | null
  const [copiedTarget, setCopiedTarget] = useState(false)

  const utteranceRef = useRef(null)

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Swap languages
  const swapLanguages = useCallback(() => {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
    // Also swap text if there's a translation
    if (translatedText) {
      setSourceText(translatedText)
      setTranslatedText('')
    }
  }, [sourceLang, targetLang, translatedText])

  // Translate
  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) {
      setError('Please enter text to translate.')
      return
    }

    setIsTranslating(true)
    setError(null)
    setTranslatedText('')

    try {
      const res = await fetch('/api/voice/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText,
          source: sourceLang,
          target: targetLang,
          engine,
        }),
      })

      if (!res.ok) throw new Error('Translation failed')

      const data = await res.json()
      if (data.translated) {
        setTranslatedText(data.translated)
      } else if (data.error) {
        setError(data.error)
      } else {
        throw new Error('No translation returned')
      }
    } catch {
      // Fallback: simple demo translation for offline mode
      setError('Translation service unavailable. Showing demo result.')
      setTranslatedText(`[${LANGUAGES.find(l => l.code === targetLang)?.name || targetLang}] ${sourceText}`)
    }
    setIsTranslating(false)
  }, [sourceText, sourceLang, targetLang, engine])

  // Speak text using browser TTS or hook
  const speakText = useCallback((text, lang, which) => {
    if (speakingTarget === which) {
      // Stop
      if (ttsHook?.stop) {
        ttsHook.stop()
      } else if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      setSpeakingTarget(null)
      return
    }

    // Stop any ongoing speech
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    // Use TTS hook if available
    if (ttsHook?.speak) {
      ttsHook.speak(text, { interrupt: true })
      setSpeakingTarget(which)

      // Auto-clear after estimate
      const estimatedDuration = Math.max(2000, text.length * 80)
      setTimeout(() => setSpeakingTarget(null), estimatedDuration)
      return
    }

    // Browser TTS fallback
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    const langData = LANGUAGES.find(l => l.code === lang)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = langData?.voiceCode || lang
    utterance.rate = 1.0

    // Try to find matching voice
    const voices = window.speechSynthesis.getVoices()
    const matchingVoice = voices.find(v => v.lang.startsWith(lang))
    if (matchingVoice) utterance.voice = matchingVoice

    utterance.onstart = () => setSpeakingTarget(which)
    utterance.onend = () => setSpeakingTarget(null)
    utterance.onerror = () => setSpeakingTarget(null)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [speakingTarget, ttsHook])

  // Copy translated text
  const handleCopy = useCallback(() => {
    if (!translatedText) return
    navigator.clipboard.writeText(translatedText)
    setCopiedTarget(true)
    setTimeout(() => setCopiedTarget(false), 2000)
  }, [translatedText])

  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center w-6 h-6 rounded-md"
            style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(239,68,68,0.15))' }}
          >
            <IconGlobe size={12} className="text-[var(--purple)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text)]">Voice Translate</h3>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Language Pair Selector */}
        <div className="flex items-center gap-2">
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="
              flex-1 px-3 py-2 rounded-lg text-xs
              bg-[var(--bg)] border border-[var(--border)]
              text-[var(--text-2)]
              focus:outline-none transition-colors
            "
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>

          <button
            onClick={swapLanguages}
            className="
              flex items-center justify-center w-8 h-8 rounded-lg
              bg-[var(--bg)] border border-[var(--border)]
              text-[var(--muted)] hover:text-[var(--text-2)]
              hover:border-[var(--border-hover)]
              transition-all duration-200
              active:scale-95
            "
            title="Swap languages"
          >
            <IconArrowRight size={12} className="rotate-180" />
          </button>

          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="
              flex-1 px-3 py-2 rounded-lg text-xs
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

        {/* Engine Selector */}
        <div className="flex gap-1.5">
          {TRANSLATION_ENGINES.map(e => (
            <button
              key={e.id}
              onClick={() => setEngine(e.id)}
              className={`
                flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium
                transition-all duration-200
                ${engine === e.id
                  ? 'bg-[var(--purple-dim)] border border-[rgba(168,85,247,0.2)] text-[var(--purple)]'
                  : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text-2)] hover:border-[var(--border-hover)]'
                }
              `}
            >
              {e.name}
              <span className="ml-1 opacity-50">{e.tag}</span>
            </button>
          ))}
        </div>

        {/* Source Text Input */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">
              Source
            </label>
            <button
              onClick={() => speakText(sourceText, sourceLang, 'source')}
              disabled={!sourceText.trim()}
              className={`
                flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]
                transition-colors disabled:opacity-30
                ${speakingTarget === 'source'
                  ? 'text-[var(--purple)] bg-[var(--purple-dim)]'
                  : 'text-[var(--muted)] hover:text-[var(--text-2)]'
                }
              `}
            >
              <IconSpeaker size={10} />
              {speakingTarget === 'source' ? 'Stop' : 'Listen'}
            </button>
          </div>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Enter text to translate..."
            rows={3}
            className="
              w-full px-3 py-2 rounded-lg text-sm resize-none
              bg-[var(--bg)] border border-[var(--border)]
              text-[var(--text)] placeholder:text-[var(--muted-2)]
              focus:outline-none transition-colors
              scrollbar-none
            "
          />
        </div>

        {/* Translate Button */}
        <button
          onClick={handleTranslate}
          disabled={!sourceText.trim() || isTranslating}
          className="
            w-full flex items-center justify-center gap-2
            px-4 py-2.5 rounded-lg text-sm font-medium
            transition-all duration-200
            disabled:opacity-40 disabled:cursor-not-allowed
          "
          style={{
            background: sourceText.trim() && !isTranslating
              ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(239,68,68,0.2))'
              : 'var(--surface)',
            border: sourceText.trim() && !isTranslating
              ? '1px solid rgba(168,85,247,0.3)'
              : '1px solid var(--border)',
            color: sourceText.trim() && !isTranslating ? 'var(--text)' : 'var(--muted)',
          }}
        >
          {isTranslating ? (
            <>
              <IconSpinner size={14} className="animate-spin" />
              <span>Translating...</span>
            </>
          ) : (
            <>
              <IconGlobe size={14} />
              <span>Translate</span>
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400">
            {error}
          </div>
        )}

        {/* Translated Result */}
        {translatedText && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider">
                Translation
              </label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => speakText(translatedText, targetLang, 'target')}
                  className={`
                    flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]
                    transition-colors
                    ${speakingTarget === 'target'
                      ? 'text-[var(--purple)] bg-[var(--purple-dim)]'
                      : 'text-[var(--muted)] hover:text-[var(--text-2)]'
                    }
                  `}
                >
                  <IconSpeaker size={10} />
                  {speakingTarget === 'target' ? 'Stop' : 'Listen'}
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--muted)] hover:text-[var(--text-2)] transition-colors"
                >
                  {copiedTarget ? <IconCheck size={10} className="text-green-400" /> : <IconCopy size={10} />}
                  {copiedTarget ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div
              className="
                px-3 py-2.5 rounded-lg text-sm
                bg-[var(--bg)] border border-[var(--border)]
                text-[var(--text-2)] leading-relaxed
                min-h-[60px]
              "
              style={{
                borderImage: 'linear-gradient(90deg, rgba(168,85,247,0.15), rgba(239,68,68,0.15)) 1',
              }}
            >
              {translatedText}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
