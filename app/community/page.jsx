'use client'
import { useState, useEffect, useRef } from 'react'
import { supabasePublic } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'
import { useTranslation } from '@/components/LanguageProvider'
import { IconChat, IconArrowLeft, IconPlus, IconSpinner, IconTrash, IconSend, IconUser, IconPaperclip, IconFile, IconClose, IconDownload } from '@/components/Icons'

const inputClass = "w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#404040] focus:outline-none transition-colors"

// ── Attachment constraints (mirrored in /api/forum/upload) ──────────
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.pdf,.txt,.md,.csv,.zip,.docx,.xlsx'
const MAX_ATTACHMENTS = 6

function formatSize(bytes) {
  if (!bytes) return ''
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

// Composer preview — thumbnails / file chips with remove buttons
function AttachmentPreview({ items, onRemove, onImageClick, uploading }) {
  if (!items.length && !uploading) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2.5">
      {items.map((a, i) => (
        <div key={`${a.url}-${i}`} className="relative group">
          {a.kind === 'image' ? (
            <button
              type="button"
              onClick={() => onImageClick?.(a.url)}
              className="block w-14 h-14 rounded-xl overflow-hidden border border-[#262626] hover:border-[#3a3a3a] transition-colors"
              title={a.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name || 'attachment'} className="w-full h-full object-cover" />
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#262626] rounded-xl pl-2.5 pr-7 py-2 max-w-[220px]">
              <IconFile size={14} className="text-red-400 shrink-0" />
              <span className="text-[11px] text-[#d4d4d4] truncate">{a.name}</span>
              <span className="text-[9px] text-[#525252] shrink-0">{formatSize(a.size)}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label="Remove attachment"
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#262626] hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <IconClose size={10} />
          </button>
        </div>
      ))}
      {uploading > 0 && (
        <div className="w-14 h-14 rounded-xl border border-dashed border-[#333] flex items-center justify-center">
          <IconSpinner size={16} className="text-[#525252]" />
        </div>
      )}
    </div>
  )
}

// Feed renderer — image grid + file cards for a post/reply's attachments
function AttachmentMedia({ items, onImageClick }) {
  if (!Array.isArray(items) || items.length === 0) return null
  const images = items.filter(a => a.kind === 'image')
  const files = items.filter(a => a.kind !== 'image')
  return (
    <div className="space-y-2 mb-3">
      {images.length > 0 && (
        <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {images.map((a, i) => (
            <button
              key={`${a.url}-${i}`}
              type="button"
              onClick={() => onImageClick(a.url)}
              className="relative rounded-xl overflow-hidden border border-[#262626] hover:border-[#3a3a3a] transition-colors group bg-[#0a0a0a]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.name || 'image attachment'}
                loading="lazy"
                className="w-full max-h-64 object-cover group-hover:scale-[1.02] transition-transform duration-200"
              />
            </button>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((a, i) => (
            <a
              key={`${a.url}-${i}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 bg-[#0a0a0a] border border-[#262626] hover:border-[#3a3a3a] rounded-xl px-3 py-2.5 transition-colors"
            >
              <IconFile size={16} className="text-red-400 shrink-0" />
              <span className="text-caption text-[#d4d4d4] truncate flex-1 min-w-0">{a.name}</span>
              <span className="text-[10px] text-[#525252] shrink-0">{formatSize(a.size)}</span>
              <IconDownload size={12} className="text-[#525252] shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommunityPage() {
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'detail' | 'new'
  const [selectedPost, setSelectedPost] = useState(null)
  const [replies, setReplies] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newPost, setNewPost] = useState({ title: '', body: '' })
  const [replyBody, setReplyBody] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Attachments
  const [postAtts, setPostAtts] = useState([])
  const [replyAtts, setReplyAtts] = useState([])
  const [uploading, setUploading] = useState(0)
  const postFileRef = useRef(null)
  const replyFileRef = useRef(null)

  // Lightbox
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => { loadUser(); loadPosts() }, [])

  // Esc closes the lightbox
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e) => { if (e.key === 'Escape') setLightbox(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lightbox])

  async function loadUser() {
    if (!supabasePublic) return
    const { data: { user } } = await supabasePublic.auth.getUser()
    setUser(user)
  }

  async function loadPosts() {
    try {
      const res = await fetch('/api/forum')
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts || [])
      }
    } catch {}
    setLoading(false)
  }

  async function loadPost(postId) {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/forum?id=${postId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedPost(data.post)
        setReplies(data.replies || [])
        setView('detail')
      }
    } catch {}
    setLoadingDetail(false)
  }

  // ── Upload attachments one-by-one through the verified API ──────────
  async function uploadFiles(fileList, setter) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    if (!user) { setError(t('community.signin_to_post')); return }
    let shownError = false
    for (const f of files) {
      setter(prev => (prev.length >= MAX_ATTACHMENTS ? prev : [...prev, { pending: true, name: f.name, size: f.size, kind: f.type?.startsWith('image/') ? 'image' : 'file' }]))
      setUploading(n => n + 1)
      try {
        const fd = new FormData()
        fd.append('file', f)
        const res = await authFetch('/api/forum/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) {
          shownError = true
          setError(data.error || t('community.upload_failed'))
          setter(prev => prev.filter(a => !a.pending))
        } else {
          setter(prev => {
            // replace the first pending placeholder with the real metadata
            const idx = prev.findIndex(a => a.pending)
            if (idx === -1 || prev.length >= MAX_ATTACHMENTS + 1) return prev
            const next = [...prev]
            next[idx] = data
            return next
          })
        }
      } catch {
        shownError = true
        setError(t('community.upload_failed'))
        setter(prev => prev.filter(a => !a.pending))
      }
      setUploading(n => n - 1)
    }
    if (shownError) setTimeout(() => setError(''), 4000)
  }

  async function createPost() {
    if (!user) { setError(t('community.signin_to_post')); return }
    if (!newPost.title.trim() || !newPost.body.trim()) { setError('Title and body are required'); return }
    if (postAtts.some(a => a.pending) || uploading > 0) { setError(t('community.wait_upload')); return }
    setSubmitting(true); setError(''); setNotice('')
    try {
      const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Anonymous'
      const res = await authFetch('/api/forum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'post',
          user_id: user.id,
          author_name: displayName,
          title: newPost.title,
          body: newPost.body,
          attachments: postAtts,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create post'); return }
      if (data.warning === 'attachments_rolled_back') setNotice(t('community.attachments_rolled_back'))
      setNewPost({ title: '', body: '' })
      setPostAtts([])
      setView('list')
      await loadPosts()
    } catch {
      setError('Failed to create post')
    }
    setSubmitting(false)
  }

  async function createReply() {
    if (!user || !selectedPost) return
    if (!replyBody.trim()) return
    if (replyAtts.some(a => a.pending) || uploading > 0) { setError(t('community.wait_upload')); return }
    setSubmitting(true); setError(''); setNotice('')
    try {
      const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Anonymous'
      const res = await authFetch('/api/forum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reply',
          user_id: user.id,
          author_name: displayName,
          post_id: selectedPost.id,
          body: replyBody,
          attachments: replyAtts,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to post reply'); return }
      if (data.warning === 'attachments_rolled_back') setNotice(t('community.attachments_rolled_back'))
      setReplyBody('')
      setReplyAtts([])
      await loadPost(selectedPost.id)
    } catch {
      setError('Failed to post reply')
    }
    setSubmitting(false)
  }

  async function deletePost(postId) {
    if (!user) return
    try {
      await authFetch('/api/forum', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'post', id: postId, user_id: user.id }),
      })
      setView('list')
      setSelectedPost(null)
      await loadPosts()
    } catch {}
  }

  async function deleteReply(replyId) {
    if (!user || !selectedPost) return
    try {
      await authFetch('/api/forum', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'reply', id: replyId, user_id: user.id }),
      })
      await loadPost(selectedPost.id)
    } catch {}
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d ago`
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

  // ─── List view ──────────────────────────────────────────
  if (view === 'list') return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-up">
          <div>
            <h1 className="text-display font-semibold mb-2 tracking-tight">{t('community.title')}</h1>
            <p className="text-muted text-body">{t('community.subtitle')}</p>
          </div>
          {user && (
            <button
              onClick={() => { setView('new'); setError('') }}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors press"
            >
              <IconPlus size={14} /> {t('community.new_post')}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400 animate-slide-down">
            {error}
          </div>
        )}

        {/* Posts list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton border border-[#262626] rounded-xl p-5 h-24" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 bg-[#141414] rounded-xl flex items-center justify-center mx-auto mb-4">
              <IconChat size={20} className="text-[#2e2e2e]" />
            </div>
            <h3 className="font-semibold text-headline mb-2 tracking-tight text-muted">{t('community.empty')}</h3>
            <p className="text-muted text-body mb-6">{t('community.empty_desc')}</p>
            {user && (
              <button
                onClick={() => { setView('new'); setError('') }}
                className="text-red-500 hover:text-red-400 text-body flex items-center gap-1 mx-auto"
              >
                <IconPlus size={14} /> {t('community.create_post')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {posts.map(post => (
              <button
                key={post.id}
                onClick={() => loadPost(post.id)}
                className="w-full text-left bg-[#141414] border border-white/[0.06] rounded-xl px-5 py-4 hover:border-white/[0.1] transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-body-sm text-muted font-medium leading-snug mb-1.5 line-clamp-1">
                      {post.title}
                    </h3>
                    <p className="text-caption text-muted line-clamp-2 leading-relaxed mb-2">
                      {post.body}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-[#525252]">
                      <span className="flex items-center gap-1">
                        <IconUser size={10} /> {post.author_name || 'Anonymous'}
                      </span>
                      <span>{formatTime(post.created_at)}</span>
                      {post.reply_count > 0 && (
                        <span className="flex items-center gap-1 text-muted">
                          <IconChat size={10} /> {post.reply_count} {post.reply_count === 1 ? t('community.reply') : t('community.replies')}
                        </span>
                      )}
                      {Array.isArray(post.attachments) && post.attachments.length > 0 && (
                        <span className="flex items-center gap-1 text-muted">
                          <IconPaperclip size={10} /> {post.attachments.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 mt-1">
                    {post.reply_count > 0 && (
                      <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                        <span className="text-caption font-bold text-muted">{post.reply_count}</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )

  // ─── New post view ──────────────────────────────────────
  if (view === 'new') return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 animate-fade-up">
          <button
            onClick={() => { setView('list'); setError('') }}
            className="w-9 h-9 bg-[#141414] rounded-xl flex items-center justify-center text-muted hover:text-white transition-colors"
          >
            <IconArrowLeft size={14} />
          </button>
          <div>
            <h1 className="font-semibold text-headline tracking-tight">{t('community.new_discussion')}</h1>
            <p className="text-muted text-caption">{t('community.start_conversation')}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400 animate-slide-down">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 bg-amber-950/30 border border-amber-900/40 rounded-xl px-4 py-2.5 text-xs text-amber-400 animate-slide-down">
            {notice}
          </div>
        )}

        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs text-muted block mb-1.5 font-medium">{t('community.title_label')}</label>
            <input
              type="text"
              className={inputClass}
              placeholder={t('community.body_placeholder')}
              value={newPost.title}
              onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
              maxLength={200}
            />
            <p className="text-[10px] text-muted2 mt-1 text-right">{newPost.title.length}/200</p>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1.5 font-medium">{t('community.body')}</label>
            <textarea
              className={`${inputClass} h-40 resize-none leading-relaxed`}
              placeholder="Share your thoughts, questions, or ideas..."
              value={newPost.body}
              onChange={e => setNewPost(p => ({ ...p, body: e.target.value }))}
            />
          </div>

          {/* Attachments */}
          <div>
            <input
              ref={postFileRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={e => { uploadFiles(e.target.files, setPostAtts); e.target.value = '' }}
            />
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => postFileRef.current?.click()}
                disabled={postAtts.length >= MAX_ATTACHMENTS}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-[#262626] hover:border-[#3a3a3a] disabled:opacity-40"
              >
                <IconPaperclip size={13} /> {t('community.add_photos')}
              </button>
              <span className="text-[10px] text-muted2">{t('community.attachments_note')}</span>
            </div>
            <AttachmentPreview
              items={postAtts}
              onRemove={i => setPostAtts(p => p.filter((_, j) => j !== i))}
              onImageClick={setLightbox}
              uploading={uploading}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={createPost}
              disabled={submitting || !newPost.title.trim() || !newPost.body.trim()}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press"
            >
              {submitting ? <><IconSpinner size={14} /> {t('community.posting')}</> : <><IconSend size={14} /> {t('community.post')}</>}
            </button>
            <button
              onClick={() => { setView('list'); setError('') }}
              className="px-4 py-2.5 border border-[#262626] hover:border-[#3a3a3a] text-muted hover:text-white rounded-xl text-sm font-medium transition-colors"
            >
              {t('community.cancel')}
            </button>
          </div>
        </div>
      </div>
    </main>
  )

  // ─── Detail view ────────────────────────────────────────
  if (view === 'detail') return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 animate-fade-up">
          <button
            onClick={() => { setView('list'); setSelectedPost(null); setReplies([]) }}
            className="w-9 h-9 bg-[#141414] rounded-xl flex items-center justify-center text-muted hover:text-white transition-colors"
          >
            <IconArrowLeft size={14} />
          </button>
          <div>
            <h1 className="font-semibold text-headline tracking-tight">{t('community.discussion')}</h1>
            <p className="text-muted text-caption">{t('community.back')}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400 animate-slide-down">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 bg-amber-950/30 border border-amber-900/40 rounded-xl px-4 py-2.5 text-xs text-amber-400 animate-slide-down">
            {notice}
          </div>
        )}

        {loadingDetail ? (
          <div className="skeleton border border-[#262626] rounded-xl p-6 h-64" />
        ) : selectedPost ? (
          <>
            {/* Post */}
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 mb-4">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h2 className="font-semibold text-headline-sm tracking-tight leading-snug text-muted">{selectedPost.title}</h2>
                {user && selectedPost.user_id === user.id && (
                  <button
                    onClick={() => deletePost(selectedPost.id)}
                    className="text-muted2 hover:text-red-500 transition-colors p-1 shrink-0"
                  >
                    <IconTrash size={14} />
                  </button>
                )}
              </div>
              <div className="text-body text-[#d4d4d4] leading-relaxed whitespace-pre-wrap mb-4">
                {selectedPost.body}
              </div>
              <AttachmentMedia items={selectedPost.attachments} onImageClick={setLightbox} />
              <div className="flex items-center gap-3 text-caption text-[#525252] pt-3 border-t border-[#1a1a1a]">
                <span className="flex items-center gap-1">
                  <IconUser size={12} /> {selectedPost.author_name || 'Anonymous'}
                </span>
                <span>{formatTime(selectedPost.created_at)}</span>
                <span className="flex items-center gap-1">
                  <IconChat size={12} /> {replies.length} {replies.length === 1 ? t('community.reply') : t('community.replies')}
                </span>
              </div>
            </div>

            {/* Replies */}
            {replies.length > 0 && (
              <div className="space-y-2 mb-4">
                {replies.map(reply => (
                  <div key={reply.id} className="bg-[#141414] border border-white/[0.06] rounded-xl px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                            {(reply.author_name || 'A').slice(0, 1).toUpperCase()}
                          </div>
                          <span className="text-caption text-white font-medium">{reply.author_name || 'Anonymous'}</span>
                          <span className="text-[10px] text-[#525252]">{formatTime(reply.created_at)}</span>
                        </div>
                        <p className="text-caption text-[#d4d4d4] leading-relaxed whitespace-pre-wrap mb-2">{reply.body}</p>
                        <AttachmentMedia items={reply.attachments} onImageClick={setLightbox} />
                      </div>
                      {user && reply.user_id === user.id && (
                        <button
                          onClick={() => deleteReply(reply.id)}
                          className="text-muted2 hover:text-red-500 transition-colors p-1 shrink-0"
                        >
                          <IconTrash size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reply form */}
            {user ? (
              <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-red-600 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-1">
                    {(user.user_metadata?.full_name || user.email?.split('@')[0] || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <textarea
                      className={`${inputClass} h-20 resize-none leading-relaxed mb-2`}
                      placeholder={t('community.reply_placeholder')}
                      value={replyBody}
                      onChange={e => setReplyBody(e.target.value)}
                    />
                    <input
                      ref={replyFileRef}
                      type="file"
                      multiple
                      accept={ACCEPT}
                      className="hidden"
                      onChange={e => { uploadFiles(e.target.files, setReplyAtts); e.target.value = '' }}
                    />
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <button
                        type="button"
                        onClick={() => replyFileRef.current?.click()}
                        disabled={replyAtts.length >= MAX_ATTACHMENTS}
                        className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-[#262626] hover:border-[#3a3a3a] disabled:opacity-40"
                      >
                        <IconPaperclip size={13} /> {t('community.add_photos')}
                      </button>
                    </div>
                    <AttachmentPreview
                      items={replyAtts}
                      onRemove={i => setReplyAtts(p => p.filter((_, j) => j !== i))}
                      onImageClick={setLightbox}
                      uploading={uploading}
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={createReply}
                        disabled={submitting || !replyBody.trim()}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 press"
                      >
                        {submitting ? <IconSpinner size={14} /> : <IconSend size={14} />}
                        {t('community.reply_button')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-5 text-center">
                <p className="text-muted text-caption">
                  <a href="/auth" className="text-red-400 hover:text-red-300 transition-colors">Sign in</a> {t('community.signin_to_reply')}
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-[88vh] rounded-xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 bg-[#1a1a1a]/80 hover:bg-[#262626] text-white rounded-full flex items-center justify-center transition-colors"
          >
            <IconClose size={18} />
          </button>
        </div>
      )}
    </main>
  )
}
