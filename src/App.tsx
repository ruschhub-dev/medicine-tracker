import { Routes, Route, Navigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Painel from './pages/Painel'
import Cadastro from './pages/Cadastro'
import Consulta from './pages/Consulta'
import Consumo from './pages/Consumo'
import Estoque from './pages/Estoque'
import Familia from './pages/Familia'
import Historico from './pages/Historico'
import Descarte from './pages/Descarte'
import Hoje from './pages/Hoje'
import Tratamentos from './pages/Tratamentos'
import Moderacao from './pages/Moderacao'
import Premium from './pages/Premium'
import Privacidade from './pages/Privacidade'
import Termos from './pages/Termos'
import { useAuth } from './lib/auth'
import { FamiliaProvider, useFamilia } from './lib/familiaContext'

const Carregando = () => (
  <div style={{ padding: 48, textAlign: 'center' }} className="muted">Carregando…</div>
)

// Deixa as páginas legais acessíveis mesmo sem login/família; qualquer outra rota cai no fallback.
function RotasComLegal({ fallback }: { fallback: ReactElement }) {
  return (
    <Routes>
      <Route path="/privacidade" element={<Privacidade />} />
      <Route path="/termos" element={<Termos />} />
      <Route path="*" element={fallback} />
    </Routes>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Painel />} />
        <Route path="cadastro" element={<Cadastro />} />
        <Route path="consulta" element={<Consulta />} />
        <Route path="consumo" element={<Consumo />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="familia" element={<Familia />} />
        <Route path="historico" element={<Historico />} />
        <Route path="descarte" element={<Descarte />} />
        <Route path="hoje" element={<Hoje />} />
        <Route path="tratamentos" element={<Tratamentos />} />
        <Route path="moderacao" element={<Moderacao />} />
        <Route path="premium" element={<Premium />} />
        <Route path="privacidade" element={<Privacidade />} />
        <Route path="termos" element={<Termos />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function AppInterno() {
  const { carregando, familias, ativa } = useFamilia()
  if (carregando) return <Carregando />
  if (familias.length === 0 || !ativa) return <RotasComLegal fallback={<Onboarding />} />
  // key = família ativa: trocar de família remonta as telas e recarrega os dados.
  return <AppRoutes key={ativa.id} />
}

export default function App() {
  const { session, loading, precisaLogin } = useAuth()

  if (loading) return <Carregando />
  if (precisaLogin && !session) return <RotasComLegal fallback={<Login />} />

  return (
    <FamiliaProvider>
      <AppInterno />
    </FamiliaProvider>
  )
}
