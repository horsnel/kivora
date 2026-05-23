import { useRef, useCallback } from 'react'
import { supabasePublic } from '@/lib/supabase'

/**
 * Hook to track study/devtools/chat sessions for logged-in users.
 * Uses /api/study-sessions (service role key, bypasses RLS).
 * Client validates auth before calling — API trusts user_id from client.
 * Silently fails for anonymous users — no UI impact.
 */
export function useSessionTracker() {
  const startTimeRef = useRef(null)

  const startSession = useCallback(async (toolType, subject, inputSummary) => {
    try {
      const { data: { session } } = await supabasePublic.auth.getUser()
      if (!session?.user) return null

      startTimeRef.current = Date.now()

      const res = await fetch('/api/study-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          tool_type: toolType,
          subject: subject || null,
          input_summary: inputSummary?.slice(0, 200) || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        return data.id
      }
    } catch {}
    return null
  }, [])

  const endSession = useCallback(async (id) => {
    if (!id) return
    try {
      const { data: { session } } = await supabasePublic.auth.getUser()
      if (!session?.user) return

      await fetch('/api/study-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, user_id: session.user.id, ended_at: new Date().toISOString() }),
      })
    } catch {}
  }, [])

  const markCopied = useCallback(async (id) => {
    if (!id) return
    try {
      const { data: { session } } = await supabasePublic.auth.getUser()
      if (!session?.user) return

      await fetch('/api/study-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, user_id: session.user.id, result_copied: true }),
      })
    } catch {}
  }, [])

  const markFollowUp = useCallback(async (id) => {
    if (!id) return
    try {
      const { data: { session } } = await supabasePublic.auth.getUser()
      if (!session?.user) return

      await fetch('/api/study-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, user_id: session.user.id, follow_up_asked: true }),
      })
    } catch {}
  }, [])

  return { startSession, endSession, markCopied, markFollowUp }
}
