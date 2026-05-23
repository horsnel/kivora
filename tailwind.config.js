/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        /* ── 4-tier type scale ──
         * Display: page titles, hero text
         * Headline: section headers, card titles
         * Body: descriptions, inputs, buttons (default)
         * Caption: tags, metadata, labels
         */
        'caption':   ['12px', '18px'],   // Tier 4: tags, metadata, labels, pills
        'body':      ['16px', '28px'],   // Tier 3: descriptions, inputs, buttons
        'body-sm':   ['14px', '22px'],   // Tier 3 alt: compact body (metric values, sidebar)
        'headline':  ['18px', '24px'],   // Tier 2: section headers, card titles, stats
        'headline-sm': ['16px', '22px'], // Tier 2 alt: small section headers, emphasis
        'display':   ['32px', '38px'],   // Tier 1: page titles
        'display-lg':['40px', '44px'],   // Tier 1 alt: hero text
        'display-xl':['56px', '60px'],   // Tier 1 large: homepage hero
        // Legacy aliases (for gradual migration)
        '2xs': ['12px', '18px'],
      },
      colors: {
        surface:  '#141414',
        surface2: '#1a1a1a',
        border:   '#262626',
        muted:    '#737373',
        muted2:   '#404040',
      },
      animation: {
        'fade-up':    'fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-in':    'fadeIn 0.3s ease forwards',
        'slide-down': 'slideDown 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in':   'scaleIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards',
        'shimmer':    'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeUp:    { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideDown: { from: { opacity: '0', transform: 'translateY(-8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        shimmer:   { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}
