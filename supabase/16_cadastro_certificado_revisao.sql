-- ============================================================================
--  16 — CADASTRO COMPLETO, VALIDAÇÃO PÚBLICA E REVISÃO ESPAÇADA
--
--  Roda depois de 15_perfil_do_login_social.sql. É idempotente.
--
--  Três assuntos que nasceram juntos:
--
--  1. `perfis.cadastro_completo` — quem entra pelo Google chega com nome e
--     foto e nada mais: sem telefone, sem cidade e sem aceite de termos. A
--     coluna é o que manda essa pessoa para /completar-cadastro antes do
--     painel. Contas antigas já são marcadas como completas no backfill.
--
--  2. `validar_certificado(text)` — a página pública /validar. Quem consulta é
--     um RH sem conta na plataforma, então a função é `security definer` com
--     `execute` liberado para `anon`. Ela devolve só o que o papel já mostra:
--     nome, título, área, nível, carga horária, pontos e data. Nunca e-mail,
--     telefone ou id de perfil.
--
--  3. `questoes_para_revisar(int)` / `total_para_revisar()` — as caixas de
--     Leitner. O intervalo cresce com os acertos seguidos (1, 3, 7, 14 e 30
--     dias); errar devolve a questão para a primeira caixa. Não há tabela de
--     agendamento: tudo é derivado de `respostas_questoes`, que já registra
--     cada tentativa. Uma tabela paralela seria mais um lugar para sair de
--     sincronia com o histórico real.
--
--     A data é a de `America/Bahia`, não `current_date`. O Postgres roda em
--     UTC: com o Brasil em UTC-3, a fila viraria o dia às 21h e quem estuda à
--     noite veria a fila de amanhã aparecer no meio da sessão.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CADASTRO COMPLETO
-- ---------------------------------------------------------------------------
alter table public.perfis
  add column if not exists cadastro_completo boolean not null default false;

comment on column public.perfis.cadastro_completo is
  'Passou pela tela /completar-cadastro. Nasce false no gatilho handle_new_user.';

-- Quem já usava a plataforma antes desta coluna não deve ser empurrado para um
-- formulário de boas-vindas. Só depois disso o default volta a ser `false`,
-- que é o que vale para as contas novas.
update public.perfis set cadastro_completo = true where cadastro_completo = false;
alter table public.perfis alter column cadastro_completo set default false;


-- ---------------------------------------------------------------------------
-- 2. VALIDAÇÃO PÚBLICA DO CERTIFICADO
-- ---------------------------------------------------------------------------
create or replace function public.validar_certificado(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
  v_r      record;
begin
  if v_codigo = '' then
    return jsonb_build_object('valido', false, 'motivo', 'sem-codigo');
  end if;

  -- Certificado de curso
  select p.nome as aluno, c.titulo as titulo, 'curso' as tipo,
         cert.carga_horaria, cert.pontos_pepc, cert.emitido_em, cert.codigo,
         c.categoria as area, c.nivel::text as nivel
    into v_r
  from public.certificados cert
  join public.perfis p on p.id = cert.perfil_id
  join public.cursos c on c.id = cert.curso_id
  where upper(cert.codigo) = v_codigo;

  if found then
    return jsonb_build_object(
      'valido', true, 'tipo', v_r.tipo, 'aluno', v_r.aluno,
      'titulo', v_r.titulo, 'area', v_r.area, 'nivel', v_r.nivel,
      'cargaHoraria', v_r.carga_horaria, 'pontosPEPC', v_r.pontos_pepc,
      'emitidoEm', v_r.emitido_em, 'codigo', v_r.codigo
    );
  end if;

  -- Certificação de trilha
  select p.nome as aluno, t.nome as titulo, 'trilha' as tipo,
         ct.carga_horaria, ct.pontos_pepc, ct.emitido_em, ct.codigo,
         t.area as area, t.nivel_saida::text as nivel
    into v_r
  from public.certificados_trilha ct
  join public.perfis p on p.id = ct.perfil_id
  join public.trilhas t on t.id = ct.trilha_id
  where upper(ct.codigo) = v_codigo;

  if found then
    return jsonb_build_object(
      'valido', true, 'tipo', v_r.tipo, 'aluno', v_r.aluno,
      'titulo', v_r.titulo, 'area', v_r.area, 'nivel', v_r.nivel,
      'cargaHoraria', v_r.carga_horaria, 'pontosPEPC', v_r.pontos_pepc,
      'emitidoEm', v_r.emitido_em, 'codigo', v_r.codigo,
      'habilidades', coalesce((
        select jsonb_agg(h.nome order by th.nivel_esperado desc)
        from public.trilha_habilidades th
        join public.habilidades h on h.id = th.habilidade_id
        where th.trilha_id = (select id from public.trilhas where nome = v_r.titulo limit 1)
      ), '[]'::jsonb)
    );
  end if;

  return jsonb_build_object('valido', false, 'motivo', 'nao-encontrado');
end
$fn$;

-- O Postgres concede EXECUTE a PUBLIC por padrão, e o PostgREST publica tudo
-- que está em `public` como /rest/v1/rpc/<nome>. Revogar antes de conceder é o
-- que garante que a lista de quem pode chamar seja exatamente esta.
revoke all on function public.validar_certificado(text) from public;
grant execute on function public.validar_certificado(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. REVISÃO ESPAÇADA (CAIXAS DE LEITNER)
-- ---------------------------------------------------------------------------
create or replace function public.questoes_para_revisar(p_limite integer default 20)
returns table (
  questao_id     uuid,
  enunciado      text,
  area           text,
  assunto        text,
  nivel          text,
  tentativas     integer,
  acertos        integer,
  sequencia      integer,
  ultima_em      timestamptz,
  dias_de_atraso integer
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_perfil uuid := auth.uid();
  v_hoje   date := (now() at time zone 'America/Bahia')::date;
begin
  if v_perfil is null then
    raise exception 'Não autenticado';
  end if;

  return query
  with minhas as (
    select r.questao_id, r.correta, r.criado_em,
           row_number() over (partition by r.questao_id order by r.criado_em desc) as pos
    from public.respostas_questoes r
    where r.perfil_id = v_perfil
  ),
  resumo as (
    select m.questao_id,
           count(*)::integer                             as tentativas,
           count(*) filter (where m.correta)::integer    as acertos,
           max(m.criado_em)                              as ultima_em,
           -- Quantos acertos seguidos contando da tentativa mais recente para
           -- trás: é o que define em qual caixa de Leitner a questão está.
           coalesce(
             (select min(x.pos) - 1
              from minhas x
              where x.questao_id = m.questao_id and not x.correta),
             count(*)
           )::integer                                    as sequencia
    from minhas m
    group by m.questao_id
  )
  select q.id, q.enunciado, q.area, q.assunto, q.nivel::text,
         s.tentativas, s.acertos, s.sequencia, s.ultima_em,
         (v_hoje - (s.ultima_em at time zone 'America/Bahia')::date)::integer
  from resumo s
  join public.questoes_banco q on q.id = s.questao_id
  where q.ativa
    -- Acertou tudo desde a primeira: já sabe, sai da fila.
    and s.acertos < s.tentativas
    and (s.ultima_em at time zone 'America/Bahia')::date + (case s.sequencia
          when 0 then 1
          when 1 then 3
          when 2 then 7
          when 3 then 14
          else 30
        end) <= v_hoje
  order by s.sequencia, s.ultima_em
  limit greatest(1, least(p_limite, 100));
end
$fn$;

revoke all on function public.questoes_para_revisar(integer) from public;
grant execute on function public.questoes_para_revisar(integer) to authenticated;

-- Só o número, para o cartão do painel não carregar a fila inteira.
create or replace function public.total_para_revisar()
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select count(*)::integer from public.questoes_para_revisar(100);
$fn$;

revoke all on function public.total_para_revisar() from public;
grant execute on function public.total_para_revisar() to authenticated;


-- ---------------------------------------------------------------------------
-- CONFERÊNCIA
-- ---------------------------------------------------------------------------
-- select public.validar_certificado('CBA-2026-0000-0000');
-- select * from public.questoes_para_revisar(20);
-- select public.total_para_revisar();
