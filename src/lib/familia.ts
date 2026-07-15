// Camada de famílias (tenancy): família ativa + criar/entrar/sair/convites + plano/admin.
// Modo Supabase usa as RPCs do banco; modo local simula tudo no localStorage,
// para dá pra desenvolver e testar sem o projeto na nuvem.
import { supabase, hasSupabase } from './supabase'
import type { Familia, MinhaFamilia, MembroFamilia, PapelMembro } from './types'

const LOCAL_USER = 'local-user'

const K = {
  familias: 'rf_familias',
  membros: 'rf_membros',
  convites: 'rf_convites',
  ativa: 'rf_familia_ativa',
}

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2)
const nowISO = () => new Date().toISOString()
const gerarCodigo = () => uid().replace(/-/g, '').slice(0, 8).toUpperCase()

function load<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]') as T[] } catch { return [] }
}
function save<T>(key: string, v: T[]) { localStorage.setItem(key, JSON.stringify(v)) }

const LIMITE_GRATIS_MSG = 'O plano grátis permite apenas uma família. Assine o Premium para ter mais.'

/** Modo local: pode entrar/criar mais uma família? (grátis = 1; Premium libera) */
function podeAddLocal(): boolean {
  const mems = load<MembroLocal>(K.membros).filter(m => m.user_id === LOCAL_USER)
  if (mems.length === 0) return true
  const fams = load<Familia>(K.familias)
  return mems.some(m => {
    const f = fams.find(x => x.id === m.familia_id)
    return !!f && f.plano === 'premium' && (!f.plano_ate || new Date(f.plano_ate) > new Date())
  })
}

type MembroLocal = { familia_id: string; user_id: string; papel: PapelMembro; nome: string }
type ConviteLocal = { codigo: string; familia_id: string; usos: number; usos_max: number | null; expira_em: string | null }

// ---------------------------------------------------------------------------
// Família ativa (vale nos dois modos, guardada neste aparelho)
// ---------------------------------------------------------------------------
export function getFamiliaAtiva(): string | null {
  try { return localStorage.getItem(K.ativa) } catch { return null }
}
export function setFamiliaAtiva(id: string) {
  try { localStorage.setItem(K.ativa, id) } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Modo local: cria a "Minha Família" na primeira vez e devolve o id ativo.
// ---------------------------------------------------------------------------
export function garantirFamiliaLocal(): string {
  let fams = load<Familia>(K.familias)
  if (fams.length === 0) {
    const f: Familia = {
      id: uid(), nome: 'Minha Família', owner_id: LOCAL_USER,
      plano: 'gratis', plano_ate: null, created_at: nowISO(),
    }
    fams = [f]
    save(K.familias, fams)
    save<MembroLocal>(K.membros, [{ familia_id: f.id, user_id: LOCAL_USER, papel: 'dono', nome: 'Você' }])
    setFamiliaAtiva(f.id)
    return f.id
  }
  const ativa = getFamiliaAtiva()
  if (!ativa || !fams.some(f => f.id === ativa)) setFamiliaAtiva(fams[0].id)
  return getFamiliaAtiva() as string
}

// ---------------------------------------------------------------------------
// Quem sou eu
// ---------------------------------------------------------------------------
export async function currentUserId(): Promise<string> {
  if (!hasSupabase) return LOCAL_USER
  const { data } = await supabase!.auth.getUser()
  return data.user?.id ?? ''
}

// ---------------------------------------------------------------------------
// Minhas famílias
// ---------------------------------------------------------------------------
export async function listMinhasFamilias(): Promise<MinhaFamilia[]> {
  if (!hasSupabase) {
    const fams = load<Familia>(K.familias)
    const mems = load<MembroLocal>(K.membros)
    return fams
      .filter(f => mems.some(m => m.familia_id === f.id && m.user_id === LOCAL_USER))
      .map(f => ({ ...f, papel: mems.find(m => m.familia_id === f.id)?.papel ?? 'membro' }))
  }
  const { data, error } = await supabase!
    .from('membros')
    .select('papel, familia:familias(*)')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Record<string, any>>)
    .filter(r => r.familia)
    .map(r => ({ ...(r.familia as Familia), papel: r.papel as PapelMembro }))
}

// ---------------------------------------------------------------------------
// Criar família (vira dona) → define como ativa e devolve o id
// ---------------------------------------------------------------------------
export async function criarFamilia(nome: string): Promise<string> {
  const nomeLimpo = nome.trim()
  if (!nomeLimpo) throw new Error('Informe um nome para a família.')
  if (!hasSupabase) {
    if (!podeAddLocal()) throw new Error(LIMITE_GRATIS_MSG)
    const f: Familia = {
      id: uid(), nome: nomeLimpo, owner_id: LOCAL_USER,
      plano: 'gratis', plano_ate: null, created_at: nowISO(),
    }
    save(K.familias, [...load<Familia>(K.familias), f])
    save<MembroLocal>(K.membros, [...load<MembroLocal>(K.membros),
      { familia_id: f.id, user_id: LOCAL_USER, papel: 'dono', nome: 'Você' }])
    setFamiliaAtiva(f.id)
    return f.id
  }
  const { data, error } = await supabase!.rpc('criar_familia', { p_nome: nomeLimpo })
  if (error) throw new Error(error.message)
  setFamiliaAtiva(data as string)
  return data as string
}

// ---------------------------------------------------------------------------
// Convites
// ---------------------------------------------------------------------------
export async function gerarConvite(familiaId: string): Promise<string> {
  if (!hasSupabase) {
    const codigo = gerarCodigo()
    save<ConviteLocal>(K.convites, [...load<ConviteLocal>(K.convites),
      { codigo, familia_id: familiaId, usos: 0, usos_max: null, expira_em: null }])
    return codigo
  }
  const { data, error } = await supabase!.rpc('gerar_convite', { p_familia_id: familiaId })
  if (error) throw new Error(error.message)
  return data as string
}

export async function entrarComConvite(codigo: string): Promise<string> {
  const cod = codigo.trim().toUpperCase()
  if (!cod) throw new Error('Cole o código do convite.')
  if (!hasSupabase) {
    if (!podeAddLocal()) throw new Error(LIMITE_GRATIS_MSG)
    const convites = load<ConviteLocal>(K.convites)
    const c = convites.find(x => x.codigo === cod)
    if (!c) throw new Error('Convite inválido.')
    const mems = load<MembroLocal>(K.membros)
    if (!mems.some(m => m.familia_id === c.familia_id && m.user_id === LOCAL_USER)) {
      mems.push({ familia_id: c.familia_id, user_id: LOCAL_USER, papel: 'membro', nome: 'Você' })
      save(K.membros, mems)
    }
    setFamiliaAtiva(c.familia_id)
    return c.familia_id
  }
  const { data, error } = await supabase!.rpc('entrar_com_convite', { p_codigo: cod })
  if (error) throw new Error(error.message)
  setFamiliaAtiva(data as string)
  return data as string
}

export async function sairDaFamilia(familiaId: string): Promise<void> {
  if (!hasSupabase) {
    save(K.membros, load<MembroLocal>(K.membros)
      .filter(m => !(m.familia_id === familiaId && m.user_id === LOCAL_USER)))
    if (getFamiliaAtiva() === familiaId) {
      const restantes = await listMinhasFamilias()
      if (restantes[0]) setFamiliaAtiva(restantes[0].id)
      else localStorage.removeItem(K.ativa)
    }
    return
  }
  const { error } = await supabase!.rpc('sair_da_familia', { p_familia_id: familiaId })
  if (error) throw new Error(error.message)
  if (getFamiliaAtiva() === familiaId) {
    const restantes = await listMinhasFamilias()
    if (restantes[0]) setFamiliaAtiva(restantes[0].id)
    else localStorage.removeItem(K.ativa)
  }
}

// ---------------------------------------------------------------------------
// Membros de uma família
// ---------------------------------------------------------------------------
export async function listMembros(familiaId: string): Promise<MembroFamilia[]> {
  if (!hasSupabase) {
    return load<MembroLocal>(K.membros)
      .filter(m => m.familia_id === familiaId)
      .map(m => ({ familia_id: m.familia_id, user_id: m.user_id, papel: m.papel, nome: m.nome, eu: m.user_id === LOCAL_USER }))
  }
  const eu = await currentUserId()
  const { data, error } = await supabase!
    .from('membros').select('user_id, papel').eq('familia_id', familiaId)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Record<string, any>>).map(m => ({
    familia_id: familiaId, user_id: m.user_id, papel: m.papel as PapelMembro,
    nome: m.user_id === eu ? 'Você' : null, eu: m.user_id === eu,
  }))
}

// ---------------------------------------------------------------------------
// Moderador do catálogo?
// ---------------------------------------------------------------------------
export async function souAdmin(): Promise<boolean> {
  if (!hasSupabase) return true   // modo local: permite testar a tela de Moderação
  const { data } = await supabase!.from('admins').select('user_id').maybeSingle()
  return !!data
}

// ---------------------------------------------------------------------------
// Plano da família ativa
// ---------------------------------------------------------------------------
export async function getPlanoFamilia(familiaId: string): Promise<{ plano: string; plano_ate: string | null }> {
  if (!hasSupabase) {
    const f = load<Familia>(K.familias).find(x => x.id === familiaId)
    return { plano: f?.plano ?? 'gratis', plano_ate: f?.plano_ate ?? null }
  }
  const { data } = await supabase!.from('familias').select('plano, plano_ate').eq('id', familiaId).maybeSingle()
  return { plano: (data as any)?.plano ?? 'gratis', plano_ate: (data as any)?.plano_ate ?? null }
}
