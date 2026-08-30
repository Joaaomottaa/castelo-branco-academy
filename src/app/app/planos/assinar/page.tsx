"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle, ArrowLeft, ArrowRight, Barcode, Building2, Check, CheckCircle2,
  Copy, CreditCard, Landmark, Loader2, Lock, QrCode, ShieldCheck, Sparkles,
  Tag, Ticket, X,
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
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white">
          <CheckCircle2 size={32} />
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
                <FormularioCartao credito={metodo === "cartao-credito"} total={total} ciclo={ciclo} />
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
              disabled={processando || etapa !== "dados"}
            >
              {processando ? (
                <><Loader2 size={15} className="animate-spin" /> Confirmando…</>
              ) : etapa !== "dados" ? (
                "Escolha a forma de pagamento"
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
function FormularioCartao({
  credito, total, ciclo,
}: {
  credito: boolean; total: number; ciclo: string;
}) {
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [cpf, setCpf] = useState("");
  const [parcelas, setParcelas] = useState(1);

  const bandeira = bandeiraDoCartao(numero);
  const maxParcelas = credito && ciclo === "anual" ? 12 : 1;

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-600">
        <CreditCard size={13} className="text-gold-500" />
        Dados do cartão de {credito ? "crédito" : "débito"}
      </p>

      {/* cartão visual */}
      <div className="relative overflow-hidden rounded-2xl bg-navy-700 p-5 text-white">
        <div className="grid-lines absolute inset-0 opacity-30" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <span className="h-8 w-11 rounded-md bg-gold-400/80" />
            <span className="text-xs font-bold uppercase tracking-wider text-gold-300">
              {bandeira || "•••"}
            </span>
          </div>
          <p className="mt-5 font-mono text-lg tracking-widest text-white/90">
            {numero || "•••• •••• •••• ••••"}
          </p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wider text-navy-100/50">Titular</p>
              <p className="truncate text-xs font-semibold uppercase">
                {nome || "NOME COMO NO CARTÃO"}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-navy-100/50">Validade</p>
              <p className="text-xs font-semibold">{validade || "MM/AA"}</p>
            </div>
          </div>
        </div>
      </div>

      <Field label="Número do cartão">
        <input
          value={numero}
          onChange={(e) => setNumero(formatarCartao(e.target.value))}
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
          className={inputCls + " font-mono"}
        />
      </Field>

      <Field label="Nome como está no cartão">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value.toUpperCase())}
          placeholder="MARIA A SILVA"
          className={inputCls}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Validade">
          <input
            value={validade}
            onChange={(e) => setValidade(formatarValidade(e.target.value))}
            placeholder="MM/AA"
            inputMode="numeric"
            className={inputCls}
          />
        </Field>
        <Field label="CVV">
          <input
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="000"
            inputMode="numeric"
            className={inputCls}
          />
        </Field>
        <Field label="CPF do titular">
          <input
            value={cpf}
            onChange={(e) => setCpf(formatarCPF(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            className={inputCls}
          />
        </Field>
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

      <p className="flex items-start gap-2 rounded-lg bg-cream px-3 py-2.5 text-[11px] leading-relaxed text-muted">
        <Lock size={12} className="mt-0.5 shrink-0 text-navy-400" />
        Os campos estão aqui para a tela ficar completa, mas nada é validado nem
        enviado — pode confirmar em branco. Quando o gateway entrar, os dados vão
        direto para ele e nunca passam pelo nosso servidor.
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
