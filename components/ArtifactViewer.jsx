'use client'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'

export default function ArtifactViewer({ artifact, onClose }) {
  const iframeRef = useRef(null)
  const [activeTab, setActiveTab] = useState('preview')
  const [mermaidLoaded, setMermaidLoaded] = useState(false)
  const [activeFile, setActiveFile] = useState(null)
  const [deploying, setDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState(null)
  const [showDeployDialog, setShowDeployDialog] = useState(false)
  const [projectName, setProjectName] = useState('')

  const isProject = artifact?.type === 'project'
  const canDeploy = artifact?.type === 'project' || artifact?.type === 'html'

  // Set default active file for projects
  useEffect(() => {
    if (isProject && artifact?.files?.length) {
      if (!activeFile || !artifact.files.find(f => f.path === activeFile)) {
        setActiveFile(artifact.files[0]?.path)
      }
    }
  }, [artifact, isProject, activeFile])

  // Reset deploy state when artifact changes
  useEffect(() => {
    setDeployResult(null)
    setShowDeployDialog(false)
    if (artifact?.title) {
      setProjectName(artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30))
    }
  }, [artifact])

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

  // Build iframe content for project type (inline all CSS/JS)
  const projectIframeSrc = useMemo(() => {
    if (!isProject || !artifact?.files?.length) return null
    const indexFile = artifact.files.find(f => f.path === 'index.html' || f.path.endsWith('/index.html'))
    if (!indexFile) return null

    let html = indexFile.content
    // Inline CSS files
    for (const file of artifact.files) {
      if (file.path.endsWith('.css')) {
        const cssLinkPattern = new RegExp(`<link[^>]*href=["']\\.?\\/?${file.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'g')
        html = html.replace(cssLinkPattern, `<style>/* ${file.path} */\n${file.content}\n</style>`)
        // Also try relative path
        const fileName = file.path.split('/').pop()
        const relPattern = new RegExp(`<link[^>]*href=["']\\.?\\/?${fileName}["'][^>]*>`, 'g')
        html = html.replace(relPattern, `<style>/* ${file.path} */\n${file.content}\n</style>`)
      }
    }
    // Inline JS files
    for (const file of artifact.files) {
      if (file.path.endsWith('.js') && !file.path.endsWith('.min.js')) {
        const jsLinkPattern = new RegExp(`<script[^>]*src=["']\\.?\\/?${file.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>\\s*</script>`, 'g')
        html = html.replace(jsLinkPattern, `<script>/* ${file.path} */\n${file.content}\n</script>`)
        const fileName = file.path.split('/').pop()
        const relPattern = new RegExp(`<script[^>]*src=["']\\.?\\/?${fileName}["'][^>]*>\\s*</script>`, 'g')
        html = html.replace(relPattern, `<script>/* ${file.path} */\n${file.content}\n</script>`)
      }
    }
    return html
  }, [artifact, isProject])

  // Build the iframe srcdoc for single-file artifacts
  const iframeSrcDoc = useMemo(() => {
    if (isProject) return projectIframeSrc
    const { type, code } = artifact || {}
    if (type === 'html') return code
    if (type === 'svg') {
      return `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111;}</style></head><body>${code}</body></html>`
    }
    if (type === 'markdown') {
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
  }, [artifact, isProject, projectIframeSrc])

  // Deploy handler
  const handleDeploy = useCallback(async () => {
    if (!projectName) return
    setDeploying(true)
    setDeployResult(null)

    try {
      let files
      if (isProject) {
        files = artifact.files
      } else {
        files = [{ path: 'index.html', content: artifact.code }]
      }

      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: projectName, files }),
      })
      const data = await res.json()
      setDeployResult(data)
    } catch (err) {
      setDeployResult({ success: false, error: err.message })
    } finally {
      setDeploying(false)
    }
  }, [projectName, artifact, isProject])

  if (!artifact) return null

  const { type, title, code, files } = artifact
  const activeFileData = isProject ? files?.find(f => f.path === activeFile) : null
  const showIframe = activeTab === 'preview' && (type === 'html' || type === 'svg' || type === 'markdown' || type === 'mermaid' || type === 'project')

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f] border-l border-[#181818]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#181818] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center text-red-400 shrink-0">
            {(type === 'html' || type === 'project') && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 18 2-2-2-2"/><path d="m8 18-2-2 2-2"/><path d="m14 4-4 16"/></svg>}
            {type === 'svg' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>}
            {type === 'mermaid' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="16 3 21 9 16 21"/><polygon points="8 3 3 9 8 21"/></svg>}
            {type === 'markdown' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>}
          </div>
          <h3 className="text-sm font-medium text-white/90 truncate">{title || 'Untitled Artifact'}</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#525252] uppercase tracking-wider font-medium">{type === 'project' ? `${files?.length || 0} files` : type}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Deploy button */}
          {canDeploy && (
            <button
              onClick={() => setShowDeployDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:from-orange-400 hover:to-rose-400 transition-all mr-1"
              title="Deploy to Cloudflare Pages"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
              Deploy
            </button>
          )}

          {/* Tab buttons */}
          <div className="flex bg-[#141414] rounded-lg p-0.5 mr-2">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${activeTab === 'preview' ? 'bg-[#1f1f1f] text-white' : 'text-[#525252] hover:text-[#888]'}`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${activeTab === 'code' ? 'bg-[#1f1f1f] text-white' : 'text-[#525252] hover:text-[#888]'}`}
            >
              Code
            </button>
          </div>

          {/* Copy button */}
          <button
            onClick={() => navigator.clipboard.writeText(isProject ? (activeFileData?.content || '') : code)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#525252] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            title="Copy code"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#525252] hover:text-white hover:bg-[#1a1a1a] transition-colors"
              title="Close artifact"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Deploy Dialog */}
      {showDeployDialog && (
        <div className="px-4 py-3 border-b border-[#181818] bg-[#141414] shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))}
              placeholder="project-name"
              className="flex-1 px-3 py-1.5 text-sm bg-[#0f0f0f] border border-[#2a2a2a] rounded-md text-white placeholder-[#444] focus:outline-none focus:border-orange-500/50"
              disabled={deploying}
            />
            <span className="text-[11px] text-[#525252]">.pages.dev</span>
            <button
              onClick={handleDeploy}
              disabled={deploying || !projectName}
              className="px-4 py-1.5 text-[11px] font-medium rounded-md bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:from-orange-400 hover:to-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {deploying ? 'Deploying...' : 'Deploy'}
            </button>
            <button
              onClick={() => { setShowDeployDialog(false); setDeployResult(null) }}
              className="px-2 py-1.5 text-[11px] text-[#525252] hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
          {deployResult?.success && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-green-400">Live at:</span>
              <a href={deployResult.url} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">{deployResult.url}</a>
              <button
                onClick={() => navigator.clipboard.writeText(deployResult.url)}
                className="text-[10px] px-2 py-0.5 rounded bg-[#1a1a1a] text-[#525252] hover:text-white transition-colors"
              >
                Copy
              </button>
            </div>
          )}
          {deployResult?.error && (
            <div className="mt-2 text-sm text-red-400">{deployResult.error}</div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* File tree for project type */}
        {isProject && (
          <div className="w-48 shrink-0 border-r border-[#181818] overflow-y-auto">
            <div className="px-3 py-2 text-[10px] font-semibold text-[#525252] uppercase tracking-wider">Files</div>
            {files?.map(file => (
              <button
                key={file.path}
                onClick={() => setActiveFile(file.path)}
                className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors flex items-center gap-2 ${
                  activeFile === file.path ? 'bg-[#1f1f1f] text-white' : 'text-[#888] hover:text-white hover:bg-[#141414]'
                }`}
              >
                <span className="shrink-0">
                  {file.path.endsWith('.html') && <span className="text-orange-400">&#60;/&#62;</span>}
                  {file.path.endsWith('.css') && <span className="text-blue-400">#</span>}
                  {file.path.endsWith('.js') && <span className="text-yellow-400">JS</span>}
                  {file.path.endsWith('.json') && <span className="text-green-400">{ }</span>}
                  {!file.path.match(/\.(html|css|js|json)$/) && <span className="text-[#525252]">&#8226;</span>}
                </span>
                <span className="truncate">{file.path}</span>
              </button>
            ))}
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'preview' && showIframe ? (
            <div className="h-full">
              {(iframeSrcDoc || type === 'mermaid') && (
                <iframe
                  ref={iframeRef}
                  srcDoc={type === 'mermaid' ? undefined : iframeSrcDoc}
                  className="w-full h-full border-0 bg-[#111]"
                  sandbox="allow-scripts allow-same-origin"
                  title={title}
                />
              )}
            </div>
          ) : (
            <div className="h-full overflow-auto p-4">
              {isProject && activeFileData ? (
                <div>
                  <div className="mb-2 text-[11px] text-[#525252] font-mono">{activeFileData.path}</div>
                  <pre className="text-sm text-[#a1a1a1] font-mono whitespace-pre-wrap leading-relaxed">
                    <code>{activeFileData.content}</code>
                  </pre>
                </div>
              ) : (
                <pre className="text-sm text-[#a1a1a1] font-mono whitespace-pre-wrap leading-relaxed">
                  <code>{code}</code>
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
