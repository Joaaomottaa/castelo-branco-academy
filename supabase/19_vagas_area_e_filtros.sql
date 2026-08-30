-- ============================================================================
--  19 — ÁREA DA VAGA
--
--  Roda depois de 18_area_da_empresa.sql. É idempotente.
--
--  O mural de vagas só filtrava por modelo de trabalho e tipo de contrato —
--  dois campos que dizem como se trabalha, nenhum diz do que o trabalho trata.
--  "Área" é a primeira coisa que um contador procura, e o vocabulário já
--  existia no banco de questões. Reusar o mesmo termo evita a plataforma falar
--  duas línguas para a mesma coisa.
-- ============================================================================

alter table public.vagas
  add column if not exists area text;

comment on column public.vagas.area is
  'Fiscal | Tributário | Contábil | Pessoal | Comex | Gestão. Mesmo vocabulário de questoes_banco.area.';


-- Palpite a partir do título e dos requisitos.
--
-- Serve para as vagas que já existiam e para quem publicar sem escolher. É
-- chute com critério, não adivinhação: a empresa corrige na tela dela a
-- qualquer momento, e o palpite errado é melhor que a vaga fora de todo filtro.
--
-- A ordem dos casos importa: "Consultor Tributário — Reforma" bate em
-- `tributari` antes de bater em `fiscal`, que é o que se quer.
create or replace function public.area_provavel_da_vaga(p_titulo text, p_requisitos text[])
returns text language sql immutable set search_path = public as $fn$
  select case
    when t ~ 'comex|comercio exterior|importa|exporta|aduaneir|drawback|ncm' then 'Comex'
    when t ~ 'pessoal|folha|trabalhista|esocial|rh|recursos humanos|departamento pessoal' then 'Pessoal'
    when t ~ 'tributari|reforma|planejamento|credito|elisao|cbs|ibs' then 'Tributário'
    when t ~ 'fiscal|sped|nota fiscal|apuracao|obrigacoes acessorias|icms|ipi' then 'Fiscal'
    when t ~ 'controller|controladoria|gerencial|custos|bi|indicador|financeir' then 'Gestão'
    else 'Contábil'
  end
  from (
    select lower(translate(
      coalesce(p_titulo, '') || ' ' || array_to_string(coalesce(p_requisitos, '{}'), ' '),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    )) as t
  ) z;
$fn$;

update public.vagas
   set area = public.area_provavel_da_vaga(titulo, requisitos)
 where area is null;


-- ---------------------------------------------------------------------------
-- CONFERÊNCIA
-- ---------------------------------------------------------------------------
-- select titulo, area, publicada_em::date from public.vagas order by publicada_em desc;
