'use client'
import { useState, useEffect, useMemo, useRef } from 'react'

/* ═══════════════════════════════════════════════════════════════
   DeployPreviewCard — Premium deployed-site preview (Replit/Claude/Kimi-style)

   Features:
   - Browser-chrome top bar (traffic lights + URL pill + open-external)
   - Live iframe preview (lazy-loaded on first viewport intersection)
   - "Open in new tab" button (primary CTA)
   - "Copy URL" button with success state
   - Status badge ("Live" with green dot)
   - Project name + hosting footer
   - Loading shimmer while iframe loads
   - Responsive: full-width on mobile, max-w on desktop
   ═══════════════════════════════════════════════════════════════ */

export default function DeployPreviewCard({ url, projectName }) {
  const [copied, setCopied] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [inView, setInView] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const containerRef = useRef(null)
  const ioRef = useRef(null)

  // Lazy-load the iframe only when scrolled into view (saves bandwidth)
  useEffect(() => {
    if (!containerRef.current || inView) return
    const el = containerRef.current
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true)
            io.disconnect()
          }
        }
      },
      { rootMargin: '200px 0px' }
    )
    io.observe(el)
    ioRef.current = io
    return () => io.disconnect()
  }, [inView])

  // Reset iframe load state when URL changes
  useEffect(() => {
    setIframeLoaded(false)
    setPreviewFailed(false)
  }, [url])

  const displayUrl = useMemo(() => {
    try {
      const u = new URL(url)
      return u.host + u.pathname
    } catch {
      return url
    }
  }, [url])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can fail in non-secure contexts
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
      document.body.removeChild(ta)
    }
  }

  return (
    <div
      ref={containerRef}
      className="deploy-preview-card"
    >
      {/* Browser chrome top bar */}
      <div className="deploy-preview-chrome">
        <div className="deploy-preview-traffic">
          <span className="deploy-preview-dot deploy-preview-dot-red" />
          <span className="deploy-preview-dot deploy-preview-dot-yellow" />
          <span className="deploy-preview-dot deploy-preview-dot-green" />
        </div>
        <div className="deploy-preview-url-pill" title={url}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="deploy-preview-lock">
            <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
            <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
          </svg>
          <span className="deploy-preview-url-text">{displayUrl}</span>
        </div>
        <div className="deploy-preview-status">
          <span className="deploy-preview-status-dot" />
          <span className="deploy-preview-status-text">Live</span>
        </div>
      </div>

      {/* Preview area — iframe with shimmer + fallback */}
      <div className="deploy-preview-stage">
        {!iframeLoaded && !previewFailed && (
          <div className="deploy-preview-shimmer">
            <div className="deploy-preview-shimmer-line" style={{ width: '60%', marginTop: '24px' }} />
            <div className="deploy-preview-shimmer-line" style={{ width: '85%', marginTop: '12px' }} />
            <div className="deploy-preview-shimmer-line" style={{ width: '70%', marginTop: '12px' }} />
            <div className="deploy-preview-shimmer-line" style={{ width: '50%', marginTop: '24px' }} />
            <div className="deploy-preview-shimmer-block" />
          </div>
        )}
        {previewFailed && (
          <div className="deploy-preview-fallback">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M9 9h6v6H9z"/>
            </svg>
            <p>Preview blocked by browser — open the site directly.</p>
          </div>
        )}
        {inView && !previewFailed && (
          <iframe
            src={url}
            title={`Preview of ${projectName || 'deployed site'}`}
            className={`deploy-preview-iframe ${iframeLoaded ? 'loaded' : ''}`}
            sandbox="allow-scripts allow-same-origin allow-forms"
            loading="lazy"
            onLoad={() => setIframeLoaded(true)}
            onError={() => setPreviewFailed(true)}
          />
        )}
      </div>

      {/* Footer with project name + actions */}
      <div className="deploy-preview-footer">
        <div className="deploy-preview-meta">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="deploy-preview-meta-icon">
            <path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
            <path d="M2 10h20M6 4v4M18 4v4"/>
          </svg>
          <span className="deploy-preview-project">{projectName || 'your-site'}</span>
          <span className="deploy-preview-host">· Cloudflare Pages</span>
        </div>
        <div className="deploy-preview-actions">
          <button
            onClick={handleCopy}
            className="deploy-preview-btn deploy-preview-btn-secondary"
            type="button"
          >
            {copied ? (
              <>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 4.5L6 12l-3.5-3.5"/></svg>
                Copied
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5"/></svg>
                Copy URL
              </>
            )}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="deploy-preview-btn deploy-preview-btn-primary"
          >
            Open
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h7v7M13 3L6 10M11 13H4a1 1 0 01-1-1V5"/></svg>
          </a>
        </div>
      </div>
    </div>
  )
}
