"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { HabilidadeSelo, Perfil, Progresso, Role } from "./types";
import { mapSelos } from "./repo";
import {
  SUPABASE_ANON_KEY, SUPABASE_URL, getSupabase, supabaseConfigurado,
} from "./supabase";
import { DEMO_TRAVADO, definirModo, type Modo } from "./modo";

const STORAGE_USER = "cba.user";
const STORAGE_PROGRESS = "cba.progresso";
const STORAGE_FAVS = "cba.favoritos";
const STORAGE_APPS = "cba.candidaturas";
const STORAGE_CONTAS = "cba.contasCriadas";

/** Contas de demonstração — usadas apenas enquanto o Supabase não está conectado. */
export const contasDemo: Array<Perfil & { senha: string }> = [
  {
    id: "u-aluno",
    nome: "Mariana Alves",
    email: "aluno@castelobranco.com.br",
    senha: "123456",
    role: "aluno",
    cidade: "Feira de Santana",
    uf: "BA",
    cargo: "Analista Fiscal",
    crc: "BA-123456/O-1",
    senioridade: "Pleno",
    habilidades: ["SPED", "CT-e", "Lucro Real", "Excel avançado"],
    bio: "5 anos em departamento fiscal de transportadoras.",
    disponivel: true,
    pretensao: "R$ 6.000 – R$ 7.500",
    plano: "Pro",
    pontos: 4820,
    nivel: 7,
    ofensiva: 12,
  },
  {
    id: "u-empresa",
    nome: "TransLog Brasil",
    email: "empresa@castelobranco.com.br",
    senha: "123456",
    role: "empresa",
    cidade: "Feira de Santana",
    uf: "BA",
    plano: "Enterprise",
  },
  {
    id: "u-admin",
    nome: "Equipe Castelo Branco",
    email: "admin@castelobranco.com.br",
    senha: "123456",
    role: "admin",
    plano: "Enterprise",
  },
];

interface SessionValue {
  user: Perfil | null;
  loading: boolean;
  /** true quando os dados vêm do seed local em vez do Supabase. */
  modoDemo: boolean;
  /** true quando as credenciais do Supabase existem no .env.local. */
  supabaseDisponivel: boolean;
  /** A troca só é possível quando o Supabase está disponível e não travado. */
  podeTrocarModo: boolean;
  trocarModo: (m: Modo) => void;
  /** Mensagem quando o cadastro exige confirmação de e-mail. */
  aviso: string | null;
  entrar: (email: string, senha: string) => Promise<{ error?: string; user?: Perfil }>;
  /** Login social. `null` de retorno = redirecionou para o Google. */
  entrarComGoogle: (destino?: string) => Promise<{ error?: string }>;
  cadastrar: (
    dados: { nome: string; email: string; senha: string; role: Role }
  ) => Promise<{
    error?: string;
    user?: Perfil;
    /** O projeto exige confirmação de e-mail: não há sessão ainda. */
    confirmarEmail?: boolean;
    /** Conta criada apenas no navegador (modo demonstração). */
    apenasLocal?: boolean;
  }>;
  sair: () => Promise<void>;
  atualizarPerfil: (patch: Partial<Perfil>) => Promise<void>;
  /* progresso */
  progresso: Progresso[];
  marcarAula: (cursoSlug: string, aulaId: string, concluida: boolean) => void;
  progressoDoCurso: (cursoSlug: string) => Progresso | undefined;
  /* favoritos e candidaturas */
  favoritos: string[];
  alternarFavorito: (id: string) => void;
  candidaturas: string[];
  candidatar: (vagaId: string) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

function ler<T>(chave: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(chave);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function gravar(chave: string, valor: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* storage indisponível */
  }
}

type ContaDemo = Perfil & { senha: string };

/**
 * Contas criadas pelo formulário de cadastro enquanto em modo demonstração.
 *
 * Sem isto, o cadastro no modo demo criava um usuário só na memória: a pessoa
 * "entrava", mas não conseguia logar depois, porque `entrar` só conhecia as
 * três contas fixas. Persistir aqui faz o fluxo cadastro → login funcionar
 * de ponta a ponta na apresentação.
 */
function contasCriadas(): ContaDemo[] {
  return ler<ContaDemo[]>(STORAGE_CONTAS, []);
}

function salvarConta(c: ContaDemo) {
  gravar(STORAGE_CONTAS, [...contasCriadas(), c]);
}

/** Todas as contas válidas no modo demo: as fixas + as criadas na sessão. */
function todasContasDemo(): ContaDemo[] {
  return [...contasDemo, ...contasCriadas()];
}

/** Converte a linha de perfis do banco no tipo do app. */
function perfilDoBanco(r: Record<string, unknown>): Perfil {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ""),
    email: String(r.email ?? ""),
    role: (r.role as Role) ?? "aluno",
    cidade: (r.cidade as string) ?? undefined,
    uf: (r.uf as string) ?? undefined,
    crc: (r.crc as string) ?? undefined,
    cargo: (r.cargo as string) ?? undefined,
    bio: (r.bio as string) ?? undefined,
    senioridade: (r.senioridade as Perfil["senioridade"]) ?? undefined,
    pretensao: (r.pretensao as string) ?? undefined,
    linkedin: (r.linkedin as string) ?? undefined,
    telefone: (r.telefone as string) ?? undefined,
    contatoPublico: r.contato_publico === undefined ? true : Boolean(r.contato_publico),
    // `undefined` = coluna ausente (banco antigo): trata como completo para
    // não empurrar quem já usa a plataforma para a tela de boas-vindas.
    cadastroCompleto:
      r.cadastro_completo === undefined ? true : Boolean(r.cadastro_completo),
    consentimentoEm: (r.consentimento_em as string | null) ?? undefined,
    cep: (r.cep as string) ?? undefined,
    logradouro: (r.logradouro as string) ?? undefined,
    bairro: (r.bairro as string) ?? undefined,
    numero: (r.numero as string) ?? undefined,
    complemento: (r.complemento as string) ?? undefined,
    disponivel: Boolean(r.disponivel),
    plano: (r.plano as Perfil["plano"]) ?? "Free",
    pontos: Number(r.pontos ?? 0),
    nivel: Number(r.nivel ?? 1),
    ofensiva: Number(r.ofensiva ?? 0),
    // `ativo` é o que impede a conta desativada de entrar; sem mapear aqui, a
    // checagem do login nunca dispara.
    ativo: r.ativo === undefined ? true : Boolean(r.ativo),
    ultimoAcesso: (r.ultimo_acesso as string) ?? undefined,
    motivoDesativacao: (r.motivo_desativacao as string) ?? undefined,
    habilidades: Array.isArray(r.habilidades) ? (r.habilidades as string[]) : undefined,
  };
}

/**
 * Busca o perfil completo — inclusive as habilidades, que vivem em
 * `perfil_habilidades` e NÃO vêm num `select("*")` de `perfis`.
 *
 * Sem isso, `user.habilidades` fica indefinido: o match sai subestimado e,
 * pior, salvar o perfil apagaria as habilidades gravadas no banco.
 */
async function buscarPerfilCompleto(
  sb: NonNullable<ReturnType<typeof getSupabase>>,
  uid: string
): Promise<Perfil | null> {
  const { data, error } = await sb
    .from("perfis")
    .select(
      `*, perfil_habilidades (
         nivel, verificada, origem, selo, obtida_em,
         habilidades ( nome ), cursos ( slug, titulo ), trilhas ( slug, nome )
       )`
    )
    .eq("id", uid)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[perfil] falha ao carregar:", error.message);
    return null;
  }

  const linha = data as Record<string, unknown>;
  const selos: HabilidadeSelo[] = mapSelos(
    (linha.perfil_habilidades ?? []) as Parameters<typeof mapSelos>[0]
  );

  return {
    ...perfilDoBanco(linha),
    selos,
    habilidades: selos.map((s) => s.nome),
  };
}

/** Campos do app → colunas do banco. */
function paraBanco(patch: Partial<Perfil>) {
  const out: Record<string, unknown> = {};
  if (patch.nome !== undefined) out.nome = patch.nome;
  if (patch.cidade !== undefined) out.cidade = patch.cidade || null;
  if (patch.uf !== undefined) out.uf = patch.uf || null;
  if (patch.crc !== undefined) out.crc = patch.crc || null;
  if (patch.cargo !== undefined) out.cargo = patch.cargo || null;
  if (patch.bio !== undefined) out.bio = patch.bio || null;
  if (patch.senioridade !== undefined) out.senioridade = patch.senioridade || null;
  if (patch.pretensao !== undefined) out.pretensao = patch.pretensao || null;
  if (patch.linkedin !== undefined) out.linkedin = patch.linkedin || null;
  if (patch.telefone !== undefined) out.telefone = patch.telefone || null;
  if (patch.contatoPublico !== undefined) out.contato_publico = patch.contatoPublico;
  if (patch.cadastroCompleto !== undefined) out.cadastro_completo = patch.cadastroCompleto;
  if (patch.consentimentoEm !== undefined) out.consentimento_em = patch.consentimentoEm;
  if (patch.cep !== undefined) out.cep = patch.cep;
  if (patch.logradouro !== undefined) out.logradouro = patch.logradouro;
  if (patch.bairro !== undefined) out.bairro = patch.bairro;
  if (patch.numero !== undefined) out.numero = patch.numero;
  if (patch.complemento !== undefined) out.complemento = patch.complemento;
  if (patch.disponivel !== undefined) {
    out.disponivel = patch.disponivel;
    out.perfil_publico = patch.disponivel;
  }
  return out;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<Progresso[]>([]);
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [candidaturas, setCandidaturas] = useState<string[]>([]);

  // Primeiro render (servidor e cliente) usa só a variável de ambiente.
  // O efeito de boot ajusta depois, considerando a escolha no localStorage.
  const [modoDemo, setModoDemo] = useState(!supabaseConfigurado);

  /* ------------------------------------------------- carrega dados do user */
  const carregarDadosDoUsuario = useCallback(async (uid: string) => {
    const sb = getSupabase();
    if (!sb) return;

    const [rProg, rFav, rCand] = await Promise.all([
      sb
        .from("progresso_aulas")
        .select("aula_id, concluida, atualizado_em, aulas ( modulos ( cursos ( slug ) ) )")
        .eq("perfil_id", uid),
      sb.from("favoritos").select("alvo_id, tipo").eq("perfil_id", uid),
      sb.from("candidaturas").select("vaga_id").eq("perfil_id", uid),
    ]);

    type LinhaProg = {
      aula_id: string;
      concluida: boolean;
      atualizado_em: string;
      aulas: { modulos: { cursos: { slug: string } | null } | null } | null;
    };

    const porCurso = new Map<string, Progresso>();
    for (const l of (rProg.data ?? []) as unknown as LinhaProg[]) {
      const slug = l.aulas?.modulos?.cursos?.slug;
      if (!slug || !l.concluida) continue;
      const atual = porCurso.get(slug) ?? {
        cursoSlug: slug,
        aulasConcluidas: [],
        ultimaAulaId: l.aula_id,
        atualizadoEm: l.atualizado_em,
      };
      atual.aulasConcluidas.push(l.aula_id);
      if (l.atualizado_em > atual.atualizadoEm) {
        atual.atualizadoEm = l.atualizado_em;
        atual.ultimaAulaId = l.aula_id;
      }
      porCurso.set(slug, atual);
    }

    setProgresso([...porCurso.values()]);
    setFavoritos(
      ((rFav.data ?? []) as Array<{ alvo_id: string; tipo: string }>)
        .filter((f) => f.tipo === "talento")
        .map((f) => f.alvo_id)
    );
    setCandidaturas(
      ((rCand.data ?? []) as Array<{ vaga_id: string }>).map((c) => c.vaga_id)
    );
  }, []);

  /* ---------------------------------------------------- hidratação inicial */
  useEffect(() => {
    let ativo = true;

    async function boot() {
      const sb = getSupabase();
      setModoDemo(sb === null);

      if (sb) {
        const { data } = await sb.auth.getUser();
        if (data.user && ativo) {
          const perfil = await buscarPerfilCompleto(sb, data.user.id);
          const u = perfil ?? {
            id: data.user.id,
            nome: data.user.email ?? "Usuário",
            email: data.user.email ?? "",
            role: "aluno" as Role,
          };
          setUser(u);
          await carregarDadosDoUsuario(u.id);
        }
      } else {
        const salvo = ler<Perfil | null>(STORAGE_USER, null);
        if (salvo && ativo) setUser(salvo);
        if (ativo) {
          setProgresso(ler<Progresso[]>(STORAGE_PROGRESS, progressoInicialDemo()));
          setFavoritos(ler<string[]>(STORAGE_FAVS, ["t2"]));
          setCandidaturas(ler<string[]>(STORAGE_APPS, []));
        }
      }

      if (ativo) setLoading(false);
    }

    boot();

    // O login social volta do Google com `?code=` na URL: o cliente do
    // Supabase troca esse código por sessão sozinho, mas de forma assíncrona.
    // Sem escutar a mudança, a tela ficaria deslogada até um F5.
    const sb = getSupabase();
    const inscricao = sb?.auth.onAuthStateChange(async (evento, sessao) => {
      if (!ativo) return;

      if (evento === "SIGNED_OUT") {
        setUser(null);
        return;
      }

      if (sessao?.user && (evento === "SIGNED_IN" || evento === "USER_UPDATED")) {
        const perfil = await buscarPerfilCompleto(sb!, sessao.user.id);
        if (!ativo) return;

        if (perfil?.ativo === false) {
          await sb!.auth.signOut();
          setAviso(
            "Esta conta está desativada." +
              (perfil.motivoDesativacao ? ` Motivo: ${perfil.motivoDesativacao}.` : "") +
              " Fale com a coordenação da Academy."
          );
          return;
        }

        const u = perfil ?? {
          id: sessao.user.id,
          nome: sessao.user.email ?? "Usuário",
          email: sessao.user.email ?? "",
          role: "aluno" as Role,
        };
        setUser(u);
        void sb!.from("perfis")
          .update({ ultimo_acesso: new Date().toISOString() })
          .eq("id", u.id);
        await carregarDadosDoUsuario(u.id);
      }
    });

    return () => {
      ativo = false;
      inscricao?.data.subscription.unsubscribe();
    };
  }, [carregarDadosDoUsuario]);

  /* ------------------------------------------------------ login social -- */
  const entrarComGoogle = useCallback(async (destino = "/app") => {
    const sb = getSupabase();
    if (!sb) {
      return {
        error:
          "O login com Google precisa do Supabase conectado. No modo demonstração, use uma das contas de teste.",
      };
    }

    // Pergunta antes de sair da página.
    //
    // `signInWithOAuth` não devolve erro quando o provedor está desligado: ele
    // redireciona, e o Supabase responde um JSON cru de 400 na tela. Conferir
    // /auth/v1/settings custa uma requisição e evita jogar a pessoa numa página
    // de erro em inglês.
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: SUPABASE_ANON_KEY },
      });
      const cfg = (await r.json()) as { external?: Record<string, boolean> };
      if (cfg?.external && cfg.external.google !== true) {
        return {
          error:
            "O login com Google ainda não foi habilitado neste projeto " +
            "(Supabase › Authentication › Sign In / Providers › Google). " +
            "Entre com e-mail e senha por enquanto.",
        };
      }
    } catch {
      /* sem resposta do Supabase: segue e deixa o fluxo normal falhar */
    }

    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?destino=${encodeURIComponent(destino)}`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      // O erro mais comum é o provedor desligado no painel do Supabase.
      // Dizer isso é mais útil que repetir a mensagem crua da API.
      if (/provider is not enabled|unsupported provider/i.test(error.message)) {
        return {
          error:
            "O login com Google ainda não foi habilitado no Supabase " +
            "(Authentication › Sign In / Providers › Google). Use e-mail e senha por enquanto.",
        };
      }
      return { error: traduzErro(error.message) };
    }
    return {};
  }, []);

  /* ------------------------------------------------------------- entrar -- */
  const entrar = useCallback(
    async (email: string, senha: string) => {
      setAviso(null);
      const sb = getSupabase();

      if (sb) {
        const { data, error } = await sb.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });
        if (error) return { error: traduzErro(error.message) };

        const perfil = await buscarPerfilCompleto(sb, data.user.id);

        // Conta desativada pela administração: derruba a sessão em vez de
        // deixar entrar e travar tela a tela.
        if (perfil?.ativo === false) {
          await sb.auth.signOut();
          return {
            error:
              "Esta conta está desativada." +
              (perfil.motivoDesativacao ? ` Motivo: ${perfil.motivoDesativacao}.` : "") +
              " Fale com a coordenação da Academy.",
          };
        }

        const u = perfil ?? {
          id: data.user.id,
          nome: data.user.email ?? "",
          email: data.user.email ?? "",
          role: "aluno" as Role,
        };

        // Alimenta o filtro "sem acessar há mais de N dias" da comunicação.
        void sb.from("perfis")
          .update({ ultimo_acesso: new Date().toISOString() })
          .eq("id", u.id);

        setUser(u);
        await carregarDadosDoUsuario(u.id);
        return { user: u };
      }

      const conta = todasContasDemo().find(
        (c) => c.email.toLowerCase() === email.trim().toLowerCase()
      );
      if (!conta)
        return {
          error:
            "E-mail não encontrado neste modo. Use uma das contas de demonstração " +
            "ou crie a conta novamente.",
        };
      if (conta.senha !== senha) return { error: "Senha incorreta." };
      const { senha: _omit, ...perfil } = conta;
      void _omit;
      setUser(perfil);
      gravar(STORAGE_USER, perfil);
      return { user: perfil };
    },
    [carregarDadosDoUsuario]
  );

  /* ----------------------------------------------------------- cadastrar -- */
  const cadastrar = useCallback(
    async (dados: { nome: string; email: string; senha: string; role: Role }) => {
      setAviso(null);
      const sb = getSupabase();

      if (sb) {
        const { data, error } = await sb.auth.signUp({
          email: dados.email.trim(),
          password: dados.senha,
          options: { data: { nome: dados.nome, role: dados.role } },
        });
        if (error) return { error: traduzErro(error.message) };

        // Sem sessão = o projeto exige confirmação de e-mail.
        if (!data.session) {
          setAviso(
            "Conta criada. Confirme o e-mail que enviamos antes de entrar. " +
              "(Para desativar isso em desenvolvimento: Supabase › Authentication › Sign In / Providers › Email › Confirm email.)"
          );
          return { confirmarEmail: true };
        }

        const uid = data.user!.id;
        const perfil = await buscarPerfilCompleto(sb, uid);
        const u = perfil ?? {
          id: uid,
          nome: dados.nome,
          email: dados.email,
          role: dados.role,
          plano: "Free" as const,
          pontos: 0,
          nivel: 1,
        };
        setUser(u);
        return { user: u };
      }

      // ---- modo demonstração ----------------------------------------------
      const emailNormalizado = dados.email.trim().toLowerCase();
      if (todasContasDemo().some((c) => c.email.toLowerCase() === emailNormalizado)) {
        return { error: "Este e-mail já está cadastrado." };
      }

      const u: Perfil = {
        id: `demo-${Math.random().toString(36).slice(2, 9)}`,
        nome: dados.nome,
        email: dados.email.trim(),
        role: dados.role,
        plano: "Free",
        pontos: 0,
        nivel: 1,
        ofensiva: 0,
      };

      salvarConta({ ...u, senha: dados.senha });
      setUser(u);
      gravar(STORAGE_USER, u);
      setAviso(
        "Conta criada no modo demonstração — ela vive só neste navegador e não foi " +
          "gravada no banco. Para criar uma conta real, mude a chave para Supabase."
      );
      return { user: u, apenasLocal: true };
    },
    []
  );

  /* ---------------------------------------------------------------- sair -- */
  const sair = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setUser(null);
    setAviso(null);
    setProgresso([]);
    setFavoritos([]);
    setCandidaturas([]);
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_USER);
  }, []);

  /* ------------------------------------------------------ atualizarPerfil -- */
  const atualizarPerfil = useCallback(
    async (patch: Partial<Perfil>) => {
      setUser((atual) => {
        if (!atual) return atual;
        const novo = { ...atual, ...patch };
        gravar(STORAGE_USER, novo);
        return novo;
      });

      const sb = getSupabase();
      if (sb && user) {
        const colunas = paraBanco(patch);
        if (Object.keys(colunas).length) {
          await sb.from("perfis").update(colunas).eq("id", user.id);
        }
        if (patch.habilidades) {
          await sincronizarHabilidades(user.id, patch.habilidades);
        }
      }
    },
    [user]
  );

  /* ----------------------------------------------------------- progresso -- */
  const marcarAula = useCallback(
    (cursoSlug: string, aulaId: string, concluida: boolean) => {
      setProgresso((atual) => {
        const idx = atual.findIndex((p) => p.cursoSlug === cursoSlug);
        const base: Progresso =
          idx >= 0
            ? atual[idx]
            : { cursoSlug, aulasConcluidas: [], ultimaAulaId: aulaId, atualizadoEm: "" };

        const set = new Set(base.aulasConcluidas);
        if (concluida) set.add(aulaId);
        else set.delete(aulaId);

        const novo: Progresso = {
          ...base,
          aulasConcluidas: [...set],
          ultimaAulaId: aulaId,
          atualizadoEm: new Date().toISOString(),
        };
        const lista =
          idx >= 0 ? atual.map((p, i) => (i === idx ? novo : p)) : [...atual, novo];
        if (modoDemo) gravar(STORAGE_PROGRESS, lista);
        return lista;
      });

      const sb = getSupabase();
      if (sb && user) {
        void sb
          .from("progresso_aulas")
          .upsert(
            { perfil_id: user.id, aula_id: aulaId, concluida, atualizado_em: new Date().toISOString() },
            { onConflict: "perfil_id,aula_id" }
          )
          .then(({ error }) => {
            if (error) console.error("[progresso] falha ao salvar:", error.message);
          });
      }
    },
    [user, modoDemo]
  );

  const progressoDoCurso = useCallback(
    (cursoSlug: string) => progresso.find((p) => p.cursoSlug === cursoSlug),
    [progresso]
  );

  /* ------------------------------------------------ favoritos e vagas ----- */
  const alternarFavorito = useCallback(
    (id: string) => {
      let virouFavorito = false;
      setFavoritos((atual) => {
        virouFavorito = !atual.includes(id);
        const novo = virouFavorito ? [...atual, id] : atual.filter((f) => f !== id);
        if (modoDemo) gravar(STORAGE_FAVS, novo);
        return novo;
      });

      const sb = getSupabase();
      if (sb && user) {
        if (virouFavorito) {
          void sb.from("favoritos").insert({ perfil_id: user.id, alvo_id: id, tipo: "talento" });
        } else {
          void sb
            .from("favoritos")
            .delete()
            .eq("perfil_id", user.id)
            .eq("alvo_id", id)
            .eq("tipo", "talento");
        }
      }
    },
    [user, modoDemo]
  );

  const candidatar = useCallback(
    (vagaId: string) => {
      setCandidaturas((atual) => {
        if (atual.includes(vagaId)) return atual;
        const novo = [...atual, vagaId];
        if (modoDemo) gravar(STORAGE_APPS, novo);
        return novo;
      });

      const sb = getSupabase();
      if (sb && user) {
        void sb
          .from("candidaturas")
          .upsert(
            { vaga_id: vagaId, perfil_id: user.id, status: "enviada" },
            { onConflict: "vaga_id,perfil_id" }
          );
      }
    },
    [user, modoDemo]
  );

  const value = useMemo<SessionValue>(
    () => ({
      user,
      loading,
      modoDemo,
      supabaseDisponivel: supabaseConfigurado,
      podeTrocarModo: supabaseConfigurado && !DEMO_TRAVADO,
      trocarModo: definirModo,
      aviso,
      entrar,
      entrarComGoogle,
      cadastrar,
      sair,
      atualizarPerfil,
      progresso,
      marcarAula,
      progressoDoCurso,
      favoritos,
      alternarFavorito,
      candidaturas,
      candidatar,
    }),
    [
      user, loading, modoDemo, aviso, entrar, entrarComGoogle, cadastrar, sair, atualizarPerfil,
      progresso, marcarAula, progressoDoCurso, favoritos, alternarFavorito,
      candidaturas, candidatar,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession precisa estar dentro de <SessionProvider>");
  return ctx;
}

/**
 * Substitui as habilidades DECLARADAS do perfil pelas selecionadas.
 *
 * O filtro por `origem = 'manual'` é o ponto crítico: as habilidades vindas
 * de certificado são conquista, não preferência. Sem ele, salvar o perfil
 * apagaria selos que a pessoa levou semanas para ganhar.
 */
async function sincronizarHabilidades(perfilId: string, nomes: string[]) {
  const sb = getSupabase();
  if (!sb) return;

  const { data: catalogo } = await sb.from("habilidades").select("id, nome");
  const porNome = new Map(
    ((catalogo ?? []) as Array<{ id: string; nome: string }>).map((h) => [h.nome, h.id])
  );

  const idsDesejados = nomes
    .map((n) => porNome.get(n))
    .filter((id): id is string => Boolean(id));

  const { data: atuais } = await sb
    .from("perfil_habilidades")
    .select("habilidade_id, origem")
    .eq("perfil_id", perfilId);

  const linhas = (atuais ?? []) as Array<{ habilidade_id: string; origem: string | null }>;
  const idsAtuais = linhas.map((h) => h.habilidade_id);
  const idsManuais = linhas
    .filter((h) => (h.origem ?? "manual") === "manual")
    .map((h) => h.habilidade_id);

  const remover = idsManuais.filter((id) => !idsDesejados.includes(id));
  const adicionar = idsDesejados.filter((id) => !idsAtuais.includes(id));

  if (remover.length) {
    await sb
      .from("perfil_habilidades")
      .delete()
      .eq("perfil_id", perfilId)
      .eq("origem", "manual")
      .in("habilidade_id", remover);
  }

  if (adicionar.length) {
    await sb.from("perfil_habilidades").insert(
      adicionar.map((habilidade_id) => ({ perfil_id: perfilId, habilidade_id, nivel: 60 }))
    );
  }
}

/** Progresso pré-populado só para o modo demo. */
function progressoInicialDemo(): Progresso[] {
  const agora = new Date().toISOString();
  return [
    { cursoSlug: "reforma-tributaria-na-pratica", aulasConcluidas: ["a1","a2","a3","a4","a5"], ultimaAulaId: "a6", atualizadoEm: agora },
    { cursoSlug: "departamento-fiscal-do-zero", aulasConcluidas: ["a1","a2","a3","a4","a5","a6","a7","a8","a9"], ultimaAulaId: "a9", atualizadoEm: agora },
    { cursoSlug: "contabilidade-para-transporte-e-logistica", aulasConcluidas: ["a1","a2","a3","a4","a5","a6"], ultimaAulaId: "a6", atualizadoEm: agora },
    { cursoSlug: "recuperacao-de-creditos-tributarios", aulasConcluidas: ["a1","a2"], ultimaAulaId: "a3", atualizadoEm: agora },
  ];
}

function traduzErro(msg: string) {
  if (/invalid login/i.test(msg)) return "E-mail ou senha inválidos.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar.";
  if (/already registered|already been registered/i.test(msg)) return "Este e-mail já está cadastrado.";
  if (/at least 6|password should be/i.test(msg)) return "A senha precisa ter ao menos 6 caracteres.";
  if (/rate limit|too many/i.test(msg)) return "Muitas tentativas. Aguarde um minuto.";
  return msg;
}
