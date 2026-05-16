'use client'
import { useState, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

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
      className="absolute top-2.5 right-2.5 flex items-center gap-1 text-caption text-[#525252] hover:text-[#a3a3a3] bg-[#1a1a1a] hover:bg-[#222] px-2 py-1 rounded-md transition-colors font-mono"
      aria-label="Copy code"
    >
      {copied ? (
        <><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8.5L6.5 12L13 4"/></svg> Copied</>
      ) : (
        <><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="9" height="9" rx="1.5"/><path d="M3 11.5V3.5C3 2.67 3.67 2 4.5 2H10.5"/></svg> Copy</>
      )}
    </button>
  )
}

/* ─── Styled Table Wrapper ─────────────────────────────────────── */
function StyledTable({ children }) {
  return (
    <div className="my-3 -mx-1 overflow-x-auto overscroll-behavior-contain">
      <div className="inline-block min-w-full align-middle">
        <table className="w-full text-left overflow-hidden">
          {children}
        </table>
      </div>
    </div>
  )
}

/* ─── Callout / Admonition Block ───────────────────────────────── */
function CalloutBlock({ children, type }) {
  const config = {
    note:    { icon: 'ℹ',  bg: 'bg-blue-950/30',  border: 'border-blue-800/40',  text: 'text-blue-300' },
    tip:     { icon: '💡', bg: 'bg-emerald-950/30', border: 'border-emerald-800/40', text: 'text-emerald-300' },
    warning: { icon: '⚠',  bg: 'bg-amber-950/30',  border: 'border-amber-800/40',  text: 'text-amber-300' },
    caution: { icon: '🔴', bg: 'bg-red-950/30',    border: 'border-red-800/40',    text: 'text-red-300' },
  }
  const c = config[type] || config.note
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl px-4 py-3 my-3 flex gap-3 items-start`}>
      <span className={`${c.text} text-body mt-0.5 shrink-0`}>{c.icon}</span>
      <div className="flex-1 min-w-0 text-body text-[#d4d4d4] leading-relaxed">{children}</div>
    </div>
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

/* ─── Main Component ───────────────────────────────────────────── */
export default function MarkdownRenderer({ content, className = '' }) {
  if (!content) return null

  return (
    <div className={`prose-kivora ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          /* ── Headings ──────────────────────────────────── */
          h1: ({ children }) => <h1 className="text-display font-semibold tracking-tight mt-6 mb-3 text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="text-headline font-semibold tracking-tight mt-5 mb-2.5 text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="text-headline font-semibold tracking-tight mt-4 mb-2 text-white">{children}</h3>,
          h4: ({ children }) => <h4 className="text-headline-sm font-semibold tracking-tight mt-3 mb-1.5 text-white">{children}</h4>,
          h5: ({ children }) => <h5 className="text-body font-semibold tracking-tight mt-3 mb-1.5 text-white">{children}</h5>,
          h6: ({ children }) => <h6 className="text-caption font-semibold tracking-tight mt-2 mb-1 text-white uppercase">{children}</h6>,

          /* ── Paragraph ─────────────────────────────────── */
          p: ({ children }) => <p className="text-body leading-relaxed text-[#d4d4d4] mb-3">{children}</p>,

          /* ── Lists ─────────────────────────────────────── */
          ul: ({ children }) => <ul className="list-disc list-outside ml-5 mb-3 space-y-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-5 mb-3 space-y-1.5">{children}</ol>,
          li: ({ children, ordered, index }) => (
            <li className="text-body leading-relaxed text-[#d4d4d4] pl-1">
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

          /* ── Blockquote (with callout support) ─────────── */
          blockquote: ({ children }) => {
            // Check if first child is a paragraph starting with [!TYPE]
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
                // Remove the [!TYPE] prefix from the text
                const remaining = text.replace(/^\[!(note|tip|warning|caution)\]\s*/i, '')
                filteredChildren = [
                  { ...firstChild, props: { ...firstChild.props, children: remaining } },
                  ...children.slice(1)
                ]
              }
            }

            if (calloutType) {
              return <CalloutBlock type={calloutType}>{filteredChildren}</CalloutBlock>
            }

            return (
              <blockquote className="border-l-2 border-[#333] bg-[#111] rounded-r-lg pl-4 pr-3 py-2 my-3 text-body text-[#a3a3a3]">
                {children}
              </blockquote>
            )
          },

          /* ── Horizontal Rule ───────────────────────────── */
          hr: () => <hr className="border-t border-[#222] my-5" />,

          /* ── Links ─────────────────────────────────────── */
          a: ({ href, children }) => (
            <a href={href} className="text-red-400 hover:text-red-300 underline underline-offset-2 decoration-red-400/30 hover:decoration-red-300/50 transition-colors" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),

          /* ── Text Formatting ───────────────────────────── */
          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-[#e5e5e5]">{children}</em>,

          /* ── Code (inline) ─────────────────────────────── */
          code: ({ inline, className: codeClassName, children }) => {
            if (inline) {
              return (
                <code className="bg-[#1a1a1a] text-red-300 px-1.5 py-0.5 rounded-md text-body-sm font-mono">
                  {children}
                </code>
              )
            }
            // Block code is rendered inside <pre> — just render the code element
            return (
              <code className={`${codeClassName || ''} text-body-sm leading-relaxed`}>
                {children}
              </code>
            )
          },

          /* ── Code Block (pre) with copy + language label ── */
          pre: ({ children }) => {
            const codeEl = children?.props?.children
            const codeText = typeof codeEl === 'string'
              ? codeEl
              : Array.isArray(codeEl)
                ? codeEl.filter(c => typeof c === 'string').join('')
                : ''
            const codeClassName = children?.props?.className || ''
            const langLabel = getLangLabel(codeClassName)

            return (
              <div className="relative group my-3 rounded-xl overflow-hidden bg-[#0d0d0d] border border-[#1a1a1a]">
                {/* Header bar with language label */}
                {langLabel && (
                  <div className="flex items-center justify-between px-4 py-1.5 bg-[#141414] border-b border-[#1a1a1a]">
                    <span className="text-caption font-mono text-[#525252] uppercase tracking-wider">{langLabel}</span>
                  </div>
                )}
                <div className="relative">
                  <pre className="overflow-x-auto p-4 !bg-transparent !m-0 text-body-sm leading-relaxed">
                    {children}
                  </pre>
                  <CopyButton text={codeText} />
                </div>
              </div>
            )
          },

          /* ── Tables (Claude-style, rounded, clean) ─────── */
          table: ({ children }) => <StyledTable>{children}</StyledTable>,
          thead: ({ children }) => <thead className="">{children}</thead>,
          tbody: ({ children }) => <tbody className="">{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#141414]/50 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="text-left text-caption font-semibold text-[#737373] px-4 py-2.5 bg-[#111] first:rounded-tl-xl last:rounded-tr-xl">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="text-body text-[#d4d4d4] px-4 py-2.5">
              {children}
            </td>
          ),

          /* ── Images ────────────────────────────────────── */
          img: ({ src, alt }) => (
            <div className="my-3 rounded-xl overflow-hidden border border-[#1a1a1a]">
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
