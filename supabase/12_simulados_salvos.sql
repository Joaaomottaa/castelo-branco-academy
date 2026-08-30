-- ============================================================================
--  12 — SIMULADO GUARDADO E FEEDBACK DO TINO
--
--  Roda depois de 11_selos_avaliacao_questoes.sql. É idempotente.
--
--  `simulados` guardava só o placar: total, acertos e nota. Isso responde
--  "como fui", nunca "onde errei" — e é a segunda pergunta que faz o aluno
--  voltar. Sem as respostas gravadas, reabrir o simulado mostraria um número
--  solto, e o Tino não teria o que analisar.
-- ============================================================================

alter table public.simulados
  add column if not exists respostas    jsonb not null default '[]'::jsonb,
  add column if not exists feedback     text,
  add column if not exists feedback_em  timestamptz;

-- O feedback é caro de gerar e não muda: o simulado já terminou. Guardar o
-- texto evita queimar chamada de IA toda vez que a pessoa reabre a tela.
comment on column public.simulados.feedback is
  'Análise do Tino sobre este simulado. Gerada uma vez, sob demanda do aluno.';

comment on column public.simulados.respostas is
  'Questões como foram respondidas, com o enunciado copiado: o simulado é um registro do que aconteceu e não pode mudar se a questão for corrigida depois.';

create index if not exists idx_simulados_perfil_data
  on public.simulados (perfil_id, finalizado_em desc);
