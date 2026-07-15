import { Link } from 'react-router-dom'

const ATUALIZADO = '14 de julho de 2026'

export default function Termos() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 18, display: 'grid', gap: 16 }}>
      <Link to="/" className="hint">← Voltar</Link>
      <div>
        <h1 style={{ fontSize: 24 }}>Termos de Uso</h1>
        <p className="hint">Última atualização: {ATUALIZADO}</p>
      </div>

      <div className="card" style={{ display: 'grid', gap: 14, lineHeight: 1.55 }}>
        <div>
          <h2 style={{ fontSize: 18 }}>O que é o serviço</h2>
          <p>
            Um app para a família cadastrar e acompanhar os remédios guardados em casa, com alertas
            de validade e lembretes de dose. É uma ferramenta de <strong>organização</strong>.
          </p>
        </div>

        <div className="card" style={{ background: 'var(--warn-bg)', border: 'none' }}>
          <h2 style={{ fontSize: 18, color: 'var(--warn)' }}>⚠️ Não é aconselhamento médico</h2>
          <p style={{ color: 'var(--warn)' }}>
            O app não substitui médico nem farmacêutico e não deve ser usado para decisões clínicas.
            Confira sempre a bula e a prescrição. Em emergência, procure um profissional de saúde.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Sua responsabilidade</h2>
          <ul style={{ margin: '6px 0 0 18px', display: 'grid', gap: 4 }}>
            <li>Manter seus dados de acesso em segurança.</li>
            <li>Cadastrar informações corretas — validades e doses dependem do que você digita.</li>
            <li>Convidar para a sua família apenas pessoas de confiança (elas verão o estoque).</li>
            <li>Usar o app de forma lícita e não tentar acessar dados de outras famílias.</li>
          </ul>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Disponibilidade</h2>
          <p>
            O serviço é oferecido “no estado em que se encontra”, sem garantia de disponibilidade
            ininterrupta. Lembretes dependem do seu aparelho, do navegador e da conexão, e podem
            atrasar ou falhar — não confie neles como única forma de tomar um remédio.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Planos</h2>
          <p>
            Pode haver um plano gratuito e um plano pago (Premium) com recursos adicionais. As
            condições de cada plano são informadas no momento da contratação.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Encerramento</h2>
          <p>Você pode encerrar sua conta quando quiser. Podemos suspender contas que violem estes termos.</p>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Privacidade</h2>
          <p>O tratamento dos seus dados segue a nossa <Link to="/privacidade">Política de Privacidade</Link>.</p>
        </div>
      </div>
    </div>
  )
}
