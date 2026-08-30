# Ferramentas de cálculo

18 calculadoras para a rotina do escritório, em `/app/ferramentas`.

O que elas fazem pelo negócio: dão motivo para o aluno abrir a plataforma nos
dias em que não vai estudar. Quem entra para calcular uma rescisão vê o
catálogo, o fórum e a trilha. E o que a base mais calcula aparece no painel
administrativo — é demanda declarada, não pesquisa de opinião.

---

## O catálogo

### Trabalhista

| Ferramenta | O que resolve |
|---|---|
| **Salário líquido** | Do bruto ao que cai na conta: INSS progressivo, IRRF, VT, plano |
| **Rescisão de contrato** | Saldo, aviso, 13º e férias proporcionais, FGTS e multa por motivo de saída |
| **Férias** | Com 1/3, abono pecuniário e adiantamento do 13º |
| **13º salário** | Primeira e segunda parcela, com os descontos só na segunda |
| **Horas extras e DSR** | Adicional de 50% e 100% com o reflexo no descanso semanal |

### Tributário

| Ferramenta | O que resolve |
|---|---|
| **Simples Nacional — DAS** | Alíquota efetiva pela RBT12 e valor do DAS, com a folga até a próxima faixa |
| **Fator R** | Se cai no Anexo III ou V, e quanto falta de folha para migrar |
| **Lucro Presumido** | IRPJ com adicional, CSLL, PIS e Cofins do trimestre |
| **Pró-labore** | INSS do sócio, IRRF, líquido e o custo real para a empresa |
| **Multa e juros por atraso** | Multa de mora limitada a 20% e juros Selic |
| **Simulador da Reforma Tributária** | Carga atual contra CBS e IBS ano a ano, de 2026 a 2033 |

### Setorial — o diferencial da casa

| Ferramenta | O que resolve |
|---|---|
| **Custo por quilômetro rodado** | Fixos e variáveis do veículo e o preço mínimo do frete |
| **Custo de importação** | Do FOB ao custo final, com o ICMS calculado por dentro |

Estas duas são o motivo de a Castelo Branco ter uma plataforma própria em vez de
revender curso de terceiro. Nenhum concorrente generalista traz cálculo de frete
e de importação na mesma ferramenta que o cálculo de folha.

### Gestão

| Ferramenta | O que resolve |
|---|---|
| **Preço de venda e markup** | Do custo ao preço, com impostos, comissão e lucro — por dentro |
| **Ponto de equilíbrio** | Quanto vender para não ter prejuízo, e para dar o lucro desejado |
| **Depreciação** | Quota anual e mensal com o valor contábil ano a ano |
| **Parcelamento e financiamento** | Parcela pela Tabela Price, juros totais e custo efetivo |

### Utilitário

| Ferramenta | O que resolve |
|---|---|
| **Validador de CPF e CNPJ** | Dígito verificador, matriz/filial, antes de o cadastro entrar |

---

## O que está garantido e o que não está

**A conta está certa.** As fórmulas foram conferidas contra cálculo manual —
INSS progressivo por faixa, IRRF com escolha automática entre dedução legal e
desconto simplificado, alíquota efetiva do Simples pela fórmula da LC 123, ICMS
de importação por dentro, markup por divisão e não por multiplicação.

**A tabela é responsabilidade humana.** INSS, IRRF, anexos do Simples e
percentuais de presunção mudam por portaria. Todos vivem em um arquivo só:
[`src/lib/ferramentas/tabelas.ts`](../src/lib/ferramentas/tabelas.ts).

Toda ferramenta que depende de tabela oficial **mostra a vigência na tela**.
É de propósito: ninguém deve entregar número a cliente sem saber de quando é a
tabela que o gerou.

### Como atualizar quando sair a portaria

1. Abra `src/lib/ferramentas/tabelas.ts`.
2. Troque os valores no bloco correspondente (`FAIXAS_INSS`, `FAIXAS_IRRF`,
   `ANEXOS_SIMPLES`, `PRESUNCOES`).
3. Atualize o texto em `VIGENCIA` — é ele que aparece na interface.
4. Rode `npx tsx .scratch/conferir.ts` se ainda existir, ou confira à mão uma
   ferramenta de cada família.

Nenhum componente precisa mudar. Nenhuma constante fiscal está solta em outro
arquivo.

---

## Privacidade

**Nada do que a pessoa digita sai do navegador.** Salário, faturamento, dados de
cliente — tudo é calculado em memória. O que vai para o banco é uma linha em
`ferramenta_usos` com o slug da ferramenta e o id do perfil, nada mais.

Isso não é detalhe: um contador não vai usar uma calculadora que manda o
faturamento do cliente dele para um servidor.

---

## Como acrescentar uma ferramenta

O catálogo é declarativo. Uma ferramenta é um objeto com campos e uma função de
cálculo pura — nenhum componente precisa ser criado ou alterado.

```ts
// src/lib/ferramentas/catalogo.ts
const minhaFerramenta: Ferramenta = {
  slug: "minha-ferramenta",
  nome: "Nome que aparece no catálogo",
  descricao: "Uma linha sobre o que resolve.",
  categoria: "Tributário",
  icone: "calculator",          // nome de ícone lucide, mapeado em ferramenta-form.tsx
  vigencia: VIGENCIA.simples,   // só se usar tabela oficial
  campos: [
    { nome: "valor", rotulo: "Valor", tipo: "moeda", padrao: "1000" },
    { nome: "taxa", rotulo: "Taxa (%)", tipo: "percentual", padrao: "10" },
  ],
  calcular: (v) => {
    const valor = num(v.valor);
    if (valor <= 0) return { linhas: [], erro: "Informe o valor." };
    const resultado = cent(valor * (num(v.taxa) / 100));
    return {
      destaque: { rotulo: "Resultado", valor: brl(resultado) },
      linhas: [{ rotulo: "Base", valor: brl(valor) }],
      avisos: ["O que a pessoa precisa saber para não errar."],
    };
  },
};
```

Depois é só somar ao array `FERRAMENTAS`. A rota, o filtro, a busca, o registro
de uso e o ranking no painel funcionam sozinhos.

### Tipos de campo

`moeda` · `numero` · `inteiro` · `percentual` · `select` · `data` · `texto`

`grupo` agrupa campos numa seção; `largo` faz o campo ocupar a linha inteira.

### Estilos de linha no resultado

`normal` · `desconto` (vermelho, com sinal) · `subtotal` · `total` (destacado) ·
`info` (cinza, para o que não entra na soma)

---

## O campo "o que observar"

Cada ferramenta termina com dois ou três avisos. Eles não são disclaimer
jurídico: são o que separa a calculadora da planilha. Exemplos que estão lá:

- No **preço de venda**: somar margem sobre o custo (custo × 1,20) entrega
  sempre menos lucro do que se imagina, porque imposto e comissão incidem sobre
  o preço.
- No **custo de importação**: calcular o ICMS por fora subestima o imposto — é o
  erro mais comum na formação de preço de importado.
- Nas **horas extras**: o DSR sobre hora extra é obrigatório e é o item mais
  esquecido da folha.
- No **fator R**: aumentar a folha pode custar menos que o DAS que se economiza —
  mas some encargos antes de decidir.

É onde a experiência da Castelo Branco aparece dentro da ferramenta. Vale revisar
esses textos com a equipe técnica.
