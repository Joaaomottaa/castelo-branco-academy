import { NextResponse } from "next/server";

/* ==========================================================================
   DÚVIDA DA AULA RESPONDIDA POR IA

   Recebe a pergunta do aluno junto com o contexto da aula (curso, módulo,
   título, descrição, nível) e devolve uma explicação didática ancorada nesse
   tema — não uma resposta genérica de chatbot.

   Três caminhos, na ordem:
     1. n8n        — N8N_DUVIDAS_WEBHOOK_URL (recomendado: prompt editável)
     2. Anthropic  — ANTHROPIC_API_KEY, para desenvolver sem subir o n8n
     3. Reserva    — resposta honesta que orienta e encaminha, sem inventar
   ========================================================================== */

export const runtime = "nodejs";
export const maxDuration = 60;

const TEMPO_LIMITE_MS = 40_000;

const WHATSAPP =
  "https://api.whatsapp.com/send?phone=557531990707&text=Ol%C3%A1!%20Vim%20pela%20Castelo%20Branco%20Academy.";

interface Entrada {
  pergunta: string;
  aulaTitulo?: string;
  aulaDescricao?: string;
  cursoTitulo?: string;
  moduloTitulo?: string;
  nivel?: string;
  categoria?: string;
}

function montarSystem(e: Entrada): string {
  return `Você é o Tino, assistente de estudos da Castelo Branco Academy — escola da
Castelo Branco Contabilidade Avançada, mais de 20 anos em Feira de Santana/BA,
contabilidade consultiva com foco em transporte, logística, armazenagem e
comércio exterior.

Neste momento você está respondendo uma dúvida DENTRO de uma aula. A pessoa
acabou de assistir e travou em alguma coisa.

A AULA
Curso: ${e.cursoTitulo || "não informado"}
Módulo: ${e.moduloTitulo || "não informado"}
Aula: ${e.aulaTitulo || "não informada"}
Descrição: ${e.aulaDescricao || "não informada"}
Área: ${e.categoria || "Contabilidade"}
Nível da turma: ${e.nivel || "Iniciante"}

COMO RESPONDER
1. Responda a dúvida do jeito que um instrutor bom responderia depois da aula:
   direto ao ponto, com exemplo concreto do dia a dia de escritório contábil.
2. Comece pela resposta. Contexto vem depois, se ajudar. Nada de introdução do
   tipo "ótima pergunta".
3. Calibre pelo nível da turma. Para Iniciante, explique o termo antes de usar.
   Para Avançado, vá direto à exceção e ao risco.
4. Se a pergunta fugir do tema da aula, responda mesmo assim quando for
   contábil — mas diga em uma linha em que aula ou curso o assunto é tratado a
   fundo.
5. Se a pergunta for sobre um caso específico da empresa da pessoa (números,
   contrato, autuação em andamento), responda o que é geral e diga com todas as
   letras que caso concreto precisa de análise: passe o WhatsApp
   ${WHATSAPP}
6. Nunca invente número, prazo, alíquota ou artigo de lei. Se não tiver certeza
   do valor exato, explique o raciocínio e diga onde conferir.
7. Nunca dê parecer tributário definitivo. Você ajuda a entender, não assina.
8. Português brasileiro, natural, sem jargão de vendas e sem emoji.
9. Entre 3 e 8 linhas na maioria das vezes. Use lista só quando a resposta for
   mesmo uma sequência de passos.

O MÉTODO DA CASA
A Castelo Branco trabalha por camadas de segurança, da C1 (pacífico e
documentado) à C4 (crédito inexistente, passivo oculto, decisão sem sustentação
legal). Nunca sugira nada da C4. Se o que a pessoa está pensando em fazer
estiver nessa faixa, diga o risco com clareza e aponte o caminho seguro.`;
}

async function viaN8N(url: string, e: Entrada) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "duvida_aula", ...e }),
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const d = await r.json();
    const texto = d?.resposta ?? d?.output ?? d?.text ?? null;
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
        max_tokens: 1200,
        system: montarSystem(e),
        messages: [{ role: "user", content: e.pergunta }],
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.error("[duvida-ia] Anthropic respondeu", r.status);
      return null;
    }
    const d = await r.json();
    const texto = d?.content?.[0]?.text ?? "";
    return typeof texto === "string" && texto.trim() ? texto.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Reserva. Não tenta fingir que é IA: reconhece a pergunta, situa no tema da
 * aula e encaminha. Resposta honesta é melhor que resposta inventada — ainda
 * mais em matéria tributária.
 */
function reserva(e: Entrada): string {
  const aula = e.aulaTitulo ? `“${e.aulaTitulo}”` : "esta aula";
  return [
    `Sua pergunta foi registrada na aula ${aula}.`,
    "",
    "O assistente com IA ainda não está conectado neste ambiente, então não vou arriscar uma resposta técnica — em matéria tributária, resposta inventada custa caro.",
    "",
    "Enquanto isso, dois caminhos que resolvem na hora:",
    "",
    "1. **Publique no fórum da aula.** Marque a aba “Fórum” ao lado: o instrutor e os colegas respondem, e a resposta fica para quem vier depois.",
    `2. **Caso concreto da sua empresa?** Fale direto com a equipe: [WhatsApp da Castelo Branco](${WHATSAPP}).`,
    "",
    "_Para o administrador: preencha `N8N_DUVIDAS_WEBHOOK_URL` ou `ANTHROPIC_API_KEY` no `.env.local` para ligar a resposta por IA._",
  ].join("\n");
}

export async function POST(req: Request) {
  let e: Entrada;
  try {
    e = (await req.json()) as Entrada;
  } catch {
    return NextResponse.json({ erro: "Corpo inválido" }, { status: 400 });
  }

  const pergunta = (e?.pergunta ?? "").trim();
  if (!pergunta) {
    return NextResponse.json({ erro: "Escreva a sua dúvida." }, { status: 400 });
  }
  if (pergunta.length > 2000) {
    return NextResponse.json(
      { erro: "A dúvida ficou longa demais. Resuma em até 2.000 caracteres." },
      { status: 400 }
    );
  }

  const webhook = process.env.N8N_DUVIDAS_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
  const chave = process.env.ANTHROPIC_API_KEY;

  if (webhook) {
    const r = await viaN8N(webhook, { ...e, pergunta });
    if (r) return NextResponse.json({ resposta: r, fonte: "n8n" });
    console.warn("[duvida-ia] n8n não respondeu, tentando o próximo caminho");
  }

  if (chave) {
    const r = await viaAnthropic(chave, { ...e, pergunta });
    if (r) return NextResponse.json({ resposta: r, fonte: "anthropic" });
    console.warn("[duvida-ia] Anthropic falhou, caindo na reserva");
  }

  return NextResponse.json({ resposta: reserva(e), fonte: "reserva" });
}
