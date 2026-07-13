import { useEffect, useState } from 'react'
import { modoLocal } from '../lib/repo'
import { pushSuportado, estaInscrito, ativarLembretes, desativarLembretes } from '../lib/push'

export default function LembretesToggle() {
  const [inscrito, setInscrito] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null)

  useEffect(() => {
    estaInscrito().then(v => { setInscrito(v); setCarregando(false) })
  }, [])

  // Sem nuvem não há servidor para enviar os lembretes.
  if (modoLocal) return null

  async function ativar() {
    setOcupado(true); setMsg(null)
    const r = await ativarLembretes()
    if (r.ok) { setInscrito(true); setMsg({ texto: '✅ Lembretes ativados neste aparelho.', tipo: 'ok' }) }
    else setMsg({ texto: r.erro ?? 'Não foi possível ativar.', tipo: 'erro' })
    setOcupado(false)
  }

  async function desativar() {
    setOcupado(true); setMsg(null)
    await desativarLembretes()
    setInscrito(false)
    setMsg({ texto: 'Lembretes desativados neste aparelho.', tipo: 'ok' })
    setOcupado(false)
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{ fontSize: 24 }}>🔔</span>
        <div style={{ flex: 1 }}>
          <strong>Lembretes de validade</strong>
          <div className="hint">Um aviso neste aparelho quando algum remédio estiver vencendo.</div>
        </div>
      </div>

      {!pushSuportado ? (
        <p className="hint" style={{ marginTop: 10 }}>
          Este navegador não suporta notificações. No iPhone, instale o app pela tela inicial (Safari) primeiro.
        </p>
      ) : (
        <button
          className={`btn btn-block ${inscrito ? 'btn-outline' : 'btn-primary'}`}
          style={{ marginTop: 12 }}
          disabled={carregando || ocupado}
          onClick={inscrito ? desativar : ativar}
        >
          {carregando ? '…' : inscrito ? 'Desativar neste aparelho' : 'Ativar lembretes neste aparelho'}
        </button>
      )}

      {msg && (
        <p className="hint" style={{ marginTop: 8, color: msg.tipo === 'erro' ? 'var(--danger)' : 'var(--ok)' }}>
          {msg.texto}
        </p>
      )}
    </div>
  )
}
