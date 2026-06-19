'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

/* ═══════════════════════════════════════════════════════════════
   CodePreviewCard — Tabbed code + live preview (Replit/Claude/Bolt-style)

   Features:
   - Browser-chrome top bar (traffic lights + filename + Copy/Run buttons)
   - Tab bar: HTML / CSS / JS / Preview (only tabs with content are shown)
   - Code panel: line numbers + syntax highlighting + monospace
   - Preview panel: live iframe (sandboxed) rendering HTML+CSS+JS
   - Copy button with tooltip + success state
   - Run button → switches to Preview tab + reloads iframe
   - Keyboard shortcuts: Cmd/Ctrl+1..4 to switch tabs, Cmd/Ctrl+Enter to run,
     Cmd/Ctrl+C (when in a code tab) to copy
   - Responsive: stacks vertically on mobile when both code & preview are open
   ═══════════════════════════════════════════════════════════════ */

const TAB_META = {
  html:    { label: 'HTML',       icon: 'H', iconBg: '#e34c26', iconColor: '#fff', filename: 'index.html' },
  css:     { label: 'CSS',        icon: 'C', iconBg: '#264de4', iconColor: '#fff', filename: 'style.css' },
  js:      { label: 'JavaScript', icon: 'J', iconBg: '#f7df1e', iconColor: '#323330', filename: 'script.js' },
  preview: { label: 'Preview',    icon: null, iconBg: null, iconColor: null, filename: 'Live Preview' },
}

// ── Tiny syntax highlighter (returns React spans, not HTML strings, to avoid XSS) ──
function highlightCode(code, lang) {
  if (!code) return []
  const lines = code.split('\n')
  return lines.map((line, lineIdx) => {
    const tokens = tokenizeLine(line, lang)
    return (
      <div key={lineIdx} className="cpc-code-line">
        {tokens.length === 0 ? '\u00A0' : tokens}
      </div>
    )
  })
}

function tokenizeLine(line, lang) {
  if (!line) return []
  const out = []
  // Naive but safe tokenizer — uses regex splits + colored spans.
  // Everything not matched is rendered as default text (no injection risk).
  if (lang === 'html') {
    // Match tags, attributes, strings, comments
    const re = /(<!--[\s\S]*?-->)|(<\/?[\w-]+)|([\w-]+)(=)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(<\/?>)|([^<]+)/g
    let m, last = 0
    while ((m = re.exec(line)) !== null) {
      if (m[1]) out.push(<span key={out.length} className="tok-comment">{m[1]}</span>)
      else if (m[2]) out.push(<span key={out.length} className="tok-tag">{m[2]}</span>)
      else if (m[3]) {
        out.push(<span key={out.length} className="tok-attr">{m[3]}</span>)
        out.push(<span key={out.length} className="tok-op">{m[4]}</span>)
        out.push(<span key={out.length} className="tok-string">{m[5]}</span>)
      } else if (m[6]) out.push(<span key={out.length} className="tok-tag">{m[6]}</span>)
      else if (m[7]) out.push(<span key={out.length}>{m[7]}</span>)
    }
  } else if (lang === 'css') {
    const re = /(\/\*[\s\S]*?\*\/)|([.#]?[\w-]+)(\s*\{)|([\w-]+)(\s*:)|(,[^{};]*;)|([^{};]+)/g
    let m
    while ((m = re.exec(line)) !== null) {
      if (m[1]) out.push(<span key={out.length} className="tok-comment">{m[1]}</span>)
      else if (m[2]) {
        out.push(<span key={out.length} className="tok-selector">{m[2]}</span>)
        out.push(<span key={out.length}>{m[3]}</span>)
      } else if (m[4]) {
        out.push(<span key={out.length} className="tok-property">{m[4]}</span>)
        out.push(<span key={out.length}>{m[5]}</span>)
      } else if (m[6]) out.push(<span key={out.length} className="tok-value">{m[6]}</span>)
      else if (m[7]) out.push(<span key={out.length} className="tok-value">{m[7]}</span>)
    }
  } else if (lang === 'js') {
    const re = /(\/\/.*$)|(\/\*[\s\S]*?\*\/)|(\b(?:const|let|var|function|return|if|else|for|while|class|new|await|async|import|export|from|default|try|catch|finally|throw|typeof|instanceof|in|of|break|continue|switch|case)\b)|(\b\d+(?:\.\d+)?\b)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|([A-Za-z_$][\w$]*)(\s*\()|([A-Za-z_$][\w$]*)|([+\-*/%=<>!&|?:]+)/g
    let m
    while ((m = re.exec(line)) !== null) {
      if (m[1]) out.push(<span key={out.length} className="tok-comment">{m[1]}</span>)
      else if (m[2]) out.push(<span key={out.length} className="tok-comment">{m[2]}</span>)
      else if (m[3]) out.push(<span key={out.length} className="tok-keyword">{m[3]}</span>)
      else if (m[4]) out.push(<span key={out.length} className="tok-number">{m[4]}</span>)
      else if (m[5]) out.push(<span key={out.length} className="tok-string">{m[5]}</span>)
      else if (m[6]) {
        out.push(<span key={out.length} className="tok-function">{m[6]}</span>)
        out.push(<span key={out.length}>{m[7]}</span>)
      } else if (m[8]) out.push(<span key={out.length}>{m[8]}</span>)
      else if (m[9]) out.push(<span key={out.length} className="tok-op">{m[9]}</span>)
    }
  } else {
    out.push(<span key={0}>{line}</span>)
  }
  return out
}

function buildPreviewDoc(html, css, js) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${css || ''}
</style>
</head>
<body>
${html || ''}
<script>
try {
${js || ''}
} catch (e) { console.error(e); }
<\/script>
</body>
</html>`
}

export default function CodePreviewCard({ html, css, js, url, projectName }) {
  // Determine which tabs to show
  const tabs = useMemo(() => {
    const t = []
    if (html && html.trim()) t.push('html')
    if (css && css.trim()) t.push('css')
    if (js && js.trim()) t.push('js')
    t.push('preview')
    return t
  }, [html, css, js])

  const [activeTab, setActiveTab] = useState(tabs[0] || 'preview')
  const [copied, setCopied] = useState(false)
  const [runNonce, setRunNonce] = useState(0)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [inView, setInView] = useState(false)
  const containerRef = useRef(null)

  // If tab list changes (e.g. new deploy with different file set) and active tab
  // is no longer present, switch to the first available tab.
  useEffect(() => {
    if (!tabs.includes(activeTab)) setActiveTab(tabs[0] || 'preview')
  }, [tabs, activeTab])

  // Lazy-load preview iframe only when in view (saves bandwidth + CPU)
  useEffect(() => {
    if (!containerRef.current || inView) return
    const el = containerRef.current
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { setInView(true); io.disconnect(); break }
        }
      },
      { rootMargin: '200px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView])

  // Reset iframeLoaded when preview source changes
  useEffect(() => { setIframeLoaded(false) }, [html, css, js, url, runNonce])

  const previewSrc = useMemo(() => {
    // Prefer the live deploy URL when available; otherwise build a sandboxed
    // doc from the html/css/js props so the user can still see a preview even
    // before deploy (or when deploy failed).
    if (url) return url
    return buildPreviewDoc(html, css, js)
  }, [url, html, css, js])

  const currentCode = useMemo(() => {
    if (activeTab === 'html') return html
    if (activeTab === 'css') return css
    if (activeTab === 'js') return js
    return ''
  }, [activeTab, html, css, js])

  const handleCopy = useCallback(() => {
    if (!currentCode) return
    try {
      navigator.clipboard.writeText(currentCode).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    } catch {
      // Clipboard API can fail in non-secure contexts
      const ta = document.createElement('textarea')
      ta.value = currentCode
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
      document.body.removeChild(ta)
    }
  }, [currentCode])

  const handleRun = useCallback(() => {
    setActiveTab('preview')
    setRunNonce((n) => n + 1)
  }, [])

  // Keyboard shortcuts: Cmd/Ctrl+1..4 to switch tabs, Cmd/Ctrl+Enter to run
  useEffect(() => {
    const handler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 'Enter') { e.preventDefault(); handleRun(); return }
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= tabs.length) {
        e.preventDefault()
        setActiveTab(tabs[num - 1])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tabs, handleRun])

  const lineCount = currentCode ? currentCode.split('\n').length : 0
  const headerTitle = activeTab === 'preview'
    ? (projectName ? `${projectName}.pages.dev` : 'Live Preview')
    : (TAB_META[activeTab]?.filename || 'code')

  return (
    <div ref={containerRef} className="cpc-card">
      {/* ── Header: traffic lights + filename + actions ── */}
      <div className="cpc-header">
        <div className="cpc-traffic">
          <span className="cpc-dot cpc-dot-red" />
          <span className="cpc-dot cpc-dot-yellow" />
          <span className="cpc-dot cpc-dot-green" />
        </div>
        <span className="cpc-title" title={headerTitle}>{headerTitle}</span>
        <div className="cpc-actions">
          {activeTab !== 'preview' && (
            <button
              type="button"
              className={`cpc-action-btn ${copied ? 'cpc-action-btn-success' : ''}`}
              onClick={handleCopy}
              aria-label="Copy code"
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          <button
            type="button"
            className="cpc-action-btn cpc-action-btn-primary"
            onClick={handleRun}
            aria-label="Run / switch to preview"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="cpc-tab-bar">
        {tabs.map((t) => {
          const meta = TAB_META[t]
          const isActive = activeTab === t
          return (
            <button
              key={t}
              type="button"
              className={`cpc-tab ${isActive ? 'cpc-tab-active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {meta.icon && (
                <span
                  className="cpc-tab-icon"
                  style={{ background: meta.iconBg, color: meta.iconColor }}
                >
                  {meta.icon}
                </span>
              )}
              {t === 'preview' && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
              {meta.label}
            </button>
          )
        })}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="cpc-external-link"
            title="Open in new tab"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open
          </a>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="cpc-content">
        {activeTab === 'preview' ? (
          <div className="cpc-preview-panel">
            {inView ? (
              <>
                {!iframeLoaded && (
                  <div className="cpc-preview-shimmer">
                    <div className="cpc-shimmer-bar" />
                    <div className="cpc-shimmer-block" />
                    <div className="cpc-shimmer-block" />
                  </div>
                )}
                <iframe
                  key={runNonce}
                  src={previewSrc}
                  className="cpc-iframe"
                  title="Site preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  onLoad={() => setIframeLoaded(true)}
                />
                {url && (
                  <div className="cpc-preview-footer">
                    <span className="cpc-live-badge">
                      <span className="cpc-live-dot" />
                      Live
                    </span>
                    <span className="cpc-url-text" title={url}>{url}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="cpc-preview-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>Preview loads when scrolled into view</span>
              </div>
            )}
          </div>
        ) : (
          <div className="cpc-code-panel">
            <div className="cpc-line-numbers">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i} className="cpc-line-num">{i + 1}</div>
              ))}
            </div>
            <pre className="cpc-code">
              <code>
                {highlightCode(currentCode, activeTab)}
              </code>
            </pre>
          </div>
        )}
      </div>

      <style jsx>{`
        .cpc-card {
          width: 100%;
          max-width: 900px;
          background: #1a1a2e;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          margin: 12px 0;
        }

        /* Header */
        .cpc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          background: #16162a;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          gap: 12px;
        }
        .cpc-traffic {
          display: flex;
          gap: 7px;
        }
        .cpc-dot {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          cursor: default;
          transition: opacity 0.2s;
        }
        .cpc-dot:hover { opacity: 0.7; }
        .cpc-dot-red { background: #ff5f56; }
        .cpc-dot-yellow { background: #ffbd2e; }
        .cpc-dot-green { background: #27c93f; }
        .cpc-title {
          color: #a0a0b0;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.3px;
          flex: 1;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
        }
        .cpc-actions {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .cpc-action-btn {
          background: rgba(255, 255, 255, 0.06);
          border: none;
          color: #a0a0b0;
          padding: 5px 11px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: inherit;
        }
        .cpc-action-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }
        .cpc-action-btn-primary {
          background: rgba(220, 38, 38, 0.15);
          color: #fca5a5;
        }
        .cpc-action-btn-primary:hover {
          background: rgba(220, 38, 38, 0.25);
          color: #fff;
        }
        .cpc-action-btn-success {
          background: rgba(39, 201, 63, 0.15);
          color: #86efac;
        }

        /* Tab bar */
        .cpc-tab-bar {
          display: flex;
          background: #13132a;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding: 0 8px;
          align-items: center;
          gap: 2px;
        }
        .cpc-tab {
          padding: 9px 14px;
          color: #6b6b8a;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          background: transparent;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: inherit;
          margin-bottom: -1px;
        }
        .cpc-tab:hover { color: #a0a0b0; }
        .cpc-tab-active {
          color: #e0e0f0;
          border-bottom-color: #dc2626;
        }
        .cpc-tab-icon {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 700;
          line-height: 1;
        }
        .cpc-external-link {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: 6px;
          color: #a0a0b0;
          font-size: 11px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.15s;
        }
        .cpc-external-link:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }

        /* Content area */
        .cpc-content {
          min-height: 380px;
          max-height: 560px;
          overflow: hidden;
          position: relative;
          display: flex;
        }

        /* Code panel */
        .cpc-code-panel {
          flex: 1;
          background: #0d0d1a;
          display: flex;
          overflow: auto;
          width: 100%;
        }
        .cpc-line-numbers {
          padding: 16px 12px 16px 16px;
          color: #4a4a6a;
          font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 12.5px;
          line-height: 1.7;
          user-select: none;
          text-align: right;
          background: #0a0a14;
          border-right: 1px solid rgba(255, 255, 255, 0.04);
          flex-shrink: 0;
        }
        .cpc-line-num {
          height: calc(12.5px * 1.7);
        }
        .cpc-code {
          margin: 0;
          padding: 16px 20px;
          font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 12.5px;
          line-height: 1.7;
          color: #d4d4d8;
          flex: 1;
          white-space: pre;
          overflow-x: auto;
        }
        .cpc-code-line {
          min-height: calc(12.5px * 1.7);
        }

        /* Syntax tokens */
        :global(.tok-tag) { color: #ff79c6; }
        :global(.tok-attr) { color: #50fa7b; }
        :global(.tok-string) { color: #f1fa8c; }
        :global(.tok-comment) { color: #6272a4; font-style: italic; }
        :global(.tok-selector) { color: #ff79c6; }
        :global(.tok-property) { color: #8be9fd; }
        :global(.tok-value) { color: #bd93f9; }
        :global(.tok-keyword) { color: #ff79c6; }
        :global(.tok-function) { color: #50fa7b; }
        :global(.tok-number) { color: #bd93f9; }
        :global(.tok-op) { color: #ff79c6; }

        /* Preview panel */
        .cpc-preview-panel {
          flex: 1;
          background: #fff;
          width: 100%;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .cpc-iframe {
          width: 100%;
          flex: 1;
          min-height: 380px;
          border: none;
          background: #fff;
        }
        .cpc-preview-shimmer {
          position: absolute;
          inset: 0;
          background: #1a1a2e;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 24px;
          z-index: 1;
        }
        .cpc-shimmer-bar {
          height: 14px;
          width: 40%;
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.10), rgba(255,255,255,0.04));
          background-size: 200% 100%;
          border-radius: 6px;
          animation: cpc-shimmer 1.4s ease-in-out infinite;
        }
        .cpc-shimmer-block {
          height: 80px;
          background: linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08), rgba(255,255,255,0.03));
          background-size: 200% 100%;
          border-radius: 8px;
          animation: cpc-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes cpc-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .cpc-preview-placeholder {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: #0d0d1a;
          color: #4a4a6a;
          font-size: 12px;
        }
        .cpc-preview-footer {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          background: #0d0d1a;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 11px;
          color: #6b6b8a;
        }
        .cpc-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(39, 201, 63, 0.12);
          color: #4ade80;
          font-weight: 600;
          font-size: 10px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .cpc-live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4ade80;
          animation: cpc-live-pulse 1.6s ease-in-out infinite;
        }
        @keyframes cpc-live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .cpc-url-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }

        /* Mobile: stack code/preview vertically */
        @media (max-width: 640px) {
          .cpc-content { flex-direction: column; max-height: 700px; }
          .cpc-code-panel, .cpc-preview-panel { width: 100%; }
          .cpc-code-panel { border-right: none; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
          .cpc-iframe { min-height: 280px; }
        }
      `}</style>
    </div>
  )
}
