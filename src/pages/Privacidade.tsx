import { Link } from 'react-router-dom'

const ATUALIZADO = '14 de julho de 2026'
// TODO(responsável): preencha o controlador e o contato oficiais antes de divulgar.
const CONTROLADOR = '[nome do responsável / MEI]'
const CONTATO = 'mar.io@outlook.com.br'

export default function Privacidade() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 18, display: 'grid', gap: 16 }}>
      <Link to="/" className="hint">← Voltar</Link>
      <div>
        <h1 style={{ fontSize: 24 }}>Política de Privacidade</h1>
        <p className="hint">Última atualização: {ATUALIZADO}</p>
      </div>

      <div className="card" style={{ display: 'grid', gap: 14, lineHeight: 1.55 }}>
        <p>
          Este app ajuda famílias a organizar os remédios guardados em casa. Levamos a sério que
          isso envolve <strong>dados de saúde</strong>, que são dados pessoais sensíveis pela Lei
          Geral de Proteção de Dados (LGPD, Lei 13.709/2018). Esta política explica o que
          coletamos, por quê, e quais são os seus direitos.
        </p>

        <div>
          <h2 style={{ fontSize: 18 }}>Quem é o controlador</h2>
          <p>Controlador dos dados: <strong>{CONTROLADOR}</strong>. Contato para privacidade: <strong>{CONTATO}</strong>.</p>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Que dados coletamos</h2>
          <ul style={{ margin: '6px 0 0 18px', display: 'grid', gap: 4 }}>
            <li><strong>Conta:</strong> seu e-mail e senha (a senha é gerenciada com segurança pelo provedor de autenticação; nunca a vemos).</li>
            <li><strong>Dados da família (saúde):</strong> nomes ou apelidos das pessoas da casa, remédios, quantidades, validades, locais, tratamentos, horários de dose, histórico de consumo e fotos de embalagem que você cadastrar.</li>
            <li><strong>Notificações:</strong> a inscrição do seu aparelho para receber lembretes (push).</li>
            <li><strong>Consentimento:</strong> a data e hora em que você aceitou esta política.</li>
          </ul>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Para que usamos</h2>
          <p>
            Somente para o funcionamento do app: guardar seu estoque, calcular validades, enviar
            lembretes de validade e de dose, e mostrar o histórico. <strong>Não vendemos seus
            dados</strong> e não os usamos para publicidade personalizada.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Base legal</h2>
          <p>
            Por se tratar de dado sensível de saúde, o tratamento se apoia no <strong>seu
            consentimento</strong> (art. 11, I da LGPD), dado no cadastro e revogável a qualquer
            momento (ver “Seus direitos”).
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Isolamento entre famílias</h2>
          <p>
            Cada família tem seus dados <strong>separados</strong>. Só quem é membro de uma família
            enxerga os dados dela — isso é garantido no banco por regras de segurança por linha
            (RLS). Outras famílias e outros usuários não têm acesso.
          </p>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Com quem compartilhamos</h2>
          <p>Apenas com prestadores que operam o serviço, como operadores de dados:</p>
          <ul style={{ margin: '6px 0 0 18px', display: 'grid', gap: 4 }}>
            <li><strong>Supabase</strong> — banco de dados, autenticação e armazenamento das fotos.</li>
            <li><strong>Vercel</strong> — hospedagem do app.</li>
            <li><strong>Serviços de push</strong> do seu navegador/sistema (ex.: Google, Apple, Microsoft) para entregar os lembretes.</li>
            <li><strong>Google (Gmail)</strong> — apenas se o resumo por e-mail estiver ativado, para enviar o aviso.</li>
          </ul>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Por quanto tempo guardamos</h2>
          <p>Enquanto a sua conta e a sua família existirem. Você pode pedir a exclusão a qualquer momento.</p>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Seus direitos (LGPD)</h2>
          <p>Você pode, a qualquer momento: acessar, corrigir, exportar, excluir seus dados e revogar o consentimento. No app você já pode exportar o estoque em CSV e remover itens; para exclusão total da conta ou dúvidas, escreva para <strong>{CONTATO}</strong>.</p>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Crianças</h2>
          <p>Os dados de crianças são inseridos e geridos pelos responsáveis da família, sob a responsabilidade deles.</p>
        </div>

        <div>
          <h2 style={{ fontSize: 18 }}>Segurança</h2>
          <p>Usamos conexão criptografada (HTTPS), isolamento por família (RLS) e autenticação gerenciada. Nenhum sistema é 100% infalível, mas trabalhamos para proteger seus dados.</p>
        </div>

        <div className="card" style={{ background: 'var(--warn-bg)', border: 'none' }}>
          <h2 style={{ fontSize: 18, color: 'var(--warn)' }}>⚠️ Aviso importante (não é aconselhamento médico)</h2>
          <p style={{ color: 'var(--warn)' }}>
            Este app é apenas uma ferramenta de <strong>organização</strong> dos remédios de casa.
            Ele <strong>não substitui</strong> a orientação de médico ou farmacêutico e não deve ser
            usado para decisões clínicas. Sempre confira a bula e siga a prescrição. Em caso de
            emergência ou dúvida sobre saúde, procure um profissional.
          </p>
        </div>
      </div>

      <p className="hint">Veja também os <Link to="/termos">Termos de Uso</Link>.</p>
    </div>
  )
}
