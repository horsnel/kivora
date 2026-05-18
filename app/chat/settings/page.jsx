'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { IconArrowLeft, IconDownload, IconSliders, IconSettings, IconFile, IconCheck } from '@/components/Icons'
import { useTranslation } from '@/components/LanguageProvider'
import { supabasePublic } from '@/lib/supabase'

const MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', tag: 'Default · Fastest' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', tag: 'Quick responses' },
  { id: 'llama3-70b-8192', name: 'Llama 3 70B', tag: 'Detailed' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', tag: 'Long context' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B', tag: 'Efficient' },
]

export default function ChatSettingsPage() {
  const { t } = useTranslation()
  const [customPrompt, setCustomPrompt] = useState('')
  const [saved, setSaved] = useState(false)
  const [exportFormat, setExportFormat] = useState('md')
  const [chatSessions, setChatSessions] = useState([])
  const [user, setUser] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [exported, setExported] = useState(false)

  // Auth state
  useEffect(() => {
    if (!supabasePublic) return
    supabasePublic.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) loadHistory(user.id)
    })
    const { data: { subscription } } = supabasePublic.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadHistory(session.user.id)
      else setChatSessions([])
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load custom prompt from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kivora-custom-system-prompt')
      if (saved) setCustomPrompt(saved)
    } catch {}
  }, [])

  async function loadHistory(userId) {
    try {
      const { data } = await supabasePublic
        .from('chat_sessions')
        .select('id, messages, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(50)
      if (data) setChatSessions(data)
    } catch {}
  }

  function saveCustomPrompt(value) {
    setCustomPrompt(value)
    try {
      if (value.trim()) {
        localStorage.setItem('kivora-custom-system-prompt', value)
      } else {
        localStorage.removeItem('kivora-custom-system-prompt')
      }
    } catch {}
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function resetCustomPrompt() {
    setCustomPrompt('')
    try {
      localStorage.removeItem('kivora-custom-system-prompt')
    } catch {}
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function exportChat(format) {
    const session = selectedSession
      ? chatSessions.find(s => s.id === selectedSession)
      : null

    const messages = session?.messages || []

    if (messages.length === 0) return

    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    let content = ''
    if (format === 'md') {
      content = `# Kivora AI Chat Export\n\n`
      content += `**Date:** ${dateStr} ${timeStr}\n\n`
      content += `---\n\n`
      messages.forEach(msg => {
        if (msg.role === 'user') {
          content += `### User\n\n${msg.content}\n\n`
        } else {
          content += `### Assistant\n\n${msg.content}\n\n`
        }
      })
    } else {
      content = `Kivora AI Chat Export\n`
      content += `Date: ${dateStr} ${timeStr}\n`
      content += `${'='.repeat(50)}\n\n`
      messages.forEach(msg => {
        if (msg.role === 'user') {
          content += `[User]\n${msg.content}\n\n`
        } else {
          content += `[Assistant]\n${msg.content}\n\n`
        }
      })
    }

    const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kivora-chat-${dateStr}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  function chatTitle(session) {
    const msgs = session.messages || []
    if (msgs.length === 0) return 'Empty chat'
    const first = msgs[0]?.content || ''
    return first.slice(0, 50) + (first.length > 50 ? '...' : '')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-[#141414] px-4 sm:px-6 py-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="w-8 h-8 flex items-center justify-center text-[#737373] hover:text-white hover:bg-[#141414] rounded-lg transition-colors"
          >
            <IconArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="font-semibold text-lg tracking-tight flex items-center gap-2">
              <IconSettings size={16} className="text-[#737373]" />
              {t('chat.settings') || 'Settings'}
            </h1>
            <p className="text-[11px] text-[#525252] mt-0.5">
              {t('chat.settings.subtitle') || 'Manage your AI chat preferences'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* ── Custom System Prompt ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-[#141414] border border-[#262626] rounded-lg flex items-center justify-center">
              <IconSliders size={13} className="text-[#737373]" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">{t('chat.custom_prompt') || 'Custom System Prompt'}</h2>
              <p className="text-[11px] text-[#525252]">
                {t('chat.custom_prompt.hint') || 'Instruct the AI how to behave. This is prepended to its system prompt.'}
              </p>
            </div>
          </div>

          <div className="bg-[#0f0f0f] border border-[#262626] rounded-xl p-4">
            <textarea
              rows={5}
              className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2.5 text-sm text-[#d4d4d4] placeholder-[#525252] resize-none outline-none focus:border-[#3a3a3a] transition-colors"
              placeholder="e.g. You are a sarcastic coding mentor. Always use Python examples..."
              value={customPrompt}
              onChange={e => saveCustomPrompt(e.target.value)}
            />
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={resetCustomPrompt}
                className="text-[11px] text-[#525252] hover:text-red-400 transition-colors"
              >
                {t('chat.custom_prompt.reset') || 'Reset to default'}
              </button>
              {saved && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <IconCheck size={10} /> Saved
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ── Export Chat ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-[#141414] border border-[#262626] rounded-lg flex items-center justify-center">
              <IconDownload size={13} className="text-[#737373]" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">{t('chat.export.title') || 'Export Chat'}</h2>
              <p className="text-[11px] text-[#525252]">
                {t('chat.export.subtitle') || 'Download your conversation as a file'}
              </p>
            </div>
          </div>

          <div className="bg-[#0f0f0f] border border-[#262626] rounded-xl p-4">
            {!user ? (
              <div className="text-center py-4">
                <p className="text-sm text-[#525252] mb-3">{t('chat.history.signin') || 'Sign in to save and export chats'}</p>
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg transition-colors font-semibold"
                >
                  {t('nav.signin') || 'Sign in'}
                </Link>
              </div>
            ) : chatSessions.length === 0 ? (
              <p className="text-sm text-[#525252] text-center py-4">{t('chat.history.empty') || 'No conversations yet'}</p>
            ) : (
              <>
                {/* Session selector */}
                <div className="mb-4">
                  <label className="text-[11px] text-[#525252] uppercase tracking-wider font-medium mb-2 block">
                    {t('chat.export.select') || 'Select conversation'}
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {chatSessions.map(session => (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(selectedSession === session.id ? null : session.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors truncate ${
                          selectedSession === session.id
                            ? 'bg-[#1a1a1a] text-white border border-[#262626]'
                            : 'text-[#737373] hover:text-white hover:bg-[#141414]'
                        }`}
                      >
                        {chatTitle(session)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format selector */}
                <div className="mb-4">
                  <label className="text-[11px] text-[#525252] uppercase tracking-wider font-medium mb-2 block">
                    {t('chat.export.format') || 'Format'}
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExportFormat('md')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        exportFormat === 'md'
                          ? 'bg-[#1a1a1a] text-white border border-[#262626]'
                          : 'text-[#525252] hover:text-white hover:bg-[#141414]'
                      }`}
                    >
                      <IconFile size={12} />
                      Markdown
                    </button>
                    <button
                      onClick={() => setExportFormat('txt')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        exportFormat === 'txt'
                          ? 'bg-[#1a1a1a] text-white border border-[#262626]'
                          : 'text-[#525252] hover:text-white hover:bg-[#141414]'
                      }`}
                    >
                      <IconFile size={12} />
                      Plain Text
                    </button>
                  </div>
                </div>

                {/* Export button */}
                <button
                  onClick={() => exportChat(exportFormat)}
                  disabled={!selectedSession}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    selectedSession
                      ? 'bg-[#dc2626] hover:bg-red-700 text-white'
                      : 'bg-[#141414] text-[#525252] cursor-not-allowed'
                  }`}
                >
                  {exported ? (
                    <>
                      <IconCheck size={14} /> {t('common.copied') || 'Exported'}
                    </>
                  ) : (
                    <>
                      <IconDownload size={14} />
                      {exportFormat === 'md' ? (t('chat.export.md') || 'Export as Markdown') : (t('chat.export.txt') || 'Export as Text')}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
