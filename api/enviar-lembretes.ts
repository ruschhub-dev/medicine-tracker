// Função serverless (Vercel) agendada por Cron: por FAMÍLIA, procura remédios
// vencendo/vencidos e avisa só os aparelhos/e-mails daquela família. Service role.
import webpush from 'web-push'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import { subsPorFamilia, emailsPorFamilia, enviarPush } from './_familias'

type ItemEstoque = {
  id: string
  familia_id: string
  data_validade: string
  data_abertura: string | null
  validade_apos_aberto_dias: number | null
  medicamento: { nome: string; concentracao: string | null } | null
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
    const n = await enviarPush(webpush, supabase, subs, payload)
    enviados += n
    if (n > 0) familiasNotificadas++

    // E-mail: só para os membros desta família.
    if (transporter) {
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
