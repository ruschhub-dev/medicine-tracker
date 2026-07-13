import { useState, lazy, Suspense, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { repo } from '../lib/repo'

// Carrega o leitor (e a lib @zxing) só quando o scanner é aberto — deixa o app inicial mais leve.
const BarcodeScanner = lazy(() => import('../components/BarcodeScanner'))
import { FORMA_LABEL, UNIDADE_LABEL, TARJA_LABEL, UNIDADE_PADRAO } from '../lib/types'
import type { Forma, Unidade, Tarja } from '../lib/types'

const FORMA_OPTS = Object.keys(FORMA_LABEL) as Forma[]
const UNIDADE_OPTS = Object.keys(UNIDADE_LABEL) as Unidade[]
const TARJA_OPTS = Object.keys(TARJA_LABEL) as Tarja[]

interface FormState {
  codigo_barras: string
  nome: string
  principio_ativo: string
  concentracao: string
  forma: Forma | ''
  unidade: Unidade
  tarja: Tarja
  requer_receita: boolean
  indicacao: string
  quantidade_atual: string
  lote: string
  data_validade: string
  data_abertura: string
  validade_apos_aberto_dias: string
  local: string
  estoque_minimo: string
  observacao: string
}

const INICIAL: FormState = {
  codigo_barras: '', nome: '', principio_ativo: '', concentracao: '',
  forma: '', unidade: 'unidade', tarja: 'sem_tarja', requer_receita: false, indicacao: '',
  quantidade_atual: '', lote: '', data_validade: '', data_abertura: '',
  validade_apos_aberto_dias: '', local: '', estoque_minimo: '', observacao: '',
}

export default function Cadastro() {
  const navigate = useNavigate()
  const [f, setF] = useState<FormState>(INICIAL)
  const [scanner, setScanner] = useState(false)
  const [msg, setMsg] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null)

  const set = <K extends keyof FormState>(campo: K, valor: FormState[K]) =>
    setF(prev => ({ ...prev, [campo]: valor }))

  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [fotoUrlExistente, setFotoUrlExistente] = useState<string | null>(null)

  function onFoto(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0] ?? null
    setFoto(arquivo)
    setFotoPreview(arquivo ? URL.createObjectURL(arquivo) : fotoUrlExistente)
  }

  async function onCodigo(codigo: string) {
    setScanner(false)
    const med = await repo.findMedicamentoByBarcode(codigo)
    if (med) {
      setF(prev => ({
        ...prev, codigo_barras: codigo, nome: med.nome,
        principio_ativo: med.principio_ativo ?? '', concentracao: med.concentracao ?? '',
        forma: med.forma ?? '', unidade: med.unidade, tarja: med.tarja,
        requer_receita: med.requer_receita, indicacao: med.indicacao ?? '',
      }))
      setFotoUrlExistente(med.foto_url)
      if (med.foto_url) setFotoPreview(med.foto_url)
      setMsg({ texto: 'Produto reconhecido! Confira e preencha validade e quantidade.', tipo: 'ok' })
    } else {
      set('codigo_barras', codigo)
      setMsg({ texto: 'Código novo — preencha os dados. Fica salvo para a próxima vez.', tipo: 'ok' })
    }
  }

  function onFormaChange(forma: Forma | '') {
    setF(prev => ({ ...prev, forma, unidade: forma ? UNIDADE_PADRAO[forma] : prev.unidade }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!f.nome.trim()) return setMsg({ texto: 'Informe o nome do remédio.', tipo: 'erro' })
    if (!f.data_validade) return setMsg({ texto: 'Informe a data de validade.', tipo: 'erro' })
    const qtd = Number(f.quantidade_atual)
    if (!qtd || qtd <= 0) return setMsg({ texto: 'Informe a quantidade.', tipo: 'erro' })

    let fotoUrl = fotoUrlExistente
    if (foto) {
      try { fotoUrl = await repo.uploadFoto(foto) }
      catch { return setMsg({ texto: 'Não consegui enviar a foto. Tente de novo.', tipo: 'erro' }) }
    }

    const med = await repo.upsertMedicamento({
      codigo_barras: f.codigo_barras.trim() || null,
      nome: f.nome.trim(),
      principio_ativo: f.principio_ativo.trim() || null,
      concentracao: f.concentracao.trim() || null,
      forma: (f.forma || null) as Forma | null,
      unidade: f.unidade,
      tarja: f.tarja,
      requer_receita: f.requer_receita,
      indicacao: f.indicacao.trim() || null,
      bula_url: null, foto_url: fotoUrl,
    })

    await repo.addEstoque({
      medicamento_id: med.id,
      quantidade_atual: qtd,
      quantidade_inicial: qtd,
      lote: f.lote.trim() || null,
      data_validade: f.data_validade,
      data_abertura: f.data_abertura || null,
      validade_apos_aberto_dias: f.validade_apos_aberto_dias ? Number(f.validade_apos_aberto_dias) : null,
      local: f.local.trim() || null,
      estoque_minimo: f.estoque_minimo ? Number(f.estoque_minimo) : null,
      observacao: f.observacao.trim() || null,
      status: 'ativo',
    })

    navigate('/estoque?novo=1')
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
      <button type="button" className="btn btn-primary btn-block" onClick={() => setScanner(true)}>
        📷 Escanear código de barras
      </button>
      <p className="hint" style={{ textAlign: 'center', marginTop: -8 }}>
        Sem código ou não leu? É só preencher os campos abaixo.
      </p>

      {msg && (
        <p className={`card`} style={{ color: msg.tipo === 'erro' ? 'var(--danger)' : 'var(--ok)' }}>
          {msg.texto}
        </p>
      )}

      <fieldset className="card" style={{ border: '1px solid var(--border)', display: 'grid', gap: 0 }}>
        <legend style={{ fontWeight: 700, padding: '0 8px' }}>Remédio</legend>

        <div className="field">
          <label htmlFor="nome">Nome comercial *</label>
          <input id="nome" className="input" value={f.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex.: Dipirona" />
        </div>
        <div className="field">
          <label htmlFor="principio">Princípio ativo</label>
          <input id="principio" className="input" value={f.principio_ativo} onChange={e => set('principio_ativo', e.target.value)} placeholder="Ex.: Dipirona monoidratada" />
        </div>
        <div className="field">
          <label htmlFor="concentracao">Concentração / dosagem</label>
          <input id="concentracao" className="input" value={f.concentracao} onChange={e => set('concentracao', e.target.value)} placeholder="Ex.: 500 mg" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="forma">Forma</label>
            <select id="forma" className="select" value={f.forma} onChange={e => onFormaChange(e.target.value as Forma | '')}>
              <option value="">—</option>
              {FORMA_OPTS.map(o => <option key={o} value={o}>{FORMA_LABEL[o]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="unidade">Unidade</label>
            <select id="unidade" className="select" value={f.unidade} onChange={e => set('unidade', e.target.value as Unidade)}>
              {UNIDADE_OPTS.map(o => <option key={o} value={o}>{UNIDADE_LABEL[o]}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="indicacao">Para que serve (sintomas)</label>
          <input id="indicacao" className="input" value={f.indicacao} onChange={e => set('indicacao', e.target.value)} placeholder="Ex.: febre, dor de cabeça" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="tarja">Tarja</label>
            <select id="tarja" className="select" value={f.tarja} onChange={e => set('tarja', e.target.value as Tarja)}>
              {TARJA_OPTS.map(o => <option key={o} value={o}>{TARJA_LABEL[o]}</option>)}
            </select>
          </div>
          <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={f.requer_receita} onChange={e => set('requer_receita', e.target.checked)} style={{ width: 20, height: 20 }} />
            Receita
          </label>
        </div>
        <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
          <label htmlFor="codigo">Código de barras</label>
          <input id="codigo" className="input" inputMode="numeric" value={f.codigo_barras} onChange={e => set('codigo_barras', e.target.value)} placeholder="Preenchido pelo scanner ou digite" />
        </div>
        <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
          <label htmlFor="foto">Foto da embalagem</label>
          {fotoPreview && (
            <img src={fotoPreview} alt="Prévia da foto" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 12, marginBottom: 8 }} />
          )}
          <input id="foto" type="file" accept="image/*" capture="environment" onChange={onFoto} className="input" style={{ padding: 10 }} />
        </div>
      </fieldset>

      <fieldset className="card" style={{ border: '1px solid var(--border)' }}>
        <legend style={{ fontWeight: 700, padding: '0 8px' }}>Esta embalagem</legend>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="qtd">Quantidade * ({UNIDADE_LABEL[f.unidade]})</label>
            <input id="qtd" className="input" type="number" min="0" step="any" inputMode="decimal" value={f.quantidade_atual} onChange={e => set('quantidade_atual', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="validade">Validade (caixa) *</label>
            <input id="validade" className="input" type="date" value={f.data_validade} onChange={e => set('data_validade', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="abertura">Data de abertura</label>
            <input id="abertura" className="input" type="date" value={f.data_abertura} onChange={e => set('data_abertura', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="aposaberto">Validade após aberto (dias)</label>
            <input id="aposaberto" className="input" type="number" min="0" inputMode="numeric" value={f.validade_apos_aberto_dias} onChange={e => set('validade_apos_aberto_dias', e.target.value)} placeholder="Ex.: 30" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="local">Local (pote / armário)</label>
            <input id="local" className="input" value={f.local} onChange={e => set('local', e.target.value)} placeholder="Ex.: Pote azul" />
          </div>
          <div className="field">
            <label htmlFor="minimo">Avisar quando restar</label>
            <input id="minimo" className="input" type="number" min="0" step="any" inputMode="decimal" value={f.estoque_minimo} onChange={e => set('estoque_minimo', e.target.value)} placeholder="Ex.: 5" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="lote">Lote</label>
          <input id="lote" className="input" value={f.lote} onChange={e => set('lote', e.target.value)} placeholder="Opcional (útil em recall)" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="obs">Observações</label>
          <textarea id="obs" className="textarea" value={f.observacao} onChange={e => set('observacao', e.target.value)} placeholder="Ex.: tomar com comida" />
        </div>
      </fieldset>

      <button type="submit" className="btn btn-primary btn-block">Salvar remédio</button>

      {scanner && (
        <Suspense fallback={null}>
          <BarcodeScanner onDetected={onCodigo} onClose={() => setScanner(false)} />
        </Suspense>
      )}
    </form>
  )
}
