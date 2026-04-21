'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabasePublic } from '@/lib/supabase'
import { IconBookmark, IconChat, IconTrash, IconLogout, IconArrowRight, IconUser } from '@/components/Icons'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saves, setSaves] = useState([])
  const [chats, setChats] = useState([])
  const [tab, setTab] = useState('saved')

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabasePublic.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUser(user)
    await Promise.all([loadSaves(user.id), loadChats(user.id)])
    setLoading(false)
  }

  async function loadSaves(id) {
    const { data } = await supabasePublic.from('saved_results').select('*').eq('user_id', id).order('created_at', { ascending: false })
    if (data) setSaves(data)
  }

  async function loadChats(id) {
    const { data } = await supabasePublic.from('chat_sessions').select('id,messages,updated_at').eq('user_id', id).order('updated_at', { ascending: false }).limit(20)
    if (data) setChats(data)
  }

  async function signOut() { await supabasePublic.auth.signOut(); router.push('/') }

  async function deleteSave(id) {
    await supabasePublic.from('saved_results').delete().eq('id', id)
    setSaves(p => p.filter(s => s.id !== id))
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-5 h-5 border border-[#262626] border-t-red-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#141414] border border-[#262626] rounded-xl flex items-center justify-center">
              <IconUser size={16} className="text-[#737373]" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Dashboard</h1>
              <p className="text-[#737373] text-xs">{user?.email}</p>
            </div>
          </div>
          <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-[#737373] hover:text-white border border-[#262626] hover:border-[#3a3a3a] px-3 py-1.5 rounded-lg transition-all">
            <IconLogout size={12} /> Sign out
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-7">
          {[
            { label: 'Saved',        value: saves.length },
            { label: 'Chats',        value: chats.length },
            { label: 'Member since', value: user?.created_at ? new Date(user.created_at).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : '—' },
          ].map(s => (
            <div key={s.label} className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-3 text-center">
              <div className="font-bold text-lg tracking-tight">{s.value}</div>
              <div className="text-xs text-[#737373] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#141414] border border-[#262626] p-1 rounded-xl mb-6">
          {[
            { id: 'saved', label: 'Saved', Icon: IconBookmark },
            { id: 'chats', label: 'Chat History', Icon: IconChat },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-[#262626] text-white' : 'text-[#737373] hover:text-white'
              }`}>
              <t.Icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {/* Saved */}
        {tab === 'saved' && (
          saves.length === 0 ? (
            <Empty icon={<IconBookmark size={20} className="text-[#2e2e2e]" />} title="No saved opportunities" desc="Explore an opportunity and click Save to bookmark it here." action={{ label: 'Start exploring', href: '/' }} router={router} />
          ) : (
            <div className="space-y-2">
              {saves.map(save => (
                <div key={save.id} className="bg-[#141414] border border-[#262626] rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                  <button onClick={() => router.push(`/explore/${save.result_slug}`)} className="flex-1 text-left">
                    <div className="text-sm text-white hover:text-red-400 transition-colors leading-snug">{save.query}</div>
                    <div className="text-xs text-[#404040] mt-1">Saved {new Date(save.created_at).toLocaleDateString()}</div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => router.push(`/explore/${save.result_slug}`)} className="text-[#404040] hover:text-white transition-colors p-1">
                      <IconArrowRight size={14} />
                    </button>
                    <button onClick={() => deleteSave(save.id)} className="text-[#404040] hover:text-red-500 transition-colors p-1">
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Chats */}
        {tab === 'chats' && (
          chats.length === 0 ? (
            <Empty icon={<IconChat size={20} className="text-[#2e2e2e]" />} title="No chat history" desc="Chat sessions are saved when you're signed in." action={{ label: 'Start a chat', href: '/chat' }} router={router} />
          ) : (
            <div className="space-y-2">
              {chats.map(chat => {
                const msgs = chat.messages || []
                const first = msgs.find(m => m.role === 'user')
                return (
                  <div key={chat.id} className="bg-[#141414] border border-[#262626] rounded-xl px-5 py-4">
                    <div className="text-sm text-white mb-1 line-clamp-1 leading-snug">{first?.content || 'Chat session'}</div>
                    <div className="flex items-center gap-3 text-xs text-[#404040] font-mono">
                      <span>{msgs.length} msg{msgs.length !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>{new Date(chat.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </main>
  )
}

function Empty({ icon, title, desc, action, router }) {
  return (
    <div className="text-center py-16">
      <div className="w-10 h-10 bg-[#141414] border border-[#262626] rounded-xl flex items-center justify-center mx-auto mb-4">{icon}</div>
      <h3 className="font-semibold mb-1.5 tracking-tight">{title}</h3>
      <p className="text-[#737373] text-sm mb-4">{desc}</p>
      <button onClick={() => router.push(action.href)} className="text-red-500 hover:text-red-400 text-sm flex items-center gap-1 mx-auto">
        {action.label} <IconArrowRight size={12} />
      </button>
    </div>
  )
}
