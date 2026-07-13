import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { repo } from '../lib/repo'
import type { ItemEstoqueCompleto } from '../lib/types'
import { UNIDADE_LABEL, FORMA_LABEL, TARJA_LABEL } from '../lib/types'
import { formatarData, textoValidade } from '../lib/dates'
import ValidadeBadge, { stripeClass } from '../components/ValidadeBadge'

export default function Consulta() {
  const [params, setParams] = useSearchParams()
  const [itens, setItens] = useState<ItemEstoqueCompleto[]>([])
  const [busca, setBusca] = useState('')

  const itemParam = params.get('item')

  async function recarregar() {
    setItens(await repo.listEstoque(true))
  }
  useEffect(() => { recarregar() }, [])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return itens
      .filter(i => i.status !== 'descartado')
      .filter(i => {
        if (!q) return true
        const m = i.medicamento
        return [m.nome, m.principio_ativo, m.indicacao, i.local, m.concentracao]
          .some(v => v?.toLowerCase().includes(q))
      })
  }, [itens, busca])

  async function descartar(id: string) {
    if (!confirm('Marcar como descartado? Ele sai do estoque ativo.')) return
    await repo.descartarEstoque(id)
    recarregar()
  }

  // Detalhe de um item específico (vindo do Painel)
  if (itemParam) {
    const item = itens.find(i => i.id === itemParam)
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <button className="btn btn-outline" onClick={() => setParams({})}>← Ver todos</button>
        {item ? <Detalhe item={item} onDescartar={descartar} /> : <p className="card muted">Item não encontrado.</p>}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="busca" className="sr-only">Buscar remédio</label>
        <input id="busca" className="input" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="🔍 Buscar por nome, sintoma ou local" />
      </div>

      <p className="hint">{filtrados.length} remédio(s)</p>

      {filtrados.length === 0 ? (
        <p className="card muted">Nada encontrado. Que tal <Link to="/cadastro">cadastrar</Link>?</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtrados.map(item => (
            <div key={item.id} className={`card ${stripeClass(item)}`}>
              <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <strong>{item.medicamento.nome}</strong>{' '}
                  <span className="muted">{item.medicamento.concentracao ?? ''}</span>
                  <div className="hint">
                    {item.quantidade_atual} {UNIDADE_LABEL[item.medicamento.unidade]}
                    {item.local ? ` · ${item.local}` : ''}
                    {item.status === 'esgotado' ? ' · esgotado' : ''}
                  </div>
                </div>
                <ValidadeBadge item={item} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Link to={`/consumo?item=${item.id}`} className="btn btn-primary" style={{ flex: 1 }}>💊 Tomar</Link>
                <button className="btn btn-danger" onClick={() => descartar(item.id)}>🗑️ Descartar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Detalhe({ item, onDescartar }: { item: ItemEstoqueCompleto; onDescartar: (id: string) => void }) {
  const m = item.medicamento
  const linha = (rotulo: string, valor: ReactNode) =>
    valor ? <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span className="muted">{rotulo}</span><span style={{ textAlign: 'right' }}>{valor}</span></div> : null

  return (
    <div className={`card ${stripeClass(item)}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <h2 style={{ fontSize: 22, flex: 1 }}>{m.nome}</h2>
        <ValidadeBadge item={item} />
      </div>
      {m.foto_url && (
        <img src={m.foto_url} alt={m.nome} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, marginBottom: 10 }} />
      )}
      {linha('Princípio ativo', m.principio_ativo)}
      {linha('Concentração', m.concentracao)}
      {linha('Forma', m.forma ? FORMA_LABEL[m.forma] : null)}
      {linha('Quantidade', `${item.quantidade_atual} ${UNIDADE_LABEL[m.unidade]}`)}
      {linha('Validade', `${formatarData(item.data_validade)} (${textoValidade(item)})`)}
      {linha('Aberto em', item.data_abertura ? formatarData(item.data_abertura) : null)}
      {linha('Local', item.local)}
      {linha('Lote', item.lote)}
      {linha('Indicação', m.indicacao)}
      {linha('Tarja', m.tarja !== 'sem_tarja' ? TARJA_LABEL[m.tarja] : null)}
      {linha('Receita', m.requer_receita ? 'Necessária' : null)}
      {linha('Observações', item.observacao)}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Link to={`/consumo?item=${item.id}`} className="btn btn-primary" style={{ flex: 1 }}>💊 Tomar</Link>
        <button className="btn btn-danger" onClick={() => onDescartar(item.id)}>🗑️ Descartar</button>
      </div>
    </div>
  )
}
