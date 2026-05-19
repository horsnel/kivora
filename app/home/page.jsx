'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { supabasePublic } from '@/lib/supabase'

const MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', tag: 'Default · Fastest', short: '3.3 70B' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', tag: 'Quick responses', short: '3.1 8B' },
  { id: 'llama3-70b-8192', name: 'Llama 3 70B', tag: 'Detailed', short: '3 70B' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', tag: 'Long context', short: 'Mixtral' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B', tag: 'Efficient', short: 'Gemma 2' },
]

const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

export default function HomePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [input, setInput] = useState('')
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const modelDropdownRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!supabasePublic) return
    supabasePublic.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  // Close model dropdown on click outside
  useEffect(() => {
    if (!modelDropdownOpen) return
    function handleClick(e) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [modelDropdownOpen])

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || null

  function getGreeting() {
    const h = new Date().getHours()
    if (h < 12) return t('discover.greeting.morning')
    if (h < 18) return t('discover.greeting.afternoon')
    return t('discover.greeting.evening')
  }

  function autoResize(el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }

  function handleSubmit() {
    const q = input.trim()
    if (!q) return
    const params = new URLSearchParams({ q })
    if (model !== DEFAULT_MODEL) params.set('model', model)
    router.push(`/chat?${params.toString()}`)
  }

  const currentModel = MODELS.find(m => m.id === model) || MODELS[0]
  const hasInput = input.trim().length > 0

  return (
    <main className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 -mt-8">
        {/* Greeting */}
        {displayName && (
          <div className="text-center mb-8 animate-fade-up">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
              {getGreeting()}, <span className="text-red-500">{displayName}</span>
            </h1>
          </div>
        )}

        {/* Chat bar — exact same design as ChatClient expanded bar */}
        <div className="w-full max-w-2xl animate-fade-up">
          <div className="chat-container-expanded">
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              className="chat-textarea-expanded scrollbar-none"
              placeholder={t('chat.placeholder')}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(e.target) }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
              autoFocus
            />

            {/* Toolbar */}
            <div className="chat-toolbar-expanded">
              {/* Left actions */}
              <div className="chat-toolbar-left">
                {/* Attach file (visual only) */}
                <button className="chat-toolbar-btn" title="Attach file">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>

                {/* Model chip */}
                <div className="relative" ref={modelDropdownRef}>
                  <button
                    className="chat-model-chip"
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    title={`Model: ${currentModel.name}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10A15 15 0 0 1 12 2z"/></svg>
                    <span>{currentModel.short}</span>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 5l3 3 3-3"/></svg>
                  </button>

                  {modelDropdownOpen && (
                    <div className="chat-model-dropdown">
                      {MODELS.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setModel(m.id); setModelDropdownOpen(false) }}
                          className={`chat-model-option ${m.id === model ? 'chat-model-option-active' : ''}`}
                        >
                          <div>
                            <div className="chat-model-name">{m.name}</div>
                            <div className="chat-model-tag">{m.tag}</div>
                          </div>
                          {m.id === model && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right actions */}
              <div className="chat-toolbar-right">
                {/* Submit button */}
                <button
                  onClick={handleSubmit}
                  disabled={!hasInput}
                  className={`chat-submit-btn ${hasInput ? 'chat-submit-btn-active' : ''}`}
                  aria-label="Send message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ChatClient CSS — exact same styles */}
      <style jsx>{`
        .chat-container-expanded {
          width: 100%;
          background-color: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 16px 16px 10px 16px;
          display: flex;
          flex-direction: column;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          overflow: visible;
        }
        .chat-container-expanded:focus-within {
          border-color: rgba(255,255,255,0.12);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.03);
        }

        .chat-textarea-expanded {
          width: 100%;
          background: transparent;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          color: #e2e2e2;
          font-size: 16px;
          line-height: 1.6;
          resize: none;
          max-height: 240px;
          min-height: 56px;
          font-family: inherit;
          padding: 4px 2px;
          margin-bottom: 12px;
        }
        .chat-textarea-expanded:focus {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          border-color: transparent !important;
        }
        .chat-textarea-expanded::placeholder {
          color: #525252;
        }

        .chat-toolbar-expanded {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
          min-height: 38px;
        }
        .chat-toolbar-left, .chat-toolbar-right {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .chat-toolbar-left {
          flex-wrap: nowrap;
          gap: 2px;
        }

        .chat-toolbar-btn {
          background: transparent;
          border: none;
          outline: none;
          color: #525252;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 6px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: background 0.2s, color 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
          width: 32px;
          height: 32px;
        }
        .chat-toolbar-btn:hover {
          background-color: rgba(255,255,255,0.06);
          color: #e2e2e2;
        }

        .chat-model-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.04);
          color: #737373;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          font-family: inherit;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .chat-model-chip:hover {
          border-color: rgba(255,255,255,0.12);
          color: #e2e2e2;
          background: rgba(255,255,255,0.06);
        }
        .chat-model-chip span {
          line-height: 1;
        }

        .chat-model-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          width: 220px;
          background: #0f0f0f;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          z-index: 100;
          padding: 4px 0;
          animation: dropUp 0.15s ease-out;
        }
        @keyframes dropUp {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .chat-model-option {
          width: 100%;
          text-align: left;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: background 0.15s;
          border: none;
          background: none;
          cursor: pointer;
          font-family: inherit;
        }
        .chat-model-option:hover {
          background: rgba(255,255,255,0.04);
        }
        .chat-model-option-active {
          background: rgba(255,255,255,0.04) !important;
        }
        .chat-model-name {
          font-size: 13px;
          font-weight: 500;
          color: #e2e2e2;
        }
        .chat-model-option:not(.chat-model-option-active) .chat-model-name {
          color: #a3a3a3;
        }
        .chat-model-tag {
          font-size: 11px;
          color: #525252;
          margin-top: 1px;
        }

        .chat-submit-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.06);
          color: #737373;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, transform 0.1s ease, color 0.15s;
          padding: 0;
        }
        .chat-submit-btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .chat-submit-btn-active {
          background: #e2e2e2;
          color: #0a0a0a;
        }
        .chat-submit-btn-active:hover {
          background: #ffffff;
          transform: scale(1.05);
        }
        .chat-submit-btn-active:active {
          transform: scale(0.95);
        }
      `}</style>
    </main>
  )
}
