import { useState, type FormEvent } from 'react'
import { criarFamilia, entrarComConvite } from '../lib/familia'
import { useFamilia } from '../lib/familiaContext'
import { sair } from '../lib/auth'
import { modoLocal } from '../lib/repo'

export default function Onboarding() {
  const { recarregar } = useFamilia()
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function criar(e: FormEvent) {
    e.preventDefault()
    setErro(null); setCarregando(true)
    try {
      await criarFamilia(nome)
      await recarregar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setCarregando(false)
    }
  }

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro(null); setCarregando(true)
    try {
      await entrarComConvite(codigo)
      await recarregar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'grid', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }} aria-hidden="true">👨‍👩‍👧‍👦</div>
          <h1 style={{ fontSize: 22 }}>Sua família</h1>
          <p className="hint">Crie a sua família ou entre em uma com um convite. Os remédios ficam separados por família.</p>
        </div>

        {erro && (
          <p className="card" style={{ padding: 12, color: 'var(--danger)' }}>{erro}</p>
        )}

        <form onSubmit={criar} className="card" style={{ display: 'grid', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18 }}>Criar uma família</h2>
            <p className="hint">Você fica como responsável e pode convidar as outras pessoas depois.</p>
          </div>
          <input className="input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Família Silva" aria-label="Nome da família" />
          <button type="submit" className="btn btn-primary btn-block" disabled={carregando}>
            {carregando ? 'Aguarde…' : 'Criar família'}
          </button>
        </form>

        <form onSubmit={entrar} className="card" style={{ display: 'grid', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18 }}>Entrar com convite</h2>
            <p className="hint">Recebeu um código de convite? Cole aqui para entrar na família.</p>
          </div>
          <input className="input" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ex.: K7QX9F2A" aria-label="Código de convite" style={{ textTransform: 'uppercase' }} />
          <button type="submit" className="btn btn-outline btn-block" disabled={carregando}>
            {carregando ? 'Aguarde…' : 'Entrar na família'}
          </button>
        </form>

        {!modoLocal && (
          <button className="btn btn-outline" style={{ justifySelf: 'center' }} onClick={() => sair()}>Sair da conta</button>
        )}
      </div>
    </div>
  )
}
