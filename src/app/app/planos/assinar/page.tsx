"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle, ArrowLeft, ArrowRight, Barcode, Building2, CalendarDays, Check,
  CheckCircle2, Copy, CreditCard, Landmark, Loader2, Lock, QrCode, ShieldCheck,
  Sparkles, Tag, Ticket, UserRound, X,
} from "lucide-react";
import { Badge, Button, Card, Carregando, Field, cn, inputCls } from "@/components/ui";
import { useSession } from "@/lib/session";
import { PRECOS, precoDoPlano } from "@/lib/planos";
import { meuDescontoDaEmpresa, type DescontoDaEmpresa } from "@/lib/repo-empresa";
import { contratarPlano, validarCupom, type CupomValidado } from "@/lib/repo-cupons";
import {
  bandeiraDoCartao, formatarCartao, formatarCPF, formatarValidade, gerarBoleto,
  gerarPixCopiaECola, matrizVisualQR, type Boleto,
} from "@/lib/pagamento";
import { abrirTino } from "@/lib/tino-abrir";

/* ==========================================================================
   CHECKOUT

   Pagamento simulado, contratação real: ao confirmar, a RPC `contratar_plano`
   grava assinatura, pagamento, uso do cupom e troca o plano no perfil, tudo
   numa transação.

   Os campos de cartão, o QR do Pix e o boleto existem com o formato correto
   mas não são validados nem cobrados — é de propósito, para o gateway entrar
   depois sem redesenhar a tela. Cada etapa diz que é simulação.
   ========================================================================== */

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const METODOS = [
  {
    v: "pix",
    nome: "Pix",
    nota: "Liberação imediata",
    icone: QrCode,
    destaque: true,
  },
  {
    v: "cartao-credito",
    nome: "Cartão de crédito",
    nota: "Renovação automática",
    icone: CreditCard,
  },
  {
    v: "cartao-debito",
    nome: "Cartão de débito",
    nota: "Débito à vista",
    icone: Landmark,
  },
  {
    v: "boleto",
    nome: "Boleto",
    nota: "Compensa em até 3 dias úteis",
    icone: Barcode,
  },
];

export default function AssinarPage() {
  return (
    <Suspense fallback={<Carregando texto="Preparando o checkout…" />}>
      <Checkout />
    </Suspense>
  );
}

function Checkout() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, modoDemo, atualizarPerfil } = useSession();

  const plano = params.get("plano") === "Enterprise" ? "Enterprise" : "Pro";
  const cicloInicial = params.get("ciclo") === "anual" ? "anual" : "mensal";

  const [ciclo, setCiclo] = useState<"mensal" | "anual">(cicloInicial);
  const [metodo, setMetodo] = useState("pix");
  const [etapa, setEtapa] = useState<"metodo" | "dados" | "pronto">("metodo");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");

  // A validade do cartão sobe do formulário porque quem libera o botão é o
  // resumo, do outro lado da tela. Antes dava para confirmar em branco.
  const [cartaoValido, setCartaoValido] = useState(false);
  const pagandoComCartao = metodo.startsWith("cartao");
  const faltaCartao = pagandoComCartao && !cartaoValido;

  /* ------------------------------------------------------------- cupom */
  const [codigo, setCodigo] = useState("");
  const [cupom, setCupom] = useState<CupomValidado | null>(null);
  const [validando, setValidando] = useState(false);

  /* --------------------------------------------------- desconto da empresa */
  // Convite do tipo "desconto" não dá licença: a pessoa assina por conta
  // própria, com o abatimento que a empresa dela negociou. Some junto com o
  // cupom em vez de competir com ele — os dois são descontos legítimos e o
  // resumo mostra as duas linhas separadas.
  const [empresaDesc, setEmpresaDesc] = useState<DescontoDaEmpresa | null>(null);
  useEffect(() => {
    let ativo = true;
    meuDescontoDaEmpresa().then((d) => { if (ativo) setEmpresaDesc(d); });
    return () => { ativo = false; };
  }, []);

  const valorCheio = precoDoPlano(plano, ciclo);
  const desconto = cupom?.valido ? cupom.desconto ?? 0 : 0;
  const descontoEmpresa = empresaDesc
    ? Math.round(valorCheio * (empresaDesc.pct / 100) * 100) / 100
    : 0;
  const total = Math.max(0, valorCheio - desconto - descontoEmpresa);

  // Trocar de ciclo pode invalidar o cupom (há cupom só de anual, só de mensal).
  useEffect(() => {
    setCupom(null);
  }, [ciclo]);

  async function aplicarCupom() {
    if (!codigo.trim()) return;
    setValidando(true);
    setErro("");
    const r = await validarCupom(codigo, plano, ciclo, valorCheio);
    setValidando(false);
    setCupom(r);
  }

  /* ----------------------------------------------------- artefatos do pgto */
  const pixPayload = useMemo(
    () =>
      gerarPixCopiaECola({
        chave: "pagamentos@castelobranco.com.br",
        nome: "Castelo Branco Contabilidade",
        cidade: "Feira de Santana",
        valor: total,
        identificador: `CBA${plano.toUpperCase()}${ciclo === "anual" ? "A" : "M"}`,
      }),
    [total, plano, ciclo]
  );
  const boleto = useMemo<Boleto>(() => gerarBoleto(total), [total]);

  /* ------------------------------------------------------------ confirmar */
  async function confirmar() {
    setProcessando(true);
    setErro("");

    const r = await contratarPlano({
      plano,
      ciclo,
      metodo,
      valor: total,
      cupom: cupom?.valido ? cupom.codigo : undefined,
    });

    if (!r.ok) {
      setProcessando(false);
      return setErro(r.erro ?? "Não foi possível concluir.");
    }

    // Reflete na sessão sem esperar o próximo carregamento.
    await atualizarPerfil({ plano: plano as "Pro" | "Enterprise" });
    setProcessando(false);
    setEtapa("pronto");
  }

  if (!user) return <Carregando />;

  /* ============================================================= sucesso */
  if (etapa === "pronto") {
    return (
      <div className="mx-auto max-w-lg py-8 text-center">
        <Passos atual={3} />
        <span className="mx-auto mt-8 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white ring-8 ring-emerald-500/15">
          <CheckCircle2 size={38} />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-navy-700">
          Plano {plano} ativado
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Pagamento de <strong className="text-navy-700">{brl(total)}</strong> confirmado
          por {METODOS.find((m) => m.v === metodo)?.nome}.
          {desconto > 0 && ` Você economizou ${brl(desconto)} com o cupom ${cupom?.codigo}.`}
        </p>

        <Card className="mt-6 !bg-cream/60 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-navy-600">
            O que abriu agora
          </p>
          <ul className="mt-3 space-y-2">
            {[
              "Todos os cursos e trilhas de carreira",
              "Certificados com código público de validação",
              "Pontos de educação continuada (PEPC)",
              "Questões ilimitadas e o Tino explicando os erros",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-ink">
                <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" /> {t}
              </li>
            ))}
          </ul>
        </Card>

        {modoDemo && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Modo demonstração: a troca vale só nesta sessão do navegador e não foi
            gravada no banco.
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="gold" onClick={() => router.push("/app/cursos")}>
            Começar a estudar <ArrowRight size={15} />
          </Button>
          <Button variant="outline" href="/app/planos">Ver meu plano</Button>
        </div>
      </div>
    );
  }

  /* ============================================================ checkout */
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/app/planos"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-navy-700"
      >
        <ArrowLeft size={15} /> Planos
      </Link>

      <Passos atual={etapa === "dados" ? 2 : 1} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-700">
          Assinar o plano {plano}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Ambiente de demonstração: nenhuma cobrança é feita e nenhum dado de
          pagamento é guardado.
        </p>
      </div>

      {erro && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------------- esquerda */}
        <div className="space-y-4">
          {/* ciclo */}
          <Card className="!p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-navy-600">
              Cobrança
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(["mensal", "anual"] as const).map((c) => {
                const escolhido = ciclo === c;
                const valor = precoDoPlano(plano, c);
                return (
                  <button
                    key={c}
                    onClick={() => setCiclo(c)}
                    className={cn(
                      "rounded-xl border p-3.5 text-left transition",
                      escolhido ? "border-gold-400 bg-gold-50" : "border-navy-100 hover:border-navy-200"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-navy-700 capitalize">{c}</span>
                      {c === "anual" && <Badge tone="gold">−20%</Badge>}
                    </div>
                    <p className="mt-1 text-lg font-bold text-navy-700">
                      {brl(c === "anual" ? PRECOS[plano]?.anualPorMes ?? 0 : valor)}
                      <span className="text-xs font-normal text-muted">/mês</span>
                    </p>
                    <p className="text-[11px] text-muted">
                      {c === "anual" ? `${brl(valor)} por ano, à vista` : "Cancele quando quiser"}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* método */}
          <Card className="!p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-navy-600">
              Forma de pagamento
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {METODOS.map((m) => {
                const escolhido = metodo === m.v;
                return (
                  <button
                    key={m.v}
                    onClick={() => { setMetodo(m.v); setEtapa("dados"); }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3.5 text-left transition",
                      escolhido ? "border-gold-400 bg-gold-50" : "border-navy-100 hover:border-navy-200"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        escolhido ? "gold-gradient text-navy-800" : "bg-navy-50 text-navy-500"
                      )}
                    >
                      <m.icone size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-navy-700">{m.nome}</span>
                        {m.destaque && <Badge tone="green">na hora</Badge>}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted">{m.nota}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* dados do método escolhido */}
          {etapa === "dados" && (
            <Card className="!p-4">
              {metodo.startsWith("cartao") && (
                <FormularioCartao
                  credito={metodo === "cartao-credito"}
                  total={total}
                  ciclo={ciclo}
                  processando={processando}
                  onValido={setCartaoValido}
                />
              )}
              {metodo === "pix" && <PainelPix payload={pixPayload} total={total} />}
              {metodo === "boleto" && <PainelBoleto boleto={boleto} />}
            </Card>
          )}

          {/* Tino */}
          <Card className="!border-gold-200 !bg-gold-50/50 !p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="gold-gradient inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-navy-800">
                <Sparkles size={18} />
              </span>
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-bold text-navy-700">Ficou com alguma dúvida?</p>
                <p className="mt-0.5 text-xs text-muted">
                  Pergunte ao Tino sobre planos, cancelamento, nota fiscal ou o que o Pro inclui.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => abrirTino("Tenho uma dúvida sobre o plano Pro antes de assinar: ")}
              >
                Perguntar ao Tino
              </Button>
            </div>
          </Card>
        </div>

        {/* -------------------------------------------------------- resumo */}
        <div className="space-y-4">
          <Card className="!p-4 lg:sticky lg:top-24">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-navy-600">
              Resumo
            </p>

            <div className="space-y-2 border-b border-navy-100 pb-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink">
                  Plano {plano} · {ciclo}
                </span>
                <span className="font-semibold tabular-nums text-navy-700">{brl(valorCheio)}</span>
              </div>
              {descontoEmpresa > 0 && empresaDesc && (
                <div className="flex justify-between text-emerald-700">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 size={13} /> {empresaDesc.empresa} ({empresaDesc.pct}%)
                  </span>
                  <span className="font-semibold tabular-nums">− {brl(descontoEmpresa)}</span>
                </div>
              )}
              {desconto > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span className="inline-flex items-center gap-1.5">
                    <Tag size={13} /> {cupom?.codigo}
                  </span>
                  <span className="font-semibold tabular-nums">− {brl(desconto)}</span>
                </div>
              )}
            </div>

            <div className="flex items-baseline justify-between py-3">
              <span className="text-sm font-bold text-navy-700">Total</span>
              <span className="text-2xl font-bold tabular-nums text-navy-700">{brl(total)}</span>
            </div>
            {ciclo === "anual" && (
              <p className="-mt-2 mb-2 text-right text-[11px] text-muted">
                equivale a {brl(total / 12)} por mês
              </p>
            )}

            {/* cupom */}
            <div className="border-t border-navy-100 pt-3">
              {cupom?.valido ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <Ticket size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-emerald-800">
                      {cupom.codigo} aplicado
                    </p>
                    {cupom.descricao && (
                      <p className="mt-0.5 text-[11px] text-emerald-700">{cupom.descricao}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setCupom(null); setCodigo(""); }}
                    className="shrink-0 text-emerald-700 transition hover:text-red-600"
                    title="Remover cupom"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-navy-600">
                    Cupom de desconto
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && aplicarCupom()}
                      placeholder="CASTELO50"
                      className={inputCls + " font-mono text-sm uppercase"}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={aplicarCupom}
                      disabled={validando || !codigo.trim()}
                    >
                      {validando ? <Loader2 size={13} className="animate-spin" /> : "Aplicar"}
                    </Button>
                  </div>
                  {cupom && !cupom.valido && (
                    <p className="mt-1.5 text-[11px] text-red-600">{cupom.motivo}</p>
                  )}
                </>
              )}
            </div>

            <Button
              variant="gold"
              full
              className="mt-4"
              onClick={confirmar}
              disabled={processando || etapa !== "dados" || faltaCartao}
            >
              {processando ? (
                <><Loader2 size={15} className="animate-spin" /> Confirmando…</>
              ) : etapa !== "dados" ? (
                "Escolha a forma de pagamento"
              ) : faltaCartao ? (
                "Complete os dados do cartão"
              ) : metodo === "pix" ? (
                <>Já paguei o Pix</>
              ) : metodo === "boleto" ? (
                <>Confirmar pedido</>
              ) : (
                <><Lock size={14} /> Pagar {brl(total)}</>
              )}
            </Button>

            <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-muted">
              <ShieldCheck size={12} className="mt-0.5 shrink-0 text-emerald-600" />
              Ambiente de demonstração. Nenhuma cobrança é feita e nenhum dado de cartão é
              enviado ou guardado — a confirmação apenas ativa o plano na sua conta.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ======================================================================
   Cartão
   ====================================================================== */
/* ======================================================================
   Passos

   Três passos, não os cinco que a tela tem por dentro: o que a pessoa precisa
   saber é quanto falta, e passo demais faz o checkout parecer mais longo do
   que é. No celular só o número do passo atual leva rótulo, senão não cabe.
   ====================================================================== */
function Passos({ atual }: { atual: 1 | 2 | 3 }) {
  const passos = ["Plano e forma", "Dados do pagamento", "Plano ativo"];
  return (
    <ol className="flex items-center gap-1.5">
      {passos.map((rotulo, i) => {
        const n = i + 1;
        const feito = n < atual;
        const aqui = n === atual;
        return (
          <li
            key={rotulo}
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              // O esticão existe só para o rótulo do passo atual caber no
              // celular; no desktop todos caem lado a lado.
              aqui && "flex-1 sm:flex-none"
            )}
          >
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums transition",
                feito && "bg-emerald-500 text-white",
                aqui && "gold-gradient text-navy-800",
                !feito && !aqui && "bg-navy-50 text-navy-300"
              )}
            >
              {feito ? <Check size={13} /> : String(n).padStart(2, "0")}
            </span>
            <span
              className={cn(
                "truncate text-[11px] font-semibold",
                aqui ? "text-navy-700" : "hidden text-muted sm:inline"
              )}
            >
              {rotulo}
            </span>
            {n < passos.length && (
              <span
                className={cn(
                  "h-px w-3 shrink-0 sm:w-6",
                  feito ? "bg-emerald-300" : "bg-navy-100"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Campo com ícone à esquerda.
 *
 * O `Field` do sistema não tem essa variante, e criar uma lá mudaria formulário
 * de todo o produto por causa de uma tela. Fica local até um segundo lugar
 * precisar — aí sobe para ui.tsx.
 */
function CampoComIcone({
  rotulo, icone: Icone, sufixo, className, ...props
}: {
  rotulo: string;
  icone: typeof CreditCard;
  sufixo?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-navy-600">{rotulo}</span>
      <span className="relative block">
        <Icone
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300"
        />
        <input
          {...props}
          className={cn(
            inputCls,
            "h-12 pl-10",
            sufixo && "pr-16",
            className
          )}
        />
        {sufixo && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold uppercase tracking-wider text-navy-400">
            {sufixo}
          </span>
        )}
      </span>
    </label>
  );
}

/* ======================================================================
   Cartão

   O cartão desenhado usa a proporção real (85,6 × 53,98 mm ≈ 1,586) porque
   qualquer outra proporção faz o desenho parecer um retângulo genérico. Ele
   preenche em tempo real conforme a pessoa digita: é o que transforma quatro
   campos numa conferência do que ela tem na mão.

   A validação é de FORMA, não de autenticidade: dígitos, tamanho e mês
   plausível. Quem valida cartão de verdade é o emissor, e não é aqui.
   ====================================================================== */

/** Luhn: o dígito verificador que todo cartão tem. Pega erro de digitação. */
function luhnValido(numero: string): boolean {
  const d = numero.replace(/\D/g, "");
  if (d.length < 13) return false;
  let soma = 0;
  let dobra = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (dobra) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    soma += n;
    dobra = !dobra;
  }
  return soma % 10 === 0;
}

/** Mês entre 01 e 12 e data não vencida. */
function validadeOk(v: string): boolean {
  const d = v.replace(/\D/g, "");
  if (d.length !== 4) return false;
  const mes = Number(d.slice(0, 2));
  const ano = 2000 + Number(d.slice(2));
  if (mes < 1 || mes > 12) return false;
  const agora = new Date();
  const fim = new Date(ano, mes, 0, 23, 59, 59);
  return fim >= agora;
}

/** CPF pelos dois dígitos verificadores — não só pelo tamanho. */
function cpfValido(v: string): boolean {
  const d = v.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const corte of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < corte; i++) soma += Number(d[i]) * (corte + 1 - i);
    const resto = (soma * 10) % 11 % 10;
    if (resto !== Number(d[corte])) return false;
  }
  return true;
}

function FormularioCartao({
  credito, total, ciclo, processando, onValido,
}: {
  credito: boolean;
  total: number;
  ciclo: string;
  processando: boolean;
  /** Sobe a validade para o resumo, que é quem libera o botão de pagar. */
  onValido: (v: boolean) => void;
}) {
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [cpf, setCpf] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [tocado, setTocado] = useState<Record<string, boolean>>({});

  const bandeira = bandeiraDoCartao(numero);
  const maxParcelas = credito && ciclo === "anual" ? 12 : 1;

  // AMEX tem CVV de 4 dígitos; o resto, 3.
  const cvvEsperado = bandeira === "AMEX" ? 4 : 3;

  const checagem = {
    numero: luhnValido(numero),
    nome: nome.trim().split(/\s+/).filter(Boolean).length >= 2,
    validade: validadeOk(validade),
    cvv: cvv.replace(/\D/g, "").length === cvvEsperado,
    cpf: cpfValido(cpf),
  };
  const valido = Object.values(checagem).every(Boolean);

  useEffect(() => { onValido(valido); }, [valido, onValido]);

  const marcar = (campo: string) => () => setTocado((t) => ({ ...t, [campo]: true }));
  const erroDe = (campo: keyof typeof checagem, texto: string) =>
    tocado[campo] && !checagem[campo] ? texto : undefined;

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-600">
        <CreditCard size={13} className="text-gold-500" />
        Dados do cartão de {credito ? "crédito" : "débito"}
      </p>

      {/* ---------------------------------------------------- cartão desenhado */}
      <div
        className={cn(
          "relative mx-auto aspect-[1.586/1] w-full max-w-[22rem] overflow-hidden rounded-2xl",
          "bg-gradient-to-br from-navy-600 via-navy-700 to-navy-900 p-5 text-white",
          "shadow-xl shadow-navy-900/25 ring-1 ring-inset ring-white/10 transition-all duration-500",
          processando && "scale-[0.97] animate-pulse",
          valido && !processando && "ring-2 ring-gold-400/50"
        )}
      >
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-25" />
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-gold-400/10 blur-2xl"
          aria-hidden
        />

        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            {/* chip */}
            <span className="h-7 w-10 overflow-hidden rounded-md bg-gradient-to-br from-gold-200 via-gold-400 to-gold-600 shadow-inner">
              <span className="mt-2 block h-px w-full bg-navy-900/20" />
              <span className="mt-1.5 block h-px w-full bg-navy-900/20" />
              <span className="mx-auto -mt-3 block h-4 w-4 rounded-full border border-navy-900/25" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-300">
              {bandeira || "•••"}
            </span>
          </div>

          <p className="font-mono text-[clamp(0.95rem,4.2vw,1.3rem)] tracking-[0.1em] text-white/95">
            {numero || "•••• •••• •••• ••••"}
          </p>

          <div className="flex items-end justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[8px] uppercase tracking-[0.16em] text-navy-100/50">
                Titular
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-semibold uppercase tracking-wide">
                {nome || "NOME COMO NO CARTÃO"}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[8px] uppercase tracking-[0.16em] text-navy-100/50">
                Validade
              </span>
              <span className="mt-0.5 block text-[11px] font-semibold tabular-nums">
                {validade || "MM/AA"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------- campos */}
      <CampoComIcone
        rotulo="Número do cartão"
        icone={CreditCard}
        sufixo={bandeira || undefined}
        value={numero}
        onChange={(e) => setNumero(formatarCartao(e.target.value))}
        onBlur={marcar("numero")}
        placeholder="0000 0000 0000 0000"
        inputMode="numeric"
        autoComplete="cc-number"
        className="font-mono tracking-wider"
      />
      {erroDe("numero", "Confira o número — algum dígito não fecha.") && (
        <p className="-mt-2 text-[11px] text-red-600">
          Confira o número — algum dígito não fecha.
        </p>
      )}

      <CampoComIcone
        rotulo="Nome como está no cartão"
        icone={UserRound}
        value={nome}
        onChange={(e) => setNome(e.target.value.toUpperCase())}
        onBlur={marcar("nome")}
        placeholder="MARIA A SILVA"
        autoComplete="cc-name"
      />
      {erroDe("nome", "Nome e sobrenome, como está impresso.") && (
        <p className="-mt-2 text-[11px] text-red-600">Nome e sobrenome, como está impresso.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <CampoComIcone
            rotulo="Validade"
            icone={CalendarDays}
            value={validade}
            onChange={(e) => setValidade(formatarValidade(e.target.value))}
            onBlur={marcar("validade")}
            placeholder="MM/AA"
            inputMode="numeric"
            autoComplete="cc-exp"
            maxLength={5}
          />
          {erroDe("validade", "Mês de 01 a 12, e não vencido.") && (
            <p className="mt-1 text-[11px] text-red-600">Mês de 01 a 12, e não vencido.</p>
          )}
        </div>
        <div>
          <CampoComIcone
            rotulo="CVV"
            icone={Lock}
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onBlur={marcar("cvv")}
            placeholder={"0".repeat(cvvEsperado)}
            inputMode="numeric"
            autoComplete="cc-csc"
            maxLength={4}
          />
          {erroDe("cvv", `${cvvEsperado} dígitos.`) && (
            <p className="mt-1 text-[11px] text-red-600">{cvvEsperado} dígitos.</p>
          )}
        </div>
        <div>
          <CampoComIcone
            rotulo="CPF do titular"
            icone={UserRound}
            value={cpf}
            onChange={(e) => setCpf(formatarCPF(e.target.value))}
            onBlur={marcar("cpf")}
            placeholder="000.000.000-00"
            inputMode="numeric"
          />
          {erroDe("cpf", "CPF inválido.") && (
            <p className="mt-1 text-[11px] text-red-600">CPF inválido.</p>
          )}
        </div>
      </div>

      {maxParcelas > 1 && (
        <Field label="Parcelamento">
          <select
            value={parcelas}
            onChange={(e) => setParcelas(Number(e.target.value))}
            className={inputCls}
          >
            {Array.from({ length: maxParcelas }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}× de {brl(total / n)}
                {n === 1 ? " à vista" : " sem juros"}
              </option>
            ))}
          </select>
        </Field>
      )}

      <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        <span>
          <strong>Simulação.</strong> A conferência acima é só de formato — nada é
          cobrado, e o número digitado não sai deste navegador. Não use um cartão
          real: quando o gateway entrar, estes campos passam a ser os dele, e o
          número vai direto para o gateway sem passar pelo nosso servidor.
        </span>
      </p>
    </div>
  );
}

/* ======================================================================
   Pix
   ====================================================================== */
function PainelPix({ payload, total }: { payload: string; total: number }) {
  const [copiado, setCopiado] = useState(false);
  const matriz = useMemo(() => matrizVisualQR(payload), [payload]);

  function copiar() {
    void navigator.clipboard?.writeText(payload);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-600">
        <QrCode size={13} className="text-gold-500" /> Pagar com Pix
      </p>

      <div className="flex flex-wrap items-center gap-5">
        <div className="rounded-2xl border border-navy-100 bg-white p-3">
          <div
            className="grid gap-0"
            style={{
              gridTemplateColumns: `repeat(${matriz.length}, 5px)`,
              lineHeight: 0,
            }}
            aria-label="QR code de demonstração"
          >
            {matriz.flatMap((linha, y) =>
              linha.map((preto, x) => (
                <span
                  key={`${x}-${y}`}
                  style={{
                    width: 5,
                    height: 5,
                    background: preto ? "#00204D" : "transparent",
                  }}
                />
              ))
            )}
          </div>
        </div>

        <div className="min-w-[200px] flex-1">
          <p className="text-2xl font-bold text-navy-700">{brl(total)}</p>
          <p className="mt-1 text-sm text-muted">
            Abra o app do banco, escolha Pix e aponte a câmera — ou use o código
            copia e cola.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={copiar}>
            {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar código</>}
          </Button>
        </div>
      </div>

      <div className="rounded-lg bg-cream p-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-navy-600">
          Pix copia e cola
        </p>
        <p className="break-all font-mono text-[10px] leading-relaxed text-muted">{payload}</p>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
        <AlertCircle size={12} className="mt-0.5 shrink-0" />
        <span>
          <strong>Simulação.</strong> O código segue o padrão EMV do Banco Central,
          com CRC válido, mas a chave é de demonstração e o QR não é legível por
          aplicativo. Clique em “Já paguei o Pix” para ativar o plano.
        </span>
      </p>
    </div>
  );
}

/* ======================================================================
   Boleto
   ====================================================================== */
function PainelBoleto({ boleto }: { boleto: Boleto }) {
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    void navigator.clipboard?.writeText(boleto.linhaDigitavel.replace(/\D/g, ""));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  // Barras a partir da linha digitável, só para dar a aparência do documento.
  const barras = boleto.linhaDigitavel.replace(/\D/g, "").split("");

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-600">
        <Barcode size={13} className="text-gold-500" /> Boleto bancário
      </p>

      <div className="rounded-2xl border border-navy-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-navy-100 pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">Beneficiário</p>
            <p className="text-sm font-bold text-navy-700">{boleto.beneficiario}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted">Vencimento</p>
            <p className="text-sm font-bold text-navy-700">
              {boleto.vencimento.toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted">Valor</p>
            <p className="text-sm font-bold text-navy-700">{brl(boleto.valor)}</p>
          </div>
        </div>

        <div className="py-4">
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">
            Linha digitável
          </p>
          <p className="break-all font-mono text-[13px] font-bold tracking-tight text-navy-700">
            {boleto.linhaDigitavel}
          </p>
        </div>

        <div className="flex h-14 items-end gap-px overflow-hidden border-t border-navy-100 pt-3">
          {barras.map((d, i) => (
            <span
              key={i}
              style={{
                width: Number(d) % 3 === 0 ? 3 : 1,
                height: "100%",
                background: "#00204D",
                opacity: Number(d) % 2 === 0 ? 1 : 0.65,
              }}
            />
          ))}
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={copiar}>
        {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar linha digitável</>}
      </Button>

      <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
        <AlertCircle size={12} className="mt-0.5 shrink-0" />
        <span>
          <strong>Simulação.</strong> A linha tem os 47 dígitos e os verificadores
          calculados pelo módulo 10, como um boleto real — mas o banco é fictício e
          nada é cobrado. Em produção, o plano só liberaria após a compensação;
          aqui, clique em “Confirmar pedido”.
        </span>
      </p>
    </div>
  );
}
