import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/repo'
import type { Perfil, TipoPerfil, MembroFamilia } from '../lib/types'
import LembretesToggle from '../components/LembretesToggle'
import { useFamilia } from '../lib/familiaContext'
import { gerarConvite, listMembros, sairDaFamilia, souAdmin, criarFamilia, entrarComConvite } from '../lib/familia'

export default function Familia() {
  const { ativa, recarregar } = useFamilia()
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [membros, setMembros] = useState<MembroFamilia[]>([])
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoPerfil>('adulto')
  const [carregando, setCarregando] = useState(true)
  const [codigo, setCodigo] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [codigoEntrar, setCodigoEntrar] = useState('')

  async function recarregarTudo() {
    setPerfis(await repo.listPerfis())
    if (ativa) setMembros(await listMembros(ativa.id))
    setCarregando(false)
  }
  useEffect(() => {
    recarregarTudo()
    souAdmin().then(setAdmin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativa?.id])

  async function adicionar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    await repo.addPerfil(nome.trim(), tipo)
    setNome('')
    setTipo('adulto')
    recarregarTudo()
  }

  async function remover(id: string, nomePessoa: string) {
    if (!confirm(`Remover ${nomePessoa}? O histórico de consumo é mantido.`)) return
    await repo.removerPerfil(id)
    recarregarTudo()
  }

  async function convidar() {
    if (!ativa) return
    setGerando(true); setCopiado(false)
    try { setCodigo(await gerarConvite(ativa.id)) }
    catch (e) { alert((e as Error).message) }
    finally { setGerando(false) }
  }

  async function compartilhar() {
    if (!codigo) return
    const texto = `Entre na família "${ativa?.nome}" no app de remédios com o código: ${codigo}`
    try {
      if (navigator.share) await navigator.share({ text: texto })
      else { await navigator.clipboard?.writeText(codigo); setCopiado(true) }
    } catch { /* usuário cancelou */ }
  }

  async function copiar() {
    if (!codigo) return
    await navigator.clipboard?.writeText(codigo)
    setCopiado(true)
  }

  async function sairFamilia() {
    if (!ativa) return
    if (!confirm(`Sair da família “${ativa.nome}”? Você deixa de ver os remédios dela neste app.`)) return
    await sairDaFamilia(ativa.id)
    await recarregar()
  }

  async function criarOutra(e: FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return
    try { await criarFamilia(novoNome); setNovoNome(''); await recarregar() }
    catch (err) { alert((err as Error).message) }
  }

  async function entrarOutra(e: FormEvent) {
    e.preventDefault()
    if (!codigoEntrar.trim()) return
    try { await entrarComConvite(codigoEntrar); setCodigoEntrar(''); await recarregar() }
    catch (err) { alert((err as Error).message) }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20 }}>{ativa?.nome ?? 'Família'}</h2>
        <p className="hint">
          Plano {ativa?.plano === 'premium' ? 'Premium' : 'Grátis'} · convide quem cuida dos remédios com você.
        </p>
      </div>

      {/* Convite */}
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div>
          <strong>Convidar para a família</strong>
          <p className="hint">Compartilhe um código com quem vai enxergar este estoque.</p>
        </div>
        {codigo ? (
          <>
            <div style={{
              textAlign: 'center', padding: 12, borderRadius: 12, background: 'var(--surface-2)',
              fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 24, fontWeight: 700, letterSpacing: 2,
            }}>
              {codigo}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={compartilhar}>Compartilhar</button>
              <button className="btn btn-outline" onClick={copiar}>{copiado ? 'Copiado ✓' : 'Copiar'}</button>
            </div>
            <button className="btn btn-outline btn-block" onClick={convidar} disabled={gerando}>Gerar novo código</button>
          </>
        ) : (
          <button className="btn btn-primary btn-block" onClick={convidar} disabled={gerando}>
            {gerando ? 'Gerando…' : 'Gerar convite'}
          </button>
        )}
      </div>

      {/* Membros */}
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <strong>Quem participa</strong>
        {membros.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>Só você por enquanto.</p>
        ) : membros.map(m => (
          <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span aria-hidden="true" style={{ fontSize: 22 }}>🧑</span>
            <div style={{ flex: 1 }}>{m.nome ?? (m.eu ? 'Você' : 'Membro')}</div>
            <span className={`badge ${m.papel === 'dono' ? 'badge-ok' : 'badge-muted'}`}>{m.papel}</span>
          </div>
        ))}
      </div>

      {/* Outras famílias (participar de mais de uma) */}
      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div>
          <strong>Outras famílias</strong>
          <p className="hint">Você pode participar de mais de uma (ex.: a sua e a dos seus pais). Troque pelo seletor no topo.</p>
        </div>
        <form onSubmit={entrarOutra} style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={codigoEntrar} onChange={e => setCodigoEntrar(e.target.value)}
            placeholder="Código de convite" aria-label="Código de convite" style={{ flex: 1, textTransform: 'uppercase' }} />
          <button type="submit" className="btn btn-primary">Entrar</button>
        </form>
        <form onSubmit={criarOutra} style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={novoNome} onChange={e => setNovoNome(e.target.value)}
            placeholder="Nome da nova família" aria-label="Nome da nova família" style={{ flex: 1 }} />
          <button type="submit" className="btn btn-outline">Criar</button>
        </form>
      </div>

      {admin && (
        <Link to="/moderacao" className="btn btn-outline btn-block">🛡️ Moderar catálogo</Link>
      )}

      <LembretesToggle />

      {/* Perfis (quem toma) */}
      <div>
        <h3 style={{ fontSize: 18 }}>Pessoas</h3>
        <p className="hint">Quem aparece em “quem tomou” ao registrar um remédio na tela Tomar.</p>
      </div>

      <form onSubmit={adicionar} className="card" style={{ display: 'grid', gap: 12 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="nome">Nome</label>
          <input id="nome" className="input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Maria" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" className="select" value={tipo} onChange={e => setTipo(e.target.value as TipoPerfil)}>
            <option value="adulto">Adulto</option>
            <option value="crianca">Criança</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-block">Adicionar pessoa</button>
      </form>

      {carregando ? (
        <p className="muted">Carregando…</p>
      ) : perfis.length === 0 ? (
        <p className="card muted">Ninguém cadastrado ainda. Adicione as pessoas da casa acima.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {perfis.map(p => (
            <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span aria-hidden="true" style={{ fontSize: 26 }}>{p.tipo === 'crianca' ? '🧒' : '🧑'}</span>
              <div style={{ flex: 1 }}>
                <strong>{p.nome}</strong>
                <div className="hint">{p.tipo === 'crianca' ? 'Criança' : 'Adulto'}</div>
              </div>
              <button className="btn btn-danger" onClick={() => remover(p.id, p.nome)}>Remover</button>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-outline" style={{ color: 'var(--danger)' }} onClick={sairFamilia}>
        Sair desta família
      </button>
    </div>
  )
}
