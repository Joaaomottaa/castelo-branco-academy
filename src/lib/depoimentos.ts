/* ==========================================================================
   DEPOIMENTOS DA PÁGINA INICIAL

   ⚠️  CONTEÚDO DE VITRINE, NÃO DEPOIMENTO REAL.

   Os nomes, os textos e as fotos abaixo são material de composição, no mesmo
   espírito do resto do seed (`data.ts`): existem para a página ter a forma
   final antes de haver aluno formado para depor. As fotos vêm do
   randomuser.me, um conjunto livre para prototipagem.

   ANTES DE O SITE IR AO AR PARA VALER, isto tem de ser substituído por
   depoimento real, com autorização de uso de imagem e nome. Publicar avaliação
   inventada como se fosse de aluno é propaganda enganosa — e, num produto que
   vende certificado com validação pública, é justamente a credibilidade que
   está sendo vendida. Está registrado em docs/PENDENCIAS.md (item 9.8).

   A média e a contagem exibidas ao lado NÃO vêm daqui: são calculadas do
   catálogo real, em `page.tsx`. Número agregado inventado seria mentira de
   outra natureza — essa dá para evitar desde já.
   ========================================================================== */

export interface Depoimento {
  nome: string;
  cargo: string;
  cidade: string;
  foto: string;
  nota: number;
  texto: string;
  /** Curso ou trilha que a pessoa concluiu — dá contexto ao elogio. */
  formacao: string;
}

export const depoimentos: Depoimento[] = [
  {
    nome: "Ana Beatriz Ferreira",
    cargo: "Analista fiscal",
    cidade: "Feira de Santana/BA",
    foto: "/depoimentos/ana.jpg",
    nota: 5,
    texto:
      "Eu travava toda vez que o cliente perguntava sobre CBS e IBS. Fiz a trilha "
      + "de Reforma Tributária e na semana seguinte montei sozinha o comparativo "
      + "de carga para três clientes. O curso não fica na teoria: é a planilha "
      + "que você usa na segunda de manhã.",
    formacao: "Reforma Tributária na Prática",
  },
  {
    nome: "Carlos Eduardo Menezes",
    cargo: "Contador — escritório próprio",
    cidade: "Salvador/BA",
    foto: "/depoimentos/carlos.jpg",
    nota: 5,
    texto:
      "O banco de questões mudou meu jeito de estudar. Errei, o Tino explicou "
      + "onde meu raciocínio virou, e a questão voltou três dias depois na "
      + "revisão. Passei no CFC de primeira depois de duas tentativas frustradas "
      + "em outro lugar.",
    formacao: "Trilha Especialista Tributário",
  },
  {
    nome: "Juliana Rocha",
    cargo: "Controller",
    cidade: "São Paulo/SP",
    foto: "/depoimentos/juliana.jpg",
    nota: 5,
    texto:
      "Coloquei os quatro analistas do meu time na plataforma. Em três meses "
      + "fechei o relatório de educação continuada com código de validação por "
      + "certificado — antes eu montava isso à mão, em planilha, catando PDF no "
      + "e-mail de cada um.",
    formacao: "Contabilidade Gerencial e Controladoria",
  },
  {
    nome: "Rodrigo Aparecido Lima",
    cargo: "Coordenador fiscal — transportadora",
    cidade: "Feira de Santana/BA",
    foto: "/depoimentos/rodrigo.jpg",
    nota: 5,
    texto:
      "Não existe curso de contabilidade para transporte que fale a língua de "
      + "quem vive CT-e e crédito presumido. Esse fala. A calculadora de custo "
      + "por quilômetro rodado eu uso toda semana, fora da aula.",
    formacao: "Contabilidade para Transporte e Logística",
  },
  {
    nome: "Patrícia Nogueira",
    cargo: "Analista de comércio exterior",
    cidade: "Salvador/BA",
    foto: "/depoimentos/patricia.jpg",
    nota: 5,
    texto:
      "Entrei sem saber a diferença entre drawback suspensão e isenção. Saí "
      + "montando planilha de custo de importação do FOB ao ICMS por dentro. O "
      + "certificado com link público foi o que me tirou da pilha de currículos "
      + "na entrevista.",
    formacao: "Trilha Analista de Comércio Exterior",
  },
];
