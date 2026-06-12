'use client'
import Link from 'next/link'
import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { IconSend, IconSpinner, IconCopy, IconCheck, IconChat, IconMenu, IconClose, IconUser, IconMoney, IconLightning, IconCode, IconBulb, IconBook, IconTool, IconGlobe, IconSearch, IconPaperclip, IconDownload, IconLock, IconFile, IconChevronDown, IconMicrophone, IconSliders, IconSettings, IconCopy as IconClipboard, IconWrite, IconFilter, IconRobot, IconTarget, IconDatabase, IconStack, IconSpeaker, IconArrowLeft, IconArrowRight, IconCube } from '@/components/Icons'
import { useSessionTracker } from '@/lib/useSessionTracker'
import { supabasePublic } from '@/lib/supabase'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import ArtifactViewer from '@/components/ArtifactViewer'
import ThinkingState, { STAGE_CONFIGS } from '@/components/ThinkingState'
import VoiceOutput from '@/components/VoiceOutput'
import VoiceSettings from '@/components/VoiceSettings'
import { useVoiceTTS } from '@/hooks/useVoiceTTS'
import { useTranslation } from '@/components/LanguageProvider'
import { stripMarkdown } from '@/lib/stripMarkdown'



const MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Nova 2.3', tag: 'Premium · Detailed', short: 'Nova 2.3' },
  { id: 'llama-3.1-8b-instant', name: 'Nova 1.7', tag: 'Free · Fast', short: 'Nova 1.7' },
  { id: 'llama3-70b-8192', name: 'Nova 2.3 Pro', tag: 'Extended context', short: '2.3 Pro' },
  { id: 'mixtral-8x7b-32768', name: 'Nova 2.3 Mix', tag: 'Long context', short: '2.3 Mix' },
  { id: 'gemma2-9b-it', name: 'Nova 1.7 Lite', tag: 'Efficient', short: '1.7 Lite' },
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
  // 1: Open book — learning / knowledge
  <g key="book" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" fill="none">
    <path d="M4 5.5h6a4 4 0 014 4v14a3 3 0 00-3-3H4z" />
    <path d="M28 5.5h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
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
  // 4: Stacked layers — composition / depth
  <g key="layers" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" fill="none">
    <polygon points="16,4 4,10 16,16 28,10" />
    <polyline points="4,16 16,22 28,16" />
    <polyline points="4,22 16,28 28,22" />
  </g>,
]

const FOCUS_MODES = [
  { id: 'All', labelKey: 'chat.focus.all', descKey: 'chat.focus.all.desc', Icon: IconSearch },
  { id: 'Academic', labelKey: 'chat.focus.academic', descKey: 'chat.focus.academic.desc', Icon: IconBook },
  { id: 'Writing', labelKey: 'chat.focus.writing', descKey: 'chat.focus.writing.desc', Icon: IconWrite },
  { id: 'Math', labelKey: 'chat.focus.math', descKey: 'chat.focus.math.desc', Icon: IconTarget },
  { id: 'Code', labelKey: 'chat.focus.code', descKey: 'chat.focus.code.desc', Icon: IconCode },
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
  const [thinkingConfig, setThinkingConfig] = useState('chat')
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

  // ── Voice TTS (Text-to-Speech) ──
  const tts = useVoiceTTS()
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false)

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
  const [settingsStack, setSettingsStack] = useState(['root']) // Navigation stack: ['root'] | ['root', 'model'] | ['root', 'model', 'effort'] etc
  const [settingsCurrentPage, setSettingsCurrentPage] = useState('root')
  const [settingsSlideDir, setSettingsSlideDir] = useState('push') // 'push' | 'pop'
  const [settingsExportFormat, setSettingsExportFormat] = useState('md')
  const [settingsPromptSaved, setSettingsPromptSaved] = useState(false)
  const [settingsExported, setSettingsExported] = useState(false)

  // Settings navigation helpers with slide direction
  const settingsPush = useCallback((page) => {
    setSettingsSlideDir('push')
    setSettingsStack(prev => [...prev, page])
    setSettingsCurrentPage(page)
  }, [])
  const settingsPop = useCallback(() => {
    if (settingsStack.length <= 1) return
    setSettingsSlideDir('pop')
    const prevPage = settingsStack[settingsStack.length - 2]
    setSettingsStack(prev => prev.slice(0, -1))
    setSettingsCurrentPage(prevPage)
  }, [settingsStack])
  const settingsReset = useCallback(() => {
    setSettingsStack(['root'])
    setSettingsCurrentPage('root')
    setSettingsSlideDir('push')
  }, [])

  // Escape key + swipe-to-go-back for settings sheet
  useEffect(() => {
    if (!settingsOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (settingsStack.length > 1) settingsPop()
        else { setSettingsOpen(false); settingsReset() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [settingsOpen, settingsStack, settingsPop, settingsReset])

  // ── Artifacts (Claude-style side panel) ──
  const [activeArtifact, setActiveArtifact] = useState(null) // { type, title, code }
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false)



  const bottomRef = useRef(null)
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

  // Overlay onClick handles closing — no separate mousedown listener needed

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
  async function exportChat(format) {
    if (messages.length === 0) return
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const currentModel = MODELS.find(m => m.id === model)
    const modelName = currentModel?.name || model

    try {
      const { exportChatAsPDF, exportChatAsDOCX, downloadBlob } = await import('@/lib/fileExportHeavy')
      const { exportChatAsHTML } = await import('@/lib/fileExportClient')

      if (format === 'pdf') {
        const blob = await exportChatAsPDF(messages, modelName)
        downloadBlob(blob, `kivora-chat-${dateStr}.pdf`)
      } else if (format === 'docx') {
        const blob = await exportChatAsDOCX(messages, modelName)
        downloadBlob(blob, `kivora-chat-${dateStr}.docx`)
      } else if (format === 'html') {
        const blob = exportChatAsHTML(messages, modelName)
        downloadBlob(blob, `kivora-chat-${dateStr}.html`)
      } else {
        // MD and TXT — no external deps needed
        let content = ''
        if (format === 'md') {
          content = `# Kivora AI Chat Export\n\n`
          content += `**Date:** ${dateStr} ${timeStr}\n`
          content += `**Model:** ${modelName}\n\n`
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
          content += `Model: ${modelName}\n`
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
        downloadBlob(blob, `kivora-chat-${dateStr}.${format}`)
      }
    } catch (err) {
      console.error('Export failed:', err)
    }
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
    // Store image data separately for display rendering (avoids embedding base64 in content string for display)
    if (attachedIsImage && attachedContent) {
      userMsg.userImageData = attachedContent
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Capture attachment state before clearing
    const wasImage = attachedIsImage

    // Select thinking stage config based on context
    if (wasImage) {
      setThinkingConfig('chatWithVision')
    } else if (webSearch) {
      setThinkingConfig(focusMode === 'Academic' ? 'academicSearch' : 'chatWithSearch')
    } else if (focusMode === 'Code') {
      setThinkingConfig('chatWithCode')
    } else if (focusMode === 'Academic') {
      setThinkingConfig('academic')
    } else if (focusMode === 'Writing') {
      setThinkingConfig('writing')
    } else if (focusMode === 'Math') {
      setThinkingConfig('math')
    } else {
      setThinkingConfig('chat')
    }
    setLoading(true)

    // Collapse bar after sending
    setBarExpanded(false)

    // Clear attachment after sending
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
          systemPrompt: customSystemPrompt || undefined,
          focusMode: focusMode || 'All',
          proMode: proMode || false,
          proModeType: proMode ? proModeType : undefined
        })
      })
      const data = await res.json()
      const assistantMsg = { role: 'assistant', content: data.reply || data.error || t('chat.error.general') }
      if (data.quotaExceeded) {
        assistantMsg.quotaExceeded = true
      }
      if (data.searchUsed) {
        assistantMsg.searchUsed = true
        assistantMsg.searchQuery = data.searchQuery || ''
      }
      if (data.codeExecuted) {
        assistantMsg.codeExecuted = true
      }
      if (data.sandboxUsed) {
        assistantMsg.sandboxUsed = true
      }
      if (data.gpuUsed) {
        assistantMsg.gpuUsed = true
        assistantMsg.accelerator = data.accelerator || 'T4'
      }
      if (data.remoteExecUsed) {
        assistantMsg.remoteExecUsed = true
        assistantMsg.execLanguage = data.execLanguage || 'python'
      }
      if (data.downloadFile) {
        assistantMsg.downloadFile = data.downloadFile
      }
      if (data.urlRead) {
        assistantMsg.urlRead = true
        assistantMsg.urlReadSource = data.urlReadSource || ''
      }
      if (data.imageGenerated) {
        assistantMsg.isImage = true
        assistantMsg.imageData = data.imageData
        assistantMsg.imagePrompt = data.imagePrompt
        assistantMsg.imageModel = 'flux'
        assistantMsg.imageSize = '1024x1024'
      }
      if (data.artifacts && data.artifacts.length > 0) {
        assistantMsg.artifacts = data.artifacts
      }
      if (data.opportunityCards && data.opportunityCards.length > 0) {
        assistantMsg.opportunityCards = data.opportunityCards
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

  return (
    <main className="h-dvh flex bg-[#0a0a0a] overflow-hidden">
      {/* ── Artifact Side Panel (desktop) ── */}
      {artifactPanelOpen && activeArtifact && (
        <div className="w-[480px] shrink-0 hidden lg:block">
          <ArtifactViewer
            artifact={activeArtifact}
            onClose={() => { setArtifactPanelOpen(false); setActiveArtifact(null) }}
          />
        </div>
      )}
      {/* ── Artifact Side Panel (mobile overlay) ── */}
      {artifactPanelOpen && activeArtifact && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setArtifactPanelOpen(false); setActiveArtifact(null) }} />
          <div className="absolute inset-x-0 bottom-0 top-12 bg-[#0f0f0f] border-t border-[#181818] rounded-t-2xl overflow-hidden">
            <ArtifactViewer
              artifact={activeArtifact}
              onClose={() => { setArtifactPanelOpen(false); setActiveArtifact(null) }}
            />
          </div>
        </div>
      )}
      {/* ── Chat Sidebar ── */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setHistoryOpen(false)} />
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
            <Link href="/research" className="flex items-center gap-2.5" onClick={() => setHistoryOpen(false)}>
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
              <IconClose size={18} />
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
            <IconSearch size={18} className="shrink-0" />
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

        {/* ── Settings toggle + Profile avatar — pinned to bottom ── */}
        <div className="p-2.5 border-t border-[#181818] shrink-0 space-y-0.5">
          <button
            onClick={() => { setSettingsOpen(!settingsOpen); if (!settingsOpen) settingsReset() }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors font-medium ${
              settingsOpen
                ? 'bg-[#1a1a1a] text-white'
                : 'text-muted hover:text-white hover:bg-[#141414]'
            }`}
          >
            <IconSettings size={20} className="shrink-0" />
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
              <IconUser size={18} />
              {t('nav.signin') || 'Sign in'}
            </Link>
          )}
        </div>
      </aside>

      {/* ── Settings bottom sheet (Claude AI style) — at root level so it's not constrained by sidebar ── */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60"
          onClick={() => { setSettingsOpen(false); settingsReset() }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 h-[92vh] bg-[#1a1a1a] rounded-t-[24px] flex flex-col overflow-hidden animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#444]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-center px-4 py-2 relative min-h-[44px] shrink-0">
              {settingsCurrentPage !== 'root' ? (
                <button
                  onClick={settingsPop}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/8 transition-colors"
                >
                  <IconArrowLeft size={16} className="text-[#ccc]" />
                </button>
              ) : (
                <button
                  onClick={() => { setSettingsOpen(false); settingsReset() }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/8 transition-colors"
                >
                  <IconClose size={16} className="text-[#ccc]" />
                </button>
              )}
              <span className="text-[17px] font-semibold tracking-tight text-white">
                {settingsCurrentPage === 'root' && (t('chat.settings') || 'Settings')}
                {settingsCurrentPage === 'model' && 'Select model'}
                {settingsCurrentPage === 'effort' && 'Effort'}
                {settingsCurrentPage === 'more-models' && 'More models'}
                {settingsCurrentPage === 'voice' && 'Voice'}
                {settingsCurrentPage === 'prompt' && (t('chat.custom_prompt') || 'System Prompt')}
                {settingsCurrentPage === 'export' && (t('chat.export.title') || 'Export Chat')}
                {settingsCurrentPage === 'sandbox' && 'Sandbox'}
                {settingsCurrentPage === 'sandbox-provider' && 'Provider'}
                {settingsCurrentPage === 'sandbox-runtime' && 'Runtime'}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: 'none' }}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={settingsCurrentPage}
                  initial={{ x: settingsSlideDir === 'push' ? 300 : -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: settingsSlideDir === 'push' ? -100 : 300, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >

                {/* ══════ ROOT: Settings categories ══════ */}
                {settingsCurrentPage === 'root' && (
                  <div className="divide-y divide-[#2a2a2a]">
                    {/* Model */}
                    <button
                      onClick={() => settingsPush('model')}
                      className="w-full flex items-center gap-3.5 py-3.5 text-left active:opacity-60 transition-opacity"
                    >
                      <div className="w-10 h-10 rounded-[11px] bg-[rgba(115,115,115,0.1)] flex items-center justify-center shrink-0">
                        <IconLightning size={18} className="text-[#737373]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[16px] font-medium text-white">Model</div>
                        <div className="text-[13px] text-[#888] truncate">{currentModel?.name || 'Default'}</div>
                      </div>
                      <span className="text-[20px] text-[#888]">›</span>
                    </button>

                    {/* Voice */}
                    <button
                      onClick={() => settingsPush('voice')}
                      className="w-full flex items-center gap-3.5 py-3.5 text-left active:opacity-60 transition-opacity"
                    >
                      <div className="w-10 h-10 rounded-[11px] bg-[rgba(115,115,115,0.1)] flex items-center justify-center shrink-0">
                        <IconSpeaker size={18} className="text-[#737373]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[16px] font-medium text-white">Voice</div>
                        <div className="text-[13px] text-[#888] truncate">
                          {tts.currentEngine === 'browser' ? 'Browser TTS' : (tts.engines?.find(e => e.id === tts.currentEngine)?.name || 'Browser')} · {(tts.speed || 1.0).toFixed(1)}x
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`w-2 h-2 rounded-full ${tts.serverAvailable ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' : 'bg-red-500/60'}`} />
                        <span className="text-[20px] text-[#888]">›</span>
                      </div>
                    </button>

                    {/* System Prompt */}
                    <button
                      onClick={() => settingsPush('prompt')}
                      className="w-full flex items-center gap-3.5 py-3.5 text-left active:opacity-60 transition-opacity"
                    >
                      <div className="w-10 h-10 rounded-[11px] bg-[rgba(115,115,115,0.1)] flex items-center justify-center shrink-0">
                        <IconSliders size={18} className="text-[#737373]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[16px] font-medium text-white">System Prompt</div>
                        <div className="text-[13px] text-[#888] truncate">
                          {customSystemPrompt ? customSystemPrompt.slice(0, 35) + '...' : 'Default'}
                        </div>
                      </div>
                      <span className="text-[20px] text-[#888]">›</span>
                    </button>

                    {/* Export Chat */}
                    <button
                      onClick={() => settingsPush('export')}
                      className="w-full flex items-center gap-3.5 py-3.5 text-left active:opacity-60 transition-opacity"
                    >
                      <div className="w-10 h-10 rounded-[11px] bg-[rgba(115,115,115,0.1)] flex items-center justify-center shrink-0">
                        <IconDownload size={18} className="text-[#737373]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[16px] font-medium text-white">Export Chat</div>
                        <div className="text-[13px] text-[#888] truncate">
                          {messages.length === 0 ? 'No conversation yet' : `${messages.length} messages`}
                        </div>
                      </div>
                      <span className="text-[20px] text-[#888]">›</span>
                    </button>

                    {/* Sandbox */}
                    <button
                      onClick={() => settingsPush('sandbox')}
                      className="w-full flex items-center gap-3.5 py-3.5 text-left active:opacity-60 transition-opacity"
                    >
                      <div className="w-10 h-10 rounded-[11px] bg-[rgba(115,115,115,0.1)] flex items-center justify-center shrink-0">
                        <IconCube size={18} className="text-[#737373]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[16px] font-medium text-white">Sandbox</div>
                        <div className="text-[13px] text-[#888] truncate">Daytona · Docker · E2B</div>
                      </div>
                      <span className="text-[20px] text-[#888]">›</span>
                    </button>

                    {/* Full Voice Settings shortcut */}
                    <div className="pt-4">
                      <button
                        onClick={() => { setSettingsOpen(false); settingsReset(); setVoiceSettingsOpen(true) }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-[14px] text-[15px] font-medium bg-[rgba(138,90,180,0.12)] text-[#b88fd8] active:bg-[rgba(138,90,180,0.2)] transition-colors"
                      >
                        <IconSpeaker size={16} /> Full Voice Settings Panel
                      </button>
                    </div>
                  </div>
                )}

                {/* ══════ MODEL SELECTOR ══════ */}
                {settingsCurrentPage === 'model' && (
                  <div className="divide-y divide-[#2a2a2a]">
                    {MODELS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setModel(m.id)}
                        className="w-full py-4 text-left active:opacity-60 transition-opacity"
                      >
                        <div className="flex items-center gap-2.5 mb-1">
                          <span className={`text-[17px] font-medium ${model === m.id ? 'text-[#4a9fd1]' : 'text-white'}`}>{m.name}</span>
                          {m.tag && (
                            <span className={`text-[10px] font-bold tracking-[0.5px] px-[7px] py-[2px] rounded-[5px] uppercase ${
                              m.tag.toLowerCase().includes('premium') || m.tag.toLowerCase().includes('pro')
                                ? 'text-[#4a7fb5] bg-[rgba(74,127,181,0.12)]'
                                : m.tag.toLowerCase().includes('free') || m.tag.toLowerCase().includes('fast')
                                  ? 'text-[#4caf50] bg-[rgba(76,175,80,0.12)]'
                                  : 'text-[#888] bg-[rgba(255,255,255,0.06)]'
                            }`}>
                              {m.tag}
                            </span>
                          )}
                        </div>
                        <div className={`text-[14px] flex items-center justify-between ${model === m.id ? 'text-[#4a9fd1]' : 'text-[#888]'}`}>
                          <span>{m.id}</span>
                          {model === m.id && <span className="text-[20px]">✓</span>}
                        </div>
                      </button>
                    ))}

                    {/* Effort row */}
                    <div className="border-t border-[#2a2a2a]" />
                    <button
                      onClick={() => settingsPush('effort')}
                      className="w-full flex items-center py-3.5 text-left active:opacity-60 transition-opacity"
                    >
                      <div className="flex-1">
                        <div className="text-[16px] font-medium text-white">Effort</div>
                        <div className="text-[13px] text-[#888]" id="currentEffortLabel">Low</div>
                      </div>
                      <span className="text-[20px] text-[#888]">›</span>
                    </button>

                    {/* More models row */}
                    <button
                      onClick={() => settingsPush('more-models')}
                      className="w-full flex items-center py-3.5 text-left active:opacity-60 transition-opacity"
                    >
                      <div className="flex-1">
                        <div className="text-[16px] font-medium text-white">More models</div>
                      </div>
                      <span className="text-[20px] text-[#888]">›</span>
                    </button>
                  </div>
                )}

                {/* ══════ EFFORT SELECTOR ══════ */}
                {settingsCurrentPage === 'effort' && (
                  <div className="space-y-2 pt-2">
                    {[
                      { level: 'Low', desc: 'Faster responses, less reasoning', selected: true },
                      { level: 'Medium', desc: 'Balanced speed and depth', selected: false },
                      { level: 'High', desc: 'Deeper reasoning, slower responses', selected: false },
                    ].map(opt => (
                      <button
                        key={opt.level}
                        onClick={() => {
                          const el = document.getElementById('currentEffortLabel')
                          if (el) el.textContent = opt.level
                        }}
                        className={`w-full flex items-center justify-between px-4 py-[18px] rounded-[14px] transition-all active:scale-[0.98] ${
                          opt.selected
                            ? 'bg-[rgba(196,92,74,0.08)] border-2 border-[#c45c4a]'
                            : 'bg-[#242424] border-2 border-transparent'
                        }`}
                      >
                        <span className="text-[16px] font-medium text-white">{opt.level}</span>
                        <span className={`text-[20px] text-[#c45c4a] transition-opacity ${opt.selected ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* ══════ MORE MODELS ══════ */}
                {settingsCurrentPage === 'more-models' && (
                  <div className="divide-y divide-[#2a2a2a]">
                    {[
                      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1', tag: 'Reasoning', pro: true },
                      { id: 'qwen-qwq-32b', name: 'Qwen QwQ', tag: 'Reasoning', pro: true },
                      { id: 'llama-3.2-3b-preview', name: 'Nova 0.9', tag: 'Lightweight', pro: false },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => setModel(m.id)}
                        className="w-full py-4 text-left active:opacity-60 transition-opacity"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[17px] font-medium ${model === m.id ? 'text-[#4a9fd1]' : 'text-white'}`}>{m.name}</span>
                          {m.pro && (
                            <span className="text-[10px] font-bold tracking-[0.5px] px-[7px] py-[2px] rounded-[5px] uppercase text-[#4a7fb5] bg-[rgba(74,127,181,0.12)]">
                              Pro
                            </span>
                          )}
                        </div>
                        <div className={`text-[14px] flex items-center justify-between mt-1 ${model === m.id ? 'text-[#4a9fd1]' : 'text-[#888]'}`}>
                          <span>{m.id}</span>
                          {model === m.id && <span className="text-[20px]">✓</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* ══════ VOICE ══════ */}
                {settingsCurrentPage === 'voice' && (
                  <div className="divide-y divide-[#2a2a2a]">
                    {/* Server status */}
                    <div className="flex items-center gap-2.5 py-3.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${tts.serverAvailable ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500/60'}`} />
                      <span className="text-[14px] text-[#aaa]">
                        Voice Server {tts.serverAvailable ? 'Connected' : 'Offline'}
                      </span>
                      <span className="text-[11px] text-[#555] ml-auto">
                        {tts.serverAvailable ? 'High-quality TTS' : 'Browser fallback'}
                      </span>
                    </div>

                    {/* Engine */}
                    <div className="py-3.5">
                      <div className="text-[10px] font-medium text-[#666] uppercase tracking-wider mb-2">Engine</div>
                      <div className="space-y-1">
                        {(tts.engines?.length > 0 ? tts.engines : [{ id: 'browser', name: 'Browser TTS', features: ['free', 'low-latency'] }]).map(eng => (
                          <button
                            key={eng.id}
                            onClick={() => tts.setEngine?.(eng.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                              tts.currentEngine === eng.id
                                ? 'bg-[rgba(138,90,180,0.1)] border border-[rgba(138,90,180,0.2)]'
                                : 'hover:bg-[#222] border border-transparent'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className={`text-[14px] font-medium ${tts.currentEngine === eng.id ? 'text-[#b88fd8]' : 'text-white'}`}>
                                {eng.name}
                              </div>
                              {eng.features && (
                                <div className="flex gap-1 mt-0.5">
                                  {eng.features.map(f => (
                                    <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#555]">{f}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {tts.currentEngine === eng.id && (
                              <span className="text-[#b88fd8] text-[16px]">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Speed */}
                    <div className="py-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-medium text-[#666] uppercase tracking-wider">Speed</span>
                        <span className="text-[13px] text-[#aaa] font-mono">{(tts.speed || 1.0).toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={tts.speed || 1.0}
                        onChange={e => tts.setSpeed?.(parseFloat(e.target.value))}
                        className="settings-voice-slider w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #a855f7 0%, #ef4444 ${(((tts.speed || 1.0) - 0.5) / 1.5) * 100}%, #262626 ${(((tts.speed || 1.0) - 0.5) / 1.5) * 100}%)`,
                        }}
                      />
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[11px] text-[#444]">0.5x</span>
                        <span className="text-[11px] text-[#444]">1.0x</span>
                        <span className="text-[11px] text-[#444]">2.0x</span>
                      </div>
                    </div>

                    {/* Test Voice */}
                    <div className="py-3.5">
                      <button
                        onClick={() => {
                          if (tts.speak) {
                            tts.speak("Hello from Kivora", { interrupt: true }).catch(() => {})
                          } else if (typeof window !== 'undefined' && window.speechSynthesis) {
                            window.speechSynthesis.speak(new SpeechSynthesisUtterance("Hello from Kivora"))
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[14px] text-[15px] font-medium transition-all active:scale-[0.98]"
                        style={{
                          background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(239,68,68,0.12))',
                          border: '1px solid rgba(168,85,247,0.15)',
                          color: '#d4d4d4',
                        }}
                      >
                        <IconSpeaker size={16} /> Test Voice
                      </button>
                    </div>

                    {/* Full Voice Panel link */}
                    <div className="py-3.5">
                      <button
                        onClick={() => { setSettingsOpen(false); settingsReset(); setVoiceSettingsOpen(true) }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-[14px] text-[15px] font-medium bg-[rgba(138,90,180,0.12)] text-[#b88fd8] active:bg-[rgba(138,90,180,0.2)] transition-colors"
                      >
                        Full Voice Settings Panel →
                      </button>
                    </div>
                  </div>
                )}

                {/* ══════ SYSTEM PROMPT ══════ */}
                {settingsCurrentPage === 'prompt' && (
                  <div className="py-3">
                    <div className="text-[13px] text-[#888] mb-3">Current prompt</div>
                    <textarea
                      rows={6}
                      className="w-full bg-[#242424] border border-[#2a2a2a] rounded-[12px] px-4 py-3.5 text-[14px] text-white placeholder-[#3a3a3a] resize-vertical outline-none focus:border-[#3a3a3a] transition-colors font-[inherit] leading-relaxed"
                      placeholder="Enter system prompt..."
                      value={customSystemPrompt}
                      onChange={e => {
                        saveCustomSystemPrompt(e.target.value)
                        setSettingsPromptSaved(true)
                        setTimeout(() => setSettingsPromptSaved(false), 1500)
                      }}
                    />
                    <div className="flex items-center justify-between mt-2.5">
                      <button
                        onClick={() => { resetCustomSystemPrompt(); setSettingsPromptSaved(true); setTimeout(() => setSettingsPromptSaved(false), 1500) }}
                        className="text-[13px] text-[#555] hover:text-red-400 transition-colors"
                      >
                        {t('chat.custom_prompt.reset') || 'Reset to default'}
                      </button>
                      {settingsPromptSaved && (
                        <span className="text-[13px] text-emerald-400 flex items-center gap-1">
                          <IconCheck size={12} /> Saved
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ══════ EXPORT CHAT ══════ */}
                {settingsCurrentPage === 'export' && (
                  <div>
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="text-[48px] mb-4">📭</div>
                        <div className="text-[16px] text-[#888]">No conversation to export yet</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[13px] text-[#888] mb-3">
                          Export {messages.length} messages from this conversation.
                        </div>
                        <div className="divide-y divide-[#2a2a2a]">
                          {[
                            { id: 'pdf', label: 'PDF', desc: 'Formatted document', Icon: IconFile },
                            { id: 'docx', label: 'DOCX', desc: 'Word document', Icon: IconWrite },
                            { id: 'html', label: 'HTML', desc: 'Web page', Icon: IconGlobe },
                            { id: 'md', label: 'Markdown', desc: 'Plain text markup', Icon: IconClipboard },
                            { id: 'txt', label: 'TXT', desc: 'Plain text', Icon: IconFile },
                          ].map(fmt => (
                            <button
                              key={fmt.id}
                              onClick={() => setSettingsExportFormat(fmt.id)}
                              className={`w-full flex items-center gap-3.5 py-3.5 text-left transition-colors ${
                                settingsExportFormat === fmt.id ? 'opacity-100' : 'opacity-70'
                              }`}
                            >
                              <fmt.Icon size={16} className={settingsExportFormat === fmt.id ? 'text-[#c45c4a]' : 'text-[#555]'} />
                              <div className="flex-1">
                                <div className={`text-[16px] font-medium ${settingsExportFormat === fmt.id ? 'text-[#c45c4a]' : 'text-white'}`}>{fmt.label}</div>
                                <div className="text-[13px] text-[#888]">{fmt.desc}</div>
                              </div>
                              {settingsExportFormat === fmt.id && (
                                <span className="text-[#c45c4a] text-[16px]">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={async () => { await exportChat(settingsExportFormat); setSettingsExported(true); setTimeout(() => setSettingsExported(false), 2000) }}
                          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-[14px] text-[15px] font-semibold mt-3 transition-colors ${
                            settingsExported
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#c45c4a] hover:bg-[#d97a6a] text-white'
                          }`}
                        >
                          {settingsExported ? (
                            <><IconCheck size={16} /> Exported</>
                          ) : (
                            <><IconDownload size={16} /> Export as {settingsExportFormat.toUpperCase()}</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ══════ SANDBOX ══════ */}
                {settingsCurrentPage === 'sandbox' && (
                  <div className="divide-y divide-[#2a2a2a]">
                    {/* Provider row */}
                    <button
                      onClick={() => settingsPush('sandbox-provider')}
                      className="w-full flex items-center py-3.5 text-left active:opacity-60 transition-opacity"
                    >
                      <div className="flex-1">
                        <div className="text-[16px] font-medium text-white">Provider</div>
                        <div className="text-[13px] text-[#888]">Daytona</div>
                      </div>
                      <span className="text-[20px] text-[#888]">›</span>
                    </button>

                    {/* Runtime row */}
                    <button
                      onClick={() => settingsPush('sandbox-runtime')}
                      className="w-full flex items-center py-3.5 text-left active:opacity-60 transition-opacity"
                    >
                      <div className="flex-1">
                        <div className="text-[16px] font-medium text-white">Runtime</div>
                        <div className="text-[13px] text-[#888]">Docker</div>
                      </div>
                      <span className="text-[20px] text-[#888]">›</span>
                    </button>

                    {/* Fallback chain */}
                    <div className="py-3.5">
                      <div className="text-[10px] font-medium text-[#666] uppercase tracking-wider mb-2">Auto-fallback chain</div>
                      <div className="flex items-center flex-wrap gap-1">
                        {['Daytona', 'Docker', 'E2B', 'Kaggle', 'Colab', 'Codespaces'].map((name, i) => (
                          <span key={name} className="flex items-center">
                            <span className={`text-[11px] px-2 py-1 rounded-lg ${i === 0 ? 'bg-[rgba(76,175,80,0.12)] text-[#4caf50]' : 'bg-[#242424] text-[#888]'}`}>
                              {name}
                            </span>
                            {i < 5 && <span className="text-[10px] text-[#333] mx-1">→</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ══════ SANDBOX PROVIDER ══════ */}
                {settingsCurrentPage === 'sandbox-provider' && (
                  <div className="divide-y divide-[#2a2a2a]">
                    {[
                      { id: 'daytona', name: 'Daytona', desc: 'Cloud sandbox · GPU · <90ms cold start', primary: true },
                      { id: 'docker', name: 'Docker Engine', desc: 'Self-hosted containers · Any language', primary: false },
                      { id: 'e2b', name: 'E2B', desc: 'Cloud microVMs · Secure · Fast', primary: false },
                      { id: 'kaggle', name: 'Kaggle', desc: 'Free notebooks · GPU · Python/R', primary: false },
                      { id: 'colab', name: 'Colab', desc: 'Google notebooks · Free GPU', primary: false },
                      { id: 'codespaces', name: 'Codespaces', desc: 'Full VS Code · GitHub integration', primary: false },
                    ].map(p => (
                      <div key={p.id} className="flex items-center gap-3 py-3.5">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.primary ? 'bg-[rgba(76,175,80,0.15)]' : 'bg-[#1a1a1a]'}`}>
                          <IconCube size={14} className={p.primary ? 'text-[#4caf50]' : 'text-[#555]'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[16px] font-medium ${p.primary ? 'text-[#4caf50]' : 'text-[#aaa]'}`}>{p.name}</span>
                            {p.primary && (
                              <span className="text-[9px] font-bold tracking-[0.5px] px-2 py-0.5 rounded bg-[rgba(76,175,80,0.12)] text-[#4caf50] uppercase">Primary</span>
                            )}
                          </div>
                          <div className="text-[13px] text-[#555] truncate">{p.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ══════ SANDBOX RUNTIME ══════ */}
                {settingsCurrentPage === 'sandbox-runtime' && (
                  <div className="divide-y divide-[#2a2a2a]">
                    {[
                      { id: 'docker', name: 'Docker', desc: 'Container-based isolation' },
                      { id: 'microvm', name: 'MicroVM', desc: 'Lightweight VM sandbox' },
                      { id: 'notebook', name: 'Notebook', desc: 'Jupyter-style execution' },
                    ].map(r => (
                      <div key={r.id} className="py-3.5">
                        <div className="text-[16px] font-medium text-[#aaa]">{r.name}</div>
                        <div className="text-[13px] text-[#555]">{r.desc}</div>
                      </div>
                    ))}
                  </div>
                )}

                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

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
              <IconMenu size={20} />
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z"/>
              <path d="M12 8v8"/>
              <path d="M8 12h8"/>
            </svg>
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto overscroll-behavior-contain">
          <div className="max-w-[720px] mx-auto px-[min(5vw,48px)] py-6 space-y-4">
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
                  // Strip [Image: ...] prefix and base64 data from display text, keep any user text
                  displayContent = msg.content.replace(/^\[Image: .+?\]\n?/, '').replace(/^data:image\/[^\n]+/, '').trim()
                  if (!displayContent) displayContent = ''
                }
              }

              return (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`group ${msg.role === 'user' ? 'max-w-[65%]' : 'w-full'}`}>
                    {/* File/Image attachment indicator */}
                    {hasFileAttachment && (
                      <div className="flex items-center gap-1.5 mb-1.5 justify-end">
                        <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1 text-[11px] text-muted">
                          <IconFile size={10} />
                          <span>{attachmentName}</span>
                        </div>
                      </div>
                    )}
                    {hasImageAttachment && !msg.userImageData && (
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
                    {msg.role === 'assistant' && msg.codeExecuted && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={msg.gpuUsed ? "#a78bfa" : msg.remoteExecUsed ? "#60a5fa" : msg.sandboxUsed ? "#f59e0b" : "#4ade80"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                        </svg>
                        <span className={`text-[11px] ${msg.gpuUsed ? 'text-[#a78bfa]/70' : msg.remoteExecUsed ? 'text-[#60a5fa]/70' : msg.sandboxUsed ? 'text-[#f59e0b]/70' : 'text-[#4ade80]/70'}`}>
                          {msg.gpuUsed ? `GPU executed (${msg.accelerator || 'T4'})` : msg.remoteExecUsed ? `Remote executed (${msg.execLanguage || 'python'})` : msg.sandboxUsed ? 'Sandbox executed' : 'Code executed'}
                        </span>
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.downloadFile && (
                      <div className="mb-1.5">
                        <button
                          onClick={async () => {
                            const dl = msg.downloadFile
                            if (dl.data_url) {
                              // Base64 fallback — client-side download
                              const a = document.createElement('a')
                              a.href = dl.data_url
                              a.download = dl.filename
                              a.click()
                            } else if (dl.download_url) {
                              // Sandbox download URL (requires POST with path in body)
                              try {
                                const res = await fetch(dl.download_url, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dl.api_key || ''}` },
                                  body: dl.download_body || JSON.stringify({ path: dl.path || `/workspace/downloads/${dl.filename}` }),
                                })
                                if (res.ok) {
                                  const blob = await res.blob()
                                  const url = URL.createObjectURL(blob)
                                  const a = document.createElement('a')
                                  a.href = url
                                  a.download = dl.filename
                                  a.click()
                                  URL.revokeObjectURL(url)
                                } else {
                                  // Fallback: try GET
                                  const a = document.createElement('a')
                                  a.href = dl.download_url
                                  a.download = dl.filename
                                  a.target = '_blank'
                                  a.click()
                                }
                              } catch {
                                const a = document.createElement('a')
                                a.href = dl.download_url
                                a.download = dl.filename
                                a.target = '_blank'
                                a.click()
                              }
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 hover:border-emerald-500/40 text-[12px] text-emerald-300 hover:text-emerald-200 transition-colors cursor-pointer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          <span>Download {msg.downloadFile.filename}</span>
                          <span className="text-emerald-400/40 text-[10px]">
                            {msg.downloadFile.size > 1024 ? `${(msg.downloadFile.size / 1024).toFixed(1)}KB` : `${msg.downloadFile.size}B`}
                          </span>
                        </button>
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.urlRead && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                        <span className="text-[11px] text-[#60a5fa]/70">Read URL via {msg.urlReadSource || 'Jina'}</span>
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.artifacts && msg.artifacts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {msg.artifacts.map((artifact, aIdx) => (
                          <button
                            key={aIdx}
                            onClick={() => { setActiveArtifact(artifact); setArtifactPanelOpen(true) }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-red-500/10 to-rose-500/10 border border-red-500/20 hover:border-red-500/40 text-[11px] text-red-300 hover:text-red-200 transition-colors cursor-pointer"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                            <span>View {artifact.type.toUpperCase()} Artifact</span>
                            <span className="text-red-400/50">&middot; {artifact.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.opportunityCards && msg.opportunityCards.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-[10px] text-muted2 font-medium uppercase tracking-wider">Related Opportunities</p>
                        <div className="grid gap-1.5">
                          {msg.opportunityCards.map((opp, oi) => (
                            <Link key={oi} href={opp.url}
                              className="flex items-center gap-3 bg-[#111] border border-white/[0.05] rounded-lg px-3 py-2.5 hover:bg-[#181818] hover:border-[#333] transition-all group">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-[13px] font-medium text-[#999] group-hover:text-white transition-colors line-clamp-1">{opp.title}</h4>
                                <div className="flex items-center gap-2.5 text-[10px] text-[#555] mt-0.5">
                                  <span className="flex items-center gap-0.5"><IconMoney size={9} />${opp.income_min?.toLocaleString()}-${opp.income_max?.toLocaleString()}/{opp.income_period}</span>
                                  <span className="flex items-center gap-0.5"><IconLightning size={9} />{opp.start_days}d</span>
                                  {opp.monthly_cost > 0 && <span className="flex items-center gap-0.5"><IconTool size={9} />${opp.monthly_cost}/mo</span>}
                                </div>
                              </div>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-[#333] group-hover:text-red-400 transition-colors shrink-0">
                                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.role === 'assistant' ? (
                      msg.quotaExceeded ? (
                        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl px-4 py-3 max-w-md">
                          <div className="flex items-center gap-2 mb-1.5">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            <span className="text-[13px] font-medium text-amber-300">Service temporarily limited</span>
                          </div>
                          <p className="text-[12px] text-amber-200/70 leading-relaxed">{msg.content}</p>
                        </div>
                      ) : msg.isImage && msg.imageData ? (
                        <div className="space-y-2">
                          <div className="rounded-xl overflow-hidden border border-white/[0.06] max-w-md">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={msg.imageData} alt="AI Generated" className="w-full h-auto" />
                          </div>
                          {msg.imageUrl && (
                            <a
                              href={msg.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              className="inline-flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
                            >
                              <IconDownload size={10} />
                              Download Full Resolution
                            </a>
                          )}
                        </div>
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )
                    ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        {msg.userImageData && (
                          <div className="rounded-xl overflow-hidden border border-white/[0.06] max-w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={msg.userImageData} alt="Uploaded" className="max-w-full max-h-64 w-auto h-auto object-contain" />
                          </div>
                        )}
                        {displayContent && (
                          <div className="rounded-2xl px-3.5 py-2 bg-white/[0.04] text-[#e2e2e2] text-[14px] border border-white/[0.06] rounded-tr-sm leading-[1.5]">
                            <span>{displayContent}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {msg.role === 'assistant' && (
                      <div className="opacity-0 group-hover:opacity-100 mt-1.5 flex items-center gap-3 transition-all">
                        <VoiceOutput text={msg.content} />
                        <button
                          onClick={() => copy(msg.content, i)}
                          className="flex items-center justify-center text-muted hover:text-[#e2e2e2] transition-colors"
                          title={copiedIndex === i ? t('common.copied') : t('common.copy')}
                        >
                          {copiedIndex === i ? <IconCheck size={12} /> : <IconCopy size={12} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="flex justify-start">
                <ThinkingState
                  stages={STAGE_CONFIGS[thinkingConfig] || STAGE_CONFIGS.chat}
                  active={loading}
                  compact={focusMode === 'All'}
                  orb={focusMode === 'Code'}
                  academic={focusMode === 'Academic'}
                  writing={focusMode === 'Writing'}
                  math={focusMode === 'Math'}
                />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Expandable Chat Bar ────────────────────── */}
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
                {/* Paperclip — attach file */}
                <button
                  className="chat-collapsed-btn-circle"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file"
                  title="Attach file"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
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
                              <span className="chat-focus-icon"><m.Icon size={14} /></span>
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



                    {/* Voice Settings */}
                    <button
                      className={`chat-toolbar-btn ${voiceSettingsOpen ? 'chat-toolbar-btn-active' : ''}`}
                      onClick={() => setVoiceSettingsOpen(!voiceSettingsOpen)}
                      title="Voice settings"
                    >
                      <IconSpeaker size={16} />
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
      </div>

      {/* ── Voice Settings Panel ── */}
      <VoiceSettings
        isOpen={voiceSettingsOpen}
        onClose={() => setVoiceSettingsOpen(false)}
        ttsHook={tts}
      />

      {/* ── Microphone Permission Modal ── */}
      {micPermModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setMicPermModal(false)}>
          <div
            className="bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0">
                <IconMicrophone size={20} className="text-[#737373]" />
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
          transition: border-color 0.3s ease;
          position: relative;
        }
        .chat-bar-collapsed:focus-within {
          border-color: transparent;
        }
        /* Gradient border ring */
        .chat-bar-collapsed:focus-within::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 28px;
          padding: 1.5px;
          background: linear-gradient(90deg, #a855f7, #ef4444);
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
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
          transition: border-color 0.3s ease;
          animation: expandBar 0.25s ease-out;
          overflow: visible;
          position: relative;
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
          border-color: transparent;
        }
        /* Gradient border ring */
        .chat-container-expanded:focus-within::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          padding: 1.5px;
          background: linear-gradient(90deg, #a855f7, #ef4444);
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
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
        .morph-shape :global(line),
        .morph-shape :global(polygon),
        .morph-shape :global(polyline) {
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

        .morph-shape-active :global(polygon) {
          animation: pencilStroke 1.2s ease-out forwards;
          animation-delay: 0s;
        }

        .morph-shape-active :global(polyline:nth-child(2)) {
          animation: pencilStroke 1s ease-out forwards;
          animation-delay: 0.3s;
        }

        .morph-shape-active :global(polyline:nth-child(3)) {
          animation: pencilStroke 1s ease-out forwards;
          animation-delay: 0.55s;
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
          /* Settings voice speed slider */
          input[type="range"].settings-voice-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: linear-gradient(135deg, #a855f7, #ef4444);
            cursor: pointer;
            box-shadow: 0 0 4px rgba(168,85,247,0.3);
            border: 2px solid #1a1a1a;
          }
          input[type="range"].settings-voice-slider::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: linear-gradient(135deg, #a855f7, #ef4444);
            cursor: pointer;
            border: 2px solid #1a1a1a;
          }
        }

      `}</style>
    </main>
  )
}
