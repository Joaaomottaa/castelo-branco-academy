"use client";

import { useEffect, useState } from "react";
import { useSession } from "./session";
import { type Empresa } from "./repo-empresa";
import { aindaEhOCacheDe, empresaDoPerfil } from "./empresa-cache";

/* ==========================================================================
   A EMPRESA DA SESSÃO, EM CACHE

   Três lugares precisam saber se quem está logado responde por uma empresa: a
   barra lateral (para oferecer o atalho do painel), a área /empresa (para a
   guarda) e o banco de talentos (que é benefício da conta empresarial).

   Sem cache seria um RPC por clique de menu. O cache é uma promessa em módulo
   — a pergunta é a mesma durante toda a navegação, e quem a invalida é quem
   muda o vínculo: aceitar convite, sair da empresa, virar gestor.
   ========================================================================== */

// O cache mora em `empresa-cache` porque a sessão precisa invalidá-lo no
// logout, e importar este hook de lá fecharia um ciclo entre os módulos.
// Reexportado para as telas que já chamavam por aqui.
export { esquecerEmpresaEmCache } from "./empresa-cache";

export interface EmpresaDaSessao {
  empresa: Empresa | null;
  carregando: boolean;
  /**
   * Pode usar o banco de talentos.
   *
   * Procurar gente é o que a empresa contrata; o aluno é quem *é* procurado.
   * Deixar o mural aberto para todo mundo esvaziava o principal argumento do
   * plano Empresarial — e expunha telefone e e-mail de quem entrou no banco
   * para uma plateia bem maior do que ela imaginava.
   */
  podeVerTalentos: boolean;
}

export function useEmpresaDaSessao(): EmpresaDaSessao {
  const { user, loading, modoDemo } = useSession();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user || modoDemo) {
      setEmpresa(null);
      setCarregando(false);
      return;
    }
    const perfilId = user.id;
    const promessa = empresaDoPerfil(perfilId);
    let ativo = true;
    setCarregando(true);
    void promessa.then((e) => {
      // Se a conta trocou no meio do caminho, esta resposta é da sessão
      // anterior e não pode pintar a tela desta.
      if (!ativo || !aindaEhOCacheDe(perfilId, promessa)) return;
      setEmpresa(e);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [loading, user, modoDemo]);

  // No modo demonstração não há tabela de vínculo: o papel do perfil é a única
  // informação disponível, e a conta `empresa@` do seed precisa funcionar.
  const porPapel = user?.role === "admin" || user?.role === "empresa";

  return {
    empresa,
    carregando: loading || carregando,
    podeVerTalentos: porPapel || Boolean(empresa?.gestor),
  };
}
