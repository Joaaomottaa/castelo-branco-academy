/* ==========================================================================
   SIMULAÇÃO DE PAGAMENTO

   Nenhum gateway está ligado. O que existe aqui gera artefatos com o
   FORMATO correto — payload EMV do Pix com CRC16 válido, linha digitável de
   boleto com 47 dígitos e dígitos verificadores calculados — para a tela ter
   a aparência e o comportamento do produto final.

   O que é falso: a chave Pix, o código do banco e o fato de ninguém receber
   dinheiro. A tela diz isso em todo lugar onde o número aparece.

   Quando o gateway entrar, estas funções somem: o payload e a linha vêm
   prontos da API do provedor.
   ========================================================================== */

/* --------------------------------------------------------------- Pix ---- */

/** CRC16-CCITT (polinômio 0x1021), exigido no fim do payload EMV do Pix. */
function crc16(texto: string): string {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Campo no formato EMV: id + tamanho com 2 dígitos + valor. */
function campo(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, "0") + valor;
}

function semAcento(t: string): string {
  return t.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
}

/**
 * Monta um BR Code (Pix copia e cola) com a estrutura oficial do Banco Central.
 * A chave é de demonstração — o formato, não.
 */
export function gerarPixCopiaECola(opcoes: {
  chave: string;
  nome: string;
  cidade: string;
  valor: number;
  identificador: string;
}): string {
  const merchant =
    campo("00", "br.gov.bcb.pix") + campo("01", opcoes.chave);

  const payload =
    campo("00", "01") +
    campo("26", merchant) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", opcoes.valor.toFixed(2)) +
    campo("58", "BR") +
    campo("59", semAcento(opcoes.nome).slice(0, 25)) +
    campo("60", semAcento(opcoes.cidade).slice(0, 15)) +
    campo("62", campo("05", opcoes.identificador.slice(0, 25))) +
    "6304";

  return payload + crc16(payload);
}

/**
 * Matriz para desenhar o QR. **Não é um QR code legível** — é uma
 * representação visual derivada do payload, com os três marcadores de
 * posicionamento no lugar certo. Ler com o celular não leva a lugar nenhum, e
 * a tela avisa isso.
 *
 * Gerar QR de verdade exigiria um codificador Reed-Solomon completo; não vale
 * o peso enquanto não há gateway.
 */
export function matrizVisualQR(payload: string, lado = 29): boolean[][] {
  const m: boolean[][] = Array.from({ length: lado }, () => Array(lado).fill(false));

  // Marcadores de posicionamento (7×7) nos três cantos.
  const marcador = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const borda = x === 0 || x === 6 || y === 0 || y === 6;
        const centro = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        m[oy + y][ox + x] = borda || centro;
      }
    }
  };
  marcador(0, 0);
  marcador(lado - 7, 0);
  marcador(0, lado - 7);

  // Módulos derivados do payload, determinísticos.
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  const reservado = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= lado - 8 && y < 8) || (x < 8 && y >= lado - 8);

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      if (reservado(x, y)) continue;
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      m[y][x] = (h & 1) === 1;
    }
  }

  // Faixas de temporização, como num QR real.
  for (let i = 8; i < lado - 8; i++) {
    m[6][i] = i % 2 === 0;
    m[i][6] = i % 2 === 0;
  }

  return m;
}

/* ------------------------------------------------------------ boleto ---- */

/** Módulo 10 — dígito verificador de cada campo da linha digitável. */
function modulo10(bloco: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = bloco.length - 1; i >= 0; i--) {
    let p = Number(bloco[i]) * peso;
    if (p > 9) p -= 9;
    soma += p;
    peso = peso === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

function pontos(valor: number): string {
  return String(Math.round(valor * 100)).padStart(10, "0");
}

/** Dias entre 07/10/1997 (data base da FEBRABAN) e o vencimento. */
function fatorVencimento(vencimento: Date): string {
  const base = new Date(1997, 9, 7);
  const dias = Math.round((vencimento.getTime() - base.getTime()) / 86400000);
  return String(dias % 10000).padStart(4, "0");
}

export interface Boleto {
  linhaDigitavel: string;
  vencimento: Date;
  valor: number;
  beneficiario: string;
}

/**
 * Linha digitável com 47 dígitos e os cinco dígitos verificadores calculados
 * pelo módulo 10, como manda o padrão. Banco e agência são de demonstração.
 */
export function gerarBoleto(valor: number, diasParaVencer = 3): Boleto {
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + diasParaVencer);

  const banco = "001";      // demonstração
  const moeda = "9";
  const campoLivre = "0000012345678901234567890".slice(0, 25);
  const fator = fatorVencimento(vencimento);
  const valorFmt = pontos(valor);

  const c1 = banco + moeda + campoLivre.slice(0, 5);
  const c2 = campoLivre.slice(5, 15);
  const c3 = campoLivre.slice(15, 25);
  const dvGeral = modulo10(banco + moeda + fator + valorFmt);

  const fmt = (b: string, dv: number, corte: number) =>
    `${b.slice(0, corte)}.${b.slice(corte)}${dv}`;

  return {
    linhaDigitavel: [
      fmt(c1, modulo10(c1), 5),
      fmt(c2, modulo10(c2), 5),
      fmt(c3, modulo10(c3), 5),
      String(dvGeral),
      fator + valorFmt,
    ].join(" "),
    vencimento,
    valor,
    beneficiario: "Castelo Branco Contabilidade Avançada",
  };
}

/* ------------------------------------------------------------- cartão --- */

/** Detecta a bandeira pelo início do número. Puramente cosmético. */
export function bandeiraDoCartao(numero: string): string {
  const n = numero.replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "American Express";
  if (/^(4011|4312|4389|5041|6277|6362|6363|650|651|655)/.test(n)) return "Elo";
  if (/^(38|60)/.test(n)) return "Hipercard";
  return "";
}

export function formatarCartao(v: string): string {
  return v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function formatarValidade(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 4);
  return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
}

export function formatarCPF(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 11);
  return n
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
