'use client'
import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IconSpinner } from '@/components/Icons'

/* ─── Copy Button for Code Blocks ──────────────────────────────── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [text])
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-[11px] text-[#525252] hover:text-[#a3a3a3] transition-colors font-mono"
      aria-label="Copy code"
    >
      {copied ? (
        <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5L6.5 12L13 4"/></svg> Copied</>
      ) : (
        <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="9" height="9" rx="1.5"/><path d="M3 11.5V3.5C3 2.67 3.67 2 4.5 2H10.5"/></svg> Copy</>
      )}
    </button>
  )
}

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

/* ─── Extract text from HAST node (react-markdown v10) ─────────── */
function extractTextFromNode(node) {
  if (!node) return ''
  if (node.type === 'text') return node.value || ''
  if (node.children) return node.children.map(extractTextFromNode).join('')
  return ''
}

/* ─── Judge0 status helpers ────────────────────────────────────── */
const STATUS_OK = new Set([3, 4]) // Accepted, Wrong Answer — code ran
const STATUS_PARTIAL = new Set([5]) // Time Limit Exceeded — partial output possible

function statusColor(statusId) {
  if (!statusId) return '#525252'
  if (STATUS_OK.has(statusId)) return '#4ade80'      // green — ran successfully
  if (STATUS_PARTIAL.has(statusId)) return '#facc15' // yellow — ran but hit limit
  return '#f87171'                                    // red — compile/error
}

/* ─── Code Block with Run Button ───────────────────────────────── */
function CodeBlock({ langLabel, codeText, codeClassName, children }) {
  const [runResult, setRunResult] = useState(null)
  const [running, setRunning] = useState(false)

  const langId = getLangId(codeClassName)

  const handleRun = async () => {
    if (!langId) return
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_code: codeText, language_id: langId })
      })
      const data = await res.json()

      // API-level error (rate limit, bad request, etc.)
      if (data.error && !data.status) {
        setRunResult({
          status: { id: null, description: 'Error' },
          stderr: data.error,
          stdout: null,
          compile_output: data.details || null,
          exit_code: null,
          time: null,
          memory: null
        })
      } else {
        setRunResult(data)
      }
    } catch {
      setRunResult({
        status: { id: null, description: 'Network Error' },
        stderr: 'Could not reach the execution server. Please check your connection and try again.',
        stdout: null,
        compile_output: null,
        exit_code: null,
        time: null,
        memory: null
      })
    }
    setRunning(false)
  }

  // Derive output parts for display
  const hasOutput = runResult && (
    runResult.stdout || runResult.stderr || runResult.compile_output
  )
  const statusId = runResult?.status?.id
  const statusDesc = runResult?.status?.description
  const isOk = STATUS_OK.has(statusId)

  return (
    <div className="my-4 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
      {/* Header bar with language label + Run + Copy */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
        <span className="text-[11px] font-mono text-[#525252] uppercase tracking-wider">{langLabel || 'Code'}</span>
        <div className="flex items-center gap-3">
          {langId ? (
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-1.5 text-[11px] text-[#525252] hover:text-[#4ade80] transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Run code"
            >
              {running ? <IconSpinner size={12} /> : <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>}
              {running ? 'Running...' : 'Run'}
            </button>
          ) : (
            <button
              disabled
              className="flex items-center gap-1.5 text-[11px] text-[#333] font-mono cursor-not-allowed"
              title="Language not supported for execution"
              aria-label="Language not supported for execution"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
              Run
            </button>
          )}
          <CopyButton text={codeText} />
        </div>
      </div>
      {/* Code content */}
      <div className="overflow-x-auto p-4 overscroll-behavior-contain">
        <code className={`${codeClassName || ''} font-mono text-[13px] leading-[1.65] text-[#d4d4d4] whitespace-pre block min-w-fit`}>
          {children}
        </code>
      </div>
      {/* Execution output */}
      {runResult && (
        <div className={`border-t ${isOk ? 'border-emerald-500/20' : 'border-red-500/20'} bg-[#0d0d0d]`}>
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-1.5">
            <div className="flex items-center gap-2">
              {/* Status dot */}
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: statusColor(statusId) }}
              />
              <span
                className="text-[10px] font-mono uppercase tracking-wider"
                style={{ color: statusColor(statusId) }}
              >
                {statusDesc || 'Output'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {runResult.time && (
                <span className="text-[10px] font-mono text-[#525252]">{runResult.time}s</span>
              )}
              {runResult.memory && (
                <span className="text-[10px] font-mono text-[#525252]">{(runResult.memory / 1024).toFixed(0)}KB</span>
              )}
              <button onClick={() => setRunResult(null)} className="text-[10px] font-mono text-[#525252] hover:text-[#a3a3a3] transition-colors">Clear</button>
            </div>
          </div>
          {/* Output content */}
          {hasOutput ? (
            <div className="px-4 pb-3 font-mono text-[13px] leading-[1.5] overflow-x-auto whitespace-pre">
              {/* Standard output */}
              {runResult.stdout && (
                <span className="text-[#d4d4d4]">{runResult.stdout}</span>
              )}
              {/* Standard error */}
              {runResult.stderr && (
                <span className={runResult.stdout ? 'text-yellow-400' : 'text-red-400'}>{runResult.stderr}</span>
              )}
              {/* Compilation output (Java, C++, etc.) */}
              {runResult.compile_output && (
                <span className={runResult.stdout ? 'text-yellow-400' : 'text-red-400'}>{runResult.compile_output}</span>
              )}
              {/* Exit code (only show for non-zero) */}
              {runResult.exit_code != null && runResult.exit_code !== 0 && (
                <span className="text-[10px] text-red-400/70 block mt-1.5">
                  Exit code: {runResult.exit_code}
                </span>
              )}
            </div>
          ) : (
            <div className="px-4 pb-3 font-mono text-[12px] text-[#525252] italic">
              No output
            </div>
          )}
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
          /* ── Headings — generous breathing room ──────── */
          h1: ({ children }) => <h1 className="text-[20px] font-semibold tracking-tight mt-8 mb-3 text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="text-[18px] font-semibold tracking-tight mt-8 mb-3 text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[16px] font-semibold tracking-tight mt-6 mb-2.5 text-white">{children}</h3>,
          h4: ({ children }) => <h4 className="text-[15px] font-semibold tracking-tight mt-5 mb-2 text-white">{children}</h4>,
          h5: ({ children }) => <h5 className="text-[14px] font-semibold tracking-tight mt-4 mb-1.5 text-white">{children}</h5>,
          h6: ({ children }) => <h6 className="text-[12px] font-semibold tracking-tight mt-3 mb-1 text-white uppercase">{children}</h6>,

          /* ── Paragraph ─────────────────────────────────── */
          p: ({ children }) => <p className="text-[15px] leading-[1.7] text-[#d4d4d4] mb-4">{children}</p>,

          /* ── Lists — distinct items, not compressed ───── */
          ul: ({ children }) => <ul className="list-disc list-outside ml-5 mb-4">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-5 mb-4">{children}</ol>,
          li: ({ children }) => (
            <li className="text-[15px] leading-[1.7] text-[#d4d4d4] pl-1 mb-2">
              {children}
            </li>
          ),
          // Checkbox lists (GFM task lists)
          input: ({ checked, ...props }) => (
            <input
              type="checkbox"
              checked={checked}
              disabled
              className="mr-1.5 mt-0.5 accent-red-600 rounded"
              {...props}
            />
          ),

          /* ── Blockquote — tip callout with left accent ── */
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

            if (calloutType === 'tip') {
              return (
                <div className="border-l-[3px] border-l-[#dc2626] bg-[#dc2626]/[0.06] rounded-r-lg px-4 py-3 my-4">
                  <div className="flex-1 min-w-0 text-[14px] text-[#d4d4d4] leading-relaxed">{filteredChildren}</div>
                </div>
              )
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

          /* ── Horizontal Rule ───────────────────────────── */
          hr: () => <hr className="border-t border-white/[0.06] my-6" />,

          /* ── Links ─────────────────────────────────────── */
          a: ({ href, children }) => (
            <a href={href} className="text-red-400 hover:text-red-300 underline underline-offset-2 decoration-red-400/30 hover:decoration-red-300/50 transition-colors" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),

          /* ── Text Formatting ───────────────────────────── */
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-[#e5e5e5]">{children}</em>,

          /* ── Inline Code — monospace pill ──────────────── */
          /* react-markdown v10: no `inline` prop. Check node.parent to tell */
          code: ({ className: codeClassName, children, node }) => {
            // If parent is <pre>, this is block code — let the pre component handle rendering
            const isBlockCode = node?.position?.start?.line !== node?.position?.end?.line || 
                                node?.properties?.className?.length > 0 ||
                                codeClassName
            // More reliable: if inside a <pre>, the code component just passes children through
            // The pre component will wrap it in the CodeBlock with proper styling
            // For inline code (NOT inside pre), render as pill
            const parentIsPre = node?.parent?.tagName === 'pre'
            if (parentIsPre) {
              // Block code inside <pre> — just render raw text, the pre/CodeBlock handles styling
              return <>{children}</>
            }
            // Inline code
            return (
              <code className="font-mono bg-white/[0.08] text-[#e2e2e2] px-1.5 py-0.5 rounded-[4px] text-[0.9em]">
                {children}
              </code>
            )
          },

          /* ── Code Block — uses node to extract code text reliably ─── */
          pre: ({ children, node }) => {
            // In react-markdown v10, node is the HAST element with the code child
            // Extract the code element from the HAST tree for reliable text extraction
            const codeNode = node?.children?.[0]
            const codeClassName = codeNode?.properties?.className?.[0] || ''
            const langLabel = getLangLabel(codeClassName)
            // Extract text from the HAST code node (most reliable method)
            const codeText = extractTextFromNode(codeNode)

            return (
              <CodeBlock langLabel={langLabel} codeText={codeText} codeClassName={codeClassName}>
                {typeof children === 'string' ? children : 
                 children?.props?.children ?? children}
              </CodeBlock>
            )
          },

          /* ── Tables — hairline horizontal borders only ─── */
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
            <tr className="border-b border-white/[0.06] last:border-0">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="text-left text-[12px] font-medium text-[#737373] uppercase tracking-wider px-4 py-3 bg-white/[0.03]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="text-[14px] text-[#d4d4d4] px-4 py-3 leading-relaxed">
              {children}
            </td>
          ),

          /* ── Images ────────────────────────────────────── */
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
