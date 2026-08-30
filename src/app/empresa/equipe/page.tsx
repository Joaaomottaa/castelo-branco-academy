"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, BadgePercent, Check, Copy, KeyRound, Loader2, Mail, MoreVertical,
  ShieldCheck, Trash2, UserMinus, UserPlus, Users,
} from "lucide-react";
import { Avatar, Badge, Button, Card, Field, cn, inputCls } from "@/components/ui";
import { Modal } from "@/components/modal";
import {
  cancelarConvite, carregarConvites, carregarEquipe, criarConvites,
  definirLicenca, definirPapel, linkDoConvite, removerMembro,
  type Convite, type MembroEquipe,
} from "@/lib/repo-empresa";
import { useEmpresa } from "../contexto";

/* ==========================================================================
   PESSOAS E LICENÇAS

   Duas listas que contam a mesma história em tempos diferentes: quem já está
   no time e quem foi chamado e ainda não entrou.

   A licença aparece como interruptor por pessoa, não como número abstrato.
   Um gestor não pensa "tenho oito assentos"; pensa "a Camila precisa de acesso
   e o estagiário que saiu não precisa mais".
   ========================================================================== */

type Aba = "pessoas" | "convites";

export default function EquipePage() {
  const { empresa, recarregar } = useEmpresa();
  const [aba, setAba] = useState<Aba>("pessoas");
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [convidando, setConvidando] = useState(false);
  const [erro, setErro] = useState("");

  const atualizar = useCallback(async () => {
    const [e, c] = await Promise.all([carregarEquipe(), carregarConvites()]);
    setEquipe(e);
    setConvites(c);
    setCarregando(false);
    await recarregar();
  }, [recarregar]);

  useEffect(() => { void atualizar(); }, [atualizar]);

  async function agir(fn: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro("");
    const r = await fn();
    if (!r.ok) return setErro(r.erro ?? "Não consegui concluir.");
    await atualizar();
  }

  const pendentes = convites.filter((c) => c.status === "pendente" && new Date(c.expiraEm) > new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-gold-500">Equipe</p>
          <h1 className="text-2xl font-bold tracking-tight text-navy-700">Pessoas e licenças</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            {empresa.licencas.contratadas > 0 ? (
              <>
                Seu contrato tem <strong className="text-navy-700">{empresa.licencas.contratadas} assento(s)</strong>{" "}
                — {empresa.licencas.usadas} em uso e {empresa.licencas.livres} livre(s).
                Quem entra por uma licença recebe o plano Pro enquanto estiver no time.
              </>
            ) : (
              <>
                Sua empresa ainda não tem assentos contratados. Você pode convidar com
                desconto agora e fechar o contrato depois.
              </>
            )}
          </p>
        </div>
        <Button variant="gold" onClick={() => setConvidando(true)}>
          <UserPlus size={16} /> Convidar
        </Button>
      </div>

      {erro && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}

      <div className="flex gap-1.5 border-b border-navy-100">
        <BotaoAba ativo={aba === "pessoas"} onClick={() => setAba("pessoas")}>
          Pessoas <span className="tabular-nums opacity-60">({equipe.length})</span>
        </BotaoAba>
        <BotaoAba ativo={aba === "convites"} onClick={() => setAba("convites")}>
          Convites <span className="tabular-nums opacity-60">({pendentes.length})</span>
        </BotaoAba>
      </div>

      {carregando ? (
        <Card><p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </p></Card>
      ) : aba === "pessoas" ? (
        <ListaPessoas equipe={equipe} livres={empresa.licencas.livres} agir={agir} />
      ) : (
        <ListaConvites convites={convites} agir={agir} />
      )}

      {convidando && (
        <ModalConvite
          livres={empresa.licencas.livres}
          descontoPadrao={empresa.descontoPadrao}
          aoFechar={() => setConvidando(false)}
          aoCriar={atualizar}
        />
      )}
    </div>
  );
}

function BotaoAba({
  ativo, onClick, children,
}: {
  ativo: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition",
        ativo
          ? "border-gold-400 text-navy-700"
          : "border-transparent text-muted hover:text-navy-700"
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ pessoas ---- */

function ListaPessoas({
  equipe, livres, agir,
}: {
  equipe: MembroEquipe[];
  livres: number;
  agir: (fn: () => Promise<{ ok: boolean; erro?: string }>) => Promise<void>;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<MembroEquipe | null>(null);

  if (equipe.length === 0) {
    return (
      <Card className="text-center">
        <Users size={22} className="mx-auto text-navy-300" />
        <p className="mt-2.5 text-sm font-semibold text-navy-700">O time ainda está vazio</p>
        <p className="mt-1 text-xs text-muted">Convide a primeira pessoa para começar.</p>
      </Card>
    );
  }

  return (
    <>
      <Card className="!p-0 overflow-hidden">
        <div className="divide-y divide-navy-100">
          {equipe.map((m) => (
            <div key={m.perfilId} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <Avatar nome={m.nome} size={40} />

              <div className="min-w-[180px] flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-700">
                  {m.nome}
                  {m.papel !== "membro" && (
                    <Badge tone="navy"><ShieldCheck size={11} /> Gestor</Badge>
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  {m.cargo ? `${m.cargo} · ` : ""}{m.email}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-right">
                <Numero valor={`${m.horasAno}h`} rotulo="no ano" />
                <Numero
                  valor={m.pontosPepcAno}
                  rotulo="pts PEPC"
                  destaque={m.pontosPepcAno >= 40}
                />
                <Numero valor={m.certificados} rotulo="certificados" />
                {m.formacoesAtrasadas > 0 ? (
                  <Badge tone="red">{m.formacoesAtrasadas} atrasada(s)</Badge>
                ) : m.formacoesPendentes > 0 ? (
                  <Badge tone="muted">{m.formacoesPendentes} pendente(s)</Badge>
                ) : (
                  <Badge tone="green"><Check size={11} /> Em dia</Badge>
                )}
              </div>

              {/* Licença */}
              <div className="flex items-center gap-2">
                {m.licenca ? (
                  <Badge tone="gold"><KeyRound size={11} /> Licença ativa</Badge>
                ) : m.descontoPct > 0 ? (
                  <Badge tone="teal"><BadgePercent size={11} /> {m.descontoPct}% off</Badge>
                ) : (
                  <Badge tone="muted">Sem licença</Badge>
                )}

                <div className="relative">
                  <button
                    onClick={() => setMenu(menu === m.perfilId ? null : m.perfilId)}
                    className="rounded-lg p-1.5 text-muted transition hover:bg-navy-50 hover:text-navy-700"
                    aria-label={`Ações para ${m.nome}`}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {menu === m.perfilId && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                      <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-xl">
                        <ItemMenu
                          onClick={() => { setMenu(null); void agir(() => definirLicenca(m.perfilId, !m.licenca)); }}
                          desabilitado={!m.licenca && livres <= 0}
                          icone={<KeyRound size={14} />}
                        >
                          {m.licenca
                            ? "Tirar a licença"
                            : livres > 0 ? "Dar uma licença" : "Sem assento livre"}
                        </ItemMenu>
                        <ItemMenu
                          onClick={() => {
                            setMenu(null);
                            void agir(() => definirPapel(m.perfilId, m.papel === "membro" ? "gestor" : "membro"));
                          }}
                          icone={<ShieldCheck size={14} />}
                        >
                          {m.papel === "membro" ? "Tornar gestor" : "Rebaixar a membro"}
                        </ItemMenu>
                        <ItemMenu
                          onClick={() => { setMenu(null); setConfirmar(m); }}
                          icone={<UserMinus size={14} />}
                          perigo
                        >
                          Remover do time
                        </ItemMenu>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {confirmar && (
        <Modal
          titulo={`Remover ${confirmar.nome} do time?`}
          subtitulo="O histórico de estudo e os certificados continuam com a pessoa — são dela, não da empresa."
          largura="max-w-lg"
          aoFechar={() => setConfirmar(null)}
          rodape={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmar(null)}>Cancelar</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const alvo = confirmar;
                  setConfirmar(null);
                  void agir(() => removerMembro(alvo.perfilId));
                }}
              >
                <Trash2 size={15} /> Remover
              </Button>
            </div>
          }
        >
          <p className="text-sm leading-relaxed text-ink">
            {confirmar.licenca ? (
              <>
                A licença volta para o contrato e o plano de {confirmar.nome.split(" ")[0]} retorna
                ao que era antes do vínculo. As formações atribuídas deixam de aparecer para
                essa pessoa.
              </>
            ) : (
              <>
                A pessoa perde acesso às formações da empresa e sai do relatório PEPC.
                O plano pessoal dela não muda.
              </>
            )}
          </p>
        </Modal>
      )}
    </>
  );
}

function Numero({
  valor, rotulo, destaque,
}: {
  valor: string | number; rotulo: string; destaque?: boolean;
}) {
  return (
    <div>
      <p className={cn(
        "text-sm font-bold tabular-nums",
        destaque ? "text-emerald-600" : "text-navy-700"
      )}>
        {valor}
      </p>
      <p className="text-[10px] text-muted">{rotulo}</p>
    </div>
  );
}

function ItemMenu({
  children, onClick, icone, perigo, desabilitado,
}: {
  children: React.ReactNode; onClick: () => void; icone: React.ReactNode;
  perigo?: boolean; desabilitado?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={desabilitado}
      className={cn(
        "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40",
        perigo ? "text-red-600 hover:bg-red-50" : "text-ink hover:bg-cream"
      )}
    >
      {icone}{children}
    </button>
  );
}

/* ----------------------------------------------------------- convites ---- */

function ListaConvites({
  convites, agir,
}: {
  convites: Convite[];
  agir: (fn: () => Promise<{ ok: boolean; erro?: string }>) => Promise<void>;
}) {
  if (convites.length === 0) {
    return (
      <Card className="text-center">
        <Mail size={22} className="mx-auto text-navy-300" />
        <p className="mt-2.5 text-sm font-semibold text-navy-700">Nenhum convite emitido</p>
        <p className="mt-1 text-xs text-muted">
          O convite gera um código e um link. Você manda por onde quiser.
        </p>
      </Card>
    );
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="divide-y divide-navy-100">
        {convites.map((c) => {
          const expirado = new Date(c.expiraEm) < new Date();
          const vivo = c.status === "pendente" && !expirado;
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-[200px] flex-1">
                <p className="flex flex-wrap items-center gap-2 font-mono text-sm font-bold text-navy-700">
                  {c.codigo}
                  {c.tipo === "licenca" ? (
                    <Badge tone="gold"><KeyRound size={11} /> Licença Pro</Badge>
                  ) : (
                    <Badge tone="teal"><BadgePercent size={11} /> {c.descontoPct}% de desconto</Badge>
                  )}
                  {c.papel === "gestor" && <Badge tone="navy">Gestor</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {c.email ?? "Sem destinatário — qualquer pessoa com o link"}
                  {c.cargo ? ` · ${c.cargo}` : ""}
                </p>
              </div>

              <div className="text-right">
                {c.status === "aceito" ? (
                  <Badge tone="green"><Check size={11} /> Aceito</Badge>
                ) : c.status === "cancelado" ? (
                  <Badge tone="muted">Cancelado</Badge>
                ) : expirado ? (
                  <Badge tone="red">Expirado</Badge>
                ) : (
                  <Badge tone="navy">Válido até {dataCurta(c.expiraEm)}</Badge>
                )}
              </div>

              {vivo && (
                <div className="flex items-center gap-1.5">
                  <BotaoCopiar codigo={c.codigo} />
                  <button
                    onClick={() => void agir(() => cancelarConvite(c.id))}
                    title="Cancelar convite"
                    className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Copiar o link.
 *
 * `navigator.clipboard` some em http sem localhost e em iframe sem permissão —
 * exatamente onde uma demonstração costuma acontecer. O `prompt` de reserva é
 * feio, mas devolve o link para a pessoa em vez de falhar em silêncio.
 */
function BotaoCopiar({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const url = linkDoConvite(codigo);
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copie o link do convite:", url);
    }
  }

  return (
    <button
      onClick={() => void copiar()}
      title="Copiar link do convite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition",
        copiado
          ? "border-emerald-200 bg-emerald-50 text-emerald-600"
          : "border-navy-200 text-navy-700 hover:border-gold-400 hover:text-gold-600"
      )}
    >
      {copiado ? <Check size={13} /> : <Copy size={13} />}
      {copiado ? "Copiado" : "Copiar link"}
    </button>
  );
}

/* ------------------------------------------------------- modal convite --- */

function ModalConvite({
  livres, descontoPadrao, aoFechar, aoCriar,
}: {
  livres: number;
  descontoPadrao: number;
  aoFechar: () => void;
  aoCriar: () => Promise<void>;
}) {
  const [tipo, setTipo] = useState<"licenca" | "desconto">(livres > 0 ? "licenca" : "desconto");
  const [papel, setPapel] = useState<"membro" | "gestor">("membro");
  const [emails, setEmails] = useState("");
  const [qtd, setQtd] = useState("1");
  const [cargo, setCargo] = useState("");
  const [desconto, setDesconto] = useState(String(descontoPadrao));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [criados, setCriados] = useState<Array<{ codigo: string; email?: string }> | null>(null);

  const lista = emails
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  async function enviar() {
    setErro("");
    setSalvando(true);
    const r = await criarConvites({
      tipo,
      papel,
      emails: lista,
      qtd: lista.length > 0 ? lista.length : Math.max(1, Number(qtd) || 1),
      descontoPct: tipo === "desconto" ? Number(desconto) || 0 : 0,
      cargo: cargo.trim() || undefined,
    });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não consegui gerar os convites.");
    setCriados(r.convites ?? []);
    await aoCriar();
  }

  if (criados) {
    return (
      <Modal
        titulo={criados.length === 1 ? "Convite gerado" : `${criados.length} convites gerados`}
        subtitulo="Mande o link por e-mail, WhatsApp ou cole na intranet. O código funciona para quem já tem conta e para quem vai criar."
        largura="max-w-xl"
        aoFechar={aoFechar}
        rodape={
          <div className="flex justify-end">
            <Button onClick={aoFechar}>Concluir</Button>
          </div>
        }
      >
        <div className="space-y-2">
          {criados.map((c) => (
            <div
              key={c.codigo}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-navy-100 bg-cream/50 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-bold text-navy-700">{c.codigo}</p>
                {c.email && <p className="truncate text-xs text-muted">{c.email}</p>}
              </div>
              <BotaoCopiar codigo={c.codigo} />
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-xl bg-gold-50 px-4 py-3 text-xs leading-relaxed text-gold-600">
          O envio automático de e-mail ainda não está ligado — por enquanto o link vai
          por você. O código vale 30 dias.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      titulo="Convidar para a equipe"
      subtitulo="Quem aceitar entra vinculado à sua empresa, com o cargo e o papel que você definir aqui."
      largura="max-w-2xl"
      aoFechar={aoFechar}
      rodape={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {tipo === "licenca"
              ? `${livres} assento(s) livre(s) no contrato`
              : "Convite com desconto não consome assento"}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={aoFechar}>Cancelar</Button>
            <Button variant="gold" onClick={() => void enviar()} disabled={salvando}>
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              Gerar convite{lista.length > 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {erro && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Opcao
            ativo={tipo === "licenca"}
            onClick={() => setTipo("licenca")}
            icone={<KeyRound size={16} />}
            titulo="Licença do contrato"
            texto="Ocupa um assento. A pessoa recebe o plano Pro sem pagar nada, enquanto estiver no time."
            desabilitado={livres <= 0}
            nota={livres <= 0 ? "Sem assento livre" : `${livres} livre(s)`}
          />
          <Opcao
            ativo={tipo === "desconto"}
            onClick={() => setTipo("desconto")}
            icone={<BadgePercent size={16} />}
            titulo="Desconto na assinatura"
            texto="Não ocupa assento. A pessoa assina o Pro por conta própria com o desconto da empresa."
          />
        </div>

        {tipo === "desconto" && (
          <Field label="Desconto oferecido" hint="Aplicado sobre o valor do plano Pro no checkout.">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={80}
                step={5}
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-navy-100 accent-gold-500"
              />
              <span className="w-16 rounded-lg bg-cream px-3 py-1.5 text-center text-sm font-bold tabular-nums text-navy-700">
                {desconto}%
              </span>
            </div>
          </Field>
        )}

        <Field
          label="E-mails de quem você quer convidar"
          hint="Um por linha. Deixe vazio para gerar códigos soltos, sem destinatário."
        >
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            rows={4}
            placeholder={"camila@escritorio.com.br\nrafael@escritorio.com.br"}
            className={cn(inputCls, "resize-none font-mono text-xs")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          {lista.length === 0 && (
            <Field label="Quantos códigos" hint="Máximo de 50 por vez.">
              <input
                value={qtd}
                onChange={(e) => setQtd(e.target.value.replace(/\D/g, "").slice(0, 2))}
                inputMode="numeric"
                className={inputCls}
              />
            </Field>
          )}
          <Field label="Cargo" hint="Opcional — aparece na lista da equipe.">
            <input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Analista fiscal"
              className={inputCls}
            />
          </Field>
          <Field label="Papel na empresa">
            <select
              value={papel}
              onChange={(e) => setPapel(e.target.value as "membro" | "gestor")}
              className={inputCls}
            >
              <option value="membro">Membro — só estuda</option>
              <option value="gestor">Gestor — administra o time</option>
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function Opcao({
  ativo, onClick, icone, titulo, texto, desabilitado, nota,
}: {
  ativo: boolean; onClick: () => void; icone: React.ReactNode;
  titulo: string; texto: string; desabilitado?: boolean; nota?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={desabilitado}
      className={cn(
        "rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
        ativo
          ? "border-gold-400 bg-gold-50/60 ring-2 ring-gold-400/20"
          : "border-navy-200 hover:border-navy-300"
      )}
    >
      <p className="flex items-center justify-between gap-2 text-sm font-bold text-navy-700">
        <span className="flex items-center gap-2">{icone}{titulo}</span>
        {nota && <span className="text-[10px] font-semibold text-muted">{nota}</span>}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{texto}</p>
    </button>
  );
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
