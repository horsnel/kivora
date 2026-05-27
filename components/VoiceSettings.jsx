'use client'

import { useState, useCallback, useEffect } from 'react'
import { IconSpeaker, IconChevronDown, IconClose, IconSliders, IconSpinner, IconGlobe, IconMicrophone } from '@/components/Icons'

/* ═══════════════════════════════════════════════════════════════
   VoiceSettings — Slide-out panel for voice feature configuration
   Engine selector, voice selector, language, speed, test, status
   ═══════════════════════════════════════════════════════════════ */

const LANGUAGES = [
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
  { code: 'sv-SE', name: 'Swedish' },
  { code: 'tr-TR', name: 'Turkish' },
  { code: 'pl-PL', name: 'Polish' },
]

const DEFAULT_ENGINES = [
  { id: 'browser', name: 'Browser TTS', languages: ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'], features: ['free', 'low-latency'] },
  { id: 'omnivoice', name: 'OmniVoice', languages: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN', 'ko-KR'], features: ['high-quality', 'multi-lang'] },
  { id: 'kittentts', name: 'KittenTTS', languages: ['en-US', 'ja-JP'], features: ['expressive', 'fast'] },
  { id: 'moss-tts-nano', name: 'MOSS-TTS-Nano', languages: ['en-US', 'zh-CN'], features: ['lightweight', 'bilingual'] },
  { id: 'kokoro', name: 'Kokoro', languages: ['en-US', 'ja-JP'], features: ['natural', 'streaming'] },
]

export default function VoiceSettings({ isOpen, onClose, ttsHook }) {
  const [engineDropdownOpen, setEngineDropdownOpen] = useState(false)
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false)
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('en-US')
  const [testingVoice, setTestingVoice] = useState(false)
  const [cloningSectionOpen, setCloningSectionOpen] = useState(false)
  const [translationSectionOpen, setTranslationSectionOpen] = useState(false)
  const [testResult, setTestResult] = useState(null) // 'success' | 'error' | null

  // Get values from TTS hook if provided
  const engines = ttsHook?.engines || DEFAULT_ENGINES
  const currentEngine = ttsHook?.currentEngine || 'browser'
  const voices = ttsHook?.voices || []
  const currentVoice = ttsHook?.currentVoice || ''
  const speed = ttsHook?.speed || 1.0
  const serverAvailable = ttsHook?.serverAvailable || false
  const isSpeaking = ttsHook?.isSpeaking || false

  const setEngine = ttsHook?.setEngine || (() => {})
  const setVoice = ttsHook?.setVoice || (() => {})
  const setSpeed = ttsHook?.setSpeed || (() => {})
  const speak = ttsHook?.speak
  const stop = ttsHook?.stop || (() => {})

  // Close dropdowns on click outside
  useEffect(() => {
    if (!engineDropdownOpen && !voiceDropdownOpen && !languageDropdownOpen) return
    function handleClick(e) {
      if (!e.target.closest('[data-voice-dropdown]')) {
        setEngineDropdownOpen(false)
        setVoiceDropdownOpen(false)
        setLanguageDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [engineDropdownOpen, voiceDropdownOpen, languageDropdownOpen])

  // Filter voices by selected language
  const filteredVoices = selectedLanguage
    ? voices.filter(v => v.lang?.startsWith(selectedLanguage.split('-')[0]))
    : voices

  const currentEngineData = engines.find(e => e.id === currentEngine) || engines[0]

  // Test voice
  const handleTestVoice = useCallback(async () => {
    if (!speak) {
      // Fallback browser TTS test
      if (typeof window === 'undefined' || !window.speechSynthesis) return
      setTestingVoice(true)
      setTestResult(null)
      const utterance = new SpeechSynthesisUtterance("Hello, I'm Kivora, your AI assistant")
      utterance.rate = speed
      const synthVoices = window.speechSynthesis.getVoices()
      const voice = synthVoices.find(v => v.voiceURI === currentVoice)
      if (voice) utterance.voice = voice
      utterance.onend = () => { setTestingVoice(false); setTestResult('success') }
      utterance.onerror = () => { setTestingVoice(false); setTestResult('error') }
      window.speechSynthesis.speak(utterance)
      return
    }

    setTestingVoice(true)
    setTestResult(null)
    try {
      await speak("Hello, I'm Kivora, your AI assistant", { interrupt: true })
      setTestResult('success')
    } catch {
      setTestResult('error')
    }
    setTestingVoice(false)
  }, [speak, speed, currentVoice])

  // Auto-clear test result
  useEffect(() => {
    if (!testResult) return
    const timer = setTimeout(() => setTestResult(null), 3000)
    return () => clearTimeout(timer)
  }, [testResult])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-full sm:w-[360px] z-50
          bg-[var(--bg)] border-l border-[var(--border)]
          shadow-2xl shadow-black/30
          flex flex-col
          animate-slide-in-right
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(239,68,68,0.15))' }}
            >
              <IconSpeaker size={14} className="text-[var(--purple)]" />
            </div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Voice Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 transition-colors"
          >
            <IconClose size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Server Status */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                serverAvailable
                  ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]'
                  : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.3)]'
              }`}
            />
            <span className="text-xs text-[var(--text-2)]">
              Voice Server {serverAvailable ? 'Connected' : 'Offline'}
            </span>
            <span className="text-[10px] text-[var(--muted)] ml-auto">
              {serverAvailable ? 'High-quality TTS available' : 'Using browser fallback'}
            </span>
          </div>

          {/* Engine Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider">
              Engine
            </label>
            <div className="relative" data-voice-dropdown>
              <button
                onClick={() => { setEngineDropdownOpen(!engineDropdownOpen); setVoiceDropdownOpen(false); setLanguageDropdownOpen(false) }}
                className="
                  w-full flex items-center justify-between
                  px-3 py-2.5 rounded-lg
                  bg-[var(--surface)] border border-[var(--border)]
                  text-sm text-[var(--text-2)]
                  hover:border-[var(--border-hover)] transition-colors
                "
              >
                <span>{currentEngineData?.name || 'Browser TTS'}</span>
                <IconChevronDown
                  size={12}
                  className={`text-[var(--muted)] transition-transform ${engineDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {engineDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xl z-10 max-h-48 overflow-y-auto animate-slide-down">
                  {engines.map(engine => (
                    <button
                      key={engine.id}
                      onClick={() => { setEngine(engine.id); setEngineDropdownOpen(false) }}
                      className={`
                        w-full px-3 py-2.5 text-left text-sm
                        hover:bg-white/5 transition-colors
                        ${engine.id === currentEngine ? 'text-[var(--purple)]' : 'text-[var(--text-2)]'}
                      `}
                    >
                      <div className="font-medium">{engine.name}</div>
                      <div className="flex gap-1 mt-0.5">
                        {engine.features?.map(f => (
                          <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--muted)]">
                            {f}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Voice Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider">
              Voice
            </label>
            <div className="relative" data-voice-dropdown>
              <button
                onClick={() => { setVoiceDropdownOpen(!voiceDropdownOpen); setEngineDropdownOpen(false); setLanguageDropdownOpen(false) }}
                className="
                  w-full flex items-center justify-between
                  px-3 py-2.5 rounded-lg
                  bg-[var(--surface)] border border-[var(--border)]
                  text-sm text-[var(--text-2)]
                  hover:border-[var(--border-hover)] transition-colors
                "
                disabled={filteredVoices.length === 0}
              >
                <span className="truncate">
                  {currentVoice
                    ? filteredVoices.find(v => v.id === currentVoice)?.name || currentVoice
                    : filteredVoices.length > 0 ? 'Select a voice' : 'No voices available'
                  }
                </span>
                <IconChevronDown
                  size={12}
                  className={`text-[var(--muted)] transition-transform ${voiceDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {voiceDropdownOpen && filteredVoices.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xl z-10 max-h-48 overflow-y-auto animate-slide-down">
                  {filteredVoices.map(voice => (
                    <button
                      key={voice.id}
                      onClick={() => { setVoice(voice.id); setVoiceDropdownOpen(false) }}
                      className={`
                        w-full px-3 py-2.5 text-left text-sm
                        hover:bg-white/5 transition-colors
                        ${voice.id === currentVoice ? 'text-[var(--purple)]' : 'text-[var(--text-2)]'}
                      `}
                    >
                      <div className="font-medium truncate">{voice.name}</div>
                      {voice.lang && (
                        <div className="text-[10px] text-[var(--muted)]">{voice.lang}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Language Picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider">
              Language
            </label>
            <div className="relative" data-voice-dropdown>
              <button
                onClick={() => { setLanguageDropdownOpen(!languageDropdownOpen); setEngineDropdownOpen(false); setVoiceDropdownOpen(false) }}
                className="
                  w-full flex items-center justify-between
                  px-3 py-2.5 rounded-lg
                  bg-[var(--surface)] border border-[var(--border)]
                  text-sm text-[var(--text-2)]
                  hover:border-[var(--border-hover)] transition-colors
                "
              >
                <span className="flex items-center gap-2">
                  <IconGlobe size={12} className="text-[var(--muted)]" />
                  {LANGUAGES.find(l => l.code === selectedLanguage)?.name || selectedLanguage}
                </span>
                <IconChevronDown
                  size={12}
                  className={`text-[var(--muted)] transition-transform ${languageDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {languageDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xl z-10 max-h-48 overflow-y-auto animate-slide-down">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => { setSelectedLanguage(lang.code); setLanguageDropdownOpen(false) }}
                      className={`
                        w-full px-3 py-2 text-left text-sm
                        hover:bg-white/5 transition-colors
                        ${lang.code === selectedLanguage ? 'text-[var(--purple)]' : 'text-[var(--text-2)]'}
                      `}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Speed Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider">
                Speed
              </label>
              <span className="text-xs text-[var(--text-2)] font-mono tabular-nums">
                {speed.toFixed(1)}x
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="voice-speed-slider w-full h-1 rounded-full appearance-none cursor-pointer bg-[var(--surface-3)]"
                style={{
                  background: `linear-gradient(to right, #a855f7 0%, #ef4444 ${((speed - 0.5) / 1.5) * 100}%, var(--surface-3) ${((speed - 0.5) / 1.5) * 100}%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-[var(--muted-2)]">0.5x</span>
                <span className="text-[9px] text-[var(--muted-2)]">1.0x</span>
                <span className="text-[9px] text-[var(--muted-2)]">2.0x</span>
              </div>
            </div>
          </div>

          {/* Test Voice Button */}
          <div className="space-y-2">
            <button
              onClick={handleTestVoice}
              disabled={testingVoice || isSpeaking}
              className="
                w-full flex items-center justify-center gap-2
                px-4 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                hover:shadow-lg
              "
              style={{
                background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(239,68,68,0.15))',
                border: '1px solid rgba(168,85,247,0.2)',
                color: 'var(--text)',
              }}
            >
              {testingVoice ? (
                <>
                  <IconSpinner size={14} className="animate-spin" />
                  <span>Playing...</span>
                </>
              ) : (
                <>
                  <IconSpeaker size={14} />
                  <span>Test Voice</span>
                </>
              )}
            </button>
            {testResult && (
              <div className={`text-[10px] text-center ${testResult === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {testResult === 'success' ? 'Voice playback successful' : 'Voice playback failed'}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--border)]" />

          {/* Voice Cloning Section (collapsible) */}
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => setCloningSectionOpen(!cloningSectionOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-[var(--surface)] hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-2">
                <IconMicrophone size={12} className="text-[var(--purple)]" />
                <span className="text-xs font-medium text-[var(--text-2)]">Voice Cloning</span>
              </div>
              <IconChevronDown
                size={10}
                className={`text-[var(--muted)] transition-transform ${cloningSectionOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {cloningSectionOpen && (
              <div className="px-3 py-3 space-y-3 bg-[var(--bg)] animate-fade-in">
                <p className="text-[10px] text-[var(--muted)] leading-relaxed">
                  Upload a 3+ second audio clip to create a voice clone. Clone quality improves with longer, cleaner samples.
                </p>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-medium text-[var(--muted)]">Reference Audio</label>
                  <div className="flex items-center gap-2">
                    <button
                      className="
                        flex-1 px-3 py-2 rounded-md text-[11px]
                        bg-[var(--surface)] border border-dashed border-[var(--border-2)]
                        text-[var(--muted)] hover:border-[var(--purple)] hover:text-[var(--purple)]
                        transition-colors
                      "
                    >
                      Upload audio file
                    </button>
                    <button
                      className="
                        px-3 py-2 rounded-md text-[11px]
                        bg-[var(--surface)] border border-[var(--border)]
                        text-[var(--muted)] hover:text-[var(--text-2)]
                        transition-colors
                      "
                    >
                      Record
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Voice name"
                    className="
                      w-full px-3 py-2 rounded-md text-[11px]
                      bg-[var(--surface)] border border-[var(--border)]
                      text-[var(--text)] placeholder:text-[var(--muted-2)]
                      focus:outline-none transition-colors
                    "
                  />
                  <button
                    className="
                      w-full px-3 py-2 rounded-md text-[11px] font-medium
                      bg-[var(--purple-dim)] border border-[rgba(168,85,247,0.2)]
                      text-[var(--purple)] hover:bg-[var(--purple-20)]
                      transition-colors
                    "
                  >
                    Create Clone
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Translation Section (collapsible) */}
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => setTranslationSectionOpen(!translationSectionOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-[var(--surface)] hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-2">
                <IconGlobe size={12} className="text-[var(--accent-red)]" />
                <span className="text-xs font-medium text-[var(--text-2)]">Translation</span>
              </div>
              <IconChevronDown
                size={10}
                className={`text-[var(--muted)] transition-transform ${translationSectionOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {translationSectionOpen && (
              <div className="px-3 py-3 space-y-3 bg-[var(--bg)] animate-fade-in">
                <div className="flex items-center gap-2">
                  <select
                    className="
                      flex-1 px-2 py-1.5 rounded-md text-[11px]
                      bg-[var(--surface)] border border-[var(--border)]
                      text-[var(--text-2)]
                    "
                    defaultValue="en-US"
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                  <span className="text-[var(--muted)] text-[10px]">→</span>
                  <select
                    className="
                      flex-1 px-2 py-1.5 rounded-md text-[11px]
                      bg-[var(--surface)] border border-[var(--border)]
                      text-[var(--text-2)]
                    "
                    defaultValue="es-ES"
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-[var(--muted)]">Translation Engine</label>
                  <select
                    className="
                      w-full px-2 py-1.5 rounded-md text-[11px]
                      bg-[var(--surface)] border border-[var(--border)]
                      text-[var(--text-2)]
                    "
                    defaultValue="argos"
                  >
                    <option value="argos">Argos (Offline)</option>
                    <option value="google">Google Translate</option>
                    <option value="deepl">DeepL</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-2 text-[9px] text-[var(--muted-2)]">
            <IconSliders size={10} />
            <span>Settings are saved automatically</span>
          </div>
        </div>
      </div>

      {/* Custom CSS for speed slider */}
      <style>{`
        .voice-speed-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7, #ef4444);
          cursor: pointer;
          box-shadow: 0 0 6px rgba(168,85,247,0.3);
          border: 2px solid var(--bg);
          transition: box-shadow 0.2s ease;
        }
        .voice-speed-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 0 10px rgba(168,85,247,0.5);
        }
        .voice-speed-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7, #ef4444);
          cursor: pointer;
          box-shadow: 0 0 6px rgba(168,85,247,0.3);
          border: 2px solid var(--bg);
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  )
}
