"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, Award, BadgeCheck, Bookmark, BookmarkCheck, Briefcase, Check,
  CheckCircle2, Contact, Copy, Linkedin, Mail, MapPin, MessageSquare, Phone,
  Send, Star, Trophy, X,
} from "lucide-react";
import { Avatar, Badge, Button, Card, Carregando, cn } from "@/components/ui";
import { LegendaSelos, PainelDeSelos, SeloTrilha } from "@/components/selos";
import { useDados } from "@/lib/dados";
import { useSession } from "@/lib/session";
import {
  carregarPerfilPorId, certificadosDoPerfil, selosDeTrilhaDoPerfil,
} from "@/lib/repo";
import { mensagemParaTalento } from "@/lib/repo-pessoas";
import type { Certificado, Perfil, SeloTrilhaDados } from "@/lib/types";

/* ==========================================================================
   FICHA DO PROFISSIONAL

   Mesma tela para o aluno navegando no banco de talentos e para o
   administrador vindo de /admin/alunos. Duas cópias divergiriam na primeira
   mudança, e a empresa precisa ver exatamente o que o candidato vê.

   O perfil é buscado por id em vez de procurado na lista carregada: o banco
   de talentos só traz quem marcou `perfil_publico`, e era por isso que a
   ficha de quem não publicou dava "não encontrado" para o administrador —
   mesmo com o RLS liberando a leitura para ele.
   ========================================================================== */

export function PerfilTalento({
  id,
  modoAdmin,
  aoNaoEncontrar,
}: {
  id: string;
  /** Vindo de /admin: mostra contato mesmo quando a pessoa fechou. */
  modoAdmin?: boolean;
  aoNaoEncontrar?: () => void;
}) {
  const { getTalento, cursos } = useDados();
  const { user, favoritos, alternarFavorito, modoDemo } = useSession();

  const [talento, setTalento] = useState<Perfil | null>(getTalento(id) ?? null);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [trilhas, setTrilhas] = useState<SeloTrilhaDados[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [contatoAberto, setContatoAberto] = useState(false);
  const [mensagemAberta, setMensagemAberta] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [p, certs, selos] = await Promise.all([
      carregarPerfilPorId(id),
      certificadosDoPerfil(id),
      selosDeTrilhaDoPerfil(id),
    ]);
    if (p) setTalento(p);
    setCertificados(certs);
    setTrilhas(selos as SeloTrilhaDados[]);
    setCarregando(false);
    if (!p && !getTalento(id)) aoNaoEncontrar?.();
  }, [id, getTalento, aoNaoEncontrar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando && !talento) return <Carregando />;

  if (!talento) {
    return (
      <Card className="text-center">
        <AlertCircle size={28} className="mx-auto text-muted" />
        <p className="mt-3 text-sm font-semibold text-navy-700">
          Perfil não encontrado
        </p>
        <p className="mt-1 text-xs text-muted">
          A pessoa pode ter saído do banco de talentos ou a conta foi removida.
        </p>
      </Card>
    );
  }

  const fav = favoritos.includes(talento.id);
  const souEu = user?.id === talento.id;
  const podeVerContato = modoAdmin || talento.contatoPublico !== false;
  const temContato = Boolean(talento.email || talento.telefone || talento.linkedin);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="brand-gradient relative overflow-hidden rounded-2xl p-7 lg:p-9">
        <div className="grid-lines absolute inset-0" />
        <div className="relative flex flex-wrap items-start gap-6">
          <Avatar nome={talento.nome} size={84} cor="#C89F50" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-white lg:text-3xl">{talento.nome}</h1>
              {trilhas.length > 0 && <BadgeCheck size={20} className="text-gold-400" />}
              {modoAdmin && talento.ativo === false && (
                <span className="rounded-full border border-red-400/40 bg-red-400/15 px-3 py-1 text-[11px] font-bold text-red-200">
                  Conta desativada
                </span>
              )}
            </div>
            <p className="mt-1 text-base text-navy-100/75">
              {talento.cargo ?? "Profissional de contabilidade"}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-navy-100/60">
              {(talento.cidade || talento.uf) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} className="text-gold-400" />
                  {talento.cidade}
                  {talento.uf ? `/${talento.uf}` : ""}
                </span>
              )}
              {talento.crc && (
                <span className="inline-flex items-center gap-1.5">
                  <Award size={13} className="text-gold-400" /> CRC {talento.crc}
                </span>
              )}
              {talento.senioridade && (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase size={13} className="text-gold-400" /> {talento.senioridade}
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {talento.disponivel ? (
                <span className="rounded-full border border-emerald-400/40 bg-emerald-400/15 px-3 py-1 text-[11px] font-bold text-emerald-300">
                  Aberto a oportunidades
                </span>
              ) : (
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold text-navy-100/70">
                  Não está buscando no momento
                </span>
              )}
              {talento.pretensao && (
                <span className="rounded-full border border-gold-400/35 bg-gold-400/10 px-3 py-1 text-[11px] font-bold text-gold-300">
                  Pretensão: {talento.pretensao}
                </span>
              )}
              {modoAdmin && (
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold text-navy-100/70">
                  Plano {talento.plano}
                </span>
              )}
            </div>
          </div>

          {!souEu && (
            <div className="flex flex-wrap gap-2">
              <Button variant="gold" onClick={() => setMensagemAberta(true)}>
                <MessageSquare size={15} /> Entrar em contato
              </Button>
              <button
                onClick={() => alternarFavorito(talento.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition",
                  fav
                    ? "border-gold-400 bg-gold-400/15 text-gold-300"
                    : "border-white/25 text-white hover:border-gold-400"
                )}
              >
                {fav ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                {fav ? "Salvo" : "Salvar"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          {talento.bio && (
            <Card>
              <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700">Sobre</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink">{talento.bio}</p>
            </Card>
          )}

          {/* Habilidades — agora com procedência */}
          <Card>
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700">
              Habilidades
            </h2>
            <p className="mt-1 text-xs text-muted">
              Os selos vêm de curso concluído dentro da Academy. O metal indica o
              nível do curso que formou a habilidade.
            </p>
            <div className="mt-4">
              <PainelDeSelos
                selos={talento.selos ?? []}
                vazio="Este profissional ainda não conquistou selos na plataforma."
              />
            </div>
            {(talento.selos ?? []).some((s) => s.selo) && (
              <LegendaSelos className="mt-5 border-t border-navy-100 pt-4" />
            )}
          </Card>

          {/* Selos de trilha */}
          {trilhas.length > 0 && (
            <Card>
              <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700">
                Certificações de trilha
              </h2>
              <p className="mt-1 text-xs text-muted">
                Formação completa concluída, com avaliação em cada aula.
              </p>
              <div className="mt-4 space-y-3">
                {trilhas.map((t) => (
                  <SeloTrilha key={t.slug} selo={t} />
                ))}
              </div>
            </Card>
          )}

          {/* Certificados de curso */}
          <Card>
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-700">
              Formação na Academy
            </h2>

            {certificados.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-navy-200 bg-cream/60 p-4 text-sm text-muted">
                Ainda não concluiu nenhum curso na plataforma.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {certificados.map((c) => {
                  const curso = cursos.find((x) => x.slug === c.cursoSlug);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3.5 rounded-xl border border-navy-100 p-3.5"
                    >
                      <span
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ background: curso?.cor ?? "#00204D" }}
                      >
                        <Award size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-navy-700">
                          {c.cursoTitulo}
                        </p>
                        <p className="text-xs text-muted">
                          {c.cargaHoraria}h · {c.pontosPEPC} pts PEPC · código {c.codigo}
                        </p>
                      </div>
                      <Badge tone="green">Verificado</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {/* Contato */}
          <Card>
            <h3 className="flex items-center gap-2 text-sm font-bold text-navy-700">
              <Contact size={15} className="text-gold-500" /> Informações de contato
            </h3>

            {!podeVerContato ? (
              <p className="mt-3 rounded-xl border border-dashed border-navy-200 bg-cream/60 p-4 text-xs leading-relaxed text-muted">
                Este profissional preferiu não publicar o contato direto. Use
                “Entrar em contato” — a mensagem chega na conta dele.
              </p>
            ) : !contatoAberto ? (
              <>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  Telefone, e-mail e LinkedIn de quem se colocou no banco de talentos.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  full
                  className="mt-3"
                  onClick={() => setContatoAberto(true)}
                >
                  <Contact size={14} /> Ver informações de contato
                </Button>
              </>
            ) : !temContato ? (
              <p className="mt-3 text-xs text-muted">
                Este profissional ainda não preencheu telefone nem LinkedIn.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {talento.telefone && (
                  <>
                    <LinhaContato
                      icone={<Phone size={14} />}
                      rotulo="Telefone"
                      valor={talento.telefone}
                      href={`tel:${somenteDigitos(talento.telefone)}`}
                    />
                    <Button
                      href={linkWhatsApp(talento.telefone, talento.nome)}
                      variant="outline"
                      size="sm"
                      full
                    >
                      <MessageSquare size={14} /> Chamar no WhatsApp
                    </Button>
                  </>
                )}
                {talento.email && (
                  <LinhaContato
                    icone={<Mail size={14} />}
                    rotulo="E-mail"
                    valor={talento.email}
                    href={`mailto:${talento.email}`}
                  />
                )}
                {talento.linkedin && (
                  <LinhaContato
                    icone={<Linkedin size={14} />}
                    rotulo="LinkedIn"
                    valor={enxugarUrl(talento.linkedin)}
                    copiar={talento.linkedin}
                    href={talento.linkedin}
                    externo
                  />
                )}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-bold text-navy-700">Reputação na plataforma</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-cream p-3.5 text-center">
                <Trophy size={17} className="mx-auto text-gold-500" />
                <p className="mt-2 text-lg font-bold text-navy-700">
                  {(talento.pontos ?? 0).toLocaleString("pt-BR")}
                </p>
                <p className="text-[11px] text-muted">XP total</p>
              </div>
              <div className="rounded-xl bg-cream p-3.5 text-center">
                <Star size={17} className="mx-auto text-gold-500" />
                <p className="mt-2 text-lg font-bold text-navy-700">{talento.nivel}</p>
                <p className="text-[11px] text-muted">Nível</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                [certificados.length, "cursos"],
                [trilhas.length, "trilhas"],
                [(talento.selos ?? []).filter((s) => s.selo).length, "selos"],
              ].map(([n, label]) => (
                <div key={label as string} className="rounded-xl border border-navy-100 p-2.5">
                  <p className="text-base font-bold text-navy-700">{n as number}</p>
                  <p className="text-[10px] text-muted">{label as string}</p>
                </div>
              ))}
            </div>
          </Card>

          {trilhas.length > 0 && (
            <Card className="!border-gold-200 !bg-gold-50">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-600">
                Selo Castelo Branco
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gold-600/90">
                Este profissional concluiu {trilhas.length}{" "}
                {trilhas.length === 1 ? "trilha completa" : "trilhas completas"} com
                avaliação em cada aula. O selo indica formação verificada — não apenas
                presença.
              </p>
            </Card>
          )}
        </div>
      </div>

      {mensagemAberta && (
        <ModalMensagem
          talento={talento}
          modoDemo={modoDemo}
          aoFechar={() => setMensagemAberta(false)}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- partes -- */
/**
 * Uma linha de contato: o valor visível, a caixa inteira clicável e um botão
 * de copiar do lado.
 *
 * O botão existe porque metade dos usos não é "clicar agora": é colar o
 * telefone no WhatsApp do celular, ou o LinkedIn numa planilha de recrutamento.
 * Sem ele, a pessoa selecionava o texto com o mouse e arrastava por cima do
 * link — que abria.
 */
function LinhaContato({
  icone, rotulo, valor, href, copiar, externo,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  href: string;
  /** Texto copiado, quando difere do exibido (o LinkedIn mostra encurtado). */
  copiar?: string;
  externo?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiarValor(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(copiar ?? valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* navegador sem permissão de área de transferência */
    }
  }

  return (
    <div className="group flex items-center gap-2 rounded-xl border border-navy-100 p-3 transition hover:border-gold-300">
      <a
        href={href}
        target={externo ? "_blank" : undefined}
        rel={externo ? "noopener noreferrer" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
          {icone}
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
            {rotulo}
          </span>
          <span className="block truncate text-sm font-semibold text-navy-700">{valor}</span>
        </span>
      </a>

      <button
        onClick={copiarValor}
        title={copiado ? "Copiado" : `Copiar ${rotulo.toLowerCase()}`}
        aria-label={`Copiar ${rotulo.toLowerCase()}`}
        className={cn(
          "shrink-0 rounded-lg p-2 transition",
          copiado
            ? "text-emerald-600"
            : "text-muted hover:bg-navy-50 hover:text-navy-700"
        )}
      >
        {copiado ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

/** `https://www.linkedin.com/in/fulano/` → `linkedin.com/in/fulano`. */
function enxugarUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

function ModalMensagem({
  talento, modoDemo, aoFechar,
}: {
  talento: Perfil; modoDemo: boolean; aoFechar: () => void;
}) {
  const [assunto, setAssunto] = useState(`Oportunidade para ${talento.nome.split(" ")[0]}`);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    const r = await mensagemParaTalento(talento.id, assunto, mensagem);
    setEnviando(false);
    if (r.erro) setErro(r.erro);
    else setEnviado(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 p-4 backdrop-blur-sm"
      onClick={aoFechar}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-navy-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-navy-700">Entrar em contato</h2>
            <p className="mt-0.5 text-xs text-muted">
              A mensagem chega como notificação na conta de {talento.nome}.
            </p>
          </div>
          <button onClick={aoFechar} className="text-muted transition hover:text-navy-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {enviado ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm font-semibold text-emerald-600">
              <CheckCircle2 size={18} /> Mensagem enviada
            </p>
          ) : (
            <>
              {modoDemo && (
                <p className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-xs text-gold-600">
                  No modo demonstração a mensagem não sai: ela depende do banco.
                </p>
              )}
              {erro && (
                <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /> {erro}
                </p>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-navy-600">
                  Assunto
                </span>
                <input
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  className="w-full rounded-xl border border-navy-200 px-4 py-2.5 text-sm outline-none transition focus:border-gold-400"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-navy-600">
                  Mensagem
                </span>
                <textarea
                  rows={5}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Apresente a vaga ou o motivo do contato."
                  className="w-full rounded-xl border border-navy-200 px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-gold-400"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-navy-100 px-6 py-4">
          <button
            onClick={aoFechar}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-50"
          >
            {enviado ? "Fechar" : "Cancelar"}
          </button>
          {!enviado && (
            <Button
              variant="gold"
              onClick={enviar}
              disabled={enviando || !mensagem.trim() || modoDemo}
            >
              <Send size={15} /> {enviando ? "Enviando…" : "Enviar mensagem"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- apoio --- */
function somenteDigitos(t: string) {
  return t.replace(/\D/g, "");
}

/** Número brasileiro sem DDI não abre o WhatsApp — o 55 entra aqui. */
function linkWhatsApp(telefone: string, nome: string) {
  const n = somenteDigitos(telefone);
  const completo = n.length <= 11 ? `55${n}` : n;
  const texto = encodeURIComponent(
    `Olá, ${nome.split(" ")[0]}! Vi seu perfil no banco de talentos da Castelo Branco Academy.`
  );
  return `https://wa.me/${completo}?text=${texto}`;
}
