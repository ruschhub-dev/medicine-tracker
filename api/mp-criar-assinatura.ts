// Cria uma assinatura Premium no Mercado Pago e devolve o link de checkout.
// O app nunca vê o cartão — o pagamento acontece na página do Mercado Pago.
// Env: MP_ACCESS_TOKEN (secreto), SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL,
//      APP_URL, MP_PRICE (ex.: 9.90), MP_REASON (opcional).
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'método não permitido' })

  const mpToken = process.env.MP_ACCESS_TOKEN
  if (!mpToken) return res.status(501).json({ error: 'Assinatura ainda não configurada. Volte em breve.' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return res.status(500).json({ error: 'variáveis de ambiente ausentes' })

  const supabase = createClient(url, serviceKey)

  // Identifica o usuário pelo token do Supabase enviado pelo app.
  const jwt = (req.headers.authorization || '').replace('Bearer ', '')
  const { data: userData } = await supabase.auth.getUser(jwt)
  const user = userData?.user
  if (!user) return res.status(401).json({ error: 'não autenticado' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const familiaId = body.familia_id
  if (!familiaId) return res.status(400).json({ error: 'familia_id ausente' })

  // Só um membro da família pode assinar por ela.
  const { data: membro } = await supabase.from('membros')
    .select('user_id').eq('familia_id', familiaId).eq('user_id', user.id).maybeSingle()
  if (!membro) return res.status(403).json({ error: 'você não é membro desta família' })

  const preco = Number(process.env.MP_PRICE || '9.90')
  const appUrl = process.env.APP_URL || ''
  const preapproval = {
    reason: process.env.MP_REASON || 'Remédios em casa — Premium',
    external_reference: familiaId,
    payer_email: user.email,
    back_url: `${appUrl}/premium`,
    status: 'pending',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: preco,
      currency_id: 'BRL',
    },
  }

  const r = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
    body: JSON.stringify(preapproval),
  })
  const mp = await r.json().catch(() => ({}))
  if (!r.ok) {
    return res.status(502).json({ error: mp?.message || 'Erro ao criar a assinatura no Mercado Pago' })
  }

  // Guarda a assinatura como pendente (o webhook confirma quando for autorizada).
  await supabase.from('assinaturas').upsert({
    familia_id: familiaId,
    provider: 'mercadopago',
    preapproval_id: mp.id,
    payer_email: user.email,
    status: 'pendente',
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'preapproval_id' })

  return res.status(200).json({ init_point: mp.init_point })
}
