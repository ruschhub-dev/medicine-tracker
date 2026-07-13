import { NavLink, Outlet, Link } from 'react-router-dom'
import { modoLocal } from '../lib/repo'
import { sair } from '../lib/auth'
import { useFamilia } from '../lib/familiaContext'

const NAV = [
  { to: '/', label: 'Painel', icon: '🏠', end: true },
  { to: '/estoque', label: 'Estoque', icon: '📦', end: false },
  { to: '/cadastro', label: 'Cadastrar', icon: '➕', end: false },
  { to: '/consumo', label: 'Tomar', icon: '💊', end: false },
  { to: '/consulta', label: 'Buscar', icon: '🔍', end: false },
]

export default function Layout() {
  const { familias, ativa, trocar } = useFamilia()

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span aria-hidden="true" style={{ fontSize: 24 }}>💊</span>

        {familias.length > 1 ? (
          <select
            className="select"
            aria-label="Família ativa"
            value={ativa?.id ?? ''}
            onChange={e => trocar(e.target.value)}
            style={{ flex: 1, minWidth: 0, minHeight: 40, fontWeight: 600 }}
          >
            {familias.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        ) : (
          <strong style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ativa?.nome ?? 'Remédios'}
          </strong>
        )}

        <Link to="/familia" className="btn btn-outline" style={{ minHeight: 40, padding: '0 12px', fontSize: 18 }} title="Família" aria-label="Família">
          👥
        </Link>
        {modoLocal ? (
          <span className="badge badge-muted" title="Os dados estão salvos só neste dispositivo. Configure o Supabase para compartilhar.">
            local
          </span>
        ) : (
          <button className="btn btn-outline" style={{ minHeight: 40, padding: '0 12px', fontSize: 15 }} onClick={() => sair()}>
            Sair
          </button>
        )}
      </header>

      <main style={{ flex: 1, padding: '18px', paddingBottom: 96 }}>
        <Outlet />
      </main>

      <nav aria-label="Navegação principal" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', width: '100%', maxWidth: 680 }}>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, padding: '10px 4px 12px', textDecoration: 'none',
                fontSize: 12, fontWeight: 600,
                color: isActive ? 'var(--primary)' : 'var(--muted)',
              })}
            >
              <span aria-hidden="true" style={{ fontSize: 22 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
