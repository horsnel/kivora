'use client'
import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
                const remaining = text.replace(/^\[!(note|tip|warning|caution)\]\s*/i, '')
                filteredChildren = [
                  { ...firstChild, props: { ...firstChild.props, children: remaining } },
                  ...children.slice(1)
                ]
              }
            }

            // [!tip] or bare blockquote starting with [tip] — render as callout
            if (calloutType === 'tip') {
              return (
                <div className="border-l-[3px] border-l-[#dc2626] bg-[#dc2626]/[0.06] rounded-r-lg px-4 py-3 my-4">
                  <div className="flex-1 min-w-0 text-[14px] text-[#d4d4d4] leading-relaxed">{filteredChildren}</div>
                </div>
              )
            }

            // Any other callout type — same red accent style
            if (calloutType) {
              return (
                <div className="border-l-[3px] border-l-[#dc2626] bg-[#dc2626]/[0.06] rounded-r-lg px-4 py-3 my-4">
                  <div className="flex-1 min-w-0 text-[14px] text-[#d4d4d4] leading-relaxed">{filteredChildren}</div>
                </div>
              )
            }

            // Regular blockquote — also gets the left-border callout treatment
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
          code: ({ inline, className: codeClassName, children }) => {
            if (inline) {
              return (
                <code className="font-mono bg-white/[0.08] text-[#e2e2e2] px-1.5 py-0.5 rounded-[4px] text-[0.9em]">
                  {children}
                </code>
              )
            }
            // Block code — single-color monospace, no wrapping
            return (
              <code className={`${codeClassName || ''} font-mono text-[13px] leading-[1.65] text-[#d4d4d4] whitespace-pre block min-w-fit`}>
                {children}
              </code>
            )
          },

          /* ── Code Block — ChatGPT/Claude-style container ─── */
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
              <div className="my-4 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                {/* Header bar with language label + copy */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
                  <span className="text-[11px] font-mono text-[#525252] uppercase tracking-wider">{langLabel || 'Code'}</span>
                  <CopyButton text={codeText} />
                </div>
                {/* Scroll wrapper — div handles overflow, code handles whitespace */}
                <div className="overflow-x-auto p-4 overscroll-behavior-contain">
                  {children}
                </div>
              </div>
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
