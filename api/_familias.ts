// Helpers das notificações multi-família (arquivo com "_" = ignorado pelo roteador da Vercel).
// Resolvem, por família, quais aparelhos (push) e e-mails devem ser avisados —
// via membros → push_subscriptions / auth.users. Assim uma família nunca recebe
// notificação de outra.

export type Sub = { endpoint: string; p256dh: string; auth: string }

/** Mapa familia_id → inscrições push dos membros dela. */
export async function subsPorFamilia(supabase: any): Promise<Map<string, Sub[]>> {
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

/** Mapa familia_id → e-mails dos membros dela (para o resumo por e-mail). */
export async function emailsPorFamilia(supabase: any): Promise<Map<string, string[]>> {
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

/** Envia um payload a uma lista de inscrições, limpando as expiradas. Devolve quantos foram. */
export async function enviarPush(webpush: any, supabase: any, subs: Sub[], payload: string): Promise<number> {
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
