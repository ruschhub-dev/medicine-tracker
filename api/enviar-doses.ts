// Função serverless (Vercel) chamada com frequência pelo pg_cron do Supabase:
// notifica as doses cujo horário chegou (janela de 1h) e ainda não foram avisadas.
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const UNI: Record<string, string> = {
  ml: 'mL', comprimidos: 'comp.', capsulas: 'cáps.', doses: 'doses',
  gotas: 'gotas', g: 'g', aplicacoes: 'aplic.', unidade: 'un.',
}

function hojeBrasilia(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
}

export default async function handler(req: any, res: any) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'não autorizado' })
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPublic = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!url || !serviceKey || !vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'variáveis de ambiente ausentes' })
  }

  const supabase = createClient(url, serviceKey)
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:ruschhub@gmail.com', vapidPublic, vapidPrivate)

  // Garante que as doses de hoje existem (mesmo sem ninguém abrir o app).
  await supabase.rpc('gerar_doses', { dia: hojeBrasilia() })

  const agora = new Date()
  const limite = new Date(agora.getTime() - 60 * 60 * 1000) // janela de 1h para trás
  const { data: doses, error } = await supabase
    .from('doses')
    .select('id, prevista_em, tratamento:tratamentos(dose, perfil:perfis(nome), medicamento:medicamentos(nome,unidade))')
    .eq('status', 'pendente')
    .is('notificada_em', null)
    .lte('prevista_em', agora.toISOString())
    .gt('prevista_em', limite.toISOString())
  if (error) return res.status(500).json({ error: error.message })

  const { data: subs } = await supabase.from('push_subscriptions').select('endpoint,p256dh,auth')
  const inscricoes = (subs as any[]) || []

  let enviados = 0
  for (const d of (doses as any[]) || []) {
    const t = d.tratamento
    const nome = t?.medicamento?.nome ?? 'Remédio'
    const unidade = UNI[t?.medicamento?.unidade] ?? (t?.medicamento?.unidade ?? '')
    const pessoa = t?.perfil?.nome ? ` — ${t.perfil.nome}` : ''
    const payload = JSON.stringify({
      title: '💊 Hora do remédio',
      body: `${nome} ${t?.dose ?? ''} ${unidade}${pessoa}`.replace(/\s+/g, ' ').trim(),
      url: '/hoje',
      tag: `dose-${d.id}`,
    })
    for (const s of inscricoes) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        enviados++
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        }
      }
    }
    await supabase.from('doses').update({ notificada_em: new Date().toISOString() }).eq('id', d.id)
  }

  return res.status(200).json({ doses: (doses as any[])?.length ?? 0, enviados })
}
