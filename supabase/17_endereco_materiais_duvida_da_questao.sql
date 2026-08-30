-- ============================================================================
--  17 — ENDEREÇO POR CEP, MATERIAIS DA AULA E DÚVIDA SOBRE A QUESTÃO
--
--  Roda depois de 16_cadastro_certificado_revisao.sql. É idempotente.
--
--  1. Endereço em `perfis` — cidade e UF vinham de campo livre, e o banco
--     acumulava "Feira de santana", "feira" e "FSA" para o mesmo lugar, o que
--     estraga qualquer filtro do banco de talentos. Agora a pessoa digita o
--     CEP e a aplicação preenche o resto (ver /api/cep). Só número e
--     complemento continuam sendo digitados — nenhuma base de CEP sabe disso.
--
--  2. `aula_materiais` — slides, planilha modelo, checklist, a norma em PDF.
--     Duas origens: arquivo no bucket privado `materiais` (criado em
--     04_storage.sql, com as policies já prontas) ou link externo, para o que
--     já é público e muda na origem.
--
--  3. Dúvida sobre questão — reaproveita `duvidas` em vez de criar tabela
--     nova. A pergunta privada para a IA é a mesma coisa; muda o objeto de
--     estudo. A policy que já existia ("fórum é público, IA é privada") passa
--     a valer aqui sem uma linha a mais.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENDEREÇO
-- ---------------------------------------------------------------------------
alter table public.perfis
  add column if not exists cep         text,
  add column if not exists logradouro  text,
  add column if not exists bairro      text,
  add column if not exists numero      text,
  add column if not exists complemento text;

comment on column public.perfis.cep is
  'Só dígitos ou 00000-000. Preenche cidade/uf/logradouro/bairro via API de CEP.';


-- ---------------------------------------------------------------------------
-- 2. MATERIAIS DA AULA
-- ---------------------------------------------------------------------------
create table if not exists public.aula_materiais (
  id           uuid primary key default gen_random_uuid(),
  aula_id      uuid not null references public.aulas(id) on delete cascade,
  titulo       text not null,
  descricao    text,
  -- pdf | planilha | imagem | slide | documento | link | outro
  tipo         text not null default 'outro',
  -- Arquivo no bucket `materiais`…
  path         text,
  -- …ou link externo (planilha no Drive, norma no site da Receita).
  url          text,
  nome_arquivo text,
  bytes        bigint,
  ordem        integer not null default 0,
  criado_em    timestamptz not null default now(),
  constraint aula_materiais_tem_origem check (path is not null or url is not null)
);

create index if not exists idx_aula_materiais_aula on public.aula_materiais (aula_id, ordem);

alter table public.aula_materiais enable row level security;

-- Ler exige estar logado; o arquivo em si só sai por URL assinada, gerada no
-- clique. Assim o link não fica no HTML da página nem sobrevive a um repasse.
drop policy if exists "materiais: leitura autenticada" on public.aula_materiais;
create policy "materiais: leitura autenticada" on public.aula_materiais
  for select using (auth.uid() is not null);

drop policy if exists "materiais: admin administra" on public.aula_materiais;
create policy "materiais: admin administra" on public.aula_materiais
  for all using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- 3. DÚVIDA COM IA SOBRE UMA QUESTÃO
-- ---------------------------------------------------------------------------
alter table public.duvidas alter column aula_id drop not null;

alter table public.duvidas
  add column if not exists questao_id uuid references public.questoes_banco(id) on delete cascade;

do $bl$
begin
  if not exists (select 1 from pg_constraint where conname = 'duvidas_tem_objeto') then
    alter table public.duvidas
      add constraint duvidas_tem_objeto check (aula_id is not null or questao_id is not null);
  end if;
end
$bl$;

create index if not exists idx_duvidas_questao on public.duvidas (questao_id, perfil_id);

-- Quantas perguntas à IA sobre questões a pessoa já fez hoje, e se ainda pode.
--
-- O limite mora aqui, não na interface: esconder o botão é cortesia, mas o que
-- impede o gasto é o banco. `limite` nulo = ilimitado (planos pagos).
--
-- O dia é o de Feira de Santana. Em UTC o contador zeraria às 21h.
create or replace function public.status_duvida_ia_questao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_perfil uuid := auth.uid();
  v_plano  text;
  v_limite integer;
  v_usadas integer;
begin
  if v_perfil is null then
    return jsonb_build_object('usadasHoje', 0, 'limite', 0, 'pode', false);
  end if;

  select lower(plano::text) into v_plano from public.perfis where id = v_perfil;

  -- Gratuito: uma por dia, o bastante para a pessoa sentir o valor.
  v_limite := case when v_plano in ('pro', 'enterprise', 'empresarial') then null else 1 end;

  select count(*)::integer into v_usadas
  from public.duvidas
  where perfil_id = v_perfil
    and tipo = 'ia'
    and questao_id is not null
    and (criado_em at time zone 'America/Bahia')::date
        = (now() at time zone 'America/Bahia')::date;

  return jsonb_build_object(
    'usadasHoje', v_usadas,
    'limite', v_limite,
    'pode', v_limite is null or v_usadas < v_limite
  );
end
$fn$;

-- `revoke from public` sozinho não basta: as default privileges do Supabase
-- dão EXECUTE a `anon` no momento da criação, e esse grant é explícito — só
-- sai nomeando o papel. Função que só faz sentido com sessão não pode ficar
-- aberta em /rest/v1/rpc para quem não entrou.
revoke all on function public.status_duvida_ia_questao() from public;
revoke execute on function public.status_duvida_ia_questao() from anon;
grant execute on function public.status_duvida_ia_questao() to authenticated;


-- ---------------------------------------------------------------------------
-- CONFERÊNCIA
-- ---------------------------------------------------------------------------
-- select public.status_duvida_ia_questao();
-- select titulo, tipo, bytes from public.aula_materiais order by criado_em desc;
