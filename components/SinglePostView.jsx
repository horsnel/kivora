'use client'
// v5.22 — single community post view for /community/post/[id].
// Fetches the same payload the feed uses (GET /api/forum?id=…) and renders
// the post with the feed's visual language: verified badge, markdown body
// with runnable code blocks, attachment grid, replies with counts.
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import remarkGfm from 'remark-gfm'
import { useTranslation } from '@/components/LanguageProvider'
import { MarkdownCodeBlock } from '@/components/MarkdownRenderer'
import { IconChat, IconSpinner, IconUser, IconShare, IconCheck } from '@/components/Icons'
import BackButton from '@/components/BackButton'

const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })

function extractCodeText(node) {
  if (!node) return ''
  if (node.type === 'text') return node.value || ''
  if (node.children) return node.children.map(extractCodeText).join('')
  return ''
}

function VerifiedBadge({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-label="Verified">
      <path fill="#dc2626" d="M12 1.5l2.6 2 3.3-.3 1 3.1 2.8 1.8-1.2 3.1 1.2 3.1-2.8 1.8-1 3.1-3.3-.3-2.6 2-2.6-2-3.3.3-1-3.1L2.3 14l1.2-3.1-1.2-3.1 2.8-1.8 1-3.1 3.3.3z" />
      <path d="M8.2 12.3l2.6 2.6 5-5.4" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatTime(ts) {
  try {
    const d = new Date(ts)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '' }
}

export default function SinglePostView({ postId }) {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/forum?id=${encodeURIComponent(postId)}`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        if (d?.error) setError(d.error)
        else setData(d)
      })
      .catch(() => alive && setError('Failed to load post'))
    return () => { alive = false }
  }, [postId])

  async function share() {
    const url = `${window.location.origin}/community/post/${postId}`
    try {
      if (navigator.share) await navigator.share({ url, title: data?.post?.title || 'Kivora community post' })
      else await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const mdComponents = {
    code: ({ className: cls, children, node }) => {
      const parentIsPre = node?.parent?.tagName === 'pre'
      if (parentIsPre) return <>{children}</>
      return <code className="font-mono text-[0.9em] bg-white/[0.08] px-1.5 py-0.5 rounded">{children}</code>
    },
    pre: ({ children, node }) => {
      const codeNode = node?.children?.[0]
      const codeClassName = codeNode?.properties?.className?.[0] || ''
      const match = codeClassName.match(/language-(\w+)/)
      const langLabel = match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : 'Code'
      return (
        <MarkdownCodeBlock
          langLabel={langLabel}
          codeText={extractCodeText(codeNode)}
        />
      )
    },
  }

  const post = data?.post
  const replies = data?.replies || []
  const images = (Array.isArray(post?.attachments) ? post.attachments : []).filter(a => a.kind === 'image')
  const files = (Array.isArray(post?.attachments) ? post.attachments : []).filter(a => a.kind !== 'image')

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <BackButton
          href="/community"
          label={t('community.back') || 'Back to community'}
          glyph={18}
          className="text-sm text-[#737373] hover:text-white gap-2 mb-6"
        >
          {t('community.back') || 'Back to community'}
        </BackButton>

        {error && (
          <div className="bg-[#141414] border border-white/[0.06] rounded-xl px-5 py-8 text-center">
            <p className="text-sm text-muted">{error}</p>
            <Link href="/community" className="text-xs text-red-400 hover:text-red-300 mt-3 inline-block">{t('community.back') || 'Back to community'}</Link>
          </div>
        )}

        {!error && !data && (
          <div className="flex items-center justify-center py-20">
            <IconSpinner size={22} className="animate-spin text-[#525252]" />
          </div>
        )}

        {post && (
          <>
            <article className="bg-[#141414] border border-white/[0.06] rounded-2xl px-5 sm:px-6 py-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#dc2626]/15 border border-[#dc2626]/30 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-red-400">{(post.author_name || 'A').slice(0, 1).toUpperCase()}</span>
                </div>
                <span className="text-sm font-semibold text-white">{post.author_name || 'Anonymous'}</span>
                {post.author_verified && <VerifiedBadge />}
                <span className="text-xs text-[#525252]">· {formatTime(post.created_at)}</span>
                <button
                  onClick={share}
                  className="ml-auto flex items-center gap-1.5 text-xs text-[#737373] hover:text-white bg-[#0a0a0a] border border-[#262626] hover:border-[#3a3a3a] px-3 py-1.5 rounded-lg transition-colors"
                  aria-label="Share this post"
                >
                  {copied ? <IconCheck size={13} className="text-emerald-400" /> : <IconShare size={13} />}
                  {copied ? (t('common.copied') || 'Copied') : (t('common.share') || 'Share')}
                </button>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-4">{post.title}</h1>

              <div className="community-md text-sm text-[#d4d4d4] leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {post.body || ''}
                </ReactMarkdown>
              </div>

              {images.length > 0 && (
                <div className={`grid gap-2 mt-4 ${images.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-2 sm:grid-cols-3'}`}>
                  {images.map((a, i) => (
                    <a key={`${a.url}-${i}`} href={a.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-[#262626] bg-[#0a0a0a]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt={a.name || 'attachment'} className="w-full max-h-72 object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              {files.length > 0 && (
                <div className="space-y-1.5 mt-4">
                  {files.map((a, i) => (
                    <a key={`${a.url}-${i}`} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 bg-[#0a0a0a] border border-[#262626] hover:border-[#3a3a3a] rounded-xl px-3 py-2.5 transition-colors">
                      <span className="text-caption text-[#d4d4d4] truncate flex-1">{a.name || 'file'}</span>
                    </a>
                  ))}
                </div>
              )}
            </article>

            <section className="mt-6">
              <div className="flex items-center gap-2 text-xs text-muted mb-3">
                <IconChat size={13} />
                {replies.length} {replies.length === 1 ? (t('community.reply') || 'reply') : (t('community.replies') || 'replies')}
              </div>
              <div className="space-y-2.5">
                {replies.map(reply => (
                  <div key={reply.id} className="bg-[#141414] border border-white/[0.06] rounded-xl px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-[#dc2626]/15 border border-[#dc2626]/30 flex items-center justify-center shrink-0">
                        <IconUser size={11} className="text-red-400" />
                      </div>
                      <span className="text-[13px] font-medium text-white">{reply.author_name || 'Anonymous'}</span>
                      {reply.author_verified && <VerifiedBadge size={12} />}
                      <span className="text-[10px] text-[#525252]">{formatTime(reply.created_at)}</span>
                    </div>
                    <div className="community-md text-sm text-[#d4d4d4] leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{reply.body || ''}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 bg-[#141414] border border-white/[0.06] rounded-xl px-5 py-6 text-center">
                <p className="text-xs text-muted mb-3">{t('community.join_hint') || 'Join the conversation on the community page.'}</p>
                <Link
                  href="/community"
                  className="inline-block bg-[#dc2626] hover:bg-red-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  {t('community.open') || 'Open community'}
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
