import {
  AFRMM, ANEXOS_SIMPLES, CBS_REFERENCIA, COFINS_CUMULATIVO, COFINS_IMPORTACAO,
  CSLL_ALIQUOTA, FATOR_R_CORTE, FGTS_MENSAL, FGTS_MULTA_RESCISORIA,
  IBS_REFERENCIA, IRPJ_ADICIONAL, IRPJ_ALIQUOTA, IRPJ_LIMITE_MENSAL,
  JORNADA_MENSAL_PADRAO, PIS_CUMULATIVO, PIS_IMPORTACAO, PRESUNCOES,
  TAXA_SISCOMEX, TETO_INSS, TETO_SIMPLES, TRANSICAO, VIGENCIA,
} from "./tabelas";
import {
  brl, calcularINSS, calcularIRRF, cent, data, diasEntre, mesesTrabalhados,
  num, numero, pct, validarCNPJ, validarCPF, type Ferramenta, type Linha,
} from "./nucleo";

/* ==========================================================================
   CATÁLOGO DE FERRAMENTAS

   Cada ferramenta declara seus campos e uma função de cálculo puro. Uma única
   página renderiza qualquer uma delas — acrescentar ferramenta nova é
   acrescentar um objeto aqui, sem tocar em componente.

   Regra que vale para todas: a conta é feita no navegador, sem servidor e sem
   guardar nada. O que a pessoa digita não sai da máquina dela — importa,
   porque isso aqui recebe salário e faturamento de cliente.
   ========================================================================== */

const SIM_NAO = [
  { v: "sim", rotulo: "Sim" },
  { v: "nao", rotulo: "Não" },
];

/* ======================================================================
   TRABALHISTA
   ====================================================================== */

const salarioLiquido: Ferramenta = {
  slug: "salario-liquido",
  nome: "Salário líquido",
  descricao: "Do bruto ao que cai na conta: INSS progressivo, IRRF e descontos.",
  categoria: "Trabalhista",
  icone: "wallet",
  vigencia: `${VIGENCIA.inss} · ${VIGENCIA.irrf}`,
  destaque: true,
  campos: [
    { nome: "bruto", rotulo: "Salário bruto", tipo: "moeda", padrao: "4500" },
    { nome: "dependentes", rotulo: "Dependentes", tipo: "inteiro", padrao: "0" },
    { nome: "pensao", rotulo: "Pensão alimentícia", tipo: "moeda", padrao: "0" },
    { nome: "vt", rotulo: "Desconta vale-transporte (6%)", tipo: "select", opcoes: SIM_NAO, padrao: "nao" },
    { nome: "saude", rotulo: "Plano de saúde", tipo: "moeda", padrao: "0" },
    { nome: "outros", rotulo: "Outros descontos", tipo: "moeda", padrao: "0" },
  ],
  calcular: (v) => {
    const bruto = num(v.bruto);
    if (bruto <= 0) return { linhas: [], erro: "Informe o salário bruto." };

    const inss = calcularINSS(bruto);
    const irrf = calcularIRRF(bruto, inss.contribuicao, num(v.dependentes), num(v.pensao));
    const vt = v.vt === "sim" ? cent(bruto * 0.06) : 0;
    const outros = num(v.saude) + num(v.outros) + num(v.pensao);
    const liquido = cent(bruto - inss.contribuicao - irrf.imposto - vt - outros);

    const linhas: Linha[] = [
      { rotulo: "Salário bruto", valor: brl(bruto) },
      {
        rotulo: "INSS", valor: `− ${brl(inss.contribuicao)}`, estilo: "desconto",
        detalhe: `Alíquota efetiva de ${pct(inss.aliquotaEfetiva)}${inss.tetoAtingido ? " · teto atingido" : ""}`,
      },
      {
        rotulo: "IRRF", valor: `− ${brl(irrf.imposto)}`, estilo: "desconto",
        detalhe: irrf.usouSimplificado
          ? `Desconto simplificado (${brl(irrf.deducoes)}) — mais vantajoso que as deduções legais`
          : `Base ${brl(irrf.base)} · faixa de ${pct(irrf.aliquotaNominal, 1)}`,
      },
    ];
    if (num(v.pensao) > 0) linhas.push({ rotulo: "Pensão alimentícia", valor: `− ${brl(num(v.pensao))}`, estilo: "desconto" });
    if (vt > 0) linhas.push({ rotulo: "Vale-transporte (6%)", valor: `− ${brl(vt)}`, estilo: "desconto" });
    if (num(v.saude) > 0) linhas.push({ rotulo: "Plano de saúde", valor: `− ${brl(num(v.saude))}`, estilo: "desconto" });
    if (num(v.outros) > 0) linhas.push({ rotulo: "Outros descontos", valor: `− ${brl(num(v.outros))}`, estilo: "desconto" });

    linhas.push({ rotulo: "FGTS do mês (depositado, não descontado)", valor: brl(cent(bruto * FGTS_MENSAL)), estilo: "info" });

    return {
      destaque: {
        rotulo: "Salário líquido",
        valor: brl(liquido),
        detalhe: `${pct(1 - liquido / bruto)} de desconto total sobre o bruto`,
      },
      linhas,
      avisos: inss.tetoAtingido
        ? [`O salário passou do teto do INSS (${brl(TETO_INSS)}), então a contribuição travou no máximo.`]
        : undefined,
    };
  },
};

const rescisao: Ferramenta = {
  slug: "rescisao",
  nome: "Rescisão de contrato",
  descricao: "Saldo, aviso, 13º e férias proporcionais, FGTS e multa por motivo de saída.",
  categoria: "Trabalhista",
  icone: "file-x",
  vigencia: `${VIGENCIA.inss} · ${VIGENCIA.irrf}`,
  destaque: true,
  campos: [
    { nome: "salario", rotulo: "Último salário", tipo: "moeda", padrao: "3500" },
    { nome: "admissao", rotulo: "Admissão", tipo: "data", padrao: "2023-03-01" },
    { nome: "saida", rotulo: "Último dia trabalhado", tipo: "data", padrao: "2026-08-20" },
    {
      nome: "motivo", rotulo: "Motivo", tipo: "select", largo: true, padrao: "sem-justa",
      opcoes: [
        { v: "sem-justa", rotulo: "Dispensa sem justa causa" },
        { v: "pedido", rotulo: "Pedido de demissão" },
        { v: "acordo", rotulo: "Acordo (art. 484-A)" },
        { v: "justa", rotulo: "Dispensa por justa causa" },
        { v: "termino", rotulo: "Término de contrato por prazo determinado" },
      ],
    },
    {
      nome: "aviso", rotulo: "Aviso prévio", tipo: "select", padrao: "indenizado",
      opcoes: [
        { v: "indenizado", rotulo: "Indenizado (pago, não trabalhado)" },
        { v: "trabalhado", rotulo: "Trabalhado" },
        { v: "dispensado", rotulo: "Dispensado / não se aplica" },
      ],
    },
    { nome: "feriasVencidas", rotulo: "Tem férias vencidas?", tipo: "select", opcoes: SIM_NAO, padrao: "nao" },
    { nome: "saldoFgts", rotulo: "Saldo do FGTS na conta", tipo: "moeda", padrao: "0", dica: "Para calcular a multa. Deixe 0 para estimar pelo tempo de casa." },
    { nome: "dependentes", rotulo: "Dependentes", tipo: "inteiro", padrao: "0" },
  ],
  calcular: (v) => {
    const salario = num(v.salario);
    const dAdm = data(v.admissao);
    const dSaida = data(v.saida);
    if (salario <= 0) return { linhas: [], erro: "Informe o salário." };
    if (!dAdm || !dSaida) return { linhas: [], erro: "Preencha as duas datas." };
    if (dSaida <= dAdm) return { linhas: [], erro: "A saída precisa ser depois da admissão." };

    const motivo = v.motivo || "sem-justa";
    const anosCompletos = Math.floor(diasEntre(dAdm, dSaida) / 365);

    // Aviso prévio: 30 dias + 3 por ano completo, limitado a 90 (Lei 12.506/2011).
    const diasAviso = Math.min(30 + anosCompletos * 3, 90);
    const temDireitoAviso = motivo === "sem-justa" || motivo === "acordo";
    const avisoIndenizado = v.aviso === "indenizado" && temDireitoAviso;
    const fatorAviso = motivo === "acordo" ? 0.5 : 1;
    const valorAviso = avisoIndenizado ? cent((salario / 30) * diasAviso * fatorAviso) : 0;

    // O aviso indenizado conta como tempo de serviço para 13º e férias.
    const dataProjetada = new Date(dSaida);
    if (avisoIndenizado) dataProjetada.setDate(dataProjetada.getDate() + diasAviso);

    const saldoDias = dSaida.getDate();
    const saldoSalario = cent((salario / 30) * saldoDias);

    const mesesDecimo = Math.min(12, dataProjetada.getMonth() + 1);
    const temDecimo = motivo !== "justa";
    const decimo = temDecimo ? cent((salario / 12) * mesesDecimo) : 0;

    const mesesFerias = mesesTrabalhados(dAdm, dataProjetada) % 12;
    const temFeriasProp = motivo !== "justa";
    const feriasProp = temFeriasProp ? cent((salario / 12) * mesesFerias) : 0;
    const tercoProp = cent(feriasProp / 3);

    const feriasVenc = v.feriasVencidas === "sim" ? salario : 0;
    const tercoVenc = cent(feriasVenc / 3);

    // Verbas com incidência de INSS/IRRF: saldo e 13º. Férias indenizadas e
    // aviso indenizado não sofrem incidência (Súmula 688 do STF / IN RFB).
    const baseInss = saldoSalario;
    const inss = calcularINSS(baseInss);
    const irrf = calcularIRRF(baseInss, inss.contribuicao, num(v.dependentes));

    const inssDecimo = calcularINSS(decimo);
    const irrfDecimo = calcularIRRF(decimo, inssDecimo.contribuicao, num(v.dependentes));

    const bruto = saldoSalario + valorAviso + decimo + feriasProp + tercoProp + feriasVenc + tercoVenc;
    const descontos = inss.contribuicao + irrf.imposto + inssDecimo.contribuicao + irrfDecimo.imposto;

    // Multa do FGTS: 40% sem justa causa, 20% no acordo, nada nos demais.
    const mesesCasa = mesesTrabalhados(dAdm, dSaida);
    const saldoFgts = num(v.saldoFgts) || cent(salario * FGTS_MENSAL * mesesCasa);
    const percMulta = motivo === "sem-justa" ? FGTS_MULTA_RESCISORIA : motivo === "acordo" ? 0.2 : 0;
    const multa = cent(saldoFgts * percMulta);
    const fgtsAviso = avisoIndenizado ? cent(valorAviso * FGTS_MENSAL) : 0;

    const linhas: Linha[] = [
      { rotulo: `Saldo de salário (${saldoDias} dias)`, valor: brl(saldoSalario) },
    ];
    if (valorAviso > 0) {
      linhas.push({
        rotulo: `Aviso prévio indenizado (${diasAviso} dias)`,
        valor: brl(valorAviso),
        detalhe: motivo === "acordo" ? "Metade, por ser acordo do art. 484-A" : `30 dias + 3 por ano completo (${anosCompletos} anos)`,
      });
    }
    if (decimo > 0) linhas.push({ rotulo: `13º proporcional (${mesesDecimo}/12)`, valor: brl(decimo) });
    if (feriasProp > 0) {
      linhas.push({ rotulo: `Férias proporcionais (${mesesFerias}/12)`, valor: brl(feriasProp) });
      linhas.push({ rotulo: "1/3 sobre as proporcionais", valor: brl(tercoProp) });
    }
    if (feriasVenc > 0) {
      linhas.push({ rotulo: "Férias vencidas", valor: brl(feriasVenc) });
      linhas.push({ rotulo: "1/3 sobre as vencidas", valor: brl(tercoVenc) });
    }
    linhas.push({ rotulo: "Total bruto das verbas", valor: brl(cent(bruto)), estilo: "subtotal" });
    linhas.push({ rotulo: "INSS sobre saldo e 13º", valor: `− ${brl(cent(inss.contribuicao + inssDecimo.contribuicao))}`, estilo: "desconto" });
    linhas.push({ rotulo: "IRRF sobre saldo e 13º", valor: `− ${brl(cent(irrf.imposto + irrfDecimo.imposto))}`, estilo: "desconto" });
    linhas.push({
      rotulo: "FGTS estimado na conta", valor: brl(saldoFgts), estilo: "info",
      detalhe: num(v.saldoFgts) ? "Informado por você" : `Estimado: 8% × ${mesesCasa} meses de salário`,
    });
    if (multa > 0) {
      linhas.push({
        rotulo: `Multa do FGTS (${pct(percMulta, 0)})`, valor: brl(multa), estilo: "info",
        detalhe: "Depositada na conta vinculada, não paga no acerto",
      });
    }
    if (fgtsAviso > 0) linhas.push({ rotulo: "FGTS sobre o aviso indenizado", valor: brl(fgtsAviso), estilo: "info" });

    const avisos: string[] = [];
    if (motivo === "justa") avisos.push("Justa causa: sem aviso, sem 13º proporcional, sem férias proporcionais e sem multa do FGTS. Só saldo de salário e férias vencidas, se houver.");
    if (motivo === "pedido") avisos.push("Pedido de demissão: sem multa do FGTS e sem direito a sacar o fundo. Se o aviso não for cumprido, o empregador pode descontar 30 dias.");
    if (motivo === "acordo") avisos.push("Acordo do art. 484-A: metade do aviso, multa de 20%, saque de até 80% do FGTS e sem direito ao seguro-desemprego.");
    avisos.push("Estimativa. O acerto final depende de convenção coletiva, faltas, adicionais habituais e verbas variáveis dos últimos 12 meses.");

    return {
      destaque: {
        rotulo: "Líquido a receber no acerto",
        valor: brl(cent(bruto - descontos)),
        detalhe: multa > 0 ? `Mais ${brl(cent(saldoFgts + multa + fgtsAviso))} liberados no FGTS` : undefined,
      },
      linhas,
      avisos,
    };
  },
};

const ferias: Ferramenta = {
  slug: "ferias",
  nome: "Férias",
  descricao: "Férias com 1/3, abono pecuniário e adiantamento do 13º.",
  categoria: "Trabalhista",
  icone: "palmtree",
  vigencia: `${VIGENCIA.inss} · ${VIGENCIA.irrf}`,
  campos: [
    { nome: "salario", rotulo: "Salário bruto", tipo: "moeda", padrao: "3500" },
    { nome: "dias", rotulo: "Dias de férias", tipo: "inteiro", padrao: "30" },
    { nome: "abono", rotulo: "Vender 1/3 (abono pecuniário)", tipo: "select", opcoes: SIM_NAO, padrao: "nao" },
    { nome: "adiantar13", rotulo: "Adiantar 1ª parcela do 13º", tipo: "select", opcoes: SIM_NAO, padrao: "nao" },
    { nome: "medias", rotulo: "Média de variáveis", tipo: "moeda", padrao: "0", dica: "Horas extras, comissões e adicionais habituais dos últimos 12 meses." },
    { nome: "dependentes", rotulo: "Dependentes", tipo: "inteiro", padrao: "0" },
  ],
  calcular: (v) => {
    const salario = num(v.salario) + num(v.medias);
    const dias = Math.min(30, Math.max(1, num(v.dias)));
    if (salario <= 0) return { linhas: [], erro: "Informe o salário." };

    const valorFerias = cent((salario / 30) * dias);
    const terco = cent(valorFerias / 3);
    const baseTributavel = cent(valorFerias + terco);

    const diasAbono = v.abono === "sim" ? 10 : 0;
    const valorAbono = cent((salario / 30) * diasAbono);
    const tercoAbono = cent(valorAbono / 3);

    const inss = calcularINSS(baseTributavel);
    const irrf = calcularIRRF(baseTributavel, inss.contribuicao, num(v.dependentes));
    const adiantamento = v.adiantar13 === "sim" ? cent(salario / 2) : 0;

    const liquido = cent(baseTributavel - inss.contribuicao - irrf.imposto + valorAbono + tercoAbono + adiantamento);

    const linhas: Linha[] = [
      { rotulo: `Férias (${dias} dias)`, valor: brl(valorFerias) },
      { rotulo: "1/3 constitucional", valor: brl(terco) },
      { rotulo: "Base tributável", valor: brl(baseTributavel), estilo: "subtotal" },
      { rotulo: "INSS", valor: `− ${brl(inss.contribuicao)}`, estilo: "desconto" },
      { rotulo: "IRRF", valor: `− ${brl(irrf.imposto)}`, estilo: "desconto" },
    ];
    if (valorAbono > 0) {
      linhas.push({
        rotulo: "Abono pecuniário (10 dias vendidos)", valor: brl(valorAbono),
        detalhe: "Isento de INSS e IRRF",
      });
      linhas.push({ rotulo: "1/3 sobre o abono", valor: brl(tercoAbono) });
    }
    if (adiantamento > 0) {
      linhas.push({
        rotulo: "Adiantamento do 13º (50%)", valor: brl(adiantamento),
        detalhe: "Antecipação: será descontada na 2ª parcela, em dezembro",
      });
    }

    return {
      destaque: { rotulo: "Líquido das férias", valor: brl(liquido) },
      linhas,
      avisos: [
        "As férias devem ser pagas até 2 dias antes do início do gozo — atraso gera pagamento em dobro (art. 137 da CLT).",
        v.abono === "sim"
          ? "Ao vender 10 dias, a pessoa goza 20 e recebe 30 + o abono."
          : "Vender 1/3 das férias é opção do empregado, requerida até 15 dias antes do fim do período aquisitivo.",
      ],
    };
  },
};

const decimoTerceiro: Ferramenta = {
  slug: "decimo-terceiro",
  nome: "13º salário",
  descricao: "Primeira e segunda parcela, com INSS e IRRF só na segunda.",
  categoria: "Trabalhista",
  icone: "gift",
  vigencia: `${VIGENCIA.inss} · ${VIGENCIA.irrf}`,
  campos: [
    { nome: "salario", rotulo: "Salário bruto de dezembro", tipo: "moeda", padrao: "3500" },
    { nome: "meses", rotulo: "Meses trabalhados no ano", tipo: "inteiro", padrao: "12", dica: "Conta o mês com 15 dias ou mais de trabalho." },
    { nome: "medias", rotulo: "Média de variáveis", tipo: "moeda", padrao: "0" },
    { nome: "dependentes", rotulo: "Dependentes", tipo: "inteiro", padrao: "0" },
  ],
  calcular: (v) => {
    const salario = num(v.salario) + num(v.medias);
    const meses = Math.min(12, Math.max(0, num(v.meses)));
    if (salario <= 0) return { linhas: [], erro: "Informe o salário." };

    const bruto = cent((salario / 12) * meses);
    const primeira = cent(bruto / 2);
    const inss = calcularINSS(bruto);
    const irrf = calcularIRRF(bruto, inss.contribuicao, num(v.dependentes));
    const segunda = cent(bruto - primeira - inss.contribuicao - irrf.imposto);

    return {
      destaque: {
        rotulo: "13º líquido no ano",
        valor: brl(cent(primeira + segunda)),
        detalhe: `${brl(primeira)} até 30/11 e ${brl(segunda)} até 20/12`,
      },
      linhas: [
        { rotulo: `13º bruto (${meses}/12)`, valor: brl(bruto) },
        { rotulo: "1ª parcela (até 30 de novembro)", valor: brl(primeira), detalhe: "Metade do bruto, sem nenhum desconto" },
        { rotulo: "INSS sobre o total", valor: `− ${brl(inss.contribuicao)}`, estilo: "desconto" },
        { rotulo: "IRRF sobre o total", valor: `− ${brl(irrf.imposto)}`, estilo: "desconto" },
        { rotulo: "2ª parcela (até 20 de dezembro)", valor: brl(segunda), estilo: "subtotal" },
        { rotulo: "FGTS sobre o 13º", valor: brl(cent(bruto * FGTS_MENSAL)), estilo: "info" },
      ],
      avisos: [
        "Os descontos de INSS e IRRF incidem sobre o valor cheio do 13º, mas são retidos só na segunda parcela — por isso ela vem bem menor que a primeira.",
        "O 13º é tributado separadamente do salário do mês, em recolhimento próprio.",
      ],
    };
  },
};

const horasExtras: Ferramenta = {
  slug: "horas-extras",
  nome: "Horas extras e DSR",
  descricao: "Adicional de 50% e 100% com o reflexo no descanso semanal remunerado.",
  categoria: "Trabalhista",
  icone: "clock",
  campos: [
    { nome: "salario", rotulo: "Salário base", tipo: "moeda", padrao: "3000" },
    { nome: "jornada", rotulo: "Jornada mensal (horas)", tipo: "numero", padrao: "220", dica: "220h para 44h semanais; 200h para 40h." },
    { nome: "he50", rotulo: "Horas extras a 50%", tipo: "numero", padrao: "10" },
    { nome: "he100", rotulo: "Horas extras a 100%", tipo: "numero", padrao: "0", dica: "Domingos e feriados." },
    { nome: "uteis", rotulo: "Dias úteis no mês", tipo: "inteiro", padrao: "25" },
    { nome: "descanso", rotulo: "Domingos e feriados no mês", tipo: "inteiro", padrao: "5" },
    { nome: "noturno", rotulo: "Horas noturnas (adicional 20%)", tipo: "numero", padrao: "0" },
  ],
  calcular: (v) => {
    const salario = num(v.salario);
    const jornada = num(v.jornada) || JORNADA_MENSAL_PADRAO;
    if (salario <= 0) return { linhas: [], erro: "Informe o salário base." };

    const valorHora = cent(salario / jornada);
    const v50 = cent(valorHora * 1.5 * num(v.he50));
    const v100 = cent(valorHora * 2 * num(v.he100));
    const totalHE = cent(v50 + v100);

    const uteis = Math.max(1, num(v.uteis));
    const dsr = cent((totalHE / uteis) * num(v.descanso));
    const noturno = cent(valorHora * 0.2 * num(v.noturno));

    return {
      destaque: {
        rotulo: "Total a receber",
        valor: brl(cent(totalHE + dsr + noturno)),
        detalhe: `Valor da hora normal: ${brl(valorHora)}`,
      },
      linhas: [
        { rotulo: "Valor da hora normal", valor: brl(valorHora), detalhe: `${brl(salario)} ÷ ${numero(jornada, 0)}h` },
        { rotulo: `Horas extras a 50% (${numero(num(v.he50), 1)}h)`, valor: brl(v50) },
        { rotulo: `Horas extras a 100% (${numero(num(v.he100), 1)}h)`, valor: brl(v100) },
        { rotulo: "Subtotal de horas extras", valor: brl(totalHE), estilo: "subtotal" },
        {
          rotulo: "Reflexo no DSR", valor: brl(dsr),
          detalhe: `${brl(totalHE)} ÷ ${uteis} dias úteis × ${num(v.descanso)} de descanso`,
        },
        { rotulo: "Adicional noturno (20%)", valor: brl(noturno) },
        { rotulo: "FGTS sobre o total", valor: brl(cent((totalHE + dsr + noturno) * FGTS_MENSAL)), estilo: "info" },
      ],
      avisos: [
        "O DSR sobre horas extras é obrigatório (Lei 605/49, Súmula 172 do TST) e é o item mais esquecido na folha.",
        "Hora extra habitual repercute em férias, 13º, aviso e FGTS — some ao cálculo dessas verbas.",
      ],
    };
  },
};

/* ======================================================================
   TRIBUTÁRIO
   ====================================================================== */

const simplesNacional: Ferramenta = {
  slug: "simples-nacional",
  nome: "Simples Nacional — DAS",
  descricao: "Alíquota efetiva pela receita dos 12 meses e valor do DAS.",
  categoria: "Tributário",
  icone: "receipt",
  vigencia: VIGENCIA.simples,
  destaque: true,
  campos: [
    { nome: "rbt12", rotulo: "Receita dos últimos 12 meses (RBT12)", tipo: "moeda", padrao: "900000" },
    { nome: "receita", rotulo: "Receita do mês", tipo: "moeda", padrao: "80000" },
    {
      nome: "anexo", rotulo: "Anexo", tipo: "select", largo: true, padrao: "III",
      opcoes: Object.entries(ANEXOS_SIMPLES).map(([k, a]) => ({ v: k, rotulo: a.nome })),
    },
  ],
  calcular: (v) => {
    const rbt12 = num(v.rbt12);
    const receita = num(v.receita);
    const anexo = ANEXOS_SIMPLES[v.anexo || "III"];
    if (rbt12 <= 0) return { linhas: [], erro: "Informe a receita dos últimos 12 meses." };
    if (rbt12 > TETO_SIMPLES) {
      return {
        linhas: [],
        erro: `RBT12 de ${brl(rbt12)} passa o teto do Simples (${brl(TETO_SIMPLES)}). A empresa está desenquadrada.`,
      };
    }

    const i = anexo.faixas.findIndex((f) => rbt12 <= f.ate);
    const faixa = anexo.faixas[i];

    // Alíquota efetiva = (RBT12 × alíquota nominal − parcela a deduzir) / RBT12
    const efetiva = (rbt12 * faixa.aliquota - faixa.deduzir) / rbt12;
    const das = cent(receita * efetiva);

    const proximaFaixa = anexo.faixas[i + 1];
    const folgaAteProxima = proximaFaixa ? faixa.ate - rbt12 : 0;

    const linhas: Linha[] = [
      { rotulo: "Anexo", valor: anexo.nome.split("—")[0].trim(), detalhe: anexo.nome },
      { rotulo: `Faixa (${i + 1}ª)`, valor: `até ${brl(faixa.ate)}` },
      { rotulo: "Alíquota nominal", valor: pct(faixa.aliquota) },
      { rotulo: "Parcela a deduzir", valor: brl(faixa.deduzir), estilo: "desconto" },
      {
        rotulo: "Alíquota efetiva", valor: pct(efetiva), estilo: "subtotal",
        detalhe: `(${brl(rbt12)} × ${pct(faixa.aliquota)} − ${brl(faixa.deduzir)}) ÷ ${brl(rbt12)}`,
      },
      { rotulo: "Receita do mês", valor: brl(receita) },
    ];

    if (proximaFaixa) {
      linhas.push({
        rotulo: "Folga até a próxima faixa", valor: brl(folgaAteProxima), estilo: "info",
        detalhe: `Passando disso, a nominal vai para ${pct(proximaFaixa.aliquota)}`,
      });
    }

    const avisos: string[] = [];
    if (rbt12 > 3600000) {
      avisos.push("Acima de R$ 3,6 milhões o ICMS e o ISS saem do DAS e passam a ser recolhidos por fora, no regime normal. O DAS calculado aqui ainda os inclui — desconte a parcela correspondente.");
    }
    if (v.anexo === "V") {
      avisos.push("Antes de fechar no Anexo V, rode o fator R: com folha em 28% da receita, a atividade migra para o Anexo III e a carga cai bastante.");
    }
    avisos.push("O DAS é o total: dentro dele estão IRPJ, CSLL, PIS, Cofins, CPP, ICMS e ISS conforme o anexo.");

    return {
      destaque: {
        rotulo: "DAS do mês",
        valor: brl(das),
        detalhe: `Alíquota efetiva de ${pct(efetiva)} sobre ${brl(receita)}`,
      },
      linhas,
      avisos,
    };
  },
};

const fatorR: Ferramenta = {
  slug: "fator-r",
  nome: "Fator R",
  descricao: "Descobre se a atividade cai no Anexo III ou V — e quanto falta de folha para migrar.",
  categoria: "Tributário",
  icone: "git-compare",
  vigencia: VIGENCIA.simples,
  destaque: true,
  campos: [
    { nome: "rbt12", rotulo: "Receita dos últimos 12 meses", tipo: "moeda", padrao: "600000" },
    { nome: "folha", rotulo: "Folha dos últimos 12 meses", tipo: "moeda", padrao: "140000", dica: "Salários, pró-labore, FGTS e a contribuição previdenciária patronal." },
    { nome: "receita", rotulo: "Receita do mês", tipo: "moeda", padrao: "50000" },
  ],
  calcular: (v) => {
    const rbt12 = num(v.rbt12);
    const folha = num(v.folha);
    const receita = num(v.receita);
    if (rbt12 <= 0) return { linhas: [], erro: "Informe a receita dos últimos 12 meses." };

    const fator = folha / rbt12;
    const anexoAplicavel = fator >= FATOR_R_CORTE ? "III" : "V";
    const folhaNecessaria = cent(rbt12 * FATOR_R_CORTE);
    const faltam = cent(Math.max(0, folhaNecessaria - folha));

    const dasDe = (chave: string) => {
      const a = ANEXOS_SIMPLES[chave];
      const f = a.faixas.find((x) => rbt12 <= x.ate) ?? a.faixas[a.faixas.length - 1];
      const efetiva = (rbt12 * f.aliquota - f.deduzir) / rbt12;
      return { efetiva, das: cent(receita * efetiva) };
    };

    const iii = dasDe("III");
    const cinco = dasDe("V");
    const economia = cent(cinco.das - iii.das);

    const linhas: Linha[] = [
      { rotulo: "Fator R", valor: pct(fator), detalhe: `${brl(folha)} ÷ ${brl(rbt12)}` },
      { rotulo: "Corte", valor: pct(FATOR_R_CORTE, 0), detalhe: "Igual ou acima disso, vale o Anexo III" },
      { rotulo: "DAS no Anexo III", valor: brl(iii.das), detalhe: `Alíquota efetiva de ${pct(iii.efetiva)}` },
      { rotulo: "DAS no Anexo V", valor: brl(cinco.das), detalhe: `Alíquota efetiva de ${pct(cinco.efetiva)}` },
      { rotulo: "Diferença por mês", valor: brl(economia), estilo: "subtotal" },
    ];

    if (faltam > 0) {
      linhas.push({
        rotulo: "Folha que falta em 12 meses", valor: brl(faltam), estilo: "info",
        detalhe: `Cerca de ${brl(cent(faltam / 12))} a mais por mês para atingir os 28%`,
      });
    }

    return {
      destaque: {
        rotulo: `Enquadra no Anexo ${anexoAplicavel}`,
        valor: pct(fator),
        detalhe: fator >= FATOR_R_CORTE
          ? `Acima do corte de 28% — economia de ${brl(economia)} por mês em relação ao Anexo V`
          : `Abaixo do corte de 28% — custa ${brl(economia)} a mais por mês que o Anexo III`,
      },
      linhas,
      avisos: [
        faltam > 0
          ? `Aumentar a folha em ${brl(cent(faltam / 12))} por mês custa menos que os ${brl(economia)} de DAS a mais — mas some encargos e FGTS antes de decidir.`
          : "A empresa está no Anexo III. Se a folha cair, ela volta ao V no mês seguinte: o fator R é apurado todo mês.",
        "O pró-labore entra na folha para o fator R. É a alavanca mais rápida, e ainda gera contribuição previdenciária para o sócio.",
      ],
    };
  },
};

const lucroPresumido: Ferramenta = {
  slug: "lucro-presumido",
  nome: "Lucro Presumido",
  descricao: "IRPJ com adicional, CSLL, PIS e Cofins sobre o trimestre.",
  categoria: "Tributário",
  icone: "calculator",
  vigencia: VIGENCIA.presumido,
  campos: [
    { nome: "receita", rotulo: "Receita do trimestre", tipo: "moeda", padrao: "300000" },
    {
      nome: "atividade", rotulo: "Atividade", tipo: "select", largo: true, padrao: "servicos",
      opcoes: Object.entries(PRESUNCOES).map(([k, a]) => ({ v: k, rotulo: `${a.rotulo} (IRPJ ${(a.irpj * 100).toFixed(1)}%)` })),
    },
    { nome: "financeiras", rotulo: "Receitas financeiras no trimestre", tipo: "moeda", padrao: "0", dica: "Entram integralmente na base, sem presunção." },
  ],
  calcular: (v) => {
    const receita = num(v.receita);
    const at = PRESUNCOES[v.atividade || "servicos"];
    const fin = num(v.financeiras);
    if (receita <= 0) return { linhas: [], erro: "Informe a receita do trimestre." };

    const baseIrpj = cent(receita * at.irpj + fin);
    const irpj = cent(baseIrpj * IRPJ_ALIQUOTA);
    const limite = IRPJ_LIMITE_MENSAL * 3;
    const adicional = cent(Math.max(0, baseIrpj - limite) * IRPJ_ADICIONAL);

    const baseCsll = cent(receita * at.csll + fin);
    const csll = cent(baseCsll * CSLL_ALIQUOTA);

    const pis = cent(receita * PIS_CUMULATIVO);
    const cofins = cent(receita * COFINS_CUMULATIVO);

    const total = cent(irpj + adicional + csll + pis + cofins);

    return {
      destaque: {
        rotulo: "Tributos federais do trimestre",
        valor: brl(total),
        detalhe: `Carga de ${pct(total / receita)} sobre a receita · ${brl(cent(total / 3))} por mês`,
      },
      linhas: [
        { rotulo: "Receita do trimestre", valor: brl(receita) },
        { rotulo: `Base do IRPJ (presunção de ${pct(at.irpj, 1)})`, valor: brl(baseIrpj) },
        { rotulo: "IRPJ (15%)", valor: brl(irpj) },
        {
          rotulo: "Adicional de IRPJ (10%)", valor: brl(adicional),
          detalhe: adicional > 0 ? `Sobre o que passou de ${brl(limite)} no trimestre` : "Base abaixo de R$ 60.000 no trimestre",
        },
        { rotulo: `Base da CSLL (presunção de ${pct(at.csll, 1)})`, valor: brl(baseCsll) },
        { rotulo: "CSLL (9%)", valor: brl(csll) },
        { rotulo: "PIS (0,65%)", valor: brl(pis) },
        { rotulo: "Cofins (3%)", valor: brl(cofins) },
        { rotulo: "Total", valor: brl(total), estilo: "total" },
      ],
      avisos: [
        "PIS e Cofins no presumido são cumulativos: não geram crédito sobre compras. É o principal ponto de comparação com o Lucro Real.",
        "Faltam ICMS, ISS e a contribuição previdenciária patronal — este cálculo cobre só os tributos federais sobre a receita.",
        "O adicional de IRPJ tem limite de R$ 20.000 por mês do período de apuração; num trimestre completo, R$ 60.000.",
      ],
    };
  },
};

const proLabore: Ferramenta = {
  slug: "pro-labore",
  nome: "Pró-labore",
  descricao: "INSS do sócio, IRRF, líquido e o custo real para a empresa.",
  categoria: "Tributário",
  icone: "user-cog",
  vigencia: `${VIGENCIA.inss} · ${VIGENCIA.irrf}`,
  campos: [
    { nome: "valor", rotulo: "Pró-labore bruto", tipo: "moeda", padrao: "5000" },
    { nome: "dependentes", rotulo: "Dependentes", tipo: "inteiro", padrao: "0" },
    {
      nome: "regime", rotulo: "Regime da empresa", tipo: "select", largo: true, padrao: "simples",
      opcoes: [
        { v: "simples", rotulo: "Simples Nacional — anexos I a III e V (CPP está no DAS)" },
        { v: "cpp", rotulo: "Lucro Presumido, Real ou Simples anexo IV (CPP de 20% por fora)" },
      ],
    },
  ],
  calcular: (v) => {
    const valor = num(v.valor);
    if (valor <= 0) return { linhas: [], erro: "Informe o pró-labore." };

    // Contribuinte individual: 11% sobre o valor, limitado ao teto.
    const baseInss = Math.min(valor, TETO_INSS);
    const inss = cent(baseInss * 0.11);
    const irrf = calcularIRRF(valor, inss, num(v.dependentes));
    const liquido = cent(valor - inss - irrf.imposto);
    const cpp = v.regime === "cpp" ? cent(valor * 0.2) : 0;

    return {
      destaque: {
        rotulo: "Líquido para o sócio",
        valor: brl(liquido),
        detalhe: `Custo para a empresa: ${brl(cent(valor + cpp))}`,
      },
      linhas: [
        { rotulo: "Pró-labore bruto", valor: brl(valor) },
        {
          rotulo: "INSS do sócio (11%)", valor: `− ${brl(inss)}`, estilo: "desconto",
          detalhe: valor > TETO_INSS ? `Limitado ao teto de ${brl(TETO_INSS)}` : undefined,
        },
        { rotulo: "IRRF", valor: `− ${brl(irrf.imposto)}`, estilo: "desconto" },
        {
          rotulo: "CPP patronal (20%)", valor: brl(cpp), estilo: "info",
          detalhe: cpp > 0 ? "Pago pela empresa, por fora" : "Já incluída no DAS deste anexo",
        },
      ],
      avisos: [
        "Pró-labore é obrigatório quando o sócio trabalha na empresa. Distribuir só lucro configura omissão de fato gerador — é a autuação mais comum em fiscalização de sócio.",
        "Ele conta na folha para o fator R: em empresa de serviços do Anexo V, aumentar o pró-labore pode custar menos que o DAS que se economiza.",
        "A distribuição de lucros continua isenta de IRRF quando há escrituração contábil regular que a comprove.",
      ],
    };
  },
};

const multaJuros: Ferramenta = {
  slug: "multa-e-juros",
  nome: "Multa e juros por atraso",
  descricao: "Tributo federal pago fora do prazo: multa de mora e juros Selic.",
  categoria: "Tributário",
  icone: "alarm-clock",
  campos: [
    { nome: "valor", rotulo: "Valor do tributo", tipo: "moeda", padrao: "5000" },
    { nome: "vencimento", rotulo: "Vencimento", tipo: "data", padrao: "2026-05-20" },
    { nome: "pagamento", rotulo: "Data do pagamento", tipo: "data", padrao: "2026-08-28" },
    {
      nome: "selic", rotulo: "Selic acumulada no período (%)", tipo: "percentual", padrao: "3.2",
      dica: "Some as taxas mensais da Selic entre o mês seguinte ao vencimento e o mês anterior ao pagamento. Fonte: site da Receita Federal.",
    },
  ],
  calcular: (v) => {
    const valor = num(v.valor);
    const dVenc = data(v.vencimento);
    const dPag = data(v.pagamento);
    if (valor <= 0) return { linhas: [], erro: "Informe o valor do tributo." };
    if (!dVenc || !dPag) return { linhas: [], erro: "Preencha as duas datas." };
    if (dPag <= dVenc) {
      return { linhas: [], erro: "O pagamento está dentro do prazo — não há multa nem juros." };
    }

    const dias = diasEntre(dVenc, dPag);
    // Multa de mora: 0,33% por dia de atraso, limitada a 20% (Lei 9.430/96).
    const percMulta = Math.min(dias * 0.0033, 0.2);
    const multa = cent(valor * percMulta);

    // Juros: Selic acumulada + 1% no mês do pagamento.
    const percJuros = num(v.selic) / 100 + 0.01;
    const juros = cent(valor * percJuros);
    const total = cent(valor + multa + juros);

    return {
      destaque: {
        rotulo: "Total a recolher",
        valor: brl(total),
        detalhe: `${dias} dias de atraso · acréscimo de ${pct((total - valor) / valor)}`,
      },
      linhas: [
        { rotulo: "Tributo original", valor: brl(valor) },
        {
          rotulo: `Multa de mora (${pct(percMulta)})`, valor: brl(multa),
          detalhe: percMulta >= 0.2 ? "Travada no limite de 20%" : `0,33% × ${dias} dias`,
        },
        {
          rotulo: `Juros (${pct(percJuros)})`, valor: brl(juros),
          detalhe: `Selic acumulada de ${numero(num(v.selic))}% + 1% no mês do pagamento`,
        },
        { rotulo: "Total", valor: brl(total), estilo: "total" },
      ],
      avisos: [
        "A Selic acumulada precisa ser conferida na tabela da Receita Federal do mês do pagamento — ela muda todo mês e não dá para estimar.",
        "Multa de mora é diferente de multa de ofício: esta é para pagamento espontâneo, antes de qualquer procedimento fiscal. Depois de intimado, a multa vai a 75%.",
      ],
    };
  },
};

const reformaTributaria: Ferramenta = {
  slug: "reforma-tributaria",
  nome: "Simulador da Reforma Tributária",
  descricao: "Carga atual contra CBS e IBS ano a ano, do teste de 2026 ao modelo pleno.",
  categoria: "Tributário",
  icone: "trending-up",
  vigencia: VIGENCIA.reforma,
  destaque: true,
  campos: [
    { nome: "receita", rotulo: "Receita mensal", tipo: "moeda", padrao: "200000" },
    {
      nome: "ano", rotulo: "Ano da simulação", tipo: "select", padrao: "2027",
      opcoes: Object.keys(TRANSICAO).map((a) => ({ v: a, rotulo: a })),
    },
    { nome: "pis", rotulo: "PIS + Cofins hoje (%)", tipo: "percentual", padrao: "9.25", grupo: "Carga atual" },
    { nome: "icms", rotulo: "ICMS ou ISS hoje (%)", tipo: "percentual", padrao: "18", grupo: "Carga atual" },
    { nome: "creditos", rotulo: "Compras que geram crédito (% da receita)", tipo: "percentual", padrao: "40", grupo: "Carga atual", dica: "No novo modelo o crédito é amplo: quase toda compra gera." },
    { nome: "cbs", rotulo: "Alíquota da CBS (%)", tipo: "percentual", padrao: "8.8", grupo: "Novo modelo" },
    { nome: "ibs", rotulo: "Alíquota do IBS (%)", tipo: "percentual", padrao: "17.7", grupo: "Novo modelo" },
  ],
  calcular: (v) => {
    const receita = num(v.receita);
    const ano = Number(v.ano || 2027);
    const t = TRANSICAO[ano];
    if (receita <= 0) return { linhas: [], erro: "Informe a receita mensal." };
    if (!t) return { linhas: [], erro: "Ano fora do cronograma da transição." };

    const cbsRef = num(v.cbs) / 100 || CBS_REFERENCIA;
    const ibsRef = num(v.ibs) / 100 || IBS_REFERENCIA;
    const creditosPerc = num(v.creditos) / 100;
    const compras = cent(receita * creditosPerc);

    // Carga atual: débito menos crédito, com o mesmo percentual de compras.
    const atualDebito = cent(receita * (num(v.pis) / 100 + num(v.icms) / 100));
    const atualCredito = cent(compras * (num(v.pis) / 100 + num(v.icms) / 100));
    const atual = cent(atualDebito - atualCredito);

    // Novo modelo no ano escolhido.
    const cbsAno = cbsRef * t.cbs;
    const ibsAno = ibsRef * t.ibs;
    const novoDebito = cent(receita * (cbsAno + ibsAno));
    const novoCredito = cent(compras * (cbsAno + ibsAno));
    const novo = cent(novoDebito - novoCredito);

    // Tributos antigos que continuam no ano.
    const antigos = cent(atual * t.antigos);
    const totalAno = cent(novo + antigos);
    const diferenca = cent(totalAno - atual);

    return {
      destaque: {
        rotulo: `Carga mensal em ${ano}`,
        valor: brl(totalAno),
        detalhe: diferenca === 0
          ? "Igual à carga de hoje"
          : `${diferenca > 0 ? "Aumento" : "Redução"} de ${brl(Math.abs(diferenca))} em relação a hoje (${pct(Math.abs(diferenca) / atual)})`,
      },
      linhas: [
        { rotulo: "Receita mensal", valor: brl(receita) },
        { rotulo: "Compras com crédito", valor: brl(compras), detalhe: `${pct(creditosPerc, 0)} da receita` },
        { rotulo: "Carga atual líquida", valor: brl(atual), estilo: "subtotal", detalhe: `Débito ${brl(atualDebito)} − crédito ${brl(atualCredito)}` },
        { rotulo: `CBS em ${ano} (${pct(cbsAno)})`, valor: brl(cent(receita * cbsAno - compras * cbsAno)) },
        { rotulo: `IBS em ${ano} (${pct(ibsAno)})`, valor: brl(cent(receita * ibsAno - compras * ibsAno)) },
        { rotulo: "Tributos antigos remanescentes", valor: brl(antigos), detalhe: t.antigos > 0 ? `${pct(t.antigos, 0)} da carga atual` : "Extintos neste ano" },
        { rotulo: `Total em ${ano}`, valor: brl(totalAno), estilo: "total" },
      ],
      avisos: [
        t.nota,
        "As alíquotas de referência ainda não estão fixadas em lei complementar — os campos são editáveis justamente por isso.",
        "O crédito no novo modelo é amplo e financeiro: depende do recolhimento na etapa anterior. Quem compra de fornecedor inadimplente perde crédito, e é aí que a régua de homologação de fornecedor passa a valer dinheiro.",
      ],
    };
  },
};

/* ======================================================================
   SETORIAL — transporte, logística e comércio exterior
   ====================================================================== */

const custoPorKm: Ferramenta = {
  slug: "custo-por-km",
  nome: "Custo por quilômetro rodado",
  descricao: "Custos fixos e variáveis do veículo e o preço mínimo do frete.",
  categoria: "Setorial",
  icone: "truck",
  destaque: true,
  campos: [
    { nome: "km", rotulo: "Km rodados por mês", tipo: "numero", padrao: "8000", grupo: "Operação" },
    { nome: "distancia", rotulo: "Distância da viagem (km)", tipo: "numero", padrao: "600", grupo: "Operação" },

    { nome: "valorVeiculo", rotulo: "Valor do veículo", tipo: "moeda", padrao: "450000", grupo: "Custos fixos" },
    { nome: "residual", rotulo: "Valor residual estimado", tipo: "moeda", padrao: "150000", grupo: "Custos fixos" },
    { nome: "vidaUtil", rotulo: "Vida útil (anos)", tipo: "numero", padrao: "8", grupo: "Custos fixos" },
    { nome: "motorista", rotulo: "Motorista com encargos (mês)", tipo: "moeda", padrao: "5200", grupo: "Custos fixos" },
    { nome: "seguro", rotulo: "Seguro anual", tipo: "moeda", padrao: "14000", grupo: "Custos fixos" },
    { nome: "licenciamento", rotulo: "Licenciamento e IPVA (ano)", tipo: "moeda", padrao: "4500", grupo: "Custos fixos" },
    { nome: "fixosOutros", rotulo: "Rastreador, ANTT e outros (mês)", tipo: "moeda", padrao: "600", grupo: "Custos fixos" },

    { nome: "precoCombustivel", rotulo: "Preço do diesel (litro)", tipo: "moeda", padrao: "6.20", grupo: "Custos variáveis" },
    { nome: "consumo", rotulo: "Consumo (km por litro)", tipo: "numero", padrao: "2.8", grupo: "Custos variáveis" },
    { nome: "pneus", rotulo: "Jogo de pneus", tipo: "moeda", padrao: "18000", grupo: "Custos variáveis" },
    { nome: "vidaPneus", rotulo: "Vida do jogo (km)", tipo: "numero", padrao: "90000", grupo: "Custos variáveis" },
    { nome: "manutencao", rotulo: "Manutenção por km", tipo: "moeda", padrao: "0.45", grupo: "Custos variáveis" },
    { nome: "arla", rotulo: "Arla e lubrificantes por km", tipo: "moeda", padrao: "0.12", grupo: "Custos variáveis" },

    { nome: "margem", rotulo: "Margem desejada (%)", tipo: "percentual", padrao: "20", grupo: "Preço" },
    { nome: "impostos", rotulo: "Impostos sobre o frete (%)", tipo: "percentual", padrao: "12", grupo: "Preço" },
  ],
  calcular: (v) => {
    const km = num(v.km);
    if (km <= 0) return { linhas: [], erro: "Informe os quilômetros rodados por mês." };

    const depreciacao = cent((num(v.valorVeiculo) - num(v.residual)) / (num(v.vidaUtil) * 12 || 1));
    const fixosMes = cent(
      depreciacao + num(v.motorista) + num(v.seguro) / 12 + num(v.licenciamento) / 12 + num(v.fixosOutros)
    );
    const fixoKm = cent(fixosMes / km);

    const combustivelKm = num(v.consumo) > 0 ? cent(num(v.precoCombustivel) / num(v.consumo)) : 0;
    const pneusKm = num(v.vidaPneus) > 0 ? cent(num(v.pneus) / num(v.vidaPneus)) : 0;
    const variavelKm = cent(combustivelKm + pneusKm + num(v.manutencao) + num(v.arla));

    const custoKm = cent(fixoKm + variavelKm);
    const distancia = num(v.distancia);
    const custoViagem = cent(custoKm * distancia);

    // Preço "por dentro": margem e impostos incidem sobre o preço final.
    const divisor = 1 - (num(v.margem) + num(v.impostos)) / 100;
    const precoViagem = divisor > 0 ? cent(custoViagem / divisor) : 0;

    return {
      destaque: {
        rotulo: "Custo por quilômetro",
        valor: brl(custoKm),
        detalhe: `Fixo ${brl(fixoKm)} + variável ${brl(variavelKm)}`,
      },
      linhas: [
        { rotulo: "Depreciação mensal", valor: brl(depreciacao), detalhe: `(${brl(num(v.valorVeiculo))} − ${brl(num(v.residual))}) ÷ ${num(v.vidaUtil)} anos` },
        { rotulo: "Total de custos fixos por mês", valor: brl(fixosMes), estilo: "subtotal" },
        { rotulo: "Custo fixo por km", valor: brl(fixoKm), detalhe: `${brl(fixosMes)} ÷ ${numero(km, 0)} km` },
        { rotulo: "Combustível por km", valor: brl(combustivelKm), detalhe: `${brl(num(v.precoCombustivel))} ÷ ${numero(num(v.consumo), 1)} km/l` },
        { rotulo: "Pneus por km", valor: brl(pneusKm) },
        { rotulo: "Manutenção por km", valor: brl(num(v.manutencao)) },
        { rotulo: "Arla e lubrificantes por km", valor: brl(num(v.arla)) },
        { rotulo: "Custo variável por km", valor: brl(variavelKm), estilo: "subtotal" },
        { rotulo: `Custo da viagem (${numero(distancia, 0)} km)`, valor: brl(custoViagem) },
        {
          rotulo: "Preço mínimo do frete", valor: brl(precoViagem), estilo: "total",
          detalhe: `Com ${numero(num(v.margem), 0)}% de margem e ${numero(num(v.impostos), 0)}% de impostos`,
        },
        { rotulo: "Receita mensal necessária", valor: brl(cent(fixosMes / (divisor || 1))), estilo: "info", detalhe: "Só para cobrir os fixos, com a mesma margem" },
      ],
      avisos: [
        "O custo fixo por km despenca com a quilometragem: veículo parado é o que mais corrói margem em transportadora pequena.",
        "Confira o piso mínimo de frete da ANTT antes de fechar preço — em muitas rotas ele é obrigatório.",
        "Retorno vazio não está aqui. Se a rota não tem carga de volta, dobre a distância ou some o custo do retorno ao preço.",
      ],
    };
  },
};

const custoImportacao: Ferramenta = {
  slug: "custo-importacao",
  nome: "Custo de importação",
  descricao: "Do FOB ao custo final: II, IPI, PIS, Cofins, ICMS por dentro e despesas.",
  categoria: "Setorial",
  icone: "ship",
  destaque: true,
  campos: [
    { nome: "fob", rotulo: "Valor FOB (moeda estrangeira)", tipo: "moeda", padrao: "20000", grupo: "Valor aduaneiro" },
    { nome: "cambio", rotulo: "Taxa de câmbio", tipo: "numero", padrao: "5.45", grupo: "Valor aduaneiro" },
    { nome: "frete", rotulo: "Frete internacional (moeda estrangeira)", tipo: "moeda", padrao: "2500", grupo: "Valor aduaneiro" },
    { nome: "seguro", rotulo: "Seguro internacional (moeda estrangeira)", tipo: "moeda", padrao: "300", grupo: "Valor aduaneiro" },
    {
      nome: "modal", rotulo: "Modal", tipo: "select", padrao: "maritimo", grupo: "Valor aduaneiro",
      opcoes: [{ v: "maritimo", rotulo: "Marítimo (incide AFRMM de 8%)" }, { v: "aereo", rotulo: "Aéreo ou rodoviário" }],
    },

    { nome: "ii", rotulo: "Imposto de Importação (%)", tipo: "percentual", padrao: "14", grupo: "Tributos" },
    { nome: "ipi", rotulo: "IPI (%)", tipo: "percentual", padrao: "5", grupo: "Tributos" },
    { nome: "icms", rotulo: "ICMS (%)", tipo: "percentual", padrao: "18", grupo: "Tributos" },

    { nome: "despesas", rotulo: "Despachante, armazenagem e capatazia", tipo: "moeda", padrao: "4500", grupo: "Despesas" },
    { nome: "quantidade", rotulo: "Quantidade de unidades", tipo: "numero", padrao: "500", grupo: "Despesas" },
  ],
  calcular: (v) => {
    const cambio = num(v.cambio);
    if (cambio <= 0) return { linhas: [], erro: "Informe a taxa de câmbio." };

    const freteReais = cent(num(v.frete) * cambio);
    // Valor aduaneiro = FOB + frete + seguro, tudo convertido (Incoterm CIF).
    const va = cent((num(v.fob) + num(v.frete) + num(v.seguro)) * cambio);

    const ii = cent(va * (num(v.ii) / 100));
    const ipi = cent((va + ii) * (num(v.ipi) / 100));
    const pis = cent(va * PIS_IMPORTACAO);
    const cofins = cent(va * COFINS_IMPORTACAO);
    const afrmm = v.modal === "maritimo" ? cent(freteReais * AFRMM) : 0;
    const despesas = cent(num(v.despesas) + TAXA_SISCOMEX + afrmm);

    // ICMS na importação é calculado "por dentro": ele integra a própria base.
    const aliqIcms = num(v.icms) / 100;
    const baseSemIcms = va + ii + ipi + pis + cofins + despesas;
    const baseIcms = aliqIcms < 1 ? cent(baseSemIcms / (1 - aliqIcms)) : 0;
    const icms = cent(baseIcms * aliqIcms);

    const total = cent(va + ii + ipi + pis + cofins + despesas + icms);
    const qtd = num(v.quantidade);

    return {
      destaque: {
        rotulo: "Custo total da importação",
        valor: brl(total),
        detalhe: qtd > 0 ? `${brl(cent(total / qtd))} por unidade` : undefined,
      },
      linhas: [
        { rotulo: "Valor aduaneiro (FOB + frete + seguro)", valor: brl(va), detalhe: `Câmbio de ${numero(cambio, 4)}` },
        { rotulo: `Imposto de Importação (${numero(num(v.ii), 1)}%)`, valor: brl(ii) },
        { rotulo: `IPI (${numero(num(v.ipi), 1)}%)`, valor: brl(ipi), detalhe: "Base: valor aduaneiro + II" },
        { rotulo: "PIS-Importação (2,1%)", valor: brl(pis) },
        { rotulo: "Cofins-Importação (9,65%)", valor: brl(cofins) },
        { rotulo: "Taxa Siscomex", valor: brl(TAXA_SISCOMEX) },
        { rotulo: "AFRMM (8% do frete marítimo)", valor: brl(afrmm), detalhe: v.modal === "maritimo" ? undefined : "Não incide neste modal" },
        { rotulo: "Despachante, armazenagem e capatazia", valor: brl(num(v.despesas)) },
        { rotulo: "Base do ICMS (por dentro)", valor: brl(baseIcms), estilo: "subtotal", detalhe: `${brl(baseSemIcms)} ÷ (1 − ${numero(num(v.icms), 0)}%)` },
        { rotulo: `ICMS (${numero(num(v.icms), 1)}%)`, valor: brl(icms) },
        { rotulo: "Custo total", valor: brl(total), estilo: "total" },
        { rotulo: "Carga tributária sobre o valor aduaneiro", valor: pct((ii + ipi + pis + cofins + icms) / va), estilo: "info" },
      ],
      avisos: [
        "O ICMS entra na própria base — por isso a divisão por (1 − alíquota). Calcular por fora subestima o imposto e é o erro mais comum na formação de preço de importado.",
        "IPI, PIS, Cofins e ICMS podem gerar crédito conforme o regime da empresa. Este é o custo de desembolso, não necessariamente o custo de estoque.",
        "Confira a alíquota do II pela NCM da mercadoria: a diferença entre duas NCMs parecidas costuma ser de dois dígitos.",
      ],
    };
  },
};

/* ======================================================================
   GESTÃO
   ====================================================================== */

const precoDeVenda: Ferramenta = {
  slug: "preco-de-venda",
  nome: "Preço de venda e markup",
  descricao: "Do custo ao preço, com impostos, comissão e o lucro que você quer.",
  categoria: "Gestão",
  icone: "tag",
  campos: [
    { nome: "custo", rotulo: "Custo do produto ou serviço", tipo: "moeda", padrao: "100" },
    { nome: "impostos", rotulo: "Impostos sobre a venda (%)", tipo: "percentual", padrao: "12" },
    { nome: "comissao", rotulo: "Comissão (%)", tipo: "percentual", padrao: "5" },
    { nome: "despesas", rotulo: "Despesas fixas rateadas (%)", tipo: "percentual", padrao: "15" },
    { nome: "lucro", rotulo: "Lucro desejado (%)", tipo: "percentual", padrao: "20" },
  ],
  calcular: (v) => {
    const custo = num(v.custo);
    const soma = num(v.impostos) + num(v.comissao) + num(v.despesas) + num(v.lucro);
    if (custo <= 0) return { linhas: [], erro: "Informe o custo." };
    if (soma >= 100) {
      return {
        linhas: [],
        erro: `Os percentuais somam ${numero(soma, 1)}%. Como todos incidem sobre o preço de venda, a soma precisa ficar abaixo de 100% — senão não existe preço que feche a conta.`,
      };
    }

    const divisor = 1 - soma / 100;
    const preco = cent(custo / divisor);
    const markup = 1 / divisor;

    return {
      destaque: {
        rotulo: "Preço de venda",
        valor: brl(preco),
        detalhe: `Markup multiplicador de ${numero(markup, 3)} sobre o custo`,
      },
      linhas: [
        { rotulo: "Custo", valor: brl(custo) },
        { rotulo: `Impostos (${numero(num(v.impostos), 1)}%)`, valor: brl(cent(preco * num(v.impostos) / 100)) },
        { rotulo: `Comissão (${numero(num(v.comissao), 1)}%)`, valor: brl(cent(preco * num(v.comissao) / 100)) },
        { rotulo: `Despesas fixas (${numero(num(v.despesas), 1)}%)`, valor: brl(cent(preco * num(v.despesas) / 100)) },
        { rotulo: `Lucro (${numero(num(v.lucro), 1)}%)`, valor: brl(cent(preco * num(v.lucro) / 100)), estilo: "subtotal" },
        { rotulo: "Preço de venda", valor: brl(preco), estilo: "total" },
        { rotulo: "Margem de contribuição", valor: brl(cent(preco - custo - preco * (num(v.impostos) + num(v.comissao)) / 100)), estilo: "info" },
      ],
      avisos: [
        "O erro clássico é somar a margem sobre o custo (custo × 1,20). Como imposto e comissão incidem sobre o preço, e não sobre o custo, esse método entrega sempre menos lucro do que se imagina.",
        "Aqui a conta é por dentro: divide-se o custo pelo que sobra depois de todos os percentuais.",
      ],
    };
  },
};

const pontoEquilibrio: Ferramenta = {
  slug: "ponto-de-equilibrio",
  nome: "Ponto de equilíbrio",
  descricao: "Quanto precisa vender para não ter prejuízo — e para dar o lucro que você quer.",
  categoria: "Gestão",
  icone: "scale",
  campos: [
    { nome: "fixos", rotulo: "Custos e despesas fixas (mês)", tipo: "moeda", padrao: "45000" },
    { nome: "preco", rotulo: "Preço unitário de venda", tipo: "moeda", padrao: "250" },
    { nome: "variavel", rotulo: "Custo variável unitário", tipo: "moeda", padrao: "140" },
    { nome: "lucroDesejado", rotulo: "Lucro desejado no mês", tipo: "moeda", padrao: "15000" },
  ],
  calcular: (v) => {
    const fixos = num(v.fixos);
    const preco = num(v.preco);
    const variavel = num(v.variavel);
    if (preco <= 0) return { linhas: [], erro: "Informe o preço unitário." };
    if (variavel >= preco) {
      return { linhas: [], erro: "O custo variável está igual ou acima do preço. Cada venda gera prejuízo — não existe ponto de equilíbrio." };
    }

    const mc = cent(preco - variavel);
    const mcPerc = mc / preco;
    const peUnid = Math.ceil(fixos / mc);
    const peReais = cent(peUnid * preco);
    const peEcon = Math.ceil((fixos + num(v.lucroDesejado)) / mc);

    return {
      destaque: {
        rotulo: "Ponto de equilíbrio",
        valor: `${numero(peUnid, 0)} unidades`,
        detalhe: `${brl(peReais)} de faturamento por mês`,
      },
      linhas: [
        { rotulo: "Margem de contribuição unitária", valor: brl(mc), detalhe: `${brl(preco)} − ${brl(variavel)}` },
        { rotulo: "Margem de contribuição", valor: pct(mcPerc), estilo: "subtotal" },
        { rotulo: "Ponto de equilíbrio em unidades", valor: `${numero(peUnid, 0)} un.`, detalhe: `${brl(fixos)} ÷ ${brl(mc)}` },
        { rotulo: "Ponto de equilíbrio em receita", valor: brl(peReais) },
        { rotulo: "Vendas por dia útil (22 dias)", valor: `${numero(Math.ceil(peUnid / 22), 0)} un.`, estilo: "info" },
        {
          rotulo: `Para lucrar ${brl(num(v.lucroDesejado))}`, valor: `${numero(peEcon, 0)} un.`, estilo: "total",
          detalhe: `${brl(cent(peEcon * preco))} de faturamento`,
        },
      ],
      avisos: [
        "Margem de contribuição abaixo de 30% deixa a empresa muito sensível a queda de volume: qualquer mês fraco vira prejuízo.",
        "Fixos aqui são os que não mudam com o volume — aluguel, folha administrativa, contabilidade. Comissão e matéria-prima são variáveis.",
      ],
    };
  },
};

const depreciacao: Ferramenta = {
  slug: "depreciacao",
  nome: "Depreciação",
  descricao: "Quota anual e mensal pelo método linear, com o valor contábil ano a ano.",
  categoria: "Gestão",
  icone: "trending-down",
  campos: [
    { nome: "valor", rotulo: "Valor de aquisição", tipo: "moeda", padrao: "120000" },
    { nome: "residual", rotulo: "Valor residual", tipo: "moeda", padrao: "20000" },
    {
      nome: "vida", rotulo: "Vida útil (anos)", tipo: "select", padrao: "5",
      opcoes: [
        { v: "3", rotulo: "3 anos — computadores e periféricos" },
        { v: "5", rotulo: "5 anos — veículos e software" },
        { v: "10", rotulo: "10 anos — máquinas, móveis e instalações" },
        { v: "25", rotulo: "25 anos — edificações" },
      ],
    },
  ],
  calcular: (v) => {
    const valor = num(v.valor);
    const residual = num(v.residual);
    const vida = num(v.vida) || 5;
    if (valor <= 0) return { linhas: [], erro: "Informe o valor de aquisição." };
    if (residual >= valor) return { linhas: [], erro: "O valor residual precisa ser menor que o de aquisição." };

    const base = cent(valor - residual);
    const anual = cent(base / vida);

    const linhas: Linha[] = [
      { rotulo: "Base depreciável", valor: brl(base), detalhe: `${brl(valor)} − ${brl(residual)}` },
      { rotulo: "Taxa anual", valor: pct(1 / vida) },
      { rotulo: "Quota anual", valor: brl(anual), estilo: "subtotal" },
      { rotulo: "Quota mensal", valor: brl(cent(anual / 12)) },
    ];

    let acumulada = 0;
    for (let ano = 1; ano <= Math.min(vida, 10); ano++) {
      acumulada = cent(acumulada + anual);
      linhas.push({
        rotulo: `Ano ${ano}`,
        valor: brl(cent(valor - acumulada)),
        estilo: "info",
        detalhe: `Depreciação acumulada de ${brl(acumulada)}`,
      });
    }

    return {
      destaque: { rotulo: "Quota mensal de depreciação", valor: brl(cent(anual / 12)) },
      linhas,
      avisos: [
        "As taxas listadas são as admitidas pela Receita Federal (IN 1.700/2017). A vida útil econômica real pode ser diferente — e para fins societários é ela que vale, pelo CPC 27.",
        "Depreciação é despesa dedutível sem desembolso: ela reduz o lucro tributável sem tirar dinheiro do caixa.",
      ],
    };
  },
};

const parcelamento: Ferramenta = {
  slug: "parcelamento",
  nome: "Parcelamento e financiamento",
  descricao: "Valor da parcela pela Tabela Price, total de juros e custo efetivo.",
  categoria: "Gestão",
  icone: "credit-card",
  campos: [
    { nome: "valor", rotulo: "Valor financiado", tipo: "moeda", padrao: "50000" },
    { nome: "taxa", rotulo: "Taxa de juros ao mês (%)", tipo: "percentual", padrao: "1.8" },
    { nome: "parcelas", rotulo: "Número de parcelas", tipo: "inteiro", padrao: "24" },
    { nome: "entrada", rotulo: "Entrada", tipo: "moeda", padrao: "0" },
  ],
  calcular: (v) => {
    const bruto = num(v.valor);
    const entrada = num(v.entrada);
    const pv = bruto - entrada;
    const i = num(v.taxa) / 100;
    const n = Math.round(num(v.parcelas));
    if (pv <= 0) return { linhas: [], erro: "O valor financiado precisa ser maior que a entrada." };
    if (n <= 0) return { linhas: [], erro: "Informe o número de parcelas." };

    const pmt = i > 0 ? cent((pv * i) / (1 - Math.pow(1 + i, -n))) : cent(pv / n);
    const total = cent(pmt * n);
    const juros = cent(total - pv);
    const anual = Math.pow(1 + i, 12) - 1;

    const linhas: Linha[] = [
      { rotulo: "Valor financiado", valor: brl(pv), detalhe: entrada > 0 ? `${brl(bruto)} − ${brl(entrada)} de entrada` : undefined },
      { rotulo: "Taxa mensal", valor: pct(i), detalhe: `Equivale a ${pct(anual)} ao ano` },
      { rotulo: "Parcela", valor: brl(pmt), estilo: "subtotal" },
      { rotulo: "Total pago", valor: brl(cent(total + entrada)) },
      { rotulo: "Juros pagos", valor: brl(juros), estilo: "desconto", detalhe: `${pct(juros / pv)} sobre o valor financiado` },
    ];

    // Primeiras parcelas: mostra como o juro pesa no começo.
    let saldo = pv;
    for (let k = 1; k <= Math.min(n, 3); k++) {
      const j = cent(saldo * i);
      const amort = cent(pmt - j);
      saldo = cent(saldo - amort);
      linhas.push({
        rotulo: `Parcela ${k}`,
        valor: brl(pmt),
        estilo: "info",
        detalhe: `Juros ${brl(j)} · amortização ${brl(amort)} · saldo ${brl(saldo)}`,
      });
    }

    return {
      destaque: { rotulo: "Valor da parcela", valor: brl(pmt), detalhe: `${n}× · total de ${brl(cent(total + entrada))}` },
      linhas,
      avisos: [
        "Na Tabela Price a parcela é fixa, mas as primeiras são quase só juros. Quitar antecipadamente no começo economiza muito mais do que no fim.",
        "Compare sempre pelo custo efetivo total: taxa nominal parecida com IOF, tarifa e seguro embutidos muda o resultado.",
      ],
    };
  },
};

/* ======================================================================
   UTILITÁRIO
   ====================================================================== */

const validadorDocumentos: Ferramenta = {
  slug: "validador-cpf-cnpj",
  nome: "Validador de CPF e CNPJ",
  descricao: "Confere o dígito verificador antes de o cadastro entrar no sistema.",
  categoria: "Utilitário",
  icone: "badge-check",
  campos: [
    { nome: "documento", rotulo: "CPF ou CNPJ", tipo: "texto", largo: true, padrao: "", dica: "Com ou sem pontuação." },
  ],
  calcular: (v) => {
    const bruto = (v.documento ?? "").replace(/\D/g, "");
    if (!bruto) return { linhas: [], erro: "Digite um CPF ou CNPJ." };

    if (bruto.length === 11) {
      const ok = validarCPF(bruto);
      const fmt = bruto.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      return {
        destaque: { rotulo: ok ? "CPF válido" : "CPF inválido", valor: fmt },
        linhas: [
          { rotulo: "Tipo", valor: "CPF (pessoa física)" },
          { rotulo: "Formatado", valor: fmt },
          {
            rotulo: "Dígito verificador", valor: ok ? "confere" : "não confere",
            estilo: ok ? "subtotal" : "desconto",
          },
        ],
        avisos: ["Dígito válido não significa CPF existente ou regular. Para situação cadastral, consulte a Receita Federal."],
      };
    }

    if (bruto.length === 14) {
      const ok = validarCNPJ(bruto);
      const fmt = bruto.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
      return {
        destaque: { rotulo: ok ? "CNPJ válido" : "CNPJ inválido", valor: fmt },
        linhas: [
          { rotulo: "Tipo", valor: "CNPJ (pessoa jurídica)" },
          { rotulo: "Formatado", valor: fmt },
          { rotulo: "Raiz", valor: fmt.slice(0, 10), detalhe: "Identifica a empresa; os 4 dígitos seguintes são a filial" },
          { rotulo: "Filial", valor: bruto.slice(8, 12) === "0001" ? "0001 — matriz" : `${bruto.slice(8, 12)} — filial` },
          {
            rotulo: "Dígito verificador", valor: ok ? "confere" : "não confere",
            estilo: ok ? "subtotal" : "desconto",
          },
        ],
        avisos: ["Dígito válido não significa CNPJ ativo. Confira a situação cadastral no site da Receita antes de emitir nota."],
      };
    }

    return {
      linhas: [],
      erro: `O documento tem ${bruto.length} dígitos. CPF tem 11 e CNPJ tem 14.`,
    };
  },
};

/* ======================================================================
   CATÁLOGO
   ====================================================================== */

export const FERRAMENTAS: Ferramenta[] = [
  salarioLiquido, rescisao, ferias, decimoTerceiro, horasExtras,
  simplesNacional, fatorR, lucroPresumido, proLabore, multaJuros, reformaTributaria,
  custoPorKm, custoImportacao,
  precoDeVenda, pontoEquilibrio, depreciacao, parcelamento,
  validadorDocumentos,
];

export const CATEGORIAS_FERRAMENTAS = [
  "Trabalhista", "Tributário", "Setorial", "Gestão", "Utilitário",
];

export function getFerramenta(slug: string): Ferramenta | undefined {
  return FERRAMENTAS.find((f) => f.slug === slug);
}

/** Nome amigável usado no painel administrativo. */
export function nomeDaFerramenta(slug: string): string {
  return getFerramenta(slug)?.nome ?? slug;
}
