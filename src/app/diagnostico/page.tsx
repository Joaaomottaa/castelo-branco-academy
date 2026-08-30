"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Database, Loader2, RefreshCw, XCircle,
} from "lucide-react";
import { Button, Card, Logo, cn } from "@/components/ui";
import { getSupabase, supabaseConfigurado, SUPABASE_URL } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useDados } from "@/lib/dados";
import { SeletorDeModo } from "@/components/seletor-modo";
import { msgErro } from "@/lib/modo";

type Estado = "ok" | "aviso" | "erro" | "carregando";

/** Impede que a página fique presa se a URL do Supabase não responder. */
const TEMPO_LIMITE_MS = 8000;

function comLimite<T>(p: PromiseLike<T>, rotulo: string): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) =>
      setTimeout(
        () => rej(new Error(`Sem resposta em ${TEMPO_LIMITE_MS / 1000}s (${rotulo}). Confira a URL do projeto.`)),
        TEMPO_LIMITE_MS
      )
    ),
  ]);
}

interface Checagem {
  nome: string;
  estado: Estado;
  detalhe: string;
}

const TABELAS = [
  ["cursos", 6],
  ["modulos", 15],
  ["aulas", 49],
  ["empresas", 9],
  ["vagas", 5],
  ["habilidades", 23],
  ["conquistas", 8],
  ["perfis", 1],
] as const;

export default function DiagnosticoPage() {
  const { user, modoDemo } = useSession();
  const { origem, erro, cursos, talentos, vagas, recarregar } = useDados();
  const [checagens, setChecagens] = useState<Checagem[]>([]);
  const [rodando, setRodando] = useState(false);

  async function rodar() {
    setRodando(true);
    const out: Checagem[] = [];

    // Publica cada resultado assim que ele chega, em vez de esperar o fim.
    // Se alguma verificação travar, as anteriores já estão na tela.
    const anota = (c: Checagem) => {
      out.push(c);
      setChecagens([...out]);
    };

    /* 1. variáveis de ambiente */
    anota(
      supabaseConfigurado
        ? { nome: "Variáveis de ambiente", estado: "ok", detalhe: SUPABASE_URL }
        : {
            nome: "Variáveis de ambiente",
            estado: "aviso",
            detalhe:
              "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY vazias — a plataforma está em modo demo.",
          }
    );

    const sb = getSupabase();
    if (!sb) {
      if (supabaseConfigurado) {
        anota({
          nome: "Fonte de dados",
          estado: "aviso",
          detalhe:
            "Modo demonstração ligado por escolha sua — o banco existe mas não está " +
            "sendo consultado. Use a chave acima para voltar ao Supabase.",
        });
      }
      setRodando(false);
      return;
    }

    /* 2. conexão */
    try {
      const { error } = await comLimite(
        sb.from("cursos").select("id", { head: true, count: "exact" }),
        "conexão"
      );
      if (error) throw error;
      anota({ nome: "Conexão com o banco", estado: "ok", detalhe: "Respondeu normalmente." });
    } catch (e) {
      const m = msgErro(e);
      anota({
        nome: "Conexão com o banco",
        estado: "erro",
        detalhe: /failed to fetch|networkerror|name_not_resolved/i.test(m)
          ? `${m} — a URL do projeto não respondeu. Confira NEXT_PUBLIC_SUPABASE_URL no .env.local.`
          : m,
      });
      setRodando(false);
      return; // sem conexão, o resto não faz sentido
    }

    /* 3. tabelas e contagens */
    for (const [tabela, esperado] of TABELAS) {
      try {
        const { count, error } = await comLimite(
          sb.from(tabela).select("*", { head: true, count: "exact" }),
          tabela
        );
        if (error) throw error;

        if ((count ?? 0) === 0) {
          anota({
            nome: `Tabela ${tabela}`,
            estado: "aviso",
            detalhe: `Vazia (esperado ${esperado}). Rode o 02_seed.sql / 03_usuarios_demo.sql.`,
          });
        } else {
          anota({
            nome: `Tabela ${tabela}`,
            estado: (count ?? 0) >= esperado ? "ok" : "aviso",
            detalhe: `${count} registro(s) — esperado ${esperado}`,
          });
        }
      } catch (e) {
        const m = msgErro(e);
        anota({
          nome: `Tabela ${tabela}`,
          estado: "erro",
          detalhe: m.includes("does not exist")
            ? "Tabela não existe — rode o 01_schema.sql."
            : m,
        });
      }
    }

    /* 4. autenticação */
    let uid: string | null = null;
    try {
      const { data: sess } = await comLimite(sb.auth.getSession(), "sessão");
      uid = sess.session?.user.id ?? null;
      anota(
        sess.session
          ? {
              nome: "Autenticação",
              estado: "ok",
              detalhe: `Logado como ${sess.session.user.email} (${user?.role ?? "?"})`,
            }
          : {
              nome: "Autenticação",
              estado: "aviso",
              detalhe: "Sem sessão. Entre com aluno@castelobranco.com.br / 123456.",
            }
      );
    } catch (e) {
      anota({ nome: "Autenticação", estado: "erro", detalhe: msgErro(e) });
    }

    /* 5. RLS: o perfil próprio precisa ser legível */
    if (uid) {
      try {
        const { data, error } = await comLimite(
          sb.from("perfis").select("nome, role").eq("id", uid).maybeSingle(),
          "perfil"
        );
        if (error) throw error;
        anota(
          data
            ? { nome: "RLS — perfil próprio", estado: "ok", detalhe: `${data.nome} · ${data.role}` }
            : {
                nome: "RLS — perfil próprio",
                estado: "erro",
                detalhe:
                  "Usuário existe no auth mas não tem linha em perfis — o trigger " +
                  "on_auth_user_created não rodou. Rode o 01_schema.sql de novo.",
              }
        );
      } catch (e) {
        const m = msgErro(e);
        anota({
          nome: "RLS — perfil próprio",
          estado: "erro",
          detalhe: /infinite recursion/i.test(m)
            ? `${m} — rode o 01_schema.sql por inteiro; ele corrige a recursão com is_admin().`
            : m,
        });
      }

      try {
        const { count } = await comLimite(
          sb.from("certificados").select("*", { head: true, count: "exact" }).eq("perfil_id", uid),
          "certificados"
        );
        anota({
          nome: "Trigger de certificado",
          estado: (count ?? 0) > 0 ? "ok" : "aviso",
          detalhe:
            (count ?? 0) > 0
              ? `${count} certificado(s) emitidos automaticamente.`
              : "Nenhum certificado ainda — conclua 100% de um curso para testar.",
        });
      } catch (e) {
        anota({ nome: "Trigger de certificado", estado: "erro", detalhe: msgErro(e) });
      }
    }

    /* 6. storage
       listBuckets() quase sempre volta vazio: storage.buckets é do papel
       supabase_storage_admin e não dá para criar policy de leitura nela
       (ERROR 42501). Então sondamos um bucket público conhecido — se ele
       existe, o 04_storage.sql rodou. */
    try {
      const { data: buckets } = await comLimite(sb.storage.listBuckets(), "storage");

      if ((buckets?.length ?? 0) > 0) {
        anota({
          nome: "Storage",
          estado: (buckets?.length ?? 0) >= 5 ? "ok" : "aviso",
          detalhe: `${buckets?.length} bucket(s): ${buckets?.map((b) => b.name).join(", ")}`,
        });
      } else {
        const { error } = await comLimite(
          sb.storage.from("avatares").list("", { limit: 1 }),
          "bucket avatares"
        );
        const m = error ? msgErro(error) : "";

        anota(
          !error
            ? {
                nome: "Storage",
                estado: "ok",
                detalhe:
                  "Bucket 'avatares' respondeu. A listagem completa é restrita pelo " +
                  "Supabase — confira os 5 buckets em Storage no painel.",
              }
            : /not found|does not exist/i.test(m)
              ? {
                  nome: "Storage",
                  estado: "erro",
                  detalhe: "Bucket 'avatares' não existe — rode o 04_storage.sql.",
                }
              : { nome: "Storage", estado: "aviso", detalhe: m }
        );
      }
    } catch (e) {
      anota({ nome: "Storage", estado: "aviso", detalhe: msgErro(e) });
    }

    setRodando(false);
  }

  useEffect(() => {
    rodar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const erros = checagens.filter((c) => c.estado === "erro").length;
  const avisos = checagens.filter((c) => c.estado === "aviso").length;

  return (
    <div className="min-h-screen bg-cream">
      <header className="brand-gradient">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Link href="/">
            <Logo variant="light" />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-300">
            Diagnóstico
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy-700 sm:text-3xl">
              Status da instalação
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              Confere se o Supabase está conectado, se os scripts SQL rodaram e se o RLS
              está deixando você ler o que deveria.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SeletorDeModo />
            <Button variant="outline" href="/">
              <ArrowLeft size={15} /> Voltar
            </Button>
            <Button
              variant="gold"
              onClick={() => {
                void recarregar();
                void rodar();
              }}
              disabled={rodando}
            >
              {rodando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Rodar de novo
            </Button>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="flex items-center gap-4">
            <span
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-xl",
                origem === "supabase"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-gold-50 text-gold-500"
              )}
            >
              <Database size={19} />
            </span>
            <div>
              <p className="text-base font-bold text-navy-700">
                {origem === "supabase" ? "Supabase" : "Modo demo"}
              </p>
              <p className="text-xs text-muted">Origem dos dados</p>
            </div>
          </Card>
          <Card>
            <p className="text-2xl font-bold text-navy-700">
              {cursos.length} · {talentos.length} · {vagas.length}
            </p>
            <p className="text-xs text-muted">cursos · talentos · vagas carregados</p>
          </Card>
          <Card>
            <p
              className={cn(
                "text-2xl font-bold",
                checagens.length === 0
                  ? "text-muted"
                  : erros
                    ? "text-red-600"
                    : avisos
                      ? "text-amber-600"
                      : "text-emerald-600"
              )}
            >
              {checagens.length === 0
                ? "Verificando…"
                : erros
                  ? `${erros} erro(s)`
                  : avisos
                    ? `${avisos} aviso(s)`
                    : "Tudo certo"}
            </p>
            <p className="text-xs text-muted">
              {checagens.length === 0 ? "aguarde" : `${checagens.length} verificações`}
            </p>
          </Card>
        </div>

        {erro && (
          <Card className="!border-red-200 !bg-red-50">
            <p className="flex items-center gap-2 text-sm font-bold text-red-700">
              <XCircle size={16} /> Falha ao carregar do Supabase
            </p>
            <p className="mt-1.5 font-mono text-xs text-red-600">{erro}</p>
            <p className="mt-2 text-xs text-red-600/80">
              A aplicação caiu para o seed local para não quebrar a navegação.
            </p>
          </Card>
        )}

        {modoDemo && (
          <Card className="!border-gold-200 !bg-gold-50">
            <p className="flex items-center gap-2 text-sm font-bold text-gold-600">
              <AlertTriangle size={16} /> Modo demonstração
            </p>
            {supabaseConfigurado ? (
              <p className="mt-1.5 text-sm leading-relaxed text-gold-600/85">
                O banco está configurado, mas a plataforma está lendo o seed local por
                escolha sua. Nada do que você fizer agora toca o Supabase — ideal para
                apresentar sem risco. Use a chave <strong>Supabase / Demo</strong> no topo
                para voltar.
              </p>
            ) : (
              <p className="mt-1.5 text-sm leading-relaxed text-gold-600/85">
                Crie o arquivo <code className="font-mono">.env.local</code> na raiz do projeto
                com <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> e reinicie o
                servidor (<code className="font-mono">npm run dev</code>).
              </p>
            )}
          </Card>
        )}

        {/* Checagens */}
        <Card className="!p-0 overflow-hidden">
          <ul className="divide-y divide-navy-100">
            {checagens.map((c) => (
              <li key={c.nome} className="flex items-start gap-3.5 px-5 py-3.5">
                <Icone estado={c.estado} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy-700">{c.nome}</p>
                  <p className="mt-0.5 break-words font-mono text-xs text-muted">{c.detalhe}</p>
                </div>
              </li>
            ))}
            {checagens.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-muted">
                <Loader2 size={18} className="mx-auto mb-2 animate-spin" />
                Verificando…
              </li>
            )}
          </ul>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-navy-700">Ordem dos scripts SQL</h2>
          <ol className="mt-3 space-y-1.5 text-sm text-muted">
            <li>1. <code className="font-mono text-navy-700">supabase/01_schema.sql</code> — tabelas, RLS, triggers</li>
            <li>2. <code className="font-mono text-navy-700">supabase/02_seed.sql</code> — cursos, aulas, vagas</li>
            <li>3. <code className="font-mono text-navy-700">supabase/03_usuarios_demo.sql</code> — contas de teste</li>
            <li>4. <code className="font-mono text-navy-700">supabase/04_storage.sql</code> — buckets de arquivo</li>
            <li>5. <code className="font-mono text-navy-700">supabase/05_corrigir_auth.sql</code> — corrige o login</li>
          </ol>
        </Card>
      </main>
    </div>
  );
}

function Icone({ estado }: { estado: Estado }) {
  if (estado === "ok") return <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />;
  if (estado === "aviso") return <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />;
  if (estado === "erro") return <XCircle size={18} className="mt-0.5 shrink-0 text-red-500" />;
  return <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-navy-300" />;
}
