import { useEffect, useState } from 'react'
import { repo } from '../lib/repo'
import { souAdmin } from '../lib/familia'
import type { Medicamento } from '../lib/types'
import { FORMA_LABEL, TARJA_LABEL } from '../lib/types'

export default function Moderacao() {
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [pendentes, setPendentes] = useState<Medicamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState<string | null>(null)

  async function recarregar() {
    setPendentes(await repo.listPendentes())
    setCarregando(false)
  }

  useEffect(() => {
    souAdmin().then(async ok => {
      setAdmin(ok)
      if (ok) await recarregar()
      else setCarregando(false)
    })
  }, [])

  async function aprovar(m: Medicamento) {
    setOcupado(m.id)
    try { await repo.aprovarMedicamento(m.id); await recarregar() }
    finally { setOcupado(null) }
  }

  async function rejeitar(m: Medicamento) {
    if (!confirm(`Rejeitar “${m.nome}”? Ele continua disponível só para a família que propôs, mas não entra no catálogo.`)) return
    setOcupado(m.id)
    try { await repo.rejeitarMedicamento(m.id); await recarregar() }
    finally { setOcupado(null) }
  }

  if (admin === false) {
    return (
      <div className="card">
        <h2 style={{ fontSize: 20 }}>Moderação</h2>
        <p className="muted" style={{ marginTop: 8 }}>Esta área é só para moderadores do catálogo.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20 }}>Moderação do catálogo</h2>
        <p className="hint">Remédios propostos pelas famílias, aguardando entrar no catálogo compartilhado.</p>
      </div>

      {carregando ? (
        <p className="muted">Carregando…</p>
      ) : pendentes.length === 0 ? (
        <p className="card muted">Nada pendente por aqui. 🎉</p>
      ) : (
        <>
          <span className="badge badge-warn" style={{ justifySelf: 'start' }}>
            {pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}
          </span>
          <div style={{ display: 'grid', gap: 12 }}>
            {pendentes.map(m => (
              <div key={m.id} className="card" style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <strong>{m.nome}</strong>
                    <div className="hint">
                      {[m.principio_ativo, m.concentracao].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  {m.forma && <span className="badge badge-muted">{FORMA_LABEL[m.forma]}</span>}
                </div>
                <div className="hint" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {m.codigo_barras && <span>🏷️ {m.codigo_barras}</span>}
                  {m.tarja !== 'sem_tarja' && <span>{TARJA_LABEL[m.tarja]}</span>}
                  {m.requer_receita && <span>Requer receita</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={ocupado === m.id} onClick={() => aprovar(m)}>
                    ✓ Aprovar
                  </button>
                  <button className="btn btn-danger" disabled={ocupado === m.id} onClick={() => rejeitar(m)}>
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
