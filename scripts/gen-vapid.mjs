// Gera as chaves VAPID (Web Push) e grava no .env.local. Uso: node scripts/gen-vapid.mjs
import webpush from 'web-push'
import { appendFileSync, readFileSync, existsSync } from 'node:fs'

if (existsSync('.env.local') && readFileSync('.env.local', 'utf8').includes('VAPID_PRIVATE_KEY')) {
  console.log('VAPID já existe no .env.local — nada a fazer.')
  process.exit(0)
}

const { publicKey, privateKey } = webpush.generateVAPIDKeys()
appendFileSync('.env.local',
  `\n# Web Push (VAPID)\nVITE_VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\n`)

console.log('VAPID_PUBLIC_KEY =', publicKey)
console.log('(chave privada gravada em .env.local — não exibida)')
