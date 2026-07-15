import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFamilia } from '../lib/familiaContext'
import { iniciarAssinatura } from '../lib/pagamento'

const RECURSOS = [
  { nome: 'Estoque e alertas de validade', gratis: true, premium: true },
  { nome: 'Foto da embalagem', gratis: true, premium: true },
  { nome: 'Sem anúncios', gratis: false, premium: true },
  { nome: 'Participar de várias famílias', gratis: false, premium: true },
  { nome: 'Lembretes de dose (push/e-mail)', gratis: false, premium: true },
  { nome: 'Relatório de aderência e backup', gratis: false, premium: true },
]

function Marca({ ok }: { ok: boolean }) {
  return <span aria-hidden="true" style={{ color: ok ? 'var(--ok)' : 'var(--muted)' }}>{ok ? '✓' : '—'}</span>
}

export default function Premium() {
  const { ativa, premium } = useFamilia()
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function assinar() {
    setErro(null)
    setCarregando(true)
    try {
      const url = await iniciarAssinatura()
      window.location.href = url
    } catch (e) {
      setErro((e as Error).message)
      setCarregando(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Link to="/familia" className="hint">← Voltar</Link>
      <div>
        <h2 style={{ fontSize: 22 }}>✨ Premium</h2>
        <p className="hint">Para a família {ativa?.nome ?? ''}. Sem anúncios e com todos os recursos.</p>
      </div>

      {premium ? (
        <div className="card" style={{ background: 'var(--ok-bg)', border: 'none' }}>
          <strong style={{ color: 'var(--ok)' }}>Você já é Premium 🎉</strong>
          <p className="hint" style={{ color: 'var(--ok)' }}>
            {ativa?.plano_ate ? `Ativo até ${new Date(ativa.plano_ate).toLocaleDateString('pt-BR')}.` : 'Assinatura ativa.'}
          </p>
        </div>
      ) : (
        <>
          <div className="card" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, fontSize: 14 }}>
              <span className="hint" style={{ margin: 0 }}>Recurso</span>
              <span className="hint" style={{ margin: 0, width: 56, textAlign: 'center' }}>Grátis</span>
              <span className="hint" style={{ margin: 0, width: 56, textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>Premium</span>
              {RECURSOS.map(r => (
                <div key={r.nome} style={{ display: 'contents' }}>
                  <span style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>{r.nome}</span>
                  <span style={{ borderTop: '1px solid var(--border)', paddingTop: 8, textAlign: 'center' }}><Marca ok={r.gratis} /></span>
                  <span style={{ borderTop: '1px solid var(--border)', paddingTop: 8, textAlign: 'center' }}><Marca ok={r.premium} /></span>
                </div>
              ))}
            </div>
          </div>

          {erro && <p className="card" style={{ padding: 12, color: 'var(--danger)' }}>{erro}</p>}

          <button className="btn btn-primary btn-block" onClick={assinar} disabled={carregando}>
            {carregando ? 'Abrindo o pagamento…' : 'Assinar o Premium'}
          </button>
          <p className="hint" style={{ textAlign: 'center' }}>
            Pagamento seguro pelo Mercado Pago (cartão ou Pix). Cancele quando quiser.
          </p>
        </>
      )}
    </div>
  )
}
