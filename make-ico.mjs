// Build a multi-size favicon.ico (ICO = ICONDIR header + PNG payloads)
import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const faviconSvg = readFileSync(join(__dirname, 'public/favicon.svg'))

const sizes = [16, 32, 48]
const pngs = await Promise.all(
  sizes.map((s) => sharp(faviconSvg).resize(s, s).png().toBuffer())
)

// ICO header: reserved(2) + type(2=1) + count(2)
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)

// Each ICONDIRENTRY is 16 bytes
const dirEntrySize = 16
const dataOffset = 6 + sizes.length * dirEntrySize

const entries = []
let offset = dataOffset
for (let i = 0; i < sizes.length; i++) {
  const entry = Buffer.alloc(dirEntrySize)
  const s = sizes[i] === 256 ? 0 : sizes[i] // 0 means 256 in ICO spec
  entry.writeUInt8(s, 0)        // width
  entry.writeUInt8(s, 1)        // height
  entry.writeUInt8(0, 2)        // color count (0 = more than 256)
  entry.writeUInt8(0, 3)        // reserved
  entry.writeUInt16LE(1, 4)     // color planes
  entry.writeUInt16LE(32, 6)    // bits per pixel
  entry.writeUInt32LE(pngs[i].length, 8)  // image size
  entry.writeUInt32LE(offset, 12)         // image offset
  entries.push(entry)
  offset += pngs[i].length
}

const out = Buffer.concat([header, ...entries, ...pngs])
writeFileSync(join(__dirname, 'public/favicon.ico'), out)
console.log('✓ public/favicon.ico')
