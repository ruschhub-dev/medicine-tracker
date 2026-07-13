// Implementação do repositório usando o Supabase (mesma interface Repo do localRepo).
// Escopada pela família ativa (getFamiliaAtiva): filtra selects e carimba inserts.
import { supabase } from './supabase'
import type { Repo } from './repo'
import type {
  Medicamento, ItemEstoque, ItemEstoqueCompleto, Perfil, ConsumoCompleto,
  Tratamento, TratamentoCompleto, DoseCompleta,
} from './types'
import { hojeBrasilia } from './dates'
import { getFamiliaAtiva } from './familia'

function db() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

/** Id da família ativa; erro claro se ninguém escolheu uma ainda. */
function fam(): string {
  const f = getFamiliaAtiva()
  if (!f) throw new Error('Nenhuma família ativa selecionada')
  return f
}

async function meuId(): Promise<string | null> {
  const { data } = await db().auth.getUser()
  return data.user?.id ?? null
}

function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw new Error((res.error as { message?: string }).message ?? 'Erro no Supabase')
  return res.data as T
}

function mapDose(d: Record<string, any>): DoseCompleta {
  return {
    id: d.id, tratamento_id: d.tratamento_id, data: d.data, horario: d.horario,
    prevista_em: d.prevista_em, status: d.status, tomada_em: d.tomada_em, notificada_em: d.notificada_em,
    perfil_nome: d.tratamento?.perfil?.nome ?? null,
    medicamento_nome: d.tratamento?.medicamento?.nome ?? 'Removido',
    medicamento_unidade: d.tratamento?.medicamento?.unidade ?? 'unidade',
    medicamento_id: d.tratamento?.medicamento_id ?? '',
    dose: d.tratamento?.dose ?? 0,
  }
}

const SEL_DOSE = '*, tratamento:tratamentos(dose, medicamento_id, perfil:perfis(nome), medicamento:medicamentos(nome,unidade))'

const SEL_ESTOQUE = '*, medicamento:medicamentos(*)'

export const supabaseRepo: Repo = {
  async listMedicamentos() {
    // Catálogo visível: aprovados (globais) + propostas da família ativa.
    return check(await db().from('medicamentos').select('*')
      .or(`status.eq.aprovado,familia_id.eq.${fam()}`)
      .order('nome')) as Medicamento[]
  },

  async findMedicamentoByBarcode(codigo) {
    const achados = check(await db().from('medicamentos').select('*')
      .eq('codigo_barras', codigo)
      .or(`status.eq.aprovado,familia_id.eq.${fam()}`)) as Medicamento[]
    return (achados ?? []).find(m => m.status === 'aprovado') ?? (achados ?? [])[0] ?? null
  },

  async upsertMedicamento(input) {
    const payload = {
      codigo_barras: input.codigo_barras, nome: input.nome,
      principio_ativo: input.principio_ativo, concentracao: input.concentracao,
      forma: input.forma, unidade: input.unidade, tarja: input.tarja,
      requer_receita: input.requer_receita, indicacao: input.indicacao,
      bula_url: input.bula_url, foto_url: input.foto_url,
    }
    // Existe uma ficha visível para este código? (aprovada global ou proposta da família)
    let existente: Medicamento | null = null
    if (input.id) {
      existente = check(await db().from('medicamentos').select('*').eq('id', input.id).maybeSingle()) as Medicamento | null
    } else if (input.codigo_barras) {
      const achados = check(await db().from('medicamentos').select('*')
        .eq('codigo_barras', input.codigo_barras)
        .or(`status.eq.aprovado,familia_id.eq.${fam()}`)) as Medicamento[]
      existente = (achados ?? []).find(m => m.status === 'aprovado') ?? (achados ?? [])[0] ?? null
    }
    if (existente) {
      if (existente.status === 'aprovado') return existente   // não edita o catálogo global
      return check(await db().from('medicamentos').update(payload).eq('id', existente.id)
        .select().single()) as Medicamento
    }
    // Remédio novo = proposta pendente da família ativa.
    return check(await db().from('medicamentos')
      .insert({ ...payload, status: 'pendente', familia_id: fam(), criado_por: await meuId() })
      .select().single()) as Medicamento
  },

  async uploadFoto(file) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${fam()}/${crypto.randomUUID()}.${ext}`
    const { error } = await db().storage.from('fotos').upload(path, file, { contentType: file.type })
    if (error) throw new Error(error.message)
    return db().storage.from('fotos').getPublicUrl(path).data.publicUrl
  },

  async listPendentes() {
    return check(await db().from('medicamentos').select('*')
      .eq('status', 'pendente').order('created_at')) as Medicamento[]
  },

  async aprovarMedicamento(id) {
    const { error } = await db().rpc('aprovar_medicamento', { p_id: id })
    if (error) throw new Error(error.message)
  },

  async rejeitarMedicamento(id) {
    const { error } = await db().rpc('rejeitar_medicamento', { p_id: id })
    if (error) throw new Error(error.message)
  },

  async listEstoque(incluirInativos = false) {
    let q = db().from('estoque').select(SEL_ESTOQUE).eq('familia_id', fam())
    if (!incluirInativos) q = q.eq('status', 'ativo')
    return check(await q) as ItemEstoqueCompleto[]
  },

  async getEstoqueItem(id) {
    const data = check(await db().from('estoque').select(SEL_ESTOQUE).eq('id', id).maybeSingle()) as ItemEstoqueCompleto | null
    return data
  },

  async addEstoque(input) {
    return check(await db().from('estoque').insert({ ...input, familia_id: fam() }).select().single()) as ItemEstoque
  },

  async updateEstoque(id, patch) {
    check(await db().from('estoque')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select())
  },

  async descartarEstoque(id) {
    await this.updateEstoque(id, { status: 'descartado' })
  },

  async registrarConsumo(estoqueId, quantidade, perfilId, observacao) {
    const item = check(await db().from('estoque').select('quantidade_atual,status')
      .eq('id', estoqueId).single()) as { quantidade_atual: number; status: string }
    const restante = Math.max(0, Number(item.quantidade_atual) - quantidade)
    check(await db().from('estoque').update({
      quantidade_atual: restante,
      status: restante === 0 ? 'esgotado' : item.status,
      updated_at: new Date().toISOString(),
    }).eq('id', estoqueId).select())
    check(await db().from('consumo').insert({
      familia_id: fam(), estoque_id: estoqueId, perfil_id: perfilId, quantidade, observacao: observacao ?? null,
    }).select())
  },

  async listConsumo(limite = 50) {
    const data = check(await db().from('consumo')
      .select('*, estoque:estoque(medicamento:medicamentos(nome,unidade)), perfil:perfis(nome)')
      .eq('familia_id', fam())
      .order('datahora', { ascending: false })
      .limit(limite)) as Array<Record<string, any>>
    return (data ?? []).map((c) => ({
      id: c.id, estoque_id: c.estoque_id, perfil_id: c.perfil_id,
      quantidade: c.quantidade, datahora: c.datahora, observacao: c.observacao,
      medicamento_nome: c.estoque?.medicamento?.nome ?? 'Removido',
      unidade: c.estoque?.medicamento?.unidade ?? 'unidade',
      perfil_nome: c.perfil?.nome ?? null,
    })) as ConsumoCompleto[]
  },

  async listPerfis() {
    return check(await db().from('perfis').select('*').eq('familia_id', fam()).order('created_at')) as Perfil[]
  },

  async addPerfil(nome, tipo) {
    return check(await db().from('perfis').insert({ nome, tipo, familia_id: fam() }).select().single()) as Perfil
  },

  async removerPerfil(id) {
    // consumo.perfil_id tem ON DELETE SET NULL, então o histórico é mantido
    check(await db().from('perfis').delete().eq('id', id).select())
  },

  async listTratamentos() {
    const data = check(await db().from('tratamentos')
      .select('*, perfil:perfis(nome), medicamento:medicamentos(*)')
      .eq('familia_id', fam())
      .order('created_at', { ascending: false })) as Array<Record<string, any>>
    return (data ?? []).map((t) => ({
      ...t, perfil_nome: t.perfil?.nome ?? null, medicamento: t.medicamento,
    })) as TratamentoCompleto[]
  },

  async addTratamento(input) {
    return check(await db().from('tratamentos').insert({ ...input, familia_id: fam() }).select().single()) as Tratamento
  },

  async updateTratamento(id, patch) {
    check(await db().from('tratamentos').update(patch).eq('id', id).select())
  },

  async deleteTratamento(id) {
    check(await db().from('tratamentos').delete().eq('id', id).select())
  },

  async gerarDosesHoje() {
    const { error } = await db().rpc('gerar_doses', { dia: hojeBrasilia() })
    if (error) throw new Error(error.message)
  },

  async listDosesHoje() {
    await this.gerarDosesHoje()
    const data = check(await db().from('doses').select(SEL_DOSE)
      .eq('familia_id', fam())
      .eq('data', hojeBrasilia()).order('prevista_em')) as Array<Record<string, any>>
    return (data ?? []).map(mapDose)
  },

  async listDosesPeriodo(desde) {
    const data = check(await db().from('doses').select(SEL_DOSE)
      .eq('familia_id', fam())
      .gte('data', desde).order('prevista_em', { ascending: false })) as Array<Record<string, any>>
    return (data ?? []).map(mapDose)
  },

  async marcarDose(doseId, status) {
    if (status === 'tomado') {
      const d = check(await db().from('doses')
        .select('tratamento:tratamentos(medicamento_id,dose,perfil_id)')
        .eq('id', doseId).single()) as Record<string, any>
      const trat = d?.tratamento
      if (trat) {
        const itens = check(await db().from('estoque').select('id')
          .eq('familia_id', fam())
          .eq('medicamento_id', trat.medicamento_id).eq('status', 'ativo')
          .gt('quantidade_atual', 0).order('data_validade').limit(1)) as Array<Record<string, any>>
        if (itens && itens[0]) {
          await this.registrarConsumo(itens[0].id, trat.dose, trat.perfil_id ?? null, 'Dose programada')
        }
      }
      check(await db().from('doses').update({ status: 'tomado', tomada_em: new Date().toISOString() }).eq('id', doseId).select())
    } else {
      check(await db().from('doses').update({ status }).eq('id', doseId).select())
    }
  },
}
