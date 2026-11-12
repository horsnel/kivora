import { chromium } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto('https://kivora.pages.dev/research', { waitUntil: 'load', timeout: 60000 })
await page.waitForTimeout(4000)
const info = await page.evaluate(() => {
  const aside = document.querySelector('aside')
  if (!aside) return { aside: false }
  const asideRect = aside.getBoundingClientRect()
  const svgs = [...aside.querySelectorAll('svg')]
  const xSvgs = svgs.filter(s => {
    const p = s.querySelector('path')?.getAttribute('d') || ''
    return /M6 18L18 6|M18 6L6 18|6l12 12|X18 6/i.test(p)
  })
  const visible = xSvgs.map(s => {
    const btn = s.closest('button')
    const r = (btn || s).getBoundingClientRect()
    const st = getComputedStyle(btn || s)
    return {
      btnLabel: btn?.getAttribute('aria-label') || btn?.textContent?.slice(0, 30) || '(none)',
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      display: st.display, visibility: st.visibility,
      onScreen: r.width > 0 && r.x >= 0 && r.x < innerWidth && r.y < innerHeight,
    }
  })
  const closeBtn = aside.querySelector('button[class*="lg:hidden"]')
  return {
    aside: true,
    asideW: Math.round(asideRect.width),
    xCount: xSvgs.length,
    visible,
    closeBtnClass: closeBtn?.className?.slice(0, 90) || null,
  }
})
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: '/tmp/render/sidebar.png', clip: { x: 0, y: 0, width: 260, height: 700 } })
await browser.close()
