// Função serverless (Vercel) agendada por Cron: por FAMÍLIA, procura remédios
// vencendo/vencidos e avisa só os aparelhos/e-mails daquela família. Service role.
import webpush from 'web-push'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

type ItemEstoque = {
  id: string
  familia_id: string
  data_validade: string
  data_abertura: string | null
  validade_apos_aberto_dias: number | null
  medicamento: { nome: string; concentracao: string | null } | null
}

type Sub = { endpoint: string; p256dh: string; auth: string }

// Mapa familia_id → inscrições push dos membros dela.
async function subsPorFamilia(supabase: any): Promise<Map<string, Sub[]>> {
  const { data: membros } = await supabase.from('membros').select('familia_id, user_id')
  const { data: subs } = await supabase.from('push_subscriptions').select('user_id, endpoint, p256dh, auth')
  const porUsuario = new Map<string, Sub[]>()
  for (const s of (subs as any[]) || []) {
    if (!s.user_id) continue
    const arr = porUsuario.get(s.user_id) || []
    arr.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })
    porUsuario.set(s.user_id, arr)
  }
  const map = new Map<string, Sub[]>()
  for (const m of (membros as any[]) || []) {
    const us = porUsuario.get(m.user_id)
    if (!us) continue
    const arr = map.get(m.familia_id) || []
    arr.push(...us)
    map.set(m.familia_id, arr)
  }
  return map
}

// Mapa familia_id → e-mails dos membros dela (para o resumo por e-mail).
async function emailsPorFamilia(supabase: any): Promise<Map<string, string[]>> {
  const emailPorUsuario = new Map<string, string>()
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) break
    const users = (data?.users as any[]) || []
    for (const u of users) if (u.email) emailPorUsuario.set(u.id, u.email)
    if (users.length < 1000) break
    page++
  }
  const { data: membros } = await supabase.from('membros').select('familia_id, user_id')
  const map = new Map<string, string[]>()
  for (const m of (membros as any[]) || []) {
    const email = emailPorUsuario.get(m.user_id)
    if (!email) continue
    const arr = map.get(m.familia_id) || []
    arr.push(email)
    map.set(m.familia_id, arr)
  }
  return map
}

async function enviarPush(supabase: any, subs: Sub[], payload: string): Promise<number> {
  let enviados = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
      enviados++
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }
  }
  return enviados
}

function validadeEfetiva(i: ItemEstoque): Date {
  const caixa = new Date(i.data_validade)
  if (i.data_abertura && i.validade_apos_aberto_dias != null) {
    const aberto = new Date(i.data_abertura)
    aberto.setDate(aberto.getDate() + i.validade_apos_aberto_dias)
    return aberto < caixa ? aberto : caixa
  }
  return caixa
}

function diasPara(i: ItemEstoque): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const v = validadeEfetiva(i); v.setHours(0, 0, 0, 0)
  return Math.round((v.getTime() - hoje.getTime()) / 86_400_000)
}

const DIAS_ANTECEDENCIA = 15

export default async function handler(req: any, res: any) {
  // Protege o endpoint: o Vercel Cron envia este header quando CRON_SECRET existe.
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

  const { data: itens, error } = await supabase
    .from('estoque')
    .select('id,familia_id,data_validade,data_abertura,validade_apos_aberto_dias,medicamento:medicamentos(nome,concentracao)')
    .eq('status', 'ativo')
  if (error) return res.status(500).json({ error: error.message })

  // Agrupa os itens críticos (≤15 dias ou vencidos) por família.
  const porFamilia = new Map<string, Array<{ i: ItemEstoque; d: number }>>()
  for (const raw of (itens as any[]) || []) {
    const i = raw as ItemEstoque
    const d = diasPara(i)
    if (d > DIAS_ANTECEDENCIA) continue
    const arr = porFamilia.get(i.familia_id) || []
    arr.push({ i, d })
    porFamilia.set(i.familia_id, arr)
  }

  if (porFamilia.size === 0) {
    return res.status(200).json({ familias: 0, enviados: 0, motivo: 'nada vencendo' })
  }

  const subsMap = await subsPorFamilia(supabase)
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD
  const usarEmail = Boolean(gmailUser && gmailPass)
  const emailsMap = usarEmail ? await emailsPorFamilia(supabase) : new Map<string, string[]>()
  // E-mail de lembrete é um recurso Premium: só famílias Premium recebem (push é grátis).
  const premiumSet = new Set<string>()
  if (usarEmail) {
    const { data: fams } = await supabase.from('familias').select('id,plano,plano_ate')
    for (const f of (fams as any[]) || []) {
      if (f.plano === 'premium' && (!f.plano_ate || new Date(f.plano_ate) > new Date())) premiumSet.add(f.id)
    }
  }
  const appUrl = process.env.APP_URL || ''
  const transporter = usarEmail
    ? nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } })
    : null

  let enviados = 0
  let emails = 0
  let familiasNotificadas = 0

  for (const [familiaId, lista] of porFamilia) {
    const criticos = lista.sort((a, b) => a.d - b.d)
    const vencidos = criticos.filter((x) => x.d < 0).length

    const partes = criticos.slice(0, 5).map(({ i, d }) => {
      const nome = i.medicamento?.nome ?? 'Remédio'
      if (d < 0) return `${nome} (vencido)`
      if (d === 0) return `${nome} (vence hoje)`
      return `${nome} (${d}d)`
    })
    const title = vencidos > 0
      ? `⚠️ ${criticos.length} remédio(s) para conferir`
      : `${criticos.length} remédio(s) vencendo`
    let body = partes.join(', ')
    if (criticos.length > 5) body += `… e mais ${criticos.length - 5}`

    const payload = JSON.stringify({ title, body, url: '/descarte', tag: 'validade' })
    const subs = subsMap.get(familiaId) || []
    const n = await enviarPush(supabase, subs, payload)
    enviados += n
    if (n > 0) familiasNotificadas++

    // E-mail: só Premium, e só para os membros desta família.
    if (transporter && premiumSet.has(familiaId)) {
      const destinatarios = emailsMap.get(familiaId) || []
      if (destinatarios.length > 0) {
        try {
          const linhas = criticos.map(({ i, d }) => {
            const nome = i.medicamento?.nome ?? 'Remédio'
            const quando = d < 0 ? `vencido há ${-d} dia(s)` : d === 0 ? 'vence hoje' : `vence em ${d} dias`
            return `<li><strong>${nome}</strong> — ${quando}</li>`
          }).join('')
          const link = appUrl ? `<p><a href="${appUrl}/descarte">Abrir o app</a></p>` : ''
          const html = '<h2>💊 Remédios em casa</h2>'
            + `<p>${criticos.length} remédio(s) para conferir:</p><ul>${linhas}</ul>${link}`
          await transporter.sendMail({
            from: `Remédios em casa <${gmailUser}>`,
            to: destinatarios.join(','),
            subject: title,
            html,
          })
          emails += destinatarios.length
        } catch {
          // Não derruba o job se o e-mail de uma família falhar.
        }
      }
    }
  }

  return res.status(200).json({ familias: familiasNotificadas, enviados, emails })
}
