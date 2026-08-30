import { NextResponse } from "next/server";

/* ==========================================================================
   FEEDBACK DO TINO SOBRE UM SIMULADO

   Recebe o que o aluno acertou e errou — assunto, nível e o enunciado de cada
   questão — e devolve um plano de estudo curto.

   O que faz esta análise valer mais que o percentual: o número diz "58%", o
   texto diz "você acerta conceito e erra prazo". A segunda frase muda o que a
   pessoa estuda amanhã.

   A ordem das fontes é diferente das outras rotas, de propósito:

   1. N8N_FEEDBACK_WEBHOOK_URL — fluxo dedicado, se alguém criar um.
   2. ANTHROPIC_API_KEY — chamada direta, para desenvolver.
   3. N8N_WEBHOOK_URL — o fluxo do próprio Tino, com a análise inteira dentro
      da mensagem. Ele já está conectado e já conhece a escola; mandar a
      pergunta pronta para ele é melhor que exigir mais um workflow.
   4. Análise local por regras.

   O que NÃO se faz aqui é mandar para o fluxo de dúvidas da aula: ele espera
   contexto de aula e responderia fora do assunto. Foi exatamente esse tipo de
   confusão que fez o gerador de questões do banco cair no fluxo da aula e
   responder "O título da aula é obrigatório".

   A reserva local NÃO é IA e não finge ser: ela agrupa os erros por assunto e
   nível, que já é a parte mais acionável do diagnóstico.
   ========================================================================== */

export const runtime = "nodejs";
export const maxDuration = 60;

const TEMPO_LIMITE_MS = 45_000;

interface Resposta {
  enunciado: string;
  area: string;
  assunto: string;
  nivel: string;
  acertou: boolean;
  textoCorreta?: string;
}

interface Entrada {
  nome?: string;
  total: number;
  acertos: number;
  respostas: Resposta[];
}

/* ------------------------------------------------------------- prompt --- */
const SISTEMA =
  "Você é o Tino, assistente da Castelo Branco Academy. Escreva em português " +
  "do Brasil, direto, tratando quem lê como profissional de contabilidade.";

function montarPrompt(e: Entrada): string {
  const pct = e.total ? Math.round((e.acertos / e.total) * 100) : 0;
  const erradas = e.respostas.filter((r) => !r.acertou);
  const certas = e.respostas.filter((r) => r.acertou);

  const lista = (rs: Resposta[]) =>
    rs.length
      ? rs
          .map((r) => `- [${r.area} · ${r.assunto} · ${r.nivel}] ${r.enunciado}`)
          .join("\n")
      : "(nenhuma)";

  return `Você é o Tino, assistente da Castelo Branco Academy — escola de contabilidade
da Castelo Branco Contabilidade Avançada (Feira de Santana/BA), especializada em
tributário, transporte, logística e comércio exterior.

Um aluno acabou de fazer um simulado. Escreva a análise dele.

RESULTADO
Simulado: ${e.nome || "sem nome"}
Acertos: ${e.acertos} de ${e.total} (${pct}%)

QUESTÕES QUE ELE ERROU (${erradas.length})
${lista(erradas)}

QUESTÕES QUE ELE ACERTOU (${certas.length})
${lista(certas)}

COMO ESCREVER
1. Comece pelo diagnóstico em uma frase: o padrão que os erros mostram. Se
   todos os erros são do mesmo assunto, diga o assunto. Se são do mesmo nível,
   diga o nível. Se não há padrão, diga que não há e trate caso a caso.
2. Depois, no máximo três pontos concretos do que estudar, em ordem de
   prioridade. Cada ponto começa com o assunto em negrito.
3. Feche com uma frase de próximo passo prático dentro da plataforma
   (rever um curso da área, refazer o simulado, montar caderno do assunto).
4. Português brasileiro, direto, sem elogio vazio e sem "parabéns pela
   dedicação". Trate a pessoa como profissional.
5. No máximo 200 palavras. Use **negrito** para os assuntos.
6. Não invente número, prazo ou artigo de lei. Fale de conceito e de onde
   estudar, não de legislação específica que você não tenha certeza.
7. Se o aproveitamento passou de 85%, diga isso sem enrolação e aponte o
   próximo nível — não invente defeito para ter o que dizer.

Responda apenas com o texto da análise.`;
}

/* ------------------------------------------------------------- fontes --- */
async function viaN8N(url: string, e: Entrada, comoChat = false) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
  try {
    // No fluxo do assistente a análise viaja como mensagem: é o campo que
    // aquele workflow sabe ler.
    // `mensagem` serve o fluxo do assistente; `system`/`user` servem a ponte
    // de IA. Mandar os dois deixa a escolha do fluxo na variável de ambiente.
    const prompt = montarPrompt(e);
    const corpo = comoChat
      ? { tipo: "chat", mensagem: prompt, historico: [], system: SISTEMA, user: prompt, max_tokens: 900 }
      : { tipo: "feedback_simulado", ...e, system: SISTEMA, user: prompt, max_tokens: 900 };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const bruto = await r.json();
    const texto = bruto?.resposta ?? bruto?.feedback ?? bruto?.texto;
    return typeof texto === "string" && texto.trim() ? texto.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function viaAnthropic(chave: string, e: Entrada) {
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
        max_tokens: 900,
        messages: [{ role: "user", content: montarPrompt(e) }],
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.error("[feedback-simulado] Anthropic respondeu", r.status);
      return null;
    }
    const bruto = await r.json();
    const texto = bruto?.content?.[0]?.text;
    return typeof texto === "string" && texto.trim() ? texto.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Análise local por regras. Não é IA e a tela diz isso.
 *
 * Mesmo sem modelo, agrupar os erros por assunto e por nível já responde a
 * pergunta que importa — "onde eu estudo amanhã" —, então vale entregar.
 */
function analiseLocal(e: Entrada): string {
  const pct = e.total ? Math.round((e.acertos / e.total) * 100) : 0;
  const erradas = e.respostas.filter((r) => !r.acertou);

  if (erradas.length === 0) {
    return `Você acertou as ${e.total} questões deste simulado. Não há o que corrigir aqui — o próximo passo é subir o nível: monte um simulado só com questões **Avançado** da mesma área e veja se o resultado se mantém.`;
  }

  const porAssunto = new Map<string, { erros: number; area: string }>();
  const porNivel = new Map<string, number>();
  for (const r of erradas) {
    const a = porAssunto.get(r.assunto) ?? { erros: 0, area: r.area };
    a.erros += 1;
    porAssunto.set(r.assunto, a);
    porNivel.set(r.nivel, (porNivel.get(r.nivel) ?? 0) + 1);
  }

  const ranking = [...porAssunto.entries()].sort((a, b) => b[1].erros - a[1].erros);
  const nivelCritico = [...porNivel.entries()].sort((a, b) => b[1] - a[1])[0];
  const concentrado = ranking[0][1].erros >= Math.ceil(erradas.length * 0.6);

  const abertura = concentrado
    ? `Seus ${erradas.length} erros se concentram em um assunto só: **${ranking[0][0]}**. Isso é boa notícia — é um buraco específico, não uma base fraca.`
    : `Os ${erradas.length} erros estão espalhados por ${ranking.length} assuntos, sem um padrão único. A leitura mais útil é pelo nível: ${nivelCritico[0]} concentra ${nivelCritico[1]} ${nivelCritico[1] === 1 ? "erro" : "erros"}.`;

  const pontos = ranking
    .slice(0, 3)
    .map(
      ([assunto, d]) =>
        `- **${assunto}** (${d.area}) — ${d.erros} ${d.erros === 1 ? "erro" : "erros"}. Revise o curso da área e refaça só este assunto.`
    )
    .join("\n");

  const fecho =
    pct >= 70
      ? "Aproveitamento acima de 70%: a base está de pé. Feche esses pontos e vá para o nível seguinte."
      : "Antes de refazer, passe pelo curso da área — repetir o simulado sem revisar costuma repetir o mesmo erro.";

  return `${abertura}\n\nO que estudar, nesta ordem:\n\n${pontos}\n\n${fecho}\n\n_Análise local, sem IA: o assistente não está conectado neste ambiente._`;
}

/* --------------------------------------------------------------- rota --- */
export async function POST(req: Request) {
  let entrada: Entrada;
  try {
    entrada = (await req.json()) as Entrada;
  } catch {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }

  if (!Array.isArray(entrada?.respostas) || entrada.respostas.length === 0) {
    return NextResponse.json(
      { erro: "Este simulado não guardou as respostas, então não há o que analisar." },
      { status: 400 }
    );
  }

  const dedicado = process.env.N8N_FEEDBACK_WEBHOOK_URL;
  const assistente = process.env.N8N_WEBHOOK_URL;
  const chave = process.env.ANTHROPIC_API_KEY;

  if (dedicado) {
    const texto = await viaN8N(dedicado, entrada);
    if (texto) return NextResponse.json({ feedback: texto, fonte: "n8n" });
  }

  if (chave) {
    const texto = await viaAnthropic(chave, entrada);
    if (texto) return NextResponse.json({ feedback: texto, fonte: "anthropic" });
  }

  if (assistente) {
    const texto = await viaN8N(assistente, entrada, true);
    if (texto) return NextResponse.json({ feedback: texto, fonte: "tino" });
  }

  return NextResponse.json({ feedback: analiseLocal(entrada), fonte: "local" });
}
