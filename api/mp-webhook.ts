// Webhook do Mercado Pago: recebe os avisos de assinatura, confere o status
// direto na API do MP (não confia no payload) e atualiza o plano da família.
// Configure a URL deste endpoint nas notificações do Mercado Pago.
// Env: MP_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL.
import { createClient } from '@supabase/supabase-js'

function mapStatus(s: string): string {
  if (s === 'authorized') return 'ativa'
  if (s === 'paused') return 'pausada'
  if (s === 'cancelled') return 'cancelada'
  return 'pendente'
}

export default async function handler(req: any, res: any) {
  const mpToken = process.env.MP_ACCESS_TOKEN
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  // Sempre responde 200 rápido para o MP não ficar reenviando.
  if (!mpToken || !url || !serviceKey) return res.status(200).json({ ok: false })

  const body = typeof req.body === 'string'
    ? (() => { try { return JSON.parse(req.body || '{}') } catch { return {} } })()
    : (req.body || {})

  const tipo = String(req.query?.type || req.query?.topic || body?.type || '')
  const id = req.query?.['data.id'] || body?.data?.id || req.query?.id

  // Só tratamos eventos de assinatura (preapproval) por enquanto.
  if (!id || !tipo.includes('preapproval')) return res.status(200).json({ ok: true, ignorado: true })

  try {
    const r = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    })
    const p = await r.json()
    const familiaId = p.external_reference
    if (!familiaId) return res.status(200).json({ ok: true })

    const supabase = createClient(url, serviceKey)
    const ativa = p.status === 'authorized'
    const planoAte = ativa
      ? (p.next_payment_date || new Date(Date.now() + 35 * 86_400_000).toISOString())
      : null

    await supabase.from('assinaturas').upsert({
      familia_id: familiaId,
      provider: 'mercadopago',
      preapproval_id: String(id),
      payer_email: p.payer_email ?? null,
      status: mapStatus(p.status),
      current_period_end: planoAte,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'preapproval_id' })

    await supabase.from('familias')
      .update({ plano: ativa ? 'premium' : 'gratis', plano_ate: planoAte })
      .eq('id', familiaId)

    return res.status(200).json({ ok: true, familia: familiaId, status: p.status })
  } catch (e: any) {
    return res.status(200).json({ ok: false, erro: e?.message })
  }
}
