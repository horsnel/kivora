'use client'
import { useEffect, useState } from 'react'
import { supabasePublic } from '@/lib/supabase'
import { resolveAvatarUrl } from '@/lib/avatar'

// ── Shared user avatar ─────────────────────────────────────────────
// Fetches profiles.avatar_url for the signed-in user and renders the
// chosen avatar (self-hosted) or initials fallback. Used by the main
// sidebar and the chat sidebar so a picked avatar shows up app-wide.

export function useProfileAvatar(user) {
  const [avatarUrl, setAvatarUrl] = useState(null)

  useEffect(() => {
    let active = true
    setAvatarUrl(null)
    if (!user?.id) return
    ;(async () => {
      try {
        if (!supabasePublic) return
        const { data } = await supabasePublic
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single()
        if (active) setAvatarUrl(resolveAvatarUrl(data?.avatar_url) || null)
      } catch {
        // profile row missing / offline — initials fallback is fine
      }
    })()
    return () => {
      active = false
    }
  }, [user?.id])

  return avatarUrl
}

export default function UserAvatar({ user, size = 24, className = '' }) {
  const avatarUrl = useProfileAvatar(user)
  const name =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'U'
  const initials = name.slice(0, 2).toUpperCase()

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size, minWidth: size }}
        className={`rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size, minWidth: size, fontSize: Math.max(8, Math.round(size * 0.38)) }}
      className={`bg-[#dc2626] rounded-full flex items-center justify-center font-bold text-white shrink-0 ${className}`}
    >
      {initials}
    </div>
  )
}
