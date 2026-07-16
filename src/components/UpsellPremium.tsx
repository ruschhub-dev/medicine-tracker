import { Link } from 'react-router-dom'

// Placeholder mostrado no lugar de um recurso exclusivo do Premium (plano grátis).
export default function UpsellPremium({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20 }}>{titulo}</h2>
        <p className="hint">{descricao}</p>
      </div>
      <div className="card" style={{ display: 'grid', gap: 12, textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 40 }} aria-hidden="true">✨</div>
        <strong>Recurso do plano Premium</strong>
        <p className="hint" style={{ margin: 0 }}>Assine para desbloquear — sem anúncios e com tudo liberado.</p>
        <Link to="/premium" className="btn btn-primary btn-block">Ver o Premium</Link>
      </div>
    </div>
  )
}
