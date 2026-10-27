'use client'
// ════════════════════════════════════════════════════════════════════
// DevToolsDock — Kivora Browser's in-page developer tools (v5.25)
//
// A DevTools-style drawer docked to the bottom of the browser panel.
// All page data arrives from the injected agent (lib/browser/
// devtools-agent.mjs) over postMessage — the parent can never touch the
// sandboxed iframe's document directly, so this dock is a pure renderer
// + command sender:
//
//   Console   live page logs (log/warn/error/info/debug, page errors,
//             unhandled rejections) + LIVE JS EVAL into the page
//   Network   fetch/XHR log: method, status, type, duration, URL
//   Elements  DOM tree inspector + crosshair element picker with
//             computed-style readout
//   Perf      live FPS, JS heap, DOM nodes, resources, TTFB/DCL/Load
//   Device    viewport, DPR, UA, language, touch, online state
//   Find      find-in-page with in-iframe <mark> highlighting
//
// The soft-circle-X close (reference design #2) closes the dock; the
// chevron (reference design #1) collapses it to the strip.
// ════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import BackButton, { XGlyph } from '@/components/BackButton'

const TABS = ['console', 'network', 'elements', 'perf', 'device']

// ── agent value segment → display string ──
function fmtSeg(s) {
  if (s == null || typeof s !== 'object') return String(s)
  if ('u' in s) return 'undefined'
  if ('n' in s) return 'null'
  if ('s' in s) return s.s
  if ('node' in s) return s.node
  if ('a' in s) return `[${(s.a || []).map(fmtSeg).join(', ')}]`
  if ('o' in s) {
    try {
      const inner = Object.entries(s.o || {})
        .slice(0, 12)
        .map(([k, v]) => `${k}: ${fmtSeg(v)}`)
        .join(', ')
      return `{ ${inner} }`
    } catch {
      return '{ … }'
    }
  }
  return String(s)
}

const levelColor = {
  error: 'text-[#ff6b81]',
  warn: 'text-[#f5b04c]',
  info: 'text-[#8ab4f8]',
  debug: 'text-[#737373]',
  'eval-ok': 'text-[#4ade80]',
  'eval-err': 'text-[#ff6b81]',
}

function TreeNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 1)
  const kids = Array.isArray(node.kids) ? node.kids : null
  const kidCount = Array.isArray(node.kids) ? node.kids.length : node.kids || 0
  return (
    <div style={{ paddingLeft: depth ? 14 : 0 }} className="border-l border-white/[0.05] first:border-l-0">
      <button
        type="button"
        onClick={() => kids && setOpen((v) => !v)}
        className={`w-full text-left flex items-baseline gap-1.5 py-[3px] pr-2 font-mono text-[11.5px] leading-tight hover:bg-white/[0.04] rounded transition-colors ${kids ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className="w-3 shrink-0 text-[#525252]">{kids ? (open ? '▾' : '▸') : ''}</span>
        <span className="text-[#FF3366]/90">{node.tag}</span>
        {node.id && <span className="text-[#8ab4f8]">#{node.id}</span>}
        {node.cls && <span className="text-[#4ade80]">.{node.cls.split(' ').filter(Boolean).slice(0, 3).join('.')}</span>}
        {node.text && <span className="text-[#a3a3a3] truncate max-w-[200px]">{node.text}</span>}
        {node.box && <span className="text-[#525252] text-[10px]">{node.box[0]}×{node.box[1]}</span>}
        {!kids && kidCount > 0 && <span className="text-[#525252] text-[10px]">{kidCount} children</span>}
        {node.more ? <span className="text-[#525252] text-[10px]">+{node.more}</span> : null}
      </button>
      {open && kids && kids.map((k, i) => <TreeNode key={i} node={k} depth={depth + 1} />)}
    </div>
  )
}

function StatTile({ label, value, sub }) {
  return (
    <div className="rounded-xl bg-[#141414] border border-[#262626] px-3.5 py-3">
      <div className="text-[10px] uppercase tracking-wider text-[#525252]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#fafafa] tabular-nums leading-none">
        {value}
        {sub ? <span className="text-[11px] font-normal text-[#737373] ml-1">{sub}</span> : null}
      </div>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex items-start gap-3 px-1 py-2 border-b border-white/[0.04] last:border-0">
      <span className="w-24 shrink-0 text-[11px] text-[#525252] pt-0.5">{k}</span>
      <span className="flex-1 min-w-0 text-[12px] text-[#d4d4d4] break-words font-mono">{v}</span>
    </div>
  )
}

export default function DevToolsDock({
  t,
  collapsed,
  onToggleCollapse,
  onClose,
  state,            // { console:[], net:[], tree, perf, meta, findCount, picked }
  onSend,           // (cmd) => void — routed to the active tab's iframe
  onClearConsole,
  onTabChange,      // (tabId) => void — lets the parent fire on-demand loads (inspect)
  pageUrl,
  canInspect,
}) {
  const [tab, setTabInner] = useState('console')
  const [evalInput, setEvalInput] = useState('')
  const [findInput, setFindInput] = useState('')
  const [hist, setHist] = useState([])
  const [histIx, setHistIx] = useState(-1)
  const logRef = useRef(null)
  const evalRef = useRef(null)

  const entries = state.console || []
  const net = state.net || []

  // autoscroll console
  useEffect(() => {
    if (tab === 'console' && !collapsed && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [entries.length, tab, collapsed])

  const setTab = (id) => {
    setTabInner(id)
    if (onTabChange) onTabChange(id)
  }

  const runEval = (code) => {
    if (!code.trim() || !canInspect) return
    setHist((h) => [code, ...h].slice(0, 50))
    setHistIx(-1)
    onSend({ type: 'eval', id: `e${Date.now().toString(36)}`, code })
    setEvalInput('')
  }

  const submitFind = (q) => {
    onSend(q ? { type: 'find', q } : { type: 'findClear' })
  }

  const tabBtn = (id, label, badge) => (
    <button
      type="button"
      key={id}
      onClick={() => setTab(id)}
      className={`relative shrink-0 px-3 h-8 rounded-lg text-[11.5px] font-medium transition-colors ${
        tab === id ? 'bg-white/[0.08] text-white' : 'text-[#737373] hover:text-[#d4d4d4]'
      }`}
    >
      {label}
      {badge ? (
        <span className="ml-1.5 inline-block min-w-[16px] px-1 rounded-full bg-[#FF3366]/15 text-[#FF3366] text-[9.5px] font-bold tabular-nums align-middle">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  )

  return (
    <section
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col bg-[#0d0d0d] border-t border-[#262626] shadow-[0_-8px_32px_rgba(0,0,0,0.5)]"
      style={{ height: collapsed ? 44 : 'max(200px, 46%)', transition: 'height 220ms cubic-bezier(0.22,1,0.36,1)' }}
      aria-label={t('bdt.title')}
    >
      {/* ── command strip ── */}
      <div className="shrink-0 flex items-center gap-1 px-2 h-11 bg-[#111111] border-b border-[#262626]">
        <BackButton
          onClick={onToggleCollapse}
          label={collapsed ? t('bdt.expand') : t('bdt.collapse')}
          glyph={16}
          className="shrink-0 !p-1.5"
        />
        <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
          {tabBtn('console', t('bdt.console'), entries.length)}
          {tabBtn('network', t('bdt.network'), net.length)}
          {tabBtn('elements', t('bdt.elements'))}
          {tabBtn('perf', t('bdt.perf'))}
          {tabBtn('device', t('bdt.device'))}
        </div>
        <div className="flex-1" />
        {/* find in page */}
        <div className="relative hidden sm:block">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#525252" strokeWidth="2.2" strokeLinecap="round" className="absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            value={findInput}
            onChange={(e) => setFindInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitFind(findInput.trim()); if (e.key === 'Escape') { setFindInput(''); submitFind('') } }}
            placeholder={t('bdt.find_placeholder')}
            className="w-36 bg-[#0a0a0a] border border-[#262626] rounded-lg pl-7 pr-2 h-7 text-[11px] text-[#d4d4d4] placeholder:text-[#525252] focus:outline-none focus:border-[#FF3366]/50"
            aria-label={t('bdt.find')}
          />
          {state.findCount != null && (
            <span className="absolute -right-1 -top-1.5 px-1 rounded-full bg-[#FF3366] text-white text-[9px] font-bold tabular-nums">{state.findCount}</span>
          )}
        </div>
        {/* element picker crosshair */}
        <button
          type="button"
          onClick={() => onSend({ type: 'picker', on: !state.pickerOn })}
          disabled={!canInspect}
          title={t('bdt.pick')}
          aria-label={t('bdt.pick')}
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 ${
            state.pickerOn ? 'bg-[#FF3366]/15 text-[#FF3366]' : 'text-[#737373] hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('bdt.close')}
          className="shrink-0 w-8 h-8 rounded-full bg-[#1c1c1c] text-[#a3a3a3] hover:bg-[#262626] hover:text-[#fafafa] active:scale-95 flex items-center justify-center transition-all"
        >
          <XGlyph size={14} />
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* ═══ Console ═══ */}
          {tab === 'console' && (
            <div className="h-full flex flex-col">
              <div ref={logRef} className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 select-text">
                {entries.length === 0 ? (
                  <p className="text-[12px] text-[#525252] py-6 text-center">{t('bdt.empty_console')}</p>
                ) : (
                  entries.map((e, i) => (
                    <div key={i} className={`flex items-start gap-2 py-1 border-b border-white/[0.03] last:border-0 ${levelColor[e.level] || 'text-[#d4d4d4]'}`}>
                      <span className="shrink-0 text-[9px] uppercase font-bold tracking-wider w-10 pt-0.5 opacity-70">{(e.level || 'log').replace('eval-', '')}</span>
                      <span className="flex-1 min-w-0 font-mono text-[11.5px] leading-relaxed break-words whitespace-pre-wrap">
                        {(e.args || []).map(fmtSeg).join('  ')}
                      </span>
                      <span className="shrink-0 text-[9px] text-[#3f3f3f] tabular-nums pt-0.5">
                        {new Date(e.ts || Date.now()).toLocaleTimeString([], { hour12: false })}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); runEval(evalInput) }}
                className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-[#262626] bg-[#111111]"
              >
                <span className="text-[#FF3366] font-mono text-[13px] font-bold">›</span>
                <input
                  ref={evalRef}
                  type="text"
                  value={evalInput}
                  onChange={(e) => setEvalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' && hist.length) {
                      e.preventDefault()
                      const ix = Math.min(hist.length - 1, histIx + 1)
                      setHistIx(ix)
                      setEvalInput(hist[ix])
                    } else if (e.key === 'ArrowDown' && histIx >= 0) {
                      e.preventDefault()
                      const ix = histIx - 1
                      setHistIx(ix)
                      setEvalInput(ix < 0 ? '' : hist[ix])
                    }
                  }}
                  placeholder={t('bdt.eval_placeholder')}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  disabled={!canInspect}
                  className="flex-1 bg-transparent outline-none font-mono text-[12px] text-[#fafafa] placeholder:text-[#525252] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={onClearConsole}
                  className="shrink-0 text-[10.5px] text-[#525252] hover:text-[#FF3366] transition-colors"
                >
                  {t('bdt.clear')}
                </button>
              </form>
            </div>
          )}

          {/* ═══ Network ═══ */}
          {tab === 'network' && (
            <div className="h-full overflow-y-auto overscroll-contain">
              {net.length === 0 ? (
                <p className="text-[12px] text-[#525252] py-6 text-center">{t('bdt.empty_network')}</p>
              ) : (
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="sticky top-0 bg-[#111111] text-[#525252] text-[9.5px] uppercase tracking-wider">
                    <tr>
                      <th className="py-1.5 pl-3 pr-2 font-semibold w-14">{t('bdt.col_method')}</th>
                      <th className="py-1.5 px-2 font-semibold w-12">{t('bdt.col_status')}</th>
                      <th className="py-1.5 px-2 font-semibold w-12">{t('bdt.col_time')}</th>
                      <th className="py-1.5 px-2 font-semibold">{t('bdt.col_url')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {net.slice().reverse().map((r, i) => (
                      <tr key={i} className="border-t border-white/[0.03] hover:bg-white/[0.03]">
                        <td className="py-1.5 pl-3 pr-2 text-[#8ab4f8]">{r.method}</td>
                        <td className={`py-1.5 px-2 tabular-nums ${r.status === 0 ? 'text-[#ff6b81]' : r.status >= 400 ? 'text-[#ff6b81]' : r.status >= 300 ? 'text-[#f5b04c]' : 'text-[#4ade80]'}`}>{r.status || '—'}</td>
                        <td className="py-1.5 px-2 text-[#737373] tabular-nums">{r.ms != null ? `${r.ms}ms` : '—'}</td>
                        <td className="py-1.5 px-2 text-[#a3a3a3] truncate max-w-0" title={r.url}>{r.url}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ═══ Elements ═══ */}
          {tab === 'elements' && (
            <div className="h-full overflow-y-auto overscroll-contain px-3 py-2">
              {state.tree ? (
                <>
                  <TreeNode node={state.tree} />
                  {state.picked && (
                    <div className="mt-3 rounded-xl bg-[#141414] border border-[#FF3366]/25 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[#FF3366] mb-1.5">{t('bdt.picked')}</div>
                      <pre className="font-mono text-[10.5px] text-[#d4d4d4] whitespace-pre-wrap break-all max-h-24 overflow-y-auto">{state.picked.outer || ''}</pre>
                      {state.picked.styles && (
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[10.5px]">
                          {Object.entries(state.picked.styles).map(([k, v]) => (
                            <div key={k} className="flex gap-1.5 truncate">
                              <span className="text-[#8ab4f8]">{k}</span>
                              <span className="text-[#a3a3a3] truncate">{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-[#525252] py-6 text-center">{t('bdt.empty_elements')}</p>
              )}
            </div>
          )}

          {/* ═══ Perf ═══ */}
          {tab === 'perf' && (
            <div className="h-full overflow-y-auto overscroll-contain p-3">
              {state.perf ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <StatTile label={t('bdt.fps')} value={state.perf.fps ?? 0} />
                    <StatTile label={t('bdt.heap')} value={state.perf.jsHeap ?? 0} sub="MB" />
                    <StatTile label={t('bdt.nodes')} value={state.perf.nodes ?? 0} />
                    <StatTile label={t('bdt.resources')} value={state.perf.resources ?? 0} />
                  </div>
                  <div className="mt-3 rounded-xl bg-[#141414] border border-[#262626] px-1 py-1">
                    <Row k={t('bdt.ttfb')} v={`${state.perf.ttfb ?? 0} ms`} />
                    <Row k={t('bdt.dcl')} v={`${state.perf.domReady ?? 0} ms`} />
                    <Row k={t('bdt.load')} v={`${state.perf.load ?? 0} ms`} />
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-[#525252] py-6 text-center">{t('bdt.empty_perf')}</p>
              )}
            </div>
          )}

          {/* ═══ Device ═══ */}
          {tab === 'device' && (
            <div className="h-full overflow-y-auto overscroll-contain p-3">
              {state.meta ? (
                <div className="rounded-xl bg-[#141414] border border-[#262626] px-3 py-1">
                  <Row k={t('bdt.viewport')} v={`${state.meta.viewport?.[0]} × ${state.meta.viewport?.[1]} css px`} />
                  <Row k={t('bdt.dpr')} v={String(state.meta.dpr)} />
                  <Row k={t('bdt.touch')} v={state.meta.touch ? '✓' : '—'} />
                  <Row k={t('bdt.lang')} v={state.meta.lang || '—'} />
                  <Row k={t('bdt.connection')} v={state.meta.online ? t('bdt.online') : t('bdt.offline')} />
                  <Row k={t('bdt.ua')} v={state.meta.ua || '—'} />
                </div>
              ) : (
                <p className="text-[12px] text-[#525252] py-6 text-center">{t('bdt.empty_device')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
