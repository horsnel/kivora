'use client'
import Link from 'next/link'
import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { IconSend, IconSpinner, IconCopy, IconCheck, IconChat, IconMenu, IconClose, IconUser, IconMoney, IconLightning, IconCode, IconBulb, IconBook, IconTool, IconGlobe, IconSearch, IconPaperclip, IconDownload, IconLock, IconFile, IconChevronDown, IconMicrophone, IconSliders, IconSettings, IconPlus } from '@/components/Icons'
import { useSessionTracker } from '@/lib/useSessionTracker'
import { supabasePublic } from '@/lib/supabase'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { useTranslation } from '@/components/LanguageProvider'
import { stripMarkdown } from '@/lib/stripMarkdown'

const MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', tag: 'Default · Fastest', short: '3.3 70B' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', tag: 'Quick responses', short: '3.1 8B' },
  { id: 'llama3-70b-8192', name: 'Llama 3 70B', tag: 'Detailed', short: '3 70B' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', tag: 'Long context', short: 'Mixtral' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B', tag: 'Efficient', short: 'Gemma 2' },
]

const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

const ALLOWED_TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.csv', '.js', '.py', '.ts', '.jsx', '.tsx', '.css', '.html', '.sql']
const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const STARTERS = [
  { labelKey: 'chat.starter.build', icon: IconCode },
  { labelKey: 'chat.starter.earn', icon: IconMoney },
  { labelKey: 'chat.starter.learn', icon: IconBulb },
]

// Morphing brand mark shapes — stroke-based, matching platform icon language (1.25 stroke, round caps)
// All use viewBox="0 0 32 32" with stroke="currentColor"
// Shape 0 (chat bubble) is the resting form — same icon as the sidebar nav link for the AI chat page
const MORPH_SHAPES = [
  // 0: Chat bubble — the sidebar nav icon for AI chat (resting form)
  <g key="chat" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" fill="none">
    <path d="M4 6a2 2 0 012-2h20a2 2 0 012 2v14a2 2 0 01-2 2h-10l-6 6v-6H6a2 2 0 01-2-2V6z" />
    <path d="M10 12h12M10 17h6" />
  </g>,
  // 1: Lightning bolt — speed / automation
  <g key="bolt" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" fill="none">
    <path d="M18 4L8 18h6l-2 10 10-14h-6l2-10z" />
  </g>,
  // 2: Stacked blocks — building / SaaS
  <g key="blocks" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" fill="none">
    <rect x="6" y="4" width="8" height="8" rx="2" />
    <rect x="18" y="4" width="8" height="8" rx="2" />
    <rect x="6" y="16" width="20" height="8" rx="2" />
  </g>,
  // 3: Neural node — AI intelligence
  <g key="node" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" fill="none">
    <circle cx="16" cy="8" r="3.5" />
    <circle cx="7" cy="24" r="3" />
    <circle cx="25" cy="24" r="3" />
    <line x1="16" y1="11.5" x2="7" y2="21" />
    <line x1="16" y1="11.5" x2="25" y2="21" />
    <line x1="7" y1="24" x2="25" y2="24" />
  </g>,
  // 4: Growth arrow — earning / upward
  <g key="growth" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" fill="none">
    <path d="M16 5L7 16h5v8h8v-8h5L16 5z" />
    <path d="M7 28h18" />
  </g>,
]

const FOCUS_MODES = [
  { id: 'All', labelKey: 'chat.focus.all', descKey: 'chat.focus.all.desc', icon: '✦' },
  { id: 'Academic', labelKey: 'chat.focus.academic', descKey: 'chat.focus.academic.desc', icon: '🎓' },
  { id: 'Writing', labelKey: 'chat.focus.writing', descKey: 'chat.focus.writing.desc', icon: '✍' },
  { id: 'Math', labelKey: 'chat.focus.math', descKey: 'chat.focus.math.desc', icon: 'Σ' },
  { id: 'Code', labelKey: 'chat.focus.code', descKey: 'chat.focus.code.desc', icon: '</>' },
]

const PRO_MODES = [
  { id: 'reasoning', labelKey: 'chat.focus.reasoning', descKey: 'chat.focus.reasoning.desc' },
  { id: 'prosearch', labelKey: 'chat.focus.prosearch', descKey: 'chat.focus.prosearch.desc' },
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
  if (groups.today.length) result.push({ labelKey: 'chat.date.today', sessions: groups.today })
  if (groups.yesterday.length) result.push({ labelKey: 'chat.date.yesterday', sessions: groups.yesterday })
  if (groups.week.length) result.push({ labelKey: 'chat.date.this_week', sessions: groups.week })
  if (groups.older.length) result.push({ labelKey: 'chat.date.older', sessions: groups.older })
  return result
}

export default function ChatClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [webSearch, setWebSearch] = useState(false)

  // Feature #54: Multi-Model Support
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)

  // Feature #6: File Upload
  const [attachedFile, setAttachedFile] = useState(null)
  const [attachedContent, setAttachedContent] = useState('')
  const [attachedIsImage, setAttachedIsImage] = useState(false)
  const fileInputRef = useRef(null)

  // Feature: Voice Input
  const [isListening, setIsListening] = useState(false)
  const [voiceToast, setVoiceToast] = useState(null) // { type: 'error'|'info', message: string }
  const voiceToastTimer = useRef(null)
  const recognitionRef = useRef(null)

  function showVoiceToast(type, message) {
    if (voiceToastTimer.current) clearTimeout(voiceToastTimer.current)
    setVoiceToast({ type, message })
    voiceToastTimer.current = setTimeout(() => setVoiceToast(null), 4000)
  }

  // Feature: System Prompt Customization
  const [customSystemPrompt, setCustomSystemPrompt] = useState('')

  // Expandable chat bar states
  const [barExpanded, setBarExpanded] = useState(false)
  const [focusMode, setFocusMode] = useState('All')
  const [focusDropdownOpen, setFocusDropdownOpen] = useState(false)
  const [proMode, setProMode] = useState(false)
  const [proModeType, setProModeType] = useState('reasoning') // 'reasoning' or 'prosearch'
  const [proTypeDropdownOpen, setProTypeDropdownOpen] = useState(false)
  const [modelChipDropdownOpen, setModelChipDropdownOpen] = useState(false)

  // Chat sidebar search
  const [convSearch, setConvSearch] = useState('')

  // Morphing brand mark state
  const [morphIndex, setMorphIndex] = useState(0) // 0 = chat bubble (resting), settles on typing
  const [morphActive, setMorphActive] = useState(true)

  // Chat sidebar settings panel
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsExportFormat, setSettingsExportFormat] = useState('md')
  const [settingsPromptSaved, setSettingsPromptSaved] = useState(false)
  const [settingsExported, setSettingsExported] = useState(false)

  // ── Live Terminal Mode ──
  const [terminalMode, setTerminalMode] = useState(false)
  const [terminalHistory, setTerminalHistory] = useState([]) // {type: 'input'|'output'|'ai-suggest', content: string}
  const [termInput, setTermInput] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState(null) // pending command from AI

  const bottomRef = useRef(null)
  const termOutputRef = useRef(null)
  const textareaRef = useRef(null)
  const collapsedInputRef = useRef(null)
  const historyRef = useRef(null)
  const modelDropdownRef = useRef(null)
  const chatBarRef = useRef(null)
  const focusDropdownRef = useRef(null)
  const proTypeDropdownRef = useRef(null)
  const modelChipDropdownRef = useRef(null)
  const pathname = usePathname()
  const { startSession, endSession, markFollowUp } = useSessionTracker()
  const studySessionRef = useRef(null)
  const firstMessageSent = useRef(false)
  const { t } = useTranslation()

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

  // Close focus dropdown on click outside
  useEffect(() => {
    if (!focusDropdownOpen) return
    function handleClick(e) {
      if (focusDropdownRef.current && !focusDropdownRef.current.contains(e.target)) {
        setFocusDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [focusDropdownOpen])

  // Close pro type dropdown on click outside
  useEffect(() => {
    if (!proTypeDropdownOpen) return
    function handleClick(e) {
      if (proTypeDropdownRef.current && !proTypeDropdownRef.current.contains(e.target)) {
        setProTypeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [proTypeDropdownOpen])

  // Close model chip dropdown on click outside
  useEffect(() => {
    if (!modelChipDropdownOpen) return
    function handleClick(e) {
      if (modelChipDropdownRef.current && !modelChipDropdownRef.current.contains(e.target)) {
        setModelChipDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [modelChipDropdownOpen])

  // Auto-collapse bar on click outside (only when input is empty)
  useEffect(() => {
    if (!barExpanded) return
    function handleClick(e) {
      if (chatBarRef.current && !chatBarRef.current.contains(e.target)) {
        if (!input.trim() && !attachedFile) {
          setBarExpanded(false)
          setFocusDropdownOpen(false)
          setProTypeDropdownOpen(false)
          setModelChipDropdownOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [barExpanded, input, attachedFile])

  // Auto-expand bar when input is pre-filled (e.g. starter prompts)
  useEffect(() => {
    if (input.trim() && !barExpanded) {
      setBarExpanded(true)
    }
  }, [input])

  // Load custom system prompt from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kivora-custom-system-prompt')
      if (saved) setCustomSystemPrompt(saved)
    } catch {}
  }, [])

  // ── Handle URL query parameter (pre-fill from homepage) ──
  const urlQueryHandled = useRef(false)
  const autoSendRef = useRef(false)
  useEffect(() => {
    if (urlQueryHandled.current) return
    const q = searchParams.get('q')
    if (q) {
      urlQueryHandled.current = true
      setInput(q)
      autoSendRef.current = true
      // Clean URL parameter after reading
      router.replace('/chat')
    }
  }, [searchParams, router])

  // Auto-send when input is pre-filled from URL
  useEffect(() => {
    if (autoSendRef.current && input.trim() && !loading) {
      autoSendRef.current = false
      // Small delay to let barExpanded state sync
      setTimeout(() => send(), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (voiceToastTimer.current) clearTimeout(voiceToastTimer.current)
    }
  }, [])

  // ── Morphing brand mark timer ──
  // Random 1.5–3s intervals between shape transitions
  useEffect(() => {
    if (!morphActive || messages.length > 0) return
    const delay = 1500 + Math.random() * 1500
    const timer = setTimeout(() => {
      setMorphIndex(prev => (prev + 1) % MORPH_SHAPES.length)
    }, delay)
    return () => clearTimeout(timer)
  }, [morphIndex, morphActive, messages.length])

  // Settle to chat bubble (shape 0) when user is typing; resume morphing when idle
  useEffect(() => {
    const isActive = barExpanded || input.trim().length > 0
    if (isActive) {
      setMorphActive(false)
      setMorphIndex(0) // Chat bubble — the page's identity icon
    } else {
      setMorphActive(true)
      setMorphIndex(0) // Stay on chat bubble; morphing will cycle from here
    }
  }, [barExpanded, input])

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
    setAttachedFile(null)
    setAttachedContent('')
    setAttachedIsImage(false)
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
    setAttachedFile(null)
    setAttachedContent('')
    setAttachedIsImage(false)
  }

  // ── Feature #6: File Upload Handler ──
  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = '.' + file.name.split('.').pop().toLowerCase()
    const isImage = ALLOWED_IMAGE_EXTENSIONS.includes(ext)
    const isText = ALLOWED_TEXT_EXTENSIONS.includes(ext)

    if (!isImage && !isText) {
      alert(t('chat.error.unsupported_file'))
      e.target.value = ''
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      alert(t('chat.error.file_too_large'))
      e.target.value = ''
      return
    }

    if (isImage) {
      // Read as base64 for vision model
      const reader = new FileReader()
      reader.onload = () => {
        setAttachedFile(file.name)
        setAttachedContent(reader.result) // data:image/...;base64,...
        setAttachedIsImage(true)
      }
      reader.readAsDataURL(file)
    } else {
      // Read as text
      const reader = new FileReader()
      reader.onload = () => {
        setAttachedFile(file.name)
        setAttachedContent(reader.result)
        setAttachedIsImage(false)
      }
      reader.readAsText(file)
    }
    e.target.value = ''
  }

  function removeAttachment() {
    setAttachedFile(null)
    setAttachedContent('')
    setAttachedIsImage(false)
  }

  // ── Feature #2: Chat Export ──
  function exportChat(format) {
    if (messages.length === 0) return
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const currentModel = MODELS.find(m => m.id === model)

    let content = ''

    if (format === 'md') {
      content = `# Kivora AI Chat Export\n\n`
      content += `**Date:** ${dateStr} ${timeStr}\n`
      content += `**Model:** ${currentModel?.name || model}\n\n`
      content += `---\n\n`
      messages.forEach(msg => {
        if (msg.role === 'user') {
          content += `### 👤 User\n\n${msg.content}\n\n`
        } else {
          content += `### 🤖 Assistant\n\n${msg.content}\n\n`
        }
      })
    } else {
      content = `Kivora AI Chat Export\n`
      content += `Date: ${dateStr} ${timeStr}\n`
      content += `Model: ${currentModel?.name || model}\n`
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
  }

  async function send() {
    const q = input.trim()
    if ((!q && !attachedFile) || loading) return

    // Build the message content with file attachment if present
    let messageContent = q
    if (attachedFile && attachedContent) {
      if (attachedIsImage) {
        // For images: [Image: filename]\n<base64 data>
        messageContent = `[Image: ${attachedFile}]\n${attachedContent}`
        if (q) messageContent += '\n' + q
      } else {
        // For text files: [File: filename]\n<file content>\n\n<user message>
        messageContent = `[File: ${attachedFile}]\n${attachedContent}`
        if (q) messageContent += '\n\n' + q
      }
    }

    const userMsg = { role: 'user', content: messageContent }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    // Collapse bar after sending
    setBarExpanded(false)

    // Clear attachment after sending
    const wasImage = attachedIsImage
    setAttachedFile(null)
    setAttachedContent('')
    setAttachedIsImage(false)

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
        body: JSON.stringify({
          messages: newMessages,
          sessionId,
          userId: user?.id || null,
          model: wasImage ? undefined : model, // Vision model is auto-selected by API
          systemPrompt: customSystemPrompt || undefined
        })
      })
      const data = await res.json()
      const assistantMsg = { role: 'assistant', content: data.reply || data.error || t('chat.error.general') }
      if (data.searchUsed) {
        assistantMsg.searchUsed = true
        assistantMsg.searchQuery = data.searchQuery || ''
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: t('chat.error.network') }])
    }
    setLoading(false)
  }

  function copy(content, i) {
    navigator.clipboard.writeText(stripMarkdown(content))
    setCopiedIndex(i)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  // ── Voice Input (ASR) ──
  const [micPermModal, setMicPermModal] = useState(false)

  async function checkMicPermission() {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' })
      return result.state // 'granted', 'denied', or 'prompt'
    } catch {
      // permissions.query not supported in some browsers — return null so we fall through to getUserMedia
      return null
    }
  }

  async function toggleListening(e) {
    // Do NOT call e.preventDefault() — it blocks the browser's permission popup
    // by cancelling the "user gesture" that the browser requires.
    if (e) { e.stopPropagation() }
    if (typeof window === 'undefined') return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      showVoiceToast('error', t('chat.voice_not_supported') || 'Voice input is not supported in this browser. Please use Chrome or Edge.')
      return
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setIsListening(false)
      return
    }

    // Step 1: Check if permission is already permanently denied.
    // If so, getUserMedia will silently reject without showing a popup,
    // so we must show a modal with manual reset instructions instead.
    const permState = await checkMicPermission()
    if (permState === 'denied') {
      setMicPermModal(true)
      return
    }

    // Step 2: If permission is 'prompt' (never asked) or 'granted', proceed.
    // For 'prompt': getUserMedia will trigger the browser's permission popup.
    // For 'granted': getUserMedia will succeed immediately.
    // If permissions.query is unsupported (permState === null), try getUserMedia anyway.
    if (permState === 'prompt' || permState === null) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Release the stream immediately — we only needed the permission grant
        stream.getTracks().forEach(track => track.stop())
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          // User just clicked "Block" on the popup, or it was auto-denied
          setMicPermModal(true)
        } else if (err.name === 'NotFoundError') {
          showVoiceToast('error', t('chat.voice_no_mic') || 'No microphone found. Please connect a microphone.')
        } else {
          showVoiceToast('error', t('chat.voice_error') || 'Voice input error. Please try again.')
        }
        return
      }
    }

    // Step 3: Permission is granted — start SpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let finalTranscript = ''

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        }
      }
      if (finalTranscript) {
        setInput(prev => prev ? prev + ' ' + finalTranscript : finalTranscript)
        finalTranscript = ''
        if (textareaRef.current) {
          setTimeout(() => autoResize(textareaRef.current), 0)
        }
      }
    }

    recognition.onerror = (event) => {
      setIsListening(false)
      if (event.error === 'not-allowed') {
        setMicPermModal(true)
      } else if (event.error === 'no-speech') {
        showVoiceToast('info', t('chat.voice_no_speech') || 'No speech detected. Please try again.')
      } else if (event.error === 'audio-capture') {
        showVoiceToast('error', t('chat.voice_no_mic') || 'No microphone found. Please connect a microphone.')
      } else {
        showVoiceToast('error', t('chat.voice_error') || 'Voice input error. Please try again.')
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    setIsListening(true)
    try {
      recognition.start()
      showVoiceToast('info', t('chat.voice_listening') || 'Listening... Speak now.')
    } catch (e) {
      setIsListening(false)
      showVoiceToast('error', t('chat.voice_error') || 'Voice input error. Please try again.')
    }
  }

  // ── System Prompt Customization ──
  function saveCustomSystemPrompt(value) {
    setCustomSystemPrompt(value)
    try {
      localStorage.setItem('kivora-custom-system-prompt', value)
    } catch {}
  }

  function resetCustomSystemPrompt() {
    setCustomSystemPrompt('')
    try {
      localStorage.removeItem('kivora-custom-system-prompt')
    } catch {}
  }

  const historyGroups = groupByDate(chatHistory)

  // Filter history by search query
  const filteredHistory = convSearch.trim()
    ? groupByDate(chatHistory.filter(s => {
        const title = chatTitle(s)
        return title.toLowerCase().includes(convSearch.toLowerCase())
      }))
    : historyGroups

  function chatTitle(session) {
    const msgs = session.messages || []
    const first = msgs.find(m => m.role === 'user')
    return first?.content?.slice(0, 40) || t('chat.new')
  }

  const hasInput = input.trim().length > 0 || attachedFile

  const currentModel = MODELS.find(m => m.id === model) || MODELS[0]

  // ── Live Terminal Handlers ──
  const executeCommand = async (cmd) => {
    setTerminalHistory(prev => [...prev, { type: 'input', content: cmd }])

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_code: cmd, language_id: 46 }) // Bash
      })
      const data = await res.json()

      let output = ''
      // API-level error (rate limit, bad request, etc.)
      if (data.error && !data.status) {
        output = data.error
      } else {
        if (data.stdout) output += data.stdout
        if (data.compile_output) output += (output ? '\n' : '') + data.compile_output
        if (data.stderr) output += (output ? '\n' : '') + data.stderr
        if (!output) output = '(no output)'
        if (data.exit_code && data.exit_code !== 0) output += `\n[Exit code: ${data.exit_code}]`
        // Show status if not "Accepted"
        if (data.status?.id && data.status.id !== 3 && data.status.id !== 4) {
          output += `\n[${data.status.description}]`
        }
      }

      setTerminalHistory(prev => [...prev, { type: 'output', content: output }])
    } catch {
      setTerminalHistory(prev => [...prev, { type: 'output', content: 'Execution failed. Check your connection.' }])
    }

    // Auto-scroll
    setTimeout(() => {
      termOutputRef.current?.scrollTo({ top: termOutputRef.current.scrollHeight })
    }, 50)
  }

  const askAIForCommand = async (query) => {
    setTerminalHistory(prev => [...prev, { type: 'input', content: `# ${query}` }])

    try {
      const messages = [{ role: 'user', content: `I need a shell command for: ${query}\n\nRespond with ONLY the command, no explanation, no markdown, no code blocks. Just the raw command that can be pasted into a terminal.` }]

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model: 'llama-3.1-8b-instant' }) // Use fast model for terminal
      })
      const data = await res.json()

      if (data.reply) {
        // Clean up the reply — strip markdown code blocks if present
        let cmd = data.reply.trim()
        cmd = cmd.replace(/^```(?:bash|sh|shell)?\n?/, '').replace(/\n?```$/, '').trim()
        cmd = cmd.replace(/^`|`$/g, '').trim()

        if (cmd) {
          setAiSuggestion(cmd)
        }
      }
    } catch {
      setTerminalHistory(prev => [...prev, { type: 'output', content: 'AI request failed.' }])
    }

    // Auto-scroll
    setTimeout(() => {
      termOutputRef.current?.scrollTo({ top: termOutputRef.current.scrollHeight })
    }, 50)
  }

  const handleTerminalInput = async (e) => {
    if (e.key === 'Escape') {
      setAiSuggestion(null)
      return
    }

    if (e.key !== 'Enter') return
    const cmd = termInput.trim()
    if (!cmd) return
    setTermInput('')

    // If there's an AI suggestion pending and user presses Enter, execute it
    if (aiSuggestion) {
      const suggestion = aiSuggestion
      setAiSuggestion(null)
      await executeCommand(suggestion)
      return
    }

    // Check if this looks like a shell command (starts with common command prefixes)
    const isCommand = /^[a-z]/.test(cmd) && (
      /^(ls|cd|pwd|cat|echo|mkdir|rm|cp|mv|grep|find|curl|wget|npm|npx|node|python|pip|git|docker|make|chmod|chown|export|source|sudo|apt|yum|brew|which|whoami|uname|df|du|ps|top|kill|clear|history)/.test(cmd)
    )

    if (isCommand) {
      // Execute directly
      await executeCommand(cmd)
    } else {
      // Natural language — ask AI for a command suggestion
      await askAIForCommand(cmd)
    }
  }

  return (
    <main className="h-dvh flex bg-[#0a0a0a] overflow-hidden">
      {/* ── Chat Sidebar ── */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setHistoryOpen(false)} />
      )}
      <aside
        ref={historyRef}
        className={`fixed lg:relative z-50 lg:z-auto top-0 left-0 h-full w-60 bg-[#0f0f0f] border-r border-[#181818] flex flex-col transition-transform duration-200 ${
          historyOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* ── Logo + close ── */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <Link href="/home" className="flex items-center gap-2.5" onClick={() => setHistoryOpen(false)}>
              <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                  <path d="M16 4L6 24L16 18Z" fill="white" opacity="0.95" />
                  <path d="M16 4L26 24L16 18Z" fill="white" opacity="0.55" />
                  <rect x="6" y="26" width="20" height="3" rx="1.5" fill="white" opacity="0.3" />
                </svg>
              </div>
              <span className="font-bold text-[15px] tracking-tight">
                Ki<span className="text-red-500">vora</span>
              </span>
            </Link>
            <button
              className="lg:hidden w-7 h-7 flex items-center justify-center text-[#525252] hover:text-white transition-colors"
              onClick={() => setHistoryOpen(false)}
            >
              <IconClose size={14} />
            </button>
          </div>
        </div>

        {/* ── Explore link ── */}
        <div className="px-2.5 shrink-0">
          <Link
            href="/explore"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              false
                ? 'bg-[#1a1a1a] text-white'
                : 'text-muted hover:text-white hover:bg-[#141414]'
            }`}
            onClick={() => setHistoryOpen(false)}
          >
            <IconSearch size={14} className="shrink-0" />
            {t('nav.explore') || 'Explore'}
          </Link>
        </div>

        {/* ── Spacer ── */}
        <div className="h-3 shrink-0" />

        {/* ── Search conversations ── */}
        <div className="px-3 shrink-0">
          <div className="relative">
            <IconSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#525252] pointer-events-none" />
            <input
              type="text"
              placeholder={t('chat.search_conversations') || 'Search conversations'}
              value={convSearch}
              onChange={e => setConvSearch(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-[#d4d4d4] placeholder-[#525252] outline-none focus:border-[#3a3a3a] transition-colors"
              autoComplete="off"
              spellCheck="false"
            />
          </div>
        </div>

        {/* ── Conversation list ── */}
        <div className="flex-1 overflow-y-auto overscroll-behavior-contain px-2.5 min-h-0 mt-2">
          {user && filteredHistory.length > 0 ? (
            <div className="space-y-3">
              {filteredHistory.map(group => (
                <div key={group.labelKey}>
                  <p className="text-caption text-muted2 px-1 mb-1 uppercase tracking-wider font-medium">{t(group.labelKey)}</p>
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
            <p className="text-caption text-[#2e2e2e] px-1 pt-2">{convSearch.trim() ? (t('chat.no_results') || 'No conversations found') : (t('chat.history.empty') || 'No conversations yet')}</p>
          ) : null}
        </div>

        {/* ── Settings popup overlay (ChatGPT-style) ── */}
        {settingsOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSettingsOpen(false)}>
            <div
              className="w-[260px] bg-[#1a1a1a] border border-[#262626] rounded-2xl shadow-2xl p-4 animate-scale-in"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm tracking-tight flex items-center gap-2">
                  <IconSettings size={14} className="text-muted" />
                  {t('chat.settings') || 'Settings'}
                </h2>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="w-6 h-6 flex items-center justify-center text-[#525252] hover:text-white rounded-md hover:bg-[#262626] transition-colors"
                >
                  <IconClose size={12} />
                </button>
              </div>

              {/* Custom System Prompt */}
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <IconSliders size={11} className="text-muted" />
                  <span className="text-[11px] font-medium text-muted">{t('chat.custom_prompt')}</span>
                </div>
                <textarea
                  rows={3}
                  className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-2.5 py-2 text-[11px] text-[#d4d4d4] placeholder-[#525252] resize-none outline-none focus:border-[#3a3a3a] transition-colors"
                  placeholder="e.g. You are a sarcastic coding mentor..."
                  value={customSystemPrompt}
                  onChange={e => {
                    saveCustomSystemPrompt(e.target.value)
                    setSettingsPromptSaved(true)
                    setTimeout(() => setSettingsPromptSaved(false), 1500)
                  }}
                />
                <div className="flex items-center justify-between mt-1">
                  <button
                    onClick={() => { resetCustomSystemPrompt(); setSettingsPromptSaved(true); setTimeout(() => setSettingsPromptSaved(false), 1500) }}
                    className="text-[10px] text-[#525252] hover:text-red-400 transition-colors"
                  >
                    {t('chat.custom_prompt.reset')}
                  </button>
                  {settingsPromptSaved && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                      <IconCheck size={8} /> Saved
                    </span>
                  )}
                </div>
              </div>

              {/* Export Chat */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <IconDownload size={11} className="text-muted" />
                  <span className="text-[11px] font-medium text-muted">{t('chat.export.title') || 'Export Chat'}</span>
                </div>

                {messages.length === 0 ? (
                  <p className="text-[10px] text-muted2">No conversation to export</p>
                ) : (
                  <>
                    <div className="flex gap-1.5 mb-2">
                      <button
                        onClick={() => setSettingsExportFormat('md')}
                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          settingsExportFormat === 'md'
                            ? 'bg-[#262626] text-white'
                            : 'text-[#525252] hover:text-white hover:bg-[#262626]'
                        }`}
                      >
                        <IconFile size={9} /> MD
                      </button>
                      <button
                        onClick={() => setSettingsExportFormat('txt')}
                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          settingsExportFormat === 'txt'
                            ? 'bg-[#262626] text-white'
                            : 'text-[#525252] hover:text-white hover:bg-[#262626]'
                        }`}
                      >
                        <IconFile size={9} /> TXT
                      </button>
                    </div>
                    <button
                      onClick={() => { exportChat(settingsExportFormat); setSettingsExported(true); setTimeout(() => setSettingsExported(false), 2000) }}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                        settingsExported
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#dc2626] hover:bg-red-700 text-white'
                      }`}
                    >
                      {settingsExported ? (
                        <><IconCheck size={11} /> Exported</>
                      ) : (
                        <><IconDownload size={11} /> {settingsExportFormat === 'md' ? (t('chat.export.md') || 'Export as Markdown') : (t('chat.export.txt') || 'Export as Text')}</>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Settings toggle + Profile avatar — pinned to bottom ── */}
        <div className="p-2.5 border-t border-[#181818] shrink-0 space-y-0.5">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors font-medium ${
              settingsOpen
                ? 'bg-[#1a1a1a] text-white'
                : 'text-muted hover:text-white hover:bg-[#141414]'
            }`}
          >
            <IconSettings size={14} className="shrink-0" />
            {t('chat.settings') || 'Settings'}
          </button>

          {user ? (
            <Link
              href="/profile"
              className="flex items-center justify-center transition-colors rounded-lg hover:bg-[#141414] py-1.5"
              onClick={() => setHistoryOpen(false)}
            >
              <div className="w-7 h-7 bg-[#dc2626] rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '').slice(0, 2).toUpperCase()}
              </div>
            </Link>
          ) : (
            <Link
              href="/auth"
              className="flex items-center justify-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-sm py-2 rounded-lg transition-colors font-semibold"
              onClick={() => setHistoryOpen(false)}
            >
              <IconUser size={12} />
              {t('nav.signin') || 'Sign in'}
            </Link>
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between px-[min(5vw,48px)] py-3">
          {/* Left: hamburger (mobile) / spacer (desktop) */}
          <div className="w-8 flex items-center justify-center">
            <button
              className="lg:hidden w-8 h-8 flex items-center justify-center text-[#525252] hover:text-[#e2e2e2] transition-colors -ml-1"
              onClick={() => setHistoryOpen(true)}
              aria-label={t('chat.history')}
            >
              <IconMenu size={16} />
            </button>
          </div>
          {/* Center: spacer for balanced layout */}
          <div className="flex-1" />
          {/* Right: new conversation */}
          <button
            onClick={clearChat}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#525252] hover:text-[#e2e2e2] hover:bg-white/[0.04] transition-all duration-200"
            aria-label={t('chat.new')}
            title={t('chat.new')}
          >
            <IconPlus size={16} />
          </button>
        </div>

        {/* Messages area / Terminal area */}
        {terminalMode ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06]">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[12px] font-mono text-muted uppercase tracking-wider">Live Terminal</span>
            </div>

            {/* Terminal output */}
            <div className="flex-1 overflow-y-auto bg-[#0d0d0d] p-4 font-mono text-[13px] leading-[1.6] terminal-output" ref={termOutputRef}>
              {terminalHistory.length === 0 && !aiSuggestion && (
                <div className="text-muted2 text-[12px]">
                  <div className="text-green-400/60 mb-2">Welcome to Live Terminal</div>
                  <div>Type a shell command to execute it directly.</div>
                  <div>Or type a natural language query and AI will suggest a command.</div>
                </div>
              )}
              {terminalHistory.map((entry, i) => (
                <div key={i} className={entry.type === 'input' ? 'text-muted' : entry.type === 'output' ? 'text-[#d4d4d4] whitespace-pre-wrap break-all' : 'text-yellow-400'}>
                  {entry.type === 'input' && entry.content.startsWith('#') ? (
                    <><span className="text-[#525252]"># </span><span className="text-muted">{entry.content.slice(2)}</span></>
                  ) : entry.type === 'input' ? (
                    <><span className="text-green-400">$ </span>{entry.content}</>
                  ) : entry.type === 'ai-suggest' ? (
                    <><span className="text-yellow-400">AI suggests: </span>{entry.content}</>
                  ) : (
                    entry.content
                  )}
                </div>
              ))}

              {/* AI suggestion pending */}
              {aiSuggestion && (
                <div className="mt-2">
                  <div className="text-yellow-400 text-[12px]">AI suggests:</div>
                  <div className="text-[#e2e2e2] bg-yellow-400/[0.06] border border-yellow-400/20 rounded-md px-3 py-1.5 mt-1 inline-block">{aiSuggestion}</div>
                  <div className="text-[11px] text-[#525252] mt-1.5">Press <span className="text-muted">Enter</span> to run · <span className="text-muted">Esc</span> to dismiss</div>
                </div>
              )}
            </div>

            {/* Terminal input */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.06] bg-[#0d0d0d]">
              <span className="text-green-400 font-mono text-[13px]">$</span>
              <input
                type="text"
                value={termInput}
                onChange={e => setTermInput(e.target.value)}
                onKeyDown={handleTerminalInput}
                className="flex-1 bg-transparent border-none outline-none font-mono text-[13px] text-[#d4d4d4] placeholder-[#404040] terminal-input"
                placeholder="Type a command or ask AI..."
                autoFocus
              />
            </div>
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto overscroll-behavior-contain">
          <div className="max-w-[720px] mx-auto px-[min(5vw,48px)] py-8 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center min-h-[65vh]">
                {/* Morphing brand mark — the chat page's nav icon, ghosted and alive in the upper void */}
                <div className="flex-1 flex items-center justify-center">
                  <div className={`morph-logo-container ${!morphActive ? 'morph-logo-settled' : ''}`}>
                    <div className="relative w-[56px] h-[56px] sm:w-[64px] sm:h-[64px]">
                      {MORPH_SHAPES.map((shape, i) => (
                        <div key={i} className={`morph-shape ${i === morphIndex ? 'morph-shape-active' : ''}`}>
                          <svg width="44" height="44" viewBox="0 0 32 32" fill="none" className="sm:w-[52px] sm:h-[52px] text-[#525252]">
                            {shape}
                          </svg>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {messages.map((msg, i) => {
              // For display: strip [File: ...] prefix but keep text, show [Image: ...] as label
              let displayContent = msg.content
              let hasFileAttachment = false
              let hasImageAttachment = false
              let attachmentName = ''

              if (msg.role === 'user') {
                const fileMatch = msg.content.match(/^\[File: (.+?)\]\n/)
                if (fileMatch) {
                  hasFileAttachment = true
                  attachmentName = fileMatch[1]
                  displayContent = msg.content.replace(/^\[File: .+?\]\n/, '').replace(/^\n+/, '')
                }
                const imageMatch = msg.content.match(/^\[Image: (.+?)\]/)
                if (imageMatch) {
                  hasImageAttachment = true
                  attachmentName = imageMatch[1]
                  displayContent = msg.content.replace(/^\[Image: .+?\]\n?/, '').replace(/^data:image\/[\s\S]+$/, '').trim()
                  if (!displayContent) displayContent = '📷 Attached image'
                }
              }

              return (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`group ${msg.role === 'user' ? 'max-w-[80%]' : 'w-full'}`}>
                    {/* File/Image attachment indicator */}
                    {hasFileAttachment && (
                      <div className="flex items-center gap-1.5 mb-1.5 justify-end">
                        <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1 text-[11px] text-muted">
                          <IconFile size={10} />
                          <span>{attachmentName}</span>
                        </div>
                      </div>
                    )}
                    {hasImageAttachment && (
                      <div className="flex items-center gap-1.5 mb-1.5 justify-end">
                        <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1 text-[11px] text-muted">
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="5.5" r="1.5"/><path d="M2 11l3.5-3.5 2.5 2.5 2-2L14 11"/></svg>
                          <span>{attachmentName}</span>
                        </div>
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.searchUsed && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#525252" strokeWidth="1.25" strokeLinecap="round">
                          <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/>
                        </svg>
                        <span className="text-[11px] text-[#525252]">Searched: &quot;{msg.searchQuery}&quot;</span>
                      </div>
                    )}
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.content} />
                    ) : (
                      <div className="rounded-2xl px-5 py-3.5 bg-white/[0.04] text-[#e2e2e2] border border-white/[0.06] rounded-tr-sm leading-[1.65]">
                        <span>{displayContent}</span>
                      </div>
                    )}
                    {msg.role === 'assistant' && (
                      <div className="opacity-0 group-hover:opacity-100 mt-1.5 flex items-center gap-3 transition-all">
                        <button
                          onClick={() => copy(msg.content, i)}
                          className="flex items-center gap-1 text-caption text-muted hover:text-[#e2e2e2] transition-colors"
                        >
                          {copiedIndex === i ? <IconCheck size={12} /> : <IconCopy size={12} />}
                          {copiedIndex === i ? t('common.copied') : t('common.copy')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-tl-sm px-5 py-3.5">
                  <div className="flex gap-1.5 items-center">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-[#525252] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
        )}

        {/* ── Expandable Chat Bar (hidden in terminal mode) ────────────────────── */}
        {!terminalMode && (
        <div className="shrink-0 px-[min(5vw,48px)] pb-4 pt-2" style={{ overflow: 'visible' }}>
          <div className="max-w-[720px] mx-auto" style={{ overflow: 'visible' }}>
            {/* Suggestion pills — above chat bar, single scrollable row */}
            {messages.length === 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none pb-0.5 animate-fade-up">
                {STARTERS.map(({ labelKey, icon: Icon }) => (
                  <button
                    key={labelKey}
                    onClick={() => setInput(t(labelKey))}
                    className="flex items-center gap-2 bg-transparent border border-[#1f1f1f] text-[#737373] hover:bg-[#0f0f0f] hover:border-[#2a2a2a] hover:text-white hover:-translate-y-px px-4 py-2 rounded-full text-[13px] font-normal cursor-pointer transition-all duration-200 tracking-[-0.01em] whitespace-nowrap shrink-0"
                  >
                    <Icon size={13} className="shrink-0" />
                    <span>{t(labelKey)}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Voice toast notification */}
            {voiceToast && (
              <div className={`mb-2 flex items-center justify-center animate-slide-down`}>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium ${
                  voiceToast.type === 'error'
                    ? 'bg-red-950/60 border border-red-900/40 text-red-400'
                    : 'bg-white/[0.04] border border-white/[0.06] text-[#a3a3a3]'
                }`}>
                  {voiceToast.type === 'info' && isListening ? (
                    <span className="relative flex items-center justify-center" style={{ width: 12, height: 12 }}>
                      <span className="absolute w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                    </span>
                  ) : null}
                  {voiceToast.message}
                </div>
              </div>
            )}
            {/* File attachment chip */}
            {attachedFile && barExpanded && (
              <div className="mb-2 flex items-center justify-end">
                <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-[#a3a3a3]">
                  {attachedIsImage ? (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="5.5" r="1.5"/><path d="M2 11l3.5-3.5 2.5 2.5 2-2L14 11"/></svg>
                  ) : (
                    <IconFile size={12} />
                  )}
                  <span className="max-w-[120px] truncate">{attachedFile}</span>
                  <button
                    onClick={removeAttachment}
                    className="ml-0.5 text-[#525252] hover:text-[#e2e2e2] transition-colors"
                    aria-label="Remove attachment"
                  >
                    <IconClose size={10} />
                  </button>
                </div>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept={[...ALLOWED_TEXT_EXTENSIONS, ...ALLOWED_IMAGE_EXTENSIONS].join(',')}
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* ═══ COLLAPSED STATE ═══ */}
            {!barExpanded && (
              <div className="chat-bar-collapsed">
                {/* + New chat button */}
                <button
                  className="chat-collapsed-btn-circle"
                  onClick={clearChat}
                  aria-label={t('chat.new')}
                  title={t('chat.new')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>

                {/* Input field — single line in collapsed state */}
                <div className="chat-collapsed-input-wrap">
                  <input
                    ref={collapsedInputRef}
                    type="text"
                    placeholder={t('chat.placeholder')}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onFocus={() => setBarExpanded(true)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                    className="chat-collapsed-input"
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                {/* Voice input button */}
                <button
                  className={`chat-collapsed-btn-circle ${isListening ? 'chat-collapsed-btn-active' : ''}`}
                  onClick={toggleListening}
                  aria-label="Voice input"
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  {isListening ? (
                    <span className="relative flex items-center justify-center" style={{ width: 18, height: 18 }}>
                      <span className="absolute w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                      <IconMicrophone size={18} className="relative z-10 text-red-400" />
                    </span>
                  ) : (
                    <IconMicrophone size={18} />
                  )}
                </button>

                {/* Send button */}
                <button
                  onClick={send}
                  disabled={loading || !hasInput}
                  className={`chat-collapsed-send ${hasInput ? 'chat-collapsed-send-active' : ''}`}
                  aria-label="Send message"
                >
                  {loading ? (
                    <IconSpinner size={16} />
                  ) : hasInput ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24"><rect x="4" y="8" width="2" height="8" rx="1" fill="currentColor"/><rect x="8" y="5" width="2" height="14" rx="1" fill="currentColor"/><rect x="12" y="9" width="2" height="6" rx="1" fill="currentColor"/><rect x="16" y="6" width="2" height="12" rx="1" fill="currentColor"/><rect x="20" y="10" width="2" height="4" rx="1" fill="currentColor"/></svg>
                  )}
                </button>
              </div>
            )}

            {/* ═══ EXPANDED STATE ═══ */}
            {barExpanded && (
              <div className="chat-container-expanded" ref={chatBarRef}>
                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  className="chat-textarea-expanded scrollbar-none"
                  placeholder={t('chat.placeholder')}
                  value={input}
                  onChange={e => { setInput(e.target.value); autoResize(e.target) }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  autoFocus
                />

                {/* Toolbar */}
                <div className="chat-toolbar-expanded">
                  {/* Left actions */}
                  <div className="chat-toolbar-left">
                    {/* Focus mode */}
                    <div className="relative" ref={focusDropdownRef}>
                      <button
                        className={`chat-toolbar-btn ${focusMode !== 'All' ? 'chat-toolbar-btn-active' : ''}`}
                        onClick={() => { setFocusDropdownOpen(!focusDropdownOpen); setProTypeDropdownOpen(false); setModelChipDropdownOpen(false) }}
                        title="Focus mode"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>

                      {focusDropdownOpen && (
                        <div className="chat-focus-dropdown">
                          {FOCUS_MODES.map(m => (
                            <button
                              key={m.id}
                              onClick={() => { setFocusMode(m.id); setFocusDropdownOpen(false) }}
                              className={`chat-focus-option ${m.id === focusMode ? 'chat-focus-option-active' : ''}`}
                            >
                              <span className="chat-focus-icon">{m.icon}</span>
                              <div className="chat-focus-text">
                                <span className="chat-focus-label">{t(m.labelKey)}</span>
                                <span className="chat-focus-desc">{t(m.descKey)}</span>
                              </div>
                              {m.id === focusMode && <IconCheck size={14} className="text-[#ef4444] shrink-0 ml-auto" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Attach file */}
                    <button
                      className="chat-toolbar-btn"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach file"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                    </button>

                    {/* Voice input */}
                    <button
                      className={`chat-toolbar-btn ${isListening ? 'chat-toolbar-btn-active' : ''}`}
                      onClick={toggleListening}
                      title={isListening ? 'Stop listening' : 'Voice input'}
                    >
                      {isListening ? (
                        <span className="relative flex items-center justify-center" style={{ width: 16, height: 16 }}>
                          <span className="absolute w-3.5 h-3.5 bg-red-500 rounded-full animate-pulse" />
                          <IconMicrophone size={16} className="relative z-10" />
                        </span>
                      ) : (
                        <IconMicrophone size={16} />
                      )}
                    </button>

                    {/* Model chip — model selector dropdown (logged in only) */}
                    {user && (
                    <div className="relative" ref={modelChipDropdownRef}>
                      <button
                        className="chat-model-chip"
                        onClick={() => { setModelChipDropdownOpen(!modelChipDropdownOpen); setFocusDropdownOpen(false); setProTypeDropdownOpen(false) }}
                        title={`Model: ${currentModel.name}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10A15 15 0 0 1 12 2z"/></svg>
                        <span>{currentModel.short}</span>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 5l3 3 3-3"/></svg>
                      </button>

                      {modelChipDropdownOpen && (
                        <div className="chat-model-dropdown">
                          {MODELS.map(m => (
                            <button
                              key={m.id}
                              onClick={() => { setModel(m.id); setModelChipDropdownOpen(false) }}
                              className={`chat-model-option ${m.id === model ? 'chat-model-option-active' : ''}`}
                            >
                              <div>
                                <div className="chat-model-name">{m.name}</div>
                                <div className="chat-model-tag">{m.tag}</div>
                              </div>
                              {m.id === model && <IconCheck size={14} className="text-red-500 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    )}
                  </div>

                  {/* Right actions */}
                  <div className="chat-toolbar-right">

                    {/* Pro toggle with dropup */}
                    <div className="relative" ref={proTypeDropdownRef}>
                      <div className="chat-pro-toggle">
                        <span className="chat-pro-label">Pro</span>
                        <label className="chat-switch">
                          <input
                            type="checkbox"
                            checked={proMode}
                            onChange={() => {
                              const newPro = !proMode
                              setProMode(newPro)
                              if (newPro) {
                                setProTypeDropdownOpen(true)
                                setFocusDropdownOpen(false)
                                setModelChipDropdownOpen(false)
                              } else {
                                setProTypeDropdownOpen(false)
                              }
                            }}
                          />
                          <span className="chat-slider round" />
                        </label>
                      </div>

                      {proMode && proTypeDropdownOpen && (
                        <div className="chat-pro-dropdown">
                          {PRO_MODES.map(m => (
                            <button
                              key={m.id}
                              onClick={() => { setProModeType(m.id); setProTypeDropdownOpen(false) }}
                              className={`chat-pro-option ${m.id === proModeType ? 'chat-pro-option-active' : ''}`}
                            >
                              <div className="chat-pro-text">
                                <span className="chat-pro-option-label">{t(m.labelKey)}</span>
                                <span className="chat-pro-option-desc">{t(m.descKey)}</span>
                              </div>
                              {m.id === proModeType && <IconCheck size={14} className="text-[#1d9bf0] shrink-0" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Submit button */}
                    <button
                      onClick={send}
                      disabled={loading || !hasInput}
                      className={`chat-submit-btn ${hasInput ? 'chat-submit-btn-active' : ''}`}
                      aria-label="Send message"
                    >
                      {loading ? (
                        <IconSpinner size={16} />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
        )}
      </div>

      {/* ── Microphone Permission Modal ── */}
      {micPermModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setMicPermModal(false)}>
          <div
            className="bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0">
                <IconMicrophone size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-[15px]">Microphone Access Required</h3>
                <p className="text-[12px] text-muted">Permission was previously denied</p>
              </div>
            </div>

            <p className="text-[13px] text-[#a3a3a3] mb-4 leading-relaxed">
              Your browser blocked microphone access for this site. You need to manually reset the permission to use voice input.
            </p>

            <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl p-4 mb-5">
              <p className="text-[11px] text-[#525252] uppercase tracking-wider font-medium mb-3">How to fix it</p>
              <div className="space-y-3 text-[13px] text-[#a3a3a3]">
                <div className="flex gap-3">
                  <span className="w-5 h-5 bg-[#1a1a1a] rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0">1</span>
                  <span>Click the <strong className="text-white">lock icon</strong> (or site settings) in your browser address bar</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 bg-[#1a1a1a] rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0">2</span>
                  <span>Find <strong className="text-white">Microphone</strong> in the permissions list</span>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 bg-[#1a1a1a] rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0">3</span>
                  <span>Change it from <strong className="text-red-400">Block</strong> to <strong className="text-green-400">Allow</strong></span>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 bg-[#1a1a1a] rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0">4</span>
                  <span>Click <strong className="text-white">Reload</strong> or refresh the page, then try again</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setMicPermModal(false)}
              className="w-full bg-[#1a1a1a] hover:bg-[#222222] text-white text-[13px] font-medium py-2.5 rounded-xl transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── Perplexity-style chat bar CSS ── */}
      <style jsx>{`
        /* ═══════════════════════════════════════
           COLLAPSED STATE — Floating pill bar
           ═══════════════════════════════════════ */
        .chat-bar-collapsed {
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.04);
          border-radius: 28px;
          padding: 8px 12px;
          gap: 8px;
          border: 1px solid rgba(255,255,255,0.06);
          min-height: 56px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .chat-bar-collapsed:focus-within {
          border-color: rgba(255,255,255,0.12);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.03);
        }

        .chat-collapsed-btn-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.04);
          color: #525252;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s ease, color 0.15s ease;
          padding: 0;
        }
        .chat-collapsed-btn-circle:hover {
          background: rgba(255,255,255,0.08);
          color: #e2e2e2;
        }
        .chat-collapsed-btn-active {
          background-color: rgba(220, 38, 38, 0.15) !important;
          color: #ef4444 !important;
        }

        .chat-collapsed-model-pill {
          display: none;
        }

        .chat-collapsed-input-wrap {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
        }
        .chat-collapsed-input {
          width: 100%;
          height: 36px;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          background: transparent;
          font-size: 16px;
          color: #e2e2e2;
          padding: 0 4px;
          font-family: inherit;
        }
        .chat-collapsed-input::placeholder {
          color: #525252;
          opacity: 1;
        }

        .chat-collapsed-send {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.06);
          color: #737373;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s ease, transform 0.1s ease, opacity 0.15s ease, color 0.15s ease;
          padding: 0;
        }
        .chat-collapsed-send:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .chat-collapsed-send-active {
          background: #e2e2e2;
          color: #0a0a0a;
        }
        .chat-collapsed-send-active:hover {
          background: #ffffff;
          transform: scale(1.05);
        }
        .chat-collapsed-send-active:active {
          transform: scale(0.95);
        }

        /* ═══════════════════════════════════════
           EXPANDED STATE — Floating pill with chips
           ═══════════════════════════════════════ */
        .chat-container-expanded {
          width: 100%;
          background-color: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 16px 16px 10px 16px;
          display: flex;
          flex-direction: column;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          animation: expandBar 0.25s ease-out;
          overflow: visible;
        }
        @keyframes expandBar {
          from {
            opacity: 0.7;
            transform: scaleY(0.95);
            transform-origin: bottom;
          }
          to {
            opacity: 1;
            transform: scaleY(1);
            transform-origin: bottom;
          }
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
        .chat-toolbar-btn-active {
          background-color: rgba(220, 38, 38, 0.12) !important;
          color: #ef4444 !important;
        }
        .chat-toolbar-btn-active:hover {
          background-color: rgba(220, 38, 38, 0.18) !important;
          color: #f87171 !important;
        }

        /* ── Model chip (visible button with model name) ── */
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

        /* ── Model dropdown (reuses toolbar-btn) ── */

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
        @keyframes dropUpRight {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
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
        .chat-model-option:hover .chat-model-name {
          color: #e2e2e2;
        }
        .chat-model-tag {
          font-size: 11px;
          color: #525252;
          margin-top: 1px;
        }

        /* ── Focus mode dropdown ── */
        .chat-focus-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          width: 260px;
          background: #0f0f0f;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          z-index: 100;
          padding: 4px 0;
          animation: dropUp 0.15s ease-out;
        }
        .chat-focus-option {
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: background 0.15s;
          border: none;
          background: none;
          cursor: pointer;
          font-family: inherit;
        }
        .chat-focus-option:hover {
          background: rgba(255,255,255,0.04);
        }
        .chat-focus-option-active {
          background: rgba(255,255,255,0.04) !important;
        }
        .chat-focus-icon {
          font-size: 16px;
          width: 24px;
          text-align: center;
          flex-shrink: 0;
        }
        .chat-focus-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .chat-focus-label {
          font-size: 13px;
          font-weight: 500;
          color: #e2e2e2;
        }
        .chat-focus-option:not(.chat-focus-option-active) .chat-focus-label {
          color: #a3a3a3;
        }
        .chat-focus-option:hover .chat-focus-label {
          color: #e2e2e2;
        }
        .chat-focus-desc {
          font-size: 11px;
          color: #525252;
          margin-top: 1px;
        }

        /* ── Pro toggle ── */
        .chat-pro-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px 4px 0;
          flex-shrink: 0;
        }
        .chat-pro-label {
          font-size: 13px;
          font-weight: 600;
          color: #525252;
        }
        .chat-switch {
          position: relative;
          display: inline-block;
          width: 38px;
          height: 22px;
        }
        .chat-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .chat-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255,255,255,0.08);
          transition: 0.2s;
          border-radius: 34px;
        }
        .chat-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 3px;
          bottom: 3px;
          background-color: #525252;
          transition: 0.2s;
          border-radius: 50%;
        }
        .chat-switch input:checked + .chat-slider {
          background-color: #1d9bf0;
        }
        .chat-switch input:checked + .chat-slider:before {
          transform: translateX(16px);
          background-color: white;
        }

        /* ── Pro mode dropdown ── */
        .chat-pro-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          width: 260px;
          background: #0f0f0f;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          z-index: 100;
          padding: 4px 0;
          animation: dropUpRight 0.15s ease-out;
        }
        .chat-pro-option {
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: background 0.15s;
          border: none;
          background: none;
          cursor: pointer;
          font-family: inherit;
        }
        .chat-pro-option:hover {
          background: rgba(255,255,255,0.04);
        }
        .chat-pro-option-active {
          background: rgba(255,255,255,0.04) !important;
        }
        .chat-pro-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .chat-pro-option-label {
          font-size: 13px;
          font-weight: 500;
          color: #e2e2e2;
        }
        .chat-pro-option:not(.chat-pro-option-active) .chat-pro-option-label {
          color: #a3a3a3;
        }
        .chat-pro-option:hover .chat-pro-option-label {
          color: #e2e2e2;
        }
        .chat-pro-option-desc {
          font-size: 11px;
          color: #525252;
          margin-top: 1px;
        }

        /* ── Submit button ── */
        .chat-submit-btn {
          background-color: rgba(255,255,255,0.06);
          color: #737373;
          border: none;
          outline: none;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: background-color 0.2s, color 0.2s, transform 0.15s;
        }
        .chat-submit-btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        .chat-submit-btn-active {
          background-color: #e2e2e2;
          color: #0a0a0a;
        }
        .chat-submit-btn-active:hover {
          background-color: #ffffff;
          transform: scale(1.05);
        }
        .chat-submit-btn-active:active {
          transform: scale(0.95);
        }

        /* ═══════════════════════════════════════
           MORPHING BRAND MARK — Pencil Sketch Style
           ═══════════════════════════════════════ */
        .morph-logo-container {
          animation: morphBreathe 6s ease-in-out infinite;
          transition: opacity 0.6s ease;
        }
        .morph-logo-settled {
          animation: none;
          opacity: 0.5;
        }
        @keyframes morphBreathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: 1; }
        }

        /* Shape containers */
        .morph-shape {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.5s ease;
        }
        .morph-shape-active {
          opacity: 1;
          animation: sketchWobble 1.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        /* Wobble: subtle hand-drawn shake as the pencil draws */
        @keyframes sketchWobble {
          0%   { transform: scale(0.92) rotate(-3deg); opacity: 0; }
          8%   { opacity: 1; }
          15%  { transform: scale(1.02) rotate(1.5deg); }
          25%  { transform: scale(0.98) rotate(-0.8deg); }
          40%  { transform: scale(1.01) rotate(0.4deg); }
          60%  { transform: scale(0.995) rotate(-0.15deg); }
          80%  { transform: scale(1.002) rotate(0.05deg); }
          100% { transform: scale(1) rotate(0deg); }
        }

        /* ── Pencil stroke-draw on all SVG elements ── */
        /* Hidden by default — full dashoffset hides the stroke */
        .morph-shape :global(path),
        .morph-shape :global(rect),
        .morph-shape :global(circle),
        .morph-shape :global(line) {
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          transition: none;
        }

        /* When active — pencil draws each stroke in with staggered delays */
        .morph-shape-active :global(path) {
          animation: pencilStroke 1.4s ease-out forwards;
        }
        .morph-shape-active :global(path:nth-child(1)) {
          animation-delay: 0s;
        }
        .morph-shape-active :global(path:nth-child(2)) {
          animation-delay: 0.3s;
        }
        .morph-shape-active :global(path:nth-child(3)) {
          animation-delay: 0.55s;
        }

        .morph-shape-active :global(rect) {
          animation: pencilStroke 1s ease-out forwards;
        }
        .morph-shape-active :global(rect:nth-child(1)) {
          animation-delay: 0s;
        }
        .morph-shape-active :global(rect:nth-child(2)) {
          animation-delay: 0.25s;
        }
        .morph-shape-active :global(rect:nth-child(3)) {
          animation-delay: 0.5s;
        }

        .morph-shape-active :global(circle) {
          animation: pencilStroke 0.8s ease-out forwards;
        }
        .morph-shape-active :global(circle:nth-child(1)) {
          animation-delay: 0s;
        }
        .morph-shape-active :global(circle:nth-child(2)) {
          animation-delay: 0.3s;
        }
        .morph-shape-active :global(circle:nth-child(3)) {
          animation-delay: 0.55s;
        }

        .morph-shape-active :global(line) {
          animation: pencilStroke 0.7s ease-out forwards;
          animation-delay: 0.6s;
        }

        /* The actual stroke-drawing keyframe */
        @keyframes pencilStroke {
          0%   { stroke-dashoffset: 200; }
          100% { stroke-dashoffset: 0; }
        }

        /* ═══════════════════════════════════════
           MOBILE RESPONSIVE — Fit toolbar on small screens
           ═══════════════════════════════════════ */
        @media (max-width: 640px) {
          .chat-toolbar-expanded {
            gap: 2px;
            min-height: 34px;
          }
          .chat-toolbar-left {
            gap: 1px;
            flex-wrap: nowrap;
            overflow: visible;
          }
          .chat-toolbar-right {
            gap: 3px;
          }
          .chat-toolbar-btn {
            width: 28px;
            height: 28px;
            padding: 4px;
          }
          .chat-toolbar-btn svg {
            width: 14px;
            height: 14px;
          }
          .chat-pro-toggle {
            gap: 3px;
            padding: 2px 4px 2px 0;
          }
          .chat-pro-label {
            font-size: 11px;
          }
          .chat-switch {
            width: 30px;
            height: 18px;
          }
          .chat-slider:before {
            height: 12px;
            width: 12px;
          }
          .chat-switch input:checked + .chat-slider:before {
            transform: translateX(12px);
          }
          .chat-submit-btn {
            width: 30px;
            height: 30px;
          }
          .chat-container-expanded {
            padding: 12px 10px 8px 10px;
            border-radius: 16px;
          }
          .chat-textarea-expanded {
            font-size: 15px;
            min-height: 48px;
            margin-bottom: 8px;
          }
          .chat-focus-dropdown,
          .chat-model-dropdown {
            left: 0;
            transform: none;
          }
          .chat-focus-dropdown {
            animation: dropUpRight 0.15s ease-out;
          }
          .chat-model-dropdown {
            animation: dropUpRight 0.15s ease-out;
          }
        }

        /* ═══════════════════════════════════════
           LIVE TERMINAL
           ═══════════════════════════════════════ */
        .terminal-output {
          overscroll-behavior: contain;
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
        }
        .terminal-output::-webkit-scrollbar { width: 3px; }
        .terminal-output::-webkit-scrollbar-thumb { background: #262626; border-radius: 2px; }
        .terminal-output::-webkit-scrollbar-track { background: transparent; }
        .terminal-input {
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
        }
        .terminal-input:focus {
          outline: none;
          border: none;
          box-shadow: none;
        }
      `}</style>
    </main>
  )
}
