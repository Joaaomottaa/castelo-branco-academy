-- ============================================================================
--  CASTELO BRANCO ACADEMY — 08. VÍDEO NA AULA + AVALIAÇÃO PÓS-AULA
--  Rode DEPOIS do 07_seed_avancado.sql. Idempotente.
--
--  O que este arquivo entrega:
--   1. Campos de vídeo na aula (upload no Storage OU link do YouTube/Vimeo)
--   2. Configuração da avaliação por aula (quantas questões, nota mínima,
--      quantas tentativas)
--   3. Correção NO SERVIDOR — o gabarito nunca sai do banco antes da resposta
--   4. Liberação de ordenação livre de módulos e aulas
-- ============================================================================

-- ============================================================================
--  1. VÍDEO DA AULA
-- ============================================================================
-- Duas origens possíveis, e é de propósito:
--   'upload'  → arquivo no bucket 'videos' do próprio Supabase. Grátis, mas o
--               plano free limita cada arquivo a 50 MB e o total a 1 GB.
--   'youtube' → vídeo não listado no YouTube. Grátis, ilimitado, já vem com
--               transcodificação e player adaptativo prontos.
-- Ver docs/VIDEO.md para o porquê da escolha e o caminho para produção.
alter table public.aulas
  add column if not exists video_origem text    not null default 'nenhum',
  add column if not exists video_path   text,   -- caminho no bucket 'videos'
  add column if not exists video_url    text,   -- link externo (YouTube/Vimeo)
  add column if not exists video_nome   text,   -- nome original do arquivo
  add column if not exists video_bytes  bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aulas_video_origem_chk') then
    alter table public.aulas add constraint aulas_video_origem_chk
      check (video_origem in ('nenhum','upload','youtube','vimeo','externo'));
  end if;
end $$;

-- ============================================================================
--  2. CONFIGURAÇÃO DA AVALIAÇÃO
-- ============================================================================
-- Sorteia `quiz_qtd` questões do banco da aula. O aluno tem `quiz_tentativas`
-- chances e precisa acertar `quiz_minimo`. Padrão: 3 questões, 2 tentativas,
-- acertar 2.
alter table public.aulas
  add column if not exists quiz_ativo      boolean not null default false,
  add column if not exists quiz_qtd        integer not null default 3,
  add column if not exists quiz_minimo     integer not null default 2,
  add column if not exists quiz_tentativas integer not null default 2;

alter table public.questoes
  add column if not exists ordem integer not null default 0,
  add column if not exists nivel text;

alter table public.tentativas
  add column if not exists acertos  integer not null default 0,
  add column if not exists total    integer not null default 0,
  add column if not exists aprovada boolean not null default false;

create index if not exists tentativas_perfil_aula_idx
  on public.tentativas (perfil_id, aula_id);

create index if not exists questoes_aula_idx on public.questoes (aula_id, ordem);

-- ============================================================================
--  3. ORDENAÇÃO LIVRE
-- ============================================================================
-- unique(curso_id, ordem) impedia reordenar: trocar duas posições passa por um
-- estado momentâneo com ordem repetida, e sem transação no cliente não há como
-- evitar. A ordem continua sendo respeitada na leitura; ela só deixa de ser
-- obrigatoriamente única.
alter table public.modulos drop constraint if exists modulos_curso_id_ordem_key;
alter table public.aulas   drop constraint if exists aulas_modulo_id_ordem_key;

create index if not exists modulos_curso_ordem_idx on public.modulos (curso_id, ordem);
create index if not exists aulas_modulo_ordem_idx  on public.aulas (modulo_id, ordem);

-- ============================================================================
--  4. CORREÇÃO NO SERVIDOR
-- ============================================================================
-- O cliente nunca lê a coluna `correta`. Ele pede as questões por RPC (que não
-- devolve o gabarito), envia as respostas por RPC, e só aí recebe o que errou.
-- É o mesmo motivo pelo qual prova não é corrigida pelo aluno.

drop policy if exists "questoes: só matriculado" on public.questoes;
create policy "questoes: admin lê" on public.questoes for select
  using (public.is_admin());

-- ------------------------------------------------- sorteia as questões ----
create or replace function public.quiz_da_aula(p_aula uuid)
returns table (id uuid, enunciado text, alternativas jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd integer;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  select a.quiz_qtd into v_qtd
  from public.aulas a
  where a.id = p_aula and a.quiz_ativo;

  if v_qtd is null then
    return;                      -- aula sem avaliação: devolve vazio
  end if;

  return query
    select q.id, q.enunciado, q.alternativas
    from public.questoes q
    where q.aula_id = p_aula
    order by random()
    limit v_qtd;
end $$;

-- --------------------------------------------- estado do aluno na aula ----
create or replace function public.quiz_status(p_aula uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_perfil uuid := auth.uid();
  v_aula   record;
  v_usadas integer;
  v_ok     boolean;
  v_disp   integer;
begin
  if v_perfil is null then
    raise exception 'Não autenticado';
  end if;

  select a.quiz_ativo, a.quiz_qtd, a.quiz_minimo, a.quiz_tentativas
    into v_aula
  from public.aulas a where a.id = p_aula;

  if not found then
    return jsonb_build_object('ativo', false);
  end if;

  select count(*)::integer, bool_or(t.aprovada)
    into v_usadas, v_ok
  from public.tentativas t
  where t.perfil_id = v_perfil and t.aula_id = p_aula;

  select count(*)::integer into v_disp
  from public.questoes q where q.aula_id = p_aula;

  return jsonb_build_object(
    'ativo',            v_aula.quiz_ativo and v_disp > 0,
    'questoes_no_banco', v_disp,
    'qtd',              v_aula.quiz_qtd,
    'minimo',           v_aula.quiz_minimo,
    'tentativas_max',   v_aula.quiz_tentativas,
    'tentativas_usadas', coalesce(v_usadas, 0),
    'aprovada',         coalesce(v_ok, false)
  );
end $$;

-- ------------------------------------------------------------ corrige ----
-- p_respostas: [{ "questao_id": "uuid", "resposta": "a" }, ...]
create or replace function public.corrigir_quiz(p_aula uuid, p_respostas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil   uuid := auth.uid();
  v_aula     record;
  v_usadas   integer;
  v_acertos  integer := 0;
  v_total    integer := 0;
  v_gabarito jsonb   := '[]'::jsonb;
  v_aprovada boolean;
  r          record;
begin
  if v_perfil is null then
    raise exception 'Não autenticado';
  end if;

  select a.quiz_ativo, a.quiz_minimo, a.quiz_tentativas into v_aula
  from public.aulas a where a.id = p_aula;

  if not found or not v_aula.quiz_ativo then
    raise exception 'Esta aula não tem avaliação ativa';
  end if;

  -- Limite de tentativas conferido aqui, não no navegador.
  select count(*)::integer into v_usadas
  from public.tentativas t
  where t.perfil_id = v_perfil and t.aula_id = p_aula;

  if v_usadas >= v_aula.quiz_tentativas then
    raise exception 'Tentativas esgotadas para esta aula';
  end if;

  for r in
    select q.id, q.correta, q.explicacao, (e.value ->> 'resposta') as marcada
    from jsonb_array_elements(p_respostas) e
    join public.questoes q on q.id = (e.value ->> 'questao_id')::uuid
    where q.aula_id = p_aula
  loop
    v_total := v_total + 1;
    if r.marcada is not distinct from r.correta then
      v_acertos := v_acertos + 1;
    end if;
    v_gabarito := v_gabarito || jsonb_build_object(
      'questao_id', r.id,
      'correta',    r.correta,
      'marcada',    r.marcada,
      'acertou',    (r.marcada is not distinct from r.correta),
      'explicacao', r.explicacao
    );
  end loop;

  if v_total = 0 then
    raise exception 'Nenhuma questão válida foi enviada';
  end if;

  v_aprovada := v_acertos >= v_aula.quiz_minimo;

  insert into public.tentativas
    (perfil_id, aula_id, nota, respostas, acertos, total, aprovada)
  values
    (v_perfil, p_aula, round(v_acertos::numeric * 100 / v_total, 2),
     p_respostas, v_acertos, v_total, v_aprovada);

  -- Aprovou: a aula conta como concluída. É o mesmo caminho do botão manual,
  -- então o trigger de certificado continua sendo o único a emitir.
  if v_aprovada then
    insert into public.progresso_aulas (perfil_id, aula_id, concluida, atualizado_em)
    values (v_perfil, p_aula, true, now())
    on conflict (perfil_id, aula_id)
      do update set concluida = true, atualizado_em = now();
  end if;

  return jsonb_build_object(
    'acertos',          v_acertos,
    'total',            v_total,
    'minimo',           v_aula.quiz_minimo,
    'aprovada',         v_aprovada,
    'tentativas_usadas', v_usadas + 1,
    'tentativas_max',   v_aula.quiz_tentativas,
    'gabarito',         v_gabarito
  );
end $$;

-- ------------------------------------------------------------- grants ----
-- O Postgres concede EXECUTE a PUBLIC por padrão e o PostgREST publica tudo
-- que está em `public` como /rest/v1/rpc/<nome>. Revogar de anon/authenticated
-- isoladamente não adianta: tem que tirar de PUBLIC primeiro.
revoke all on function public.quiz_da_aula(uuid)          from public, anon;
revoke all on function public.quiz_status(uuid)           from public, anon;
revoke all on function public.corrigir_quiz(uuid, jsonb)  from public, anon;

grant execute on function public.quiz_da_aula(uuid)         to authenticated;
grant execute on function public.quiz_status(uuid)          to authenticated;
grant execute on function public.corrigir_quiz(uuid, jsonb) to authenticated;

-- ============================================================================
--  4b. RECÁLCULO DOS SELOS DE TRILHA
-- ============================================================================
-- O trigger de selo só dispara em certificado NOVO. Quando o admin cria uma
-- trilha com cursos que os alunos já concluíram, ninguém recebe o selo.
-- Esta função fecha a lacuna e é o botão "Recalcular selos" em /admin/trilhas.
create or replace function public.backfill_selos_trilha()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_novos integer;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem recalcular selos';
  end if;

  with candidatos as (
    select c.perfil_id, tc.trilha_id,
      count(*) filter (where tc.obrigatorio) as feitos,
      (select count(*) from public.trilha_cursos t2
        where t2.trilha_id = tc.trilha_id and t2.obrigatorio) as obrig,
      (select coalesce(sum(cu.carga_horaria),0) from public.trilha_cursos t3
        join public.cursos cu on cu.id = t3.curso_id where t3.trilha_id = tc.trilha_id) as carga,
      (select coalesce(sum(cu.pontos_pepc),0) from public.trilha_cursos t4
        join public.cursos cu on cu.id = t4.curso_id where t4.trilha_id = tc.trilha_id) as pepc
    from public.certificados c
    join public.trilha_cursos tc on tc.curso_id = c.curso_id
    group by c.perfil_id, tc.trilha_id
  ),
  inseridos as (
    insert into public.certificados_trilha
      (perfil_id, trilha_id, codigo, carga_horaria, pontos_pepc)
    select x.perfil_id, x.trilha_id,
      'CBA-T-' || to_char(now(),'YYYY') || '-' ||
        upper(substr(md5(x.perfil_id::text || x.trilha_id::text),1,6)),
      x.carga, x.pepc
    from candidatos x
    where x.obrig > 0 and x.feitos >= x.obrig
    on conflict (perfil_id, trilha_id) do nothing
    returning 1
  )
  select count(*)::integer into v_novos from inseridos;

  return coalesce(v_novos, 0);
end $fn$;

revoke all on function public.backfill_selos_trilha() from public, anon;
grant execute on function public.backfill_selos_trilha() to authenticated;

-- ============================================================================
--  5. STORAGE — leitura do vídeo pelo aluno
-- ============================================================================
-- O bucket segue privado. O aluno precisa de SELECT em storage.objects para
-- conseguir gerar a URL assinada; sem isso createSignedUrl devolve 400.
drop policy if exists "cba: videos leitura autenticada" on storage.objects;
create policy "cba: videos leitura autenticada" on storage.objects for select
  using (bucket_id = 'videos' and auth.role() = 'authenticated');

-- 50 MB por arquivo é o teto do plano free do Supabase. Deixar o bucket
-- prometendo 5 GB só produz erro confuso na hora do upload.
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['video/mp4','video/webm','video/quicktime']
 where id = 'videos';

-- ============================================================================
--  Conferência
-- ============================================================================
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='aulas'
      and column_name in ('video_origem','video_path','video_url',
                          'quiz_ativo','quiz_qtd','quiz_minimo','quiz_tentativas')
  ) as colunas_novas_em_aulas,          -- esperado: 7
  (select count(*) from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('quiz_da_aula','quiz_status','corrigir_quiz','backfill_selos_trilha')
  ) as funcoes_novas;                   -- esperado: 4
