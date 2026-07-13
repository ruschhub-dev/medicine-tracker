// Cliente Supabase. Fica nulo (modo local) enquanto as variáveis não são preenchidas.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const hasSupabase = Boolean(url && anon)

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url as string, anon as string)
  : null
