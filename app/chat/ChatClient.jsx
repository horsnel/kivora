'use client'
import Link from 'next/link'
import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { IconSend, IconSpinner, IconCopy, IconCheck, IconChat, IconMenu, IconClose, IconPlus, IconUser, IconMoney, IconLightning, IconCode, IconBulb, IconTool, IconGlobe, IconSearch, IconPaperclip, IconDownload, IconLock, IconFile, IconChevronDown, IconMicrophone, IconSpeaker, IconSliders } from '@/components/Icons'
import { useSessionTracker } from '@/lib/useSessionTracker'
import { supabasePublic } from '@/lib/supabase'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { useTranslation } from '@/components/LanguageProvider'

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
  { labelKey: 'chat.starter.whatsapp', icon: IconChat },
  { labelKey: 'chat.starter.saas', icon: IconLightning },
  { labelKey: 'chat.starter.automation', icon: IconMoney },
  { labelKey: 'chat.starter.n8n', icon: IconTool },
  { labelKey: 'chat.starter.content', icon: IconCode },
  { labelKey: 'chat.starter.freelancing', icon: IconBulb },
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

  // Feature #2: Chat Export
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)

  // Feature: Voice Input / TTS Output
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speakingIndex, setSpeakingIndex] = useState(null)
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
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const customizeRef = useRef(null)
  const customPromptTextareaRef = useRef(null)

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

  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const collapsedInputRef = useRef(null)
  const historyRef = useRef(null)
  const modelDropdownRef = useRef(null)
  const exportDropdownRef = useRef(null)
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

  // Close export dropdown on click outside
  useEffect(() => {
    if (!exportDropdownOpen) return
    function handleClick(e) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setExportDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [exportDropdownOpen])

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

  // Close customize popover on click outside
  useEffect(() => {
    if (!customizeOpen) return
    function handleClick(e) {
      if (customizeRef.current && !customizeRef.current.contains(e.target)) {
        setCustomizeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [customizeOpen])

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      if (voiceToastTimer.current) clearTimeout(voiceToastTimer.current)
    }
  }, [])

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
    setExportDropdownOpen(false)

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
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.error || t('chat.error.general') }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: t('chat.error.network') }])
    }
    setLoading(false)
  }

  function copy(content, i) {
    navigator.clipboard.writeText(content)
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

  // ── TTS Output ──
  function toggleSpeaking(content, index) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    // If already speaking this message, stop it
    if (isSpeaking && speakingIndex === index) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      setSpeakingIndex(null)
      return
    }

    // Stop any existing speech
    window.speechSynthesis.cancel()

    // Strip markdown-ish formatting for cleaner TTS
    const plainText = content
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/`[^`]+`/g, ' code ')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*>\s*/gm, '')
      .replace(/^---$/gm, '')
      .replace(/\|/g, ' ')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim()

    const utterance = new SpeechSynthesisUtterance(plainText)
    utterance.rate = 1.0
    utterance.pitch = 1.0

    utterance.onend = () => {
      setIsSpeaking(false)
      setSpeakingIndex(null)
    }
    utterance.onerror = () => {
      setIsSpeaking(false)
      setSpeakingIndex(null)
    }

    setIsSpeaking(true)
    setSpeakingIndex(index)
    window.speechSynthesis.speak(utterance)
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

  return (
    <main className="h-full flex bg-[#0a0a0a]">
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
            <Link href="/discover" className="flex items-center gap-2.5" onClick={() => setHistoryOpen(false)}>
              <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white" />
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
            href="/home"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              false
                ? 'bg-[#1a1a1a] text-white'
                : 'text-[#737373] hover:text-white hover:bg-[#141414]'
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
          ) : (
            <div className="px-1 pt-2">
              <Link
                href="/auth"
                className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-caption py-2 rounded-lg transition-colors font-semibold w-full"
                onClick={() => setHistoryOpen(false)}
              >
                <IconUser size={12} />
                {t('chat.history.signin')}
              </Link>
            </div>
          )}
        </div>

        {/* ── Profile avatar only — pinned to bottom ── */}
        <div className="p-2.5 border-t border-[#181818] shrink-0">
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
        <div className="border-b border-[#141414] px-4 py-2.5 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden w-8 h-8 flex items-center justify-center text-[#525252] hover:text-white transition-colors -ml-1"
              onClick={() => setHistoryOpen(true)}
              aria-label={t('chat.history')}
            >
              <IconMenu size={14} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 bg-red-600 rounded-md flex items-center justify-center shrink-0">
                <IconChat size={12} className="text-white" />
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <h1 className="font-semibold text-caption leading-none">{t('chat.title')}</h1>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* ── System Prompt Customize Button ── */}
            <div className="relative" ref={customizeRef}>
              <button
                onClick={() => setCustomizeOpen(!customizeOpen)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                  customSystemPrompt
                    ? 'text-red-400 bg-red-500/10 hover:bg-red-500/15'
                    : 'text-[#525252] hover:text-white hover:bg-[#141414]'
                }`}
                aria-label="Customize system prompt"
                title="Customize AI persona"
              >
                <IconSliders size={14} />
              </button>

              {customizeOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-72 bg-[#141414] border border-[#262626] rounded-xl shadow-2xl z-50 p-3 animate-scale-in overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-body-sm font-medium text-[#737373]">{t('chat.custom_prompt')}</span>
                    <button
                      onClick={resetCustomSystemPrompt}
                      className="text-[11px] text-[#525252] hover:text-red-400 transition-colors"
                    >
                      {t('chat.custom_prompt.reset')}
                    </button>
                  </div>
                  <textarea
                    ref={customPromptTextareaRef}
                    rows={4}
                    className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2 text-body-sm text-[#d4d4d4] placeholder-[#525252] resize-none outline-none focus:border-[#3a3a3a] transition-colors"
                    placeholder="e.g. You are a sarcastic coding mentor. Always use Python examples..."
                    value={customSystemPrompt}
                    onChange={e => saveCustomSystemPrompt(e.target.value)}
                  />
                  <p className="text-[11px] text-[#525252] mt-1.5">{t('chat.custom_prompt.hint')}</p>
                </div>
              )}
            </div>

            {/* ── Feature #2: Export Button ── */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                className="w-8 h-8 flex items-center justify-center text-[#525252] hover:text-white hover:bg-[#141414] rounded-lg transition-colors"
                aria-label="Export chat"
                title="Export chat"
              >
                <IconDownload size={14} />
              </button>

              {exportDropdownOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-48 bg-[#141414] border border-[#262626] rounded-xl shadow-2xl z-50 py-1 animate-scale-in overflow-hidden">
                  <button
                    onClick={() => exportChat('md')}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 text-body-sm text-[#a3a3a3] hover:bg-[#1a1a1a] hover:text-white transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2h10v12H3z"/><path d="M5 5h6M5 8h4M5 11h6"/></svg>
                    {t('chat.export.md')}
                  </button>
                  <button
                    onClick={() => exportChat('txt')}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 text-body-sm text-[#a3a3a3] hover:bg-[#1a1a1a] hover:text-white transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2h5l4 4v7a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M9 2v4h4"/></svg>
                    {t('chat.export.txt')}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={clearChat}
              className="w-8 h-8 flex items-center justify-center text-[#525252] hover:text-white hover:bg-[#141414] rounded-lg transition-colors"
              aria-label={t('chat.new')}
              title={t('chat.new')}
            >
              <IconPlus size={14} />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto overscroll-behavior-contain">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.length === 0 && (
              <div className="text-center py-10 sm:py-16">
                <div className="w-14 h-14 bg-[#141414] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <IconChat size={20} className="text-[#525252]" />
                </div>
                <h2 className="font-semibold text-headline mb-2 tracking-tight text-[#737373]">{t('chat.empty.title')}</h2>
                <p className="text-muted text-body mb-8 max-w-xs mx-auto leading-relaxed">
                  {t('chat.empty.subtitle')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-w-lg mx-auto">
                  {STARTERS.map(({ labelKey, icon: Icon }) => (
                    <button
                      key={labelKey}
                      onClick={() => setInput(t(labelKey))}
                      className="flex items-center gap-3 bg-transparent border border-white/[0.08] hover:border-white/[0.15] hover:bg-[#141414] rounded-xl px-4 py-3.5 text-muted hover:text-white text-left transition-all leading-snug"
                    >
                      <Icon size={14} className="text-[#525252] shrink-0" />
                      <span className="text-body-sm">{t(labelKey)}</span>
                    </button>
                  ))}
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
                        <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#262626] rounded-lg px-2.5 py-1 text-[11px] text-[#737373]">
                          <IconFile size={10} />
                          <span>{attachmentName}</span>
                        </div>
                      </div>
                    )}
                    {hasImageAttachment && (
                      <div className="flex items-center gap-1.5 mb-1.5 justify-end">
                        <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#262626] rounded-lg px-2.5 py-1 text-[11px] text-[#737373]">
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="5.5" r="1.5"/><path d="M2 11l3.5-3.5 2.5 2.5 2-2L14 11"/></svg>
                          <span>{attachmentName}</span>
                        </div>
                      </div>
                    )}
                    <div className={`rounded-xl px-4 py-3 text-body leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-red-600 text-white rounded-tr-sm'
                        : 'bg-[#141414] border border-white/[0.06] text-[#d4d4d4] rounded-tl-sm'
                    }`}>
                      {msg.role === 'assistant'
                        ? <MarkdownRenderer content={msg.content} />
                        : <span>{displayContent}</span>
                      }
                    </div>
                    {msg.role === 'assistant' && (
                      <div className="opacity-0 group-hover:opacity-100 mt-1.5 flex items-center gap-3 transition-all">
                        <button
                          onClick={() => copy(msg.content, i)}
                          className="flex items-center gap-1 text-caption text-muted2 hover:text-muted transition-colors"
                        >
                          {copiedIndex === i ? <IconCheck size={12} /> : <IconCopy size={12} />}
                          {copiedIndex === i ? t('common.copied') : t('common.copy')}
                        </button>
                        {typeof window !== 'undefined' && window.speechSynthesis && (
                          <button
                            onClick={() => toggleSpeaking(msg.content, i)}
                            className={`flex items-center gap-1 text-caption transition-colors ${
                              isSpeaking && speakingIndex === i
                                ? 'text-red-400 hover:text-red-300'
                                : 'text-muted2 hover:text-muted'
                            }`}
                          >
                            <IconSpeaker size={12} />
                            {isSpeaking && speakingIndex === i ? t('chat.stop') : t('chat.read_aloud')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

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

        {/* ── Expandable Chat Bar ────────────────────── */}
        <div className="shrink-0 px-4 pb-4 pt-2" style={{ overflow: 'visible' }}>
          <div className="max-w-3xl mx-auto" style={{ overflow: 'visible' }}>
            {/* Voice toast notification */}
            {voiceToast && (
              <div className={`mb-2 flex items-center justify-center animate-slide-down`}>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium ${
                  voiceToast.type === 'error'
                    ? 'bg-red-950/60 border border-red-900/40 text-red-400'
                    : 'bg-[#1a1a1a] border border-[#262626] text-[#a3a3a3]'
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
                <div className="flex items-center gap-1.5 bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-1.5 text-[12px] text-[#a3a3a3]">
                  {attachedIsImage ? (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="5.5" r="1.5"/><path d="M2 11l3.5-3.5 2.5 2.5 2-2L14 11"/></svg>
                  ) : (
                    <IconFile size={12} />
                  )}
                  <span className="max-w-[120px] truncate">{attachedFile}</span>
                  <button
                    onClick={removeAttachment}
                    className="ml-0.5 text-[#525252] hover:text-white transition-colors"
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
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

            <p className="text-[11px] text-[#2e2e2e] text-center mt-2.5">{t('chat.disclaimer')}</p>
          </div>
        </div>
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
                <p className="text-[12px] text-[#737373]">Permission was previously denied</p>
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
           COLLAPSED STATE — Single-row bar
           ═══════════════════════════════════════ */
        .chat-bar-collapsed {
          display: flex;
          align-items: center;
          background: #202222;
          border-radius: 28px;
          padding: 8px 12px;
          gap: 8px;
          border: 1px solid #2f3232;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .chat-bar-collapsed:focus-within {
          border-color: #4c4f4f;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.03);
        }

        .chat-collapsed-btn-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: #2d3030;
          color: #8a8f8f;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s ease, color 0.15s ease;
          padding: 0;
        }
        .chat-collapsed-btn-circle:hover {
          background: #3a3d3d;
          color: #e3e3e3;
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
          color: #e3e3e3;
          padding: 0 4px;
          font-family: inherit;
        }
        .chat-collapsed-input::placeholder {
          color: #8a8f8f;
          opacity: 1;
        }

        .chat-collapsed-send {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: #dc2626;
          color: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s ease, transform 0.1s ease, opacity 0.15s ease;
          padding: 0;
        }
        .chat-collapsed-send:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .chat-collapsed-send-active {
          background: #dc2626;
        }
        .chat-collapsed-send-active:hover {
          background: #b91c1c;
          transform: scale(1.05);
        }
        .chat-collapsed-send-active:active {
          transform: scale(0.95);
        }

        /* ═══════════════════════════════════════
           EXPANDED STATE — Full Perplexity-style
           ═══════════════════════════════════════ */
        .chat-container-expanded {
          width: 100%;
          background-color: #202222;
          border: 1px solid #2f3232;
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
          border-color: #4c4f4f;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.03);
        }

        .chat-textarea-expanded {
          width: 100%;
          background: transparent;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          color: #e3e3e3;
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
          color: #8a8f8f;
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
          color: #8a8f8f;
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
          background-color: #2d3030;
          color: #e3e3e3;
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
          border: 1px solid #2f3232;
          background: #2d3030;
          color: #8a8f8f;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          font-family: inherit;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .chat-model-chip:hover {
          border-color: #4c4f4f;
          color: #c0c4c4;
          background: #363939;
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
          background: #141414;
          border: 1px solid #262626;
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
          background: #1a1a1a;
        }
        .chat-model-option-active {
          background: #1a1a1a !important;
        }
        .chat-model-name {
          font-size: 13px;
          font-weight: 500;
          color: #e3e3e3;
        }
        .chat-model-option:not(.chat-model-option-active) .chat-model-name {
          color: #a3a3a3;
        }
        .chat-model-option:hover .chat-model-name {
          color: #ffffff;
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
          background: #141414;
          border: 1px solid #262626;
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
          background: #1a1a1a;
        }
        .chat-focus-option-active {
          background: #1a1a1a !important;
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
          color: #e3e3e3;
        }
        .chat-focus-option:not(.chat-focus-option-active) .chat-focus-label {
          color: #a3a3a3;
        }
        .chat-focus-option:hover .chat-focus-label {
          color: #ffffff;
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
          color: #8a8f8f;
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
          background-color: #2f3232;
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
          background-color: #8a8f8f;
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
          background: #141414;
          border: 1px solid #262626;
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
          background: #1a1a1a;
        }
        .chat-pro-option-active {
          background: #1a1a1a !important;
        }
        .chat-pro-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .chat-pro-option-label {
          font-size: 13px;
          font-weight: 500;
          color: #e3e3e3;
        }
        .chat-pro-option:not(.chat-pro-option-active) .chat-pro-option-label {
          color: #a3a3a3;
        }
        .chat-pro-option:hover .chat-pro-option-label {
          color: #ffffff;
        }
        .chat-pro-option-desc {
          font-size: 11px;
          color: #525252;
          margin-top: 1px;
        }

        /* ── Submit button ── */
        .chat-submit-btn {
          background-color: #2f3232;
          color: #8a8f8f;
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
      `}</style>
    </main>
  )
}
