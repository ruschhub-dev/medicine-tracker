import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/repo'
import type { ItemEstoqueCompleto, ConsumoCompleto, DoseCompleta } from '../lib/types'
import { UNIDADE_LABEL } from '../lib/types'
import { diasParaVencer, estoqueBaixo, formatarData } from '../lib/dates'
import ValidadeBadge, { stripeClass } from '../components/ValidadeBadge'

export default function Painel() {
  const [itens, setItens] = useState<ItemEstoqueCompleto[]>([])
  const [consumos, setConsumos] = useState<ConsumoCompleto[]>([])
  const [doses, setDoses] = useState<DoseCompleta[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    Promise.all([repo.listEstoque(), repo.listConsumo(5), repo.listDosesHoje()]).then(([e, c, d]) => {
      setItens(e); setConsumos(c); setDoses(d); setCarregando(false)
    })
  }, [])

  async function tomarDose(id: string) {
    await repo.marcarDose(id, 'tomado')
    const [d, e] = await Promise.all([repo.listDosesHoje(), repo.listEstoque()])
    setDoses(d); setItens(e)
  }

  if (carregando) return <p className="muted">Carregando…</p>

  const vencidos = itens.filter(i => diasParaVencer(i) < 0)
  const vencendo30 = itens.filter(i => { const d = diasParaVencer(i); return d >= 0 && d <= 30 })
  const vencendo60 = itens.filter(i => { const d = diasParaVencer(i); return d > 30 && d <= 60 })
  const baixos = itens.filter(estoqueBaixo)

  const atencao = [...vencidos, ...vencendo30].sort((a, b) => diasParaVencer(a) - diasParaVencer(b))
  const pendentesHoje = doses.filter(d => d.status === 'pendente')

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <AlertaCard n={vencidos.length} titulo="Vencidos" cor="var(--danger)" bg="var(--danger-bg)" to="/descarte" />
          <AlertaCard n={vencendo30.length} titulo="Vencem em 30 dias" cor="var(--warn)" bg="var(--warn-bg)" />
          <AlertaCard n={vencendo60.length} titulo="Vencem em 60 dias" cor="var(--warn)" bg="var(--surface)" />
          <AlertaCard n={baixos.length} titulo="Estoque baixo" cor="var(--primary)" bg="var(--surface)" />
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Link to="/cadastro" className="btn btn-primary btn-block">➕ Cadastrar</Link>
        <Link to="/consumo" className="btn btn-block">💊 Tomar remédio</Link>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Link to="/hoje" className="btn btn-outline btn-block" style={{ fontSize: 14, padding: '0 8px' }}>📅 Hoje</Link>
        <Link to="/tratamentos" className="btn btn-outline btn-block" style={{ fontSize: 14, padding: '0 8px' }}>💉 Tratamentos</Link>
        <Link to="/historico" className="btn btn-outline btn-block" style={{ fontSize: 14, padding: '0 8px' }}>🕑 Histórico</Link>
        <Link to="/descarte" className="btn btn-outline btn-block" style={{ fontSize: 14, padding: '0 8px' }}>🗑️ Descarte</Link>
        <Link to="/familia" className="btn btn-outline btn-block" style={{ fontSize: 14, padding: '0 8px' }}>👥 Família</Link>
      </section>

      {pendentesHoje.length > 0 && (
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>📅 Doses de hoje</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {pendentesHoje.map(d => (
              <div key={d.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ minWidth: 48, textAlign: 'center', fontSize: 18, fontWeight: 700 }}>
                  {new Date(d.prevista_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ flex: 1 }}>
                  <strong>{d.medicamento_nome}</strong>{' '}
                  <span className="muted">{d.dose} {UNIDADE_LABEL[d.medicamento_unidade]}</span>
                  <div className="hint">{d.perfil_nome ?? 'Sem pessoa'}</div>
                </div>
                <button className="btn btn-primary" onClick={() => tomarDose(d.id)}>✓ Tomei</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Precisam de atenção</h2>
        {atencao.length === 0 ? (
          <p className="card muted">Tudo em dia por aqui. 🎉</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {atencao.map(item => (
              <Link key={item.id} to={`/consulta?item=${item.id}`}
                className={`card ${stripeClass(item)}`}
                style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
                <div style={{ flex: 1 }}>
                  <strong>{item.medicamento.nome}</strong>{' '}
                  <span className="muted">{item.medicamento.concentracao ?? ''}</span>
                  <div className="hint">{item.local ?? 'Sem local'} · {formatarData(item.data_validade)}</div>
                </div>
                <ValidadeBadge item={item} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {baixos.length > 0 && (
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Acabando</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {baixos.map(item => (
              <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <strong>{item.medicamento.nome}</strong>
                  <div className="hint">{item.local ?? 'Sem local'}</div>
                </div>
                <span className="badge badge-warn">
                  {item.quantidade_atual} {UNIDADE_LABEL[item.medicamento.unidade]}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {consumos.length > 0 && (
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Últimos consumos</h2>
          <div className="card" style={{ display: 'grid', gap: 8 }}>
            {consumos.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{c.medicamento_nome}{c.perfil_nome ? ` — ${c.perfil_nome}` : ''}</span>
                <span className="muted">{new Date(c.datahora).toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function AlertaCard({ n, titulo, cor, bg, to }: { n: number; titulo: string; cor: string; bg: string; to?: string }) {
  const conteudo = (
    <div className="card" style={{ background: bg, textAlign: 'center', padding: 14, height: '100%' }}>
      <div style={{ fontSize: 34, fontWeight: 800, color: cor, lineHeight: 1 }}>{n}</div>
      <div className="hint" style={{ marginTop: 4 }}>{titulo}</div>
    </div>
  )
  return to
    ? <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>{conteudo}</Link>
    : conteudo
}
