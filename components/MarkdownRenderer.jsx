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

const COLLAPSE_LINES = 12

/* ─── Syntax-Highlighted Code ──────────────────────────────────── */
function SyntaxCode({ code, language, maxLines, expanded }) {
  return (
    <Highlight theme={kivoraTheme} code={code} language={language}>
      {({ style, tokens, getLineProps, getTokenProps }) => {
        const visibleTokens = expanded ? tokens : tokens.slice(0, maxLines)
        return (
          <pre
            className="font-['SF_Mono',_Fira_Code,_'Courier_New',_monospace] text-[14px] leading-[1.6] overflow-x-auto whitespace-pre"
            style={{ ...style, background: 'transparent', margin: 0, padding: 0 }}
          >
            {visibleTokens.map((line, i) => {
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
        )
      }}
    </Highlight>
  )
}

/* ─── Full-Screen Code Modal ───────────────────────────────────── */
function CodeModal({ code, language, langLabel, langId, onClose }) {
  const [tab, setTab] = useState('code')
  const [runResult, setRunResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const handleRun = async () => {
    if (!langId) return
    setRunning(true)
    setRunResult(null)
    setDetailsOpen(false)
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_code: code, language_id: langId })
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
    setTab('console')
  }

  const statusId = runResult?.status?.id
  const hasError = runResult && STATUS_ERROR.has(statusId)
  const hasOutput = runResult && (runResult.stdout || runResult.stderr || runResult.compile_output)

  let consoleOutput = ''
  if (runResult) {
    if (hasError) {
      if (runResult.compile_output) consoleOutput += runResult.compile_output
      if (runResult.stderr) consoleOutput += (consoleOutput ? '\n' : '') + runResult.stderr
    } else {
      if (runResult.stdout) consoleOutput = runResult.stdout
      if (runResult.stderr) consoleOutput += (consoleOutput ? '\n' : '') + runResult.stderr
    }
  }

  const hasDetails = runResult && (
    runResult.status?.description || runResult.exit_code != null || runResult.time || runResult.memory
  )

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        {/* Close */}
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.1] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => setTab('code')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 ${
              tab === 'code' ? 'text-white' : 'text-[rgba(255,255,255,0.5)] hover:text-[rgba(255,255,255,0.7)]'
            }`}
            style={tab === 'code' ? { background: 'rgba(255,255,255,0.15)' } : {}}
          >
            Code
          </button>
          <button
            onClick={() => setTab('console')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 flex items-center gap-1.5 ${
              tab === 'console' ? 'text-white' : 'text-[rgba(255,255,255,0.5)] hover:text-[rgba(255,255,255,0.7)]'
            }`}
            style={tab === 'console' ? { background: 'rgba(255,255,255,0.15)' } : {}}
          >
            Console
            {runResult && hasError && (
              <span className="inline-block w-2 h-2 rounded-full bg-[#F44336]" />
            )}
          </button>
        </div>
        {/* Run */}
        {langId ? (
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 disabled:opacity-50"
            style={{
              border: '1px solid rgba(255,255,255,0.2)',
              background: running ? 'rgba(255,255,255,0.05)' : 'transparent',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            {running ? (
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
            )}
            {running ? 'Running...' : 'Run'}
          </button>
        ) : (
          <div />
        )}
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
        {tab === 'code' ? (
          <SyntaxCode code={code} language={language} maxLines={Infinity} expanded={true} />
        ) : (
          <div className="font-['SF_Mono',_Fira_Code,_'Courier_New',_monospace] text-[14px] leading-[1.6] whitespace-pre">
            {runResult ? (
              <>
                {hasOutput ? (
                  <>
                    {runResult.stdout && !hasError && (
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>{runResult.stdout}</span>
                    )}
                    {hasError ? (
                      <span style={{ color: '#F44336' }}>{consoleOutput}</span>
                    ) : (
                      runResult.stderr && (
                        <span style={{ color: '#facc15' }}>{runResult.stderr}</span>
                      )
                    )}
                  </>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>(no output)</span>
                )}
                {/* View Error Details */}
                {(hasDetails || hasError) && (
                  <div className="mt-4 pt-3 border-t border-white/[0.06]">
                    <button
                      onClick={() => setDetailsOpen(!detailsOpen)}
                      className="flex items-center gap-1 text-[12px] font-mono transition-colors"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                    >
                      <svg
                        width="10" height="10" viewBox="0 0 16 16"
                        fill="none" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        className={`transition-transform ${detailsOpen ? 'rotate-90' : ''}`}
                      >
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                      {hasError ? 'View Error Details' : 'View Details'}
                    </button>
                    {detailsOpen && (
                      <div className="mt-2 space-y-1 text-[12px] font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {runResult.status?.description && (
                          <div className="flex gap-3">
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>Status</span>
                            <span style={{ color: hasError ? '#F44336' : STATUS_OK.has(statusId) ? '#4CAF50' : '#facc15' }}>
                              {runResult.status.description}
                            </span>
                          </div>
                        )}
                        {runResult.exit_code != null && (
                          <div className="flex gap-3">
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>Exit Code</span>
                            <span style={{ color: runResult.exit_code !== 0 ? '#F44336' : 'rgba(255,255,255,0.7)' }}>
                              {runResult.exit_code}
                            </span>
                          </div>
                        )}
                        {runResult.time && (
                          <div className="flex gap-3">
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>Time</span>
                            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{runResult.time}s</span>
                          </div>
                        )}
                        {runResult.memory && (
                          <div className="flex gap-3">
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>Memory</span>
                            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{(runResult.memory / 1024).toFixed(1)} KB</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>Run the code to see output here</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Code Block — ChatGPT-style ───────────────────────────────── */
function CodeBlock({ langLabel, codeText, codeClassName }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const langId = getLangId(codeClassName)
  const prismLang = getPrismLang(codeClassName)
  const lineCount = codeText.split('\n').length
  const shouldCollapse = lineCount > COLLAPSE_LINES

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

  return (
    <>
      <div
        className="my-4 overflow-hidden max-w-full"
        style={{
          background: '#1E1E1E',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* ── Header bar ── */}
        <div
          className="flex items-center justify-between"
          style={{
            minHeight: '48px',
            padding: '0 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Left: </> icon + language */}
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span className="text-[14px] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {langLabel || 'Code'}
            </span>
          </div>
          {/* Right: Copy + Run */}
          <div className="flex items-center" style={{ gap: '12px' }}>
            {/* Copy button */}
            <button
              onClick={copy}
              className="flex items-center justify-center transition-colors duration-200 hover:opacity-80"
              style={{ color: copied ? '#4CAF50' : 'rgba(255,255,255,0.5)' }}
              aria-label="Copy code"
            >
              {copied ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
            </button>
            {/* Run button */}
            {langId ? (
              <button
                onClick={handleRun}
                disabled={running}
                className="flex items-center gap-1.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: running ? 'rgba(255,255,255,0.05)' : 'transparent',
                  padding: '8px 16px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '14px',
                }}
                aria-label="Run code"
              >
                {running ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
                )}
                <span className="text-[14px]">{running ? 'Running...' : 'Run'}</span>
              </button>
            ) : (
              <button
                disabled
                className="flex items-center gap-1.5 cursor-not-allowed opacity-30"
                style={{
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent',
                  padding: '8px 16px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '14px',
                }}
                title="Language not supported for execution"
                aria-label="Language not supported"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
                <span className="text-[14px]">Run</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Code body with syntax highlighting ── */}
        <div
          className="relative"
          style={{ padding: '16px' }}
        >
          <div
            className="overflow-x-auto overscroll-behavior-contain"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.15) transparent',
            }}
          >
            <SyntaxCode
              code={codeText}
              language={prismLang}
              maxLines={COLLAPSE_LINES}
              expanded={expanded || !shouldCollapse}
            />
          </div>
          {/* Fade overlay when collapsed */}
          {shouldCollapse && !expanded && (
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                bottom: 0,
                height: '80px',
                background: 'linear-gradient(transparent, #1E1E1E)',
              }}
            />
          )}
        </div>

        {/* ── Expand/collapse button ── */}
        {shouldCollapse && (
          <div className="flex justify-center -mt-4 pb-3 relative z-10">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center justify-center transition-all duration-200"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.6)',
              }}
              aria-label={expanded ? 'Collapse code' : 'Expand code'}
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Execution output — terminal-style ── */}
        {runResult && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Output area */}
            <div
              className="font-['SF_Mono',_Fira_Code,_'Courier_New',_monospace] text-[14px] leading-[1.6] overflow-x-auto whitespace-pre"
              style={{
                background: '#1E1E1E',
                padding: '16px',
              }}
            >
              {hasOutput ? (
                <>
                  {runResult.stdout && !hasError && (
                    <span style={{ color: '#4CAF50' }}>{runResult.stdout}</span>
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
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>(no output)</span>
              )}
            </div>

            {/* View Error Details / Clear footer */}
            {(hasDetails || hasError) && (
              <div
                className="flex items-center justify-between"
                style={{
                  padding: '8px 16px',
                  background: '#1E1E1E',
                  borderTop: '1px solid rgba(255,255,255,0.03)',
                }}
              >
                <button
                  onClick={() => setDetailsOpen(!detailsOpen)}
                  className="flex items-center gap-1 text-[12px] font-mono transition-colors duration-200"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  <svg
                    width="10" height="10" viewBox="0 0 16 16"
                    fill="none" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform duration-200 ${detailsOpen ? 'rotate-90' : ''}`}
                  >
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                  {hasError ? 'View Error Details' : 'View Details'}
                </button>
                <button
                  onClick={() => { setRunResult(null); setDetailsOpen(false) }}
                  className="text-[11px] font-mono transition-colors duration-200"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  Clear
                </button>
              </div>
            )}

            {/* Expandable developer details */}
            {detailsOpen && hasDetails && (
              <div
                style={{
                  background: '#1a1a1a',
                  borderTop: '1px solid rgba(255,255,255,0.03)',
                  padding: '12px 16px',
                }}
              >
                <div className="space-y-1">
                  {runResult.status?.description && (
                    <div className="flex items-center gap-3 text-[12px] font-mono">
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>Status</span>
                      <span style={{ color: hasError ? '#F44336' : STATUS_OK.has(statusId) ? '#4CAF50' : '#facc15' }}>
                        {runResult.status.description}
                      </span>
                    </div>
                  )}
                  {runResult.exit_code != null && (
                    <div className="flex items-center gap-3 text-[12px] font-mono">
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>Exit Code</span>
                      <span style={{ color: runResult.exit_code !== 0 ? '#F44336' : 'rgba(255,255,255,0.7)' }}>
                        {runResult.exit_code}
                      </span>
                    </div>
                  )}
                  {runResult.time && (
                    <div className="flex items-center gap-3 text-[12px] font-mono">
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>Time</span>
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>{runResult.time}s</span>
                    </div>
                  )}
                  {runResult.memory && (
                    <div className="flex items-center gap-3 text-[12px] font-mono">
                      <span style={{ color: 'rgba(255,255,255,0.3)' }}>Memory</span>
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>{(runResult.memory / 1024).toFixed(1)} KB</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tap to open full-screen ── */}
        <button
          onClick={() => setModalOpen(true)}
          className="w-full flex items-center justify-center py-1.5 transition-colors duration-200"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.2)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>

      {/* ── Full-screen modal ── */}
      {modalOpen && (
        <CodeModal
          code={codeText}
          language={prismLang}
          langLabel={langLabel}
          langId={langId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
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
