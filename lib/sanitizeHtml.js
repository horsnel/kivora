// ── sanitizeHtml — client-side allowlist sanitizer ───────────────────
// The research page renders API-provided HTML via dangerouslySetInnerHTML.
// That HTML is derived from AI + web-scraped sources, so a malicious page
// in the result set could otherwise plant <script>/<img onerror>/etc —
// a classic stored/prompt-injection XSS. This cleaner parses the string
// with DOMParser and keeps only a conservative formatting allowlist,
// dropping every event handler and non-safe URL.
//
// Runs in the browser only (content is always set post-hydration);
// on the server it passes through untouched, which is safe because no
// SSR path ever embeds fetched report HTML.

const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'blockquote', 'pre', 'code',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark', 'sub', 'sup', 'small',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'a', 'img', 'figure', 'figcaption', 'span', 'div', 'section', 'article', 'main', 'aside',
  'details', 'summary', 'abbr', 'cite', 'q', 'time', 'kbd', 'samp', 'var', 'sup',
])

const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'poster', 'background'])
// img-src with data: is safe (image context never executes scripts)
const SAFE_URL = /^(https?:|mailto:|tel:|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);)/i

export function sanitizeHtml(dirty) {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined' || !dirty) return dirty || ''
  let doc
  try {
    doc = new window.DOMParser().parseFromString(dirty, 'text/html')
  } catch {
    return '' // unparseable → render nothing rather than something unsafe
  }

  const walk = (node) => {
    for (const child of [...node.children]) {
      const tag = child.tagName.toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) {
        // keep grandchildren of containers like <div> wrappers, drop the shell
        if (['div', 'span', 'section', 'article', 'main', 'aside', 'figure'].includes(tag)) {
          const frag = doc.createDocumentFragment()
          while (child.firstChild) frag.appendChild(child.firstChild)
          child.replaceWith(frag)
        } else {
          child.remove()
          continue
        }
      }
      for (const attr of [...(child.attributes || [])]) {
        const name = attr.name.toLowerCase()
        const value = (attr.value || '').trim()
        if (
          name.startsWith('on') ||
          URL_ATTRS.has(name) && !SAFE_URL.test(value) ||
          name === 'srcdoc' || name === 'style' && /expression|javascript:/i.test(value)
        ) {
          child.removeAttribute(attr.name)
        }
      }
      if (tag === 'a') {
        // neutralize tab-nabbing if the anchor survives sanitization
        if (child.getAttribute('target') === '_blank') child.setAttribute('rel', 'noopener noreferrer')
      }
      walk(child)
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}

export default sanitizeHtml
