'use client'
import { useState, useRef, useEffect, useMemo } from 'react'

/**
 * ArtifactViewer — Renders code artifacts in a side panel (like Claude Artifacts)
 *
 * Supported artifact types:
 * - html: Complete HTML pages rendered in a sandboxed iframe
 * - svg: SVG graphics rendered directly
 * - mermaid: Mermaid diagrams rendered via mermaid.js CDN
 * - markdown: Rich markdown rendered as HTML
 * - react: React JSX (rendered as static HTML preview for safety)
 */
export default function ArtifactViewer({ artifact, onClose }) {
  const iframeRef = useRef(null)
  const [activeTab, setActiveTab] = useState('preview') // 'preview' | 'code'
  const [mermaidLoaded, setMermaidLoaded] = useState(false)

  // Load mermaid.js if needed
  useEffect(() => {
    if (artifact?.type === 'mermaid' && !mermaidLoaded) {
      if (typeof window !== 'undefined' && !window.mermaid) {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js'
        script.onload = () => {
          window.mermaid.initialize({ startOnLoad: false, theme: 'dark' })
          setMermaidLoaded(true)
        }
        document.head.appendChild(script)
      } else {
        setMermaidLoaded(true)
      }
    }
  }, [artifact?.type, mermaidLoaded])

  // Render mermaid diagrams
  useEffect(() => {
    if (artifact?.type === 'mermaid' && mermaidLoaded && iframeRef.current) {
      try {
        window.mermaid.render('mermaid-artifact-' + Date.now(), artifact.code).then(({ svg }) => {
          const doc = iframeRef.current.contentDocument
          if (doc) {
            doc.open()
            doc.write(`<!DOCTYPE html><html><head><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111;color:#e2e2e2;font-family:sans-serif;}</style></head><body>${svg}</body></html>`)
            doc.close()
          }
        }).catch(() => {})
      } catch {}
    }
  }, [artifact, mermaidLoaded])

  if (!artifact) return null

  const { type, title, code } = artifact

  // Build the iframe srcdoc for HTML artifacts
  const iframeSrcDoc = useMemo(() => {
    if (type === 'html') {
      return code
    }
    if (type === 'svg') {
      return `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111;}</style></head><body>${code}</body></html>`
    }
    if (type === 'markdown') {
      // Simple markdown-to-HTML conversion
      let html = code
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background:#222;padding:2px 6px;border-radius:4px;">$1</code>')
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#1a1a1a;padding:12px;border-radius:8px;overflow-x:auto;"><code>$2</code></pre>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#60a5fa;">$1</a>')
        .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #333;margin-left:0;padding-left:12px;color:#888;">$1</blockquote>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br />')

      return `<!DOCTYPE html><html><head><style>body{margin:0;padding:24px;background:#111;color:#e2e2e2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;max-width:680px;}h1,h2,h3{margin-top:1.5em;color:#fff;}a{color:#60a5fa;}pre{background:#1a1a1a;padding:12px;border-radius:8px;overflow-x:auto;}code{background:#1a1a1a;padding:2px 6px;border-radius:4px;font-size:0.9em;}blockquote{border-left:3px solid #333;margin-left:0;padding-left:12px;color:#888;}</style></head><body><p>${html}</p></body></html>`
    }
    return null
  }, [type, code])

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f] border-l border-[#181818]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#181818] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center text-red-400 shrink-0">
            {type === 'html' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 18 2-2-2-2"/><path d="m8 18-2-2 2-2"/><path d="m14 4-4 16"/></svg>}
            {type === 'svg' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>}
            {type === 'mermaid' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="16 3 21 9 16 21"/><polygon points="8 3 3 9 8 21"/></svg>}
            {type === 'markdown' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>}
          </div>
          <h3 className="text-sm font-medium text-white/90 truncate">{title || 'Untitled Artifact'}</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#525252] uppercase tracking-wider font-medium">{type}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Tab buttons */}
          <div className="flex bg-[#141414] rounded-lg p-0.5 mr-2">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                activeTab === 'preview' ? 'bg-[#1f1f1f] text-white' : 'text-[#525252] hover:text-[#888]'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                activeTab === 'code' ? 'bg-[#1f1f1f] text-white' : 'text-[#525252] hover:text-[#888]'
              }`}
            >
              Code
            </button>
          </div>

          {/* Copy button */}
          <button
            onClick={() => navigator.clipboard.writeText(code)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#525252] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            title="Copy code"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#525252] hover:text-white hover:bg-[#1a1a1a] transition-colors"
              title="Close artifact"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' ? (
          <div className="h-full">
            {(type === 'html' || type === 'svg' || type === 'markdown') && iframeSrcDoc && (
              <iframe
                ref={iframeRef}
                srcDoc={iframeSrcDoc}
                className="w-full h-full border-0 bg-[#111]"
                sandbox="allow-scripts allow-same-origin"
                title={title}
              />
            )}
            {type === 'mermaid' && (
              <iframe
                ref={iframeRef}
                className="w-full h-full border-0 bg-[#111]"
                title={title}
              />
            )}
          </div>
        ) : (
          <div className="h-full overflow-auto p-4">
            <pre className="text-sm text-[#a1a1a1] font-mono whitespace-pre-wrap leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
