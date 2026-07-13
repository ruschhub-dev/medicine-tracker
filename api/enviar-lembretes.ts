// Função serverless (Vercel) agendada por Cron: procura remédios vencendo/vencidos
// e envia Web Push aos aparelhos inscritos. Lê o Supabase com a service role.
import webpush from 'web-push'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

type ItemEstoque = {
  id: string
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
    .select('id,data_validade,data_abertura,validade_apos_aberto_dias,medicamento:medicamentos(nome,concentracao)')
    .eq('status', 'ativo')
  if (error) return res.status(500).json({ error: error.message })

  const criticos = ((itens as any[]) || [])
    .map((i) => ({ i: i as ItemEstoque, d: diasPara(i as ItemEstoque) }))
    .filter((x) => x.d <= DIAS_ANTECEDENCIA)
    .sort((a, b) => a.d - b.d)

  if (criticos.length === 0) {
    return res.status(200).json({ enviados: 0, motivo: 'nada vencendo' })
  }

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

  const { data: subs } = await supabase.from('push_subscriptions').select('endpoint,p256dh,auth')
  const payload = JSON.stringify({ title, body, url: '/descarte', tag: 'validade' })

  let enviados = 0
  for (const s of (subs as any[]) || []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      )
      enviados++
    } catch (e: any) {
      // Inscrição expirada/inválida: remove
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }
  }

  // E-mail (opcional): resumo por e-mail se GMAIL_USER + GMAIL_APP_PASSWORD existirem.
  let emails = 0
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD
  if (gmailUser && gmailPass) {
    try {
      const { data: usersData } = await supabase.auth.admin.listUsers()
      const destinatarios = ((usersData?.users || []).map((u: any) => u.email).filter(Boolean)) as string[]
      if (destinatarios.length > 0) {
        const linhas = criticos.map(({ i, d }) => {
          const nome = i.medicamento?.nome ?? 'Remédio'
          const quando = d < 0 ? `vencido há ${-d} dia(s)` : d === 0 ? 'vence hoje' : `vence em ${d} dias`
          return `<li><strong>${nome}</strong> — ${quando}</li>`
        }).join('')
        const html = '<h2>💊 Remédios da Família</h2>'
          + `<p>${criticos.length} remédio(s) para conferir:</p><ul>${linhas}</ul>`
          + '<p><a href="https://home-medicine-stock-tracker.vercel.app/descarte">Abrir o app</a></p>'
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPass },
        })
        await transporter.sendMail({
          from: `Remédios da Família <${gmailUser}>`,
          to: destinatarios.join(','),
          subject: title,
          html,
        })
        emails = destinatarios.length
      }
    } catch {
      // Não derruba o job se o e-mail falhar.
    }
  }

  return res.status(200).json({ enviados, emails, criticos: criticos.length, vencidos })
}
