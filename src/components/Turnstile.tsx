// CAPTCHA (Cloudflare Turnstile) — opcional, ligado por env.
// Só aparece se VITE_TURNSTILE_SITE_KEY estiver definido (e o CAPTCHA estiver
// habilitado no Supabase Auth). Sem a chave, o componente some e o app segue igual.
import { useEffect, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
export const captchaAtivo = Boolean(SITE_KEY)

declare global {
  interface Window { turnstile?: any }
}

let scriptPromise: Promise<void> | null = null
function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Falha ao carregar o CAPTCHA'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

export default function Turnstile({ onToken }: { onToken: (t: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelado = false
    carregarScript().then(() => {
      if (cancelado || !ref.current || !window.turnstile) return
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
    }).catch(() => onToken(null))
    return () => {
      cancelado = true
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch { /* ignore */ }
      }
    }
    // onToken vem estável (setstate do pai)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!SITE_KEY) return null
  return <div ref={ref} style={{ minHeight: 65, display: 'flex', justifyContent: 'center' }} />
}
