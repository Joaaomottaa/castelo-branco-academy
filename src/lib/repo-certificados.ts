import { getSupabase } from "./supabase";
import type { CertificadoValidado } from "./types";

/* ==========================================================================
   VALIDAÇÃO PÚBLICA DE CERTIFICADO

   Quem consulta é quase sempre um RH que não tem conta aqui. Por isso a
   consulta não passa pelas tabelas: passa por `validar_certificado`, uma
   função `security definer` com `execute` liberado para `anon`.

   Ela devolve só o que um certificado precisa provar — nome, título, carga
   horária, data — e nunca e-mail, telefone ou id do perfil. O RLS das tabelas
   continua fechado; a função é a única porta, e ela é estreita de propósito.
   ========================================================================== */

/** Normaliza o que a pessoa digitou: espaços, minúsculas e hífens sobrando. */
export function limparCodigo(bruto: string): string {
  return bruto.trim().toUpperCase().replace(/\s+/g, "");
}

export async function validarCertificado(codigo: string): Promise<CertificadoValidado> {
  const limpo = limparCodigo(codigo);
  if (!limpo) return { valido: false, motivo: "sem-codigo" };

  const sb = getSupabase();
  // Sem Supabase (modo demonstração) não há o que validar — e inventar um
  // "válido" aqui seria pior do que dizer que a consulta não está disponível.
  if (!sb) return { valido: false, motivo: "nao-encontrado", codigo: limpo };

  const { data, error } = await sb.rpc("validar_certificado", { p_codigo: limpo });
  if (error) {
    console.error("[certificado] validar:", error.message);
    return { valido: false, motivo: "nao-encontrado", codigo: limpo };
  }
  const r = (data ?? { valido: false, motivo: "nao-encontrado" }) as CertificadoValidado;
  // O "não encontrado" volta sem código. Devolver o que foi consultado deixa a
  // tela mostrar para a pessoa exatamente o que ela digitou — é assim que se
  // percebe o caractere que faltou na cópia.
  return { ...r, codigo: r.codigo ?? limpo };
}
