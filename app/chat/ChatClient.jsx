'use client'
import Link from 'next/link'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { IconSend, IconSpinner, IconCopy, IconCheck, IconChat, IconMenu, IconClose, IconUser, IconMoney, IconLightning, IconCode, IconBulb, IconBook, IconTool, IconGlobe, IconSearch, IconPaperclip, IconDownload, IconLock, IconFile, IconChevronDown, IconMicrophone, IconSliders, IconSettings, IconCopy as IconClipboard, IconWrite, IconFilter, IconRobot, IconTarget, IconDatabase, IconStack, IconSpeaker, IconArrowLeft, IconArrowRight, IconCube, IconLink } from '@/components/Icons'
import BackButton from '@/components/BackButton'
import { useSessionTracker } from '@/lib/useSessionTracker'
import { usePlan } from '@/lib/usePlan'
import { supabasePublic } from '@/lib/supabase'
import { streamSSE } from '@/lib/sseClient'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import UserAvatar from '@/components/UserAvatar'
import ArtifactViewer from '@/components/ArtifactViewer'
import CodePreviewCard from '@/components/CodePreviewCard'
import VoiceSettings from '@/components/VoiceSettings'
import { useVoiceTTS } from '@/hooks/useVoiceTTS'
import { useTranslation } from '@/components/LanguageProvider'
import ConfirmDialog from '@/components/ConfirmDialog'
import { stripMarkdown } from '@/lib/stripMarkdown'
import { reportClientError } from '@/lib/reportClientError'
import dynamic from 'next/dynamic'
import { ComingSoonCard } from '@/components/ComingSoonPopup'
import ChatNoticeCard from '@/components/ChatNoticeCard'
import Lightbox from '@/components/Lightbox'
import { createPortal } from 'react-dom'

// v5.11 — Live Terminal restored (client-only; xterm touches DOM)
const XTerminal = dynamic(() => import('@/components/XTerminal'), { ssr: false })
const WorkspacePanel = dynamic(() => import('@/components/chat/WorkspacePanel'), { ssr: false })
// v5.28 — workspace file listing inside the Live Terminal drawer
const TerminalWorkspace = dynamic(() => import('@/components/chat/TerminalWorkspace'), { ssr: false })



const MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'Nova 3', tag: 'Premium · Detailed', short: 'Nova 3', pro: false },
  { id: 'openai/gpt-oss-20b', name: 'Nova 1.9', tag: 'Free · Fast', short: 'Nova 1.9', pro: false },
  { id: 'qwen/qwen3.8-27b', name: 'Nova Vision', tag: 'Multimodal · 131K', short: 'Vision', pro: false },
]

// Reasoning / specialty models — shown in the selectors with a Pro badge;
// the API rejects them for non-Pro plans (server-side gate).
const EXTRA_MODELS = [
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1', tag: 'Reasoning · Pro', short: 'R1', pro: true },
]

const ALL_MODELS = [...MODELS, ...EXTRA_MODELS]

const EFFORT_LEVELS = [
  { level: 'low', label: 'Low', desc: 'Faster responses, less depth' },
  { level: 'medium', label: 'Medium', desc: 'Balanced speed and depth' },
  { level: 'high', label: 'High', desc: 'Longer, more thorough responses' },
]

const DEFAULT_MODEL = 'openai/gpt-oss-120b'

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

// ── Message normalization (crash defense) ──
// chat_sessions rows written by older/legacy code paths can carry messages
// (or per-message artifacts / opportunityCards) as JSON strings or objects
// instead of arrays. Rendering those crashed the whole chat page with
// "g.map is not a function". Coerce every field to its render-safe shape.
//
// Item-level defense: even a VALID array can carry garbage items (e.g.
// artifacts: [null, "leak"]) — the render path calls artifact.type.toUpperCase()
// and reads opp.url, which throws on non-objects. Filter to clean objects.
function sanitizeArtifactsList(v) {
  if (!Array.isArray(v)) return null
  const out = v
    .filter(a => a && typeof a === 'object' && !Array.isArray(a))
    .map(a => ({
      ...a,
      type: typeof a.type === 'string' ? a.type : 'unknown',
      title: typeof a.title === 'string' ? a.title : '',
    }))
  return out.length ? out : null
}

function sanitizeOpportunityCardsList(v) {
  if (!Array.isArray(v)) return null
  const out = v
    .filter(o => o && typeof o === 'object' && !Array.isArray(o))
    .map(o => ({
      ...o,
      title: typeof o.title === 'string' ? o.title : '',
      url: typeof o.url === 'string' ? o.url : '#',
    }))
  return out.length ? out : null
}

function normalizeMessage(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null
  const msg = { ...m }
  if (typeof msg.content !== 'string') {
    if (msg.content == null) msg.content = ''
    else if (typeof msg.content === 'object') {
      try { msg.content = JSON.stringify(msg.content) } catch { msg.content = String(msg.content) }
    } else msg.content = String(msg.content)
  }
  for (const key of ['artifacts', 'opportunityCards']) {
    const v = msg[key]
    if (v == null) { delete msg[key]; continue }
    let arr = v
    if (!Array.isArray(v)) {
      // Legacy rows sometimes stored the array as a JSON string — repair it
      let parsed = null
      if (typeof v === 'string' && v.trim()) {
        try { parsed = JSON.parse(v) } catch {}
      }
      arr = Array.isArray(parsed) ? parsed : null
    }
    const clean = key === 'artifacts' ? sanitizeArtifactsList(arr) : sanitizeOpportunityCardsList(arr)
    if (clean) msg[key] = clean
    else delete msg[key]
  }
  return msg
}

function normalizeMessages(list) {
  if (Array.isArray(list)) return list.map(normalizeMessage).filter(Boolean)
  if (typeof list === 'string' && list.trim()) {
    try {
      const parsed = JSON.parse(list)
      if (Array.isArray(parsed)) return normalizeMessages(parsed)
    } catch {}
  }
  return []
}

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

// ── v5.18 session meta mirror (rename / pin) ────────────────────
// Device-local store for conversation titles and pins. The DB write is
// attempted first (chat_sessions.title / .pinned once
// chat-session-meta-migration.sql has run); this mirror guarantees the
// features work even before that migration lands on the database.
const CHAT_META_KEY = 'kivora:chat-session-meta'
function readChatMeta() {
  try { return JSON.parse(localStorage.getItem(CHAT_META_KEY) || '{}') || {} } catch { return {} }
}
function writeChatMeta(meta) {
  try { localStorage.setItem(CHAT_META_KEY, JSON.stringify(meta)) } catch {}
}

// ── Instrumented messages-state writer ─────────────────────────
// Three rounds of static analysis proved every setMessages site produces
// an array, yet production still crashed with "g.map is not a function" /
// "e is not iterable" — meaning the messages state slot itself received a
// non-array from somewhere invisible. This wrapper does two things:
//   1. SELF-HEALS: any non-array value written to the messages state
//      (direct or returned from an updater, including a poisoned `prev`
//      handed back by React) is coerced to [] — the crash becomes
//      impossible regardless of the source.
//   2. NAMES THE CULPRIT: the writer's captured stack + a snippet of the
//      poisoned value is posted to /api/client-errors (once per shape),
//      so the exact offending call site lands on the server.
const POISON_REPORTED = new Set()

function reportMessagesPoison(value, via, writerStack) {
  try {
    const shape = Object.prototype.toString.call(value)
    if (POISON_REPORTED.has(shape + via)) return
    POISON_REPORTED.add(shape + via)
    let snippet = ''
    try { snippet = JSON.stringify(value)?.slice(0, 500) || String(value).slice(0, 500) } catch { snippet = String(value).slice(0, 500) }
    reportClientError({
      message: `messages-state-poison via=${via} shape=${shape}`,
      stack: `writer-stack:\n${writerStack || 'n/a'}\n\npoison-value: ${snippet}`,
    })
  } catch {}
}

function makeSafeMessagesSetter(rawSet) {
  return function setMessages(value) {
    const writerStack = new Error('setMessages writer').stack
    if (typeof value === 'function') {
      // Updater form — guard both the incoming prev and the returned next
      rawSet((prev) => {
        if (!Array.isArray(prev)) {
          reportMessagesPoison(prev, 'updater-prev', writerStack)
          prev = []
        }
        let next
        try { next = value(prev) } catch (err) {
          reportMessagesPoison({ threw: String(err?.message) }, 'updater-threw', writerStack)
          throw err
        }
        if (!Array.isArray(next)) {
          reportMessagesPoison(next, 'updater-out', writerStack)
          return []
        }
        return next
      })
      return
    }
    if (!Array.isArray(value)) {
      reportMessagesPoison(value, 'direct', writerStack)
      rawSet([])
      return
    }
    rawSet(value)
  }
}

// ── Image generation placeholder — v5.15 premium redesign ──
// Shown while the server runs the generate_image tool (status SSE event).
// Mirrors the finished AI-image card's design language (gradient accent
// frame, dark canvas) so the transition loading → image is seamless:
// the shimmer collapses into the very frame the picture lands in.
// Layers: breathing accent frame → drifting aurora glow → diagonal
// light sweep → pulsing spark badge → cycling stage copy → progress hairline.
const IMAGE_GEN_STAGES = ['Composing the scene', 'Painting the details', 'Refining the light']

function ImageGeneratingCard() {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStage(s => (s + 1) % IMAGE_GEN_STAGES.length), 3400)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex justify-start">
      <div
        className="image-gen-frame w-full max-w-md rounded-2xl p-[1px] bg-gradient-to-br from-[#FF3366]/45 via-[#FF3366]/10 to-white/[0.05]"
        data-image-generating="true"
      >
        <div className="relative overflow-hidden rounded-2xl bg-[#0d0d0d] border border-white/[0.04]">
          <div className="relative h-44 flex flex-col items-center justify-center gap-4">
            {/* drifting aurora */}
            <div className="image-gen-aurora absolute inset-0" aria-hidden="true" />
            {/* diagonal light sweep */}
            <div className="image-gen-sweep absolute inset-0" aria-hidden="true" />
            {/* spark badge */}
            <div className="relative z-10 w-14 h-14 rounded-2xl bg-[#FF3366]/10 border border-[#FF3366]/35 flex items-center justify-center shadow-[0_0_28px_-6px_rgba(255,51,102,0.55)]">
              <div className="image-gen-pulse flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF3366">
                  <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
                </svg>
              </div>
            </div>
            {/* stage copy */}
            <div className="relative z-10 text-center px-8">
              <p className="text-[13px] font-semibold text-white tracking-tight">
                {IMAGE_GEN_STAGES[stage]}
                <span className="image-gen-dots" aria-hidden="true" />
              </p>
              <p className="text-[11px] text-[#737373] mt-1">Crafting in high definition — this usually takes a few seconds</p>
            </div>
            {/* progress hairline */}
            <div className="relative z-10 h-[3px] w-44 rounded-full bg-white/[0.07] overflow-hidden">
              <div className="image-gen-progress h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#FF3366] to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatClient() {
  // v5.17 — pending destructive action for the confirm card
  const [pendingDelete, setPendingDelete] = useState(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [messages, setMessagesRaw] = useState([])
  const setMessages = useMemo(() => makeSafeMessagesSetter(setMessagesRaw), [setMessagesRaw])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  // Session ID is generated client-side only (in send()) — initializing
  // useState with crypto.randomUUID() would produce different values on
  // server vs client and throw a hydration error under React 19.
  const [sessionId, setSessionId] = useState('')
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [user, setUser] = useState(null)
  // v5.22 — guest banner ("you're chatting as a guest") — dismissible, per-device
  const [guestBannerClosed, setGuestBannerClosed] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem('kv_guest_banner_dismissed') === '1' } catch { return false }
  })
  const [effort, setEffort] = useState('low')
  const [showUpgrade, setShowUpgrade] = useState(null) // { name } — Pro model gate popup
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

  // v5.11 — attachment preview lightbox
  const [previewImage, setPreviewImage] = useState(null)

  // Feature: Voice Input
  const [isListening, setIsListening] = useState(false)
  const [voiceToast, setVoiceToast] = useState(null) // { type: 'error'|'info', message: string }
  const voiceToastTimer = useRef(null)
  const recognitionRef = useRef(null)

  // ── Voice TTS (Text-to-Speech) ──
  const tts = useVoiceTTS()
  // v5.27 — persistent agent workspace (files the AI saves live here)
  const [wsOpen, setWsOpen] = useState(false)

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
  // v5.14 — long-press bubble action card (replaces the desktop-only hover
  // action row): { index, role, top, left, content, isImage, showExport }
  const [bubbleAction, setBubbleAction] = useState(null)
  const bubblePressRef = useRef({ timer: null, longFired: false, x: 0, y: 0 })

  // ── v5.18 session action card (long-press a conversation) ──
  // Same card design language as the delete-confirmation card, with four
  // options: Pin, Rename, Share, Delete. Meta (title/pinned) persists to
  // chat_sessions.title/pinned when those columns exist (see
  // chat-session-meta-migration.sql) and ALWAYS mirrors to localStorage so
  // rename/pin work today, device-locally, before the migration runs.
  const [sessionAction, setSessionAction] = useState(null) // { sid, title, pinned }
  const [sessionRenameMode, setSessionRenameMode] = useState(false)
  const [sessionRenameValue, setSessionRenameValue] = useState('')
  const [sessionMeta, setSessionMeta] = useState({})
  const sessionPressRef = useRef({ timer: null, longFired: false, x: 0, y: 0 })

  // ── Streaming presentation state ──
  // streaming: a reply is actively receiving SSE deltas (drives the typing
  // caret on the last message). imageGenerating: the server reported it is
  // running the generate_image tool (drives the shimmer placeholder card).
  const [streaming, setStreaming] = useState(false)
  const [imageGenerating, setImageGenerating] = useState(false)

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

  // v5.14 — bubble action card closes on any outside pointerdown or scroll
  // (capture phase, HistoryPill pattern — the card is portal-rendered)
  useEffect(() => {
    if (!bubbleAction) return
    const close = (e) => {
      const card = document.getElementById('bubble-action-card')
      if (card && card.contains(e.target)) return
      setBubbleAction(null)
    }
    const onScroll = () => setBubbleAction(null)
    document.addEventListener('pointerdown', close, true)
    const sc = scrollContainerRef.current
    sc?.addEventListener('scroll', onScroll)
    return () => {
      document.removeEventListener('pointerdown', close, true)
      sc?.removeEventListener('scroll', onScroll)
    }
  }, [bubbleAction])

  // ── Artifacts (Claude-style side panel) ──
  const [activeArtifact, setActiveArtifact] = useState(null) // { type, title, code }
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false)



  const bottomRef = useRef(null)
  const scrollContainerRef = useRef(null)
  // Whether the user is pinned to the bottom of the scroll area (drives
  // auto-scroll — never yank the view if they scrolled up to read)
  const pinnedToBottomRef = useRef(true)
  const textareaRef = useRef(null)
  const collapsedInputRef = useRef(null)
  const historyRef = useRef(null)
  // AbortController for the in-flight chat request — powers the stop button
  const abortRef = useRef(null)
  // v5.20 — resumable streaming: chars already rendered for the in-flight
  // generation (the resume offset), the reconnect banner flag, and a guard
  // that keeps the resume loop and normal sends from interleaving.
  const accLenRef = useRef(0)
  const [reconnecting, setReconnecting] = useState(false)
  const resumingRef = useRef(false)
  const modelDropdownRef = useRef(null)
  const chatBarRef = useRef(null)
  const focusDropdownRef = useRef(null)
  const proTypeDropdownRef = useRef(null)
  const modelChipDropdownRef = useRef(null)
  const pathname = usePathname()
  const { startSession, endSession, markFollowUp } = useSessionTracker()
  const { allows: planAllows } = usePlan()

  // A model is selectable when it's not Pro-gated, or the user's plan allows Pro.
  const modelAllowed = (m) => !m?.pro || planAllows('pro')
  const studySessionRef = useRef(null)
  const firstMessageSent = useRef(false)
  const lastConvoRef = useRef(null)
  const emptyRetryRef = useRef(false)
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
      // Paginate through ALL sessions — the old hard `.limit(30)` silently
      // dropped every conversation past the 30 most recent, which read as
      // "history is missing most of my chats".
      const PAGE = 100
      const MAX_SESSIONS = 300
      let all = []
      let anyPageOk = false
      // Pull the rename/pin meta columns straight from the DB (they exist once
      // chat-session-meta-migration.sql has run). If the DB predates the
      // migration, PostgREST rejects the unknown columns — retry once without
      // them so history still loads and device-local meta keeps covering.
      let metaCols = true
      while (all.length < MAX_SESSIONS) {
        const { data, error } = await supabasePublic
          .from('chat_sessions')
          .select(metaCols ? 'id, messages, updated_at, title, pinned' : 'id, messages, updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .range(all.length, all.length + PAGE - 1)
        if (error) {
          if (metaCols) { metaCols = false; continue }
          break
        }
        anyPageOk = true
        if (!data || data.length === 0) break
        all = all.concat(data)
        if (data.length < PAGE) break
      }
      if (anyPageOk) setChatHistory(all)
    } catch {}
  }

  // History reload — only after a reply has fully finished. During streaming
  // the content prefix changes on nearly every token, so this effect must NOT
  // key off raw content changes then (it used to fire a query per delta).
  const lastAssistantMsgId = useRef(null)
  useEffect(() => {
    if (loading) return
    if (user && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      const lastId = messages[messages.length - 1].content?.slice(0, 50)
      if (lastId !== lastAssistantMsgId.current) {
        lastAssistantMsgId.current = lastId
        loadHistory(user.id)
      }
    }
  }, [messages, loading, user])

  // Auto-scroll: instant follow while pinned (a smooth animation restarted
  // per token is what made scrolling feel glitchy). Skipped when the user
  // scrolled up so reading isn't interrupted.
  useEffect(() => {
    if (!pinnedToBottomRef.current) return
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
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
      const savedEffort = localStorage.getItem('kivora-chat-effort')
      if (savedEffort && EFFORT_LEVELS.some(l => l.level === savedEffort)) setEffort(savedEffort)
    } catch {}
  }, [])
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
    setMessages(normalizeMessages(session.messages))
    firstMessageSent.current = true
    setHistoryOpen(false)
    setAttachedFile(null)
    setAttachedContent('')
    setAttachedIsImage(false)
    // v5.20 — a reload can happen while a reply is still streaming; probe
    // the server-side buffer and recover the generation if needed.
    probePendingGeneration(session.id)
  }

  // ── Delete a conversation ──
  // Goes straight through supabase-js against chat_sessions — RLS
  // (`users own chats`) enforces ownership server-side, and the extra
  // .eq('user_id') keeps the delete targeted even before that check.
  async function deleteSession(sid) {
    if (!user || !sid) return
    // v5.17 — gated behind the "Are you sure?" card (pendingDelete), no more
    // native window.confirm
    setPendingDelete({ sid })
  }

  async function performDeleteSession(sid) {
    if (!user || !sid) return
    removeSessionMeta(sid) // v5.18 — dropped conversations leave no ghost meta
    const prev = chatHistory
    setChatHistory(prevList => prevList.filter(s => s.id !== sid))
    if (sid === sessionId) clearChat()
    try {
      const { error } = await supabasePublic
        .from('chat_sessions')
        .delete()
        .eq('id', sid)
        .eq('user_id', user.id)
      if (error) throw error
    } catch {
      setChatHistory(prev) // optimistic removal failed — restore
    }
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

  // ── v5.14: long-press bubble actions ─────────────────────────────
  // Press and hold any bubble for 450ms → a premium action card pops open
  // (hush-pop, portal-rendered) with Copy / Read aloud / Share / Export.
  // Replaces the desktop-only hover row — touch and mouse behave the same
  // via pointer events. Same interaction language as the research page's
  // long-press pill delete card.
  const clearBubblePress = useCallback(() => {
    if (bubblePressRef.current.timer) { clearTimeout(bubblePressRef.current.timer); bubblePressRef.current.timer = null }
  }, [])
  useEffect(() => clearBubblePress, [clearBubblePress])

  const startBubblePress = useCallback((e, msg, index) => {
    if (e.button !== undefined && e.button !== 0) return
    const el = e.currentTarget
    bubblePressRef.current.longFired = false
    bubblePressRef.current.x = e.clientX
    bubblePressRef.current.y = e.clientY
    clearBubblePress()
    bubblePressRef.current.timer = setTimeout(() => {
      bubblePressRef.current.longFired = true
      const rect = el?.getBoundingClientRect()
      if (!rect) return
      const CARD_W = 224
      const estH = msg.role === 'user' ? 96 : 240
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - CARD_W - 8))
      const below = rect.bottom + 8
      const top = below + estH > window.innerHeight ? Math.max(8, rect.top - estH - 8) : below
      setBubbleAction({ index, role: msg.role, top, left, content: msg.content, isImage: !!msg.isImage, showExport: false })
      try { navigator.vibrate?.(15) } catch {}
    }, 450)
  }, [clearBubblePress])

  // Moving the pointer >8px cancels the hold (desktop drag-selection still works)
  const moveBubblePress = useCallback((e) => {
    const p = bubblePressRef.current
    if (!p.timer) return
    if (Math.abs(e.clientX - p.x) > 8 || Math.abs(e.clientY - p.y) > 8) clearBubblePress()
  }, [clearBubblePress])

  // After a long-press, swallow the click that follows pointer-up so the
  // image lightbox doesn't open on release.
  const bubbleClickGuard = useCallback(() => {
    if (bubblePressRef.current.longFired) { bubblePressRef.current.longFired = false; return true }
    return false
  }, [])

  const closeBubbleAction = useCallback(() => setBubbleAction(null), [])

  function bubbleCopy() {
    if (!bubbleAction) return
    copy(bubbleAction.content, bubbleAction.index)
    closeBubbleAction()
  }
  function bubbleSpeak() {
    if (!bubbleAction) return
    if (tts.isSpeaking) tts.stop()
    else tts.speak(bubbleAction.content)
  }
  function bubbleShare() {
    if (!bubbleAction) return
    copy(`${window.location.origin}/chat?share=${encodeURIComponent(String(bubbleAction.content || '').slice(0, 100))}`, bubbleAction.index)
    closeBubbleAction()
  }
  function bubbleExport(format) {
    exportChat(format)
    closeBubbleAction()
  }

  // ── v5.18: long-press conversation actions ──────────────────────
  // Press and hold a conversation row for 450ms → the session action card
  // opens (same design DNA as the delete-confirmation card) with Pin /
  // Rename / Share / Delete. Same interaction language as the bubble
  // long-press above: pointer events, 450ms hold, >8px movement cancels,
  // the click that follows the hold is swallowed.
  const clearSessionPress = useCallback(() => {
    if (sessionPressRef.current.timer) { clearTimeout(sessionPressRef.current.timer); sessionPressRef.current.timer = null }
  }, [])
  useEffect(() => clearSessionPress, [clearSessionPress])

  // Hydrate the rename/pin mirror once on mount
  useEffect(() => { setSessionMeta(readChatMeta()) }, [])

  const startSessionPress = useCallback((e, session) => {
    if (e.button !== undefined && e.button !== 0) return
    sessionPressRef.current.longFired = false
    sessionPressRef.current.x = e.clientX
    sessionPressRef.current.y = e.clientY
    clearSessionPress()
    sessionPressRef.current.timer = setTimeout(() => {
      sessionPressRef.current.longFired = true
      const meta = sessionMeta[session.id] || {}
      setSessionAction({
        sid: session.id,
        title: meta.title || session.title || chatTitle(session),
        pinned: !!(meta.pinned ?? session.pinned),
      })
      setSessionRenameMode(false)
      setSessionRenameValue(meta.title || '')
      try { navigator.vibrate?.(15) } catch {}
    }, 450)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSessionPress, sessionMeta])

  // Moving the pointer >8px cancels the hold (scrolling still works)
  const moveSessionPress = useCallback((e) => {
    const p = sessionPressRef.current
    if (!p.timer) return
    if (Math.abs(e.clientX - p.x) > 8 || Math.abs(e.clientY - p.y) > 8) clearSessionPress()
  }, [clearSessionPress])

  // After a long-press, swallow the click that follows pointer-up so the
  // conversation doesn't also load on release.
  const sessionClickGuard = useCallback(() => {
    if (sessionPressRef.current.longFired) { sessionPressRef.current.longFired = false; return true }
    return false
  }, [])

  function closeSessionAction() {
    setSessionAction(null)
    setSessionRenameMode(false)
    setSessionRenameValue('')
  }

  // Escape closes the card (same rule as ConfirmDialog)
  useEffect(() => {
    if (!sessionAction) return
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeSessionAction() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sessionAction])

  // Persist a meta patch: DB first (works once chat-session-meta-migration.sql
  // has added the columns — PostgREST rejects unknown columns before that,
  // which we swallow), localStorage always.
  async function persistSessionMeta(sid, patch) {
    const meta = { ...readChatMeta(), [sid]: { ...(readChatMeta()[sid] || {}), ...patch, ts: Date.now() } }
    writeChatMeta(meta)
    setSessionMeta(meta)
    if (user && supabasePublic) {
      try {
        await supabasePublic
          .from('chat_sessions')
          .update(patch)
          .eq('id', sid)
          .eq('user_id', user.id)
      } catch {}
    }
  }

  function removeSessionMeta(sid) {
    const meta = readChatMeta()
    if (!meta[sid]) return
    delete meta[sid]
    writeChatMeta(meta)
    setSessionMeta(meta)
  }

  function commitSessionRename() {
    if (!sessionAction) return
    const v = sessionRenameValue.trim()
    if (v) persistSessionMeta(sessionAction.sid, { title: v.slice(0, 120) })
    closeSessionAction()
  }

  function toggleSessionPin() {
    if (!sessionAction) return
    const next = !sessionAction.pinned
    persistSessionMeta(sessionAction.sid, { pinned: next })
    setSessionAction(a => a ? { ...a, pinned: next } : a)
  }

  // Share = hand the full transcript to the OS share sheet (mobile-first),
  // falling back to clipboard copy on desktop.
  async function shareSession() {
    if (!sessionAction) return
    const session = chatHistory.find(s => s.id === sessionAction.sid)
    const msgs = Array.isArray(session?.messages) ? session.messages : []
    const title = chatTitle(session)
    let text = `Kivora conversation — ${title}\n\n`
    msgs.forEach(m => {
      const c = typeof m.content === 'string' ? m.content : ''
      text += `${m.role === 'user' ? 'You' : 'Kivora'}: ${c.slice(0, 2000)}\n\n`
    })
    if (text.length > 12000) text = text.slice(0, 12000) + '…'
    const copiedFallback = async () => {
      try {
        await navigator.clipboard.writeText(text)
        showVoiceToast('info', t('chat.session.shared') || 'Conversation copied — paste it anywhere')
      } catch {}
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text })
      } else {
        await copiedFallback()
      }
    } catch (err) {
      if (err?.name !== 'AbortError') await copiedFallback()
    }
    closeSessionAction()
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
      // downloadBlob lives in fileExportClient (browser-safe lib) — it was
      // wrongly destructured from fileExportHeavy (which does not export it),
      // so EVERY chat export died with "TypeError: i is not a function".
      const { exportChatAsPDF, exportChatAsDOCX } = await import('@/lib/fileExportHeavy')
      const { exportChatAsHTML, downloadBlob } = await import('@/lib/fileExportClient')

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

  // ── v5.20 resumable streaming ────────────────────────────────
  // When the network drops mid-response the server keeps generating in the
  // background (ctx.waitUntil) and persists output to chat_generations.
  // These helpers reconnect and catch up from the last rendered character.

  // Shared post-processing: maps a final payload (done event, legacy JSON,
  // or a resumed buffer payload) onto the assistant message. Lives at
  // component scope so both the live path and the resume path share it.
  const applyChatMeta = (msg, data, res) => {
    // Classify gate/failure payloads into a notice kind so the renderer
    // can show the dedicated ChatNoticeCard variant (upgrade / quota /
    // daily-limit / rate-limit / error) instead of a generic bubble.
    const errStatus = data.status || (res && !res.ok && res.status >= 400 ? res.status : null)
    if (data.error && (errStatus || data.quotaExceeded)) {
      msg.quotaExceeded = true // legacy flag — keeps restored history rendering as a notice
      if (data.upgrade_url) msg.upgradeUrl = data.upgrade_url
      if (errStatus === 403 || (errStatus === 402 && data.needed_plan)) msg.notice = 'upgrade'
      else if (errStatus === 402 || data.anonLimitReached) {
        msg.notice = 'quota'
        if (data.anonLimitReached) msg.anonLimitReached = true
      } else if (errStatus === 429) msg.notice = 'rate'
      else msg.notice = 'error'
    }
    if (data.searchUsed) {
      msg.searchUsed = true
      msg.searchQuery = data.searchQuery || ''
    }
    if (data.codeExecuted) msg.codeExecuted = true
    if (data.sandboxUsed) msg.sandboxUsed = true
    if (data.gpuUsed) {
      msg.gpuUsed = true
      msg.accelerator = data.accelerator || 'T4'
    }
    if (data.remoteExecUsed) {
      msg.remoteExecUsed = true
      msg.execLanguage = data.execLanguage || 'python'
    }
    if (data.downloadFile) msg.downloadFile = data.downloadFile
    if (data.urlRead) {
      msg.urlRead = true
      msg.urlReadSource = data.urlReadSource || ''
    }
    if (data.imageGenerated) {
      msg.isImage = true
      msg.imageData = data.imageData
      msg.imagePrompt = data.imagePrompt
      msg.imageModel = 'flux'
      msg.imageSize = '1024x1024'
    }
    const liveArtifacts = sanitizeArtifactsList(data.artifacts)
    if (liveArtifacts) msg.artifacts = liveArtifacts
    const liveCards = sanitizeOpportunityCardsList(data.opportunityCards)
    if (liveCards) msg.opportunityCards = liveCards
    if (data.siteDeployed && data.deployUrl) {
      msg.siteDeployed = true
      msg.deployUrl = data.deployUrl
      msg.deployProject = data.deployProject || ''
      msg.deployHtml = data.deployHtml || ''
      msg.deployCss = data.deployCss || ''
      msg.deployJs = data.deployJs || ''
    }
    return msg
  }

  // v5.23 — resume-path deltas buffer and flush at ~33Hz, same cadence as
  // the live stream path. This used to be per-token setState: a reconnect
  // catch-up (or a page-reload recovery replaying a large buffer) fired
  // hundreds of renders a second and froze the tab exactly when the user
  // was already having a bad network day.
  // NOTE: accLenRef (the resume offset) advances at FLUSH time, not at
  // receipt — it must only ever count characters that actually reached
  // state, or a mid-buffer disconnect would resume past unrendered text.
  const pendingDeltaRef = useRef('')
  const deltaFlushTimerRef = useRef(null)
  function flushAssistantDelta() {
    if (deltaFlushTimerRef.current) { clearTimeout(deltaFlushTimerRef.current); deltaFlushTimerRef.current = null }
    const buf = pendingDeltaRef.current
    if (!buf) return
    pendingDeltaRef.current = ''
    accLenRef.current += buf.length
    setMessages(prev => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last && last.role === 'assistant') next[next.length - 1] = { ...last, content: (last.content || '') + buf }
      return next
    })
  }
  function appendAssistantDelta(v) {
    if (!v) return
    pendingDeltaRef.current += v
    if (!deltaFlushTimerRef.current) deltaFlushTimerRef.current = setTimeout(flushAssistantDelta, 30)
  }

  function finalizeResumed(data, res) {
    flushAssistantDelta() // land buffered text before the authoritative replace
    setStreaming(false)
    setImageGenerating(false)
    const assistantMsg = { role: 'assistant', content: '' }
    if (data.error) {
      assistantMsg.content = data.error
    } else {
      // done is authoritative — replaces the streamed bubble (covers the
      // discardable preamble the forced-tool retry can emit)
      assistantMsg.content = data.reply || "I couldn't generate a response for that. Please try sending it again."
      if (!data.reply) assistantMsg.isError = true
    }
    applyChatMeta(assistantMsg, data, res)
    setMessages(prev => { const next = [...prev]; next[next.length - 1] = assistantMsg; return next })
  }

  function resumeGiveUp() {
    flushAssistantDelta()
    setMessages(prev => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last && last.role === 'assistant') {
        // Empty bubble (nothing ever rendered) — turn it into the error card.
        if (!String(last.content || '').trim()) next[next.length - 1] = { role: 'assistant', content: t('chat.error.network'), isError: true }
      } else {
        // The drop happened before the response even opened — no bubble yet.
        next.push({ role: 'assistant', content: t('chat.error.network'), isError: true })
      }
      return next
    })
  }

  // Reconnect with backoff until the buffer hands over a terminal event.
  // Returns 'done' | 'aborted' | 'none' | 'stalled'.
  async function runResumeLoop(sid, offset) {
    const waits = [500, 1000, 2000, 3500, 5000]
    for (let attempt = 0; attempt < 10; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, waits[Math.min(attempt - 1, waits.length - 1)]))
        // v5.23 bugfix — the offset was never advanced between attempts, so
        // every retry re-fetched from the ORIGINAL position and the catch-up
        // deltas were appended a second time (duplicated text after a flaky
        // recovery). Resume from what has actually reached state instead.
        flushAssistantDelta()
        offset = accLenRef.current
      }
      if (abortRef.current?.signal?.aborted) return 'aborted'
      try {
        const token = user ? ((await supabasePublic?.auth?.getSession())?.data?.session?.access_token || '') : ''
        const res = await fetch(`/api/chat/resume?sid=${encodeURIComponent(sid)}&offset=${offset}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: abortRef.current?.signal,
        })
        if (res.status === 404 || res.status === 403) return 'none'
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('text/event-stream') && res.body) {
          let finalEvent = null
          await streamSSE(res, (evt) => {
            if (evt.type === 'delta') appendAssistantDelta(evt.v)
            else if (evt.type === 'status' && evt.tool === 'generate_image') setImageGenerating(true)
            else if (evt.type === 'done' || evt.type === 'error') finalEvent = evt
          })
          if (finalEvent) { finalizeResumed(finalEvent, res); return 'done' }
          // stream ended without a terminal event — connection dropped
          // again mid-recovery; fall through to the next backoff attempt
        } else {
          const data = await res.json().catch(() => null)
          if (data?.status === 'done') {
            appendAssistantDelta(data.content || '')
            finalizeResumed(data, res)
            return 'done'
          }
          if (data?.status === 'error') { finalizeResumed({ ...data }, res); return 'done' }
          if (data?.status === 'forbidden' || data?.status === 'none') return 'none'
          // active row without an SSE body — retry
        }
      } catch (e) {
        if (e?.name === 'AbortError') { flushAssistantDelta(); return 'aborted' }
        // network error — next backoff attempt
      }
    }
    return 'stalled'
  }

  // Page reloaded while a reply was streaming? Ask the buffer. Called from
  // loadSession — the only path that repopulates an existing conversation.
  async function probePendingGeneration(sid) {
    try {
      if (resumingRef.current) return
      const token = user ? ((await supabasePublic?.auth?.getSession())?.data?.session?.access_token || '') : ''
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`/api/chat/resume?sid=${encodeURIComponent(sid)}&probe=1`, { headers: authHeaders })
      if (!res.ok) return
      const data = await res.json()
      if (data.status === 'active') {
        // Generation is still running server-side — open a fresh assistant
        // bubble and catch up from the very beginning of the buffer.
        resumingRef.current = true
        setReconnecting(true)
        setStreaming(true)
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])
        accLenRef.current = 0
        const controller = new AbortController()
        abortRef.current = controller // stop button works during recovery too
        let outcome = 'failed'
        try { outcome = await runResumeLoop(sid, 0) } finally {
          resumingRef.current = false
          setReconnecting(false)
          if (abortRef.current === controller) abortRef.current = null
        }
        if (outcome === 'none' || outcome === 'stalled' || outcome === 'failed') {
          setStreaming(false)
          resumeGiveUp()
        }
      } else if (data.status === 'done') {
        // Finished while we were away. The final session save usually
        // landed in the loaded transcript already — only append when the
        // last assistant bubble does not already carry this exact reply.
        const full = await fetch(`/api/chat/resume?sid=${encodeURIComponent(sid)}&offset=0`, { headers: authHeaders })
        if (!full.ok) return
        const doneData = await full.json().catch(() => null)
        if (doneData?.status !== 'done') return
        const reply = doneData.reply || doneData.content || ''
        if (!String(reply).trim()) return
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant' && String(last.content || '') === String(doneData.reply || '')) return next
          const assistantMsg = { role: 'assistant', content: reply }
          applyChatMeta(assistantMsg, doneData, full)
          next.push(assistantMsg)
          return next
        })
      }
    } catch { /* probe is best-effort */ }
  }

  async function send(retryConvo) {
    // ⚠️ Handler-reference guard: if send ever gets wired directly as an event
    // handler (onClick={send}), React passes the SyntheticEvent as retryConvo.
    // An event object would poison the messages state (the historic
    // "g.map is not a function" crash class) AND JSON.stringify(event) throws
    // "Converting circular structure to JSON", which surfaces as a bogus
    // "Network error" bubble before the fetch even fires. Treat any truthy
    // non-array retryConvo as a normal (non-retry) send instead.
    if (retryConvo && !Array.isArray(retryConvo)) retryConvo = null
    const q = input.trim()
    if (loading || resumingRef.current) return // resume loop owns the stream
    if (!retryConvo && !q && !attachedFile) return

    // Hoisted so the retry path (retryConvo set) skips straight to the fetch
    let newMessages = retryConvo || null
    let wasImage = false
    let sid = sessionId

    if (!retryConvo) {
    // Lazy-generate session ID on first send (avoids hydration mismatch
    // from generating it during render).
    // NOTE: read the id into a local — `setSessionId` alone would leave the
    // closure's `sessionId` still '' for THIS fetch, so the very first
    // message of every new conversation arrived at the API with
    // sessionId:'' and was silently never saved to history.
    if (!sid) {
      sid = crypto.randomUUID()
      setSessionId(sid)
    }

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
    // v5.14 — text-file attachments: `content` keeps the full [File: …]
    // payload for the API, but the typed question is remembered separately
    // so the conversation card renders ONLY the question — never the
    // mirrored file body (uploading an HTML file used to dump its entire
    // source into the bubble).
    if (attachedFile && attachedContent && !attachedIsImage) {
      userMsg.fileQuestion = q
    }
    newMessages = [...messages, userMsg]
    // Keep the exact conversation sent for this reply — an empty-response
    // auto-retry re-runs it verbatim (same sessionId, no re-append).
    lastConvoRef.current = newMessages
    emptyRetryRef.current = false
    setMessages(newMessages)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Capture attachment state before clearing
    wasImage = attachedIsImage

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
    } // end if (!retryConvo)

    if (!retryConvo) setLoading(true)
    else {
      setLoading(true)
      // Retry re-adds nothing — the conversation already ends with the user message
      setMessages(retryConvo)
    }

    try {
      // Wire the request to an AbortController so the stop button can cancel
      // it — the SSE stream (or legacy JSON response) ends immediately.
      const controller = new AbortController()
      abortRef.current = controller

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user ? { Authorization: `Bearer ${(await supabasePublic?.auth?.getSession())?.data?.session?.access_token || ''}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages,
          sessionId: sid,
          userId: user?.id || null,
          model: wasImage ? undefined : model, // Vision model is auto-selected by API
          systemPrompt: customSystemPrompt || undefined,
          focusMode: focusMode || 'All',
          proMode: proMode || false,
          proModeType: proModeType || undefined,
          effort,
          stream: true, // SSE — tokens render as they arrive (server falls back to JSON transparently)
        })
      })

      // Shared post-processing moved to component scope (v5.20) — the
      // resumable-stream finalizer reuses it for recovered replies.

      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('text/event-stream') && res.body) {
        // ── Streaming path — buffered flushes keep rendering smooth ──
        // Per-delta setState re-rendered the whole client and re-parsed the
        // growing markdown per token (the streaming freeze/glitch). Deltas
        // now accumulate and flush to state at ~10Hz instead.
        accLenRef.current = 0
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])
        setStreaming(true)
        let acc = ''
        let finalEvent = null
        let flushTimer = null
        const flushNow = () => {
          if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
          setMessages(prev => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') next[next.length - 1] = { ...last, content: acc }
            return next
          })
        }
        const scheduleFlush = () => {
          if (flushTimer) return
          // v5.23 — 30ms (~33Hz): continuous-motion cadence, halves the
          // worst-case display latency the v5.17 55ms tuning added. Memo'd
          // markdown carries the parse cost; 33Hz keeps it inside frame budget.
          flushTimer = setTimeout(flushNow, 30)
        }
        try {
          await streamSSE(res, (evt) => {
            if (evt.type === 'delta') {
              acc += evt.v
              accLenRef.current = acc.length // resume offset if the network drops
              scheduleFlush()
            } else if (evt.type === 'done') {
              finalEvent = evt
            } else if (evt.type === 'error') {
              finalEvent = evt
            } else if (evt.type === 'status' && evt.tool === 'generate_image') {
              // Server started the image tool — swap the generic thinking
              // indicator for a dedicated shimmer card.
              setImageGenerating(true)
            } else if (evt.type === 'status' && evt.phase === 'exec') {
              // v5.13 — AI called an exec tool: auto-switch to Live Terminal
              // and mirror the process (code → executing → output).
              openTerminalForExec(evt)
            } else if (evt.type === 'status' && evt.phase === 'done') {
              // v5.13 — exec finished: show the output in the terminal, then
              // auto-return to the conversation after a short read window.
              finishTerminalExec(evt)
            }
          })
        } finally {
          // Land whatever remains buffered (also covers abort mid-stream)
          flushNow()
        }
        setStreaming(false)
        setImageGenerating(false)
        const data = finalEvent || {}

        // ── Empty-response auto-retry ──
        // A provider can return HTTP 200 with zero content (rare, but it
        // renders as a useless "Something went wrong"). Retry the exact same
        // conversation once before giving the user an error.
        const emptyReply = !data.error && !String(data.reply || '').trim() && !acc.trim() && !data.imageGenerated
        if (emptyReply && lastConvoRef.current && !emptyRetryRef.current) {
          emptyRetryRef.current = true
          setMessages(prev => prev.slice(0, -1))
          setTimeout(() => { if (!loading) send(lastConvoRef.current) }, 400)
          return
        }
        const assistantMsg = { role: 'assistant', content: '' }
        if (data.error) {
          // Server error payloads are user-facing copy — surface verbatim on
          // the notice card; the action button (driven by upgrade_url) is the
          // way out instead of an appended text nudge.
          assistantMsg.content = data.error
        } else {
          // `done` is authoritative — replaces the live buffer (covers forced
          // tool retries where the model streamed discardable preamble text)
          assistantMsg.content = data.reply || acc || "I couldn't generate a response for that. Please try sending it again."
          if (!data.reply && !acc.trim()) assistantMsg.isError = true
        }
        applyChatMeta(assistantMsg, data, res)
        setMessages(prev => { const next = [...prev]; next[next.length - 1] = assistantMsg; return next })
      } else {
        // ── Legacy JSON path (server without stream support / error JSON) ──
        const data = await res.json()
        const fellBack = !data.reply && !data.error
        const assistantMsg = { role: 'assistant', content: data.reply || data.error || "I couldn't generate a response for that. Please try sending it again." }
        if (fellBack) assistantMsg.isError = true
        applyChatMeta(assistantMsg, data, res)
        setMessages(prev => [...prev, assistantMsg])
      }
    } catch (err) {
      setStreaming(false)
      setImageGenerating(false)
      if (err?.name === 'AbortError') {
        flushAssistantDelta() // land the tail the stop button cut off
        // User pressed stop — keep whatever already streamed. If nothing
        // arrived yet, drop the empty assistant bubble instead of showing it.
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant' && !last.content) next.pop()
          return next
        })
      } else if (sid && !resumingRef.current) {
        // v5.20 — network drop mid-generation. The server keeps generating
        // in the background and buffers output; reconnect and catch up from
        // the last character we rendered.
        flushAssistantDelta() // offset must count everything already shown
        reportClientError(err)
        resumingRef.current = true
        setReconnecting(true)
        let outcome = 'failed'
        try { outcome = await runResumeLoop(sid, accLenRef.current) } finally {
          resumingRef.current = false
          setReconnecting(false)
        }
        if (outcome === 'none' || outcome === 'stalled' || outcome === 'failed') resumeGiveUp()
      } else {
        // Feed the forensics pipeline so real network/API failures arrive with
        // a full stack instead of being indistinguishable from silent bugs.
        reportClientError(err)
        setMessages(prev => [...prev, { role: 'assistant', content: t('chat.error.network'), isError: true }])
      }
    }
    abortRef.current = null
    setLoading(false)
  }

  // Stop button — aborts the streaming request, keeping partial output
  function stopGeneration() {
    abortRef.current?.abort()
  }

  // ── Notice-card resolution ──────────────────────────────────────
  // Maps an assistant message's gate/failure metadata onto a ChatNoticeCard
  // variant, matching the ComingSoonPopup card design language. Falls back
  // to the legacy amber quota card for restored history that only carries
  // the old quotaExceeded flag.
  const noticeFor = (msg, i) => {
    if (msg.role !== 'assistant') return null
    // Body copy for the transient failure cards is deliberately short and
    // fixed — verbatim server payloads read as technical chatter inside a
    // compact card. The cards below use tight, professional, human copy.
    if (msg.notice === 'upgrade') {
      return { tone: 'upgrade', icon: 'bolt', title: 'Upgrade to continue', body: msg.content, actionLabel: 'Upgrade plan', actionHref: msg.upgradeUrl || '/pricing' }
    }
    if (msg.notice === 'quota') {
      return msg.anonLimitReached
        ? { tone: 'quota', icon: 'hourglass', title: 'Daily limit reached', body: msg.content, actionLabel: 'Sign in for more', actionHref: msg.upgradeUrl || '/auth' }
        : { tone: 'quota', icon: 'alert', title: user ? 'Credits used up' : 'Free usage limit reached', body: msg.content, actionLabel: 'Upgrade plan', actionHref: msg.upgradeUrl || '/pricing' }
    }
    if (msg.notice === 'rate') {
      return { tone: 'quota', icon: 'clock', title: 'Slow down there', body: 'Too many requests in a row — try again in a few seconds.', actionLabel: msg.upgradeUrl ? 'Sign in for more' : null, actionHref: msg.upgradeUrl || null }
    }
    if (msg.notice === 'error' || msg.isError) {
      return { tone: 'error', icon: 'warning', title: 'Something went wrong', body: 'That request hit a snag on our side — one more try usually sorts it.', actionLabel: 'Try again', onAction: () => send(messages.slice(0, i)) }
    }
    if (msg.quotaExceeded) {
      return { tone: 'quota', icon: 'alert', title: user ? 'Credits used up' : 'Free usage limit reached', body: msg.content, actionLabel: user ? 'Upgrade plan' : 'Sign in for more', actionHref: msg.upgradeUrl || (user ? '/pricing' : '/auth') }
    }
    return null
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

  // ── v5.18 history pipeline: meta merge → pin split → date groups ──
  // Renamed titles and pins come from sessionMeta (localStorage mirror,
  // later the DB columns); pinned conversations float above the date
  // groups under their own "Pinned" label.
  const isSessionPinned = useCallback(s => !!(sessionMeta[s.id]?.pinned ?? s.pinned), [sessionMeta])

  function chatTitle(session) {
    // renamed title wins → future DB column → derived from first user msg
    const metaTitle = sessionMeta[session?.id]?.title
    if (metaTitle) return metaTitle
    if (session?.title) return session.title
    // rows can carry messages as strings/objects from legacy writes —
    // only array shapes are safe to .find() over
    const msgs = Array.isArray(session?.messages) ? session.messages : []
    const first = msgs.find(m => m?.role === 'user')
    return first?.content?.slice(0, 40) || t('chat.new')
  }

  const filteredHistory = useMemo(() => {
    const q = convSearch.trim().toLowerCase()
    const base = q
      ? chatHistory.filter(s => chatTitle(s).toLowerCase().includes(q))
      : chatHistory
    const pinned = base.filter(isSessionPinned)
    const rest = base.filter(s => !isSessionPinned(s))
    const groups = []
    if (pinned.length) groups.push({ labelKey: 'chat.date.pinned', sessions: pinned })
    groups.push(...groupByDate(rest))
    return groups
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory, convSearch, sessionMeta, isSessionPinned])

  const hasInput = input.trim().length > 0 || attachedFile

  const currentModel = ALL_MODELS.find(m => m.id === model) || MODELS[0]

  // ── v5.11 Live Terminal (restored) ──────────────────────────────
  // SANDBOX mode: Cloudflare Sandbox (internet, pip/npm, persistent fs).
  // JUDGE0 mode: /api/execute bash fallback when the sandbox isn't wired.
  const [terminalMode, setTerminalMode] = useState(false)
  // Ref mirror for non-reactive write paths (queued terminal writes run
  // outside the render cycle and must not read a stale closure value)
  const terminalModeRef = useRef(false)
  useEffect(() => { terminalModeRef.current = terminalMode }, [terminalMode])
  const [sandboxAvailable, setSandboxAvailable] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const xtermRef = useRef(null)
  // v5.28 — workspace listing inside the terminal drawer; bumping the key
  // re-fetches the listing after every executed command / exec auto-save
  const [termWsOpen, setTermWsOpen] = useState(false)
  const [termWsKey, setTermWsKey] = useState(0)
  const bumpTermWs = () => setTermWsKey((k) => k + 1)

  useEffect(() => {
    fetch('/api/sandbox?action=health')
      .then(r => r.json())
      .then(data => setSandboxAvailable(data.sandbox_available === true))
      .catch(() => setSandboxAvailable(false))
  }, [])

  // Helper to write to xterm with ANSI colors
  const termWrite = (text, color) => {
    const term = xtermRef.current
    if (!term) return
    if (color) {
      const colorMap = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', gray: '\x1b[90m', reset: '\x1b[0m' }
      term.write(`${colorMap[color] || ''}${text}${colorMap.reset}`)
    } else {
      term.write(text)
    }
  }

  const termWriteln = (text, color) => {
    termWrite(text + '\r\n', color)
  }

  const termPrompt = () => {
    const term = xtermRef.current
    if (!term) return
    term.write('\r\n\x1b[32m$\x1b[0m ')
  }

  // ── v5.13: AI-driven terminal automation ────────────────────────
  // The terminal is no longer a manual tab — the AI "calls it": when code is
  // executed (execute_code tool, Run button on a code block) the chat view
  // switches to Live Terminal, mirrors the process (code → executing →
  // output), then automatically returns to the conversation when done.
  const termQueueRef = useRef([])      // writes buffered until xterm mounts
  const termAutoRef = useRef(false)    // terminal currently auto-opened by exec
  const termFinishingRef = useRef(false) // guards double done (server frame + Run button event)
  const termCloseTimerRef = useRef(null)
  const termRetryTimerRef = useRef(null)

  const LANG_NAMES = { 46: 'bash', 71: 'python', 63: 'javascript', 74: 'typescript', 82: 'sql', 62: 'java', 54: 'c++', 50: 'c', 60: 'go', 73: 'rust', 72: 'ruby', 68: 'php' }

  const flushTermQueue = () => {
    const q = termQueueRef.current
    termQueueRef.current = []
    for (const { text, color, nl } of q) {
      if (nl) termWriteln(text, color)
      else termWrite(text, color)
    }
  }

  // Ensure the terminal is mounted before writing; retries briefly because
  // the first open lazily loads the xterm chunk.
  const flushTermQueueWhenReady = (attempt = 0) => {
    if (termQueueRef.current.length === 0) return
    if (xtermRef.current) { flushTermQueue(); return }
    if (attempt > 16) { termQueueRef.current = []; return } // ~2s, give up
    if (termRetryTimerRef.current) clearTimeout(termRetryTimerRef.current)
    termRetryTimerRef.current = setTimeout(() => flushTermQueueWhenReady(attempt + 1), 120)
  }

  const queueTermWrite = (text, color, nl = false) => {
    if (xtermRef.current && terminalModeRef.current) {
      if (nl) termWriteln(text, color)
      else termWrite(text, color)
    } else {
      termQueueRef.current.push({ text, color, nl })
    }
  }

  // Exec start: switch to terminal, echo the code being executed
  const openTerminalForExec = (evt = {}) => {
    if (termCloseTimerRef.current) { clearTimeout(termCloseTimerRef.current); termCloseTimerRef.current = null }
    termAutoRef.current = true
    termFinishingRef.current = false
    setTerminalMode(true)
    terminalModeRef.current = true
    const code = String(evt.code || '')
    const lang = LANG_NAMES[evt.language_id] || ''
    queueTermWrite('', null, true)
    queueTermWrite(`\x1b[90m── Kivora AI · running ${lang || 'code'} ──\x1b[0m`, null, true)
    if (code) {
      const lines = code.split('\n').slice(0, 40)
      queueTermWrite('\x1b[32m$\x1b[0m ', null)
      lines.forEach((l, i) => {
        queueTermWrite(l.length > 160 ? l.slice(0, 160) + '…' : l, 'cyan', i < Math.min(lines.length, 40) - 1 || lines.length > 1)
      })
      if (code.split('\n').length > 40) queueTermWrite(`… ${code.split('\n').length - 40} more lines`, 'gray', true)
    } else {
      queueTermWrite('Executing…', 'gray', true)
    }
    queueTermWrite('\x1b[90mexecuting — output will appear here\x1b[0m', null, true)
    flushTermQueueWhenReady()
  }

  // Exec done: print the output, pause, switch back to the conversation
  const finishTerminalExec = (evt = {}) => {
    if (!termAutoRef.current || termFinishingRef.current) return
    termFinishingRef.current = true
    const output = String(evt.output || '')
    if (output) {
      queueTermWrite('', null, true)
      const outLines = output.split('\n')
      const shown = outLines.slice(0, 60)
      shown.forEach((l, i) => queueTermWrite(l.length > 200 ? l.slice(0, 200) + '…' : l, null, i < shown.length - 1))
      if (outLines.length > 60) queueTermWrite(`… ${outLines.length - 60} more lines (full result in chat)`, 'gray', true)
    } else {
      queueTermWrite('(no output)', 'gray', true)
    }
    if (evt.exit_code != null && evt.exit_code !== 0 && evt.exit_code !== undefined) {
      queueTermWrite(`\x1b[31m[Exit code: ${evt.exit_code}]\x1b[0m`, null, true)
    } else if (evt.exitCode != null && evt.exitCode !== 0) {
      // Run-button bridge events carry `exitCode`
      queueTermWrite(`\x1b[31m[Exit code: ${evt.exitCode}]\x1b[0m`, null, true)
    } else {
      queueTermWrite('\x1b[32m[Done]\x1b[0m', null, true)
    }
    queueTermWrite('', null, true)
    flushTermQueueWhenReady()
    bumpTermWs() // v5.28 — chat-side exec runs auto-save files server-side
    // Switch back to the conversation once the user can read the tail
    if (termCloseTimerRef.current) clearTimeout(termCloseTimerRef.current)
    termCloseTimerRef.current = setTimeout(() => {
      termAutoRef.current = false
      setTerminalMode(false)
      terminalModeRef.current = false
    }, 2600)
  }

  // CodeBlock Run button bridge (MarkdownRenderer is decoupled from chat state)
  useEffect(() => {
    const onStart = (e) => openTerminalForExec(e.detail || {})
    const onDone = (e) => finishTerminalExec(e.detail || {})
    window.addEventListener('kivora:code-exec-start', onStart)
    window.addEventListener('kivora:code-exec-done', onDone)
    return () => {
      window.removeEventListener('kivora:code-exec-start', onStart)
      window.removeEventListener('kivora:code-exec-done', onDone)
    }
  }, [])

  // v5.16 — tell the global GlobalCodeRunner drawer to stand down: the chat
  // page mirrors exec runs inside its OWN embedded Live Terminal (open/close
  // dance timed to the conversation). Set on mount, cleared on unmount —
  // navigation to any other page re-arms the global drawer.
  useEffect(() => {
    window.__kivoraChatLive = true
    return () => { window.__kivoraChatLive = false }
  }, [])

  // Preload the xterm chunk so the first auto-open is instant
  useEffect(() => { try { XTerminal.preload?.() } catch {} }, [])

  const executeCommand = async (cmd) => {
    // ── Try Cloudflare Sandbox first ──
    if (sandboxAvailable) {
      try {
        const res = await fetch('/api/sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'exec', sandbox_id: 'terminal', command: cmd, timeout: 30000 })
        })
        const data = await res.json()
        if (data.sandbox_available && data.success !== undefined) {
          let output = data.stdout || ''
          if (data.stderr) output += (output ? '\n' : '') + data.stderr
          if (!output) output = '(no output)'
          if (data.exitCode && data.exitCode !== 0) {
            termWriteln(output)
            termWriteln(`[Exit code: ${data.exitCode}]`, 'red')
          } else {
            termWriteln(output)
          }
          bumpTermWs() // v5.28 — files the run created may have been auto-captured
          termPrompt()
          return
        }
      } catch {
        // Fall through to Judge0
      }
    }

    // ── Fallback: Judge0 (bash) ──
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_code: cmd, language_id: 46 }) // Bash
      })
      const data = await res.json()

      let output = ''
      if (data.error && !data.status) {
        output = data.error
      } else {
        if (data.stdout) output += data.stdout
        if (data.compile_output) output += (output ? '\n' : '') + data.compile_output
        if (data.stderr) output += (output ? '\n' : '') + data.stderr
        if (!output) output = '(no output)'
        if (data.exit_code && data.exit_code !== 0) output += `\n[Exit code: ${data.exit_code}]`
        if (data.status?.id && data.status.id !== 3 && data.status.id !== 4) {
          output += `\n[${data.status.description}]`
        }
      }

      termWriteln(output)
    } catch {
      termWriteln('Execution failed. Check your connection.', 'red')
    }

    bumpTermWs() // v5.28 — refresh the workspace listing after each run
    termPrompt()
  }

  const askAIForCommand = async (query) => {
    termWriteln(`\x1b[90m# ${query}\x1b[0m`)

    try {
      const messages = [{ role: 'user', content: `I need a shell command for: ${query}\n\nRespond with ONLY the command, no explanation, no markdown, no code blocks. Just the raw command that can be pasted into a terminal.` }]

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model: 'openai/gpt-oss-20b' })
      })
      const data = await res.json()

      if (data.reply) {
        let cmd = data.reply.trim()
        cmd = cmd.replace(/^```(?:bash|sh|shell)?\n?/, '').replace(/\n?```$/, '').trim()
        cmd = cmd.replace(/^`|`$/g, '').trim()

        if (cmd) {
          setAiSuggestion(cmd)
          termWriteln(`\x1b[33mAI suggests:\x1b[0m ${cmd}`)
          termWriteln('\x1b[90mPress Enter to run · Esc to dismiss\x1b[0m')
        }
      }
    } catch {
      termWriteln('AI request failed.', 'red')
    }

    termPrompt()
  }

  // Handle xterm input (command submitted via Enter)
  const handleXTermInput = async (cmd) => {
    // If there's an AI suggestion pending, execute it
    if (aiSuggestion) {
      const suggestion = aiSuggestion
      setAiSuggestion(null)
      await executeCommand(suggestion)
      return
    }

    // Check if this looks like a shell command
    const isCommand = /^[a-z]/.test(cmd) && (
      /^(ls|cd|pwd|cat|echo|mkdir|rm|cp|mv|grep|find|curl|wget|npm|npx|node|python|pip|git|docker|make|chmod|chown|export|source|sudo|apt|yum|brew|which|whoami|uname|df|du|ps|top|kill|clear|history)/.test(cmd)
    )

    if (isCommand) {
      await executeCommand(cmd)
    } else {
      await askAIForCommand(cmd)
    }
  }

  // Handle xterm key events for AI suggestion dismiss
  const handleXTermKey = (domEvent) => {
    if (domEvent.key === 'Escape') {
      setAiSuggestion(null)
    }
  }

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
              <IconClose size={20} />
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
            <IconSearch size={20} className="shrink-0" />
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
                      <div
                        key={s.id}
                        className={`group relative flex items-center rounded-full transition-colors ${
                          s.id === sessionId ? 'bg-[#1a1a1a]' : 'hover:bg-[#141414]'
                        }`}
                      >
                        <button
                          onClick={() => { if (!sessionClickGuard()) loadSession(s) }}
                          onPointerDown={(e) => startSessionPress(e, s)}
                          onPointerUp={clearSessionPress}
                          onPointerLeave={clearSessionPress}
                          onPointerCancel={clearSessionPress}
                          onPointerMove={moveSessionPress}
                          onContextMenu={(e) => e.preventDefault()}
                          style={{ WebkitTouchCallout: 'none' }}
                          className={`flex-1 min-w-0 text-left px-3 py-2 text-caption transition-colors truncate ${
                            s.id === sessionId
                              ? 'text-white'
                              : 'text-[#525252] hover:text-white'
                          }`}
                        >
                          {(sessionMeta[s.id]?.pinned ?? s.pinned) ? (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1 -mt-0.5 text-[#FF3366] shrink-0" aria-hidden="true">
                              <path d="M12 17v5" />
                              <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z" />
                            </svg>
                          ) : null}
                          {chatTitle(s)}
                        </button>
                        {/* v5.23 — row-inline delete icon removed: on touch devices the
                            sticky :hover state left a trash icon latched onto whichever row
                            was last tapped, which read as a UI glitch. Delete, pin, rename
                            and share all remain available via long-press → action sheet. */}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : user ? (
            <p className="text-caption text-[#2e2e2e] px-1 pt-2">{convSearch.trim() ? (t('chat.no_results') || 'No conversations found') : (t('chat.history.empty') || 'No conversations yet')}</p>
          ) : (
            <p className="text-caption text-[#2e2e2e] px-1 pt-2">{convSearch.trim() ? (t('chat.no_results') || 'No conversations found') : (t('chat.history.empty') || 'No conversations yet')}</p>
          )}
        </div>

        {/* ── Settings toggle + Profile avatar — pinned to bottom ── */}
        <div className="px-2.5 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] border-t border-[#181818] shrink-0 space-y-0.5">
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
              <UserAvatar user={user} size={28} />
            </Link>
          ) : (
            <Link
              href="/auth"
              className="flex items-center justify-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-sm py-2 rounded-lg transition-colors font-semibold"
              onClick={() => setHistoryOpen(false)}
            >
              <IconUser size={20} />
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
            className="absolute bottom-0 left-0 right-0 h-[92vh] bg-[#0a0a0a] rounded-t-[24px] flex flex-col overflow-hidden animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#444]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-center px-4 py-2 relative min-h-[44px] shrink-0">
              {settingsCurrentPage !== 'root' ? (
                <BackButton
                  onClick={settingsPop}
                  label={t('common.back') || 'Back'}
                  glyph={20}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                />
              ) : (
                <BackButton
                  onClick={() => { setSettingsOpen(false); settingsReset() }}
                  label={t('common.close') || 'Close'}
                  variant="circle"
                  glyph={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                />
              )}
              <span className="text-[17px] font-semibold tracking-tight text-white">
                {settingsCurrentPage === 'root' && (t('chat.settings') || 'Settings')}
                {settingsCurrentPage === 'model' && 'Select model'}
                {settingsCurrentPage === 'effort' && 'Effort'}
                {settingsCurrentPage === 'more-models' && 'More models'}
                {settingsCurrentPage === 'voice' && 'Voice'}
                {settingsCurrentPage === 'prompt' && (t('chat.custom_prompt') || 'System Prompt')}
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
                      <div className="w-10 h-10 rounded-[11px] bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
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
                      <div className="w-10 h-10 rounded-[11px] bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
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
                      <div className="w-10 h-10 rounded-[11px] bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
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

                    {/* Full Voice Settings shortcut — v5.30 removed: the Voice
                        row above now opens the exact same coming-soon card
                        inline, so this modal shortcut was pure duplication */}
                  </div>
                )}

                {/* ══════ MODEL SELECTOR ══════ */}
                {settingsCurrentPage === 'model' && (
                  <div className="divide-y divide-[#2a2a2a]">
                    {ALL_MODELS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (!modelAllowed(m)) {
                            setShowUpgrade({ name: m.name })
                            return
                          }
                          setModel(m.id)
                        }}
                        className="w-full py-4 text-left active:opacity-60 transition-opacity"
                      >
                        <div className="flex items-center gap-2.5 mb-1">
                          <span className={`text-[17px] font-medium ${model === m.id ? 'text-[#dc2626]' : 'text-white'}`}>{m.name}</span>
                          {m.pro && (
                            <span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.5px] px-[7px] py-[2px] rounded-[5px] uppercase text-[#4a7fb5] bg-[rgba(74,127,181,0.12)]">
                              {!modelAllowed(m) && <IconLock size={9} />}
                              Pro
                            </span>
                          )}
                          {m.tag && !m.pro && (
                            <span className={`text-[10px] font-bold tracking-[0.5px] px-[7px] py-[2px] rounded-[5px] uppercase ${
                              m.tag.toLowerCase().includes('premium')
                                ? 'text-[#4a7fb5] bg-[rgba(74,127,181,0.12)]'
                                : m.tag.toLowerCase().includes('free') || m.tag.toLowerCase().includes('fast')
                                  ? 'text-[#4caf50] bg-[rgba(76,175,80,0.12)]'
                                  : 'text-[#888] bg-[rgba(255,255,255,0.06)]'
                            }`}>
                              {m.tag}
                            </span>
                          )}
                        </div>
                        <div className={`text-[14px] flex items-center justify-between ${model === m.id ? 'text-[#dc2626]' : 'text-[#888]'}`}>
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
                        <div className="text-[13px] text-[#888]">{(EFFORT_LEVELS.find(l => l.level === effort) || EFFORT_LEVELS[0]).label}</div>
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
                    {EFFORT_LEVELS.map(opt => {
                      const selected = effort === opt.level
                      return (
                        <button
                          key={opt.level}
                          onClick={() => {
                            setEffort(opt.level)
                            try { localStorage.setItem('kivora-chat-effort', opt.level) } catch {}
                          }}
                          className={`w-full px-4 py-[18px] rounded-[14px] text-left transition-all active:scale-[0.98] ${
                            selected
                              ? 'bg-[rgba(220,38,38,0.08)] border-2 border-[#dc2626]'
                              : 'bg-[#141414] border-2 border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[16px] font-medium text-white">{opt.label}</span>
                            <span className={`text-[20px] text-[#dc2626] transition-opacity ${selected ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                          </div>
                          <div className="text-[13px] text-[#888] mt-0.5">{opt.desc}</div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* ══════ MORE MODELS ══════ */}
                {settingsCurrentPage === 'more-models' && (
                  <div className="divide-y divide-[#2a2a2a]">
                    {EXTRA_MODELS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          if (!modelAllowed(m)) {
                            setShowUpgrade({ name: m.name })
                            return
                          }
                          setModel(m.id)
                        }}
                        className="w-full py-4 text-left active:opacity-60 transition-opacity"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[17px] font-medium ${model === m.id ? 'text-[#dc2626]' : 'text-white'}`}>{m.name}</span>
                          {m.pro && (
                            <span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.5px] px-[7px] py-[2px] rounded-[5px] uppercase text-[#4a7fb5] bg-[rgba(74,127,181,0.12)]">
                              {!modelAllowed(m) && <IconLock size={9} />}
                              Pro
                            </span>
                          )}
                        </div>
                        <div className={`text-[14px] flex items-center justify-between mt-1 ${model === m.id ? 'text-[#dc2626]' : 'text-[#888]'}`}>
                          <span>{m.id}</span>
                          {model === m.id && <span className="text-[20px]">✓</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* ══════ VOICE — the exact same card the text-bar voice icon
                        used to open (v5.30 unification: one design, one
                        source of truth — components/ComingSoonPopup.jsx) ══════ */}
                {settingsCurrentPage === 'voice' && (
                  <div className="py-6 flex justify-center">
                    <div className="w-full max-w-[360px]">
                      <ComingSoonCard feature="Voice Settings" onClose={settingsPop} />
                    </div>
                  </div>
                )}

                {/* ══════ SYSTEM PROMPT ══════ */}
                {settingsCurrentPage === 'prompt' && (
                  <div className="py-3">
                    <div className="text-[13px] text-[#888] mb-3">Current prompt</div>
                    <textarea
                      rows={6}
                      className="w-full bg-[#141414] border border-[#2a2a2a] rounded-[12px] px-4 py-3.5 text-[14px] text-white placeholder-[#3a3a3a] resize-vertical outline-none focus:border-[#3a3a3a] transition-colors font-[inherit] leading-relaxed"
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



                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* Main chat area — h-full + min-h-0 to prevent scroll collapse (research page pattern, commit 40cd66c) */}
      <div className="flex-1 min-h-0 flex flex-col min-w-0">
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

        {/* ── v5.22 guest banner — chat is open to everyone; this is the upgrade nudge ── */}
        {!user && !guestBannerClosed && (
          <div role="status" className="shrink-0 px-4 sm:px-6 py-2 bg-[#141414]/80 border-b border-white/[0.05] flex items-center gap-3">
            <span className="text-xs text-[#a3a3a3] flex-1 min-w-0 truncate">
              {t('chat.guest_banner') || "You're chatting as a guest — history stays on this device only."}
            </span>
            <Link
              href="/auth"
              className="shrink-0 text-xs font-semibold text-white bg-[#dc2626] hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              {t('nav.signin') || 'Sign in'}
            </Link>
            <button
              onClick={() => {
                setGuestBannerClosed(true)
                try { window.localStorage.setItem('kv_guest_banner_dismissed', '1') } catch {}
              }}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-[#525252] hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label={t('common.close') || 'Dismiss'}
            >
              <IconClose size={13} />
            </button>
          </div>
        )}

        {/* ── v5.11 Live Terminal (restored) ── */}
        {terminalMode ? (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] shrink-0">
              <span className={`w-2 h-2 rounded-full ${sandboxAvailable ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`} />
              <span className="text-[12px] font-mono text-[#737373] uppercase tracking-wider">Live Terminal</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${sandboxAvailable ? 'bg-amber-500/10 text-amber-400/70 border border-amber-500/20' : 'bg-green-500/10 text-green-400/70 border border-green-500/20'}`}>
                {sandboxAvailable ? 'SANDBOX' : 'JUDGE0'}
              </span>
              {sandboxAvailable && (
                <span className="text-[10px] text-[#525252]">· internet · pip/npm · persistent</span>
              )}
              {aiSuggestion && (
                <span className="text-[10px] text-yellow-400 ml-auto animate-pulse">AI suggestion pending — Enter to run</span>
              )}
              {/* v5.28 — toggle the persistent-workspace listing inside the drawer */}
              <button
                onClick={() => setTermWsOpen((o) => !o)}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${termWsOpen ? 'text-[#FF3366] bg-[#FF3366]/10' : 'text-[#525252] hover:text-white hover:bg-white/[0.06]'} ${aiSuggestion ? '' : 'ml-auto'}`}
                title={t('vfs.title')}
                aria-label={t('vfs.title')}
                aria-pressed={termWsOpen}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </button>
              <button
                onClick={() => setTerminalMode(false)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#525252] hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Back to chat"
                aria-label="Back to chat"
              >
                <IconClose size={13} />
              </button>
            </div>

            {/* v5.28 — persistent workspace listing (real files, unlike the
                ephemeral `ls` a terminal command sees on Judge0) */}
            <TerminalWorkspace
              visible={terminalMode && termWsOpen}
              getToken={async () => user ? (await supabasePublic?.auth?.getSession())?.data?.session?.access_token || '' : ''}
              t={t}
              refreshKey={termWsKey}
            />

            {/* xterm.js terminal */}
            <div className="flex-1 min-h-0 bg-[#0d0d0d] p-2 terminal-xterm-container">
              <XTerminal
                ref={xtermRef}
                onInput={handleXTermInput}
                onKey={handleXTermKey}
                welcomeMessage={'\x1b[32mWelcome to Live Terminal\x1b[0m\r\nType a shell command to execute it directly.\r\nOr type a natural language query and AI will suggest a command.' + (sandboxAvailable ? '\r\n\x1b[33mSandbox mode active — internet access, pip/npm install, and persistent filesystem available.\x1b[0m' : '')}
                className="terminal-xterm"
              />
            </div>
          </div>
        ) : (
        // Messages area — flex-1 + min-h-0 + overflow-y-auto for stable scrolling (research page pattern)
        <div
          ref={scrollContainerRef}
          onScroll={(e) => {
            const el = e.currentTarget
            pinnedToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
          }}
          className="flex-1 min-h-0 overflow-y-auto overscroll-behavior-contain"
          role="log"
          aria-live="polite"
          aria-label={t('chat.title') || 'Chat'}
        >
          <div className="max-w-[960px] mx-auto px-[min(5vw,48px)] py-6 space-y-4">
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
              const notice = noticeFor(msg, i)
              // For display: NEVER mirror a file's raw body onto the card.
              // New sends carry `fileQuestion` (the typed question only);
              // legacy messages without it fall back to the parsed body,
              // capped so a whole HTML source can't flood the bubble again.
              let displayContent = msg.content
              let hasFileAttachment = false
              let hasImageAttachment = false
              let attachmentName = ''

              if (msg.role === 'user') {
                const fileMatch = msg.content.match(/^\[File: (.+?)\]\n/)
                if (fileMatch) {
                  hasFileAttachment = true
                  attachmentName = fileMatch[1]
                  if (typeof msg.fileQuestion === 'string') {
                    displayContent = msg.fileQuestion
                  } else {
                    const body = msg.content.replace(/^\[File: .+?\]\n/, '').replace(/^\n+/, '')
                    displayContent = body.length > 400 ? `${body.slice(0, 400)}…` : body
                  }
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
                <div key={i} data-msg-index={i} className={`flex msg-row ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`group ${msg.role === 'user' ? 'max-w-[85%] sm:max-w-[65%]' : 'w-full'}`}
                    onPointerDown={(e) => startBubblePress(e, msg, i)}
                    onPointerUp={clearBubblePress}
                    onPointerLeave={clearBubblePress}
                    onPointerCancel={clearBubblePress}
                    onPointerMove={moveBubblePress}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ WebkitTouchCallout: 'none' }}
                  >
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
                    {msg.role === 'assistant' && Array.isArray(msg.artifacts) && msg.artifacts.length > 0 && (
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
                    {/* Premium preview card for deployed sites (Replit/Claude/Kimi-style) */}
                    {msg.role === 'assistant' && msg.siteDeployed && msg.deployUrl && (
                      <CodePreviewCard
                        url={msg.deployUrl}
                        projectName={msg.deployProject}
                        html={msg.deployHtml}
                        css={msg.deployCss}
                        js={msg.deployJs}
                      />
                    )}
                    {msg.role === 'assistant' && Array.isArray(msg.opportunityCards) && msg.opportunityCards.length > 0 && (
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
                      notice ? (
                        <ChatNoticeCard {...notice} />
                      ) : msg.isImage && msg.imageData ? (
                        <div className="max-w-md" data-image-card="true">
                          {/* v5.14 premium preview — gradient accent frame,
                              header strip, Lightbox full view, HUSH actions */}
                          <div className="image-reveal rounded-2xl p-[1px] bg-gradient-to-br from-[#FF3366]/35 via-white/[0.08] to-white/[0.02] shadow-[0_10px_44px_rgba(255,51,102,0.10)]">
                            <div className="rounded-2xl overflow-hidden bg-[#101010] border border-white/[0.04]">
                              <div className="flex items-center justify-between px-3.5 py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#FF3366]">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></svg>
                                    AI Image
                                  </span>
                                  <span className="text-[10px] text-[#525252]">flux · 1024px</span>
                                </div>
                                <button
                                  onClick={() => { if (!bubbleClickGuard()) setPreviewImage(msg.imageData) }}
                                  className="text-[#525252] hover:text-white transition-colors cursor-pointer"
                                  title="View full size"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>
                                </button>
                              </div>
                              <button
                                onClick={() => { if (!bubbleClickGuard()) setPreviewImage(msg.imageData) }}
                                className="block w-full cursor-zoom-in"
                                title="View full size"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={msg.imageData} alt={msg.imagePrompt || 'AI Generated'} className="w-full h-auto" />
                              </button>
                              <div className="flex items-center gap-3 px-3.5 py-3 border-t border-white/[0.05]">
                                <p className="text-[11px] leading-[1.5] text-[#737373] line-clamp-2 min-w-0 flex-1">
                                  {msg.imagePrompt || 'AI generated image'}
                                </p>
                                <a
                                  href={msg.imageUrl || msg.imageData}
                                  target={msg.imageUrl ? '_blank' : undefined}
                                  rel="noopener noreferrer"
                                  download
                                  className="inline-flex items-center gap-1.5 shrink-0 bg-[#FF3366]/10 hover:bg-[#FF3366]/20 border border-[#FF3366]/25 hover:border-[#FF3366]/45 rounded-lg px-3 py-1.5 text-[11px] font-medium text-[#FF3366] transition-colors"
                                >
                                  <IconDownload size={11} />
                                  Download
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <MarkdownRenderer content={msg.content} streaming={streaming && i === messages.length - 1} />
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
                    {/* v5.14 — hover action row removed: all bubble actions
                        (Copy / Read aloud / Share / Export) now live in the
                        long-press action card above. */}
                  </div>
                </div>
              )
            })}

            {reconnecting && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] text-[#ffb84d] bg-[#ffb84d]/[0.08] border border-[#ffb84d]/[0.15]">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ffb84d] animate-pulse" />
                  {t('chat.reconnecting')}
                </div>
              </div>
            )}

            {loading && imageGenerating ? (
              <ImageGeneratingCard />
            ) : loading && !(
              messages.length > 0 &&
              messages[messages.length - 1].role === 'assistant' &&
              String(messages[messages.length - 1].content || '').trim()
            ) && (
              <div className="flex justify-start">
                <div className="ai-thinking-indicator">
                  <div className="ai-thinking-orb">
                    <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                      <circle cx="16" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" className="ai-orb-node ai-orb-top" />
                      <circle cx="7" cy="24" r="3" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" className="ai-orb-node ai-orb-left" />
                      <circle cx="25" cy="24" r="3" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" className="ai-orb-node ai-orb-right" />
                      <line x1="16" y1="11.5" x2="7" y2="21" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="ai-orb-line" />
                      <line x1="16" y1="11.5" x2="25" y2="21" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="ai-orb-line" />
                      <line x1="7" y1="24" x2="25" y2="24" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="ai-orb-line" />
                    </svg>
                  </div>
                  <span className="ai-thinking-label">Thinking</span>
                  <span className="ai-thinking-activity" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
        )}

        {/* ── Expandable Chat Bar (hidden in terminal mode) ────────────────────── */}
        {!terminalMode && (
        <div className="shrink-0 px-[min(5vw,48px)] pb-[max(16px,env(safe-area-inset-bottom))] pt-2" style={{ overflow: 'visible' }}>
          <div className="max-w-[960px] mx-auto" style={{ overflow: 'visible' }}>
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
            {/* File attachment chip — v5.11: real thumbnail for images,
                click opens the full-screen Lightbox preview */}
            {attachedFile && barExpanded && (
              <div className="mb-2 flex items-center justify-end">
                <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[12px] text-[#a3a3a3]">
                  {attachedIsImage ? (
                    <button
                      onClick={() => setPreviewImage(attachedContent)}
                      className="relative shrink-0 group/thumb"
                      title="Preview image"
                      aria-label="Preview attached image"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={attachedContent}
                        alt={attachedFile}
                        className="w-9 h-9 rounded-md object-cover border border-white/[0.08] group-hover/thumb:border-[#FF3366]/50 transition-colors"
                      />
                      <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/0 group-hover/thumb:bg-black/30 transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover/thumb:opacity-100 transition-opacity"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                      </span>
                    </button>
                  ) : (
                    <IconFile size={14} className="shrink-0" />
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

                {/* Send / Stop button */}
                {loading ? (
                  <button
                    onClick={stopGeneration}
                    className="chat-collapsed-send chat-collapsed-send-active text-red-500 hover:text-red-400"
                    aria-label="Stop generating"
                    title={t('chat.stop')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>
                  </button>
                ) : (
                  <button
                    onClick={() => send()}
                    disabled={!hasInput}
                    className={`chat-collapsed-send ${hasInput ? 'chat-collapsed-send-active' : ''}`}
                    aria-label="Send message"
                  >
                    {hasInput ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24"><rect x="4" y="8" width="2" height="8" rx="1" fill="currentColor"/><rect x="8" y="5" width="2" height="14" rx="1" fill="currentColor"/><rect x="12" y="9" width="2" height="6" rx="1" fill="currentColor"/><rect x="16" y="6" width="2" height="12" rx="1" fill="currentColor"/><rect x="20" y="10" width="2" height="4" rx="1" fill="currentColor"/></svg>
                    )}
                  </button>
                )}
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
                          {/* v5.30 — terminal-style header (DevTools dock language) */}
                          <div className="chat-dd-head">
                            <span className="chat-dd-dot" />
                            <span className="chat-dd-title">{t('chat.dd.focus')}</span>
                            <span className="chat-dd-pill">{t(FOCUS_MODES.find(m => m.id === focusMode)?.labelKey || '')}</span>
                          </div>
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
                              {m.id === focusMode && <IconCheck size={14} className="text-[#FF3366] shrink-0 ml-auto" />}
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

                    {/* v5.27 — Workspace: files the AI creates persist here */}
                    <button
                      className="chat-toolbar-btn"
                      onClick={() => setWsOpen(true)}
                      title={t('vfs.title')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                    </button>

                    {/* v5.13 — terminal icon removed: the AI opens Live Terminal
                        automatically when it runs code, and returns to chat
                        when the process finishes */}

                    {/* v5.30 — voice icon removed: Voice settings live in
                        Chat Settings → Voice (same card, always available).
                        The AI reads aloud via the TTS engine without this chip. */}

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
                          {/* v5.30 — terminal-style header (DevTools dock language) */}
                          <div className="chat-dd-head">
                            <span className="chat-dd-dot" />
                            <span className="chat-dd-title">{t('chat.dd.model')}</span>
                            <span className="chat-dd-pill">{currentModel.short}</span>
                          </div>
                          {ALL_MODELS.map(m => (
                            <button
                              key={m.id}
                              onClick={() => {
                                if (!modelAllowed(m)) {
                                  setShowUpgrade({ name: m.name })
                                  setModelChipDropdownOpen(false)
                                  return
                                }
                                setModel(m.id); setModelChipDropdownOpen(false)
                              }}
                              className={`chat-model-option ${m.id === model ? 'chat-model-option-active' : ''}`}
                            >
                              <div>
                                <div className="chat-model-name flex items-center gap-1.5">
                                  {m.name}
                                  {m.pro && (
                                    <span className="flex items-center gap-0.5 text-[8px] font-bold tracking-[0.5px] px-[4px] py-[1px] rounded-[3px] uppercase text-[#4a7fb5] bg-[rgba(74,127,181,0.15)]">
                                      {!modelAllowed(m) && <IconLock size={8} />}
                                      Pro
                                    </span>
                                  )}
                                </div>
                                <div className="chat-model-tag">{m.tag}</div>
                              </div>
                              {m.id === model && <IconCheck size={14} className="text-[#FF3366] shrink-0" />}
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
                        <span className="chat-pro-label flex items-center gap-1">
                          Pro
                        </span>
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
                          {/* v5.30 — terminal-style header (DevTools dock language) */}
                          <div className="chat-dd-head">
                            <span className="chat-dd-dot" />
                            <span className="chat-dd-title">{t('chat.dd.pro')}</span>
                            <span className="chat-dd-pill">{t(PRO_MODES.find(m => m.id === proModeType)?.labelKey || '')}</span>
                          </div>
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
                              {m.id === proModeType && <IconCheck size={14} className="text-[#FF3366] shrink-0" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Submit / Stop button */}
                    {loading ? (
                      <button
                        onClick={stopGeneration}
                        className="chat-submit-btn chat-submit-btn-active text-red-500 hover:text-red-400"
                        aria-label="Stop generating"
                        title={t('chat.stop')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>
                      </button>
                    ) : (
                      <button
                        onClick={() => send()}
                        disabled={!hasInput}
                        className={`chat-submit-btn ${hasInput ? 'chat-submit-btn-active' : ''}`}
                        aria-label="Send message"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
        )}

      </div>

      {/* ── v5.30 — ComingSoonPopup removed with the text-bar voice icon:
              the exact same card now lives in Chat Settings → Voice ══ */}

      {/* ── Pro model gate — upgrade prompt ── */}
      {showUpgrade && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setShowUpgrade(null)}>
          <div
            className="w-full max-w-[380px] bg-[#111] border border-[#262626] rounded-2xl p-6 sm:p-8 shadow-2xl text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-[rgba(74,127,181,0.12)] border border-[rgba(74,127,181,0.25)] rounded-xl flex items-center justify-center mx-auto mb-4 text-[#4a7fb5]">
              <IconLock size={20} />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">{showUpgrade.name} is a Pro model</h3>
            <p className="text-sm text-[#a3a3a3] leading-relaxed mb-5">
              DeepSeek R1 and Qwen QwQ are advanced reasoning models reserved for the Pro plan and above.
              Upgrade to unlock deeper thinking, longer responses and priority compute.
            </p>
            <div className="flex gap-2.5">
              <Link href="/pricing" className="flex-1 text-center py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors">
                Upgrade to Pro
              </Link>
              <button
                onClick={() => setShowUpgrade(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-[#ccc] text-sm transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

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

        /* ── v5.30 Terminal-style dropdown cards ───────────────────
           Design language lifted from the Live Terminal / DevTools dock:
           #0d0d0d panel, #111 strip header with pulse dot + mono uppercase
           title + accent status pill, #262626 walls, cubic-bezier motion. */

        .chat-model-dropdown,
        .chat-focus-dropdown,
        .chat-pro-dropdown {
          background: #0d0d0d;
          border: 1px solid #262626;
          border-radius: 14px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.45);
          overflow: hidden;
          padding: 0 0 4px;
          max-width: calc(100vw - 32px);
        }
        .chat-model-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          width: 240px;
          z-index: 100;
          animation: chatDdUpC 240ms cubic-bezier(0.22,1,0.36,1);
        }
        .chat-focus-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          width: 272px;
          z-index: 100;
          animation: chatDdUpC 240ms cubic-bezier(0.22,1,0.36,1);
        }
        .chat-pro-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          width: 272px;
          z-index: 100;
          animation: chatDdUpR 240ms cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes chatDdUpC {
          from { opacity: 0; transform: translateX(-50%) translateY(7px) scale(0.97); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes chatDdUpR {
          from { opacity: 0; transform: translateY(7px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chatDdPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(255,51,102,0.55); }
          50% { opacity: 0.35; box-shadow: 0 0 2px rgba(255,51,102,0.25); }
        }
        /* Terminal header strip — mirror of the Live Terminal drawer header */
        .chat-dd-head {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          padding: 0 12px;
          margin-bottom: 4px;
          background: #111111;
          border-bottom: 1px solid #262626;
          flex-shrink: 0;
        }
        .chat-dd-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #FF3366;
          flex-shrink: 0;
          animation: chatDdPulse 2.2s ease-in-out infinite;
        }
        .chat-dd-title {
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #737373;
          white-space: nowrap;
        }
        .chat-dd-pill {
          margin-left: auto;
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 2px 7px;
          border-radius: 5px;
          color: rgba(255,51,102,0.85);
          background: rgba(255,51,102,0.08);
          border: 1px solid rgba(255,51,102,0.22);
          max-width: 118px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
          background: rgba(255,255,255,0.05);
        }
        .chat-model-option-active {
          background: rgba(255,255,255,0.06) !important;
          box-shadow: inset 2px 0 0 #FF3366;
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

        /* ── Focus mode dropdown ──
           (container styling lives in the shared v5.30 terminal-card block) */
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
          background: rgba(255,255,255,0.05);
        }
        .chat-focus-option-active {
          background: rgba(255,255,255,0.06) !important;
          box-shadow: inset 2px 0 0 #FF3366;
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

        /* ── Pro mode dropdown ──
           (container styling lives in the shared v5.30 terminal-card block) */
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
          background: rgba(255,255,255,0.05);
        }
        .chat-pro-option-active {
          background: rgba(255,255,255,0.06) !important;
          box-shadow: inset 2px 0 0 #FF3366;
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
            animation: chatDdUpR 240ms cubic-bezier(0.22,1,0.36,1);
          }
          .chat-model-dropdown {
            animation: chatDdUpR 240ms cubic-bezier(0.22,1,0.36,1);
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

        /* ── AI Thinking Indicator — Compact Claude/Replit-style (chat page only) ──
           Restored from commits affa609 (2026-05-19) + 6e8e42d (refinement).
           This is the original chat-page-only thinking animation. Other pages
           (DevTools / Study / ReelPen / Explore) still use components/ThinkingState.jsx. */
        .ai-thinking-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
        }
        .ai-thinking-orb {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #525252;
          animation: aiOrbSpin 3s linear infinite;
        }
        @keyframes aiOrbSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .ai-orb-node {
          animation: aiOrbGlow 1.2s ease-in-out infinite;
        }
        .ai-orb-top { animation-delay: 0s; }
        .ai-orb-left { animation-delay: 0.15s; }
        .ai-orb-right { animation-delay: 0.3s; }
        @keyframes aiOrbGlow {
          0%, 100% { stroke: #525252; }
          50% { stroke: #dc2626; }
        }
        .ai-orb-line {
          animation: aiLinePulse 1.2s ease-in-out infinite;
        }
        .ai-orb-line:nth-child(4) { animation-delay: 0.1s; }
        .ai-orb-line:nth-child(5) { animation-delay: 0.2s; }
        .ai-orb-line:nth-child(6) { animation-delay: 0.3s; }
        @keyframes aiLinePulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.7; }
        }
        .ai-thinking-label {
          font-size: 11px;
          font-weight: 500;
          color: #525252;
          letter-spacing: 0.01em;
        }
        .ai-thinking-activity {
          font-size: 11px;
          font-style: italic;
          color: #404040;
          letter-spacing: 0.02em;
          animation: aiActivityCycle 4s ease-in-out infinite;
        }
        @keyframes aiActivityCycle {
          0%, 14%   { opacity: 0; }
          2%, 12%   { opacity: 1; }
          16%, 30%  { opacity: 0; }
          18%, 28%  { opacity: 1; }
          32%, 46%  { opacity: 0; }
          34%, 44%  { opacity: 1; }
          50%, 64%  { opacity: 0; }
          52%, 62%  { opacity: 1; }
          66%, 80%  { opacity: 0; }
          68%, 78%  { opacity: 1; }
          82%, 96%  { opacity: 0; }
          84%, 94%  { opacity: 1; }
        }
        .ai-thinking-activity::after {
          content: 'reasoning';
          animation: aiActivityText 8s steps(1) infinite;
        }
        @keyframes aiActivityText {
          0%    { content: 'reasoning'; }
          20%   { content: 'analyzing'; }
          40%   { content: 'processing'; }
          60%   { content: 'thinking'; }
          80%   { content: 'considering'; }
        }

        /* ── v5.11 Live Terminal ── */
        .terminal-xterm-container {
          height: 100%;
          overflow: hidden;
        }
        .terminal-xterm-container .terminal-xterm {
          height: 100%;
        }
        .terminal-xterm-container .xterm {
          height: 100%;
        }
        .terminal-xterm-container .xterm-viewport {
          background: transparent !important;
        }
        .terminal-xterm-container .xterm-viewport::-webkit-scrollbar { width: 3px; }
        .terminal-xterm-container .xterm-viewport::-webkit-scrollbar-thumb { background: #262626; border-radius: 2px; }
        .terminal-xterm-container .xterm-viewport::-webkit-scrollbar-track { background: transparent; }

      `}</style>

      {/* ── v5.11 attachment preview lightbox ── */}
      {previewImage && (
        <Lightbox src={previewImage} alt={attachedFile || 'Attachment preview'} onClose={() => setPreviewImage(null)} />
      )}

      {/* ── v5.14 long-press bubble action card ── */}
      {bubbleAction && createPortal(
        <div
          id="bubble-action-card"
          role="menu"
          className="hush-pop fixed z-[999] w-[224px] bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden"
          style={{ top: bubbleAction.top, left: bubbleAction.left }}
        >
          <div className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#525252]">
            {bubbleAction.role === 'user' ? 'Your message' : 'Assistant'}
          </div>
          <button
            onClick={bubbleCopy}
            className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-[#e2e2e2] hover:bg-white/[0.05] transition-colors text-left cursor-pointer"
          >
            {copiedIndex === bubbleAction.index
              ? <IconCheck size={15} className="text-emerald-400" />
              : <IconCopy size={15} className="text-[#737373]" />}
            {copiedIndex === bubbleAction.index ? 'Copied' : 'Copy'}
          </button>
          {bubbleAction.role === 'assistant' && !bubbleAction.isImage && (
            <button
              onClick={bubbleSpeak}
              className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-[#e2e2e2] hover:bg-white/[0.05] transition-colors text-left cursor-pointer"
            >
              <IconSpeaker size={15} className="text-[#737373]" />
              {tts.isSpeaking ? 'Stop reading' : 'Read aloud'}
            </button>
          )}
          {bubbleAction.role === 'assistant' && (
            <button
              onClick={bubbleShare}
              className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-[#e2e2e2] hover:bg-white/[0.05] transition-colors text-left cursor-pointer"
            >
              <IconLink size={15} className="text-[#737373]" />
              Copy share link
            </button>
          )}
          {bubbleAction.role === 'assistant' && (
            <>
              <div className="h-px bg-white/[0.06]" />
              <button
                onClick={() => setBubbleAction(a => ({ ...a, showExport: !a.showExport }))}
                className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-[#e2e2e2] hover:bg-white/[0.05] transition-colors text-left cursor-pointer"
              >
                <IconDownload size={15} className="text-[#737373]" />
                Export chat
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={`ml-auto text-[#525252] transition-transform ${bubbleAction.showExport ? 'rotate-180' : ''}`}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {bubbleAction.showExport && (
                <div className="grid grid-cols-5 gap-1 px-3 pb-3">
                  {['md', 'pdf', 'docx', 'html', 'txt'].map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => bubbleExport(fmt)}
                      className="py-2 rounded-lg bg-white/[0.04] hover:bg-[#FF3366]/15 hover:text-[#FF3366] border border-white/[0.05] hover:border-[#FF3366]/30 text-[10px] font-semibold uppercase text-[#999] transition-colors cursor-pointer"
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>,
        document.body
      )}

      {/* ── v5.18 session action card — long-press a conversation ──
          Same card design as the delete-confirmation card (same overlay,
          same shell, same icon circle, same button treatment): Pin /
          Rename / Share, then Delete in accent red. */}
      {sessionAction && createPortal(
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeSessionAction() }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={sessionAction.title}
            className="w-full max-w-[360px] bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-scale-in"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-[#FF3366]/12 border border-[#FF3366]/25 flex items-center justify-center shrink-0 text-[#FF3366]" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                </svg>
              </div>
              <button
                onClick={closeSessionAction}
                className="text-[#525252] hover:text-white transition-colors p-1 -m-1"
                aria-label="Close"
                tabIndex={-1}
              >
                <IconClose size={16} />
              </button>
            </div>

            {sessionRenameMode ? (
              <>
                <h3 className="text-body text-white font-semibold leading-snug mb-1.5">{t('chat.session.rename_title') || 'Rename conversation'}</h3>
                <p className="text-caption text-muted leading-relaxed mb-4">{sessionAction.title}</p>
                <input
                  autoFocus
                  type="text"
                  value={sessionRenameValue}
                  onChange={e => setSessionRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitSessionRename() } }}
                  maxLength={120}
                  placeholder={t('chat.session.name_placeholder') || 'Conversation name'}
                  className="w-full h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-body text-white placeholder-[#525252] outline-none focus:border-[#404040] transition-colors mb-4"
                />
                <div className="flex gap-2.5">
                  <button
                    onClick={closeSessionAction}
                    className="flex-1 h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-caption text-white font-medium hover:border-[#404040] transition-colors"
                  >
                    {t('common.cancel') || 'Cancel'}
                  </button>
                  <button
                    onClick={commitSessionRename}
                    disabled={!sessionRenameValue.trim()}
                    className="flex-1 h-10 rounded-xl bg-[#FF3366] text-caption text-white font-semibold hover:bg-[#e62e5c] transition-colors disabled:opacity-60"
                  >
                    {t('chat.session.rename_save') || 'Save'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-body text-white font-semibold leading-snug mb-1.5 truncate" title={sessionAction.title}>{sessionAction.title}</h3>
                <p className="text-caption text-muted leading-relaxed mb-4">{t('chat.session.subtitle') || 'What would you like to do with this conversation?'}</p>
                <div className="space-y-2">
                  <button
                    onClick={toggleSessionPin}
                    className="w-full h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-caption text-white font-medium hover:border-[#404040] transition-colors flex items-center gap-2.5 px-3 text-left"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#737373] shrink-0" aria-hidden="true">
                      <path d="M12 17v5" />
                      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z" />
                    </svg>
                    {sessionAction.pinned ? (t('chat.session.unpin') || 'Unpin') : (t('chat.session.pin') || 'Pin')}
                  </button>
                  <button
                    onClick={() => setSessionRenameMode(true)}
                    className="w-full h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-caption text-white font-medium hover:border-[#404040] transition-colors flex items-center gap-2.5 px-3 text-left"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#737373] shrink-0" aria-hidden="true">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                    {t('chat.session.rename') || 'Rename'}
                  </button>
                  <button
                    onClick={shareSession}
                    className="w-full h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-caption text-white font-medium hover:border-[#404040] transition-colors flex items-center gap-2.5 px-3 text-left"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#737373] shrink-0" aria-hidden="true">
                      <path d="M12 2v13" />
                      <path d="m16 6-4-4-4 4" />
                      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                    </svg>
                    {t('chat.session.share') || 'Share'}
                  </button>
                  <button
                    onClick={() => { const sid = sessionAction.sid; closeSessionAction(); deleteSession(sid) }}
                    className="w-full h-10 rounded-xl bg-[#FF3366] text-caption text-white font-semibold hover:bg-[#e62e5c] transition-colors flex items-center gap-2.5 px-3 text-left"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                    {t('chat.session.delete') || 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* v5.17 — delete confirmation card */}
      <ConfirmDialog
        open={!!pendingDelete}
        title={t('chat.history.delete_confirm') || t('common.delete_confirm_title')}
        message={t('common.delete_confirm_body')}
        confirmLabel={t('common.delete_confirm_action')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => { const p = pendingDelete; setPendingDelete(null); if (p?.sid) performDeleteSession(p.sid) }}
        onCancel={() => setPendingDelete(null)}
      />

      {/* v5.27 — agent workspace panel (persistent AI file system) */}
      <WorkspacePanel
        open={wsOpen}
        onClose={() => setWsOpen(false)}
        t={t}
        getToken={async () => user ? (await supabasePublic?.auth?.getSession())?.data?.session?.access_token || '' : ''}
      />
    </main>
  )
}
