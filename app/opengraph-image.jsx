import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Kivora — Intelligence for builders everywhere'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        padding: '80px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            backgroundColor: '#dc2626',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 14 14" fill="none">
              <path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white" />
            </svg>
          </div>
          <span style={{ fontSize: '40px', fontWeight: 700, color: '#fafafa', letterSpacing: '-1px' }}>
            Ki<span style={{ color: '#dc2626' }}>vora</span>
          </span>
        </div>

        {/* Tagline */}
        <span style={{ fontSize: '28px', color: '#737373', lineHeight: 1.4, maxWidth: '700px' }}>
          Intelligence for builders everywhere
        </span>

        {/* Subtitle */}
        <span style={{ fontSize: '18px', color: '#404040', marginTop: '16px' }}>
          AI tools · Opportunities · Honest guides — all free
        </span>
      </div>
    ),
    {
      ...size,
    }
  )
}
