// Web Push: inscrição/cancelamento de lembretes neste aparelho.
import { supabase } from './supabase'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushSuportado =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  !!VAPID_PUBLIC

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export async function estaInscrito(): Promise<boolean> {
  if (!pushSuportado) return false
  const reg = await navigator.serviceWorker.ready
  return !!(await reg.pushManager.getSubscription())
}

export async function ativarLembretes(): Promise<{ ok: boolean; erro?: string }> {
  if (!pushSuportado || !supabase) return { ok: false, erro: 'Notificações não disponíveis aqui.' }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, erro: 'Permissão de notificação negada.' }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC as string) as BufferSource,
    })
  }

  const json = sub.toJSON()
  const { data } = await supabase.auth.getUser()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_id: data.user?.id ?? null,
    },
    { onConflict: 'endpoint' },
  )
  if (error) return { ok: false, erro: error.message }
  return { ok: true }
}

export async function desativarLembretes(): Promise<void> {
  if (!pushSuportado) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}
