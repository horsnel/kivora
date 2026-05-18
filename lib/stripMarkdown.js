/**
 * Strip markdown syntax from a string to produce clean plain text
 * suitable for clipboard copying.
 */
export function stripMarkdown(md) {
  if (!md) return ''
  let text = md

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '')

  // Remove code blocks (fenced) — keep the code content inside
  text = text.replace(/```[\w]*\n/g, '')
  text = text.replace(/```/g, '')

  // Remove inline code backticks but keep content
  text = text.replace(/`([^`]+)`/g, '$1')

  // Remove bold markers (** or __) but keep content
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')

  // Remove italic markers (* or _) but keep content
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/_([^_]+)_/g, '$1')

  // Remove strikethrough (~~)
  text = text.replace(/~~([^~]+)~~/g, '$1')

  // Remove headings markers (# ## ### etc.)
  text = text.replace(/^#{1,6}\s+/gm, '')

  // Remove blockquote markers (>)
  text = text.replace(/^>\s?/gm, '')

  // Remove horizontal rules (--- or *** or ___)
  text = text.replace(/^[-*_]{3,}\s*$/gm, '')

  // Remove link syntax, keep link text [text](url) → text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // Remove image syntax ![alt](url) → alt
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')

  // Remove table pipes and alignment rows
  text = text.replace(/^\|?\s*[-:]+[-|\s:]*$/gm, '')  // alignment row
  text = text.replace(/\|/g, ' ')                       // pipes → spaces

  // Remove checkbox syntax [ ] or [x]
  text = text.replace(/\[[ x]\]\s?/gi, '')

  // Remove callout/admonition markers [!note], [!tip] etc.
  text = text.replace(/\[!(note|tip|warning|caution)\]\s*/gi, '')

  // Replace em dashes with commas
  text = text.replace(/—/g, ', ')

  // Clean up multiple spaces
  text = text.replace(/  +/g, ' ')

  // Clean up multiple blank lines (max 2 newlines)
  text = text.replace(/\n{3,}/g, '\n\n')

  // Trim leading/trailing whitespace per line and whole text
  text = text.split('\n').map(l => l.trim()).join('\n').trim()

  return text
}
