// Gera os ícones do Soaken a partir do vetor mestre public/favicon.svg.
//   - public/icon/soaken-{16..512}.png  (favicon, PWA, splash, dev)
//   - resources/icon.png (512)  + resources/icon.ico (multi-size)  → electron-builder / runtime / bandeja
// Rode com: npm run icons   (idempotente)
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root   = join(__dirname, '..')
const svg    = readFileSync(join(root, 'public', 'favicon.svg'))
const outDir = join(root, 'public', 'icon')
const resDir = join(root, 'resources')
mkdirSync(outDir, { recursive: true })
mkdirSync(resDir, { recursive: true })

// Renderiza o SVG em alta densidade e reduz p/ cada tamanho (mais nítido que renderizar pequeno).
const png = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()

const PNG_SIZES = [16, 32, 48, 64, 128, 180, 192, 256, 512]
const ICO_SIZES = [16, 32, 48, 64, 128, 256]

const buffers = {}
for (const s of new Set([...PNG_SIZES, ...ICO_SIZES])) buffers[s] = await png(s)

for (const s of PNG_SIZES) writeFileSync(join(outDir, `soaken-${s}.png`), buffers[s])

writeFileSync(join(resDir, 'icon.png'), buffers[512])
writeFileSync(join(resDir, 'icon.ico'), await pngToIco(ICO_SIZES.map((s) => buffers[s])))

console.log(`icons: ${PNG_SIZES.length} PNGs em public/icon/ + resources/icon.{png,ico}`)
