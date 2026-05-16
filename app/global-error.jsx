'use client'

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fafafa',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            background: 'rgba(127,29,29,0.3)',
            border: '1px solid rgba(153,27,27,0.3)',
            borderRadius: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}>
            <span style={{ color: '#f87171', fontSize: '1.25rem' }}>!</span>
          </div>
          <h1 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#737373', fontSize: '1rem', marginBottom: '1.5rem' }}>
            A critical error occurred. Please try refreshing the page.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '0.625rem 1.25rem',
              borderRadius: '0.75rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
