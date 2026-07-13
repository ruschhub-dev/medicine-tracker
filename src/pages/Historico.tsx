import { useEffect, useMemo, useState } from 'react'
import { repo } from '../lib/repo'
import type { ConsumoCompleto, Perfil } from '../lib/types'
import { UNIDADE_LABEL } from '../lib/types'

const PERIODOS = [
  { valor: '7', label: 'Últimos 7 dias' },
  { valor: '30', label: 'Últimos 30 dias' },
  { valor: '90', label: 'Últimos 90 dias' },
  { valor: 'tudo', label: 'Tudo' },
]

export default function Historico() {
  const [consumos, setConsumos] = useState<ConsumoCompleto[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [carregando, setCarregando] = useState(true)
  const [pessoa, setPessoa] = useState('')
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState('30')

  useEffect(() => {
    Promise.all([repo.listConsumo(1000), repo.listPerfis()]).then(([c, p]) => {
      setConsumos(c); setPerfis(p); setCarregando(false)
    })
  }, [])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const cutoff = periodo === 'tudo' ? null : Date.now() - Number(periodo) * 86_400_000
    return consumos.filter(c => {
      if (pessoa && c.perfil_id !== pessoa) return false
      if (cutoff && new Date(c.datahora).getTime() < cutoff) return false
      if (q && !c.medicamento_nome.toLowerCase().includes(q)) return false
      return true
    })
  }, [consumos, pessoa, busca, periodo])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20 }}>Histórico de consumo</h2>
        <p className="hint">Quem tomou o quê, quanto e quando.</p>
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="pessoa">Pessoa</label>
            <select id="pessoa" className="select" value={pessoa} onChange={e => setPessoa(e.target.value)}>
              <option value="">Todas</option>
              {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="periodo">Período</label>
            <select id="periodo" className="select" value={periodo} onChange={e => setPeriodo(e.target.value)}>
              {PERIODOS.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="busca" className="sr-only">Buscar remédio</label>
          <input id="busca" className="input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Filtrar por remédio" />
        </div>
      </div>

      {carregando ? (
        <p className="muted">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="card muted">Nenhum consumo registrado nesse filtro.</p>
      ) : (
        <>
          <p className="hint">{filtrados.length} registro(s)</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {filtrados.map(c => (
              <div key={c.id} className="card" style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <strong>{c.medicamento_nome}</strong>
                  <div className="hint">
                    {c.perfil_nome ?? 'Não informado'} · {new Date(c.datahora).toLocaleString('pt-BR')}
                  </div>
                  {c.observacao && <div className="hint">{c.observacao}</div>}
                </div>
                <span className="badge badge-muted">
                  {c.quantidade} {UNIDADE_LABEL[c.unidade]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
