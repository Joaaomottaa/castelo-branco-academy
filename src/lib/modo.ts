/**
 * MODO DE OPERAÇÃO
 *
 * A plataforma tem duas fontes de dados e você escolhe qual usar:
 *
 *   "auto"  → usa o Supabase se ele estiver configurado; senão cai no seed local.
 *   "demo"  → força o seed local mesmo com o Supabase conectado.
 *
 * A escolha fica no localStorage, então dá para alternar durante uma
 * apresentação sem reiniciar o servidor. Também é possível travar o modo demo
 * para todo mundo com NEXT_PUBLIC_MODO_DEMO=true no .env.local.
 */

export type Modo = "auto" | "demo";

export const CHAVE_MODO = "cba.modo";

/** Trava por variável de ambiente — vence qualquer escolha do navegador. */
export const DEMO_TRAVADO = process.env.NEXT_PUBLIC_MODO_DEMO === "true";

/** Lê a escolha atual. No servidor, sempre "auto" (a landing usa o banco). */
export function modoAtual(): Modo {
  if (DEMO_TRAVADO) return "demo";
  if (typeof window === "undefined") return "auto";
  try {
    return window.localStorage.getItem(CHAVE_MODO) === "demo" ? "demo" : "auto";
  } catch {
    return "auto";
  }
}

/** true quando o seed local deve ser usado, ignorando o Supabase. */
export function demoForcado(): boolean {
  return modoAtual() === "demo";
}

/**
 * Troca o modo e recarrega a página.
 * O reload é intencional: a sessão precisa ser reconstruída na outra fonte.
 */
export function definirModo(m: Modo) {
  if (typeof window === "undefined") return;
  try {
    if (m === "demo") window.localStorage.setItem(CHAVE_MODO, "demo");
    else window.localStorage.removeItem(CHAVE_MODO);
    // Limpa a sessão local para não misturar usuário de uma fonte com a outra.
    window.localStorage.removeItem("cba.user");
  } catch {
    /* storage indisponível */
  }
  window.location.href = "/login";
}

/**
 * Extrai uma mensagem legível de qualquer erro.
 *
 * O supabase-js rejeita com PostgrestError — um objeto simples com `message`,
 * `details` e `hint`, que NÃO é instância de Error. Sem este tratamento a
 * interface acaba mostrando "[object Object]".
 */
export function msgErro(e: unknown): string {
  if (!e) return "Erro desconhecido.";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const o = e as { message?: string; details?: string; hint?: string; code?: string };

    if (o.message) {
      // `details` costuma trazer a pilha inteira do supabase-js; só é útil
      // quando é curto e acrescenta informação nova.
      const extra =
        o.details && o.details.length < 160 && !o.details.startsWith(o.message)
          ? ` · ${o.details}`
          : "";
      const dica = o.hint ? ` · Dica: ${o.hint}` : "";
      const codigo = o.code ? ` (${o.code})` : "";
      return `${o.message}${extra}${dica}${codigo}`;
    }

    try {
      return JSON.stringify(e).slice(0, 300);
    } catch {
      return "Erro não serializável.";
    }
  }
  return String(e);
}

/**
 * O erro é "essa coluna/função ainda não existe no banco"?
 *
 * O código sobe pelo deploy e a migração roda à mão no SQL Editor: as duas
 * coisas não acontecem no mesmo segundo. Nesse intervalo o Postgres responde
 * `42703 column ... does not exist` e o PostgREST `PGRST204 Could not find the
 * ... column`, e é isso que este teste reconhece — para a tela cair para a
 * versão sem a coluna nova em vez de virar uma mensagem de erro de banco.
 *
 * Fica aqui, e não em cada repositório, porque o teste estava repetido em dois
 * arquivos e faltando em três — e é justamente onde faltava que a tela quebrou.
 */
export function colunaAusente(e: unknown): boolean {
  if (!e) return false;
  const o = e as { message?: string; code?: string };
  if (o.code === "42703" || o.code === "42883" || o.code === "PGRST204" || o.code === "PGRST202") {
    return true;
  }
  return /does not exist|could not find/i.test(o.message ?? "");
}
