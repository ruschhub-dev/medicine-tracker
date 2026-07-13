// Cálculos e formatação de validade
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { ItemEstoque } from './types'

/**
 * Validade efetiva = a data que vier primeiro entre:
 *  - a validade impressa na caixa, e
 *  - (data de abertura + validade após aberto), quando informadas.
 * Xaropes, colírios e suspensões costumam valer bem menos depois de abertos.
 */
export function validadeEfetiva(item: Pick<ItemEstoque,
  'data_validade' | 'data_abertura' | 'validade_apos_aberto_dias'>): Date {
  const caixa = parseISO(item.data_validade)
  if (item.data_abertura && item.validade_apos_aberto_dias != null) {
    const aposAberto = addDays(parseISO(item.data_abertura), item.validade_apos_aberto_dias)
    return aposAberto < caixa ? aposAberto : caixa
  }
  return caixa
}

export function diasParaVencer(item: Parameters<typeof validadeEfetiva>[0]): number {
  return differenceInCalendarDays(validadeEfetiva(item), new Date())
}

export type NivelValidade = 'vencido' | 'critico' | 'atencao' | 'ok'

/** Classifica a urgência da validade para colorir e alertar. */
export function nivelValidade(item: Parameters<typeof validadeEfetiva>[0]): NivelValidade {
  const dias = diasParaVencer(item)
  if (dias < 0) return 'vencido'
  if (dias <= 30) return 'critico'
  if (dias <= 60) return 'atencao'
  return 'ok'
}

export const NIVEL_LABEL: Record<NivelValidade, string> = {
  vencido: 'Vencido', critico: 'Vence em breve', atencao: 'Atenção', ok: 'Em dia',
}

export function estoqueBaixo(item: { estoque_minimo: number | null; quantidade_atual: number }): boolean {
  return item.estoque_minimo != null && item.quantidade_atual <= item.estoque_minimo
}

export function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return format(parseISO(iso), 'dd/MM/yyyy')
}

/** Texto amigável: "vence em 12 dias", "vence hoje", "vencido há 3 dias". */
export function textoValidade(item: Parameters<typeof validadeEfetiva>[0]): string {
  const dias = diasParaVencer(item)
  if (dias < 0) return `vencido há ${Math.abs(dias)} dia(s)`
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return `vence em ${dias} dias`
}

export function hojeISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Data de hoje no fuso de Brasília (UTC-3), como 'yyyy-MM-dd'. */
export function hojeBrasilia(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
}
