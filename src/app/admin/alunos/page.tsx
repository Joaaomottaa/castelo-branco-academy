"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award, Ban, CheckCircle2, Download, ExternalLink, IdCard, Mail,
  MoreHorizontal, MoveHorizontal, Pencil, RefreshCw, Route, Search, Send,
  ShieldCheck, User, X,
} from "lucide-react";
import { Avatar, Badge, Button, Card, Field, cn, inputCls } from "@/components/ui";
import { AvisoErro, Modal } from "@/components/modal";
import { PainelDeSelos } from "@/components/selos";
import { useDados } from "@/lib/dados";
import { useSession } from "@/lib/session";
import { carregarAlunos } from "@/lib/repo";
import {
  atualizarPerfilComoAdmin, carregarDetalheAluno, definirPlanoDoPerfil,
  definirStatusPerfil, enviarEmail,
  type DetalheAluno,
} from "@/lib/repo-pessoas";
import type { Perfil } from "@/lib/types";

/* ==========================================================================
   ALUNOS

   Cada linha agora responde às três perguntas que o admin faz: quem é, o que
   já fez, e o que eu posso fazer com essa pessoa.

   Desativar não apaga: a conta perde acesso e sai do banco de talentos, mas
   certificados, progresso e candidaturas continuam de pé. Exclusão de verdade
   é assunto de LGPD e tem fluxo próprio.
   ========================================================================== */

const PLANOS = ["Free", "Pro", "Enterprise"];

export default function AdminAlunosPage() {
  const { talentos, origem } = useDados();
  const { user } = useSession();

  const [todos, setTodos] = useState<Perfil[]>(talentos);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const [busca, setBusca] = useState("");
  const [plano, setPlano] = useState("");
  const [status, setStatus] = useState<"" | "ativo" | "inativo">("");
  const [menu, setMenu] = useState<string | null>(null);

  const [emailPara, setEmailPara] = useState<Perfil | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [confirmando, setConfirmando] = useState<Perfil | null>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const r = await carregarAlunos();
    if (r.length) setTodos(r);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar, origem]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return todos.filter(
      (t) =>
        (!q || t.nome.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)) &&
        (!plano || t.plano === plano) &&
        (!status || (status === "ativo" ? t.ativo !== false : t.ativo === false))
    );
  }, [todos, busca, plano, status]);

  async function alternarStatus(p: Perfil, ativo: boolean, motivo?: string) {
    setMenu(null);
    setErro("");
    const r = await definirStatusPerfil(p.id, ativo, motivo);
    if (!r.ok) return setErro(r.erro ?? "");
    setAviso(`${p.nome} foi ${ativo ? "reativado" : "desativado"}.`);
    setConfirmando(null);
    await recarregar();
  }

  async function mudarPlano(p: Perfil, novo: string) {
    setMenu(null);
    const r = await definirPlanoDoPerfil(p.id, novo);
    if (!r.ok) return setErro(r.erro ?? "");
    setAviso(`${p.nome} passou para o plano ${novo}.`);
    await recarregar();
  }

  function exportarCSV() {
    const linhas = [
      ["Nome", "Email", "Papel", "Plano", "Cidade", "UF", "Nivel", "Pontos", "Ativo", "UltimoAcesso"],
      ...lista.map((l) => [
        l.nome, l.email, l.role, l.plano ?? "Free", l.cidade ?? "", l.uf ?? "",
        String(l.nivel ?? 1), String(l.pontos ?? 0),
        l.ativo === false ? "nao" : "sim",
        l.ultimoAcesso ? new Date(l.ultimoAcesso).toLocaleDateString("pt-BR") : "",
      ]),
    ];
    const csv = linhas.map((l) => l.join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "castelo-branco-academy-alunos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700">Alunos</h1>
          <p className="mt-1 text-sm text-muted">
            Cadastro, planos, progresso e comunicação individual.
          </p>
        </div>
        {/* Três botões em linha passam de 360 px de tela: quebram. */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={recarregar}>
            <RefreshCw size={14} className={cn(carregando && "animate-spin")} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportarCSV}>
            <Download size={14} /> Exportar CSV
          </Button>
          <Button href="/admin/comunicacao" variant="gold" size="sm">
            <Send size={14} /> Comunicação em massa
          </Button>
        </div>
      </div>

      {erro && <AvisoErro>{erro}</AvisoErro>}
      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <span className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {aviso}
          </span>
          <button onClick={() => setAviso("")} className="shrink-0 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total", todos.length],
          ["Contas ativas", todos.filter((l) => l.ativo !== false).length],
          ["Assinantes Pro", todos.filter((l) => l.plano === "Pro").length],
          ["No banco de talentos", talentos.length],
        ].map(([r, v]) => (
          <Card key={r as string} className="!p-4">
            <p className="text-xl font-bold text-navy-700">{v as number}</p>
            <p className="text-[11px] text-muted">{r as string}</p>
          </Card>
        ))}
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-navy-100 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className={inputCls + " pl-10"}
            />
          </div>
          <select value={plano} onChange={(e) => setPlano(e.target.value)} className={inputCls + " max-w-[170px]"}>
            <option value="">Todos os planos</option>
            {PLANOS.map((p) => (
              <option key={p} value={p}>{p === "Enterprise" ? "Empresarial" : p}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className={inputCls + " max-w-[160px]"}
          >
            <option value="">Ativos e inativos</option>
            <option value="ativo">Só ativos</option>
            <option value="inativo">Só desativados</option>
          </select>
          <span className="text-xs text-muted">
            {lista.length} de {todos.length}
          </span>
        </div>

        <p className="flex items-center gap-1.5 px-4 pb-2 text-[11px] font-semibold text-muted sm:hidden">
          <MoveHorizontal size={13} className="text-gold-500" />
          Arraste a tabela para ver plano, progresso e ações
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-navy-100 bg-cream/50 text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5 font-semibold">Aluno</th>
                <th className="px-4 py-2.5 font-semibold">Plano</th>
                <th className="px-4 py-2.5 font-semibold">Nível</th>
                <th className="px-4 py-2.5 font-semibold">Último acesso</th>
                <th className="px-4 py-2.5 font-semibold">Situação</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {lista.map((l) => {
                const inativo = l.ativo === false;
                const euMesmo = l.id === user?.id;
                return (
                  <tr key={l.id} className={cn("transition hover:bg-cream/40", inativo && "opacity-60")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar nome={l.nome} size={34} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-navy-700">
                            {l.nome}
                            {l.role !== "aluno" && (
                              <Badge tone="navy" className="ml-1.5">{l.role}</Badge>
                            )}
                          </p>
                          <p className="truncate text-[11px] text-muted">{l.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={l.plano === "Pro" ? "gold" : l.plano === "Enterprise" ? "navy" : "muted"}>
                        {l.plano === "Enterprise" ? "Empresarial" : l.plano ?? "Free"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-semibold text-navy-700">
                        Nv. {l.nivel ?? 1}
                      </span>
                      <span className="ml-1.5 text-[11px] text-muted">
                        · {(l.pontos ?? 0).toLocaleString("pt-BR")} XP
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted">{quando(l.ultimoAcesso)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[11px] font-semibold",
                          inativo ? "text-muted" : "text-emerald-600"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            inativo ? "bg-slate-300" : "bg-emerald-500"
                          )}
                        />
                        {inativo ? "Desativado" : "Ativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEmailPara(l)}
                          title="Enviar mensagem"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 transition hover:bg-navy-50 hover:text-navy-700"
                        >
                          <Mail size={15} />
                        </button>

                        <div className="relative">
                          <button
                            onClick={() => setMenu(menu === l.id ? null : l.id)}
                            title="Mais ações"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 transition hover:bg-navy-50 hover:text-navy-700"
                          >
                            <MoreHorizontal size={15} />
                          </button>

                          {menu === l.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                              <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-xl border border-navy-100 bg-white py-1 shadow-xl">
                                <ItemMenu
                                  icone={<User size={14} />}
                                  onClick={() => { setMenu(null); setDetalhe(l.id); }}
                                >
                                  Ver informações completas
                                </ItemMenu>

                                {/* Abre dentro do admin: sair para /app tirava o
                                    menu administrativo, e quem não publicou o
                                    perfil ainda caía num "não encontrado". */}
                                <Link
                                  href={`/admin/alunos/${l.id}`}
                                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink transition hover:bg-cream"
                                  onClick={() => setMenu(null)}
                                >
                                  <IdCard size={14} className="text-navy-400" />
                                  Ficha completa do aluno
                                </Link>

                                {l.disponivel && (
                                  <Link
                                    href={`/app/talentos/${l.id}`}
                                    target="_blank"
                                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink transition hover:bg-cream"
                                    onClick={() => setMenu(null)}
                                  >
                                    <ExternalLink size={14} className="text-navy-400" />
                                    Perfil no banco de talentos
                                  </Link>
                                )}

                                <ItemMenu
                                  icone={<Mail size={14} />}
                                  onClick={() => { setMenu(null); setEmailPara(l); }}
                                >
                                  Enviar mensagem
                                </ItemMenu>

                                <div className="my-1 border-t border-navy-100" />
                                <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                                  Mudar plano
                                </p>
                                {PLANOS.map((p) => (
                                  <ItemMenu
                                    key={p}
                                    icone={
                                      <span
                                        className={cn(
                                          "h-2 w-2 rounded-full",
                                          l.plano === p ? "bg-gold-400" : "bg-navy-100"
                                        )}
                                      />
                                    }
                                    onClick={() => mudarPlano(l, p)}
                                    ativo={l.plano === p}
                                  >
                                    {p === "Enterprise" ? "Empresarial" : p}
                                  </ItemMenu>
                                ))}

                                <div className="my-1 border-t border-navy-100" />
                                {euMesmo ? (
                                  <p className="px-4 py-2.5 text-xs text-muted">
                                    Você não pode desativar a própria conta.
                                  </p>
                                ) : inativo ? (
                                  <ItemMenu
                                    icone={<ShieldCheck size={14} className="text-emerald-600" />}
                                    onClick={() => alternarStatus(l, true)}
                                  >
                                    Reativar conta
                                  </ItemMenu>
                                ) : (
                                  <ItemMenu
                                    icone={<Ban size={14} className="text-red-500" />}
                                    perigo
                                    onClick={() => { setMenu(null); setConfirmando(l); }}
                                  >
                                    Desativar conta
                                  </ItemMenu>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {emailPara && (
        <ModalEmail
          perfil={emailPara}
          aoFechar={() => setEmailPara(null)}
          aoEnviar={(msg) => { setEmailPara(null); setAviso(msg); }}
        />
      )}

      {detalhe && (
        <ModalDetalhe
          perfilId={detalhe}
          aoFechar={() => setDetalhe(null)}
          aoEditar={(p) => {
            setDetalhe(null);
            setEditando(p);
          }}
        />
      )}

      {editando && (
        <ModalEditarPerfil
          perfil={editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            void recarregar();
          }}
        />
      )}

      {confirmando && (
        <ModalDesativar
          perfil={confirmando}
          aoFechar={() => setConfirmando(null)}
          aoConfirmar={(motivo) => alternarStatus(confirmando, false, motivo)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- peças -- */
function ItemMenu({
  children, icone, onClick, perigo, ativo,
}: {
  children: React.ReactNode; icone: React.ReactNode; onClick: () => void;
  perigo?: boolean; ativo?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition",
        perigo ? "text-red-600 hover:bg-red-50"
          : ativo ? "bg-cream/60 font-semibold text-navy-700"
            : "text-ink hover:bg-cream"
      )}
    >
      <span className={cn(!perigo && !ativo && "text-navy-400")}>{icone}</span>
      {children}
    </button>
  );
}

function quando(iso?: string): string {
  if (!iso) return "nunca";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}

/* ------------------------------------------------------------- e-mail --- */
function ModalEmail({
  perfil, aoFechar, aoEnviar,
}: {
  perfil: Perfil; aoFechar: () => void; aoEnviar: (msg: string) => void;
}) {
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function submeter() {
    setEnviando(true);
    setErro("");
    const r = await enviarEmail(perfil.id, assunto, corpo);
    setEnviando(false);
    if (!r.ok) return setErro(r.erro ?? "Não foi possível enviar.");
    aoEnviar(`Mensagem para ${perfil.nome} enviada como notificação e enfileirada para ${r.destinatario}.`);
  }

  return (
    <Modal
      titulo="Enviar mensagem"
      subtitulo={`Para ${perfil.nome} · ${perfil.email}`}
      aoFechar={aoFechar}
      largura="max-w-lg"
      rodape={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button
            variant="gold"
            onClick={submeter}
            disabled={enviando || !assunto.trim() || !corpo.trim()}
          >
            {enviando ? "Enviando…" : <><Send size={14} /> Enviar</>}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <AvisoErro>{erro}</AvisoErro>

        <div className="flex items-start gap-2.5 rounded-xl border border-navy-100 bg-cream/50 px-4 py-3 text-xs leading-relaxed text-ink">
          <Mail size={14} className="mt-0.5 shrink-0 text-navy-400" />
          <span>
            A mensagem vira <strong className="text-navy-700">notificação no app na hora</strong> e
            entra na fila de e-mail. O envio por e-mail sai quando o SMTP for configurado —
            não há provedor ligado ainda.
          </span>
        </div>

        <Field label="Assunto">
          <input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Sobre o seu certificado"
            className={inputCls}
          />
        </Field>

        <Field label="Mensagem">
          <textarea
            rows={6}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder={`Olá, ${perfil.nome.split(" ")[0]}…`}
            className={inputCls}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ detalhe --- */
function ModalDetalhe({
  perfilId, aoFechar, aoEditar,
}: {
  perfilId: string;
  aoFechar: () => void;
  aoEditar: (perfil: Perfil) => void;
}) {
  const [d, setD] = useState<DetalheAluno | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarDetalheAluno(perfilId).then((r) => {
      setD(r);
      setCarregando(false);
    });
  }, [perfilId]);

  return (
    <Modal
      titulo={d?.perfil.nome ?? "Aluno"}
      subtitulo={d?.perfil.email}
      aoFechar={aoFechar}
      largura="max-w-2xl"
      rodape={
        d && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/admin/alunos/${perfilId}`}
              onClick={aoFechar}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
            >
              <IdCard size={15} /> Abrir ficha completa
            </Link>
            <Button variant="gold" size="sm" onClick={() => aoEditar(d.perfil)}>
              <Pencil size={14} /> Editar perfil
            </Button>
          </div>
        )
      }
    >
      {carregando ? (
        <p className="py-8 text-center text-sm text-muted">Carregando…</p>
      ) : !d ? (
        <p className="py-8 text-center text-sm text-muted">Não foi possível carregar o perfil.</p>
      ) : (
        <div className="space-y-5">
          {d.perfil.ativo === false && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Conta desativada
              {d.perfil.motivoDesativacao && ` — ${d.perfil.motivoDesativacao}`}
            </div>
          )}

          <div className="flex flex-wrap items-start gap-4">
            <Avatar nome={d.perfil.nome} size={56} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-navy-700">{d.perfil.nome}</span>
                <Badge tone={d.perfil.plano === "Pro" ? "gold" : "muted"}>
                  {d.perfil.plano === "Enterprise" ? "Empresarial" : d.perfil.plano}
                </Badge>
                <Badge tone="navy">Nível {d.perfil.nivel}</Badge>
              </p>
              <p className="mt-1 text-sm text-muted">
                {[d.perfil.cargo, d.perfil.senioridade,
                  d.perfil.cidade && `${d.perfil.cidade}/${d.perfil.uf}`, d.perfil.crc]
                  .filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-xs text-muted">
                Último acesso {quando(d.perfil.ultimoAcesso)}
                {d.perfil.disponivel && " · disponível no banco de talentos"}
              </p>
            </div>
          </div>

          {d.perfil.bio && (
            <p className="rounded-xl bg-cream/60 p-4 text-sm leading-relaxed text-ink">
              {d.perfil.bio}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              ["Matrículas", d.matriculas],
              ["Aulas concluídas", d.aulasConcluidas],
              ["Candidaturas", d.candidaturas],
              ["Posts no feed", d.posts],
            ].map(([r, v]) => (
              <div key={r as string} className="rounded-xl bg-cream p-3">
                <p className="text-lg font-bold text-navy-700">{v as number}</p>
                <p className="text-[10px] text-muted">{r as string}</p>
              </div>
            ))}
          </div>

          {(d.perfil.selos ?? []).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy-600">
                Habilidades
              </p>
              <PainelDeSelos selos={d.perfil.selos ?? []} compacto />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
                <Award size={12} className="text-gold-500" /> Certificados ({d.certificados.length})
              </p>
              {d.certificados.length === 0 ? (
                <p className="text-xs text-muted">Nenhum ainda.</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.certificados.map((c) => (
                    <li key={c.codigo} className="rounded-lg border border-navy-100 px-3 py-2">
                      <p className="text-[13px] font-medium text-navy-700">{c.curso}</p>
                      <p className="text-[10px] text-muted">
                        {c.codigo} · {new Date(c.emitidoEm).toLocaleDateString("pt-BR")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy-600">
                <Route size={12} className="text-gold-500" /> Trilhas ({d.trilhas.length})
              </p>
              {d.trilhas.length === 0 ? (
                <p className="text-xs text-muted">Nenhuma concluída.</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.trilhas.map((t) => (
                    <li key={t.nome} className="rounded-lg border border-navy-100 px-3 py-2">
                      <p className="text-[13px] font-medium text-navy-700">{t.nome}</p>
                      <p className="text-[10px] text-muted">
                        {new Date(t.emitidoEm).toLocaleDateString("pt-BR")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------ editar perfil --- */
/**
 * Correção de cadastro sem precisar da senha da pessoa — o caso mais comum do
 * suporte (cidade errada, CRC digitado torto, cargo desatualizado).
 *
 * Habilidade não está aqui de propósito: ela é conquista de curso concluído,
 * não campo editável. Um administrador que pudesse digitar "SPED" no perfil
 * de alguém devolveria ao selo exatamente a fragilidade que ele veio corrigir.
 */
function ModalEditarPerfil({
  perfil, aoFechar, aoSalvar,
}: {
  perfil: Perfil;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [form, setForm] = useState({
    nome: perfil.nome ?? "",
    cargo: perfil.cargo ?? "",
    cidade: perfil.cidade ?? "",
    uf: perfil.uf ?? "",
    crc: perfil.crc ?? "",
    senioridade: perfil.senioridade ?? "",
    bio: perfil.bio ?? "",
    telefone: perfil.telefone ?? "",
    linkedin: perfil.linkedin ?? "",
    pretensao: perfil.pretensao ?? "",
    disponivel: perfil.disponivel ?? false,
    contatoPublico: perfil.contatoPublico ?? true,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Visibilidade no banco de talentos é consentimento, não campo de cadastro:
  // ela só viaja quando o administrador mexe na caixa. Sem isso, corrigir um
  // CRC republicaria o perfil de quem tinha saído da vitrine.
  const [tocouVisibilidade, setTocouVisibilidade] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const { disponivel, ...resto } = form;
    const r = await atualizarPerfilComoAdmin(
      perfil.id,
      tocouVisibilidade ? { ...resto, disponivel } : resto
    );
    setSalvando(false);
    if (!r.ok) setErro(r.erro ?? "Não foi possível salvar.");
    else aoSalvar();
  }

  return (
    <Modal
      titulo="Editar perfil"
      subtitulo={perfil.email}
      aoFechar={aoFechar}
      largura="max-w-2xl"
      rodape={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={aoFechar}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
          >
            Cancelar
          </button>
          <Button variant="gold" size="sm" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {erro && <AvisoErro>{erro}</AvisoErro>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo">
            <input value={form.nome} onChange={(e) => set("nome", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Cargo">
            <input value={form.cargo} onChange={(e) => set("cargo", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Cidade">
            <input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} className={inputCls} />
          </Field>
          <Field label="UF">
            <input
              value={form.uf}
              maxLength={2}
              onChange={(e) => set("uf", e.target.value.toUpperCase())}
              className={inputCls}
            />
          </Field>
          <Field label="Registro CRC">
            <input value={form.crc} onChange={(e) => set("crc", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Senioridade">
            <select
              value={form.senioridade}
              onChange={(e) => set("senioridade", e.target.value as never)}
              className={inputCls}
            >
              <option value="">Não informada</option>
              {["Estagiário", "Júnior", "Pleno", "Sênior", "Especialista"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="WhatsApp / telefone">
            <input
              value={form.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              placeholder="(75) 99999-0000"
              className={inputCls}
            />
          </Field>
          <Field label="Pretensão salarial">
            <input
              value={form.pretensao}
              onChange={(e) => set("pretensao", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="LinkedIn">
          <input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} className={inputCls} />
        </Field>

        <Field label="Resumo profissional">
          <textarea
            rows={4}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            className={inputCls}
          />
        </Field>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 p-3.5">
            <input
              type="checkbox"
              checked={form.disponivel}
              onChange={(e) => {
                setTocouVisibilidade(true);
                set("disponivel", e.target.checked);
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-200 accent-[#C89F50]"
            />
            <span>
              <span className="block text-sm font-semibold text-navy-700">
                Aparece no banco de talentos
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Desmarcar tira o perfil da busca das empresas na hora.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 p-3.5">
            <input
              type="checkbox"
              checked={form.contatoPublico}
              onChange={(e) => set("contatoPublico", e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-200 accent-[#C89F50]"
            />
            <span>
              <span className="block text-sm font-semibold text-navy-700">
                Telefone e LinkedIn visíveis no perfil
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Sem isso, quem abre a ficha só fala pela Academy.
              </span>
            </span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------- desativar --- */
function ModalDesativar({
  perfil, aoFechar, aoConfirmar,
}: {
  perfil: Perfil; aoFechar: () => void; aoConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");

  return (
    <Modal titulo="Desativar conta" aoFechar={aoFechar} largura="max-w-md">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink">
          <strong className="text-navy-700">{perfil.nome}</strong> perde o acesso à
          plataforma e sai do banco de talentos imediatamente.
        </p>
        <p className="rounded-lg bg-cream px-3.5 py-2.5 text-xs leading-relaxed text-muted">
          Certificados, progresso e candidaturas <strong className="text-navy-700">continuam
          guardados</strong> — desativar não apaga nada. A conta pode ser reativada a
          qualquer momento por este mesmo menu.
        </p>
        <Field label="Motivo" hint="Opcional. Fica registrado no perfil.">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Inadimplência, pedido do titular…"
            className={inputCls}
          />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={aoFechar}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
        >
          Cancelar
        </button>
        <button
          onClick={() => aoConfirmar(motivo)}
          className="rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
        >
          Desativar
        </button>
      </div>
    </Modal>
  );
}
