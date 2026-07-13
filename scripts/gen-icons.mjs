// Gera os ícones do PWA a partir de um SVG (fundo azul da marca + cápsula branca).
// Uso: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'

const AZUL = '#1d4ed8'

const capsula = `
  <g transform="rotate(45 256 256)">
    <rect x="146" y="211" width="220" height="90" rx="45" fill="#ffffff"/>
    <rect x="251" y="211" width="10" height="90" fill="${AZUL}"/>
  </g>`

// Ícone normal (cantos arredondados)
const iconSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="${AZUL}"/>
  ${capsula}
</svg>`

// Ícone "maskable" (fundo cheio, para launchers que recortam)
const maskableSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="${AZUL}"/>
  ${capsula}
</svg>`

mkdirSync('public', { recursive: true })

async function png(svg, size, arquivo) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/${arquivo}`)
  console.log('gerado public/' + arquivo)
}

await png(iconSvg, 192, 'pwa-192x192.png')
await png(iconSvg, 512, 'pwa-512x512.png')
await png(maskableSvg, 512, 'maskable-512x512.png')
await png(iconSvg, 180, 'apple-touch-icon.png')

writeFileSync('public/favicon.svg', iconSvg)
console.log('gerado public/favicon.svg')
