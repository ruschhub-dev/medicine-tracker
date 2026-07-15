// Início da assinatura Premium (Mercado Pago). O app não toca em cartão:
// a função serverless cria a assinatura e devolve o link de checkout hospedado.
import { supabase } from './supabase'
import { getFamiliaAtiva } from './familia'

export async function iniciarAssinatura(): Promise<string> {
  if (!supabase) throw new Error('A assinatura fica disponível quando você entra com sua conta.')
  const familiaId = getFamiliaAtiva()
  if (!familiaId) throw new Error('Nenhuma família ativa.')

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const r = await fetch('/api/mp-criar-assinatura', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
    body: JSON.stringify({ familia_id: familiaId }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Não foi possível iniciar a assinatura agora.')
  return j.init_point as string
}
