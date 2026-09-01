export type Role = "aluno" | "empresa" | "admin";

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  role: Role;
  avatar?: string;
  cidade?: string;
  uf?: string;
  /* endereço — preenchido pelo CEP, ver `CamposEndereco` */
  cep?: string;
  logradouro?: string;
  bairro?: string;
  numero?: string;
  complemento?: string;
  crc?: string;
  cargo?: string;
  bio?: string;
  senioridade?: "Estagiário" | "Júnior" | "Pleno" | "Sênior" | "Especialista";
  habilidades?: string[];
  disponivel?: boolean;
  pretensao?: string;
  linkedin?: string;
  telefone?: string;
  /** Aparecer no banco de talentos e entregar o telefone são escolhas distintas. */
  contatoPublico?: boolean;
  /** Passou pela tela de boas-vindas. Conta criada pelo Google nasce `false`. */
  cadastroCompleto?: boolean;
  /** Quando a pessoa aceitou os termos e a LGPD. Exigido pelo cadastro. */
  consentimentoEm?: string;
  plano?: "Free" | "Pro" | "Enterprise";
  pontos?: number;
  nivel?: number;
  ofensiva?: number;
  /** Habilidades com procedência — ver `HabilidadeSelo`. */
  selos?: HabilidadeSelo[];
  /* administração */
  ativo?: boolean;
  ultimoAcesso?: string;
  motivoDesativacao?: string;
}

export type OrigemVideo = "nenhum" | "upload" | "youtube" | "vimeo" | "externo";

export interface Aula {
  id: string;
  titulo: string;
  duracaoMin: number;
  tipo: "video" | "quiz" | "material" | "ao-vivo";
  descricao?: string;
  gratuita?: boolean;
  /* vídeo */
  videoOrigem?: OrigemVideo;
  /** Caminho no bucket `videos` quando a origem é upload. */
  videoPath?: string;
  /** Link externo quando a origem é YouTube/Vimeo. */
  videoUrl?: string;
  videoNome?: string;
  /* avaliação pós-aula */
  quizAtivo?: boolean;
  quizQtd?: number;
  quizMinimo?: number;
  quizTentativas?: number;
}

export interface Modulo {
  id: string;
  titulo: string;
  resumo?: string;
  aulas: Aula[];
}

export interface Curso {
  id?: string;
  slug: string;
  titulo: string;
  subtitulo: string;
  descricao: string;
  categoria: string;
  nivel: "Iniciante" | "Intermediário" | "Avançado";
  /** O docente que ministrou o curso. É ele que assina o certificado, por isso
      é obrigatório para publicar — ver `ModalCurso`. */
  instrutor: string;
  instrutorCargo: string;
  /** CRC ou registro profissional, impresso sob a assinatura. */
  instrutorRegistro?: string;
  /** Imagem da assinatura (bucket `capas`). Sem ela, o certificado assina em
      tipografia — o nome sobre a linha, que é o que vale num documento. */
  instrutorAssinaturaUrl?: string;
  cargaHoraria: number;
  pontosPEPC: number;
  alunos: number;
  nota: number;
  tags: string[];
  destaque?: boolean;
  novo?: boolean;
  cor: string;
  publicado?: boolean;
  modulos: Modulo[];
}

export interface Vaga {
  id: string;
  titulo: string;
  empresa: string;
  logoCor: string;
  cidade: string;
  uf: string;
  modelo: "Presencial" | "Híbrido" | "Remoto";
  contrato: "CLT" | "PJ" | "Estágio" | "Freelance";
  /** Fiscal | Tributário | Contábil | Pessoal | Comex | Gestão. Mesmo
      vocabulário do banco de questões — ver 19_vagas_area_e_filtros.sql. */
  area?: string;
  faixa: string;
  senioridade: string;
  publicadaEm: string;
  requisitos: string[];
  certificacoesDesejadas: string[];
  trilhasDesejadas?: string[];
  descricao: string;
  candidatos: number;
  match?: number;
  /* Recrutamento — ver 20_docente_recrutamento_comunidade.sql.
     Não existe filtro de idade nem de cor sobre candidato: a Lei 9.029/1995
     proíbe. O que existe é vaga afirmativa, cota de PCD e requisito objetivo. */
  beneficios?: string[];
  jornada?: string;
  escolaridade?: string;
  experienciaMinAnos?: number | null;
  /** Vaga reservada a PCD — cota da Lei 8.213/1991, art. 93. */
  pcd?: boolean;
  afirmativaPara?: string[];
  acessibilidade?: string;
  /** Vaga confidencial: o mural não identifica a empresa. */
  sigilosa?: boolean;
}

export interface Certificado {
  id: string;
  perfilId?: string;
  cursoSlug: string;
  cursoTitulo: string;
  cargaHoraria: number;
  emitidoEm: string;
  codigo: string;
  pontosPEPC: number;
  /** Quem assina. Vem do curso no momento em que o certificado é montado; no
      banco também fica gravado na emissão, para o documento não mudar de
      assinatura se o curso trocar de docente depois. */
  docente?: string;
  docenteCargo?: string;
  docenteRegistro?: string;
  docenteAssinaturaUrl?: string;
}

export interface Progresso {
  cursoSlug: string;
  aulasConcluidas: string[];
  ultimaAulaId: string;
  atualizadoEm: string;
}

/* ==========================================================================
   TRILHAS DE CARREIRA
   ========================================================================== */
export interface Trilha {
  id: string;
  slug: string;
  nome: string;
  subtitulo?: string;
  descricao?: string;
  cargoAlvo: string;
  area: string;
  nivelEntrada: string;
  nivelSaida: string;
  cor: string;
  icone?: string;
  faixaSalarial?: string;
  cursos: Array<{ slug: string; titulo: string; ordem: number; obrigatorio: boolean; cargaHoraria: number }>;
  habilidades: Array<{ nome: string; nivelEsperado: number }>;
  cargaHoraria: number;
  pontosPEPC: number;
}

export interface CertificadoTrilha {
  id: string;
  perfilId?: string;
  trilhaSlug: string;
  trilhaNome: string;
  codigo: string;
  cargaHoraria: number;
  pontosPEPC: number;
  emitidoEm: string;
}

/* ==========================================================================
   GAMIFICAÇÃO
   ========================================================================== */
export interface Conquista {
  id: string;
  slug: string;
  nome: string;
  descricao?: string;
  icone: string;
  xp: number;
  categoria: string;
  raridade: "comum" | "raro" | "epico" | "lendario";
  recompensa?: string;
  criterio?: { metrica?: string; meta?: number; dias?: number };
  obtida: boolean;
  obtidaEm?: string;
}

export interface Missao {
  id: string;
  slug: string;
  titulo: string;
  descricao?: string;
  icone: string;
  periodo: "diaria" | "semanal" | "mensal";
  metrica: string;
  meta: number;
  xp: number;
  recompensa?: string;
  progresso: number;
  concluida: boolean;
}

export interface EventoXP {
  id: number;
  tipo: string;
  xp: number;
  descricao?: string;
  criadoEm: string;
}

export interface DiaEstudo {
  dia: string;
  minutos: number;
  aulas: number;
}

/* ==========================================================================
   COMUNIDADE
   ========================================================================== */
export interface Post {
  id: string;
  autorId: string;
  autorNome: string;
  autorCargo?: string;
  autorNivel?: number;
  empresaNome?: string;
  empresaCor?: string;
  tipo: "texto" | "conquista" | "certificado" | "vaga" | "artigo" | "anuncio";
  conteudo: string;
  linkUrl?: string;
  criadoEm: string;
  curtidas: number;
  curtiu: boolean;
  comentarios: Comentario[];
  /** Fotos e arquivos anexados à publicação. */
  midias?: MidiaDoPost[];
}

export interface MidiaDoPost {
  tipo: "imagem" | "arquivo";
  url: string;
  nome: string;
  bytes?: number;
}

export interface Comentario {
  id: string;
  perfilId: string;
  autorNome: string;
  autorCargo?: string;
  conteudo: string;
  criadoEm: string;
}

export interface Conexao {
  id: string;
  perfilId: string;
  nome: string;
  cargo?: string;
  cidade?: string;
  uf?: string;
  status: "pendente" | "aceita" | "recusada";
  souSolicitante: boolean;
}

/* --------------------------------------------------- colegas e conversas -- */

/** Uma pessoa devolvida pela busca, já com o pé em que está a conexão. */
export interface Colega {
  id: string;
  nome: string;
  cargo?: string;
  cidade?: string;
  uf?: string;
  senioridade?: string;
  nivel?: number;
  avatarUrl?: string;
  crc?: string;
  habilidades: string[];
  conexao?: {
    id: string;
    status: "pendente" | "aceita" | "recusada";
    souSolicitante: boolean;
  } | null;
}

export interface Conversa {
  id: string;
  atualizadoEm: string;
  outro: { id: string; nome: string; cargo?: string; avatarUrl?: string };
  ultima?: { conteudo: string; criadoEm: string; minha: boolean };
  naoLidas: number;
}

export interface Mensagem {
  id: string;
  conversaId: string;
  remetenteId: string;
  conteudo: string;
  criadoEm: string;
  lida: boolean;
}

/* ==========================================================================
   BANCO DE QUESTÕES
   ========================================================================== */
export interface Alternativa {
  id: string;
  texto: string;
}

export interface QuestaoBanco {
  id: string;
  enunciado: string;
  alternativas: Alternativa[];
  correta: string;
  explicacao?: string;
  area: string;
  assunto: string;
  nivel: string;
  banca?: string;
  ano?: number;
  tags: string[];
  /** De onde a questão veio: escrita à mão, gerada por IA ou tirada de prova. */
  origem?: "manual" | "ia" | "prova";
  /** Nome da prova quando `origem = 'prova'` (ex.: "CFC 2024.2"). */
  prova?: string;
  ativa?: boolean;
  atualizadoEm?: string;
}

export interface Caderno {
  id: string;
  nome: string;
  descricao?: string;
  cor: string;
  total: number;
  criadoEm: string;
}

/**
 * Uma questão como ela foi respondida naquele simulado.
 *
 * O enunciado vem copiado de propósito: o simulado é um registro do que
 * aconteceu. Se a questão for corrigida ou removida depois, o histórico do
 * aluno não pode mudar junto — nem sumir.
 */
export interface RespostaSimulado {
  questaoId: string;
  enunciado: string;
  area: string;
  assunto: string;
  nivel: string;
  marcada: string;
  correta: string;
  textoCorreta?: string;
  acertou: boolean;
}

export interface ResultadoSimulado {
  id: string;
  nome: string;
  total: number;
  acertos: number;
  nota: number;
  finalizadoEm?: string;
  respostas?: RespostaSimulado[];
  /** Análise do Tino, gerada uma vez sob demanda e guardada. */
  feedback?: string;
  feedbackEm?: string;
}

/* ==========================================================================
   PLANOS
   ========================================================================== */
export interface Plano {
  slug: "free" | "pro" | "empresarial";
  nome: string;
  preco: string;
  precoAnual?: string;
  periodo: string;
  chamada: string;
  destaque?: boolean;
  recursos: Array<{ texto: string; incluso: boolean; destaque?: boolean }>;
  limites: { questoesPorDia: number | "ilimitado"; iaExplicacoes: boolean; cadernos: number | "ilimitado" };
  cta: string;
}


/* ==========================================================================
   AVALIAÇÃO PÓS-AULA
   O gabarito nunca chega ao navegador antes da resposta: a questão vem por
   RPC sem o campo `correta`, e a correção acontece no banco.
   ========================================================================== */
export interface QuestaoAula {
  id: string;
  enunciado: string;
  alternativas: Alternativa[];
  /** Só existe na área administrativa. */
  correta?: string;
  explicacao?: string;
  ordem?: number;
}

export interface StatusQuiz {
  ativo: boolean;
  questoesNoBanco: number;
  qtd: number;
  minimo: number;
  tentativasMax: number;
  tentativasUsadas: number;
  aprovada: boolean;
}

export interface ResultadoQuiz {
  acertos: number;
  total: number;
  minimo: number;
  aprovada: boolean;
  tentativasUsadas: number;
  tentativasMax: number;
  gabarito: Array<{
    questaoId: string;
    correta: string;
    marcada: string | null;
    acertou: boolean;
    explicacao?: string;
  }>;
}

/* ==========================================================================
   SELOS DE HABILIDADE

   A habilidade deixou de ser autodeclarada: ela vem do certificado. O nível
   do selo é o nível do curso que a concedeu — e a trilha completa promove
   tudo que ela cobre para ouro.
   ========================================================================== */
export type Selo = "bronze" | "prata" | "ouro";

export interface HabilidadeSelo {
  nome: string;
  /** `null` nas habilidades declaradas no perfil antigo, sem verificação. */
  selo: Selo | null;
  origem: "manual" | "curso" | "trilha";
  nivel: number;
  cursoSlug?: string;
  cursoTitulo?: string;
  trilhaSlug?: string;
  trilhaNome?: string;
  obtidaEm?: string;
}

/** Selo dourado de trilha concluída, com as habilidades que ele representa. */
export interface SeloTrilhaDados {
  slug: string;
  nome: string;
  cor: string;
  codigo: string;
  cargaHoraria: number;
  pontosPEPC: number;
  emitidoEm: string;
  habilidades: string[];
  avaliada?: boolean;
  /** Fechada agora, por este curso — e não uma trilha antiga que o contém. */
  nova?: boolean;
}

/** Retorno de `resumo_conclusao_curso` — alimenta a tela de parabéns. */
export interface ResumoConclusao {
  totalAulas: number;
  aulasFeitas: number;
  concluido: boolean;
  certificado: {
    codigo: string;
    cargaHoraria: number;
    pontosPEPC: number;
    emitidoEm: string;
  } | null;
  habilidades: Array<{ nome: string; selo: Selo | null }>;
  trilhas: SeloTrilhaDados[];
  avaliado: boolean;
}

/* ==========================================================================
   ESTATÍSTICAS DO BANCO DE QUESTÕES
   ========================================================================== */
export interface RespostaRegistrada {
  id: string;
  questaoId: string;
  alternativa: string;
  correta: boolean;
  segundos?: number;
  criadoEm: string;
  area: string;
  assunto: string;
  nivel: string;
}

/* ==========================================================================
   VALIDAÇÃO PÚBLICA DO CERTIFICADO
   ========================================================================== */
export interface CertificadoValidado {
  valido: boolean;
  motivo?: "sem-codigo" | "nao-encontrado";
  tipo?: "curso" | "trilha";
  aluno?: string;
  titulo?: string;
  area?: string;
  nivel?: string;
  cargaHoraria?: number;
  pontosPEPC?: number;
  emitidoEm?: string;
  codigo?: string;
  habilidades?: string[];
  /** Quem ministrou e assina. O RH que confere o código vê a mesma assinatura
      que está no PDF que recebeu. */
  docente?: string;
  docenteCargo?: string;
  docenteRegistro?: string;
  docenteAssinaturaUrl?: string;
}

/* ==========================================================================
   REVISÃO ESPAÇADA
   ========================================================================== */
export interface QuestaoParaRevisar {
  questaoId: string;
  enunciado: string;
  area: string;
  assunto: string;
  nivel: string;
  tentativas: number;
  acertos: number;
  /** Acertos seguidos contando da tentativa mais recente para trás. */
  sequencia: number;
  ultimaEm: string;
  diasDeAtraso: number;
}
