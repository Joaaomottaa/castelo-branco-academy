-- ============================================================================
--  15 — O PERFIL CRIADO POR LOGIN SOCIAL
--
--  Roda depois de 14_historico_da_questao.sql. É idempotente.
--
--  `handle_new_user` só lia `nome`, que é o campo que o nosso formulário manda.
--  O Google manda `full_name` / `name`, e a foto em `avatar_url` / `picture`.
--  Sem ler esses campos, quem entra com Google vira "joaopaulo" (o pedaço do
--  e-mail antes do @) e sem foto — logo no primeiro contato com a plataforma.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nome text;
begin
  v_nome := coalesce(
    nullif(v_meta ->> 'nome', ''),
    nullif(v_meta ->> 'full_name', ''),
    nullif(v_meta ->> 'name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.perfis (id, nome, email, role, avatar_url, consentimento_em)
  values (
    new.id,
    v_nome,
    new.email,
    coalesce((v_meta ->> 'role')::public.user_role, 'aluno'),
    coalesce(nullif(v_meta ->> 'avatar_url', ''), nullif(v_meta ->> 'picture', '')),
    now()
  )
  on conflict (id) do nothing;

  return new;
end
$fn$;
