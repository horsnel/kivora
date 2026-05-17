'use client'
import { useState, useEffect } from 'react'
import { supabasePublic } from '@/lib/supabase'
import { useTranslation } from '@/components/LanguageProvider'
import { IconChat, IconArrowLeft, IconPlus, IconSpinner, IconTrash, IconSend, IconUser } from '@/components/Icons'

function IconForum({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H9l-3 3v-3H3a1 1 0 01-1-1V3z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M5 6h6M5 8.5h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="12" cy="11" r="3" fill="#0a0a0a" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M12 9.5v3M10.5 11h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

const inputClass = "w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"

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

  useEffect(() => { loadUser(); loadPosts() }, [])

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

  async function createPost() {
    if (!user) { setError(t('community.signin_to_post')); return }
    if (!newPost.title.trim() || !newPost.body.trim()) { setError('Title and body are required'); return }
    setSubmitting(true); setError('')
    try {
      const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Anonymous'
      const res = await fetch('/api/forum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'post',
          user_id: user.id,
          author_name: displayName,
          title: newPost.title,
          body: newPost.body,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create post'); return }
      setNewPost({ title: '', body: '' })
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
    setSubmitting(true); setError('')
    try {
      const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Anonymous'
      const res = await fetch('/api/forum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reply',
          user_id: user.id,
          author_name: displayName,
          post_id: selectedPost.id,
          body: replyBody,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to post reply'); return }
      setReplyBody('')
      await loadPost(selectedPost.id)
    } catch {
      setError('Failed to post reply')
    }
    setSubmitting(false)
  }

  async function deletePost(postId) {
    if (!user) return
    try {
      await fetch('/api/forum', {
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
      await fetch('/api/forum', {
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
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#141414] rounded-xl flex items-center justify-center">
              <IconForum size={14} className="text-[#737373]" />
            </div>
            <div>
              <h1 className="font-semibold text-headline tracking-tight">{t('community.title')}</h1>
              <p className="text-[#737373] text-caption">{t('community.subtitle')}</p>
            </div>
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
            <h3 className="font-semibold text-headline mb-2 tracking-tight">{t('community.empty')}</h3>
            <p className="text-[#737373] text-body mb-6">{t('community.empty_desc')}</p>
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
                    <h3 className="text-body-sm text-white font-medium leading-snug mb-1.5 line-clamp-1">
                      {post.title}
                    </h3>
                    <p className="text-caption text-[#737373] line-clamp-2 leading-relaxed mb-2">
                      {post.body}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-[#525252]">
                      <span className="flex items-center gap-1">
                        <IconUser size={10} /> {post.author_name || 'Anonymous'}
                      </span>
                      <span>{formatTime(post.created_at)}</span>
                      {post.reply_count > 0 && (
                        <span className="flex items-center gap-1 text-[#737373]">
                          <IconChat size={10} /> {post.reply_count} {post.reply_count === 1 ? t('community.reply') : t('community.replies')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 mt-1">
                    {post.reply_count > 0 && (
                      <div className="w-8 h-8 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                        <span className="text-caption font-bold text-[#737373]">{post.reply_count}</span>
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
            className="w-9 h-9 bg-[#141414] rounded-xl flex items-center justify-center text-[#737373] hover:text-white transition-colors"
          >
            <IconArrowLeft size={14} />
          </button>
          <div>
            <h1 className="font-semibold text-headline tracking-tight">{t('community.new_discussion')}</h1>
            <p className="text-[#737373] text-caption">{t('community.start_conversation')}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400 animate-slide-down">
            {error}
          </div>
        )}

        <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs text-[#737373] block mb-1.5 font-medium">{t('community.title_label')}</label>
            <input
              type="text"
              className={inputClass}
              placeholder={t('community.body_placeholder')}
              value={newPost.title}
              onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
              maxLength={200}
            />
            <p className="text-[10px] text-[#404040] mt-1 text-right">{newPost.title.length}/200</p>
          </div>
          <div>
            <label className="text-xs text-[#737373] block mb-1.5 font-medium">{t('community.body')}</label>
            <textarea
              className={`${inputClass} h-40 resize-none leading-relaxed`}
              placeholder="Share your thoughts, questions, or ideas..."
              value={newPost.body}
              onChange={e => setNewPost(p => ({ ...p, body: e.target.value }))}
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
              className="px-4 py-2.5 border border-[#262626] hover:border-[#3a3a3a] text-[#737373] hover:text-white rounded-xl text-sm font-medium transition-colors"
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
            className="w-9 h-9 bg-[#141414] rounded-xl flex items-center justify-center text-[#737373] hover:text-white transition-colors"
          >
            <IconArrowLeft size={14} />
          </button>
          <div>
            <h1 className="font-semibold text-headline tracking-tight">{t('community.discussion')}</h1>
            <p className="text-[#737373] text-caption">{t('community.back')}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5 text-xs text-red-400 animate-slide-down">
            {error}
          </div>
        )}

        {loadingDetail ? (
          <div className="skeleton border border-[#262626] rounded-xl p-6 h-64" />
        ) : selectedPost ? (
          <>
            {/* Post */}
            <div className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 mb-4">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h2 className="font-semibold text-headline-sm tracking-tight leading-snug">{selectedPost.title}</h2>
                {user && selectedPost.user_id === user.id && (
                  <button
                    onClick={() => deletePost(selectedPost.id)}
                    className="text-[#404040] hover:text-red-500 transition-colors p-1 shrink-0"
                  >
                    <IconTrash size={14} />
                  </button>
                )}
              </div>
              <div className="text-body text-[#d4d4d4] leading-relaxed whitespace-pre-wrap mb-4">
                {selectedPost.body}
              </div>
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
                        <p className="text-caption text-[#d4d4d4] leading-relaxed whitespace-pre-wrap">{reply.body}</p>
                      </div>
                      {user && reply.user_id === user.id && (
                        <button
                          onClick={() => deleteReply(reply.id)}
                          className="text-[#404040] hover:text-red-500 transition-colors p-1 shrink-0"
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
                    <div className="flex justify-end">
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
                <p className="text-[#737373] text-caption">
                  <a href="/auth" className="text-red-400 hover:text-red-300 transition-colors">Sign in</a> {t('community.signin_to_reply')}
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  )
}
