import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconSvg = readFileSync(join(__dirname, 'public/icons/icon.svg'))
const faviconSvg = readFileSync(join(__dirname, 'public/favicon.svg'))

// App icon + favicon PNGs
const sizes = [
  { src: iconSvg, size: 192, out: 'public/icons/icon-192.png' },
  { src: iconSvg, size: 512, out: 'public/icons/icon-512.png' },
  { src: iconSvg, size: 180, out: 'public/apple-touch-icon.png' },
  { src: faviconSvg, size: 48,  out: 'public/favicon-48.png' },
  { src: faviconSvg, size: 32,  out: 'public/favicon-32.png' },
  { src: faviconSvg, size: 16,  out: 'public/favicon-16.png' },
]

for (const { src, size, out } of sizes) {
  await sharp(src).resize(size, size).png().toFile(join(__dirname, out))
  console.log(`✓ ${out}`)
}

// Splash screens — artwork on gradient bg, no icon background/clip
const LIME_BARS = [
  `M74.9434 143H60.6035L77.9619 63H92.3018L74.9434 143Z`,
  `M129.283 143H114.943L132.302 63H146.642L129.283 143Z`,
  `M152.68 128.66H138.34L147.396 86.3965H161.735L152.68 128.66Z`,
  `M58.3398 124.887H44L54.9434 76.585H69.2832L58.3398 124.887Z`,
  `M116.83 109.038H87.7734L90.793 95.8301H119.85L116.83 109.038Z`,
]

function makeSplashSvg(w, h) {
  // Scale artwork to ~34% of narrower dimension, centered slightly above mid
  const iconPx = Math.round(Math.min(w, h) * 0.34)
  const scale = iconPx / 206
  // Center the artwork (visually centred at ~103,102 in the 206×206 space)
  const tx = (w / 2 - 103 * scale).toFixed(2)
  const ty = (h * 0.45 - 102 * scale).toFixed(2)

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
  <radialGradient id="bg" cx="50%" cy="50%" r="70%">
    <stop offset="0%" stop-color="#242429"/>
    <stop offset="100%" stop-color="#18181B"/>
  </radialGradient>
  <filter id="f2" x="-20%" y="-30%" width="140%" height="160%" color-interpolation-filters="sRGB">
    <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="rgba(189,234,59,0.4)"/>
  </filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<g transform="translate(${tx},${ty}) scale(${scale.toFixed(4)})">
  <g filter="url(#f2)">
    ${LIME_BARS.map(d => `<path d="${d}" fill="#CBFA45"/>`).join('\n    ')}
  </g>
</g>
</svg>`
}

// iOS splash screen sizes (portrait, width × height in physical pixels)
const splashSizes = [
  { w: 1290, h: 2796, name: 'splash-1290x2796' },  // iPhone 14/15/16 Pro Max, 14/15 Plus
  { w: 1206, h: 2622, name: 'splash-1206x2622' },  // iPhone 16 Pro
  { w: 1179, h: 2556, name: 'splash-1179x2556' },  // iPhone 14 Pro, 15, 16
  { w: 1284, h: 2778, name: 'splash-1284x2778' },  // iPhone 12/13 Pro Max
  { w: 1170, h: 2532, name: 'splash-1170x2532' },  // iPhone 12, 13, 14
  { w: 1080, h: 2340, name: 'splash-1080x2340' },  // iPhone 12/13 mini
  { w: 828,  h: 1792, name: 'splash-828x1792'  },  // iPhone XR, 11
  { w: 750,  h: 1334, name: 'splash-750x1334'  },  // iPhone SE 2nd/3rd gen, 8
  { w: 2048, h: 2732, name: 'splash-2048x2732' },  // iPad Pro 12.9"
  { w: 1668, h: 2388, name: 'splash-1668x2388' },  // iPad Pro 11"
  { w: 1536, h: 2048, name: 'splash-1536x2048' },  // iPad, iPad mini
]

mkdirSync(join(__dirname, 'public/splash'), { recursive: true })

for (const { w, h, name } of splashSizes) {
  const svg = Buffer.from(makeSplashSvg(w, h))
  const out = `public/splash/${name}.png`
  await sharp(svg).resize(w, h).png().toFile(join(__dirname, out))
  console.log(`✓ ${out}`)
}
