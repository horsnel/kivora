'use client'
import { useState, useEffect, useRef } from 'react'
import { IconCopy, IconCheck, IconSpinner } from '@/components/Icons'
import { useSessionTracker } from '@/lib/useSessionTracker'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import Select from '@/components/Select'
import { useTranslation } from '@/components/LanguageProvider'
import { stripMarkdown } from '@/lib/stripMarkdown'

/* ─── Icon Components ─────────────────────────────────────────── */

function IconLyrics({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 2h5a2 2 0 012 2v1M3 2a1 1 0 00-1 1v10l3-2 3 2V5M3 2a1 1 0 011-1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 6h3a1 1 0 011 1v8l-2.5-1.5L9 15V7a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconChord({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M1 6h14M1 10h14M5 2v12M9 2v12" stroke="currentColor" strokeWidth="1"/>
      <circle cx="7" cy="8" r="1.5" fill="currentColor" opacity="0.5"/>
      <circle cx="11" cy="4" r="1.5" fill="currentColor" opacity="0.5"/>
    </svg>
  )
}

function IconArtist({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M12 2l1.5 1.5L12 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconEPK({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 2h12a1 1 0 011 1v10a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.25"/>
      <rect x="4" y="4" width="8" height="3" rx="0.5" stroke="currentColor" strokeWidth="0.75"/>
      <path d="M4 9h3M4 11h5M9 9h3" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round"/>
    </svg>
  )
}

function IconPress({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 3h12v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M2 3l6 4 6-4" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
    </svg>
  )
}

function IconMarketing({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 14V7M7 14V4M11 14V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function IconSocial({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="4" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="12" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="12" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M6.3 7l3.4-1.5M6.3 9l3.4 1.5" stroke="currentColor" strokeWidth="1"/>
    </svg>
  )
}

function IconBeat({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 8h3l2-4 3 8 2-4h2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconScript({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M10 2v4h3" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M5 7h4M5 9h6M5 11h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

function IconCharacter({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M8 5v0" strokeWidth="0"/>
    </svg>
  )
}

function IconPlot({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="3" cy="13" r="1.5" stroke="currentColor" strokeWidth="1"/>
      <circle cx="8" cy="4" r="1.5" stroke="currentColor" strokeWidth="1"/>
      <circle cx="13" cy="13" r="1.5" stroke="currentColor" strokeWidth="1"/>
      <path d="M4.2 12L6.8 5.5M9.2 5.5L11.8 12" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

function IconPitch({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 4h12v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M2 4h12" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 2v4M8 1v5M10 2v4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <circle cx="8" cy="9" r="1" fill="currentColor"/>
    </svg>
  )
}

function IconSynopsis({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M5 5h6M5 8h4M5 11h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

function IconDialogue({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 3h9a1 1 0 011 1v4a1 1 0 01-1 1H5l-2 2V9H2a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M6 10h6a1 1 0 011 1v3l-1.5-1.5H8a1 1 0 01-1-1" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
    </svg>
  )
}

function IconReview({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2l2 4 4.5.7-3.3 3.1.8 4.5L8 12.2 3.9 14.3l.8-4.5L1.5 6.7 6 6z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
    </svg>
  )
}

function IconCasting({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M1 5l2-2M1 5l2 2M15 5l-2-2M15 5l-2 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconContract({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M10 2v4h3" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M5 9h3M5 11h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <circle cx="11" cy="10" r="2.5" stroke="currentColor" strokeWidth="1"/>
      <path d="M13 12l1.5 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

function IconRoyalty({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="13" cy="12" r="2" stroke="currentColor" strokeWidth="1"/>
      <path d="M12 11l1 1 1.5-1.5" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconBudget({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M2 7h12" stroke="currentColor" strokeWidth="1"/>
      <path d="M6 3v10" stroke="currentColor" strokeWidth="1"/>
    </svg>
  )
}

function IconDistribution({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M8 2v6l4 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconMerch({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 2l-2 3v8a1 1 0 001 1h10a1 1 0 001-1V5l-2-3H4z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M2 5h12" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M6 5c0 1.1.9 2 2 2s2-.9 2-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

function IconBPM({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="10" r="4" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M8 8v2l1.5 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 4h2M13 6h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

/* ─── Categories & Tools ───────────────────────────────────────── */

const CATEGORIES = [
  {
    id: 'music',
    labelKey: 'reelpen.cat.music',
    color: '#a855f7',
    tools: [
      { id: 'lyrics_writer', labelKey: 'reelpen.lyrics_writer', Icon: IconLyrics, descKey: 'reelpen.lyrics_writer.desc' },
      { id: 'chord_progression', labelKey: 'reelpen.chord_progression', Icon: IconChord, descKey: 'reelpen.chord_progression.desc' },
      { id: 'artist_bio', labelKey: 'reelpen.artist_bio', Icon: IconArtist, descKey: 'reelpen.artist_bio.desc' },
      { id: 'epk_builder', labelKey: 'reelpen.epk_builder', Icon: IconEPK, descKey: 'reelpen.epk_builder.desc' },
      { id: 'press_release', labelKey: 'reelpen.press_release', Icon: IconPress, descKey: 'reelpen.press_release.desc' },
      { id: 'marketing_plan', labelKey: 'reelpen.marketing_plan', Icon: IconMarketing, descKey: 'reelpen.marketing_plan.desc' },
      { id: 'social_kit', labelKey: 'reelpen.social_kit', Icon: IconSocial, descKey: 'reelpen.social_kit.desc' },
      { id: 'beat_description', labelKey: 'reelpen.beat_description', Icon: IconBeat, descKey: 'reelpen.beat_description.desc' },
    ]
  },
  {
    id: 'film',
    labelKey: 'reelpen.cat.film',
    color: '#f59e0b',
    tools: [
      { id: 'script_writer', labelKey: 'reelpen.script_writer', Icon: IconScript, descKey: 'reelpen.script_writer.desc' },
      { id: 'character_builder', labelKey: 'reelpen.character_builder', Icon: IconCharacter, descKey: 'reelpen.character_builder.desc' },
      { id: 'plot_outline', labelKey: 'reelpen.plot_outline', Icon: IconPlot, descKey: 'reelpen.plot_outline.desc' },
      { id: 'pitch_deck', labelKey: 'reelpen.pitch_deck', Icon: IconPitch, descKey: 'reelpen.pitch_deck.desc' },
      { id: 'synopsis_writer', labelKey: 'reelpen.synopsis_writer', Icon: IconSynopsis, descKey: 'reelpen.synopsis_writer.desc' },
      { id: 'dialogue_polisher', labelKey: 'reelpen.dialogue_polisher', Icon: IconDialogue, descKey: 'reelpen.dialogue_polisher.desc' },
      { id: 'review_responder', labelKey: 'reelpen.review_responder', Icon: IconReview, descKey: 'reelpen.review_responder.desc' },
      { id: 'casting_brief', labelKey: 'reelpen.casting_brief', Icon: IconCasting, descKey: 'reelpen.casting_brief.desc' },
    ]
  },
  {
    id: 'business',
    labelKey: 'reelpen.cat.business',
    color: '#3b82f6',
    tools: [
      { id: 'contract_reviewer', labelKey: 'reelpen.contract_reviewer', Icon: IconContract, descKey: 'reelpen.contract_reviewer.desc' },
      { id: 'royalty_estimator', labelKey: 'reelpen.royalty_estimator', Icon: IconRoyalty, descKey: 'reelpen.royalty_estimator.desc' },
      { id: 'budget_planner', labelKey: 'reelpen.budget_planner', Icon: IconBudget, descKey: 'reelpen.budget_planner.desc' },
      { id: 'distribution_strategy', labelKey: 'reelpen.distribution_strategy', Icon: IconDistribution, descKey: 'reelpen.distribution_strategy.desc' },
      { id: 'merch_ideas', labelKey: 'reelpen.merch_ideas', Icon: IconMerch, descKey: 'reelpen.merch_ideas.desc' },
    ]
  },
  {
    id: 'tools',
    labelKey: 'reelpen.cat.tools',
    color: '#06b6d4',
    tools: [
      { id: 'bpm_tapper', labelKey: 'reelpen.bpm_tapper', Icon: IconBPM, descKey: 'reelpen.bpm_tapper.desc' },
    ]
  },
]

const ALL_TOOLS = CATEGORIES.flatMap(c => c.tools.map(tool => ({ ...tool, category: c.id })))

// Select options
const GENRES = ['Afrobeats', 'Hip Hop', 'R&B', 'Pop', 'Rock', 'Amapiano', 'Gospel', 'Jazz', 'Country', 'Electronic', 'Latin', 'Indie', 'Soul', 'Reggae', 'Highlife']
const MOODS = ['Uplifting', 'Melancholic', 'Energetic', 'Romantic', 'Aggressive', 'Chill', 'Nostalgic', 'Confident', 'Dark', 'Hopeful', 'Party', 'Reflective']
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FILM_GENRES = ['Drama', 'Comedy', 'Action', 'Thriller', 'Horror', 'Romance', 'Sci-Fi', 'Documentary', 'Animation', 'Fantasy', 'Crime', 'Musical']
const TONES = ['Professional', 'Casual', 'Hype', 'Emotional', 'Witty', 'Inspiring', 'Bold']
const RELEASE_TYPES = ['Single', 'EP', 'Album', 'Mixtape', 'Music Video', 'Film', 'Short Film', 'Series']
const PLATFORMS = ['Spotify', 'Apple Music', 'YouTube Music', 'Tidal', 'Deezer', 'Boomplay', 'Audiomack', 'SoundCloud']
const BUDGET_RANGES = ['Under $1K', '$1K-$5K', '$5K-$20K', '$20K-$50K', '$50K-$100K', '$100K+']
const DEAL_TYPES = ['Independent', 'Label Deal', 'Distribution Deal', '360 Deal', 'Co-Publishing', 'Sync License']

/* ─── Main Component ──────────────────────────────────────────── */

export default function ReelPenClient() {
  const [activeCat, setActiveCat] = useState('music')
  const [active, setActive] = useState('lyrics_writer')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [form, setForm] = useState({
    // Music tools
    genre: 'Afrobeats', mood: 'Uplifting', language: 'English',
    lyricsTheme: '',
    chordKey: 'C', chordMood: 'Uplifting', chordGenre: 'Afrobeats', chordComplexity: 'Intermediate',
    artistName: '', artistGenre: 'Afrobeats', artistAchievements: '', artistTone: 'Professional',
    epkArtistName: '', epkGenre: 'Afrobeats', epkHighlights: '', epkContact: '',
    pressType: 'Single', pressTitle: '', pressDate: '', pressDetails: '',
    marketingType: 'Single', marketingBudget: 'Under $1K', marketingAudience: '', marketingPlatforms: '',
    socialInfo: '', socialPlatform: 'Instagram', socialTone: 'Hype',
    beatBpm: '', beatKey: 'C', beatGenre: 'Afrobeats', beatMood: 'Energetic', beatVibe: '',
    // Film tools
    filmGenre: 'Drama', sceneDesc: '', filmCharacters: '',
    charName: '', charRole: 'Lead', charGenre: 'Drama', charTraits: '',
    plotGenre: 'Drama', plotPremise: '', plotLength: 'Feature Film',
    pitchTitle: '', pitchLogline: '', pitchGenre: 'Drama', pitchBudget: '$5K-$20K',
    synopsisOutline: '', synopsisGenre: 'Drama', synopsisLength: 'Short',
    dialogueRaw: '', dialogueContext: '', dialogueTone: 'Natural',
    reviewText: '', reviewRating: '', reviewTone: 'Professional',
    castingCharacter: '', castingRequirements: '', castingProject: 'Feature Film',
    // Business tools
    contractText: '', contractIndustry: 'Music',
    royaltyPlatform: 'Spotify', royaltyPlays: '', royaltyDeal: 'Independent',
    budgetType: 'Music Video', budgetScale: '$5K-$20K', budgetNotes: '',
    distType: 'Single', distMarket: 'Nigeria', distBudget: 'Under $1K',
    merchProject: '', merchGenre: 'Afrobeats', merchAudience: '',
  })

  // BPM Tapper state
  const [tapTimes, setTapTimes] = useState([])
  const [bpmResult, setBpmResult] = useState(null)

  const { startSession, endSession, markCopied } = useSessionTracker()
  const { t } = useTranslation()
  const sessionRef = useRef(null)

  useEffect(() => {
    return () => { if (sessionRef.current) endSession(sessionRef.current) }
  }, [endSession])

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    if (validationError) setValidationError('')
  }

  function validate() {
    const checks = {
      lyrics_writer: { field: form.lyricsTheme, key: 'reelpen.validation.lyrics_writer' },
      chord_progression: { skip: true },
      artist_bio: { field: form.artistName, key: 'reelpen.validation.artist_bio' },
      epk_builder: { field: form.epkArtistName, key: 'reelpen.validation.epk_builder' },
      press_release: { field: form.pressTitle, key: 'reelpen.validation.press_release' },
      marketing_plan: { field: form.marketingAudience, key: 'reelpen.validation.marketing_plan' },
      social_kit: { field: form.socialInfo, key: 'reelpen.validation.social_kit' },
      beat_description: { field: form.beatVibe, key: 'reelpen.validation.beat_description' },
      script_writer: { field: form.sceneDesc, key: 'reelpen.validation.script_writer' },
      character_builder: { field: form.charName, key: 'reelpen.validation.character_builder' },
      plot_outline: { field: form.plotPremise, key: 'reelpen.validation.plot_outline' },
      pitch_deck: { field: form.pitchLogline, key: 'reelpen.validation.pitch_deck' },
      synopsis_writer: { field: form.synopsisOutline, key: 'reelpen.validation.synopsis_writer' },
      dialogue_polisher: { field: form.dialogueRaw, key: 'reelpen.validation.dialogue_polisher' },
      review_responder: { field: form.reviewText, key: 'reelpen.validation.review_responder' },
      casting_brief: { field: form.castingCharacter, key: 'reelpen.validation.casting_brief' },
      contract_reviewer: { field: form.contractText, key: 'reelpen.validation.contract_reviewer' },
      royalty_estimator: { field: form.royaltyPlays, key: 'reelpen.validation.royalty_estimator' },
      budget_planner: { field: form.budgetNotes, key: 'reelpen.validation.budget_planner' },
      distribution_strategy: { field: form.distMarket, key: 'reelpen.validation.distribution_strategy' },
      merch_ideas: { field: form.merchProject, key: 'reelpen.validation.merch_ideas' },
      bpm_tapper: { skip: true },
    }
    const check = checks[active]
    if (check?.skip) { setValidationError(''); return true }
    if (check && !check.field?.trim()) {
      setValidationError(t(check.key))
      return false
    }
    setValidationError('')
    return true
  }

  async function run() {
    if (!validate()) return
    if (sessionRef.current) { endSession(sessionRef.current); sessionRef.current = null }
    setLoading(true); setResult('')
    const inputSummary = form.lyricsTheme || form.artistName || form.epkArtistName || form.pressTitle || form.marketingAudience || form.socialInfo || form.beatVibe || form.sceneDesc || form.charName || form.plotPremise || form.pitchLogline || form.synopsisOutline || form.dialogueRaw || form.reviewText || form.castingCharacter || form.contractText || form.royaltyPlays || form.budgetNotes || form.distMarket || form.merchProject || null
    sessionRef.current = await startSession(`reelpen_${active}`, activeCat, inputSummary)
    try {
      const res = await fetch('/api/reelpen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: active, payload: form })
      })
      const data = await res.json()
      setResult(data.result || data.error || t('common.error.general'))
    } catch { setResult(t('common.error.network')) }
    setLoading(false)
  }

  function copy() {
    navigator.clipboard.writeText(stripMarkdown(result))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (sessionRef.current) markCopied(sessionRef.current)
  }

  function selectTool(toolId, catId) {
    setActive(toolId)
    setActiveCat(catId)
    setResult('')
    setValidationError('')
    if (toolId === 'bpm_tapper') { setTapTimes([]); setBpmResult(null) }
  }

  // BPM Tapper
  function handleTap() {
    const now = Date.now()
    const newTaps = [...tapTimes, now].slice(-12)
    setTapTimes(newTaps)
    if (newTaps.length >= 2) {
      const intervals = []
      for (let i = 1; i < newTaps.length; i++) intervals.push(newTaps[i] - newTaps[i - 1])
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      setBpmResult(Math.round(60000 / avg))
    }
  }

  function resetTapper() {
    setTapTimes([])
    setBpmResult(null)
  }

  const currentCat = CATEGORIES.find(c => c.id === activeCat)
  const currentTool = ALL_TOOLS.find(tool => tool.id === active)

  const inp = "w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#404040] focus:outline-none transition-colors"
  const mono = `${inp} font-mono`
  const ta = `${inp} resize-none leading-relaxed`
  const tamono = `${inp} resize-none leading-relaxed font-mono`

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-10">

        {/* Header */}
        <div className="mb-6 animate-fade-up">
          <h1 className="text-display font-semibold mb-2 tracking-tight">
            Reel<span className="text-red-500">Pen</span>
          </h1>
          <p className="text-muted text-body-sm mt-0.5">
            AI-powered tools for music and film creators
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setActiveCat(cat.id); setActive(cat.tools[0].id); setResult(''); setValidationError('') }}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                activeCat === cat.id
                  ? 'text-[#0a0a0a] border-transparent'
                  : 'bg-[#141414] border-[#262626] text-muted hover:text-white hover:border-[#3a3a3a]'
              }`}
              style={activeCat === cat.id ? { background: cat.color, borderColor: cat.color } : {}}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>

        {/* Tool pills within active category */}
        <div className="flex flex-wrap gap-2 mb-7">
          {currentCat.tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => selectTool(tool.id, activeCat)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active === tool.id
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-[#141414] border-[#262626] text-muted hover:text-white hover:border-[#3a3a3a]'
              }`}
            >
              <tool.Icon size={12} /> {t(tool.labelKey)}
            </button>
          ))}
        </div>

        {/* Split panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Input Panel ─────────────────────────────────── */}
          <div className="bg-[#141414] rounded-xl p-7">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                <currentTool.Icon size={15} className="text-muted" />
              </div>
              <div>
                <h2 className="font-semibold text-sm tracking-tight text-muted">{t(currentTool.labelKey)}</h2>
                <p className="text-xs text-muted">{t(currentTool.descKey)}</p>
              </div>
            </div>

            <div className="space-y-3">

              {/* ─── MUSIC TOOLS ─────────────────── */}

              {active === 'lyrics_writer' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Genre</label>
                  <Select value={form.genre} onChange={v => set('genre', v)} options={GENRES.map(g => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Mood</label>
                  <Select value={form.mood} onChange={v => set('mood', v)} options={MOODS.map(m => ({ value: m, label: m }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Language</label>
                  <Select value={form.language} onChange={v => set('language', v)} options={['English','Yoruba','Igbo','Hausa','Pidgin','French','Spanish','Swahili'].map(l => ({ value: l, label: l }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Theme / Topic</label>
                  <textarea className={`${ta} h-28`} placeholder="e.g. Hustling through Lagos traffic, falling in love at a party, celebrating with friends..." value={form.lyricsTheme} onChange={e => set('lyricsTheme', e.target.value)} />
                </div>
              </>}

              {active === 'chord_progression' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Key</label>
                  <Select value={form.chordKey} onChange={v => set('chordKey', v)} options={KEYS.map(k => ({ value: k, label: k }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Mood</label>
                  <Select value={form.chordMood} onChange={v => set('chordMood', v)} options={MOODS.map(m => ({ value: m, label: m }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Genre</label>
                  <Select value={form.chordGenre} onChange={v => set('chordGenre', v)} options={GENRES.map(g => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Complexity</label>
                  <Select value={form.chordComplexity} onChange={v => set('chordComplexity', v)} options={['Beginner','Intermediate','Advanced'].map(c => ({ value: c, label: c }))} />
                </div>
              </>}

              {active === 'artist_bio' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Artist / Band Name</label>
                  <input className={inp} placeholder="e.g. Burna Boy, Tems, Asake..." value={form.artistName} onChange={e => set('artistName', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Genre</label>
                  <Select value={form.artistGenre} onChange={v => set('artistGenre', v)} options={GENRES.map(g => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Key Achievements</label>
                  <textarea className={`${ta} h-24`} placeholder="e.g. Grammy nomination, 50M+ streams, sold-out tour, major collaborations..." value={form.artistAchievements} onChange={e => set('artistAchievements', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Tone</label>
                  <Select value={form.artistTone} onChange={v => set('artistTone', v)} options={TONES.map(t => ({ value: t, label: t }))} />
                </div>
              </>}

              {active === 'epk_builder' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Artist / Band Name</label>
                  <input className={inp} placeholder="e.g. Burna Boy, Tems..." value={form.epkArtistName} onChange={e => set('epkArtistName', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Genre</label>
                  <Select value={form.epkGenre} onChange={v => set('epkGenre', v)} options={GENRES.map(g => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Highlights & Press</label>
                  <textarea className={`${ta} h-24`} placeholder="e.g. Headlined AfroNation 2025, Featured on Apple Music, 100M+ total streams..." value={form.epkHighlights} onChange={e => set('epkHighlights', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Contact / Booking Info</label>
                  <input className={inp} placeholder="e.g. management@artist.com, @artist on IG" value={form.epkContact} onChange={e => set('epkContact', e.target.value)} />
                </div>
              </>}

              {active === 'press_release' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Release Type</label>
                  <Select value={form.pressType} onChange={v => set('pressType', v)} options={RELEASE_TYPES.map(r => ({ value: r, label: r }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Title</label>
                  <input className={inp} placeholder="e.g. New Single 'Rise Up' Out Friday" value={form.pressTitle} onChange={e => set('pressTitle', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Release Date</label>
                  <input className={inp} placeholder="e.g. March 15, 2026" value={form.pressDate} onChange={e => set('pressDate', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Key Details</label>
                  <textarea className={`${ta} h-24`} placeholder="e.g. Produced by Sarz, features Wizkid, first single off upcoming EP..." value={form.pressDetails} onChange={e => set('pressDetails', e.target.value)} />
                </div>
              </>}

              {active === 'marketing_plan' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Release Type</label>
                  <Select value={form.marketingType} onChange={v => set('marketingType', v)} options={RELEASE_TYPES.map(r => ({ value: r, label: r }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Budget Range</label>
                  <Select value={form.marketingBudget} onChange={v => set('marketingBudget', v)} options={BUDGET_RANGES.map(b => ({ value: b, label: b }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Target Audience</label>
                  <textarea className={`${ta} h-24`} placeholder="e.g. Gen Z Afrobeats fans in Nigeria & UK, TikTok users, music blog readers..." value={form.marketingAudience} onChange={e => set('marketingAudience', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Platforms to Focus On</label>
                  <input className={inp} placeholder="e.g. TikTok, Instagram, Spotify, YouTube" value={form.marketingPlatforms} onChange={e => set('marketingPlatforms', e.target.value)} />
                </div>
              </>}

              {active === 'social_kit' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Release Info</label>
                  <textarea className={`${ta} h-24`} placeholder="e.g. Dropping new single 'Vibes' this Friday, produced by P2J, pre-save link available..." value={form.socialInfo} onChange={e => set('socialInfo', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Platform</label>
                  <Select value={form.socialPlatform} onChange={v => set('socialPlatform', v)} options={['Instagram','TikTok','Twitter/X','Facebook','YouTube Community','All Platforms'].map(p => ({ value: p, label: p }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Tone</label>
                  <Select value={form.socialTone} onChange={v => set('socialTone', v)} options={TONES.map(t => ({ value: t, label: t }))} />
                </div>
              </>}

              {active === 'beat_description' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">BPM</label>
                  <input className={inp} placeholder="e.g. 120" value={form.beatBpm} onChange={e => set('beatBpm', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Key</label>
                  <Select value={form.beatKey} onChange={v => set('beatKey', v)} options={KEYS.map(k => ({ value: k, label: k }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Genre</label>
                  <Select value={form.beatGenre} onChange={v => set('beatGenre', v)} options={GENRES.map(g => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Mood</label>
                  <Select value={form.beatMood} onChange={v => set('beatMood', v)} options={MOODS.map(m => ({ value: m, label: m }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Vibe / Description</label>
                  <textarea className={`${ta} h-24`} placeholder="e.g. Hard-hitting 808s with melodic synth pads, inspired by Wizkid's Made in Lagos..." value={form.beatVibe} onChange={e => set('beatVibe', e.target.value)} />
                </div>
              </>}

              {/* ─── FILM TOOLS ─────────────────── */}

              {active === 'script_writer' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Genre</label>
                  <Select value={form.filmGenre} onChange={v => set('filmGenre', v)} options={FILM_GENRES.map(g => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Scene Description</label>
                  <textarea className={`${ta} h-28`} placeholder="e.g. A detective confronts a suspect in a dimly lit bar. The suspect knows more than they're letting on..." value={form.sceneDesc} onChange={e => set('sceneDesc', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Characters Involved</label>
                  <input className={inp} placeholder="e.g. DETECTIVE KUNLE (40s, sharp), SUSPECT ADAEZE (30s, nervous)" value={form.filmCharacters} onChange={e => set('filmCharacters', e.target.value)} />
                </div>
              </>}

              {active === 'character_builder' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Character Name</label>
                  <input className={inp} placeholder="e.g. Amara Okafor" value={form.charName} onChange={e => set('charName', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Role</label>
                  <Select value={form.charRole} onChange={v => set('charRole', v)} options={['Lead','Supporting','Antagonist','Mentor','Comic Relief','Extra'].map(r => ({ value: r, label: r }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Genre</label>
                  <Select value={form.charGenre} onChange={v => set('charGenre', v)} options={FILM_GENRES.map(g => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Key Traits / Background</label>
                  <textarea className={`${ta} h-24`} placeholder="e.g. Former lawyer turned vigilante, quick-witted, struggles with trust issues, grew up in Mushin..." value={form.charTraits} onChange={e => set('charTraits', e.target.value)} />
                </div>
              </>}

              {active === 'plot_outline' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Genre</label>
                  <Select value={form.plotGenre} onChange={v => set('plotGenre', v)} options={FILM_GENRES.map(g => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Length</label>
                  <Select value={form.plotLength} onChange={v => set('plotLength', v)} options={['Short Film','Feature Film','Series Pilot','Web Series'].map(l => ({ value: l, label: l }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Premise / Idea</label>
                  <textarea className={`${ta} h-28`} placeholder="e.g. A street photographer accidentally captures evidence of a crime and must go on the run..." value={form.plotPremise} onChange={e => set('plotPremise', e.target.value)} />
                </div>
              </>}

              {active === 'pitch_deck' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Project Title</label>
                  <input className={inp} placeholder="e.g. Last Bus to Lekki" value={form.pitchTitle} onChange={e => set('pitchTitle', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Logline</label>
                  <textarea className={`${ta} h-20`} placeholder="One-sentence summary of your film/project..." value={form.pitchLogline} onChange={e => set('pitchLogline', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Genre</label>
                  <Select value={form.pitchGenre} onChange={v => set('pitchGenre', v)} options={FILM_GENRES.map(g => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Budget Range</label>
                  <Select value={form.pitchBudget} onChange={v => set('pitchBudget', v)} options={BUDGET_RANGES.map(b => ({ value: b, label: b }))} />
                </div>
              </>}

              {active === 'synopsis_writer' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Story Outline</label>
                  <textarea className={`${ta} h-32`} placeholder="Describe the key events, characters, and resolution of your story..." value={form.synopsisOutline} onChange={e => set('synopsisOutline', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Genre</label>
                  <Select value={form.synopsisGenre} onChange={v => set('synopsisGenre', v)} options={FILM_GENRES.map(g => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Length</label>
                  <Select value={form.synopsisLength} onChange={v => set('synopsisLength', v)} options={['Short (1 paragraph)','Medium (2-3 paragraphs)','Long (full page)'].map(l => ({ value: l, label: l }))} />
                </div>
              </>}

              {active === 'dialogue_polisher' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Raw Dialogue</label>
                  <textarea className={`${tamono} h-36`} placeholder="Paste your rough dialogue here..." value={form.dialogueRaw} onChange={e => set('dialogueRaw', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Character Context</label>
                  <input className={inp} placeholder="e.g. Two old friends meeting after 10 years, tense reunion" value={form.dialogueContext} onChange={e => set('dialogueContext', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Desired Tone</label>
                  <Select value={form.dialogueTone} onChange={v => set('dialogueTone', v)} options={['Natural','Dramatic','Comedic','Formal','Street / Slang','Poetic'].map(t => ({ value: t, label: t }))} />
                </div>
              </>}

              {active === 'review_responder' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Review Text</label>
                  <textarea className={`${ta} h-28`} placeholder="Paste the review you want to respond to..." value={form.reviewText} onChange={e => set('reviewText', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Rating (if any)</label>
                  <input className={inp} placeholder="e.g. 2/5 stars, 6/10" value={form.reviewRating} onChange={e => set('reviewRating', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Response Tone</label>
                  <Select value={form.reviewTone} onChange={v => set('reviewTone', v)} options={['Professional','Gracious','Humorous','Firm / Defending','Appreciative'].map(t => ({ value: t, label: t }))} />
                </div>
              </>}

              {active === 'casting_brief' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Character Description</label>
                  <textarea className={`${ta} h-28`} placeholder="e.g. AALIYAH — Female, 25-30, confident, bilingual (English/Yoruba), must be comfortable with action sequences..." value={form.castingCharacter} onChange={e => set('castingCharacter', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Requirements</label>
                  <input className={inp} placeholder="e.g. Dance skills, driver's license, shaved head optional" value={form.castingRequirements} onChange={e => set('castingRequirements', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Project Type</label>
                  <Select value={form.castingProject} onChange={v => set('castingProject', v)} options={['Feature Film','Short Film','Series','Commercial','Music Video','Stage Play'].map(p => ({ value: p, label: p }))} />
                </div>
              </>}

              {/* ─── BUSINESS TOOLS ─────────────────── */}

              {active === 'contract_reviewer' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Industry</label>
                  <Select value={form.contractIndustry} onChange={v => set('contractIndustry', v)} options={['Music','Film','TV','Publishing','Management','Licensing'].map(i => ({ value: i, label: i }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Contract Text</label>
                  <textarea className={`${tamono} h-52`} placeholder="Paste the contract or specific clause you want reviewed..." value={form.contractText} onChange={e => set('contractText', e.target.value)} />
                </div>
              </>}

              {active === 'royalty_estimator' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Platform</label>
                  <Select value={form.royaltyPlatform} onChange={v => set('royaltyPlatform', v)} options={PLATFORMS.map(p => ({ value: p, label: p }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Number of Plays / Streams</label>
                  <input className={inp} placeholder="e.g. 1000000" value={form.royaltyPlays} onChange={e => set('royaltyPlays', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Deal Type</label>
                  <Select value={form.royaltyDeal} onChange={v => set('royaltyDeal', v)} options={DEAL_TYPES.map(d => ({ value: d, label: d }))} />
                </div>
              </>}

              {active === 'budget_planner' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Project Type</label>
                  <Select value={form.budgetType} onChange={v => set('budgetType', v)} options={['Music Video','Single Release','EP Release','Album Release','Short Film','Feature Film','Tour','Festival Set'].map(t => ({ value: t, label: t }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Scale</label>
                  <Select value={form.budgetScale} onChange={v => set('budgetScale', v)} options={BUDGET_RANGES.map(b => ({ value: b, label: b }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Notes / Requirements</label>
                  <textarea className={`${ta} h-24`} placeholder="e.g. Need studio time, 2 camera crew, location in Lagos, post-production with color grading..." value={form.budgetNotes} onChange={e => set('budgetNotes', e.target.value)} />
                </div>
              </>}

              {active === 'distribution_strategy' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Project Type</label>
                  <Select value={form.distType} onChange={v => set('distType', v)} options={RELEASE_TYPES.map(r => ({ value: r, label: r }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Target Market</label>
                  <input className={inp} placeholder="e.g. Nigeria, UK, Global Afrobeats audience" value={form.distMarket} onChange={e => set('distMarket', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Budget</label>
                  <Select value={form.distBudget} onChange={v => set('distBudget', v)} options={BUDGET_RANGES.map(b => ({ value: b, label: b }))} />
                </div>
              </>}

              {active === 'merch_ideas' && <>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Artist / Project Name</label>
                  <input className={inp} placeholder="e.g. Burna Boy, 'Last Last' era" value={form.merchProject} onChange={e => set('merchProject', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Genre / Vibe</label>
                  <Select value={form.merchGenre} onChange={v => set('merchGenre', v)} options={GENRES.map(g => ({ value: g, label: g }))} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5">Target Audience</label>
                  <textarea className={`${ta} h-20`} placeholder="e.g. Gen Z fans, streetwear lovers, concert-goers..." value={form.merchAudience} onChange={e => set('merchAudience', e.target.value)} />
                </div>
              </>}

              {/* ─── CLIENT-SIDE TOOLS ─────────────────── */}

              {active === 'bpm_tapper' && (
                <div className="flex flex-col items-center py-6">
                  <p className="text-xs text-muted mb-4 text-center">Tap the button in rhythm to detect the BPM. At least 5 taps for accuracy.</p>
                  <button
                    onClick={handleTap}
                    className="w-28 h-28 rounded-full bg-[#1a1a1a] border-2 border-[#262626] hover:border-red-500 text-white text-lg font-bold transition-all active:scale-95 press"
                  >
                    TAP
                  </button>
                  {bpmResult && (
                    <div className="mt-5 text-center">
                      <p className="text-3xl font-bold text-white">{bpmResult}</p>
                      <p className="text-xs text-muted mt-1">BPM</p>
                    </div>
                  )}
                  {tapTimes.length > 0 && (
                    <button onClick={resetTapper} className="mt-4 text-xs text-muted hover:text-white transition-colors">
                      Reset
                    </button>
                  )}
                </div>
              )}
            </div>

            {validationError && <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400 mt-3">{validationError}</div>}

            {active !== 'bpm_tapper' && (
              <button onClick={run} disabled={loading}
                className="mt-5 w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press">
                {loading ? <><IconSpinner size={14} /> {t('common.loading')}</> : `Generate ${t(currentTool.labelKey)}`}
              </button>
            )}
          </div>

          {/* ── Output Panel ─────────────────────────────────── */}
          <div className="bg-[#141414] rounded-xl p-6 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="font-semibold text-sm tracking-tight text-muted">
                {active === 'bpm_tapper' ? 'BPM Detector' : t('reelpen.output')}
              </h2>
              {result && active !== 'bpm_tapper' && (
                <button onClick={copy} className="flex items-center gap-1 text-xs text-muted hover:text-white transition-colors">
                  {copied ? <><IconCheck size={11} className="text-emerald-400" /> {t('common.copied')}</> : <><IconCopy size={11} /> {t('common.copy')}</>}
                </button>
              )}
            </div>

            {active === 'bpm_tapper' ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center mb-3">
                  <IconBPM size={18} className="text-[#2e2e2e]" />
                </div>
                {bpmResult ? (
                  <>
                    <p className="text-5xl font-bold text-white">{bpmResult}</p>
                    <p className="text-sm text-muted mt-2">Beats Per Minute</p>
                    <p className="text-xs text-[#525252] mt-1">{tapTimes.length} taps recorded</p>
                    <div className="mt-4 bg-[#1a1a1a] rounded-xl p-4 w-full max-w-xs">
                      <p className="text-xs text-muted mb-2">Common genres at this BPM:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {bpmResult >= 60 && bpmResult <= 80 && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#262626] text-[#a3a3a3]">R&B</span>}
                        {bpmResult >= 70 && bpmResult <= 90 && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#262626] text-[#a3a3a3]">Reggae</span>}
                        {bpmResult >= 80 && bpmResult <= 100 && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#262626] text-[#a3a3a3]">Hip Hop</span>}
                        {bpmResult >= 95 && bpmResult <= 115 && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#262626] text-[#a3a3a3]">Afrobeats</span>}
                        {bpmResult >= 110 && bpmResult <= 130 && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#262626] text-[#a3a3a3]">Amapiano</span>}
                        {bpmResult >= 115 && bpmResult <= 135 && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#262626] text-[#a3a3a3]">Pop</span>}
                        {bpmResult >= 120 && bpmResult <= 140 && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#262626] text-[#a3a3a3]">House</span>}
                        {bpmResult >= 140 && bpmResult <= 160 && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#262626] text-[#a3a3a3]">Electronic</span>}
                        {bpmResult >= 160 && bpmResult <= 180 && <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#262626] text-[#a3a3a3]">Drum & Bass</span>}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted2 text-sm text-center">Start tapping to detect the tempo</p>
                )}
              </div>
            ) : result ? (
              <MarkdownRenderer content={result} className="flex-1 overflow-auto overscroll-behavior-contain" />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-3">
                    <currentTool.Icon size={18} className="text-[#2e2e2e]" />
                  </div>
                  <p className="text-muted2 text-sm">{loading ? t('common.loading') : t('reelpen.empty_hint')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
