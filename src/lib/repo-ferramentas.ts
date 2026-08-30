import { getSupabase } from "./supabase";

/* ==========================================================================
   USO DAS FERRAMENTAS

   Registra que alguém abriu uma calculadora. Só o slug e o id do perfil — os
   valores digitados (salário, faturamento, dados de cliente) nunca saem do
   navegador, e é assim que tem que ser.

   Serve para o painel responder o que a base realmente usa. Quando a
   ferramenta mais aberta do mês for a de importação, isso é demanda para curso
   de comex antes de qualquer pesquisa de opinião.
   ========================================================================== */

const JA_REGISTRADO = new Set<string>();

export async function registrarUsoFerramenta(slug: string): Promise<void> {
  // Uma vez por ferramenta por sessão de navegação: recarregar a página não
  // deve inflar a métrica.
  if (JA_REGISTRADO.has(slug)) return;
  JA_REGISTRADO.add(slug);

  const sb = getSupabase();
  if (!sb) return;

  const { data } = await sb.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;

  await sb.from("ferramenta_usos").insert({ slug, perfil_id: uid });
}
