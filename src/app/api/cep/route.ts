import { NextResponse } from "next/server";

/**
 * CONSULTA DE CEP
 *
 * Duas fontes gratuitas e sem chave, nesta ordem:
 *
 * 1. BrasilAPI — agrega vários provedores (Correios, ViaCEP, WideNet) e
 *    responde com o primeiro que devolver. É a mais confiável.
 * 2. ViaCEP — a clássica. Entra quando a primeira cai ou não conhece o CEP.
 *
 * A consulta acontece no servidor porque duas coisas quebram no navegador:
 * bloqueadores de conteúdo, que derrubam chamadas para domínios de terceiros,
 * e a diferença de formato entre as duas fontes, que vira `if` na interface.
 * Aqui as duas viram a mesma resposta.
 */

export const runtime = "edge";

interface Endereco {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

function soDigitos(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

async function comTempo(url: string, ms = 6000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

async function pelaBrasilAPI(cep: string): Promise<Endereco | null> {
  try {
    const r = await comTempo(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (!r.ok) return null;
    const d = (await r.json()) as {
      cep?: string; street?: string; neighborhood?: string; city?: string; state?: string;
    };
    if (!d.city) return null;
    return {
      cep: d.cep ?? cep,
      logradouro: d.street ?? "",
      bairro: d.neighborhood ?? "",
      cidade: d.city,
      uf: d.state ?? "",
    };
  } catch {
    return null;
  }
}

async function peloViaCEP(cep: string): Promise<Endereco | null> {
  try {
    const r = await comTempo(`https://viacep.com.br/ws/${cep}/json/`);
    if (!r.ok) return null;
    const d = (await r.json()) as {
      cep?: string; logradouro?: string; bairro?: string;
      localidade?: string; uf?: string; erro?: boolean | string;
    };
    // O ViaCEP responde 200 com `{"erro": true}` para CEP inexistente.
    if (d.erro || !d.localidade) return null;
    return {
      cep: d.cep ?? cep,
      logradouro: d.logradouro ?? "",
      bairro: d.bairro ?? "",
      cidade: d.localidade,
      uf: d.uf ?? "",
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const cep = soDigitos(new URL(req.url).searchParams.get("cep") ?? "");

  if (cep.length !== 8) {
    return NextResponse.json({ erro: "O CEP precisa ter 8 dígitos." }, { status: 400 });
  }

  const achado = (await pelaBrasilAPI(cep)) ?? (await peloViaCEP(cep));

  if (!achado) {
    return NextResponse.json(
      { erro: "CEP não encontrado. Confira os números ou preencha à mão." },
      { status: 200 }
    );
  }

  return NextResponse.json(achado);
}
