import { NextResponse } from "next/server";

/* ==========================================================================
   GERAÇÃO DE QUESTÕES PARA O BANCO

   Irmã de /api/gerar-questoes, que trabalha em cima de uma aula. Esta parte
   de área, assunto e nível — é o banco de estudo livre, não a prova de uma
   aula específica.

   Dois modos:

   · "ia"    — questão autoral, escrita para o contexto brasileiro atual.
   · "prova" — questão NO ESTILO de exame anterior (CFC, concursos fiscais),
               com a banca e o ano de referência preenchidos.

   Sobre o modo "prova": o modelo não navega e não copia prova. Ele escreve
   questão nova imitando o recorte e o nível de cobrança da banca. É a
   diferença entre "reproduzir a prova de 2023" — que seria cópia de material
   de terceiro — e "treinar no formato da prova de 2023". A tela diz isso ao
   administrador, e a questão nasce marcada como `origem = 'prova'` para ele
   conferir antes de publicar.

   Cadeia de fontes igual à da outra rota: n8n → Anthropic → rascunho local.
   ========================================================================== */

export const runtime = "nodejs";
export const maxDuration = 60;

const TEMPO_LIMITE_MS = 45_000;
const LETRAS = ["a", "b", "c", "d"];

interface Alternativa {
  id: string;
  texto: string;
}

interface QuestaoGerada {
  enunciado: string;
  alternativas: Alternativa[];
  correta: string;
  explicacao?: string;
  banca?: string;
  ano?: number;
  prova?: string;
}

interface Entrada {
  area: string;
  assunto: string;
  nivel?: string;
  modo?: "ia" | "prova";
  banca?: string;
  quantidade?: number;
  observacoes?: string;
}

/* ------------------------------------------------------------- prompt --- */
const SISTEMA =
  "Você monta o banco de questões da Castelo Branco Academy, escola de " +
  "contabilidade da Castelo Branco Contabilidade Avançada (Feira de Santana/BA), " +
  "especializada em tributário, transporte, logística e comércio exterior. " +
  "Responda SEMPRE com JSON válido, sem cerca de código e sem comentário.";

const CALIBRAGEM: Record<string, string> = {
  Iniciante:
    "Cobre definição, finalidade e o passo básico da rotina. O distrator deve ser um engano comum de quem está começando, nunca pegadinha de redação.",
  Intermediário:
    "Cobre aplicação em situação concreta do escritório. Peça o porquê da decisão, não só o nome do conceito. O distrator deve ser plausível para quem sabe a teoria mas nunca executou.",
  Avançado:
    "Cobre exceção, conflito de regra e consequência de escolher errado. O distrator deve ser a resposta certa em outro contexto — o que separa quem domina de quem decorou.",
};

function montarPrompt(e: Entrada, qtd: number): string {
  const nivel = e.nivel || "Intermediário";
  const anoAtual = new Date().getFullYear();

  const blocoProva =
    e.modo === "prova"
      ? `
MODO PROVA ANTERIOR
Escreva questões NO ESTILO das provas de ${e.banca || "CFC (Exame de Suficiência) e concursos fiscais brasileiros"}.

Isto significa imitar o recorte, o vocabulário e o nível de cobrança dessas
bancas — NÃO copiar enunciado de prova real. Escreva questão nova.

Para cada questão preencha também:
  "banca": nome da banca de referência (ex.: "CFC", "FGV", "CESPE/Cebraspe")
  "ano":   ano de referência plausível, entre 2019 e ${anoAtual}
  "prova": identificação da prova de referência (ex.: "Exame de Suficiência 2023.1")

Não afirme que a questão caiu na prova: ela é inspirada no estilo dela.`
      : `
MODO AUTORAL
Questão nova, escrita para a realidade contábil brasileira de ${anoAtual},
incluindo a transição da Reforma Tributária quando o assunto pedir.`;

  return `Você monta o banco de questões da Castelo Branco Academy, escola de
contabilidade da Castelo Branco Contabilidade Avançada (Feira de Santana/BA),
especializada em tributário, transporte, logística e comércio exterior.

Gere exatamente ${qtd} questões de múltipla escolha.

ESCOPO
Área: ${e.area}
Assunto: ${e.assunto}
Nível: ${nivel}
${e.observacoes ? `Instruções do administrador: ${e.observacoes}` : ""}

CALIBRAGEM PARA O NÍVEL ${nivel.toUpperCase()}
${CALIBRAGEM[nivel] ?? CALIBRAGEM.Intermediário}
${blocoProva}

REGRAS
1. Quatro alternativas por questão, com ids "a", "b", "c" e "d".
2. Uma única correta. Varie qual letra é a certa entre as questões.
3. Alternativas de comprimento parecido. A mais longa não pode ser sempre a
   correta — é o vício que ensina o aluno a chutar por formato.
4. Nada de "todas as anteriores", "nenhuma das anteriores" ou negativa dupla.
5. Enunciado direto, no máximo quatro linhas, em português brasileiro.
6. A explicação diz por que a correta está certa E por que o erro mais provável
   está errado. Duas a quatro linhas.
7. Não invente número, prazo, alíquota ou artigo de lei de que não tenha
   certeza. Prefira a formulação conceitual à numérica quando houver dúvida.
8. As ${qtd} questões precisam ser diferentes entre si — não reformule a mesma
   ideia com outras palavras.

Responda APENAS com JSON válido, sem cerca de código e sem comentário:
{"questoes":[{"enunciado":"...","alternativas":[{"id":"a","texto":"..."},{"id":"b","texto":"..."},{"id":"c","texto":"..."},{"id":"d","texto":"..."}],"correta":"b","explicacao":"...","banca":"CFC","ano":2023,"prova":"Exame de Suficiência 2023.1"}]}`;
}

/* ------------------------------------------------------- normalização --- */
function extrairJSON(texto: string): unknown {
  const limpo = texto.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(limpo);
  } catch {
    const i = limpo.indexOf("{");
    const f = limpo.lastIndexOf("}");
    if (i === -1 || f <= i) return null;
    try {
      return JSON.parse(limpo.slice(i, f + 1));
    } catch {
      return null;
    }
  }
}

/** Questão sem gabarito válido é pior que questão nenhuma: some aqui. */
function validar(bruto: unknown): QuestaoGerada[] {
  const raiz = bruto as { questoes?: unknown } | unknown[];
  const lista = Array.isArray(raiz) ? raiz : ((raiz?.questoes as unknown[]) ?? []);
  if (!Array.isArray(lista)) return [];

  const ok: QuestaoGerada[] = [];
  for (const item of lista) {
    const q = item as Partial<QuestaoGerada> & { alternativas?: unknown };
    const enunciado = typeof q.enunciado === "string" ? q.enunciado.trim() : "";
    if (!enunciado) continue;

    const alts = Array.isArray(q.alternativas) ? q.alternativas : [];
    const alternativas: Alternativa[] = alts
      .map((a, i) => {
        const o = a as { id?: unknown; texto?: unknown };
        const texto =
          typeof o?.texto === "string" ? o.texto.trim() : typeof a === "string" ? a : "";
        const id =
          typeof o?.id === "string" && LETRAS.includes(o.id.toLowerCase())
            ? o.id.toLowerCase()
            : LETRAS[i];
        return texto && id ? { id, texto } : null;
      })
      .filter((a): a is Alternativa => Boolean(a))
      .slice(0, 4);

    if (alternativas.length < 2) continue;

    const correta = typeof q.correta === "string" ? q.correta.trim().toLowerCase() : "";
    if (!alternativas.some((a) => a.id === correta)) continue;

    const ano = Number(q.ano);
    ok.push({
      enunciado,
      alternativas,
      correta,
      explicacao: typeof q.explicacao === "string" ? q.explicacao.trim() : undefined,
      banca: typeof q.banca === "string" ? q.banca.trim() : undefined,
      ano: Number.isFinite(ano) && ano > 1990 && ano < 2100 ? ano : undefined,
      prova: typeof q.prova === "string" ? q.prova.trim() : undefined,
    });
  }
  return ok;
}

/* ------------------------------------------------------------- fontes --- */
/**
 * Resultado da tentativa pelo n8n.
 *
 * O diagnóstico existe porque o modo de falha mais comum do n8n é silencioso:
 * quando o fluxo para antes do nó "Respond to Webhook" — credencial faltando
 * no nó Claude, por exemplo — ele devolve **200 com corpo vazio**. Sem
 * distinguir isso de "variável não configurada", a tela dizia "configure a
 * variável" para quem já tinha configurado, e a pessoa procurava no lugar
 * errado.
 */
type TentativaN8N =
  | { ok: true; questoes: QuestaoGerada[] }
  | { ok: false; motivo: "vazio" | "http" | "invalido" | "rede"; detalhe?: string };

async function viaN8N(url: string, e: Entrada, qtd: number): Promise<TentativaN8N> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Dois formatos no mesmo corpo, de propósito: o fluxo antigo lê
      // `tipo`/`area`/`assunto` e monta o prompt lá dentro; a ponte de IA lê
      // `system`/`user` e só repassa. Um payload serve os dois, e trocar de
      // fluxo vira trocar a variável de ambiente.
      body: JSON.stringify({
        tipo: "gerar_questoes_banco",
        quantidade: qtd,
        ...e,
        system: SISTEMA,
        user: montarPrompt(e, qtd),
        max_tokens: 4000,
      }),
      signal: ctrl.signal,
    });

    if (!r.ok) return { ok: false, motivo: "http", detalhe: String(r.status) };

    const texto = await r.text();
    if (!texto.trim()) return { ok: false, motivo: "vazio" };

    let bruto: unknown;
    try {
      bruto = JSON.parse(texto);
    } catch {
      bruto = extrairJSON(texto);
    }

    const raiz = bruto as { resposta?: unknown } | null;
    const alvo =
      typeof raiz?.resposta === "string" ? extrairJSON(raiz.resposta) : bruto;
    const questoes = validar(alvo);
    return questoes.length
      ? { ok: true, questoes }
      : { ok: false, motivo: "invalido" };
  } catch {
    return { ok: false, motivo: "rede" };
  } finally {
    clearTimeout(t);
  }
}

const DIAGNOSTICO: Record<string, string> = {
  vazio:
    "O fluxo do n8n respondeu 200 com corpo vazio — é o que acontece quando a execução para antes do nó \u201cRespond to Webhook\u201d. Quase sempre é a credencial da Anthropic não selecionada no nó Claude. Abra o workflow, escolha a credencial, salve e ative.",
  http: "O n8n respondeu com erro HTTP. Confira se o workflow está ativo e se a URL termina em /webhook/ (e não /webhook-test/).",
  invalido:
    "O n8n respondeu, mas sem nenhuma questão válida. Veja a última execução no n8n: o modelo pode ter devolvido texto fora do formato pedido.",
  rede: "Não consegui falar com o n8n (tempo esgotado ou host fora do ar).",
};

async function viaAnthropic(chave: string, e: Entrada, qtd: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: montarPrompt(e, qtd) }],
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.error("[gerar-questoes-banco] Anthropic respondeu", r.status);
      return null;
    }
    const bruto = await r.json();
    const texto = bruto?.content?.[0]?.text ?? "";
    const questoes = validar(extrairJSON(texto));
    return questoes.length ? questoes : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Rascunho local. Não é IA e não finge ser: entrega o esqueleto marcado para
 * o administrador escrever por cima. Questão ruim publicada é pior que a
 * ausência dela.
 */
function rascunho(e: Entrada, qtd: number): QuestaoGerada[] {
  const t = e.assunto;
  const moldes: Array<{ p: string; alts: string[]; correta: number; exp: string }> = [
    {
      p: `Qual é o conceito central de ${t} na rotina do escritório?`,
      alts: [
        "Cumprir a obrigação acessória no prazo, sem análise do impacto.",
        "Sustentar a decisão com documento e reduzir o risco de autuação.",
        "Reduzir o número de lançamentos contábeis do período.",
        "Transferir a responsabilidade técnica para o cliente.",
      ],
      correta: 1,
      exp: "RASCUNHO — reescreva com o conceito real. O padrão da Academy liga o conteúdo à decisão que ele sustenta.",
    },
    {
      p: `Em ${t}, qual erro aparece com mais frequência na operação?`,
      alts: [
        "Registrar a operação sem conferir o documento que a sustenta.",
        "Arquivar o documento fiscal em ordem cronológica.",
        "Conciliar o razão contábil no fechamento mensal.",
        "Revisar a classificação antes de transmitir a obrigação.",
      ],
      correta: 0,
      exp: "RASCUNHO — troque pelo erro concreto que você vê no dia a dia.",
    },
    {
      p: `Que documento comprova o tratamento adotado em ${t}?`,
      alts: [
        "O contrato firmado entre as partes.",
        "O comprovante de pagamento bancário.",
        "O documento fiscal eletrônico correspondente à operação.",
        "O e-mail de confirmação do cliente.",
      ],
      correta: 2,
      exp: "RASCUNHO — ajuste para o documento correto deste assunto.",
    },
    {
      p: `Qual a consequência de aplicar ${t} de forma incorreta?`,
      alts: [
        "Perda automática do regime tributário.",
        "Formação de passivo oculto, identificado só na fiscalização.",
        "Bloqueio imediato da inscrição estadual.",
        "Suspensão do certificado digital da empresa.",
      ],
      correta: 1,
      exp: "RASCUNHO — confirme a consequência que se aplica aqui.",
    },
    {
      p: `Sobre ${t}, qual afirmação está correta?`,
      alts: [
        "A regra vale igualmente para todos os regimes tributários.",
        "A aplicação depende do regime e da atividade da empresa.",
        "A norma foi revogada e não tem mais efeito prático.",
        "O tema só interessa a empresas de grande porte.",
      ],
      correta: 1,
      exp: "RASCUNHO — reescreva com a afirmação específica do assunto.",
    },
  ];

  return Array.from({ length: qtd }, (_, i) => moldes[i % moldes.length]).map((m) => ({
    enunciado: m.p,
    alternativas: m.alts.map((texto, i) => ({ id: LETRAS[i], texto })),
    correta: LETRAS[m.correta],
    explicacao: m.exp,
  }));
}

/* --------------------------------------------------------------- rota --- */
export async function POST(req: Request) {
  let entrada: Entrada;
  try {
    entrada = (await req.json()) as Entrada;
  } catch {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }

  if (!entrada?.area?.trim() || !entrada?.assunto?.trim()) {
    return NextResponse.json(
      { erro: "Escolha a área e o assunto antes de gerar." },
      { status: 400 }
    );
  }

  const qtd = Math.min(Math.max(entrada.quantidade ?? 5, 1), 15);

  // Fluxo próprio quando existir. O `tino-questoes` original valida `titulo`
  // e recusa a chamada do banco, que não tem aula nenhuma — por isso a
  // variável separada, com o antigo como reserva.
  const webhook =
    process.env.N8N_QUESTOES_BANCO_WEBHOOK_URL || process.env.N8N_QUESTOES_WEBHOOK_URL;
  const chave = process.env.ANTHROPIC_API_KEY;

  let diagnostico: string | null = null;

  if (webhook) {
    const r = await viaN8N(webhook, entrada, qtd);
    if (r.ok) return NextResponse.json({ questoes: r.questoes, fonte: "n8n" });
    diagnostico = DIAGNOSTICO[r.motivo];
    console.warn("[gerar-questoes-banco] n8n falhou:", r.motivo, r.detalhe ?? "");
  }

  if (chave) {
    const q = await viaAnthropic(chave, entrada, qtd);
    if (q) return NextResponse.json({ questoes: q, fonte: "anthropic" });
    console.warn("[gerar-questoes-banco] Anthropic falhou, caindo no rascunho local");
  }

  return NextResponse.json({
    questoes: rascunho(entrada, qtd),
    fonte: "rascunho",
    aviso:
      (diagnostico ??
        "Nenhuma fonte de IA configurada: preencha N8N_QUESTOES_BANCO_WEBHOOK_URL ou ANTHROPIC_API_KEY.") +
      " O lote abaixo é um rascunho local, sem IA — reescreva antes de publicar.",
  });
}
