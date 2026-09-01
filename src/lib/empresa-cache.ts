import { carregarEmpresa, type Empresa } from "./repo-empresa";

/* ==========================================================================
   O VÍNCULO COM A EMPRESA, EM CACHE

   Vive num módulo separado por um motivo prático: quem *usa* o cache é um hook
   de React (`useEmpresaDaSessao`), mas quem precisa *invalidá-lo* é a sessão,
   no logout. Se a sessão importasse o hook, os dois módulos se importariam em
   círculo. Aqui não há dependência de React nem de sessão — só a pergunta e a
   resposta.

   O cache guarda de quem é a resposta. Antes era uma promessa solta, e módulo
   não morre na troca de conta: quem entrava depois de um gestor via no menu
   "Painel da <empresa do anterior>".
   ========================================================================== */

let cache: { perfilId: string; promessa: Promise<Empresa | null> } | null = null;

/** A empresa deste perfil, reaproveitando a resposta enquanto for dele. */
export function empresaDoPerfil(perfilId: string): Promise<Empresa | null> {
  if (!cache || cache.perfilId !== perfilId) {
    cache = { perfilId, promessa: carregarEmpresa() };
  }
  return cache.promessa;
}

/** Quem chama é quem muda o vínculo: login, logout, convite, sair da empresa. */
export function esquecerEmpresaEmCache() {
  cache = null;
}

/**
 * A promessa em curso para este perfil, se ainda for a mesma.
 *
 * Serve para o hook descartar uma resposta que chegou depois da troca de conta:
 * o `then` de uma promessa antiga não pode pintar a tela da sessão nova.
 */
export function aindaEhOCacheDe(perfilId: string, promessa: Promise<Empresa | null>) {
  return cache?.perfilId === perfilId && cache.promessa === promessa;
}
