import { useEffect, useState } from 'react'
import { repo } from '../lib/repo'
import type { ItemEstoqueCompleto } from '../lib/types'
import { UNIDADE_LABEL } from '../lib/types'
import { diasParaVencer, formatarData, textoValidade } from '../lib/dates'

export default function Descarte() {
  const [itens, setItens] = useState<ItemEstoqueCompleto[]>([])
  const [carregando, setCarregando] = useState(true)

  async function recarregar() {
    setItens(await repo.listEstoque(true))
    setCarregando(false)
  }
  useEffect(() => { recarregar() }, [])

  const paraDescartar = itens
    .filter(i => i.status === 'ativo' && diasParaVencer(i) < 0)
    .sort((a, b) => diasParaVencer(a) - diasParaVencer(b))
  const descartados = itens.filter(i => i.status === 'descartado')

  async function descartar(id: string) {
    await repo.descartarEstoque(id)
    recarregar()
  }
  async function desfazer(id: string) {
    await repo.updateEstoque(id, { status: 'ativo' })
    recarregar()
  }

  if (carregando) return <p className="muted">Carregando…</p>

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20 }}>Descarte</h2>
        <p className="hint">
          Remédios vencidos para juntar e levar a um ponto de coleta (farmácias costumam ter).
          Não jogue no lixo comum nem na pia. 🌱
        </p>
      </div>

      <section>
        <h3 style={{ fontSize: 16, marginBottom: 10 }}>Para descartar ({paraDescartar.length})</h3>
        {paraDescartar.length === 0 ? (
          <p className="card muted">Nenhum remédio vencido. Tudo em dia! 🎉</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {paraDescartar.map(item => (
              <div key={item.id} className="card stripe stripe-danger">
                <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <strong>{item.medicamento.nome}</strong>{' '}
                    <span className="muted">{item.medicamento.concentracao ?? ''}</span>
                    <div className="hint">
                      {item.quantidade_atual} {UNIDADE_LABEL[item.medicamento.unidade]}
                      {item.local ? ` · ${item.local}` : ''}
                    </div>
                    <div className="hint">Validade {formatarData(item.data_validade)} — {textoValidade(item)}</div>
                  </div>
                  <span className="badge badge-danger">vencido</span>
                </div>
                <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={() => descartar(item.id)}>
                  ✓ Já descartei este
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {descartados.length > 0 && (
        <section>
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>Já descartados ({descartados.length})</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {descartados.map(item => (
              <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.85 }}>
                <div style={{ flex: 1 }}>
                  <strong>{item.medicamento.nome}</strong>
                  <div className="hint">
                    {item.local ? `${item.local} · ` : ''}validade {formatarData(item.data_validade)}
                  </div>
                </div>
                <button className="btn btn-outline" onClick={() => desfazer(item.id)}>Desfazer</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
