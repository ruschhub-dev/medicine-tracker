// Slot de anúncio — só aparece para o plano GRÁTIS e apenas se o AdSense estiver
// configurado (VITE_ADSENSE_CLIENT/SLOT). Premium remove os anúncios. Pedimos
// anúncios NÃO personalizados (LGPD). Sem as chaves, o componente some.
import { useEffect } from 'react'
import { useFamilia } from '../lib/familiaContext'

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
const SLOT = import.meta.env.VITE_ADSENSE_SLOT as string | undefined
export const adsConfigurado = Boolean(CLIENT && SLOT)

declare global {
  interface Window { adsbygoogle?: any }
}

let scriptPromise: Promise<void> | null = null
function carregarAdsense(client: string): Promise<void> {
  if (typeof window !== 'undefined' && window.adsbygoogle) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`
    s.async = true
    s.crossOrigin = 'anonymous'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Falha ao carregar anúncios'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

export default function AdSlot() {
  const { premium } = useFamilia()

  useEffect(() => {
    if (!adsConfigurado || premium) return
    carregarAdsense(CLIENT as string).then(() => {
      try {
        window.adsbygoogle = window.adsbygoogle || []
        window.adsbygoogle.requestNonPersonalizedAds = 1
        window.adsbygoogle.push({})
      } catch { /* ignore */ }
    }).catch(() => { /* ignore */ })
  }, [premium])

  if (!adsConfigurado || premium) return null

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', minHeight: 90 }}
      data-ad-client={CLIENT}
      data-ad-slot={SLOT}
      data-ad-format="auto"
      data-full-width-responsive="true"
      data-npa="1"
    />
  )
}
