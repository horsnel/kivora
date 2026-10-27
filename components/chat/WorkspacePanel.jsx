'use client'
// ════════════════════════════════════════════════════════════════════
// WorkspacePanel (v5.27) — the user's view of the AI agent's persistent
// file system. Every file the agent saves (sandbox_file, terminal
// auto-capture, generate_downloadable) lands here; files survive
// refreshes, sessions and conversations (Supabase-backed).
// ════════════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react'

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
function fmtDate(iso) {
  try {
    const d = new Date(iso)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export default function WorkspacePanel({ open, onClose, getToken, t }) {
  const [files, setFiles] = useState(null) // null = loading
  const [signedOut, setSignedOut] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('') // path being downloaded/deleted
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setFiles(null)
    setError('')
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
      if (!d.ok) setError(d.detail || 'error')
      else setFiles(d.files || [])
    } catch {
      setError('network')
    }
  }, [getToken])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 1800)
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9996] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={t('vfs.title')}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-md mx-0 sm:mx-4 mb-0 sm:mb-6 max-h-[75dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#0d0d0d] border border-[#262626] shadow-2xl shadow-black/70 overflow-hidden">
        {/* header */}
        <div className="shrink-0 flex items-center gap-2.5 px-4 py-3.5 border-b border-[#262626] bg-[#111111]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3366" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-semibold text-white leading-tight">{t('vfs.title')}</h2>
            <p className="text-[10.5px] text-[#525252] leading-tight">{t('vfs.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-8 h-8 rounded-full bg-[#1c1c1c] text-[#a3a3a3] hover:bg-[#262626] hover:text-white flex items-center justify-center transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {files === null && !signedOut && (
            <div className="flex items-center justify-center py-14">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="animate-spin text-[#FF3366]"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.2" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
            </div>
          )}

          {signedOut && (
            <div className="px-6 py-12 text-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3f3f3f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              <p className="text-[13.5px] text-[#a3a3a3] leading-relaxed mb-4">{t('vfs.signin')}</p>
              <a href="/auth" className="inline-block px-5 py-2.5 rounded-xl bg-[#FF3366] text-white text-[13px] font-semibold hover:bg-[#ff4d78] transition-colors">{t('vfs.signin_cta')}</a>
            </div>
          )}

          {!signedOut && files !== null && files.length === 0 && !error && (
            <div className="px-6 py-12 text-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3f3f3f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
              <p className="text-[13.5px] text-[#a3a3a3] leading-relaxed">{t('vfs.empty')}</p>
            </div>
          )}

          {error && !signedOut && (
            <p className="px-6 py-12 text-center text-[13px] text-[#737373]">{t('vfs.error')}</p>
          )}

          {(files || []).map((f) => {
            const ext = extOf(f.path)
            const color = EXT_COLOR[ext] || '#737373'
            const isBusy = busy === f.path
            return (
              <div key={f.path} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#161616] border border-[#262626] flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold uppercase" style={{ color }}>{ext.slice(0, 4) || 'file'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-[#e5e5e5] truncate font-medium">{f.path.split('/').pop()}</p>
                  <p className="text-[10.5px] text-[#525252] truncate">{f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) + ' · ' : ''}{fmtSize(f.size)} · {fmtDate(f.updated_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => download(f)}
                  disabled={isBusy}
                  aria-label={t('vfs.download')}
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:text-white hover:bg-white/[0.07] transition-colors disabled:opacity-40"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13" /><path d="M8 12l4 4 4-4" /><path d="M5 21h14" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => remove(f)}
                  disabled={isBusy}
                  aria-label={t('vfs.delete')}
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:text-[#FF3366] hover:bg-white/[0.07] transition-colors disabled:opacity-40"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></svg>
                </button>
              </div>
            )
          })}
        </div>

        {/* footer hint */}
        {!signedOut && files && files.length > 0 && (
          <div className="shrink-0 px-4 py-2.5 border-t border-[#262626] bg-[#111111]">
            <p className="text-[10.5px] text-[#525252]">{t('vfs.hint')}</p>
          </div>
        )}

        {toast && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-[#1f1f1f] border border-[#2e2e2e] text-[12px] text-white shadow-xl shadow-black/50">{toast}</div>
        )}
      </div>
    </div>
  )
}
