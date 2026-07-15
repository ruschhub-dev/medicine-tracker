import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { entrarComSenha, enviarLinkMagico, criarConta } from '../lib/auth'
import Turnstile, { captchaAtivo } from '../components/Turnstile'

type Modo = 'senha' | 'link' | 'criar'

function traduzErro(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado.'
  if (/user already registered|already registered/i.test(msg)) return 'Já existe uma conta com este e-mail. Faça login.'
  if (/password.*(6|short|weak)/i.test(msg)) return 'A senha precisa de pelo menos 6 caracteres.'
  if (/captcha/i.test(msg)) return 'Falha na verificação anti-robô. Tente de novo.'
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas. Aguarde um pouco.'
  return msg
}

export default function Login() {
  const [modo, setModo] = useState<Modo>('senha')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aceito, setAceito] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null)
  const [carregando, setCarregando] = useState(false)

  function mudarModo(m: Modo) { setModo(m); setMsg(null) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (modo === 'criar' && !aceito) {
      return setMsg({ texto: 'Para criar a conta, aceite os Termos e a Política de Privacidade.', tipo: 'erro' })
    }
    if (captchaAtivo && !captchaToken) {
      return setMsg({ texto: 'Confirme a verificação anti-robô abaixo.', tipo: 'erro' })
    }
    setMsg(null)
    setCarregando(true)
    const token = captchaToken ?? undefined
    try {
      if (modo === 'senha') {
        const { error } = await entrarComSenha(email.trim(), senha, token)
        if (error) setMsg({ texto: traduzErro(error.message), tipo: 'erro' })
      } else if (modo === 'link') {
        const { error } = await enviarLinkMagico(email.trim(), token)
        if (error) setMsg({ texto: traduzErro(error.message), tipo: 'erro' })
        else setMsg({ texto: 'Enviamos um link de acesso para o seu e-mail. Abra no mesmo aparelho. 📧', tipo: 'ok' })
      } else {
        const { data, error } = await criarConta(email.trim(), senha, token)
        if (error) setMsg({ texto: traduzErro(error.message), tipo: 'erro' })
        else if (data.session) setMsg({ texto: 'Conta criada! Entrando…', tipo: 'ok' })
        else setMsg({ texto: 'Conta criada! Confirme pelo link que enviamos ao seu e-mail e depois faça login. 📧', tipo: 'ok' })
      }
    } finally {
      setCarregando(false)
    }
  }

  const cta = modo === 'senha' ? 'Entrar' : modo === 'link' ? 'Enviar link de acesso' : 'Criar conta'

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 400, display: 'grid', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40 }} aria-hidden="true">💊</div>
          <h1 style={{ fontSize: 22 }}>Remédios em casa</h1>
          <p className="hint">Controle os remédios da sua família</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={`btn ${modo === 'senha' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '0 8px' }} onClick={() => mudarModo('senha')}>Entrar</button>
          <button type="button" className={`btn ${modo === 'link' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '0 8px' }} onClick={() => mudarModo('link')}>Link</button>
          <button type="button" className={`btn ${modo === 'criar' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '0 8px' }} onClick={() => mudarModo('criar')}>Criar conta</button>
        </div>

        {msg && (
          <p className="card" style={{ padding: 12, color: msg.tipo === 'erro' ? 'var(--danger)' : 'var(--ok)' }}>
            {msg.texto}
          </p>
        )}

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
        </div>

        {modo !== 'link' && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="senha">Senha</label>
            <input id="senha" className="input" type="password"
              autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} required
              value={senha} onChange={e => setSenha(e.target.value)} placeholder={modo === 'criar' ? 'Mínimo 6 caracteres' : ''} />
          </div>
        )}

        {modo === 'criar' && (
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: 'var(--muted)' }}>
            <input type="checkbox" checked={aceito} onChange={e => setAceito(e.target.checked)}
              style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0 }} />
            <span>
              Li e aceito os <Link to="/termos">Termos de Uso</Link> e a <Link to="/privacidade">Política de Privacidade</Link>,
              incluindo o tratamento de dados de saúde da minha família.
            </span>
          </label>
        )}

        {captchaAtivo && (
          <Turnstile onToken={setCaptchaToken} />
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={carregando}>
          {carregando ? 'Aguarde…' : cta}
        </button>

        <p className="hint" style={{ textAlign: 'center' }}>
          {modo === 'criar'
            ? 'Depois de entrar, você cria a sua família ou entra em uma com um convite.'
            : 'Novo por aqui? Toque em “Criar conta”.'}
        </p>

        <p className="hint" style={{ textAlign: 'center', marginTop: -6 }}>
          <Link to="/termos">Termos</Link> · <Link to="/privacidade">Privacidade</Link>
        </p>
      </form>
    </div>
  )
}
