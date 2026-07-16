import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/repo'
import type { DoseCompleta } from '../lib/types'
import { UNIDADE_LABEL } from '../lib/types'
import { useFamilia } from '../lib/familiaContext'
import UpsellPremium from '../components/UpsellPremium'

/** Data de 7 dias atrás, no fuso de Brasília. */
function seteDiasAtras(): string {
  return new Date(Date.now() - (3 + 7 * 24) * 3600 * 1000).toISOString().slice(0, 10)
}

export default function Hoje() {
  const { premium } = useFamilia()
  const [doses, setDoses] = useState<DoseCompleta[]>([])
  const [periodo, setPeriodo] = useState<DoseCompleta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function recarregar() {
    const [hoje, per] = await Promise.all([
      repo.listDosesHoje(),
      repo.listDosesPeriodo(seteDiasAtras()),
    ])
    setDoses(hoje); setPeriodo(per); setCarregando(false)
  }
  useEffect(() => { recarregar() }, [])

  async function marcar(id: string, status: 'tomado' | 'pulado') {
    setOcupado(id)
    await repo.marcarDose(id, status)
    await recarregar()
    setOcupado(null)
  }

  const horaDe = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const resumo = useMemo(() => {
    const agora = Date.now()
    let tomadas = 0, puladas = 0, perdidas = 0
    for (const d of periodo) {
      if (d.status === 'tomado') tomadas++
      else if (d.status === 'pulado') puladas++
      else if (new Date(d.prevista_em).getTime() < agora) perdidas++
    }
    const base = tomadas + puladas + perdidas
    return { tomadas, puladas, perdidas, aderencia: base > 0 ? Math.round((tomadas / base) * 100) : null }
  }, [periodo])

  if (!premium) return (
    <UpsellPremium
      titulo="Hoje"
      descricao="A agenda de doses e o resumo de aderência fazem parte do Premium."
    />
  )

  if (carregando) return <p className="muted">Carregando…</p>

  const pendentes = doses.filter(d => d.status === 'pendente')
  const agora = Date.now()

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20 }}>Doses de hoje</h2>
        <p className="hint">{pendentes.length} pendente(s) de {doses.length}.</p>
      </div>

      {doses.length === 0 ? (
        <p className="card muted">Nenhuma dose para hoje. Crie um <Link to="/tratamentos">tratamento</Link>.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {doses.map(d => {
            const atrasada = d.status === 'pendente' && new Date(d.prevista_em).getTime() < agora
            const stripe = d.status === 'tomado' ? 'stripe-ok' : atrasada ? 'stripe-danger' : ''
            return (
              <div key={d.id} className={`card stripe ${stripe}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'center', minWidth: 56 }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{horaDe(d.prevista_em)}</div>
                    {atrasada && <div className="hint" style={{ color: 'var(--danger)' }}>atrasada</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong>{d.medicamento_nome}</strong>{' '}
                    <span className="muted">{d.dose} {UNIDADE_LABEL[d.medicamento_unidade]}</span>
                    <div className="hint">{d.perfil_nome ?? 'Sem pessoa'}</div>
                  </div>
                  {d.status !== 'pendente' && (
                    <span className={`badge ${d.status === 'tomado' ? 'badge-ok' : 'badge-muted'}`}>
                      {d.status === 'tomado' ? '✓ Tomado' : 'Pulado'}
                    </span>
                  )}
                </div>
                {d.status === 'pendente' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} disabled={ocupado === d.id} onClick={() => marcar(d.id, 'tomado')}>✓ Tomei</button>
                    <button className="btn btn-outline" disabled={ocupado === d.id} onClick={() => marcar(d.id, 'pulado')}>Pulei</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {resumo.aderencia !== null && (
        <section>
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>Aderência (últimos 7 dias)</h3>
          <div className="card" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--ok)' }}>{resumo.aderencia}%</div>
              <div className="hint">das doses tomadas no horário</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-ok">✓ {resumo.tomadas} tomadas</span>
              <span className="badge badge-muted">{resumo.puladas} puladas</span>
              <span className="badge badge-danger">{resumo.perdidas} perdidas</span>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
