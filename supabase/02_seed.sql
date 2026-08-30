-- ============================================================================
--  CASTELO BRANCO ACADEMY — 02. SEED DE CONTEÚDO
--  Rode DEPOIS do 01_schema.sql. Idempotente: pode rodar de novo.
--  Popula: cursos, módulos, aulas, empresas, vagas, habilidades, conquistas.
--  (Usuários de demonstração ficam no 03_usuarios_demo.sql)
-- ============================================================================

-- ======================================================================
--  CURSOS
-- ======================================================================
insert into public.cursos
  (slug, titulo, subtitulo, descricao, categoria, nivel, cor, instrutor, instrutor_cargo,
   carga_horaria, pontos_pepc, publicado, destaque, novo, nota, alunos, tags)
values
  ('reforma-tributaria-na-pratica',
   'Reforma Tributária na Prática',
   'CBS, IBS e Imposto Seletivo aplicados à operação real',
   'Da leitura da EC 132 à reprecificação de contratos: como conduzir a transição sem perder margem. Casos reais de transporte, armazenagem e comércio exterior.',
   'Tributário', 'Avançado', '#00204D',
   'Adílio Castelo Branco', 'Contador — 20+ anos em tributário complexo',
   18, 18, true, true, true, 4.9, 1284,
   array['CBS','IBS','Split payment','Crédito']),

  ('recuperacao-de-creditos-tributarios',
   'Recuperação de Créditos Tributários',
   'Método de revisão dos últimos 60 meses',
   'Levantamento, cruzamento e habilitação de créditos com sustentação documental. Do diagnóstico ao PER/DCOMP, com governança e trilha de auditoria.',
   'Tributário', 'Avançado', '#0D3563',
   'Adílio Castelo Branco', 'Contador — Consultoria tributária',
   22, 22, true, true, false, 4.8, 968,
   array['PIS/COFINS','PER/DCOMP','Revisão','ICMS-ST']),

  ('contabilidade-para-transporte-e-logistica',
   'Contabilidade para Transporte e Logística',
   'CT-e, MDF-e, frete e custo por rota',
   'A rotina fiscal de quem move carga: documentos eletrônicos, regimes especiais, custo por rota e os erros que viram autuação.',
   'Setorial', 'Intermediário', '#2F6E75',
   'Equipe Castelo Branco', 'Time de contabilidade setorial',
   16, 16, true, false, false, 4.7, 742,
   array['CT-e','MDF-e','Frete','Custo por rota']),

  ('comercio-exterior-e-rotina-aduaneira',
   'Comércio Exterior e Rotina Aduaneira',
   'Importação, exportação e controle de risco',
   'Classificação fiscal, regimes aduaneiros especiais, drawback e o controle documental que evita autuação na Receita.',
   'Setorial', 'Avançado', '#B88A45',
   'Equipe Castelo Branco', 'Especialistas em comex',
   20, 20, true, false, true, 4.8, 531,
   array['NCM','Drawback','Siscomex','Aduaneiro']),

  ('departamento-fiscal-do-zero',
   'Departamento Fiscal do Zero',
   'Formação inicial para quem vai operar a rotina',
   'Trilha de entrada: regimes, obrigações acessórias, calendário fiscal e organização de documentos. A base que todo escritório cobra.',
   'Formação', 'Iniciante', '#00204D',
   'Equipe Castelo Branco', 'Formação profissional',
   24, 24, true, true, false, 4.9, 2103,
   array['Simples Nacional','SPED','Obrigações acessórias']),

  ('contabilidade-consultiva-e-gestao',
   'Contabilidade Consultiva',
   'De guarda-livros a conselheiro do cliente',
   'Como transformar número fiscal em decisão de caixa, contrato e margem. Método de reunião executiva, indicadores e precificação de honorários.',
   'Gestão', 'Intermediário', '#0D3563',
   'Adílio Castelo Branco', 'Contabilidade consultiva',
   14, 14, true, false, false, 4.9, 655,
   array['Consultivo','Honorários','Indicadores','Cliente'])
on conflict (slug) do nothing;

-- ======================================================================
--  MÓDULOS
-- ======================================================================
insert into public.modulos (curso_id, titulo, resumo, ordem)
select c.id, m.titulo, m.resumo, m.ordem
from public.cursos c
join (values
  ('reforma-tributaria-na-pratica', 'Fundamentos da EC 132/2023', 'O novo desenho constitucional do consumo', 1),
  ('reforma-tributaria-na-pratica', 'Crédito financeiro e não cumulatividade plena', 'O maior ganho — e a maior armadilha', 2),
  ('reforma-tributaria-na-pratica', 'Reprecificação e contratos', 'Traduzir alíquota em decisão comercial', 3),

  ('recuperacao-de-creditos-tributarios', 'Diagnóstico e triagem', 'Por onde começar a revisão', 1),
  ('recuperacao-de-creditos-tributarios', 'Teses seguras x teses de risco', 'O que sustenta e o que expõe', 2),
  ('recuperacao-de-creditos-tributarios', 'Execução e defesa', 'Do pedido à sustentação documental', 3),

  ('contabilidade-para-transporte-e-logistica', 'Documentos eletrônicos do transporte', 'CT-e, MDF-e e encerramento', 1),
  ('contabilidade-para-transporte-e-logistica', 'Custo, margem e precificação de frete', 'O número que decide o contrato', 2),

  ('comercio-exterior-e-rotina-aduaneira', 'Classificação e tributos na importação', 'Onde nasce o erro mais caro', 1),
  ('comercio-exterior-e-rotina-aduaneira', 'Regimes especiais', 'Drawback, entreposto e temporária', 2),

  ('departamento-fiscal-do-zero', 'Regimes tributários', 'Simples, Presumido e Real', 1),
  ('departamento-fiscal-do-zero', 'Obrigações acessórias', 'O calendário que não pode falhar', 2),
  ('departamento-fiscal-do-zero', 'Rotina do escritório', 'Fechamento sem retrabalho', 3),

  ('contabilidade-consultiva-e-gestao', 'O ritual de gestão', 'A reunião que o cliente não falta', 1),
  ('contabilidade-consultiva-e-gestao', 'Precificação de honorários', 'Sair da tabela e vender valor', 2)
) as m(slug, titulo, resumo, ordem) on m.slug = c.slug
on conflict (curso_id, ordem) do nothing;

-- ======================================================================
--  AULAS
-- ======================================================================
insert into public.aulas (modulo_id, titulo, descricao, tipo, duracao_min, ordem, gratuita)
select mo.id, a.titulo, a.descricao, a.tipo::public.tipo_aula, a.duracao_min, a.ordem, a.gratuita
from public.modulos mo
join public.cursos c on c.id = mo.curso_id
join (values
  -- Reforma Tributária ------------------------------------------------------
  ('reforma-tributaria-na-pratica',1,'Por que o sistema antigo quebrou','Cumulatividade, guerra fiscal e o custo invisível do contencioso.','video',14,1,true),
  ('reforma-tributaria-na-pratica',1,'CBS, IBS e Imposto Seletivo: quem cobra o quê',null,'video',22,2,true),
  ('reforma-tributaria-na-pratica',1,'Cronograma de transição 2026–2033',null,'video',17,3,false),
  ('reforma-tributaria-na-pratica',1,'Quiz — mapa mental da reforma',null,'quiz',8,4,false),
  ('reforma-tributaria-na-pratica',2,'O que passa a gerar crédito',null,'video',26,1,false),
  ('reforma-tributaria-na-pratica',2,'Split payment: o crédito condicionado ao pagamento',null,'video',19,2,false),
  ('reforma-tributaria-na-pratica',2,'Planilha — simulador de crédito',null,'material',5,3,false),
  ('reforma-tributaria-na-pratica',2,'Estudo de caso: transportadora com 40 filiais',null,'video',31,4,false),
  ('reforma-tributaria-na-pratica',3,'Repasse, absorção e renegociação de frete',null,'video',24,1,false),
  ('reforma-tributaria-na-pratica',3,'Cláusulas de revisão tributária',null,'video',18,2,false),
  ('reforma-tributaria-na-pratica',3,'Mentoria ao vivo — tira-dúvidas',null,'ao-vivo',60,3,false),
  ('reforma-tributaria-na-pratica',3,'Avaliação final',null,'quiz',20,4,false),

  -- Recuperação de créditos -------------------------------------------------
  ('recuperacao-de-creditos-tributarios',1,'Onde o crédito costuma se esconder',null,'video',20,1,true),
  ('recuperacao-de-creditos-tributarios',1,'Coleta de SPED, EFD e notas',null,'video',25,2,false),
  ('recuperacao-de-creditos-tributarios',1,'Checklist de triagem',null,'material',6,3,false),
  ('recuperacao-de-creditos-tributarios',2,'Insumo: o conceito que decide o caso',null,'video',28,1,false),
  ('recuperacao-de-creditos-tributarios',2,'ICMS-ST e substituição na cadeia logística',null,'video',23,2,false),
  ('recuperacao-de-creditos-tributarios',2,'A camada vedada: o que nunca compensar',null,'video',16,3,false),
  ('recuperacao-de-creditos-tributarios',2,'Quiz de classificação de risco',null,'quiz',12,4,false),
  ('recuperacao-de-creditos-tributarios',3,'PER/DCOMP passo a passo',null,'video',34,1,false),
  ('recuperacao-de-creditos-tributarios',3,'Dossiê de sustentação e auditoria',null,'video',21,2,false),
  ('recuperacao-de-creditos-tributarios',3,'Projeto final avaliado',null,'quiz',45,3,false),

  -- Transporte e logística --------------------------------------------------
  ('contabilidade-para-transporte-e-logistica',1,'CT-e na prática',null,'video',27,1,true),
  ('contabilidade-para-transporte-e-logistica',1,'MDF-e e encerramento',null,'video',19,2,false),
  ('contabilidade-para-transporte-e-logistica',1,'Erros que geram autuação',null,'video',22,3,false),
  ('contabilidade-para-transporte-e-logistica',2,'Custo por rota e por km',null,'video',30,1,false),
  ('contabilidade-para-transporte-e-logistica',2,'Planilha de formação de frete',null,'material',8,2,false),
  ('contabilidade-para-transporte-e-logistica',2,'Avaliação',null,'quiz',15,3,false),

  -- Comércio exterior -------------------------------------------------------
  ('comercio-exterior-e-rotina-aduaneira',1,'NCM: o erro mais caro do comex',null,'video',25,1,true),
  ('comercio-exterior-e-rotina-aduaneira',1,'Base de cálculo na importação',null,'video',29,2,false),
  ('comercio-exterior-e-rotina-aduaneira',1,'Quiz de classificação',null,'quiz',10,3,false),
  ('comercio-exterior-e-rotina-aduaneira',2,'Drawback: suspensão, isenção e restituição',null,'video',33,1,false),
  ('comercio-exterior-e-rotina-aduaneira',2,'Entreposto e admissão temporária',null,'video',24,2,false),
  ('comercio-exterior-e-rotina-aduaneira',2,'Dossiê aduaneiro modelo',null,'material',7,3,false),

  -- Departamento fiscal do zero ---------------------------------------------
  ('departamento-fiscal-do-zero',1,'Simples, Presumido e Real: quando cada um',null,'video',31,1,true),
  ('departamento-fiscal-do-zero',1,'Anexos e fator R',null,'video',22,2,false),
  ('departamento-fiscal-do-zero',1,'Quiz de enquadramento',null,'quiz',12,3,false),
  ('departamento-fiscal-do-zero',2,'Calendário fiscal anual',null,'video',18,1,false),
  ('departamento-fiscal-do-zero',2,'SPED Fiscal e Contribuições',null,'video',35,2,false),
  ('departamento-fiscal-do-zero',2,'Organização de documentos',null,'video',16,3,false),
  ('departamento-fiscal-do-zero',3,'Fechamento mensal sem retrabalho',null,'video',27,1,false),
  ('departamento-fiscal-do-zero',3,'Comunicação com o cliente',null,'video',19,2,false),
  ('departamento-fiscal-do-zero',3,'Avaliação final',null,'quiz',25,3,false),

  -- Consultiva --------------------------------------------------------------
  ('contabilidade-consultiva-e-gestao',1,'A reunião que o cliente não falta',null,'video',23,1,true),
  ('contabilidade-consultiva-e-gestao',1,'Indicadores que importam',null,'video',26,2,false),
  ('contabilidade-consultiva-e-gestao',1,'Template de relatório executivo',null,'material',6,3,false),
  ('contabilidade-consultiva-e-gestao',2,'Sair da tabela e vender valor',null,'video',28,1,false),
  ('contabilidade-consultiva-e-gestao',2,'Proposta comercial que fecha',null,'video',21,2,false),
  ('contabilidade-consultiva-e-gestao',2,'Avaliação',null,'quiz',15,3,false)
) as a(slug, mod_ordem, titulo, descricao, tipo, duracao_min, ordem, gratuita)
  on a.slug = c.slug and a.mod_ordem = mo.ordem
on conflict (modulo_id, ordem) do nothing;

-- ======================================================================
--  HABILIDADES
-- ======================================================================
insert into public.habilidades (nome, grupo) values
  ('SPED','Fiscal'),
  ('CT-e','Transporte'),
  ('MDF-e','Transporte'),
  ('Lucro Real','Tributário'),
  ('Simples Nacional','Tributário'),
  ('Excel avançado','Ferramentas'),
  ('Power BI','Ferramentas'),
  ('Reforma Tributária','Tributário'),
  ('Recuperação de créditos','Tributário'),
  ('PER/DCOMP','Tributário'),
  ('Contencioso','Jurídico'),
  ('NCM','Comex'),
  ('Siscomex','Comex'),
  ('Drawback','Comex'),
  ('Inglês avançado','Idiomas'),
  ('Consultivo','Gestão'),
  ('Gestão de equipe','Gestão'),
  ('IFRS','Contábil'),
  ('Conciliação','Contábil'),
  ('EFD-Reinf','Fiscal'),
  ('eSocial','Trabalhista'),
  ('Automação','Ferramentas'),
  ('Python','Ferramentas')
on conflict (nome) do nothing;

-- ======================================================================
--  CONQUISTAS
-- ======================================================================
insert into public.conquistas (slug, nome, descricao, icone, xp) values
  ('primeira-aula',    'Primeiro passo',   'Assistiu à primeira aula da plataforma',        '🎓', 50),
  ('ofensiva-7',       'Uma semana firme', '7 dias seguidos de estudo',                     '🔥', 150),
  ('ofensiva-30',      'Constância',       '30 dias seguidos de estudo',                    '⚡', 600),
  ('primeiro-cert',    'Certificado',      'Emitiu o primeiro certificado',                 '🏅', 300),
  ('trilha-completa',  'Trilha concluída', 'Concluiu uma trilha de carreira inteira',       '🏆', 1000),
  ('nota-maxima',      'Gabaritou',        'Tirou 100% em uma avaliação final',             '💯', 250),
  ('perfil-completo',  'Perfil pronto',    'Completou 100% do perfil no banco de talentos', '✨', 120),
  ('primeira-vaga',    'No mercado',       'Enviou a primeira candidatura',                 '💼', 100)
on conflict (slug) do nothing;

-- ======================================================================
--  EMPRESAS (as parceiras já listadas no site institucional)
-- ======================================================================
insert into public.empresas (nome, cor, site, cidade, uf) values
  ('Castelo Branco Contabilidade', '#C89F50', 'https://www.castelobrancocontabilidade.com.br', 'Feira de Santana', 'BA'),
  ('TransLog Brasil',              '#00204D', null,                                            'Feira de Santana', 'BA'),
  ('Fisconta Online',              '#B88A45', 'https://www.fiscontaonline.com.br',             'Salvador',         'BA'),
  ('Focus Empresarial',            '#0D3563', null,                                            'Feira de Santana', 'BA'),
  ('China Direta',                 '#2F6E75', 'https://www.chinadireta.com.br',                'São Paulo',        'SP'),
  ('Merkato Commerce',             '#1F4A7A', 'https://www.merkatocommerce.com.br',            'São Paulo',        'SP'),
  ('GiroHub',                      '#47709C', 'https://girohub.ia.br',                         'Salvador',         'BA'),
  ('Geceti',                       '#2F6E75', 'https://www.geceti.com.br',                     'Salvador',         'BA'),
  ('Metamind Treinamentos',        '#B88A45', 'https://www.metamind.com.br',                   'Salvador',         'BA')
on conflict (nome) do nothing;

-- ======================================================================
--  VAGAS
-- ======================================================================
insert into public.vagas
  (empresa_id, titulo, descricao, cidade, uf, modelo, contrato, faixa, senioridade,
   requisitos, cursos_desejados, ativa, publicada_em)
select
  e.id, v.titulo, v.descricao, v.cidade, v.uf,
  v.modelo::public.modelo_trabalho, v.contrato::public.contrato_tipo,
  v.faixa, v.senioridade::public.senioridade,
  v.requisitos,
  coalesce((select array_agg(c.id) from public.cursos c where c.slug = any(v.cursos)), '{}'),
  true, v.publicada::timestamptz
from (values
  ('TransLog Brasil',
   'Analista Fiscal Pleno — Transporte',
   'Responsável pela apuração fiscal de uma frota de 180 veículos, conferência de CT-e/MDF-e e suporte ao fechamento mensal.',
   'Feira de Santana','BA','Híbrido','CLT','R$ 5.500 – R$ 7.200','Pleno',
   array['CT-e / MDF-e','SPED Fiscal','Excel avançado','CRC ativo'],
   array['contabilidade-para-transporte-e-logistica'],
   '2026-08-20'),

  ('Fisconta Online',
   'Consultor Tributário — Reforma',
   'Conduzir projetos de transição para a Reforma Tributária em clientes de logística e distribuição.',
   'Salvador','BA','Remoto','PJ','R$ 9.000 – R$ 14.000','Sênior',
   array['EC 132','CBS/IBS','Reprecificação','Atendimento a clientes'],
   array['reforma-tributaria-na-pratica'],
   '2026-08-24'),

  ('China Direta',
   'Analista de Comércio Exterior Jr.',
   'Apoio na abertura de DI, conferência documental e acompanhamento de desembaraço.',
   'São Paulo','SP','Presencial','CLT','R$ 3.200 – R$ 4.100','Júnior',
   array['NCM','Siscomex','Inglês intermediário'],
   array['comercio-exterior-e-rotina-aduaneira'],
   '2026-08-18'),

  ('Focus Empresarial',
   'Contador Responsável Técnico',
   'Responsabilidade técnica por carteira de 60 empresas e liderança de time de 6 pessoas.',
   'Feira de Santana','BA','Presencial','CLT','R$ 8.000 – R$ 11.000','Sênior',
   array['CRC ativo','Lucro Real','Gestão de equipe','Consultivo'],
   array['contabilidade-consultiva-e-gestao','recuperacao-de-creditos-tributarios'],
   '2026-08-12'),

  ('Castelo Branco Contabilidade',
   'Estágio em Departamento Fiscal',
   'Programa de formação com trilha obrigatória na Academy e mentoria semanal.',
   'Feira de Santana','BA','Presencial','Estágio','R$ 1.400 + benefícios','Estagiário',
   array['Cursando Ciências Contábeis','Excel','Vontade de aprender'],
   array['departamento-fiscal-do-zero'],
   '2026-08-25')
) as v(empresa, titulo, descricao, cidade, uf, modelo, contrato, faixa, senioridade,
       requisitos, cursos, publicada)
join public.empresas e on e.nome = v.empresa
where not exists (
  select 1 from public.vagas x where x.titulo = v.titulo and x.empresa_id = e.id
);

-- ======================================================================
--  Conferência rápida
-- ======================================================================
select
  (select count(*) from public.cursos)      as cursos,
  (select count(*) from public.modulos)     as modulos,
  (select count(*) from public.aulas)       as aulas,
  (select count(*) from public.empresas)    as empresas,
  (select count(*) from public.vagas)       as vagas,
  (select count(*) from public.habilidades) as habilidades,
  (select count(*) from public.conquistas)  as conquistas;
-- Esperado: 6 | 15 | 49 | 9 | 5 | 23 | 8
