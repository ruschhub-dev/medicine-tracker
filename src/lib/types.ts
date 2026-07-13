// Tipos de dados do app — espelham o esquema em supabase/schema.sql

export type Forma =
  | 'comprimido' | 'capsula' | 'xarope' | 'suspensao' | 'spray' | 'pomada'
  | 'creme' | 'gotas' | 'colirio' | 'injetavel' | 'supositorio' | 'outro'

export type Unidade =
  | 'comprimidos' | 'capsulas' | 'ml' | 'doses' | 'gotas' | 'g' | 'aplicacoes' | 'unidade'

export type Tarja = 'sem_tarja' | 'vermelha' | 'preta'
export type StatusEstoque = 'ativo' | 'esgotado' | 'descartado'
export type TipoPerfil = 'adulto' | 'crianca'

// ---- Multi-família (tenancy) ----
export type StatusMedicamento = 'pendente' | 'aprovado' | 'rejeitado'
export type PlanoFamilia = 'gratis' | 'premium'
export type PapelMembro = 'dono' | 'membro'

export interface Familia {
  id: string
  nome: string
  owner_id: string | null
  plano: PlanoFamilia
  plano_ate: string | null
  created_at: string
}

/** Família do usuário com o papel dele nela (usado no seletor/lista). */
export interface MinhaFamilia extends Familia {
  papel: PapelMembro
}

export interface MembroFamilia {
  familia_id: string
  user_id: string
  papel: PapelMembro
  nome: string | null
  eu: boolean
}

export interface Convite {
  codigo: string
  familia_id: string
  expira_em: string | null
  usos_max: number | null
  usos: number
}

export interface Medicamento {
  id: string
  codigo_barras: string | null
  nome: string
  principio_ativo: string | null
  concentracao: string | null
  forma: Forma | null
  unidade: Unidade
  tarja: Tarja
  requer_receita: boolean
  indicacao: string | null
  bula_url: string | null
  foto_url: string | null
  // Catálogo compartilhado com moderação:
  status: StatusMedicamento          // 'aprovado' = global; 'pendente'/'rejeitado' = da família
  familia_id: string | null          // null = global (aprovado)
  criado_por: string | null
  created_at: string
}

export interface ItemEstoque {
  id: string
  familia_id?: string | null
  medicamento_id: string
  quantidade_atual: number
  quantidade_inicial: number | null
  lote: string | null
  data_validade: string          // ISO 'yyyy-MM-dd'
  data_abertura: string | null   // ISO 'yyyy-MM-dd'
  validade_apos_aberto_dias: number | null
  local: string | null
  estoque_minimo: number | null
  observacao: string | null
  status: StatusEstoque
  created_at: string
  updated_at: string
}

/** Item de estoque com o medicamento embutido (usado nas telas). */
export interface ItemEstoqueCompleto extends ItemEstoque {
  medicamento: Medicamento
}

export interface Perfil {
  id: string
  familia_id?: string | null
  nome: string
  tipo: TipoPerfil
  data_nascimento: string | null
  cor: string | null
  created_at: string
}

export interface Consumo {
  id: string
  familia_id?: string | null
  estoque_id: string
  perfil_id: string | null
  quantidade: number
  datahora: string
  observacao: string | null
}

export interface ConsumoCompleto extends Consumo {
  medicamento_nome: string
  unidade: Unidade
  perfil_nome: string | null
}

// ---- Rótulos amigáveis para a interface ----

export const FORMA_LABEL: Record<Forma, string> = {
  comprimido: 'Comprimido', capsula: 'Cápsula', xarope: 'Xarope',
  suspensao: 'Suspensão', spray: 'Spray', pomada: 'Pomada', creme: 'Creme',
  gotas: 'Gotas', colirio: 'Colírio', injetavel: 'Injetável',
  supositorio: 'Supositório', outro: 'Outro',
}

export const UNIDADE_LABEL: Record<Unidade, string> = {
  comprimidos: 'comprimidos', capsulas: 'cápsulas', ml: 'mL', doses: 'doses',
  gotas: 'gotas', g: 'g', aplicacoes: 'aplicações', unidade: 'unidades',
}

export const TARJA_LABEL: Record<Tarja, string> = {
  sem_tarja: 'Sem tarja', vermelha: 'Tarja vermelha', preta: 'Tarja preta',
}

/** Unidade sugerida para cada forma farmacêutica. */
export const UNIDADE_PADRAO: Record<Forma, Unidade> = {
  comprimido: 'comprimidos', capsula: 'capsulas', xarope: 'ml', suspensao: 'ml',
  spray: 'doses', pomada: 'g', creme: 'g', gotas: 'gotas', colirio: 'ml',
  injetavel: 'doses', supositorio: 'unidade', outro: 'unidade',
}

// ---- Tratamentos (lembrete de tomar remédio) ----

export type StatusDose = 'pendente' | 'tomado' | 'pulado'

export interface Tratamento {
  id: string
  familia_id?: string | null
  perfil_id: string | null
  medicamento_id: string
  dose: number
  horarios: string[]          // 'HH:MM' (hora de Brasília)
  dias_semana: number[] | null // 0=domingo..6=sábado; null = todos os dias
  data_inicio: string
  data_fim: string | null
  ativo: boolean
  observacao: string | null
  created_at: string
}

export interface TratamentoCompleto extends Tratamento {
  perfil_nome: string | null
  medicamento: Medicamento
}

export interface Dose {
  id: string
  familia_id?: string | null
  tratamento_id: string
  data: string
  horario: string
  prevista_em: string
  status: StatusDose
  tomada_em: string | null
  notificada_em: string | null
}

export interface DoseCompleta extends Dose {
  perfil_nome: string | null
  medicamento_nome: string
  medicamento_unidade: Unidade
  medicamento_id: string
  dose: number
}

export const DIAS_SEMANA = [
  { valor: 0, curto: 'Dom' }, { valor: 1, curto: 'Seg' }, { valor: 2, curto: 'Ter' },
  { valor: 3, curto: 'Qua' }, { valor: 4, curto: 'Qui' }, { valor: 5, curto: 'Sex' },
  { valor: 6, curto: 'Sáb' },
]
