// Autenticação (Supabase). Em modo local, o app não exige login.
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, hasSupabase } from './supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(hasSupabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, loading, precisaLogin: hasSupabase }
}

export function entrarComSenha(email: string, senha: string, captchaToken?: string) {
  return supabase!.auth.signInWithPassword({
    email,
    password: senha,
    options: captchaToken ? { captchaToken } : undefined,
  })
}

export function criarConta(email: string, senha: string, captchaToken?: string) {
  return supabase!.auth.signUp({
    email,
    password: senha,
    options: {
      emailRedirectTo: window.location.origin,
      captchaToken,
      // Registra o consentimento LGPD (termos + privacidade) no metadata do usuário.
      data: { consentimento: { termos: true, privacidade: true, aceito_em: new Date().toISOString() } },
    },
  })
}

export function enviarLinkMagico(email: string, captchaToken?: string) {
  return supabase!.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin, captchaToken },
  })
}

export async function sair() {
  await supabase?.auth.signOut()
}
