import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { repo } from '../lib/repo'
import type { ItemEstoqueCompleto, Perfil } from '../lib/types'
import { UNIDADE_LABEL } from '../lib/types'

export default function Consumo() {
  const [params] = useSearchParams()
  const [itens, setItens] = useState<ItemEstoqueCompleto[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [itemId, setItemId] = useState('')
  const [perfilId, setPerfilId] = useState('')
  const [qtd, setQtd] = useState('1')
  const [msg, setMsg] = useState<string | null>(null)

  async function recarregar() {
    const [e, p] = await Promise.all([repo.listEstoque(), repo.listPerfis()])
    setItens(e); setPerfis(p)
  }
  useEffect(() => { recarregar() }, [])

  useEffect(() => {
    const pre = params.get('item')
    if (pre) setItemId(pre)
  }, [params])

  const item = itens.find(i => i.id === itemId)

  async function confirmar(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!item) return setMsg('Escolha um remédio.')
    const q = Number(qtd)
    if (!q || q <= 0) return setMsg('Informe a quantidade tomada.')
    if (q > item.quantidade_atual) return setMsg(`Só há ${item.quantidade_atual} ${UNIDADE_LABEL[item.medicamento.unidade]} em estoque.`)

    await repo.registrarConsumo(item.id, q, perfilId || null)
    const restante = item.quantidade_atual - q
    setMsg(`✅ Registrado! Restam ${restante} ${UNIDADE_LABEL[item.medicamento.unidade]}${restante === 0 ? ' (esgotado)' : ''}.`)
    setQtd('1')
    setItemId('')
    recarregar()
  }

  return (
    <form onSubmit={confirmar} style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ fontSize: 20 }}>Registrar que alguém tomou</h2>

      {msg && <p className="card" style={{ color: msg.startsWith('✅') ? 'var(--ok)' : 'var(--danger)' }}>{msg}</p>}

      <div className="field">
        <label htmlFor="item">Remédio</label>
        <select id="item" className="select" value={itemId} onChange={e => setItemId(e.target.value)}>
          <option value="">— escolha —</option>
          {itens.map(i => (
            <option key={i.id} value={i.id}>
              {i.medicamento.nome} {i.medicamento.concentracao ?? ''} — {i.quantidade_atual} {UNIDADE_LABEL[i.medicamento.unidade]}{i.local ? ` (${i.local})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="perfil">Quem tomou</label>
        <select id="perfil" className="select" value={perfilId} onChange={e => setPerfilId(e.target.value)}>
          <option value="">— não informar —</option>
          {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        {perfis.length === 0 && (
          <p className="hint">Ninguém cadastrado. <Link to="/familia">Cadastrar a família</Link>.</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="qtd">
          Quantidade {item ? `(${UNIDADE_LABEL[item.medicamento.unidade]})` : ''}
        </label>
        <input id="qtd" className="input" type="number" min="0" step="any" inputMode="decimal"
          value={qtd} onChange={e => setQtd(e.target.value)} />
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={!item}>Confirmar consumo</button>
    </form>
  )
}
