import type { Curso, Vaga, Perfil, Certificado } from "./types";

/* ==========================================================================
   SEED DE DEMONSTRAÇÃO
   Espelha 1:1 as tabelas de supabase/schema.sql. Quando o Supabase for
   conectado, trocar as funções deste arquivo por queries — a interface
   pública (getCursos, getCurso, getVagas...) permanece a mesma.
   ========================================================================== */

export const cursos: Curso[] = [
  {
    slug: "reforma-tributaria-na-pratica",
    titulo: "Reforma Tributária na Prática",
    subtitulo: "CBS, IBS e Imposto Seletivo aplicados à operação real",
    descricao:
      "Da leitura da EC 132 à reprecificação de contratos: como conduzir a transição sem perder margem. Casos reais de transporte, armazenagem e comércio exterior.",
    categoria: "Tributário",
    nivel: "Avançado",
    instrutor: "Adílio Castelo Branco",
    instrutorCargo: "Contador — 20+ anos em tributário complexo",
    instrutorRegistro: "CRC BA-042118/O-7",
    cargaHoraria: 18,
    pontosPEPC: 18,
    alunos: 1284,
    nota: 4.9,
    tags: ["CBS", "IBS", "Split payment", "Crédito"],
    destaque: true,
    novo: true,
    cor: "#00204D",
    modulos: [
      {
        id: "m1",
        titulo: "Fundamentos da EC 132/2023",
        resumo: "O novo desenho constitucional do consumo",
        aulas: [
          { id: "a1", titulo: "Por que o sistema antigo quebrou", duracaoMin: 14, tipo: "video", gratuita: true, descricao: "Cumulatividade, guerra fiscal e o custo invisível do contencioso." },
          { id: "a2", titulo: "CBS, IBS e Imposto Seletivo: quem cobra o quê", duracaoMin: 22, tipo: "video", gratuita: true },
          { id: "a3", titulo: "Cronograma de transição 2026–2033", duracaoMin: 17, tipo: "video" },
          { id: "a4", titulo: "Quiz — mapa mental da reforma", duracaoMin: 8, tipo: "quiz" },
        ],
      },
      {
        id: "m2",
        titulo: "Crédito financeiro e não cumulatividade plena",
        resumo: "O maior ganho — e a maior armadilha",
        aulas: [
          { id: "a5", titulo: "O que passa a gerar crédito", duracaoMin: 26, tipo: "video" },
          { id: "a6", titulo: "Split payment: o crédito condicionado ao pagamento", duracaoMin: 19, tipo: "video" },
          { id: "a7", titulo: "Planilha — simulador de crédito", duracaoMin: 5, tipo: "material" },
          { id: "a8", titulo: "Estudo de caso: transportadora com 40 filiais", duracaoMin: 31, tipo: "video" },
        ],
      },
      {
        id: "m3",
        titulo: "Reprecificação e contratos",
        resumo: "Traduzir alíquota em decisão comercial",
        aulas: [
          { id: "a9", titulo: "Repasse, absorção e renegociação de frete", duracaoMin: 24, tipo: "video" },
          { id: "a10", titulo: "Cláusulas de revisão tributária", duracaoMin: 18, tipo: "video" },
          { id: "a11", titulo: "Mentoria ao vivo — tira-dúvidas", duracaoMin: 60, tipo: "ao-vivo" },
          { id: "a12", titulo: "Avaliação final", duracaoMin: 20, tipo: "quiz" },
        ],
      },
    ],
  },
  {
    slug: "recuperacao-de-creditos-tributarios",
    titulo: "Recuperação de Créditos Tributários",
    subtitulo: "Método de revisão dos últimos 60 meses",
    descricao:
      "Levantamento, cruzamento e habilitação de créditos com sustentação documental. Do diagnóstico ao PER/DCOMP, com governança e trilha de auditoria.",
    categoria: "Tributário",
    nivel: "Avançado",
    instrutor: "Adílio Castelo Branco",
    instrutorCargo: "Contador — Consultoria tributária",
    instrutorRegistro: "CRC BA-051447/O-2",
    cargaHoraria: 22,
    pontosPEPC: 22,
    alunos: 968,
    nota: 4.8,
    tags: ["PIS/COFINS", "PER/DCOMP", "Revisão", "ICMS-ST"],
    destaque: true,
    cor: "#0D3563",
    modulos: [
      {
        id: "m1",
        titulo: "Diagnóstico e triagem",
        aulas: [
          { id: "a1", titulo: "Onde o crédito costuma se esconder", duracaoMin: 20, tipo: "video", gratuita: true },
          { id: "a2", titulo: "Coleta de SPED, EFD e notas", duracaoMin: 25, tipo: "video" },
          { id: "a3", titulo: "Checklist de triagem", duracaoMin: 6, tipo: "material" },
        ],
      },
      {
        id: "m2",
        titulo: "Teses seguras x teses de risco",
        aulas: [
          { id: "a4", titulo: "Insumo: o conceito que decide o caso", duracaoMin: 28, tipo: "video" },
          { id: "a5", titulo: "ICMS-ST e substituição na cadeia logística", duracaoMin: 23, tipo: "video" },
          { id: "a6", titulo: "A camada vedada: o que nunca compensar", duracaoMin: 16, tipo: "video" },
          { id: "a7", titulo: "Quiz de classificação de risco", duracaoMin: 12, tipo: "quiz" },
        ],
      },
      {
        id: "m3",
        titulo: "Execução e defesa",
        aulas: [
          { id: "a8", titulo: "PER/DCOMP passo a passo", duracaoMin: 34, tipo: "video" },
          { id: "a9", titulo: "Dossiê de sustentação e auditoria", duracaoMin: 21, tipo: "video" },
          { id: "a10", titulo: "Projeto final avaliado", duracaoMin: 45, tipo: "quiz" },
        ],
      },
    ],
  },
  {
    slug: "contabilidade-para-transporte-e-logistica",
    titulo: "Contabilidade para Transporte e Logística",
    subtitulo: "CT-e, MDF-e, frete e custo por rota",
    descricao:
      "A rotina fiscal de quem move carga: documentos eletrônicos, regimes especiais, custo por rota e os erros que viram autuação.",
    categoria: "Setorial",
    nivel: "Intermediário",
    instrutor: "Equipe Castelo Branco",
    instrutorCargo: "Time de contabilidade setorial",
    instrutorRegistro: "CRC BA-033902/O-4",
    cargaHoraria: 16,
    pontosPEPC: 16,
    alunos: 742,
    nota: 4.7,
    tags: ["CT-e", "MDF-e", "Frete", "Custo por rota"],
    cor: "#2F6E75",
    modulos: [
      {
        id: "m1",
        titulo: "Documentos eletrônicos do transporte",
        aulas: [
          { id: "a1", titulo: "CT-e na prática", duracaoMin: 27, tipo: "video", gratuita: true },
          { id: "a2", titulo: "MDF-e e encerramento", duracaoMin: 19, tipo: "video" },
          { id: "a3", titulo: "Erros que geram autuação", duracaoMin: 22, tipo: "video" },
        ],
      },
      {
        id: "m2",
        titulo: "Custo, margem e precificação de frete",
        aulas: [
          { id: "a4", titulo: "Custo por rota e por km", duracaoMin: 30, tipo: "video" },
          { id: "a5", titulo: "Planilha de formação de frete", duracaoMin: 8, tipo: "material" },
          { id: "a6", titulo: "Avaliação", duracaoMin: 15, tipo: "quiz" },
        ],
      },
    ],
  },
  {
    slug: "comercio-exterior-e-rotina-aduaneira",
    titulo: "Comércio Exterior e Rotina Aduaneira",
    subtitulo: "Importação, exportação e controle de risco",
    descricao:
      "Classificação fiscal, regimes aduaneiros especiais, drawback e o controle documental que evita autuação na Receita.",
    categoria: "Setorial",
    nivel: "Avançado",
    instrutor: "Equipe Castelo Branco",
    instrutorCargo: "Especialistas em comex",
    instrutorRegistro: "CRC BA-047765/O-9",
    cargaHoraria: 20,
    pontosPEPC: 20,
    alunos: 531,
    nota: 4.8,
    tags: ["NCM", "Drawback", "Siscomex", "Aduaneiro"],
    novo: true,
    cor: "#B88A45",
    modulos: [
      {
        id: "m1",
        titulo: "Classificação e tributos na importação",
        aulas: [
          { id: "a1", titulo: "NCM: o erro mais caro do comex", duracaoMin: 25, tipo: "video", gratuita: true },
          { id: "a2", titulo: "Base de cálculo na importação", duracaoMin: 29, tipo: "video" },
          { id: "a3", titulo: "Quiz de classificação", duracaoMin: 10, tipo: "quiz" },
        ],
      },
      {
        id: "m2",
        titulo: "Regimes especiais",
        aulas: [
          { id: "a4", titulo: "Drawback: suspensão, isenção e restituição", duracaoMin: 33, tipo: "video" },
          { id: "a5", titulo: "Entreposto e admissão temporária", duracaoMin: 24, tipo: "video" },
          { id: "a6", titulo: "Dossiê aduaneiro modelo", duracaoMin: 7, tipo: "material" },
        ],
      },
    ],
  },
  {
    slug: "departamento-fiscal-do-zero",
    titulo: "Departamento Fiscal do Zero",
    subtitulo: "Formação inicial para quem vai operar a rotina",
    descricao:
      "Trilha de entrada: regimes, obrigações acessórias, calendário fiscal e organização de documentos. A base que todo escritório cobra.",
    categoria: "Formação",
    nivel: "Iniciante",
    instrutor: "Equipe Castelo Branco",
    instrutorCargo: "Formação profissional",
    instrutorRegistro: "CRC BA-039218/O-1",
    cargaHoraria: 24,
    pontosPEPC: 24,
    alunos: 2103,
    nota: 4.9,
    tags: ["Simples Nacional", "SPED", "Obrigações acessórias"],
    destaque: true,
    cor: "#00204D",
    modulos: [
      {
        id: "m1",
        titulo: "Regimes tributários",
        aulas: [
          { id: "a1", titulo: "Simples, Presumido e Real: quando cada um", duracaoMin: 31, tipo: "video", gratuita: true },
          { id: "a2", titulo: "Anexos e fator R", duracaoMin: 22, tipo: "video" },
          { id: "a3", titulo: "Quiz de enquadramento", duracaoMin: 12, tipo: "quiz" },
        ],
      },
      {
        id: "m2",
        titulo: "Obrigações acessórias",
        aulas: [
          { id: "a4", titulo: "Calendário fiscal anual", duracaoMin: 18, tipo: "video" },
          { id: "a5", titulo: "SPED Fiscal e Contribuições", duracaoMin: 35, tipo: "video" },
          { id: "a6", titulo: "Organização de documentos", duracaoMin: 16, tipo: "video" },
        ],
      },
      {
        id: "m3",
        titulo: "Rotina do escritório",
        aulas: [
          { id: "a7", titulo: "Fechamento mensal sem retrabalho", duracaoMin: 27, tipo: "video" },
          { id: "a8", titulo: "Comunicação com o cliente", duracaoMin: 19, tipo: "video" },
          { id: "a9", titulo: "Avaliação final", duracaoMin: 25, tipo: "quiz" },
        ],
      },
    ],
  },
  {
    slug: "contabilidade-consultiva-e-gestao",
    titulo: "Contabilidade Consultiva",
    subtitulo: "De guarda-livros a conselheiro do cliente",
    descricao:
      "Como transformar número fiscal em decisão de caixa, contrato e margem. Método de reunião executiva, indicadores e precificação de honorários.",
    categoria: "Gestão",
    nivel: "Intermediário",
    instrutor: "Adílio Castelo Branco",
    instrutorCargo: "Contabilidade consultiva",
    instrutorRegistro: "CRC BA-050331/O-5",
    cargaHoraria: 14,
    pontosPEPC: 14,
    alunos: 655,
    nota: 4.9,
    tags: ["Consultivo", "Honorários", "Indicadores", "Cliente"],
    cor: "#0D3563",
    modulos: [
      {
        id: "m1",
        titulo: "O ritual de gestão",
        aulas: [
          { id: "a1", titulo: "A reunião que o cliente não falta", duracaoMin: 23, tipo: "video", gratuita: true },
          { id: "a2", titulo: "Indicadores que importam", duracaoMin: 26, tipo: "video" },
          { id: "a3", titulo: "Template de relatório executivo", duracaoMin: 6, tipo: "material" },
        ],
      },
      {
        id: "m2",
        titulo: "Precificação de honorários",
        aulas: [
          { id: "a4", titulo: "Sair da tabela e vender valor", duracaoMin: 28, tipo: "video" },
          { id: "a5", titulo: "Proposta comercial que fecha", duracaoMin: 21, tipo: "video" },
          { id: "a6", titulo: "Avaliação", duracaoMin: 15, tipo: "quiz" },
        ],
      },
    ],
  },
];

export const vagas: Vaga[] = [
  {
    id: "v1",
    titulo: "Analista Fiscal Pleno — Transporte",
    empresa: "TransLog Brasil",
    logoCor: "#00204D",
    cidade: "Feira de Santana",
    uf: "BA",
    modelo: "Híbrido",
    contrato: "CLT",
    area: "Fiscal",
    faixa: "R$ 5.500 – R$ 7.200",
    senioridade: "Pleno",
    publicadaEm: "2026-08-20",
    requisitos: ["CT-e / MDF-e", "SPED Fiscal", "Excel avançado", "CRC ativo"],
    certificacoesDesejadas: ["contabilidade-para-transporte-e-logistica"],
    descricao:
      "Responsável pela apuração fiscal de uma frota de 180 veículos, conferência de CT-e/MDF-e e suporte ao fechamento mensal.",
    candidatos: 34,
    match: 92,
    beneficios: ["VA/VR", "Plano de saúde", "Auxílio home office", "PLR"],
    jornada: "Integral",
    escolaridade: "Superior completo",
    experienciaMinAnos: 3,
    afirmativaPara: ["Pessoas negras"],
  },
  {
    id: "v2",
    titulo: "Consultor Tributário — Reforma",
    empresa: "Fisconta Online",
    logoCor: "#B88A45",
    cidade: "Salvador",
    uf: "BA",
    modelo: "Remoto",
    contrato: "PJ",
    area: "Tributário",
    faixa: "R$ 9.000 – R$ 14.000",
    senioridade: "Sênior",
    publicadaEm: "2026-08-24",
    requisitos: ["EC 132", "CBS/IBS", "Reprecificação", "Atendimento a clientes"],
    certificacoesDesejadas: ["reforma-tributaria-na-pratica"],
    descricao:
      "Conduzir projetos de transição para a Reforma Tributária em clientes de logística e distribuição.",
    candidatos: 58,
    match: 88,
  },
  {
    id: "v3",
    titulo: "Analista de Comércio Exterior Jr.",
    empresa: "China Direta",
    logoCor: "#2F6E75",
    cidade: "São Paulo",
    uf: "SP",
    modelo: "Presencial",
    contrato: "CLT",
    area: "Comex",
    faixa: "R$ 3.200 – R$ 4.100",
    senioridade: "Júnior",
    publicadaEm: "2026-08-18",
    requisitos: ["NCM", "Siscomex", "Inglês intermediário"],
    certificacoesDesejadas: ["comercio-exterior-e-rotina-aduaneira"],
    descricao:
      "Apoio na abertura de DI, conferência documental e acompanhamento de desembaraço.",
    candidatos: 121,
    match: 74,
  },
  {
    id: "v4",
    titulo: "Contador Responsável Técnico",
    empresa: "Focus Empresarial",
    logoCor: "#0D3563",
    cidade: "Feira de Santana",
    uf: "BA",
    modelo: "Presencial",
    contrato: "CLT",
    area: "Contábil",
    faixa: "R$ 8.000 – R$ 11.000",
    senioridade: "Sênior",
    publicadaEm: "2026-08-12",
    requisitos: ["CRC ativo", "Lucro Real", "Gestão de equipe", "Consultivo"],
    certificacoesDesejadas: ["contabilidade-consultiva-e-gestao", "recuperacao-de-creditos-tributarios"],
    descricao:
      "Responsabilidade técnica por carteira de 60 empresas e liderança de time de 6 pessoas.",
    candidatos: 27,
    match: 81,
  },
  {
    id: "v5",
    titulo: "Estágio em Departamento Fiscal",
    empresa: "Castelo Branco Contabilidade",
    logoCor: "#C89F50",
    cidade: "Feira de Santana",
    uf: "BA",
    modelo: "Presencial",
    contrato: "Estágio",
    area: "Fiscal",
    faixa: "R$ 1.400 + benefícios",
    senioridade: "Estagiário",
    publicadaEm: "2026-08-25",
    requisitos: ["Cursando Ciências Contábeis", "Excel", "Vontade de aprender"],
    certificacoesDesejadas: ["departamento-fiscal-do-zero"],
    descricao:
      "Programa de formação com trilha obrigatória na Academy e mentoria semanal.",
    candidatos: 89,
    match: 96,
    pcd: true,
    acessibilidade: "Escritório térreo, sanitário adaptado e leitor de tela nas estações.",
    beneficios: ["VT", "VR", "Bolsa-auxílio"],
  },
];

export const talentos: Perfil[] = [
  {
    id: "t1", nome: "Mariana Alves", email: "mariana@exemplo.com", role: "aluno",
    cidade: "Feira de Santana", uf: "BA", crc: "BA-123456/O-1", cargo: "Analista Fiscal",
    senioridade: "Pleno", disponivel: true, pretensao: "R$ 6.000 – R$ 7.500",
    habilidades: ["SPED", "CT-e", "Lucro Real", "Excel avançado", "Power BI"],
    bio: "5 anos em departamento fiscal de transportadoras. Especialista em conferência de CT-e e apuração de ICMS interestadual.",
    linkedin: "https://linkedin.com/in/exemplo", pontos: 4820, nivel: 7,
  },
  {
    id: "t2", nome: "Rafael Nogueira", email: "rafael@exemplo.com", role: "aluno",
    cidade: "Salvador", uf: "BA", crc: "BA-098765/O-3", cargo: "Consultor Tributário",
    senioridade: "Sênior", disponivel: true, pretensao: "R$ 12.000 – R$ 16.000",
    habilidades: ["Reforma Tributária", "Recuperação de créditos", "PER/DCOMP", "Contencioso"],
    bio: "12 anos em consultoria. Conduziu 30+ projetos de revisão tributária em logística e distribuição.",
    pontos: 9140, nivel: 11,
  },
  {
    id: "t3", nome: "Camila Duarte", email: "camila@exemplo.com", role: "aluno",
    cidade: "São Paulo", uf: "SP", cargo: "Analista de Comex",
    senioridade: "Júnior", disponivel: true, pretensao: "R$ 3.500 – R$ 4.500",
    habilidades: ["NCM", "Siscomex", "Inglês avançado", "Drawback"],
    bio: "Formada em Comércio Exterior, 2 anos em despachante aduaneiro. Buscando atuar no lado contábil da operação.",
    pontos: 2310, nivel: 4,
  },
  {
    id: "t4", nome: "João Pedro Lima", email: "joao@exemplo.com", role: "aluno",
    cidade: "Recife", uf: "PE", crc: "PE-445566/O-2", cargo: "Contador",
    senioridade: "Especialista", disponivel: false, pretensao: "A combinar",
    habilidades: ["Lucro Real", "Consultivo", "Gestão de equipe", "IFRS"],
    bio: "Responsável técnico por carteira de 80 empresas. Foco em contabilidade consultiva.",
    pontos: 7650, nivel: 9,
  },
  {
    id: "t5", nome: "Beatriz Santana", email: "beatriz@exemplo.com", role: "aluno",
    cidade: "Feira de Santana", uf: "BA", cargo: "Auxiliar Contábil",
    senioridade: "Estagiário", disponivel: true, pretensao: "R$ 1.500 – R$ 2.000",
    habilidades: ["Simples Nacional", "Conciliação", "Excel"],
    bio: "Cursando 6º semestre de Ciências Contábeis. Concluiu a trilha Departamento Fiscal do Zero com nota 9,4.",
    pontos: 1580, nivel: 3,
  },
  {
    id: "t6", nome: "Diego Farias", email: "diego@exemplo.com", role: "aluno",
    cidade: "Curitiba", uf: "PR", crc: "PR-778899/O-5", cargo: "Coordenador Fiscal",
    senioridade: "Pleno", disponivel: true, pretensao: "R$ 8.000 – R$ 9.500",
    habilidades: ["EFD-Reinf", "eSocial", "Automação", "Python"],
    bio: "Automatizou o fechamento fiscal de um grupo com 12 CNPJs, reduzindo o ciclo de 9 para 3 dias.",
    pontos: 6020, nivel: 8,
  },
];

/** Certificados do usuário demo. */
export const certificados: Certificado[] = [
  {
    id: "c1",
    cursoSlug: "departamento-fiscal-do-zero",
    cursoTitulo: "Departamento Fiscal do Zero",
    cargaHoraria: 24,
    emitidoEm: "2026-06-14",
    codigo: "CBA-2026-8F3D-9K21",
    pontosPEPC: 24,
  },
  {
    id: "c2",
    cursoSlug: "contabilidade-para-transporte-e-logistica",
    cursoTitulo: "Contabilidade para Transporte e Logística",
    cargaHoraria: 16,
    emitidoEm: "2026-07-30",
    codigo: "CBA-2026-1A7C-4M88",
    pontosPEPC: 16,
  },
];

/* ------------------------------ Acessores ------------------------------- */
export const getCursos = () => cursos;
export const getCurso = (slug: string) => cursos.find((c) => c.slug === slug);
export const getVagas = () => vagas;
export const getVaga = (id: string) => vagas.find((v) => v.id === id);
export const getTalentos = () => talentos;
export const getTalento = (id: string) => talentos.find((t) => t.id === id);
export const getCertificados = () => certificados;

export const totalAulas = (c: Curso) =>
  c.modulos.reduce((acc, m) => acc + m.aulas.length, 0);

export const todasAulas = (c: Curso) =>
  c.modulos.flatMap((m) =>
    m.aulas.map((a) => ({ ...a, moduloId: m.id, moduloTitulo: m.titulo }))
  );

export const categorias = [...new Set(cursos.map((c) => c.categoria))];
export const habilidadesDisponiveis = [
  ...new Set(talentos.flatMap((t) => t.habilidades ?? [])),
].sort();
