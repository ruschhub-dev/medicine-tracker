import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { repo } from '../lib/repo'
import type { ItemEstoqueCompleto } from '../lib/types'
import { UNIDADE_LABEL, FORMA_LABEL } from '../lib/types'
import { diasParaVencer, formatarData } from '../lib/dates'
import ValidadeBadge, { stripeClass } from '../components/ValidadeBadge'

type Ordem = 'validade' | 'nome' | 'quantidade' | 'local'

export default function Estoque() {
  const [params] = useSearchParams()
  const [itens, setItens] = useState<ItemEstoqueCompleto[]>([])
  const [ordem, setOrdem] = useState<Ordem>('validade')
  const [mostrarInativos, setMostrarInativos] = useState(false)

  useEffect(() => { repo.listEstoque(true).then(setItens) }, [])

  const visiveis = useMemo(() => {
    const lista = itens.filter(i => mostrarInativos || i.status === 'ativo')
    const ordenar: Record<Ordem, (a: ItemEstoqueCompleto, b: ItemEstoqueCompleto) => number> = {
      validade: (a, b) => diasParaVencer(a) - diasParaVencer(b),
      nome: (a, b) => a.medicamento.nome.localeCompare(b.medicamento.nome),
      quantidade: (a, b) => a.quantidade_atual - b.quantidade_atual,
      local: (a, b) => (a.local ?? '').localeCompare(b.local ?? ''),
    }
    return [...lista].sort(ordenar[ordem])
  }, [itens, ordem, mostrarInativos])

  function exportarCSV() {
    const header = ['Nome', 'Princípio ativo', 'Concentração', 'Forma', 'Quantidade', 'Unidade', 'Validade', 'Local', 'Lote', 'Status']
    const linhas = visiveis.map(i => [
      i.medicamento.nome, i.medicamento.principio_ativo ?? '', i.medicamento.concentracao ?? '',
      i.medicamento.forma ? FORMA_LABEL[i.medicamento.forma] : '',
      String(i.quantidade_atual), UNIDADE_LABEL[i.medicamento.unidade],
      formatarData(i.data_validade), i.local ?? '', i.lote ?? '', i.status,
    ])
    const csv = '﻿' + [header, ...linhas]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'estoque-remedios.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {params.get('novo') && (
        <p className="card" style={{ color: 'var(--ok)' }}>✅ Remédio cadastrado com sucesso!</p>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label htmlFor="ordem" className="hint">Ordenar:</label>
        <select id="ordem" className="select" style={{ width: 'auto', minHeight: 44 }}
          value={ordem} onChange={e => setOrdem(e.target.value as Ordem)}>
          <option value="validade">Validade</option>
          <option value="nome">Nome</option>
          <option value="quantidade">Quantidade</option>
          <option value="local">Local</option>
        </select>
        <button className="btn btn-outline" style={{ minHeight: 44, marginLeft: 'auto' }} onClick={exportarCSV}>⬇️ CSV</button>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)} style={{ width: 20, height: 20 }} />
        <span className="hint">Mostrar esgotados e descartados</span>
      </label>

      {visiveis.length === 0 ? (
        <p className="card muted">Estoque vazio. <Link to="/cadastro">Cadastrar o primeiro remédio</Link>.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {visiveis.map(item => (
            <Link key={item.id} to={`/consulta?item=${item.id}`}
              className={`card ${stripeClass(item)}`}
              style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
              <div style={{ flex: 1 }}>
                <strong>{item.medicamento.nome}</strong>{' '}
                <span className="muted">{item.medicamento.concentracao ?? ''}</span>
                <div className="hint">
                  {item.quantidade_atual} {UNIDADE_LABEL[item.medicamento.unidade]}
                  {item.local ? ` · ${item.local}` : ''}
                  {item.status !== 'ativo' ? ` · ${item.status}` : ''}
                </div>
              </div>
              <ValidadeBadge item={item} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
