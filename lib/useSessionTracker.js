import { useRef, useCallback } from 'react'
import { supabasePublic } from '@/lib/supabase'
import { authFetch } from '@/lib/authFetch'

/**
 * Hook to track study/devtools/chat sessions for logged-in users.
 * Uses /api/study-sessions — the server derives the user identity from the
 * Supabase JWT attached by authFetch (never from client-supplied IDs).
 *
 * NOTE: historically this hook destructured supabasePublic.auth.getUser()
 * as { data: { session } } — getUser() returns { data: { user } }, so the
 * check always failed and sessions were silently never recorded. authFetch
 * resolves the session itself, fixing both the bug and the identity trust
 * issue in one go. Silently fails for anonymous users — no UI impact.
 */
export function useSessionTracker() {
  const startTimeRef = useRef(null)

  const startSession = useCallback(async (toolType, subject, inputSummary) => {
    try {
      const { data: { session } } = await supabasePublic.auth.getSession()
      if (!session?.user) return null

      startTimeRef.current = Date.now()

      const res = await authFetch('/api/study-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      await authFetch('/api/study-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ended_at: new Date().toISOString() }),
      })
    } catch {}
  }, [])

  const markCopied = useCallback(async (id) => {
    if (!id) return
    try {
      await authFetch('/api/study-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, result_copied: true }),
      })
    } catch {}
  }, [])

  const markFollowUp = useCallback(async (id) => {
    if (!id) return
    try {
      await authFetch('/api/study-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, follow_up_asked: true }),
      })
    } catch {}
  }, [])

  return { startSession, endSession, markCopied, markFollowUp }
}
