"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Aula, Certificado, CertificadoTrilha, Curso, Perfil, Trilha, Vaga } from "./types";
import { carregarTudo, calcularMatch, snapshotDemo, type Snapshot } from "./repo";
import { useSession } from "./session";

/* ==========================================================================
   Fonte única de dados do catálogo, talentos, vagas e certificados.
   Carrega uma vez por sessão de navegação. As páginas consomem via useDados().
   ========================================================================== */

interface DadosValue extends Snapshot {
  carregando: boolean;
  recarregar: () => Promise<void>;
  /* helpers — mesma assinatura que as páginas já usavam */
  getCurso: (slug: string) => Curso | undefined;
  getTrilha: (slug: string) => Trilha | undefined;
  /** Certificados de trilha do usuário logado. */
  minhasTrilhas: CertificadoTrilha[];
  getTalento: (id: string) => Perfil | undefined;
  getVaga: (id: string) => Vaga | undefined;
  totalAulas: (c: Curso) => number;
  todasAulas: (c: Curso) => Array<Aula & { moduloId: string; moduloTitulo: string }>;
  categorias: string[];
  /** Certificados do usuário logado. */
  meusCertificados: Certificado[];
  certificadosDe: (perfilId: string) => Certificado[];
}

const DadosContext = createContext<DadosValue | null>(null);

export function DadosProvider({ children }: { children: React.ReactNode }) {
  const { user, modoDemo } = useSession();
  const [snap, setSnap] = useState<Snapshot>(snapshotDemo);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const s = await carregarTudo();
    setSnap(s);
    setCarregando(false);
  }

  useEffect(() => {
    let ativo = true;
    carregarTudo().then((s) => {
      if (!ativo) return;
      setSnap(s);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
    // recarrega quando o usuário entra/sai: o RLS muda o que é visível
  }, [user?.id]);

  const value = useMemo<DadosValue>(() => {
    const totalAulas = (c: Curso) =>
      c.modulos.reduce((acc, m) => acc + m.aulas.length, 0);

    const meusCertificados = modoDemo
      ? snap.certificados
      : snap.certificados.filter((c) => c.perfilId === user?.id);

    const minhasTrilhas = modoDemo
      ? snap.certificadosTrilha
      : snap.certificadosTrilha.filter((c) => c.perfilId === user?.id);

    // aplica o score de compatibilidade com o perfil logado
    const vagas = snap.vagas.map((v) => ({
      ...v,
      match: v.match ?? calcularMatch(v, user, meusCertificados, minhasTrilhas),
    }));

    return {
      ...snap,
      vagas,
      carregando,
      recarregar: carregar,
      getCurso: (slug) => snap.cursos.find((c) => c.slug === slug),
      getTrilha: (slug) => snap.trilhas.find((t) => t.slug === slug),
      minhasTrilhas,
      getTalento: (id) => snap.talentos.find((t) => t.id === id),
      getVaga: (id) => vagas.find((v) => v.id === id),
      totalAulas,
      todasAulas: (c) =>
        c.modulos.flatMap((m) =>
          m.aulas.map((a) => ({ ...a, moduloId: m.id, moduloTitulo: m.titulo }))
        ),
      categorias: [...new Set(snap.cursos.map((c) => c.categoria))],
      meusCertificados,
      certificadosDe: (perfilId: string) =>
        modoDemo
          ? snap.certificados
          : snap.certificados.filter((c) => c.perfilId === perfilId),
    };
  }, [snap, carregando, user, modoDemo]);

  return <DadosContext.Provider value={value}>{children}</DadosContext.Provider>;
}

export function useDados() {
  const ctx = useContext(DadosContext);
  if (!ctx) throw new Error("useDados precisa estar dentro de <DadosProvider>");
  return ctx;
}
