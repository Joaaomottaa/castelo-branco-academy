-- ============================================================================
--  13 — A QUESTÃO VIRA UM LUGAR
--
--  Roda depois de 12_simulados_salvos.sql. É idempotente.
--
--  Responder e seguir é o que a plataforma fazia. O que fixa conteúdo é o que
--  vem depois: ver que 62% da turma caiu na mesma alternativa que você, ler o
--  que um colega escreveu, anotar a regra que confundiu, e avisar quando o
--  gabarito está errado.
--
--  Quatro coisas novas, na ordem em que aparecem na tela da questão:
--    · estatísticas — agregado das respostas, sem expor linha de ninguém
--    · aulas        — o curso que explica aquele assunto, achado pelo selo
--    · comentários  — a turma explicando para quem vier depois
--    · anotação     — caderno pessoal, que nem o admin lê
--    · notificar erro — o aluno conserta o banco de questões
-- ============================================================================

/* ============================================================================
   1. COMENTÁRIOS
   ============================================================================ */
create table if not exists public.questao_comentarios (
  id          uuid primary key default gen_random_uuid(),
  questao_id  uuid not null references public.questoes_banco(id) on delete cascade,
  perfil_id   uuid not null references public.perfis(id)         on delete cascade,
  -- Denormalizado porque RLS é por linha, não por coluna: sem isto, mostrar o
  -- nome do autor exigiria abrir a leitura de `perfis` inteira.
  autor_nome  text not null default '',
  autor_cargo text,
  conteudo    text not null,
  criado_em   timestamptz not null default now()
);

create index if not exists idx_questao_comentarios_questao
  on public.questao_comentarios (questao_id, criado_em desc);

alter table public.questao_comentarios enable row level security;

drop policy if exists "coment_questao: turma lê" on public.questao_comentarios;
create policy "coment_questao: turma lê" on public.questao_comentarios
  for select using (auth.uid() is not null);

drop policy if exists "coment_questao: autor escreve" on public.questao_comentarios;
create policy "coment_questao: autor escreve" on public.questao_comentarios
  for insert with check (perfil_id = auth.uid());

drop policy if exists "coment_questao: autor edita" on public.questao_comentarios;
create policy "coment_questao: autor edita" on public.questao_comentarios
  for update using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- Autor apaga o próprio; admin modera, porque comentário é público para a turma.
drop policy if exists "coment_questao: autor apaga, admin modera" on public.questao_comentarios;
create policy "coment_questao: autor apaga, admin modera" on public.questao_comentarios
  for delete using (perfil_id = auth.uid() or public.is_admin());

create or replace function public.preencher_autor_comentario_questao()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  select nome, cargo into new.autor_nome, new.autor_cargo
  from public.perfis where id = new.perfil_id;
  return new;
end
$fn$;

revoke all on function public.preencher_autor_comentario_questao()
  from public, anon, authenticated;

drop trigger if exists trg_autor_coment_questao on public.questao_comentarios;
create trigger trg_autor_coment_questao
  before insert on public.questao_comentarios
  for each row execute function public.preencher_autor_comentario_questao();

create table if not exists public.questao_comentario_curtidas (
  comentario_id uuid not null references public.questao_comentarios(id) on delete cascade,
  perfil_id     uuid not null references public.perfis(id)              on delete cascade,
  criado_em     timestamptz not null default now(),
  primary key (comentario_id, perfil_id)
);

alter table public.questao_comentario_curtidas enable row level security;

drop policy if exists "curtida_coment: turma lê" on public.questao_comentario_curtidas;
create policy "curtida_coment: turma lê" on public.questao_comentario_curtidas
  for select using (auth.uid() is not null);

drop policy if exists "curtida_coment: própria" on public.questao_comentario_curtidas;
create policy "curtida_coment: própria" on public.questao_comentario_curtidas
  for all using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

/* ============================================================================
   2. ANOTAÇÕES
   ============================================================================ */
-- Anotação de estudo é caderno pessoal. Nem o administrador lê: a pessoa
-- escreve ali o que ainda não entendeu, e ninguém escreve isso sabendo que
-- tem plateia.
create table if not exists public.questao_anotacoes (
  perfil_id     uuid not null references public.perfis(id)         on delete cascade,
  questao_id    uuid not null references public.questoes_banco(id) on delete cascade,
  texto         text not null,
  atualizado_em timestamptz not null default now(),
  primary key (perfil_id, questao_id)
);

alter table public.questao_anotacoes enable row level security;

drop policy if exists "anotacao_questao: só o dono" on public.questao_anotacoes;
create policy "anotacao_questao: só o dono" on public.questao_anotacoes
  for all using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

/* ============================================================================
   3. NOTIFICAR ERRO
   ============================================================================ */
create table if not exists public.questao_reportes (
  id            uuid primary key default gen_random_uuid(),
  questao_id    uuid not null references public.questoes_banco(id) on delete cascade,
  perfil_id     uuid not null references public.perfis(id)         on delete set null,
  motivo        text not null default 'outro',
  descricao     text,
  status        text not null default 'aberto',
  criado_em     timestamptz not null default now(),
  resolvido_em  timestamptz,
  resolvido_por uuid references public.perfis(id) on delete set null
);

do $bl$
begin
  if not exists (select 1 from pg_constraint where conname = 'questao_reportes_motivo_check') then
    alter table public.questao_reportes add constraint questao_reportes_motivo_check
      check (motivo in ('gabarito', 'enunciado', 'alternativa', 'explicacao', 'duplicada', 'outro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'questao_reportes_status_check') then
    alter table public.questao_reportes add constraint questao_reportes_status_check
      check (status in ('aberto', 'resolvido', 'descartado'));
  end if;
end $bl$;

create index if not exists idx_questao_reportes_abertos
  on public.questao_reportes (questao_id) where status = 'aberto';

alter table public.questao_reportes enable row level security;

drop policy if exists "reporte_questao: autor cria" on public.questao_reportes;
create policy "reporte_questao: autor cria" on public.questao_reportes
  for insert with check (perfil_id = auth.uid());

drop policy if exists "reporte_questao: autor e admin leem" on public.questao_reportes;
create policy "reporte_questao: autor e admin leem" on public.questao_reportes
  for select using (perfil_id = auth.uid() or public.is_admin());

drop policy if exists "reporte_questao: admin resolve" on public.questao_reportes;
create policy "reporte_questao: admin resolve" on public.questao_reportes
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reporte_questao: admin apaga" on public.questao_reportes;
create policy "reporte_questao: admin apaga" on public.questao_reportes
  for delete using (public.is_admin());

/* ============================================================================
   4. ESTATÍSTICA DA QUESTÃO
   ============================================================================ */
-- A policy "respostas: próprias" existe para ninguém ler o desempenho de
-- ninguém — e ela continua valendo. Esta função devolve só o agregado: quantos
-- responderam, quantos acertaram e como as marcações se distribuíram. Nenhuma
-- linha individual sai daqui.
create or replace function public.estatisticas_questao(p_questao uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_perfil  uuid := auth.uid();
  v_total   integer;
  v_acertos integer;
  v_dist    jsonb;
  v_minha   jsonb;
begin
  if v_perfil is null then
    raise exception 'Não autenticado';
  end if;

  select count(*)::integer, count(*) filter (where correta)::integer
    into v_total, v_acertos
  from public.respostas_questoes where questao_id = p_questao;

  select coalesce(jsonb_agg(d order by d ->> 'alternativa'), '[]'::jsonb)
    into v_dist
  from (
    select jsonb_build_object(
             'alternativa', r.alternativa,
             'total',       count(*),
             'pct',         round(count(*) * 100.0 / nullif(v_total, 0))
           ) as d
    from public.respostas_questoes r
    where r.questao_id = p_questao
    group by r.alternativa
  ) x;

  -- "Qual foi a minha" é a primeira coisa que a pessoa procura ao reabrir.
  select jsonb_build_object('alternativa', alternativa, 'correta', correta,
                            'em', criado_em)
    into v_minha
  from public.respostas_questoes
  where questao_id = p_questao and perfil_id = v_perfil
  order by criado_em desc limit 1;

  return jsonb_build_object(
    'respostas',    v_total,
    'acertos',      v_acertos,
    'pct',          case when v_total > 0
                         then round(v_acertos * 100.0 / v_total)::integer
                         else null end,
    'distribuicao', v_dist,
    'minha',        v_minha
  );
end
$fn$;

revoke all on function public.estatisticas_questao(uuid) from public, anon;
grant execute on function public.estatisticas_questao(uuid) to authenticated;

/* ============================================================================
   5. AS AULAS QUE EXPLICAM A QUESTÃO
   ============================================================================ */
-- A ligação boa é o selo: o curso declara quais habilidades concede
-- (`curso_habilidades`), e o assunto da questão costuma ser o nome de uma
-- delas.
--
-- Os degraus seguintes existem porque a área da questão ("Comex", "Contábil")
-- não é a categoria do curso ("Setorial", "Formação"): casar as duas direto
-- deixava metade das questões sem nenhuma aula. A trilha resolve — ela tem
-- `area` no mesmo vocabulário das questões e já aponta para os cursos.
--
-- Os parâmetros OUT viram variáveis dentro da função, então as colunas da CTE
-- levam prefixo: sem isso, `habilidade` fica ambíguo e a função nem executa.
create or replace function public.aulas_da_questao(p_questao uuid)
returns table (
  aula_id      uuid,
  aula_titulo  text,
  duracao_min  integer,
  modulo       text,
  curso_slug   text,
  curso_titulo text,
  curso_cor    text,
  habilidade   text,
  origem       text
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_area    text;
  v_assunto text;
  v_curso   uuid;
  v_tags    text[];
begin
  select q.area, q.assunto, q.curso_id, q.tags
    into v_area, v_assunto, v_curso, v_tags
  from public.questoes_banco q where q.id = p_questao;

  if v_assunto is null then
    return;
  end if;

  return query
  with relevantes as (
    -- 1. curso apontado na própria questão
    select c.id as c_id, c.slug as c_slug, c.titulo as c_titulo, c.cor as c_cor,
           null::text as c_hab, 'vinculo'::text as c_origem, 1 as c_prio
    from public.cursos c
    where c.id = v_curso and c.publicado

    union all

    -- 2. curso que concede a habilidade com o nome do assunto — o selo
    select c.id, c.slug, c.titulo, c.cor, h.nome, 'selo'::text, 2
    from public.curso_habilidades ch
    join public.habilidades h on h.id = ch.habilidade_id
    join public.cursos      c on c.id = ch.curso_id
    where c.publicado
      and (h.nome ilike v_assunto
           or v_assunto ilike '%' || h.nome || '%'
           or h.nome ilike '%' || v_assunto || '%')

    union all

    -- 3. o assunto aparece no curso (título, subtítulo ou tag)
    select c.id, c.slug, c.titulo, c.cor, null::text, 'assunto'::text, 3
    from public.cursos c
    where c.publicado
      and (v_assunto = any (c.tags)
           or c.titulo ilike '%' || v_assunto || '%'
           or coalesce(c.subtitulo, '') ilike '%' || v_assunto || '%'
           or c.tags && coalesce(v_tags, '{}'))

    union all

    -- 4. curso de uma trilha da mesma área da questão
    select c.id, c.slug, c.titulo, c.cor, null::text, 'area'::text, 4
    from public.trilhas t
    join public.trilha_cursos tc on tc.trilha_id = t.id
    join public.cursos c on c.id = tc.curso_id
    where c.publicado and t.publicada and t.area = v_area

    union all

    -- 5. último recurso: mesma categoria
    select c.id, c.slug, c.titulo, c.cor, null::text, 'area'::text, 5
    from public.cursos c
    where c.publicado and c.categoria = v_area
  ),
  melhores as (
    select distinct on (c_id) c_id, c_slug, c_titulo, c_cor, c_hab, c_origem, c_prio
    from relevantes
    order by c_id, c_prio
  )
  select a.id, a.titulo, a.duracao_min, m.titulo, cr.c_slug, cr.c_titulo,
         cr.c_cor, cr.c_hab, cr.c_origem
  from melhores cr
  join public.modulos m on m.curso_id = cr.c_id
  join public.aulas   a on a.modulo_id = m.id
  order by cr.c_prio, cr.c_titulo, m.ordem, a.ordem
  limit 8;
end
$fn$;

revoke all on function public.aulas_da_questao(uuid) from public, anon;
grant execute on function public.aulas_da_questao(uuid) to authenticated;
