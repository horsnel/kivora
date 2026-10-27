'use client'
// ════════════════════════════════════════════════════════════════════
// TerminalWorkspace (v5.28) — the Live Terminal drawer's window into the
// user's persistent workspace. The terminal itself runs on ephemeral
// Judge0 containers, so `ls` inside a command can't show what actually
// persists; this panel lists the REAL workspace (Supabase-backed VFS):
// files the AI saved, terminal auto-captures, generate_downloadable
// artifacts and sandbox_git clones — with download/delete inline.
// Refreshes automatically after every executed command (refreshKey bump).
// ════════════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback, useRef } from 'react'

const EXT_COLOR = {
  py: '#4ade80', js: '#facc15', ts: '#38bdf8', html: '#fb923c', css: '#38bdf8',
  json: '#a3e635', csv: '#4ade80', md: '#d4d4d4', txt: '#d4d4d4', pdf: '#f87171',
  png: '#c084fc', jpg: '#c084fc', jpeg: '#c084fc', svg: '#c084fc', sh: '#4ade80',
  zip: '#facc15', sql: '#38bdf8', ipynb: '#facc15',
}
const extOf = (p) => (p || '').split('.').pop()?.toLowerCase() || ''

function fmtSize(n) {
  const b = Number(n) || 0
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

export default function TerminalWorkspace({ visible, getToken, t, refreshKey = 0 }) {
  const [files, setFiles] = useState(null) // null = loading
  const [signedOut, setSignedOut] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  const liveRef = useRef(false)

  const load = useCallback(async () => {
    setFiles(null)
    setFailed(false)
    setSignedOut(false)
    try {
      const token = (await getToken?.()) || ''
      const res = await fetch('/api/vfs', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (res.status === 401) {
        setSignedOut(true)
        setFiles([])
        return
      }
      const d = await res.json()
      if (!d.ok) setFailed(true)
      else setFiles(d.files || [])
    } catch {
      setFailed(true)
    }
  }, [getToken])

  useEffect(() => {
    liveRef.current = visible
    if (visible) load()
  }, [visible, refreshKey, load])

  const flash = (msg) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1600)
  }

  const download = async (f) => {
    setBusy(f.path)
    try {
      const token = (await getToken?.()) || ''
      const res = await fetch(`/api/vfs?download=1&path=${encodeURIComponent(f.path)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = f.path.split('/').pop()
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch {
      flash(t('vfs.error'))
    }
    setBusy('')
  }

  const remove = async (f) => {
    setBusy(f.path)
    try {
      const token = (await getToken?.()) || ''
      const res = await fetch(`/api/vfs?path=${encodeURIComponent(f.path)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        setFiles((prev) => (prev || []).filter((x) => x.path !== f.path))
        flash(t('vfs.deleted'))
      } else flash(t('vfs.error'))
    } catch {
      flash(t('vfs.error'))
    }
    setBusy('')
  }

  if (!visible) return null

  const totalBytes = (files || []).reduce((a, f) => a + (Number(f.size) || 0), 0)
  const countLabel = files ? t('vfs.count', { n: files.length, size: fmtSize(totalBytes) }) : ''

  return (
    <div className="shrink-0 border-b border-white/[0.06] bg-[#0a0a0a]">
      {/* header row */}
      <div className="flex items-center gap-2 px-4 py-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF3366" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-[11px] font-mono text-[#a3a3a3] uppercase tracking-wider truncate">{t('vfs.title')}</span>
        {countLabel && <span className="text-[10px] text-[#525252] font-mono shrink-0">{countLabel}</span>}
        <button
          type="button"
          onClick={load}
          aria-label={t('vfs.refresh')}
          title={t('vfs.refresh')}
          className="ml-auto w-6 h-6 rounded-md flex items-center justify-center text-[#525252] hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={files === null ? 'animate-spin' : ''}>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

      {/* body */}
      <div className="max-h-[26dvh] overflow-y-auto overscroll-contain px-2 pb-2">
        {signedOut && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#525252" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <p className="flex-1 min-w-0 text-[11.5px] text-[#737373] leading-snug truncate">{t('vfs.signin')}</p>
            <a href="/auth" className="shrink-0 px-3 py-1.5 rounded-lg bg-[#FF3366] text-white text-[11px] font-semibold hover:bg-[#ff4d78] transition-colors">{t('vfs.signin_cta')}</a>
          </div>
        )}

        {!signedOut && files === null && (
          <div className="flex items-center justify-center py-5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin text-[#FF3366]"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.2" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </div>
        )}

        {!signedOut && failed && (
          <p className="px-3 py-4 text-center text-[11.5px] text-[#737373]">{t('vfs.error')}</p>
        )}

        {!signedOut && files !== null && files.length === 0 && !failed && (
          <p className="px-3 py-4 text-center text-[11.5px] text-[#525252] leading-snug">{t('vfs.empty')}</p>
        )}

        {(files || []).map((f) => {
          const ext = extOf(f.path)
          const color = EXT_COLOR[ext] || '#737373'
          const isBusy = busy === f.path
          return (
            <div key={f.path} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.04] transition-colors">
              <div className="w-6 h-6 rounded-md bg-[#161616] border border-[#262626] flex items-center justify-center shrink-0">
                <span className="text-[7.5px] font-bold uppercase" style={{ color }}>{ext.slice(0, 4) || 'file'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#e5e5e5] truncate font-medium leading-tight">{f.path.split('/').pop()}</p>
                <p className="text-[9.5px] text-[#525252] truncate leading-tight">{f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) + ' · ' : ''}{fmtSize(f.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => download(f)}
                disabled={isBusy}
                aria-label={t('vfs.download')}
                className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[#737373] hover:text-white hover:bg-white/[0.07] transition-colors disabled:opacity-40"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13" /><path d="M8 12l4 4 4-4" /><path d="M5 21h14" /></svg>
              </button>
              <button
                type="button"
                onClick={() => remove(f)}
                disabled={isBusy}
                aria-label={t('vfs.delete')}
                className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[#737373] hover:text-[#FF3366] hover:bg-white/[0.07] transition-colors disabled:opacity-40"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></svg>
              </button>
            </div>
          )
        })}
      </div>

      {toast && (
        <div className="px-4 pb-2 -mt-0.5">
          <span className="inline-block px-3 py-1 rounded-full bg-[#1f1f1f] border border-[#2e2e2e] text-[11px] text-white">{toast}</span>
        </div>
      )}
    </div>
  )
}
