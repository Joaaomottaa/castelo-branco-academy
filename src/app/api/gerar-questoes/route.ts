import { NextResponse } from "next/server";

/* ==========================================================================
   GERAÇÃO DE QUESTÕES DA AULA

   O admin preenche título, descrição e nível da aula e clica em "Gerar
   perguntas". Esta rota devolve 5 questões de múltipla escolha (A–D) com
   gabarito e explicação. O admin revisa, corrige o que quiser e confirma —
   só então elas vão para o banco.

   Três caminhos, nesta ordem:

   1. n8n        — se N8N_QUESTOES_WEBHOOK_URL estiver preenchida. É o caminho
                   recomendado: o prompt fica editável sem mexer em código.
   2. Anthropic  — se ANTHROPIC_API_KEY existir. Serve para desenvolver sem
                   subir o n8n.
   3. Rascunho   — modelo local. Não é IA: monta um esqueleto a partir do tema
                   para o admin escrever por cima. Existe para a demonstração
                   nunca travar por falta de configuração.
   ========================================================================== */

export const runtime = "nodejs";
export const maxDuration = 60;

const TEMPO_LIMITE_MS = 45_000;

interface Alternativa {
  id: string;
  texto: string;
}

interface QuestaoGerada {
  enunciado: string;
  alternativas: Alternativa[];
  correta: string;
  explicacao?: string;
}

interface Entrada {
  titulo: string;
  descricao?: string;
  nivel?: string;
  curso?: string;
  modulo?: string;
  categoria?: string;
  quantidade?: number;
}

/* ------------------------------------------------------------- prompt --- */
const SISTEMA =
  "Você monta avaliações para a Castelo Branco Academy, escola de contabilidade " +
  "da Castelo Branco Contabilidade Avançada (Feira de Santana/BA). " +
  "Responda SEMPRE com JSON válido, sem cerca de código e sem comentário.";

function montarPrompt(e: Entrada, qtd: number): string {
  const nivel = e.nivel || "Iniciante";

  const calibragem: Record<string, string> = {
    Iniciante:
      "Cobre definição, finalidade e o passo básico da rotina. O distrator deve ser um engano comum de quem está começando, nunca uma pegadinha de redação.",
    Intermediário:
      "Cobre aplicação em situação concreta do escritório. Peça o porquê da decisão, não só o nome do conceito. O distrator deve ser plausível para quem sabe a teoria mas nunca executou.",
    Avançado:
      "Cobre exceção, conflito de regra e consequência de escolher errado. O distrator deve ser a resposta certa em outro contexto — o que separa quem domina de quem decorou.",
  };

  return `Você monta avaliações para a Castelo Branco Academy, escola de contabilidade
da Castelo Branco Contabilidade Avançada (Feira de Santana/BA), especializada em
tributário, transporte, logística e comércio exterior.

Gere exatamente ${qtd} questões de múltipla escolha sobre a aula abaixo.

AULA
Curso: ${e.curso || "não informado"}
Módulo: ${e.modulo || "não informado"}
Título: ${e.titulo}
Descrição: ${e.descricao || "não informada"}
Área: ${e.categoria || "Contabilidade"}
Nível: ${nivel}

CALIBRAGEM PARA O NÍVEL ${nivel.toUpperCase()}
${calibragem[nivel] ?? calibragem.Iniciante}

REGRAS
1. Quatro alternativas por questão, com ids "a", "b", "c" e "d".
2. Uma única correta. Varie qual letra é a certa entre as questões.
3. Todas as alternativas com comprimento parecido. A mais longa não pode ser
   sempre a correta — é o vício que ensina o aluno a chutar por formato.
4. Nada de "todas as anteriores", "nenhuma das anteriores" ou negativa dupla.
5. Enunciado direto, no máximo três linhas, em português brasileiro.
6. A explicação diz por que a correta está certa E por que o erro mais provável
   está errado. Duas a quatro linhas.
7. Se a descrição da aula for vaga, use o conhecimento contábil brasileiro
   corrente sobre o título. Não invente número, prazo ou artigo de lei
   específico que você não tenha certeza.
8. Nada de pergunta sobre a própria plataforma, sobre o instrutor ou sobre a
   duração da aula. O conteúdo é o tema.

Responda APENAS com JSON válido, sem cerca de código e sem comentário:
{"questoes":[{"enunciado":"...","alternativas":[{"id":"a","texto":"..."},{"id":"b","texto":"..."},{"id":"c","texto":"..."},{"id":"d","texto":"..."}],"correta":"b","explicacao":"..."}]}`;
}

/* ------------------------------------------------------- normalização --- */
/** O modelo às vezes devolve o JSON cercado por texto. Isola o objeto. */
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

const LETRAS = ["a", "b", "c", "d"];

/**
 * Aceita só o que dá para usar. Uma questão sem gabarito válido ou com menos
 * de duas alternativas é pior que questão nenhuma — o admin não perceberia.
 */
function validar(bruto: unknown): QuestaoGerada[] {
  const raiz = bruto as { questoes?: unknown } | unknown[];
  const lista = Array.isArray(raiz) ? raiz : (raiz?.questoes as unknown[]) ?? [];
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
        const texto = typeof o?.texto === "string" ? o.texto.trim() : typeof a === "string" ? a : "";
        const id = typeof o?.id === "string" && LETRAS.includes(o.id.toLowerCase())
          ? o.id.toLowerCase()
          : LETRAS[i];
        return texto && id ? { id, texto } : null;
      })
      .filter((a): a is Alternativa => Boolean(a))
      .slice(0, 4);

    if (alternativas.length < 2) continue;

    const correta = typeof q.correta === "string" ? q.correta.trim().toLowerCase() : "";
    if (!alternativas.some((a) => a.id === correta)) continue;

    ok.push({
      enunciado,
      alternativas,
      correta,
      explicacao: typeof q.explicacao === "string" ? q.explicacao.trim() : undefined,
    });
  }
  return ok;
}

/* ------------------------------------------------------------- fontes --- */
/**
 * O modo de falha mais comum do n8n é silencioso: quando a execução para antes
 * do nó "Respond to Webhook" — credencial faltando no nó Claude, por exemplo —
 * ele devolve 200 com corpo vazio. Distinguir isso de "variável não
 * configurada" muda completamente onde a pessoa vai procurar o problema.
 */
type TentativaN8N =
  | { ok: true; questoes: QuestaoGerada[] }
  | { ok: false; motivo: "vazio" | "http" | "invalido" | "rede" };

async function viaN8N(url: string, e: Entrada, qtd: number): Promise<TentativaN8N> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Serve tanto o fluxo dedicado (que lê `tipo` e monta o prompt) quanto
      // a ponte de IA (que lê `system`/`user` e só repassa ao modelo).
      body: JSON.stringify({
        tipo: "gerar_questoes",
        quantidade: qtd,
        ...e,
        system: SISTEMA,
        user: montarPrompt(e, qtd),
        max_tokens: 3000,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) return { ok: false, motivo: "http" };

    const texto = await r.text();
    if (!texto.trim()) return { ok: false, motivo: "vazio" };

    let bruto: unknown;
    try {
      bruto = JSON.parse(texto);
    } catch {
      bruto = extrairJSON(texto);
    }

    // Aceita { questoes: [...] }, { resposta: "<json>" } ou o array cru.
    const raiz = bruto as { resposta?: unknown } | null;
    const alvo = typeof raiz?.resposta === "string" ? extrairJSON(raiz.resposta) : bruto;
    const questoes = validar(alvo);
    return questoes.length ? { ok: true, questoes } : { ok: false, motivo: "invalido" };
  } catch {
    return { ok: false, motivo: "rede" };
  } finally {
    clearTimeout(t);
  }
}

const DIAGNOSTICO: Record<string, string> = {
  vazio:
    "O fluxo do n8n respondeu 200 com corpo vazio — é o que acontece quando a execução para antes do nó “Respond to Webhook”. Quase sempre é a credencial da Anthropic não selecionada no nó Claude. Abra o workflow, escolha a credencial, salve e ative.",
  http: "O n8n respondeu com erro HTTP. Confira se o workflow está ativo e se a URL termina em /webhook/ (e não /webhook-test/).",
  invalido:
    "O n8n respondeu, mas sem nenhuma questão válida. Veja a última execução no n8n.",
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
        max_tokens: 3000,
        messages: [{ role: "user", content: montarPrompt(e, qtd) }],
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.error("[gerar-questoes] Anthropic respondeu", r.status);
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
 * Rascunho local. Deixa explícito que precisa ser reescrito — não tenta
 * parecer conteúdo pronto, porque questão ruim publicada é pior que ausência
 * de questão.
 */
function rascunho(e: Entrada, qtd: number): QuestaoGerada[] {
  const tema = e.titulo.trim();
  const moldes: Array<{ p: string; alts: string[]; correta: number; exp: string }> = [
    {
      p: `Qual é o objetivo central de "${tema}" na rotina do escritório?`,
      alts: [
        "Cumprir a obrigação acessória no prazo, sem análise do impacto.",
        "Sustentar a decisão com documento e reduzir o risco de autuação.",
        "Reduzir o número de lançamentos contábeis do período.",
        "Transferir a responsabilidade técnica para o cliente.",
      ],
      correta: 1,
      exp: "Reescreva com o objetivo real desta aula. O padrão da Academy é ligar o conteúdo à decisão que ele sustenta.",
    },
    {
      p: `Em "${tema}", qual erro aparece com mais frequência na operação?`,
      alts: [
        "Registrar a operação sem conferir o documento que a sustenta.",
        "Arquivar o documento fiscal em ordem cronológica.",
        "Conciliar o razão contábil no fechamento mensal.",
        "Revisar a classificação antes de transmitir a obrigação.",
      ],
      correta: 0,
      exp: "Troque pelo erro que o instrutor cita na aula. O erro concreto é o que fixa o conteúdo.",
    },
    {
      p: `Que documento comprova o que foi tratado em "${tema}"?`,
      alts: [
        "O contrato firmado entre as partes.",
        "O comprovante de pagamento bancário.",
        "O documento fiscal eletrônico correspondente à operação.",
        "O e-mail de confirmação do cliente.",
      ],
      correta: 2,
      exp: "Ajuste para o documento que a aula indica.",
    },
    {
      p: `Qual é a consequência de aplicar "${tema}" de forma incorreta?`,
      alts: [
        "Perda automática do regime tributário.",
        "Formação de passivo oculto, identificado só na fiscalização.",
        "Bloqueio imediato da inscrição estadual.",
        "Suspensão do certificado digital da empresa.",
      ],
      correta: 1,
      exp: "Confirme a consequência que se aplica a este tema.",
    },
    {
      p: `Sobre "${tema}", qual afirmação está correta?`,
      alts: [
        "A regra vale igualmente para todos os regimes tributários.",
        "A aplicação depende do regime e da atividade da empresa.",
        "A norma foi revogada e não tem mais efeito prático.",
        "O tema só interessa a empresas de grande porte.",
      ],
      correta: 1,
      exp: "Reescreva com a afirmação específica da aula.",
    },
  ];

  return moldes.slice(0, qtd).map((m) => ({
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

  if (!entrada?.titulo?.trim()) {
    return NextResponse.json(
      { erro: "Informe ao menos o título da aula para gerar as questões." },
      { status: 400 }
    );
  }

  const qtd = Math.min(Math.max(entrada.quantidade ?? 5, 1), 10);
  const webhook = process.env.N8N_QUESTOES_WEBHOOK_URL;
  const chave = process.env.ANTHROPIC_API_KEY;

  let diagnostico: string | null = null;

  if (webhook) {
    const r = await viaN8N(webhook, entrada, qtd);
    if (r.ok) return NextResponse.json({ questoes: r.questoes, fonte: "n8n" });
    diagnostico = DIAGNOSTICO[r.motivo];
    console.warn("[gerar-questoes] n8n falhou:", r.motivo);
  }

  if (chave) {
    const q = await viaAnthropic(chave, entrada, qtd);
    if (q) return NextResponse.json({ questoes: q, fonte: "anthropic" });
    console.warn("[gerar-questoes] Anthropic falhou, caindo no rascunho local");
  }

  return NextResponse.json({
    questoes: rascunho(entrada, qtd),
    fonte: "rascunho",
    aviso:
      (diagnostico ??
        "Nenhuma fonte de IA configurada: preencha N8N_QUESTOES_WEBHOOK_URL ou ANTHROPIC_API_KEY.") +
      " O lote abaixo é um rascunho local, sem IA — reescreva antes de publicar.",
  });
}
