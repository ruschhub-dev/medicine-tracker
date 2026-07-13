import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/repo'
import type { Medicamento, Perfil, TratamentoCompleto } from '../lib/types'
import { UNIDADE_LABEL, DIAS_SEMANA } from '../lib/types'
import { hojeBrasilia } from '../lib/dates'

export default function Tratamentos() {
  const [tratamentos, setTratamentos] = useState<TratamentoCompleto[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])
  const [carregando, setCarregando] = useState(true)

  const [perfilId, setPerfilId] = useState('')
  const [medId, setMedId] = useState('')
  const [dose, setDose] = useState('1')
  const [horarios, setHorarios] = useState<string[]>(['08:00'])
  const [todosDias, setTodosDias] = useState(true)
  const [dias, setDias] = useState<number[]>([])
  const [dataFim, setDataFim] = useState('')
  const [obs, setObs] = useState('')
  const [msg, setMsg] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null)

  async function recarregar() {
    const [t, p, m] = await Promise.all([repo.listTratamentos(), repo.listPerfis(), repo.listMedicamentos()])
    setTratamentos(t); setPerfis(p); setMedicamentos(m); setCarregando(false)
  }
  useEffect(() => { recarregar() }, [])

  const medSel = medicamentos.find(m => m.id === medId)

  const setHorario = (i: number, v: string) => setHorarios(hs => hs.map((h, idx) => idx === i ? v : h))
  const addHorario = () => setHorarios(hs => [...hs, '12:00'])
  const removeHorario = (i: number) => setHorarios(hs => hs.length > 1 ? hs.filter((_, idx) => idx !== i) : hs)
  const toggleDia = (d: number) => setDias(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!medId) return setMsg({ texto: 'Escolha o remédio.', tipo: 'erro' })
    const doseN = Number(dose)
    if (!doseN || doseN <= 0) return setMsg({ texto: 'Informe a dose.', tipo: 'erro' })
    if (!todosDias && dias.length === 0) return setMsg({ texto: 'Selecione os dias ou marque "todos os dias".', tipo: 'erro' })

    await repo.addTratamento({
      perfil_id: perfilId || null,
      medicamento_id: medId,
      dose: doseN,
      horarios: [...horarios].sort(),
      dias_semana: todosDias ? null : [...dias].sort(),
      data_inicio: hojeBrasilia(),
      data_fim: dataFim || null,
      ativo: true,
      observacao: obs.trim() || null,
    })

    setPerfilId(''); setMedId(''); setDose('1'); setHorarios(['08:00'])
    setTodosDias(true); setDias([]); setDataFim(''); setObs('')
    setMsg({ texto: '✅ Tratamento criado.', tipo: 'ok' })
    recarregar()
  }

  async function alternarAtivo(t: TratamentoCompleto) {
    await repo.updateTratamento(t.id, { ativo: !t.ativo })
    recarregar()
  }
  async function excluir(id: string) {
    if (!confirm('Excluir este tratamento? As doses dele também saem.')) return
    await repo.deleteTratamento(id)
    recarregar()
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20 }}>Tratamentos</h2>
        <p className="hint">Agende os horários de cada remédio. As doses aparecem na tela <Link to="/hoje">Hoje</Link> e chegam por notificação.</p>
      </div>

      {medicamentos.length === 0 ? (
        <p className="card muted">Cadastre um remédio primeiro em <Link to="/cadastro">Cadastrar</Link>.</p>
      ) : (
        <form onSubmit={salvar} className="card" style={{ display: 'grid', gap: 12 }}>
          {msg && <p className="hint" style={{ color: msg.tipo === 'erro' ? 'var(--danger)' : 'var(--ok)' }}>{msg.texto}</p>}

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="med">Remédio</label>
            <select id="med" className="select" value={medId} onChange={e => setMedId(e.target.value)}>
              <option value="">— escolha —</option>
              {medicamentos.map(m => <option key={m.id} value={m.id}>{m.nome} {m.concentracao ?? ''}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="pessoa">Quem toma</label>
              <select id="pessoa" className="select" value={perfilId} onChange={e => setPerfilId(e.target.value)}>
                <option value="">— não informar —</option>
                {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="dose">Dose {medSel ? `(${UNIDADE_LABEL[medSel.unidade]})` : ''}</label>
              <input id="dose" className="input" type="number" min="0" step="any" inputMode="decimal" value={dose} onChange={e => setDose(e.target.value)} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Horários</label>
            <div style={{ display: 'grid', gap: 8 }}>
              {horarios.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input className="input" type="time" value={h} onChange={e => setHorario(i, e.target.value)} />
                  {horarios.length > 1 && (
                    <button type="button" className="btn btn-outline" onClick={() => removeHorario(i)} aria-label="Remover horário">✕</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-outline" onClick={addHorario}>+ Adicionar horário</button>
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15, color: 'var(--muted)' }}>
              <input type="checkbox" checked={todosDias} onChange={e => setTodosDias(e.target.checked)} style={{ width: 20, height: 20 }} />
              Todos os dias
            </label>
            {!todosDias && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {DIAS_SEMANA.map(d => (
                  <button key={d.valor} type="button" onClick={() => toggleDia(d.valor)}
                    className={`btn ${dias.includes(d.valor) ? 'btn-primary' : 'btn-outline'}`}
                    style={{ minHeight: 40, padding: '0 12px', fontSize: 14 }}>{d.curto}</button>
                ))}
              </div>
            )}
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="fim">Até quando (opcional)</label>
            <input id="fim" className="input" type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            <span className="hint">Deixe vazio para tratamento contínuo.</span>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="obs">Observação</label>
            <input id="obs" className="input" value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: tomar com comida" />
          </div>

          <button type="submit" className="btn btn-primary btn-block">Criar tratamento</button>
        </form>
      )}

      {!carregando && tratamentos.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {tratamentos.map(t => (
            <div key={t.id} className="card" style={{ opacity: t.ativo ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <strong>{t.medicamento.nome}</strong>{' '}
                  <span className="muted">{t.dose} {UNIDADE_LABEL[t.medicamento.unidade]}</span>
                  <div className="hint">
                    {t.perfil_nome ?? 'Sem pessoa'} · {t.horarios.join(', ')}
                    {t.dias_semana && t.dias_semana.length > 0
                      ? ' · ' + t.dias_semana.map(d => DIAS_SEMANA[d].curto).join('/')
                      : ' · todos os dias'}
                  </div>
                </div>
                {!t.ativo && <span className="badge badge-muted">pausado</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => alternarAtivo(t)}>{t.ativo ? 'Pausar' : 'Ativar'}</button>
                <button className="btn btn-danger" onClick={() => excluir(t.id)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
