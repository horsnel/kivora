'use client'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { IconSend, IconSpinner, IconCopy, IconCheck, IconChat, IconMenu, IconClose, IconPlus, IconUser, IconMoney, IconLightning, IconCode, IconBulb, IconTool, IconGlobe, IconSearch } from '@/components/Icons'
import { useSessionTracker } from '@/lib/useSessionTracker'
import { supabasePublic } from '@/lib/supabase'
import MarkdownRenderer from '@/components/MarkdownRenderer'

const STARTERS = [
  { text: 'How do I start a WhatsApp bot business?', icon: IconChat },
  { text: 'What\'s the cheapest stack to build a SaaS?', icon: IconLightning },
  { text: 'How do I make money with AI automation?', icon: IconMoney },
  { text: 'Explain how n8n workflows work', icon: IconTool },
  { text: 'Best free AI tools for content creation?', icon: IconCode },
  { text: 'How do I start freelancing with AI skills?', icon: IconBulb },
]

function groupByDate(sessions) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today - 86400000)
  const weekAgo = new Date(today - 7 * 86400000)

  const groups = { today: [], yesterday: [], week: [], older: [] }

  sessions.forEach(s => {
    const d = new Date(s.updated_at || s.created_at)
    if (d >= today) groups.today.push(s)
    else if (d >= yesterday) groups.yesterday.push(s)
    else if (d >= weekAgo) groups.week.push(s)
    else groups.older.push(s)
  })

  const result = []
  if (groups.today.length) result.push({ label: 'Today', sessions: groups.today })
  if (groups.yesterday.length) result.push({ label: 'Yesterday', sessions: groups.yesterday })
  if (groups.week.length) result.push({ label: 'This week', sessions: groups.week })
  if (groups.older.length) result.push({ label: 'Older', sessions: groups.older })
  return result
}

export default function ChatClient() {
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [webSearch, setWebSearch] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const historyRef = useRef(null)
  const pathname = usePathname()
  const { startSession, endSession, markFollowUp } = useSessionTracker()
  const studySessionRef = useRef(null)
  const firstMessageSent = useRef(false)

  useEffect(() => {
    if (!supabasePublic) return
    supabasePublic.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) loadHistory(user.id)
    })
    const { data: { subscription } } = supabasePublic.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadHistory(session.user.id)
      else setChatHistory([])
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadHistory(userId) {
    try {
      const { data } = await supabasePublic
        .from('chat_sessions')
        .select('id, messages, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(30)
      if (data) setChatHistory(data)
    } catch {}
  }

  useEffect(() => {
    if (user && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      loadHistory(user.id)
    }
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => { if (studySessionRef.current) endSession(studySessionRef.current) }
  }, [])

  useEffect(() => { setHistoryOpen(false) }, [pathname])

  // Close history panel on click outside (mobile)
  useEffect(() => {
    if (!historyOpen) return
    function handleClick(e) {
      if (historyRef.current && !historyRef.current.contains(e.target)) {
        setHistoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [historyOpen])

  function autoResize(el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }

  function clearChat() {
    if (studySessionRef.current) {
      endSession(studySessionRef.current)
      studySessionRef.current = null
    }
    setMessages([])
    setInput('')
    setSessionId(crypto.randomUUID())
    firstMessageSent.current = false
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  function loadSession(session) {
    if (studySessionRef.current) {
      endSession(studySessionRef.current)
      studySessionRef.current = null
    }
    setSessionId(session.id)
    setMessages(session.messages || [])
    firstMessageSent.current = true
    setHistoryOpen(false)
  }

  async function send() {
    const q = input.trim()
    if (!q || loading) return
    const userMsg = { role: 'user', content: q }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)
    if (!firstMessageSent.current) {
      firstMessageSent.current = true
      studySessionRef.current = await startSession('chat', null, q.slice(0, 200))
    } else if (studySessionRef.current) {
      markFollowUp(studySessionRef.current)
    }
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, sessionId, userId: user?.id || null })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.error || 'Something went wrong.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Please try again.' }])
    }
    setLoading(false)
  }

  function copy(content, i) {
    navigator.clipboard.writeText(content)
    setCopiedIndex(i)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const historyGroups = groupByDate(chatHistory)

  function chatTitle(session) {
    const msgs = session.messages || []
    const first = msgs.find(m => m.role === 'user')
    return first?.content?.slice(0, 40) || 'New chat'
  }

  const hasInput = input.trim().length > 0

  return (
    <main className="h-full flex bg-[#0a0a0a]">
      {/* Chat history panel — second sidebar, only on desktop or when toggled on mobile */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setHistoryOpen(false)} />
      )}
      <aside
        ref={historyRef}
        className={`fixed lg:relative z-50 lg:z-auto top-0 left-0 h-full w-60 bg-[#0f0f0f] border-r border-[#181818] flex flex-col transition-transform duration-200 ${
          historyOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption text-[#525252] uppercase tracking-wider font-medium">Chat history</span>
            <button
              className="lg:hidden w-7 h-7 flex items-center justify-center text-[#525252] hover:text-white transition-colors"
              onClick={() => setHistoryOpen(false)}
            >
              <IconClose size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-behavior-contain px-2.5 min-h-0">
          {user && chatHistory.length > 0 ? (
            <div className="space-y-3">
              {historyGroups.map(group => (
                <div key={group.label}>
                  <p className="text-caption text-muted2 px-1 mb-1 uppercase tracking-wider font-medium">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.sessions.map(s => (
                      <button
                        key={s.id}
                        onClick={() => loadSession(s)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-caption transition-colors truncate ${
                          s.id === sessionId
                            ? 'bg-[#1a1a1a] text-white'
                            : 'text-[#525252] hover:text-white hover:bg-[#141414]'
                        }`}
                      >
                        {chatTitle(s)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : user ? (
            <p className="text-caption text-[#2e2e2e] px-1 pt-2">No conversations yet</p>
          ) : (
            <div className="px-1 pt-2">
              <Link
                href="/auth"
                className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-caption py-2 rounded-lg transition-colors font-semibold w-full"
              >
                <IconUser size={12} />
                Sign in to save chats
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="border-b border-[#141414] px-4 py-2.5 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden w-8 h-8 flex items-center justify-center text-[#525252] hover:text-white transition-colors -ml-1"
              onClick={() => setHistoryOpen(true)}
              aria-label="Chat history"
            >
              <IconMenu size={14} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 bg-red-600 rounded-md flex items-center justify-center shrink-0">
                <IconChat size={12} className="text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-caption leading-none">Kivora AI</h1>
                <p className="text-[10px] text-[#525252] mt-0.5">Powered by Groq · Free</p>
              </div>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="w-8 h-8 flex items-center justify-center text-[#525252] hover:text-white hover:bg-[#141414] rounded-lg transition-colors"
            aria-label="New chat"
          >
            <IconPlus size={14} />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto overscroll-behavior-contain">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.length === 0 && (
              <div className="text-center py-10 sm:py-16">
                <div className="w-14 h-14 bg-[#141414] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <IconChat size={20} className="text-[#525252]" />
                </div>
                <h2 className="font-semibold text-headline mb-2 tracking-tight">Ask me anything</h2>
                <p className="text-muted text-body mb-8 max-w-xs mx-auto leading-relaxed">
                  AI tools, automation, making money, coding, research — I've got you.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-w-lg mx-auto">
                  {STARTERS.map(({ text, icon: Icon }) => (
                    <button
                      key={text}
                      onClick={() => setInput(text)}
                      className="flex items-center gap-3 bg-transparent border border-white/[0.08] hover:border-white/[0.15] hover:bg-[#141414] rounded-xl px-4 py-3.5 text-muted hover:text-white text-left transition-all leading-snug"
                    >
                      <Icon size={14} className="text-[#525252] shrink-0" />
                      <span className="text-body-sm">{text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`group ${msg.role === 'user' ? 'max-w-[80%]' : 'w-full'}`}>
                  <div className={`rounded-xl px-4 py-3 text-body leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-red-600 text-white rounded-tr-sm'
                      : 'bg-[#141414] border border-white/[0.06] text-[#d4d4d4] rounded-tl-sm'
                  }`}>
                    {msg.role === 'assistant'
                      ? <MarkdownRenderer content={msg.content} />
                      : <span>{msg.content}</span>
                    }
                  </div>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => copy(msg.content, i)}
                      className="opacity-0 group-hover:opacity-100 mt-1.5 flex items-center gap-1 text-caption text-muted2 hover:text-muted transition-all"
                    >
                      {copiedIndex === i ? <IconCheck size={12} /> : <IconCopy size={12} />}
                      {copiedIndex === i ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#141414] border border-white/[0.06] rounded-xl rounded-tl-sm px-4 py-3.5">
                  <div className="flex gap-1.5 items-center">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-muted2 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Perplexity-style input bar ────────────────────── */}
        <div className="shrink-0 px-4 pb-4 pt-2">
          <div className="max-w-3xl mx-auto">
            {/* Chat container — Perplexity style */}
            <div className="chat-container-perplexity">
              <textarea
                ref={textareaRef}
                rows={1}
                className="chat-textarea-perplexity scrollbar-none"
                placeholder="Ask anything..."
                value={input}
                onChange={e => { setInput(e.target.value); autoResize(e.target) }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              />

              <div className="chat-toolbar-perplexity">
                {/* Left actions */}
                <div className="chat-toolbar-left">
                  {/* Web Search toggle */}
                  <button
                    className={`chat-toolbar-btn ${webSearch ? 'chat-toolbar-btn-active' : ''}`}
                    onClick={() => setWebSearch(!webSearch)}
                    title="Search the web"
                  >
                    <IconGlobe size={15} />
                    <span>Search</span>
                  </button>

                  {/* Focus mode */}
                  <button
                    className="chat-toolbar-btn"
                    title="Focus mode"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                    <span>Focus</span>
                  </button>
                </div>

                {/* Right actions */}
                <div className="chat-toolbar-right">
                  {/* Submit button — circle, lights up when text is entered */}
                  <button
                    onClick={send}
                    disabled={loading || !hasInput}
                    className={`chat-submit-btn ${hasInput ? 'chat-submit-btn-active' : ''}`}
                    aria-label="Send message"
                  >
                    {loading ? (
                      <IconSpinner size={14} />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#2e2e2e] text-center mt-2.5">AI can make mistakes. Verify important information.</p>
          </div>
        </div>
      </div>

      {/* ── Perplexity-style chat bar CSS ── */}
      <style jsx>{`
        .chat-container-perplexity {
          width: 100%;
          background-color: #202222;
          border: 1px solid #2f3232;
          border-radius: 16px;
          padding: 12px 16px 8px 16px;
          display: flex;
          flex-direction: column;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .chat-container-perplexity:focus-within {
          border-color: #4c4f4f;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.03);
        }
        .chat-textarea-perplexity {
          width: 100%;
          background: transparent;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          color: #e3e3e3;
          font-size: 16px;
          line-height: 1.5;
          resize: none;
          max-height: 200px;
          font-family: inherit;
          padding: 0;
          margin-bottom: 12px;
        }
        .chat-textarea-perplexity:focus {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          border-color: transparent !important;
        }
        .chat-textarea-perplexity::placeholder {
          color: #8a8f8f;
        }
        .chat-toolbar-perplexity {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .chat-toolbar-left, .chat-toolbar-right {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .chat-toolbar-btn {
          background: transparent;
          border: none;
          outline: none;
          color: #8a8f8f;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 9999px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: background 0.2s, color 0.2s;
        }
        .chat-toolbar-btn:hover {
          background-color: #2d3030;
          color: #e3e3e3;
        }
        .chat-toolbar-btn-active {
          background-color: rgba(220, 38, 38, 0.12);
          color: #ef4444;
        }
        .chat-toolbar-btn-active:hover {
          background-color: rgba(220, 38, 38, 0.18);
          color: #f87171;
        }
        .chat-submit-btn {
          background-color: #2f3232;
          color: #8a8f8f;
          border: none;
          outline: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          transition: background-color 0.2s, color 0.2s, transform 0.15s;
        }
        .chat-submit-btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .chat-submit-btn-active {
          background-color: #e3e3e3;
          color: #191a1a;
        }
        .chat-submit-btn-active:hover {
          background-color: #ffffff;
          transform: scale(1.05);
        }
        .chat-submit-btn-active:active {
          transform: scale(0.95);
        }
      `}</style>
    </main>
  )
}
