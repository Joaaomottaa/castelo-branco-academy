-- ============================================================================
--  CASTELO BRANCO ACADEMY — 05. CORREÇÃO DO AUTH
--
--  Rode este arquivo se o login retornar "Database error querying schema".
--
--  POR QUE ISSO ACONTECE
--  O 03_usuarios_demo.sql insere direto em auth.users. As colunas de token
--  (confirmation_token, recovery_token, email_change...) ficam NULL, mas o
--  serviço de autenticação do Supabase (GoTrue, escrito em Go) lê esses campos
--  como string simples — e falha ao encontrar NULL. O erro aparece como
--  "Database error querying schema", que não diz nada sobre a causa real.
--
--  A correção é trocar NULL por string vazia. Idempotente e seguro.
-- ============================================================================

do $$
declare
  col      record;
  ajustados integer := 0;
  n        integer;
begin
  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'auth'
      and table_name   = 'users'
      and data_type in ('text', 'character varying')
      and column_name in (
        'confirmation_token',
        'recovery_token',
        'email_change',
        'email_change_token_new',
        'email_change_token_current',
        'phone_change',
        'phone_change_token',
        'reauthentication_token'
      )
  loop
    execute format(
      'update auth.users set %I = %L where %I is null',
      col.column_name, '', col.column_name
    );
    get diagnostics n = row_count;
    ajustados := ajustados + n;
    raise notice 'coluna % — % linha(s) ajustada(s)', col.column_name, n;
  end loop;

  raise notice 'Total de ajustes: %', ajustados;
end $$;

-- Garante também que os usuários de demonstração estão confirmados -----------
-- (confirmed_at não entra aqui: nas versões novas é coluna gerada e não aceita update)
update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null
  and (email like '%@castelobranco.com.br' or email like '%@exemplo.com');

-- ============================================================================
--  Conferência — nenhuma linha deve sobrar aqui
-- ============================================================================
select
  count(*) filter (where confirmation_token is null)     as token_confirmacao_nulo,
  count(*) filter (where recovery_token is null)         as token_recuperacao_nulo,
  count(*) filter (where email_change is null)           as email_change_nulo,
  count(*) filter (where email_confirmed_at is null)     as email_nao_confirmado,
  count(*)                                               as total_usuarios
from auth.users;
-- Esperado: 0 | 0 | 0 | 0 | 9
