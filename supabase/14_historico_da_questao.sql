-- ============================================================================
--  14 — O HISTÓRICO DAS MINHAS TENTATIVAS NA QUESTÃO
--
--  Roda depois de 13_questao_como_lugar.sql. É idempotente.
--
--  `estatisticas_questao` devolvia só a última marcação da pessoa. Quem refaz
--  a questão quer ver a sequência: "em 20/08 marquei A e errei; em 29/08
--  marquei B e acertei" é a prova de que estudou — e é ela que o aluno procura
--  ao reabrir a questão.
--
--  O agregado da turma continua sendo agregado: a policy "respostas: próprias"
--  segue valendo e nenhuma linha de outra pessoa sai daqui.
-- ============================================================================
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
  v_minhas  jsonb;
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

  -- Da mais recente para a mais antiga: é a ordem em que se lê um histórico.
  select coalesce(jsonb_agg(
           jsonb_build_object('alternativa', alternativa, 'correta', correta,
                              'em', criado_em)
           order by criado_em desc), '[]'::jsonb)
    into v_minhas
  from public.respostas_questoes
  where questao_id = p_questao and perfil_id = v_perfil;

  return jsonb_build_object(
    'respostas',    v_total,
    'acertos',      v_acertos,
    'pct',          case when v_total > 0
                         then round(v_acertos * 100.0 / v_total)::integer
                         else null end,
    'distribuicao', v_dist,
    'minhas',       v_minhas,
    -- Mantido para não quebrar quem já lê `minha`.
    'minha',        v_minhas -> 0
  );
end
$fn$;

revoke all on function public.estatisticas_questao(uuid) from public, anon;
grant execute on function public.estatisticas_questao(uuid) to authenticated;
