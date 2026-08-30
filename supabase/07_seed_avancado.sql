-- ============================================================================
--  CASTELO BRANCO ACADEMY — 07. SEED DOS MÓDULOS AVANÇADOS
--  Rode DEPOIS do 06_modulos_avancados.sql. Idempotente.
--  Popula: 4 cursos novos, 5 trilhas, 21 conquistas, 7 missões,
--          27 questões e o feed inicial da comunidade.
-- ============================================================================

-- ============================================================================
--  CURSOS QUE COMPLETAM AS TRILHAS
-- ============================================================================
insert into public.cursos
  (slug, titulo, subtitulo, descricao, categoria, nivel, cor, instrutor, instrutor_cargo,
   carga_horaria, pontos_pepc, publicado, destaque, novo, nota, alunos, tags)
values
  ('departamento-pessoal-do-zero','Departamento Pessoal do Zero',
   'Admissão, folha, férias e rescisão sem retrabalho',
   'A rotina completa do DP: da admissão ao acerto final. Cálculos, prazos e os erros que viram processo trabalhista.',
   'Pessoal','Iniciante','#2F6E75','Equipe Castelo Branco','Formação profissional',
   20,20,true,false,true,4.8,894,array['Folha','Férias','Rescisão','CLT']),
  ('esocial-e-efd-reinf','eSocial e EFD-Reinf na Prática',
   'Eventos, prazos e como corrigir sem multa',
   'Os eventos que mais geram inconsistência, o cruzamento com a folha e o passo a passo do retificar sem tomar multa.',
   'Pessoal','Intermediário','#0D3563','Equipe Castelo Branco','Obrigações acessórias',
   14,14,true,false,true,4.7,612,array['eSocial','EFD-Reinf','DCTFWeb','Retificação']),
  ('contabilidade-gerencial-e-controladoria','Contabilidade Gerencial e Controladoria',
   'Do balancete ao painel que o dono lê',
   'Centro de custo, margem de contribuição, ponto de equilíbrio e orçamento. Transformar contabilidade em instrumento de decisão.',
   'Gestão','Avançado','#B88A45','Adílio Castelo Branco','Controladoria',
   18,18,true,false,false,4.9,437,array['Custos','Orçamento','KPI','Margem']),
  ('excel-e-power-bi-para-contadores','Excel e Power BI para Contadores',
   'Parar de conferir na mão',
   'Fórmulas que resolvem conciliação, tabela dinâmica aplicada ao fiscal e um painel de Power BI ligado ao SPED.',
   'Ferramentas','Intermediário','#1F4A7A','Equipe Castelo Branco','Automação contábil',
   12,12,true,false,false,4.8,1163,array['Excel','Power BI','Conciliação','Automação'])
on conflict (slug) do nothing;

insert into public.modulos (curso_id, titulo, resumo, ordem)
select c.id, m.titulo, m.resumo, m.ordem from public.cursos c
join (values
  ('departamento-pessoal-do-zero','Admissão e rotina mensal','Contratar sem deixar passivo',1),
  ('departamento-pessoal-do-zero','Férias, 13º e rescisão','Os cálculos que mais erram',2),
  ('esocial-e-efd-reinf','Eventos e prazos','O calendário que não perdoa',1),
  ('esocial-e-efd-reinf','Inconsistências e retificação','Corrigir antes da multa',2),
  ('contabilidade-gerencial-e-controladoria','Custos e margem','Onde o lucro se esconde',1),
  ('contabilidade-gerencial-e-controladoria','Orçamento e indicadores','O painel que o dono lê',2),
  ('excel-e-power-bi-para-contadores','Excel aplicado ao fiscal','Parar de conferir na mão',1),
  ('excel-e-power-bi-para-contadores','Power BI sobre o SPED','Do arquivo ao painel',2)
) as m(slug,titulo,resumo,ordem) on m.slug = c.slug
on conflict (curso_id, ordem) do nothing;

insert into public.aulas (modulo_id, titulo, tipo, duracao_min, ordem, gratuita)
select mo.id, a.titulo, a.tipo::public.tipo_aula, a.dur, a.ordem, a.gratis
from public.modulos mo join public.cursos c on c.id = mo.curso_id
join (values
  ('departamento-pessoal-do-zero',1,'Documentos e registro do empregado','video',24,1,true),
  ('departamento-pessoal-do-zero',1,'Folha de pagamento passo a passo','video',32,2,false),
  ('departamento-pessoal-do-zero',1,'Encargos: INSS, FGTS e IRRF','video',28,3,false),
  ('departamento-pessoal-do-zero',2,'Férias: aquisitivo, concessivo e abono','video',26,1,false),
  ('departamento-pessoal-do-zero',2,'Rescisão sem passivo','video',30,2,false),
  ('departamento-pessoal-do-zero',2,'Avaliação final','quiz',20,3,false),
  ('esocial-e-efd-reinf',1,'Mapa dos eventos do eSocial','video',22,1,true),
  ('esocial-e-efd-reinf',1,'EFD-Reinf e a DCTFWeb','video',26,2,false),
  ('esocial-e-efd-reinf',1,'Calendário de envios','material',6,3,false),
  ('esocial-e-efd-reinf',2,'As 8 inconsistências mais comuns','video',24,1,false),
  ('esocial-e-efd-reinf',2,'Retificar sem tomar multa','video',21,2,false),
  ('esocial-e-efd-reinf',2,'Avaliação','quiz',15,3,false),
  ('contabilidade-gerencial-e-controladoria',1,'Centro de custo na prática','video',28,1,true),
  ('contabilidade-gerencial-e-controladoria',1,'Margem de contribuição e ponto de equilíbrio','video',31,2,false),
  ('contabilidade-gerencial-e-controladoria',1,'Planilha de custos','material',8,3,false),
  ('contabilidade-gerencial-e-controladoria',2,'Orçamento anual que não vira ficção','video',27,1,false),
  ('contabilidade-gerencial-e-controladoria',2,'Indicadores que o dono entende','video',23,2,false),
  ('contabilidade-gerencial-e-controladoria',2,'Projeto final avaliado','quiz',35,3,false),
  ('excel-e-power-bi-para-contadores',1,'PROCV, ÍNDICE e CORRESP na conciliação','video',26,1,true),
  ('excel-e-power-bi-para-contadores',1,'Tabela dinâmica aplicada ao fiscal','video',24,2,false),
  ('excel-e-power-bi-para-contadores',1,'Planilhas prontas','material',5,3,false),
  ('excel-e-power-bi-para-contadores',2,'Importar SPED no Power Query','video',29,1,false),
  ('excel-e-power-bi-para-contadores',2,'Montar o painel fiscal','video',25,2,false),
  ('excel-e-power-bi-para-contadores',2,'Avaliação','quiz',12,3,false)
) as a(slug,mod_ordem,titulo,tipo,dur,ordem,gratis)
  on a.slug = c.slug and a.mod_ordem = mo.ordem
on conflict (modulo_id, ordem) do nothing;

insert into public.habilidades (nome, grupo) values
  ('Folha de pagamento','Trabalhista'),('Rescisão','Trabalhista'),('DCTFWeb','Fiscal'),
  ('Custos','Gestão'),('Orçamento','Gestão'),('Power Query','Ferramentas'),
  ('CT-e/MDF-e','Transporte'),('Planejamento tributário','Tributário'),
  ('Obrigações acessórias','Fiscal'),('Atendimento ao cliente','Comportamental'),
  ('Comunicação','Comportamental')
on conflict (nome) do nothing;

-- ============================================================================
--  TRILHAS DE CARREIRA
-- ============================================================================
insert into public.trilhas
  (slug,nome,subtitulo,descricao,cargo_alvo,area,nivel_entrada,nivel_saida,cor,icone,faixa_salarial,ordem,publicada)
values
  ('analista-fiscal','Analista Fiscal — do iniciante ao profissional',
   'A trilha que tira você do zero e coloca no departamento fiscal',
   'Comece sem saber nada de rotina fiscal e termine apurando, conferindo documento eletrônico e fechando o mês sozinho. É a formação que todo escritório contábil cobra na entrevista.',
   'Analista Fiscal','Fiscal','Iniciante','Avançado','#00204D','file-text','R$ 2.500 – R$ 7.200',1,true),
  ('especialista-tributario','Especialista Tributário',
   'De quem executa para quem decide a tese',
   'Para quem já opera a rotina e quer conduzir projeto: revisão de créditos, planejamento e a transição da Reforma Tributária com sustentação documental.',
   'Consultor Tributário','Tributário','Intermediário','Avançado','#B88A45','scale','R$ 8.000 – R$ 16.000',2,true),
  ('comercio-exterior','Analista de Comércio Exterior',
   'Importação, exportação e o controle que evita autuação',
   'Classificação fiscal, regimes especiais e a rotina aduaneira ligada ao fiscal. A vertical que menos tem profissional formado no Brasil.',
   'Analista de Comex','Comex','Iniciante','Avançado','#2F6E75','ship','R$ 3.200 – R$ 9.000',3,true),
  ('departamento-pessoal','Departamento Pessoal Completo',
   'Da admissão ao eSocial sem passivo trabalhista',
   'Folha, encargos, férias, rescisão e as obrigações digitais. A área com mais vaga aberta e menos gente preparada.',
   'Analista de DP','Pessoal','Iniciante','Intermediário','#0D3563','users','R$ 2.400 – R$ 6.500',4,true),
  ('contador-consultivo','Contador Consultivo e Controller',
   'Sair da apuração e sentar na mesa de decisão',
   'Contabilidade que vira decisão de caixa, contrato e margem. Método de reunião executiva, indicadores, orçamento e precificação de honorários.',
   'Contador Consultivo','Gestão','Intermediário','Avançado','#1F4A7A','trending-up','R$ 9.000 – R$ 18.000',5,true)
on conflict (slug) do nothing;

insert into public.trilha_cursos (trilha_id, curso_id, ordem, obrigatorio)
select t.id, c.id, v.ordem, v.obrig from (values
  ('analista-fiscal','departamento-fiscal-do-zero',1,true),
  ('analista-fiscal','excel-e-power-bi-para-contadores',2,true),
  ('analista-fiscal','contabilidade-para-transporte-e-logistica',3,true),
  ('analista-fiscal','reforma-tributaria-na-pratica',4,true),
  ('especialista-tributario','reforma-tributaria-na-pratica',1,true),
  ('especialista-tributario','recuperacao-de-creditos-tributarios',2,true),
  ('especialista-tributario','contabilidade-consultiva-e-gestao',3,true),
  ('comercio-exterior','departamento-fiscal-do-zero',1,true),
  ('comercio-exterior','comercio-exterior-e-rotina-aduaneira',2,true),
  ('comercio-exterior','contabilidade-para-transporte-e-logistica',3,true),
  ('comercio-exterior','reforma-tributaria-na-pratica',4,false),
  ('departamento-pessoal','departamento-pessoal-do-zero',1,true),
  ('departamento-pessoal','esocial-e-efd-reinf',2,true),
  ('departamento-pessoal','excel-e-power-bi-para-contadores',3,false),
  ('contador-consultivo','contabilidade-consultiva-e-gestao',1,true),
  ('contador-consultivo','contabilidade-gerencial-e-controladoria',2,true),
  ('contador-consultivo','excel-e-power-bi-para-contadores',3,true),
  ('contador-consultivo','reforma-tributaria-na-pratica',4,false)
) as v(trilha,curso,ordem,obrig)
join public.trilhas t on t.slug = v.trilha
join public.cursos  c on c.slug = v.curso
on conflict (trilha_id, curso_id) do nothing;

insert into public.trilha_habilidades (trilha_id, habilidade_id, nivel_esperado)
select t.id, h.id, v.nivel from (values
  ('analista-fiscal','SPED',85),('analista-fiscal','Simples Nacional',80),
  ('analista-fiscal','Obrigações acessórias',85),('analista-fiscal','CT-e',75),
  ('analista-fiscal','Excel avançado',80),('analista-fiscal','Conciliação',75),
  ('especialista-tributario','Reforma Tributária',90),
  ('especialista-tributario','Recuperação de créditos',90),
  ('especialista-tributario','PER/DCOMP',85),
  ('especialista-tributario','Planejamento tributário',85),
  ('especialista-tributario','Lucro Real',80),
  ('comercio-exterior','NCM',88),('comercio-exterior','Siscomex',82),
  ('comercio-exterior','Drawback',80),('comercio-exterior','CT-e/MDF-e',72),
  ('comercio-exterior','Obrigações acessórias',75),
  ('departamento-pessoal','Folha de pagamento',88),('departamento-pessoal','Rescisão',85),
  ('departamento-pessoal','eSocial',85),('departamento-pessoal','EFD-Reinf',80),
  ('departamento-pessoal','DCTFWeb',75),
  ('contador-consultivo','Consultivo',90),('contador-consultivo','Custos',85),
  ('contador-consultivo','Orçamento',82),('contador-consultivo','Power BI',78),
  ('contador-consultivo','Comunicação',85),('contador-consultivo','Gestão de equipe',75)
) as v(trilha,hab,nivel)
join public.trilhas t on t.slug = v.trilha
join public.habilidades h on h.nome = v.hab
on conflict (trilha_id, habilidade_id) do nothing;

-- Vagas passam a exigir trilha, não só curso avulso
update public.vagas v set trilhas_desejadas = sub.ids
from (
  select vg.id as vaga_id, array_agg(t.id) as ids
  from public.vagas vg
  join public.trilhas t on t.slug = case vg.titulo
    when 'Analista Fiscal Pleno — Transporte' then 'analista-fiscal'
    when 'Consultor Tributário — Reforma'     then 'especialista-tributario'
    when 'Analista de Comércio Exterior Jr.'  then 'comercio-exterior'
    when 'Contador Responsável Técnico'       then 'contador-consultivo'
    when 'Estágio em Departamento Fiscal'     then 'analista-fiscal'
  end
  group by vg.id
) sub where v.id = sub.vaga_id;

-- ============================================================================
--  GAMIFICAÇÃO — conquistas com nome do vocabulário contábil
-- ============================================================================
insert into public.conquistas (slug,nome,descricao,icone,xp,categoria,raridade,criterio,recompensa,ordem) values
  ('primeira-aula','Primeiro lançamento','Assistiu à primeira aula da plataforma','🎬',50,'inicio','comum','{"metrica":"aulas","meta":1}','—',1),
  ('ofensiva-7','Fechamento semanal','7 dias seguidos estudando','🔥',150,'ofensiva','comum','{"metrica":"dias","meta":7}','+1 semana de Pro grátis',2),
  ('ofensiva-30','Competência encerrada','30 dias seguidos estudando','⚡',600,'ofensiva','raro','{"metrica":"dias","meta":30}','1 curso avulso à sua escolha',3),
  ('ofensiva-100','Exercício fechado','100 dias seguidos estudando','💎',2000,'ofensiva','lendario','{"metrica":"dias","meta":100}','1 mês de Pro + selo no perfil',4),
  ('maratona-semana','Hora extra','1 hora de aula por dia durante uma semana','⏱️',400,'estudo','raro','{"metrica":"minutos_por_dia","meta":60,"dias":7}','1 curso avulso à sua escolha',5),
  ('dez-horas','Regime de caixa','10 horas de conteúdo assistidas','📚',250,'estudo','comum','{"metrica":"minutos","meta":600}','—',6),
  ('cinquenta-horas','Lucro real','50 horas de conteúdo assistidas','🏛️',900,'estudo','raro','{"metrica":"minutos","meta":3000}','Mentoria em grupo',7),
  ('nota-maxima','Sem divergência','Gabaritou uma avaliação final','💯',250,'avaliacao','raro','{"metrica":"nota","meta":100}','—',8),
  ('cem-questoes','Auditoria completa','Respondeu 100 questões no banco','🔎',300,'avaliacao','comum','{"metrica":"questoes","meta":100}','—',9),
  ('simulado-80','Parecer favorável','Tirou 80% ou mais em um simulado','✅',350,'avaliacao','raro','{"metrica":"simulado","meta":80}','Correção comentada por IA liberada',10),
  ('primeiro-cert','Certidão negativa','Emitiu o primeiro certificado','🏅',300,'carreira','comum','{"metrica":"certificados","meta":1}','Perfil destacado por 7 dias',11),
  ('trilha-completa','Balanço fechado','Concluiu uma trilha de carreira inteira','🏆',1500,'carreira','epico','{"metrica":"trilhas","meta":1}','Selo verificado + topo da busca',12),
  ('tres-trilhas','Consolidação','Concluiu três trilhas','👑',5000,'carreira','lendario','{"metrica":"trilhas","meta":3}','1 ano de Pro',13),
  ('pepc-40','Educação continuada','Atingiu 40 pontos PEPC no ano','📋',800,'carreira','raro','{"metrica":"pepc","meta":40}','Relatório PEPC pronto para o CRC',14),
  ('perfil-completo','Cadastro regular','Completou 100% do perfil','✨',120,'carreira','comum','{"metrica":"perfil","meta":100}','—',15),
  ('primeira-vaga','Primeira DIRF','Enviou a primeira candidatura','💼',100,'carreira','comum','{"metrica":"candidaturas","meta":1}','—',16),
  ('contratado','Vínculo ativo','Foi contratado por uma empresa da plataforma','🤝',3000,'carreira','lendario','{"metrica":"contratacao","meta":1}','3 meses de Pro',17),
  ('primeiro-post','Nota explicativa','Fez a primeira publicação no feed','📣',80,'comunidade','comum','{"metrica":"posts","meta":1}','—',18),
  ('dez-conexoes','Rede de contatos','Conectou-se com 10 profissionais','🌐',200,'comunidade','comum','{"metrica":"conexoes","meta":10}','—',19),
  ('cem-curtidas','Parecer aprovado','Recebeu 100 curtidas no total','❤️',400,'comunidade','raro','{"metrica":"curtidas","meta":100}','Destaque no feed por 3 dias',20),
  ('mentor','Regime de mentoria','Respondeu 25 dúvidas de outros alunos','🎓',700,'comunidade','epico','{"metrica":"respostas","meta":25}','Selo Mentor + 1 mês de Pro',21)
on conflict (slug) do update set
  nome=excluded.nome, descricao=excluded.descricao, icone=excluded.icone, xp=excluded.xp,
  categoria=excluded.categoria, raridade=excluded.raridade, criterio=excluded.criterio,
  recompensa=excluded.recompensa, ordem=excluded.ordem;

insert into public.missoes (slug,titulo,descricao,icone,periodo,metrica,meta,xp,recompensa,ordem) values
  ('diaria-aula','Uma aula por dia','Assista pelo menos 1 aula hoje','play','diaria','aulas',1,30,null,1),
  ('diaria-questoes','5 questões do dia','Responda 5 questões no banco','check-square','diaria','questoes',5,40,null,2),
  ('semanal-3-aulas','Ritmo de estudo','Conclua 3 aulas nesta semana','layers','semanal','aulas',3,120,null,1),
  ('semanal-60min','Hora cheia','Acumule 60 minutos de aula na semana','clock','semanal','minutos',60,150,null,2),
  ('semanal-quiz','Prova real','Faça 1 avaliação nesta semana','clipboard-check','semanal','quiz',1,180,'+50 XP bônus',3),
  ('semanal-comunidade','Presença na rede','Comente ou publique no feed','message-circle','semanal','posts',1,90,null,4),
  ('mensal-curso','Fechar o mês','Conclua 1 curso inteiro no mês','award','mensal','cursos',1,600,'1 mês de Pro com 50% off',1)
on conflict (slug) do update set
  titulo=excluded.titulo, descricao=excluded.descricao, meta=excluded.meta,
  xp=excluded.xp, recompensa=excluded.recompensa;

-- ============================================================================
--  BANCO DE QUESTÕES
--  27 questões autorais cobrindo Tributário, Fiscal, Comex, Pessoal,
--  Contábil e Gestão. Substitua/expanda conforme a curadoria da equipe.
-- ============================================================================
insert into public.questoes_banco (enunciado, alternativas, correta, explicacao, area, assunto, nivel, banca, ano, tags) values
('A Emenda Constitucional 132/2023 substitui cinco tributos sobre consumo. Qual conjunto é extinto para dar lugar a CBS e IBS?','[{"id":"a","texto":"PIS, COFINS, IPI, ICMS e ISS"},{"id":"b","texto":"IRPJ, CSLL, PIS, COFINS e ISS"},{"id":"c","texto":"ICMS, ISS, IOF, IPI e CIDE"},{"id":"d","texto":"PIS, COFINS, ICMS, ITBI e ISS"}]','a','CBS substitui PIS e COFINS (federais). IBS substitui ICMS (estadual) e ISS (municipal). O IPI é praticamente zerado e cede espaço ao Imposto Seletivo. IRPJ e CSLL incidem sobre renda e ficam fora da reforma.','Tributário','Reforma Tributária','Iniciante','Autoral',2026,array['CBS','IBS','EC 132']),
('No modelo da CBS/IBS, o direito ao crédito do adquirente fica condicionado a:','[{"id":"a","texto":"Apenas à emissão do documento fiscal"},{"id":"b","texto":"Ao efetivo recolhimento do tributo pelo fornecedor"},{"id":"c","texto":"À classificação do bem como insumo essencial"},{"id":"d","texto":"Ao regime tributário do adquirente"}]','b','É a mudança de lógica mais relevante: sai a não cumulatividade meramente escritural e entra o crédito financeiro atrelado ao pagamento — base do split payment. Na prática, o comprador passa a ter interesse direto na regularidade do fornecedor.','Tributário','Reforma Tributária','Intermediário','Autoral',2026,array['Crédito','Split payment']),
('Sobre o período de transição da Reforma Tributária, é correto afirmar:','[{"id":"a","texto":"A substituição é integral já em 2026"},{"id":"b","texto":"A transição ocorre entre 2026 e 2033, com convivência dos dois sistemas"},{"id":"c","texto":"O ICMS é extinto imediatamente em 2027"},{"id":"d","texto":"Não há período de teste para CBS e IBS"}]','b','2026 é ano de teste com alíquotas simbólicas. A CBS entra plena em 2027 e o IBS sobe gradualmente até 2033, quando ICMS e ISS são extintos. Por sete anos a empresa opera dois sistemas ao mesmo tempo.','Tributário','Reforma Tributária','Intermediário','Autoral',2026,array['Transição','Cronograma']),
('O Imposto Seletivo incide sobre:','[{"id":"a","texto":"Todos os bens e serviços, com alíquota uniforme"},{"id":"b","texto":"Bens e serviços prejudiciais à saúde ou ao meio ambiente"},{"id":"c","texto":"Apenas produtos importados"},{"id":"d","texto":"Serviços financeiros e seguros"}]','b','O chamado imposto do pecado tem função extrafiscal: desestimular consumo nocivo. Não é arrecadatório puro e convive com CBS/IBS, não os substitui.','Tributário','Reforma Tributária','Iniciante','Autoral',2026,array['Imposto Seletivo']),
('O prazo prescricional para pleitear a restituição de tributo federal pago indevidamente é de:','[{"id":"a","texto":"2 anos"},{"id":"b","texto":"5 anos contados do pagamento indevido"},{"id":"c","texto":"10 anos"},{"id":"d","texto":"Não há prazo"}]','b','Artigo 168 do CTN combinado com a LC 118/2005: cinco anos contados da data do pagamento antecipado. É por isso que a revisão tributária trabalha sempre com a janela dos últimos 60 meses.','Tributário','Recuperação de Créditos','Intermediário','CFC',2026,array['Prescrição','CTN']),
('No regime não cumulativo de PIS/COFINS, o conceito de insumo foi definido pelo STJ (REsp 1.221.170) pelos critérios de:','[{"id":"a","texto":"Essencialidade e relevância para a atividade"},{"id":"b","texto":"Contato físico direto com o produto"},{"id":"c","texto":"Previsão expressa em lista taxativa"},{"id":"d","texto":"Valor superior a 5% do custo total"}]','a','O STJ afastou tanto o conceito restritivo do IPI quanto o amplíssimo do IRPJ. Vale o teste da essencialidade e relevância: sem aquele item, a atividade não se realiza ou perde qualidade relevante.','Tributário','Recuperação de Créditos','Avançado','Autoral',2026,array['PIS/COFINS','Insumo','STJ']),
('O PER/DCOMP é utilizado para:','[{"id":"a","texto":"Declarar faturamento mensal"},{"id":"b","texto":"Pedir restituição, ressarcimento ou declarar compensação"},{"id":"c","texto":"Recolher tributos em atraso"},{"id":"d","texto":"Solicitar parcelamento"}]','b','Pedido Eletrônico de Restituição, Ressarcimento ou Reembolso e Declaração de Compensação. A compensação declarada extingue o crédito tributário sob condição resolutória de posterior homologação.','Tributário','Recuperação de Créditos','Intermediário','Autoral',2026,array['PER/DCOMP']),
('O Fator R do Simples Nacional determina:','[{"id":"a","texto":"O limite de faturamento do regime"},{"id":"b","texto":"Se a empresa é tributada pelo Anexo III ou pelo Anexo V"},{"id":"c","texto":"A alíquota do ISS"},{"id":"d","texto":"O prazo de entrega do PGDAS"}]','b','Fator R = folha de salários dos últimos 12 meses ÷ receita bruta dos últimos 12 meses. Igual ou acima de 28%, Anexo III (alíquota menor). Abaixo, Anexo V. É a conta que mais muda a carga de prestadores de serviço.','Fiscal','Simples Nacional','Intermediário','Autoral',2026,array['Simples Nacional','Fator R']),
('A EFD-Contribuições tem por objetivo escriturar:','[{"id":"a","texto":"ICMS e IPI"},{"id":"b","texto":"PIS/PASEP, COFINS e a Contribuição Previdenciária sobre Receita Bruta"},{"id":"c","texto":"IRPJ e CSLL"},{"id":"d","texto":"ISS municipal"}]','b','ICMS e IPI ficam na EFD ICMS/IPI (SPED Fiscal). A EFD-Contribuições cobre PIS, COFINS e, quando aplicável, a CPRB.','Fiscal','SPED','Iniciante','Autoral',2026,array['SPED','EFD']),
('Empresa do Lucro Presumido com atividade comercial: qual o percentual de presunção sobre a receita bruta para apuração do IRPJ?','[{"id":"a","texto":"32%"},{"id":"b","texto":"8%"},{"id":"c","texto":"16%"},{"id":"d","texto":"1,6%"}]','b','Comércio e indústria: 8% para IRPJ e 12% para CSLL. Serviços em geral: 32%. Revenda de combustível: 1,6%. Trocar esses percentuais é um dos erros mais caros na apuração.','Fiscal','Lucro Presumido','Intermediário','CFC',2026,array['Lucro Presumido','IRPJ']),
('A obrigação acessória que substituiu a GFIP para a maior parte das informações previdenciárias é:','[{"id":"a","texto":"DIRF"},{"id":"b","texto":"eSocial em conjunto com a EFD-Reinf e a DCTFWeb"},{"id":"c","texto":"ECF"},{"id":"d","texto":"DCTF mensal"}]','b','O eSocial recebe os eventos de folha, a EFD-Reinf as retenções e outras informações, e a DCTFWeb consolida e gera a guia. A GFIP foi descontinuada nessa cadeia.','Fiscal','Obrigações acessórias','Intermediário','Autoral',2026,array['eSocial','EFD-Reinf','DCTFWeb']),
('O CT-e é o documento fiscal que ampara:','[{"id":"a","texto":"A circulação de mercadoria própria"},{"id":"b","texto":"A prestação de serviço de transporte de cargas"},{"id":"c","texto":"A prestação de serviço de comunicação"},{"id":"d","texto":"A importação de bens"}]','b','Conhecimento de Transporte Eletrônico. Quem move carga de terceiro emite CT-e; quem move mercadoria própria emite NF-e com CFOP adequado.','Fiscal','Transporte','Iniciante','Autoral',2026,array['CT-e']),
('O MDF-e deve ser emitido:','[{"id":"a","texto":"Somente em operações interestaduais"},{"id":"b","texto":"Quando houver transporte de carga fracionada em um mesmo veículo"},{"id":"c","texto":"Apenas para cargas perigosas"},{"id":"d","texto":"Em toda venda a consumidor final"}]','b','O Manifesto Eletrônico de Documentos Fiscais agrega os documentos transportados num mesmo veículo. Precisa ser encerrado ao fim do percurso, e o não encerramento é uma das autuações mais comuns do setor.','Fiscal','Transporte','Intermediário','Autoral',2026,array['MDF-e','Encerramento']),
('Na prestação de serviço de transporte interestadual de cargas, o ICMS é devido:','[{"id":"a","texto":"Ao estado de destino da carga"},{"id":"b","texto":"Ao estado onde se inicia a prestação"},{"id":"c","texto":"Ao município do tomador"},{"id":"d","texto":"À União"}]','b','A regra do ICMS-transporte é o local de início da prestação. Erro clássico é aplicar a lógica da mercadoria (destino) ao serviço de transporte.','Fiscal','Transporte','Avançado','Autoral',2026,array['ICMS','Transporte']),
('A NCM utilizada na classificação fiscal de mercadorias tem quantos dígitos?','[{"id":"a","texto":"6"},{"id":"b","texto":"8"},{"id":"c","texto":"10"},{"id":"d","texto":"4"}]','b','Oito dígitos: os seis primeiros vêm do Sistema Harmonizado internacional e os dois últimos são o desdobramento do Mercosul. Classificação errada muda alíquota, tratamento administrativo e pode gerar multa de 1% sobre o valor aduaneiro.','Comex','Classificação Fiscal','Iniciante','Autoral',2026,array['NCM','Classificação']),
('O regime de drawback na modalidade suspensão permite:','[{"id":"a","texto":"Isenção definitiva de todos os tributos na importação"},{"id":"b","texto":"Suspender tributos na importação de insumos destinados a produto a ser exportado"},{"id":"c","texto":"Restituir tributos pagos em exportações anteriores"},{"id":"d","texto":"Diferir o ICMS por 5 anos"}]','b','Suspende II, IPI, PIS/COFINS-Importação e, com anuência estadual, o ICMS, na importação de insumo que vai virar produto exportado. Se a exportação não acontecer no prazo, os tributos são exigidos com acréscimos.','Comex','Regimes Aduaneiros','Avançado','Autoral',2026,array['Drawback']),
('A base de cálculo do Imposto de Importação é:','[{"id":"a","texto":"O valor FOB da mercadoria"},{"id":"b","texto":"O valor aduaneiro, apurado conforme o Acordo de Valoração Aduaneira"},{"id":"c","texto":"O valor da nota fiscal de venda no Brasil"},{"id":"d","texto":"O custo de produção no exterior"}]','b','Valor aduaneiro = FOB + frete internacional + seguro (CIF), conforme o AVA-GATT. Usar só o FOB subestima toda a cadeia de tributos da importação.','Comex','Tributos na Importação','Intermediário','Autoral',2026,array['Valor aduaneiro','II']),
('O prazo para pagamento das verbas rescisórias, na dispensa sem justa causa com aviso prévio indenizado, é de:','[{"id":"a","texto":"10 dias corridos a contar do término do contrato"},{"id":"b","texto":"30 dias"},{"id":"c","texto":"O primeiro dia útil seguinte"},{"id":"d","texto":"48 horas"}]','a','Art. 477 da CLT, com a redação da Reforma Trabalhista: dez dias corridos contados do término do contrato, independentemente da modalidade de aviso. Atraso gera multa de um salário ao empregado.','Pessoal','Rescisão','Intermediário','Autoral',2026,array['CLT','Rescisão','Prazo']),
('O adicional de férias (terço constitucional) incide sobre:','[{"id":"a","texto":"Apenas o salário base"},{"id":"b","texto":"A remuneração das férias, incluindo médias de variáveis"},{"id":"c","texto":"O valor líquido a receber"},{"id":"d","texto":"O FGTS acumulado"}]','b','Um terço sobre a remuneração de férias, que já contempla médias de horas extras, adicionais e comissões do período aquisitivo. Calcular só sobre o salário base subestima o valor devido.','Pessoal','Férias','Iniciante','Autoral',2026,array['Férias','Terço constitucional']),
('No eSocial, o evento S-1200 refere-se a:','[{"id":"a","texto":"Admissão do trabalhador"},{"id":"b","texto":"Remuneração do trabalhador vinculado ao RGPS"},{"id":"c","texto":"Desligamento"},{"id":"d","texto":"Cadastro do empregador"}]','b','S-1200 é o evento periódico de remuneração. Admissão é S-2200, desligamento é S-2299 e o cadastro do empregador é S-1000.','Pessoal','eSocial','Intermediário','Autoral',2026,array['eSocial','S-1200']),
('A alíquota de FGTS mensal sobre a remuneração do empregado urbano é de:','[{"id":"a","texto":"8%"},{"id":"b","texto":"11%"},{"id":"c","texto":"2%"},{"id":"d","texto":"20%"}]','a','8% depositados mensalmente. Aprendiz recolhe 2%. Na dispensa sem justa causa há ainda a multa rescisória de 40% sobre o saldo.','Pessoal','Folha','Iniciante','Autoral',2026,array['FGTS']),
('Pelo regime de competência, a receita deve ser reconhecida:','[{"id":"a","texto":"No recebimento do dinheiro"},{"id":"b","texto":"Quando o serviço é prestado ou o bem entregue, independentemente do pagamento"},{"id":"c","texto":"Na emissão do boleto"},{"id":"d","texto":"No encerramento do exercício"}]','b','Competência olha o fato gerador econômico, não o caixa. É o que separa a contabilidade do controle financeiro e a razão de existir diferença entre lucro e saldo bancário.','Contábil','Princípios','Iniciante','CFC',2026,array['Competência']),
('A margem de contribuição é obtida por:','[{"id":"a","texto":"Receita menos custos e despesas fixas"},{"id":"b","texto":"Receita menos custos e despesas variáveis"},{"id":"c","texto":"Lucro líquido dividido pela receita"},{"id":"d","texto":"Receita menos impostos"}]','b','Margem de contribuição = receita − custos e despesas variáveis. É quanto sobra de cada venda para cobrir a estrutura fixa e, depois dela, gerar lucro. Base do ponto de equilíbrio.','Gestão','Custos','Intermediário','Autoral',2026,array['Margem','Custos']),
('O ponto de equilíbrio contábil ocorre quando:','[{"id":"a","texto":"A margem de contribuição total iguala os custos e despesas fixas"},{"id":"b","texto":"A receita iguala o custo variável"},{"id":"c","texto":"O caixa fica positivo"},{"id":"d","texto":"O lucro líquido é máximo"}]','a','Ponto de equilíbrio = custos fixos ÷ margem de contribuição unitária. Nele o resultado é zero: nem lucro nem prejuízo.','Gestão','Custos','Intermediário','Autoral',2026,array['Ponto de equilíbrio']),
('Na DRE, o CMV é classificado como:','[{"id":"a","texto":"Despesa operacional"},{"id":"b","texto":"Dedução da receita bruta"},{"id":"c","texto":"Custo, deduzido da receita líquida para obter o lucro bruto"},{"id":"d","texto":"Resultado financeiro"}]','c','Receita bruta − deduções = receita líquida. Receita líquida − CMV = lucro bruto. Confundir custo com despesa distorce a análise de margem.','Contábil','DRE','Iniciante','CFC',2026,array['DRE','CMV']),
('Na precificação de honorários contábeis por valor, o critério predominante deve ser:','[{"id":"a","texto":"O número de lançamentos por mês"},{"id":"b","texto":"A tabela do sindicato"},{"id":"c","texto":"A complexidade e o risco assumido, somados ao resultado entregue"},{"id":"d","texto":"O preço do concorrente mais barato"}]','c','Precificar por volume transforma o escritório em commodity. Complexidade, risco técnico e resultado gerado sustentam honorário maior — e são o que o cliente consultivo efetivamente compra.','Gestão','Honorários','Avançado','Autoral',2026,array['Precificação','Consultivo']),
('Em uma reunião executiva mensal com o cliente, o indicador que mais sustenta decisão de curto prazo é:','[{"id":"a","texto":"Lucro líquido do exercício anterior"},{"id":"b","texto":"Fluxo de caixa projetado e prazo médio de recebimento"},{"id":"c","texto":"Patrimônio líquido"},{"id":"d","texto":"Valor do imobilizado"}]','b','Decisão de curto prazo é decisão de caixa. Projeção de fluxo e ciclo financeiro respondem se dá para comprar, contratar ou parcelar — o balanço responde outra pergunta.','Gestão','Indicadores','Intermediário','Autoral',2026,array['Fluxo de caixa','KPI'])
on conflict do nothing;

-- ============================================================================
--  FEED INICIAL DA COMUNIDADE
-- ============================================================================
insert into public.posts (autor_id, empresa_id, tipo, conteudo, criado_em)
select p.id, e.id, v.tipo::public.tipo_post, v.conteudo, now() - (v.horas || ' hours')::interval
from (values
  ('admin@castelobranco.com.br','Castelo Branco Contabilidade','anuncio',
   'Publicamos hoje a atualização do módulo de Split Payment do curso de Reforma Tributária. Quem já concluiu recebeu o aviso — a aula 6 mudou por causa da regulamentação de dezembro. Vale reassistir antes de aplicar no cliente.',2),
  ('admin@castelobranco.com.br','Castelo Branco Contabilidade','artigo',
   'Lembrete importante: o prazo do PEPC fecha em 31 de dezembro. Se você tem registro nas categorias obrigatórias, precisa dos 40 pontos. Na plataforma dá para acompanhar quanto você já acumulou no painel — e cada certificado emitido conta.',8),
  ('empresa@castelobranco.com.br','TransLog Brasil','vaga',
   'Estamos com vaga aberta para Analista Fiscal Pleno em Feira de Santana, modelo híbrido. Damos preferência a quem concluiu a trilha de Analista Fiscal aqui na Academy — já sabemos o que a pessoa estudou. Candidaturas pelo painel de vagas.',5),
  ('rafael@exemplo.com',null,'texto',
   'Terminei a trilha de Especialista Tributário e queria registrar uma coisa: o módulo de recuperação de créditos mudou a forma como eu monto o dossiê. Saí do "acho que dá" para "aqui está a sustentação documental". Em duas semanas isso já apareceu em duas reuniões com cliente.',12),
  ('diego@exemplo.com',null,'texto',
   'Dica para quem faz fechamento de vários CNPJs: o módulo de Power Query do curso de Excel resolveu meu maior gargalo. Importo os SPEDs de todas as empresas de uma vez e o painel atualiza sozinho. Reduzi de 9 para 3 dias o ciclo de fechamento.',20),
  ('camila@exemplo.com',null,'texto',
   'Alguém aqui já pegou autuação por erro de NCM? Estou revisando a classificação de uma carteira de importação e queria trocar experiência sobre como vocês documentam a justificativa técnica da classificação.',26),
  ('beatriz@exemplo.com',null,'texto',
   'Comecei a trilha de Analista Fiscal esse mês estando no 6º semestre e a diferença na entrevista de estágio foi absurda. Consegui responder o que era Fator R sem gaguejar. Recomendo começar pelo Departamento Fiscal do Zero mesmo.',34),
  ('paula@exemplo.com',null,'texto',
   'Terminei o curso de Comércio Exterior. O módulo de drawback vale o curso inteiro — nunca tinha entendido direito a diferença entre suspensão e isenção na prática. Já apliquei em um cliente importador essa semana.',44)
) as v(email,empresa,tipo,conteudo,horas)
join public.perfis p on p.email = v.email
left join public.empresas e on e.nome = v.empresa
where not exists (select 1 from public.posts x where x.conteudo = v.conteudo);

insert into public.post_curtidas (post_id, perfil_id)
select po.id, pe.id from public.posts po cross join public.perfis pe
where pe.role = 'aluno' and (abs(hashtext(po.id::text || pe.id::text)) % 10) < 6
on conflict do nothing;

insert into public.conexoes (solicitante_id, destinatario_id, status, respondido_em)
select a.id, b.id, 'aceita'::public.status_conexao, now() from (values
  ('aluno@castelobranco.com.br','rafael@exemplo.com'),
  ('aluno@castelobranco.com.br','diego@exemplo.com'),
  ('aluno@castelobranco.com.br','beatriz@exemplo.com'),
  ('rafael@exemplo.com','joao@exemplo.com'),
  ('diego@exemplo.com','paula@exemplo.com')
) as v(de,para)
join public.perfis a on a.email = v.de
join public.perfis b on b.email = v.para
on conflict do nothing;

-- ============================================================================
--  BACKFILL — selos de trilha para quem já tinha os certificados
--  (o trigger só dispara em certificado novo; isto cobre o histórico)
-- ============================================================================
insert into public.certificados_trilha (perfil_id, trilha_id, codigo, carga_horaria, pontos_pepc)
select x.perfil_id, x.trilha_id,
  'CBA-T-' || to_char(now(),'YYYY') || '-' || upper(substr(md5(x.perfil_id::text || x.trilha_id::text),1,6)),
  x.carga, x.pepc
from (
  select c.perfil_id, tc.trilha_id,
    count(*) filter (where tc.obrigatorio) as feitos,
    (select count(*) from public.trilha_cursos t2 where t2.trilha_id = tc.trilha_id and t2.obrigatorio) as obrig,
    (select coalesce(sum(cu.carga_horaria),0) from public.trilha_cursos t3
      join public.cursos cu on cu.id = t3.curso_id where t3.trilha_id = tc.trilha_id) as carga,
    (select coalesce(sum(cu.pontos_pepc),0) from public.trilha_cursos t4
      join public.cursos cu on cu.id = t4.curso_id where t4.trilha_id = tc.trilha_id) as pepc
  from public.certificados c
  join public.trilha_cursos tc on tc.curso_id = c.curso_id
  group by c.perfil_id, tc.trilha_id
) x
where x.obrig > 0 and x.feitos >= x.obrig
on conflict (perfil_id, trilha_id) do nothing;

-- Preenche o autor nos posts já existentes
update public.posts p set autor_nome = pf.nome, autor_cargo = pf.cargo, autor_nivel = pf.nivel
from public.perfis pf where pf.id = p.autor_id and p.autor_nome is null;
update public.post_comentarios c set autor_nome = pf.nome, autor_cargo = pf.cargo
from public.perfis pf where pf.id = c.perfil_id and c.autor_nome is null;

-- ============================================================================
--  Conferência
-- ============================================================================
select
  (select count(*) from public.cursos)          as cursos,
  (select count(*) from public.trilhas)         as trilhas,
  (select count(*) from public.trilha_cursos)   as trilha_cursos,
  (select count(*) from public.conquistas)      as conquistas,
  (select count(*) from public.missoes)         as missoes,
  (select count(*) from public.questoes_banco)  as questoes,
  (select count(*) from public.posts)           as posts;
-- Esperado: 10 | 5 | 18 | 21 | 7 | 27 | 8
