'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Highlight, themes } from 'prism-react-renderer'

/* ─── Language Labels ──────────────────────────────────────────── */
const LANG_LABELS = {
  js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX',
  py: 'Python', python: 'Python', rb: 'Ruby', ruby: 'Ruby',
  go: 'Go', rust: 'Rust', java: 'Java', cpp: 'C++', c: 'C',
  cs: 'C#', php: 'PHP', swift: 'Swift', kotlin: 'Kotlin',
  sql: 'SQL', html: 'HTML', css: 'CSS', scss: 'SCSS',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML',
  xml: 'XML', markdown: 'Markdown', md: 'Markdown',
  bash: 'Bash', sh: 'Shell', shell: 'Shell', zsh: 'Zsh',
  dockerfile: 'Dockerfile', makefile: 'Makefile',
  diff: 'Diff', graphql: 'GraphQL',
  typescriptreact: 'TSX', javascriptreact: 'JSX',
}

function getLangLabel(className) {
  if (!className) return null
  const match = className.match(/language-(\w+)/)
  if (!match) return null
  return LANG_LABELS[match[1].toLowerCase()] || match[1].charAt(0).toUpperCase() + match[1].slice(1)
}

/* ─── Language ID Mapping (Judge0) ─────────────────────────────── */
function getLangId(className) {
  if (!className) return null
  const match = className.match(/language-(\w+)/)
  if (!match) return null
  const lang = match[1].toLowerCase()
  const map = {
    js: 63, javascript: 63, jsx: 63,
    ts: 74, typescript: 74, tsx: 74,
    py: 71, python: 71,
    java: 62, cpp: 54, c: 50,
    go: 60, rust: 73,
    rb: 72, ruby: 72,
    php: 68,
    bash: 46, sh: 46, shell: 46,
    sql: 82,
  }
  return map[lang] || null
}

/* ─── Prism language mapping ───────────────────────────────────── */
function getPrismLang(className) {
  if (!className) return 'javascript'
  const match = className.match(/language-(\w+)/)
  if (!match) return 'javascript'
  const map = {
    js: 'javascript', javascript: 'javascript', jsx: 'jsx',
    ts: 'typescript', typescript: 'typescript', tsx: 'tsx',
    py: 'python', python: 'python',
    rb: 'ruby', ruby: 'ruby',
    go: 'go', rust: 'rust',
    java: 'java', cpp: 'cpp', c: 'c',
    cs: 'csharp', php: 'php',
    swift: 'swift', kotlin: 'kotlin',
    sql: 'sql', html: 'markup', css: 'css',
    json: 'json', yaml: 'yaml', yml: 'yaml',
    bash: 'bash', sh: 'bash', shell: 'bash', zsh: 'bash',
    diff: 'diff', graphql: 'graphql',
    markdown: 'markdown', md: 'markdown',
  }
  return map[match[1].toLowerCase()] || 'javascript'
}

/* ─── Extract text from HAST node (react-markdown v10) ─────────── */
function extractTextFromNode(node) {
  if (!node) return ''
  if (node.type === 'text') return node.value || ''
  if (node.children) return node.children.map(extractTextFromNode).join('')
  return ''
}

/* ─── Judge0 status helpers ────────────────────────────────────── */
const STATUS_OK = new Set([3, 4])
const STATUS_ERROR = new Set([6, 7, 8, 9, 10, 11, 12, 13, 14])

/* ─── Custom VS Code Dark+ theme for prism-react-renderer ─────── */
const kivoraTheme = {
  plain: {
    color: 'rgba(255,255,255,0.85)',
    backgroundColor: '#1E1E1E',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#6A9955' } },
    { types: ['punctuation'], style: { color: 'rgba(255,255,255,0.6)' } },
    { types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol'], style: { color: '#B5CEA8' } },
    { types: ['selector', 'attr-name', 'string', 'char', 'builtin'], style: { color: '#CE9178' } },
    { types: ['operator', 'entity', 'url'], style: { color: 'rgba(255,255,255,0.7)' } },
    { types: ['atrule', 'attr-value', 'keyword'], style: { color: '#C586C0' } },
    { types: ['function', 'class-name'], style: { color: '#DCDCAA' } },
    { types: ['regex', 'important', 'variable'], style: { color: '#9CDCFE' } },
    { types: ['decorator'], style: { color: '#4EC9B0' } },
    { types: ['inserted'], style: { color: '#4EC9B0' } },
    { types: ['deleted'], style: { color: '#CE9178' } },
  ],
}

/* ─── Detect if code is browser-previewable (HTML/CSS/JS) ─────── */
function isBrowserPreviewable(className, codeText) {
  if (!className) return false
  const match = className.match(/language-(\w+)/)
  if (!match) return false
  const lang = match[1].toLowerCase()
  // HTML is always previewable
  if (lang === 'html') return true
  // CSS alone isn't really previewable without HTML
  if (lang === 'css') return false
  // JS/JSX/TS/TSX - check if it contains HTML-like content (DOM manipulation)
  if (['js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx'].includes(lang)) {
    // Only if it contains document.write or innerHTML or creates HTML
    return /document\.write|innerHTML|createElement|\.append\(|\.prepend\(|\.replaceWith\(/i.test(codeText)
  }
  return false
}

/* ─── Syntax-Highlighted Code ──────────────────────────────────── */
function SyntaxCode({ code, language }) {
  return (
    <Highlight theme={kivoraTheme} code={code} language={language}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className="font-['SF_Mono',_Fira_Code,_'Courier_New',_monospace] text-[13px] leading-[1.55] overflow-x-auto whitespace-pre"
          style={{ ...style, background: 'transparent', margin: 0, padding: 0 }}
        >
          {tokens.map((line, i) => {
            const lineProps = getLineProps({ line, key: i })
            return (
              <div key={i} {...lineProps} className={lineProps.className || ''} style={{ ...lineProps.style, background: 'transparent' }}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token, key })} />
                ))}
                {line.length === 0 && '\n'}
              </div>
            )
          })}
        </pre>
      )}
    </Highlight>
  )
}

/* ─── Code Block — Full preview, split view with Console ──────── */
function CodeBlock({ langLabel, codeText, codeClassName }) {
  const [copied, setCopied] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [codeExpanded, setCodeExpanded] = useState(false)
  const iframeRef = useRef(null)

  const langId = getLangId(codeClassName)
  const prismLang = getPrismLang(codeClassName)
  const canPreview = isBrowserPreviewable(codeClassName, codeText)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [codeText])

  const handleRun = async () => {
    if (!langId) return
    setRunning(true)
    setRunResult(null)
    setDetailsOpen(false)
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_code: codeText, language_id: langId })
      })
      const data = await res.json()
      if (data.error && !data.status) {
        setRunResult({
          status: { id: null, description: 'Error' },
          stderr: data.error,
          stdout: null,
          compile_output: data.details || null,
          exit_code: null, time: null, memory: null
        })
      } else {
        setRunResult(data)
      }
    } catch {
      setRunResult({
        status: { id: null, description: 'Network Error' },
        stderr: 'Could not reach the execution server.',
        stdout: null, compile_output: null,
        exit_code: null, time: null, memory: null
      })
    }
    setRunning(false)
  }

  const handlePreview = () => {
    setPreviewOpen(!previewOpen)
    // After toggling open, inject into iframe on next tick
    if (!previewOpen) {
      setTimeout(() => {
        if (iframeRef.current) {
          const doc = iframeRef.current.contentDocument
          if (doc) {
            doc.open()
            doc.write(codeText)
            doc.close()
          }
        }
      }, 50)
    }
  }

  // Execution result helpers
  const statusId = runResult?.status?.id
  const hasError = runResult && STATUS_ERROR.has(statusId)
  const hasOutput = runResult && (runResult.stdout || runResult.stderr || runResult.compile_output)

  let primaryOutput = ''
  if (runResult) {
    if (hasError) {
      if (runResult.compile_output) primaryOutput += runResult.compile_output
      if (runResult.stderr) primaryOutput += (primaryOutput ? '\n' : '') + runResult.stderr
    } else {
      if (runResult.stdout) primaryOutput = runResult.stdout
      if (runResult.stderr) primaryOutput += (primaryOutput ? '\n' : '') + runResult.stderr
    }
  }

  const hasDetails = runResult && (
    runResult.status?.description || runResult.exit_code != null || runResult.time || runResult.memory
  )

  // Split view: code on left, console on right (for non-browser languages with Run support)
  const showSplitView = langId && !canPreview && runResult

  // Count lines for collapsed preview
  const lineCount = codeText.split('\n').length

  return (
    <div
      className="my-3 overflow-hidden max-w-full"
      style={{
        background: '#1E1E1E',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* ── Header bar ── */}
      <div
        className="flex items-center justify-between"
        style={{
          minHeight: '40px',
          padding: '0 12px',
          borderBottom: codeExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        {/* Left: expand/collapse toggle + language */}
        <button
          onClick={() => setCodeExpanded(!codeExpanded)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          aria-label={codeExpanded ? 'Collapse code' : 'Expand code'}
        >
          <svg
            width="12" height="12" viewBox="0 0 16 16" fill="none"
            stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${codeExpanded ? 'rotate-90' : ''}`}
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {langLabel || 'Code'}
          </span>
          {!codeExpanded && (
            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {lineCount} line{lineCount !== 1 ? 's' : ''}
            </span>
          )}
        </button>
        {/* Right: Copy + Preview (for HTML) + Run (for executable) */}
        <div className="flex items-center" style={{ gap: '8px' }}>
          {/* Copy button */}
          <button
            onClick={copy}
            className="flex items-center justify-center transition-colors duration-200 hover:opacity-80"
            style={{ color: copied ? '#4CAF50' : 'rgba(255,255,255,0.4)' }}
            aria-label="Copy code"
          >
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>

          {/* Preview button (HTML only) */}
          {canPreview && (
            <button
              onClick={handlePreview}
              className="flex items-center gap-1.5 transition-all duration-200"
              style={{
                borderRadius: '6px',
                border: previewOpen ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.15)',
                background: previewOpen ? 'rgba(74,222,128,0.08)' : 'transparent',
                padding: '4px 10px',
                color: previewOpen ? '#4ade80' : 'rgba(255,255,255,0.6)',
                fontSize: '12px',
              }}
              aria-label="Preview in browser"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span>{previewOpen ? 'Hide Preview' : 'Preview'}</span>
            </button>
          )}

          {/* Run button */}
          {langId ? (
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-1.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderRadius: '6px',
                border: runResult ? (hasError ? '1px solid rgba(244,67,54,0.3)' : '1px solid rgba(74,222,128,0.3)') : '1px solid rgba(255,255,255,0.15)',
                background: running ? 'rgba(255,255,255,0.04)' : runResult ? (hasError ? 'rgba(244,67,54,0.06)' : 'rgba(74,222,128,0.06)') : 'transparent',
                padding: '4px 10px',
                color: runResult ? (hasError ? '#ef4444' : '#4ade80') : 'rgba(255,255,255,0.6)',
                fontSize: '12px',
              }}
              aria-label="Run code"
            >
              {running ? (
                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
              )}
              <span>{running ? 'Running...' : runResult ? 'Re-run' : 'Run'}</span>
            </button>
          ) : (
            <button
              disabled
              className="flex items-center gap-1.5 cursor-not-allowed opacity-25"
              style={{
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                padding: '4px 10px',
                color: 'rgba(255,255,255,0.5)',
                fontSize: '12px',
              }}
              title="Language not supported for execution"
              aria-label="Language not supported"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
              <span>Run</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Code body — only shown when expanded ── */}
      {codeExpanded && (
      <>
      {/* ── Code + Console split view (for non-browser languages with run results) ── */}
      {showSplitView ? (
        <div className="flex flex-col sm:flex-row" style={{ minHeight: 0 }}>
          {/* Code panel */}
          <div className="flex-1 min-w-0 overflow-auto" style={{ padding: '12px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <div
              className="overflow-x-auto overscroll-behavior-contain"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.1) transparent',
              }}
            >
              <SyntaxCode code={codeText} language={prismLang} />
            </div>
          </div>
          {/* Console panel */}
          <div className="flex-1 min-w-0 flex flex-col" style={{ background: '#1a1a1a' }}>
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/[0.04] shrink-0">
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Console</span>
              {hasError && <span className="w-1.5 h-1.5 rounded-full bg-[#F44336]" />}
            </div>
            <div
              className="flex-1 overflow-auto font-['SF_Mono',_Fira_Code,_'Courier_New',_monospace] text-[12px] leading-[1.5] whitespace-pre p-3"
              style={{ maxHeight: '300px' }}
            >
              {hasOutput ? (
                <>
                  {runResult.stdout && !hasError && (
                    <span style={{ color: '#4ade80' }}>{runResult.stdout}</span>
                  )}
                  {hasError ? (
                    <span style={{ color: '#F44336' }}>{primaryOutput}</span>
                  ) : (
                    runResult.stderr && (
                      <span style={{ color: '#facc15' }}>{runResult.stderr}</span>
                    )
                  )}
                </>
              ) : (
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>(no output)</span>
              )}
            </div>
            {/* Details footer */}
            {(hasDetails || hasError) && (
              <div className="shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <button
                  onClick={() => setDetailsOpen(!detailsOpen)}
                  className="w-full flex items-center gap-1 px-3 py-1.5 text-[10px] font-mono transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  <svg
                    width="8" height="8" viewBox="0 0 16 16"
                    fill="none" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform ${detailsOpen ? 'rotate-90' : ''}`}
                  >
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                  {hasError ? 'Error Details' : 'Details'}
                </button>
                {detailsOpen && hasDetails && (
                  <div className="px-3 pb-2 space-y-0.5 text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {runResult.status?.description && (
                      <div className="flex gap-2">
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>Status</span>
                        <span style={{ color: hasError ? '#F44336' : STATUS_OK.has(statusId) ? '#4ade80' : '#facc15' }}>
                          {runResult.status.description}
                        </span>
                      </div>
                    )}
                    {runResult.exit_code != null && (
                      <div className="flex gap-2">
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>Exit</span>
                        <span style={{ color: runResult.exit_code !== 0 ? '#F44336' : 'rgba(255,255,255,0.5)' }}>
                          {runResult.exit_code}
                        </span>
                      </div>
                    )}
                    {runResult.time && (
                      <div className="flex gap-2">
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>Time</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{runResult.time}s</span>
                      </div>
                    )}
                    {runResult.memory && (
                      <div className="flex gap-2">
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>Mem</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{(runResult.memory / 1024).toFixed(1)}KB</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Code body only (no split — no run result yet, or HTML with preview) ── */
        <div style={{ padding: '12px' }}>
          <div
            className="overflow-x-auto overscroll-behavior-contain"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.1) transparent',
            }}
          >
            <SyntaxCode code={codeText} language={prismLang} />
          </div>
        </div>
      )}

      </>
      )}

      {/* ── Browser Preview (HTML only) — shown even when code is collapsed ── */}
      {canPreview && previewOpen && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: '#1a1a1a', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Preview</span>
          </div>
          <div style={{ background: '#fff', maxHeight: '400px', overflow: 'auto' }}>
            <iframe
              ref={iframeRef}
              srcDoc={codeText}
              title="Code Preview"
              style={{ width: '100%', minHeight: '200px', maxHeight: '400px', border: 'none', display: 'block' }}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* ── Inline console output (for non-split view — when there's a result but it's HTML or no langId) ── */}
      {!showSplitView && runResult && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: '#1a1a1a', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Console</span>
            {hasError && <span className="w-1.5 h-1.5 rounded-full bg-[#F44336]" />}
          </div>
          <div
            className="font-['SF_Mono',_Fira_Code,_'Courier_New',_monospace] text-[12px] leading-[1.5] overflow-x-auto whitespace-pre p-3"
            style={{ background: '#1a1a1a', maxHeight: '200px', overflow: 'auto' }}
          >
            {hasOutput ? (
              <>
                {runResult.stdout && !hasError && (
                  <span style={{ color: '#4ade80' }}>{runResult.stdout}</span>
                )}
                {hasError ? (
                  <span style={{ color: '#F44336' }}>{primaryOutput}</span>
                ) : (
                  runResult.stderr && (
                    <span style={{ color: '#facc15' }}>{runResult.stderr}</span>
                  )
                )}
              </>
            ) : (
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>(no output)</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main Component ───────────────────────────────────────────── */
export default function MarkdownRenderer({ content, className = '' }) {
  if (!content) return null

  return (
    <div className={`prose-kivora ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          /* ── Headings ── */
          h1: ({ children }) => <h1 className="text-[20px] font-semibold tracking-tight mt-8 mb-3 text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="text-[18px] font-semibold tracking-tight mt-8 mb-3 text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[16px] font-semibold tracking-tight mt-6 mb-2.5 text-white">{children}</h3>,
          h4: ({ children }) => <h4 className="text-[15px] font-semibold tracking-tight mt-5 mb-2 text-white">{children}</h4>,
          h5: ({ children }) => <h5 className="text-[14px] font-semibold tracking-tight mt-4 mb-1.5 text-white">{children}</h5>,
          h6: ({ children }) => <h6 className="text-[12px] font-semibold tracking-tight mt-3 mb-1 text-white uppercase">{children}</h6>,

          /* ── Paragraph ── */
          p: ({ children }) => <p className="text-[15px] leading-[1.7] text-[#d4d4d4] mb-4">{children}</p>,

          /* ── Lists ── */
          ul: ({ children }) => <ul className="list-disc list-outside ml-5 mb-4">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-5 mb-4">{children}</ol>,
          li: ({ children }) => (
            <li className="text-[15px] leading-[1.7] text-[#d4d4d4] pl-1 mb-2">
              {children}
            </li>
          ),
          input: ({ checked, ...props }) => (
            <input type="checkbox" checked={checked} disabled className="mr-1.5 mt-0.5 accent-red-600 rounded" {...props} />
          ),

          /* ── Blockquote ── */
          blockquote: ({ children }) => {
            const firstChild = children?.[0]
            let calloutType = null
            let filteredChildren = children
            if (firstChild?.props?.children) {
              const text = typeof firstChild.props.children === 'string'
                ? firstChild.props.children
                : Array.isArray(firstChild.props.children)
                  ? firstChild.props.children.join('')
                  : ''
              const match = text.match(/^\[!(note|tip|warning|caution)\]\s*/i)
              if (match) {
                calloutType = match[1].toLowerCase()
                const remaining = text.replace(/^\[!(note|tip|warning|caution)\]\s*/i, '')
                filteredChildren = [
                  { ...firstChild, props: { ...firstChild.props, children: remaining } },
                  ...children.slice(1)
                ]
              }
            }
            if (calloutType) {
              return (
                <div className="border-l-[3px] border-l-[#dc2626] bg-[#dc2626]/[0.06] rounded-r-lg px-4 py-3 my-4">
                  <div className="flex-1 min-w-0 text-[14px] text-[#d4d4d4] leading-relaxed">{filteredChildren}</div>
                </div>
              )
            }
            return (
              <div className="border-l-[3px] border-l-[#333] bg-white/[0.02] rounded-r-lg px-4 py-3 my-4">
                <div className="text-[14px] text-[#a3a3a3] leading-relaxed">{children}</div>
              </div>
            )
          },

          hr: () => <hr className="border-t border-white/[0.06] my-6" />,

          a: ({ href, children }) => (
            <a href={href} className="text-red-400 hover:text-red-300 underline underline-offset-2 decoration-red-400/30 hover:decoration-red-300/50 transition-colors" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),

          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-[#e5e5e5]">{children}</em>,

          /* ── Inline Code ── */
          code: ({ className: codeClassName, children, node }) => {
            const parentIsPre = node?.parent?.tagName === 'pre'
            if (parentIsPre) return <>{children}</>
            return (
              <code
                className="font-['SF_Mono',_Fira_Code,_'Courier_New',_monospace]"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.9em',
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                {children}
              </code>
            )
          },

          /* ── Code Block ── */
          pre: ({ children, node }) => {
            const codeNode = node?.children?.[0]
            const codeClassName = codeNode?.properties?.className?.[0] || ''
            const langLabel = getLangLabel(codeClassName)
            const codeText = extractTextFromNode(codeNode)

            return (
              <CodeBlock
                langLabel={langLabel}
                codeText={codeText}
                codeClassName={codeClassName}
              />
            )
          },

          /* ── Tables ── */
          table: ({ children }) => (
            <div className="my-4 -mx-1 overflow-x-auto overscroll-behavior-contain">
              <div className="inline-block min-w-full align-middle">
                <table className="w-full text-left">{children}</table>
              </div>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-white/[0.06] last:border-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="text-left text-[12px] font-medium text-[#737373] uppercase tracking-wider px-4 py-3 bg-white/[0.03]">{children}</th>
          ),
          td: ({ children }) => (
            <td className="text-[14px] text-[#d4d4d4] px-4 py-3 leading-relaxed">{children}</td>
          ),

          /* ── Images ── */
          img: ({ src, alt }) => (
            <div className="my-4 rounded-xl overflow-hidden border border-white/[0.06]">
              <img src={src} alt={alt || ''} className="w-full" loading="lazy" />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
