// Camada de acesso a dados — agora escopada por família (multi-tenant).
// Modo local (localStorage) para testar sem nuvem; modo Supabase quando configurado.
// A família ativa vem de lib/familia.ts; os dados são filtrados/carimbados por ela.
import type {
  Medicamento, ItemEstoque, ItemEstoqueCompleto, Perfil, Consumo, ConsumoCompleto,
  Tratamento, TratamentoCompleto, Dose, DoseCompleta, StatusDose,
} from './types'
import { hasSupabase } from './supabase'
import { supabaseRepo } from './supabaseRepo'
import { garantirFamiliaLocal } from './familia'
import { hojeBrasilia } from './dates'

const LOCAL_USER = 'local-user'
const dowDe = (dia: string) => new Date(dia + 'T12:00:00Z').getUTCDay()

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2)
const nowISO = () => new Date().toISOString()

export type NovoMedicamento = Omit<Medicamento, 'id' | 'created_at' | 'status' | 'familia_id' | 'criado_por'> & { id?: string }
export type NovoItemEstoque = Omit<ItemEstoque, 'id' | 'created_at' | 'updated_at'>
export type NovoTratamento = Omit<Tratamento, 'id' | 'created_at'>

export interface Repo {
  // Catálogo
  listMedicamentos(): Promise<Medicamento[]>
  findMedicamentoByBarcode(codigo: string): Promise<Medicamento | null>
  upsertMedicamento(m: NovoMedicamento): Promise<Medicamento>
  uploadFoto(file: File): Promise<string>
  // Moderação do catálogo (admin)
  listPendentes(): Promise<Medicamento[]>
  aprovarMedicamento(id: string): Promise<void>
  rejeitarMedicamento(id: string): Promise<void>
  // Estoque
  listEstoque(incluirInativos?: boolean): Promise<ItemEstoqueCompleto[]>
  getEstoqueItem(id: string): Promise<ItemEstoqueCompleto | null>
  addEstoque(item: NovoItemEstoque): Promise<ItemEstoque>
  updateEstoque(id: string, patch: Partial<ItemEstoque>): Promise<void>
  descartarEstoque(id: string): Promise<void>
  // Consumo
  registrarConsumo(estoqueId: string, quantidade: number, perfilId: string | null, observacao?: string): Promise<void>
  listConsumo(limite?: number): Promise<ConsumoCompleto[]>
  // Perfis
  listPerfis(): Promise<Perfil[]>
  addPerfil(nome: string, tipo: Perfil['tipo']): Promise<Perfil>
  removerPerfil(id: string): Promise<void>
  // Tratamentos / doses
  listTratamentos(): Promise<TratamentoCompleto[]>
  addTratamento(t: NovoTratamento): Promise<Tratamento>
  updateTratamento(id: string, patch: Partial<Tratamento>): Promise<void>
  deleteTratamento(id: string): Promise<void>
  gerarDosesHoje(): Promise<void>
  listDosesHoje(): Promise<DoseCompleta[]>
  listDosesPeriodo(desde: string): Promise<DoseCompleta[]>
  marcarDose(doseId: string, status: StatusDose): Promise<void>
}

// ---------------------------------------------------------------------------
// Implementação local (localStorage) — escopada pela família ativa
// ---------------------------------------------------------------------------

const KEYS = {
  med: 'rf_medicamentos', est: 'rf_estoque', perf: 'rf_perfis',
  cons: 'rf_consumo', seeded: 'rf_seeded_v2',
  trat: 'rf_tratamentos', doses: 'rf_doses',
}

function load<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]') as T[] } catch { return [] }
}
function save<T>(key: string, data: T[]) { localStorage.setItem(key, JSON.stringify(data)) }

/** Id da família ativa no modo local (cria a "Minha Família" na 1ª vez). */
const fid = () => garantirFamiliaLocal()

/** Só o catálogo visível para a família ativa: aprovados (globais) + os dela. */
function medsVisiveis(): Medicamento[] {
  const f = fid()
  return load<Medicamento>(KEYS.med).filter(m => m.status === 'aprovado' || m.familia_id === f)
}

function joinMed(item: ItemEstoque, meds: Medicamento[]): ItemEstoqueCompleto {
  const medicamento = meds.find(m => m.id === item.medicamento_id)!
  return { ...item, medicamento }
}

function joinDose(d: Dose, trats: Tratamento[], meds: Medicamento[], perfis: Perfil[]): DoseCompleta {
  const t = trats.find(x => x.id === d.tratamento_id)
  const med = meds.find(m => m.id === t?.medicamento_id)
  return {
    ...d,
    perfil_nome: perfis.find(p => p.id === t?.perfil_id)?.nome ?? null,
    medicamento_nome: med?.nome ?? 'Removido',
    medicamento_unidade: med?.unidade ?? 'unidade',
    medicamento_id: t?.medicamento_id ?? '',
    dose: t?.dose ?? 0,
  }
}

const localRepo: Repo = {
  async listMedicamentos() {
    return medsVisiveis().sort((a, b) => a.nome.localeCompare(b.nome))
  },

  async findMedicamentoByBarcode(codigo) {
    const achados = medsVisiveis().filter(m => m.codigo_barras === codigo)
    return achados.find(m => m.status === 'aprovado') ?? achados[0] ?? null
  },

  async upsertMedicamento(input) {
    const meds = load<Medicamento>(KEYS.med)
    const f = fid()
    const idx = meds.findIndex(m =>
      (input.id && m.id === input.id) ||
      (input.codigo_barras && m.codigo_barras === input.codigo_barras &&
        (m.status === 'aprovado' || m.familia_id === f)))
    if (idx >= 0) {
      const existente = meds[idx]
      // Não mexe no catálogo global; só atualiza a própria proposta da família.
      if (existente.status === 'aprovado') return existente
      const atualizado: Medicamento = {
        ...existente, ...input,
        id: existente.id, status: existente.status,
        familia_id: existente.familia_id, criado_por: existente.criado_por,
      }
      meds[idx] = atualizado
      save(KEYS.med, meds)
      return atualizado
    }
    // Remédio novo = proposta pendente da família ativa.
    const novo: Medicamento = {
      ...input, id: input.id ?? uid(), created_at: nowISO(),
      status: 'pendente', familia_id: f, criado_por: LOCAL_USER,
    }
    meds.push(novo)
    save(KEYS.med, meds)
    return novo
  },

  async uploadFoto(file) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Falha ao ler a imagem'))
      reader.readAsDataURL(file)
    })
  },

  async listPendentes() {
    return load<Medicamento>(KEYS.med)
      .filter(m => m.status === 'pendente')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  async aprovarMedicamento(id) {
    const meds = load<Medicamento>(KEYS.med)
    const idx = meds.findIndex(m => m.id === id)
    if (idx < 0) return
    meds[idx] = { ...meds[idx], status: 'aprovado', familia_id: null }
    save(KEYS.med, meds)
  },

  async rejeitarMedicamento(id) {
    const meds = load<Medicamento>(KEYS.med)
    const idx = meds.findIndex(m => m.id === id)
    if (idx < 0) return
    meds[idx] = { ...meds[idx], status: 'rejeitado' }
    save(KEYS.med, meds)
  },

  async listEstoque(incluirInativos = false) {
    const f = fid()
    const meds = load<Medicamento>(KEYS.med)
    return load<ItemEstoque>(KEYS.est)
      .filter(i => i.familia_id === f)
      .filter(i => incluirInativos || i.status === 'ativo')
      .map(i => joinMed(i, meds))
  },

  async getEstoqueItem(id) {
    const item = load<ItemEstoque>(KEYS.est).find(i => i.id === id && i.familia_id === fid())
    if (!item) return null
    return joinMed(item, load<Medicamento>(KEYS.med))
  },

  async addEstoque(input) {
    const itens = load<ItemEstoque>(KEYS.est)
    const novo: ItemEstoque = { ...input, familia_id: fid(), id: uid(), created_at: nowISO(), updated_at: nowISO() }
    itens.push(novo)
    save(KEYS.est, itens)
    return novo
  },

  async updateEstoque(id, patch) {
    const itens = load<ItemEstoque>(KEYS.est)
    const idx = itens.findIndex(i => i.id === id)
    if (idx < 0) return
    itens[idx] = { ...itens[idx], ...patch, updated_at: nowISO() }
    save(KEYS.est, itens)
  },

  async descartarEstoque(id) {
    await this.updateEstoque(id, { status: 'descartado' })
  },

  async registrarConsumo(estoqueId, quantidade, perfilId, observacao) {
    const itens = load<ItemEstoque>(KEYS.est)
    const idx = itens.findIndex(i => i.id === estoqueId)
    if (idx < 0) return
    const restante = Math.max(0, itens[idx].quantidade_atual - quantidade)
    itens[idx] = {
      ...itens[idx],
      quantidade_atual: restante,
      status: restante === 0 ? 'esgotado' : itens[idx].status,
      updated_at: nowISO(),
    }
    save(KEYS.est, itens)

    const consumos = load<Consumo>(KEYS.cons)
    consumos.push({
      id: uid(), familia_id: fid(), estoque_id: estoqueId, perfil_id: perfilId,
      quantidade, datahora: nowISO(), observacao: observacao ?? null,
    })
    save(KEYS.cons, consumos)
  },

  async listConsumo(limite = 50) {
    const f = fid()
    const meds = load<Medicamento>(KEYS.med)
    const itens = load<ItemEstoque>(KEYS.est)
    const perfis = load<Perfil>(KEYS.perf)
    return load<Consumo>(KEYS.cons)
      .filter(c => c.familia_id === f)
      .sort((a, b) => b.datahora.localeCompare(a.datahora))
      .slice(0, limite)
      .map(c => {
        const item = itens.find(i => i.id === c.estoque_id)
        const med = item && meds.find(m => m.id === item.medicamento_id)
        const perfil = perfis.find(p => p.id === c.perfil_id)
        return {
          ...c,
          medicamento_nome: med?.nome ?? 'Removido',
          unidade: med?.unidade ?? 'unidade',
          perfil_nome: perfil?.nome ?? null,
        }
      })
  },

  async listPerfis() {
    const f = fid()
    return load<Perfil>(KEYS.perf).filter(p => p.familia_id === f)
  },

  async addPerfil(nome, tipo) {
    const perfis = load<Perfil>(KEYS.perf)
    const novo: Perfil = { id: uid(), familia_id: fid(), nome, tipo, data_nascimento: null, cor: null, created_at: nowISO() }
    perfis.push(novo)
    save(KEYS.perf, perfis)
    return novo
  },

  async removerPerfil(id) {
    save(KEYS.perf, load<Perfil>(KEYS.perf).filter(p => p.id !== id))
    const consumos = load<Consumo>(KEYS.cons).map(c => c.perfil_id === id ? { ...c, perfil_id: null } : c)
    save(KEYS.cons, consumos)
  },

  async listTratamentos() {
    const f = fid()
    const meds = load<Medicamento>(KEYS.med)
    const perfis = load<Perfil>(KEYS.perf)
    return load<Tratamento>(KEYS.trat)
      .filter(t => t.familia_id === f)
      .map(t => ({
        ...t,
        perfil_nome: perfis.find(p => p.id === t.perfil_id)?.nome ?? null,
        medicamento: meds.find(m => m.id === t.medicamento_id)!,
      }))
  },

  async addTratamento(input) {
    const trats = load<Tratamento>(KEYS.trat)
    const novo: Tratamento = { ...input, familia_id: fid(), id: uid(), created_at: nowISO() }
    trats.push(novo)
    save(KEYS.trat, trats)
    return novo
  },

  async updateTratamento(id, patch) {
    const trats = load<Tratamento>(KEYS.trat)
    const idx = trats.findIndex(t => t.id === id)
    if (idx < 0) return
    trats[idx] = { ...trats[idx], ...patch }
    save(KEYS.trat, trats)
  },

  async deleteTratamento(id) {
    save(KEYS.trat, load<Tratamento>(KEYS.trat).filter(t => t.id !== id))
    save(KEYS.doses, load<Dose>(KEYS.doses).filter(d => d.tratamento_id !== id))
  },

  async gerarDosesHoje() {
    const f = fid()
    const dia = hojeBrasilia()
    const trats = load<Tratamento>(KEYS.trat).filter(t =>
      t.familia_id === f &&
      t.ativo && t.data_inicio <= dia && (!t.data_fim || t.data_fim >= dia) &&
      (!t.dias_semana || t.dias_semana.length === 0 || t.dias_semana.includes(dowDe(dia))))
    const doses = load<Dose>(KEYS.doses)
    for (const t of trats) {
      for (const h of t.horarios) {
        const prevista = new Date(`${dia}T${h}:00-03:00`).toISOString()
        if (!doses.some(d => d.tratamento_id === t.id && d.prevista_em === prevista)) {
          doses.push({
            id: uid(), familia_id: f, tratamento_id: t.id, data: dia, horario: h,
            prevista_em: prevista, status: 'pendente', tomada_em: null, notificada_em: null,
          })
        }
      }
    }
    save(KEYS.doses, doses)
  },

  async listDosesHoje() {
    await this.gerarDosesHoje()
    const f = fid()
    const dia = hojeBrasilia()
    const trats = load<Tratamento>(KEYS.trat)
    const meds = load<Medicamento>(KEYS.med)
    const perfis = load<Perfil>(KEYS.perf)
    return load<Dose>(KEYS.doses)
      .filter(d => d.familia_id === f && d.data === dia)
      .sort((a, b) => a.prevista_em.localeCompare(b.prevista_em))
      .map(d => joinDose(d, trats, meds, perfis))
  },

  async listDosesPeriodo(desde) {
    const f = fid()
    const trats = load<Tratamento>(KEYS.trat)
    const meds = load<Medicamento>(KEYS.med)
    const perfis = load<Perfil>(KEYS.perf)
    return load<Dose>(KEYS.doses)
      .filter(d => d.familia_id === f && d.data >= desde)
      .sort((a, b) => b.prevista_em.localeCompare(a.prevista_em))
      .map(d => joinDose(d, trats, meds, perfis))
  },

  async marcarDose(doseId, status) {
    const doses = load<Dose>(KEYS.doses)
    const idx = doses.findIndex(d => d.id === doseId)
    if (idx < 0) return
    if (status === 'tomado') {
      const trat = load<Tratamento>(KEYS.trat).find(t => t.id === doses[idx].tratamento_id)
      if (trat) {
        const item = load<ItemEstoque>(KEYS.est)
          .filter(i => i.medicamento_id === trat.medicamento_id && i.status === 'ativo' && i.quantidade_atual > 0)
          .sort((a, b) => a.data_validade.localeCompare(b.data_validade))[0]
        if (item) await this.registrarConsumo(item.id, trat.dose, trat.perfil_id ?? null, 'Dose programada')
      }
    }
    doses[idx] = { ...doses[idx], status, tomada_em: status === 'tomado' ? nowISO() : null }
    save(KEYS.doses, doses)
  },
}

// ---------------------------------------------------------------------------
// Dados de exemplo (apenas modo local, na primeira execução)
// ---------------------------------------------------------------------------

function seedLocal() {
  if (localStorage.getItem(KEYS.seeded)) return
  const f = garantirFamiliaLocal()
  const diasAFrente = (n: number) => {
    const d = new Date(); d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }

  // Catálogo já aprovado (global) — como o seed do banco.
  const g = (m: Omit<Medicamento, 'status' | 'familia_id' | 'criado_por'>): Medicamento =>
    ({ ...m, status: 'aprovado', familia_id: null, criado_por: null })

  const meds: Medicamento[] = [
    g({ id: 'm1', codigo_barras: '7891058001452', nome: 'Dipirona Monoidratada', principio_ativo: 'Dipirona', concentracao: '500 mg', forma: 'comprimido', unidade: 'comprimidos', tarja: 'sem_tarja', requer_receita: false, indicacao: 'Dor e febre', bula_url: null, foto_url: null, created_at: nowISO() }),
    g({ id: 'm2', codigo_barras: '7896714209104', nome: 'Paracetamol', principio_ativo: 'Paracetamol', concentracao: '750 mg', forma: 'comprimido', unidade: 'comprimidos', tarja: 'sem_tarja', requer_receita: false, indicacao: 'Dor e febre', bula_url: null, foto_url: null, created_at: nowISO() }),
    g({ id: 'm3', codigo_barras: '7891142174635', nome: 'Amoxicilina', principio_ativo: 'Amoxicilina', concentracao: '250 mg/5 mL', forma: 'suspensao', unidade: 'ml', tarja: 'vermelha', requer_receita: true, indicacao: 'Antibiótico', bula_url: null, foto_url: null, created_at: nowISO() }),
    g({ id: 'm4', codigo_barras: '7896004704005', nome: 'Loratadina', principio_ativo: 'Loratadina', concentracao: '10 mg', forma: 'comprimido', unidade: 'comprimidos', tarja: 'sem_tarja', requer_receita: false, indicacao: 'Alergia', bula_url: null, foto_url: null, created_at: nowISO() }),
  ]

  const est: ItemEstoque[] = [
    { id: 'e1', familia_id: f, medicamento_id: 'm1', quantidade_atual: 18, quantidade_inicial: 20, lote: 'AB123', data_validade: diasAFrente(400), data_abertura: null, validade_apos_aberto_dias: null, local: 'Armário do banheiro', estoque_minimo: 4, observacao: null, status: 'ativo', created_at: nowISO(), updated_at: nowISO() },
    { id: 'e2', familia_id: f, medicamento_id: 'm2', quantidade_atual: 3, quantidade_inicial: 20, lote: null, data_validade: diasAFrente(20), data_abertura: null, validade_apos_aberto_dias: null, local: 'Gaveta da cozinha', estoque_minimo: 5, observacao: 'Quase acabando', status: 'ativo', created_at: nowISO(), updated_at: nowISO() },
    { id: 'e3', familia_id: f, medicamento_id: 'm3', quantidade_atual: 100, quantidade_inicial: 150, lote: 'XR55', data_validade: diasAFrente(300), data_abertura: diasAFrente(-20), validade_apos_aberto_dias: 14, local: 'Geladeira', estoque_minimo: null, observacao: 'Já aberto', status: 'ativo', created_at: nowISO(), updated_at: nowISO() },
    { id: 'e4', familia_id: f, medicamento_id: 'm4', quantidade_atual: 10, quantidade_inicial: 12, lote: null, data_validade: diasAFrente(-10), data_abertura: null, validade_apos_aberto_dias: null, local: 'Pote azul', estoque_minimo: null, observacao: null, status: 'ativo', created_at: nowISO(), updated_at: nowISO() },
  ]

  const perfis: Perfil[] = [
    { id: 'p1', familia_id: f, nome: 'Papai', tipo: 'adulto', data_nascimento: null, cor: null, created_at: nowISO() },
    { id: 'p2', familia_id: f, nome: 'Mamãe', tipo: 'adulto', data_nascimento: null, cor: null, created_at: nowISO() },
    { id: 'p3', familia_id: f, nome: 'Filha 1', tipo: 'crianca', data_nascimento: null, cor: null, created_at: nowISO() },
    { id: 'p4', familia_id: f, nome: 'Filha 2', tipo: 'crianca', data_nascimento: null, cor: null, created_at: nowISO() },
  ]

  save(KEYS.med, meds)
  save(KEYS.est, est)
  save(KEYS.perf, perfis)
  localStorage.setItem(KEYS.seeded, '1')
}

if (!hasSupabase && typeof localStorage !== 'undefined') {
  seedLocal()
}

// Ponto único de troca: Supabase quando configurado; senão, modo local.
export const repo: Repo = hasSupabase ? supabaseRepo : localRepo

/** Indica se estamos no modo local (dados só neste navegador). */
export const modoLocal = !hasSupabase
