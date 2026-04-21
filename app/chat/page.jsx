'use client'
import { useState, useRef, useEffect } from 'react'
import { IconSend, IconSpinner, IconCopy, IconCheck, IconChat } from '@/components/Icons'

const STARTERS = [
  'How do I start a WhatsApp bot business?',
  'What\'s the cheapest stack to build a SaaS?',
  'How do I make money with AI automation?',
  'Explain how n8n workflows work',
  'Best free AI tools for content creation?',
  'How do I start freelancing with AI skills?',
]

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [copiedIndex, setCopiedIndex] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function autoResize(el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
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
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, sessionId })
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

  return (
    <main className="h-[calc(100vh-56px)] flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-[#141414] px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center shrink-0">
              <IconChat size={13} className="text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-none">Kivora AI</h1>
              <p className="text-xs text-[#737373] mt-0.5">Powered by Groq · Free · No account needed</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full pulse-dot" />
            <span className="text-xs text-[#737373]">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <div className="w-12 h-12 bg-[#141414] border border-[#262626] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <IconChat size={20} className="text-[#404040]" />
              </div>
              <h2 className="font-semibold text-lg mb-1.5 tracking-tight">Ask me anything</h2>
              <p className="text-[#737373] text-sm mb-7 max-w-xs mx-auto">
                AI tools, automation, making money, coding, research — I've got you.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-w-lg mx-auto">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] rounded-xl px-4 py-3 text-xs text-[#737373] hover:text-white text-left transition-all leading-relaxed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`group ${msg.role === 'user' ? 'max-w-[80%]' : 'w-full'}`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-red-600 rounded-md flex items-center justify-center shrink-0">
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white"/>
                      </svg>
                    </div>
                    <span className="text-xs text-[#737373] font-medium">Kivora AI</span>
                  </div>
                )}
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-red-600 text-white rounded-tr-sm'
                    : 'bg-[#141414] border border-[#262626] text-[#d4d4d4] rounded-tl-sm'
                }`}>
                  <pre className="whitespace-pre-wrap font-sans break-words text-[13px] leading-relaxed">{msg.content}</pre>
                </div>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => copy(msg.content, i)}
                    className="opacity-0 group-hover:opacity-100 mt-1.5 flex items-center gap-1 text-xs text-[#404040] hover:text-[#737373] transition-all"
                  >
                    {copiedIndex === i ? <IconCheck size={11} /> : <IconCopy size={11} />}
                    {copiedIndex === i ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#141414] border border-[#262626] rounded-2xl rounded-tl-sm px-4 py-3.5">
                <div className="flex gap-1.5 items-center">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-1.5 h-1.5 bg-[#404040] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[#141414] px-4 py-3.5 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 text-sm text-white placeholder-[#404040] resize-none leading-relaxed"
            placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={e => { setInput(e.target.value); autoResize(e.target) }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 press"
          >
            {loading ? <IconSpinner size={14} /> : <IconSend size={14} />}
          </button>
        </div>
        <p className="text-xs text-[#2e2e2e] text-center mt-2">AI can make mistakes. Verify important information.</p>
      </div>
    </main>
  )
}
