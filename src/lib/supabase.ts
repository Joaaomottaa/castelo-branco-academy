import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { demoForcado } from "./modo";

/**
 * Clientes Supabase.
 *
 * Duas condições precisam ser verdadeiras para o banco ser usado:
 *   1. as variáveis de ambiente existem  (supabaseConfigurado)
 *   2. o modo demonstração não está forçado  (src/lib/modo.ts)
 *
 * Se qualquer uma falhar, getSupabase() devolve null e toda a aplicação cai
 * automaticamente no seed local — sessão, catálogo, talentos e vagas.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** As credenciais existem? (independe do modo escolhido) */
export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** Cliente com sessão, para o navegador. null = usar o seed local. */
export function getSupabase() {
  if (!supabaseConfigurado || demoForcado()) return null;
  if (!cached) cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}

/**
 * Cliente anônimo, sem sessão — para renderização no servidor (landing, SEO).
 * Só enxerga o que o RLS libera para o papel `anon`: cursos publicados,
 * vagas ativas e perfis públicos.
 *
 * Não respeita o modo escolhido no navegador (o servidor não tem acesso a ele);
 * respeita apenas a trava NEXT_PUBLIC_MODO_DEMO. Como o seed do banco espelha o
 * seed local, o conteúdo exibido é o mesmo nos dois casos.
 */
export function getSupabaseAnon() {
  if (!supabaseConfigurado || demoForcado()) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
