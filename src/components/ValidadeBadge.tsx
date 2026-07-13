import { nivelValidade, textoValidade, type NivelValidade } from '../lib/dates'
import type { ItemEstoque } from '../lib/types'

const BADGE_CLASS: Record<NivelValidade, string> = {
  vencido: 'badge-danger', critico: 'badge-danger', atencao: 'badge-warn', ok: 'badge-ok',
}

const STRIPE_CLASS: Record<NivelValidade, string> = {
  vencido: 'stripe-danger', critico: 'stripe-danger', atencao: 'stripe-warn', ok: 'stripe-ok',
}

export function stripeClass(item: Parameters<typeof nivelValidade>[0]): string {
  return `stripe ${STRIPE_CLASS[nivelValidade(item)]}`
}

export default function ValidadeBadge({ item }: { item: ItemEstoque }) {
  const nivel = nivelValidade(item)
  return <span className={`badge ${BADGE_CLASS[nivel]}`}>{textoValidade(item)}</span>
}
