// Contexto da família ativa: lista das minhas famílias + qual está selecionada.
// Alimenta o seletor no topo e a porta de onboarding.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { MinhaFamilia } from './types'
import { listMinhasFamilias, getFamiliaAtiva, setFamiliaAtiva } from './familia'

interface FamiliaCtx {
  carregando: boolean
  familias: MinhaFamilia[]
  ativa: MinhaFamilia | null
  premium: boolean
  trocar: (id: string) => void
  recarregar: () => Promise<void>
}

/** A família ativa está no plano Premium e dentro da validade? */
function ehPremium(f: MinhaFamilia | null): boolean {
  if (!f || f.plano !== 'premium') return false
  return !f.plano_ate || new Date(f.plano_ate) > new Date()
}

const Ctx = createContext<FamiliaCtx | null>(null)

export function useFamilia(): FamiliaCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useFamilia usado fora do FamiliaProvider')
  return c
}

export function FamiliaProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const [familias, setFamilias] = useState<MinhaFamilia[]>([])
  const [ativaId, setAtivaId] = useState<string | null>(getFamiliaAtiva())

  async function recarregar() {
    const fams = await listMinhasFamilias()
    setFamilias(fams)
    let alvo = getFamiliaAtiva()
    if (!alvo || !fams.some(f => f.id === alvo)) alvo = fams[0]?.id ?? null
    if (alvo) setFamiliaAtiva(alvo)
    setAtivaId(alvo)
    setCarregando(false)
  }

  useEffect(() => { recarregar() }, [])

  function trocar(id: string) {
    setFamiliaAtiva(id)
    setAtivaId(id)
  }

  const ativa = familias.find(f => f.id === ativaId) ?? null

  return (
    <Ctx.Provider value={{ carregando, familias, ativa, premium: ehPremium(ativa), trocar, recarregar }}>
      {children}
    </Ctx.Provider>
  )
}
