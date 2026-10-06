// Kivora PWA icon generator — renders public/icon-src*.svg to PNG assets.
// Usage: node scripts/generate-icons.mjs   (requires: npm i --no-save sharp)
// Regenerate whenever the brand mark changes.
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const jobs = [
  { src: 'public/icon-src.svg', out: 'public/icon-512.png', size: 512 },
  { src: 'public/icon-src.svg', out: 'public/icon-192.png', size: 192 },
  { src: 'public/icon-src-maskable.svg', out: 'public/icon-maskable-512.png', size: 512 },
  { src: 'public/icon-src.svg', out: 'public/apple-touch-icon.png', size: 180 },
]

for (const { src, out, size } of jobs) {
  const svg = readFileSync(src)
  await sharp(svg, { density: 96 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log(`wrote ${out} (${size}x${size})`)
}
