import Link from "next/link";
import {
  ArrowRight, Award, BadgeCheck, BarChart3, Bot, Briefcase, Building2,
  CheckCircle2, Clock, Flame, GraduationCap, MoveHorizontal, PlayCircle,
  Search, ShieldCheck, Sparkles, Star, Target, Trophy, Users,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import {
  Badge, Button, Card, SectionTitle, cn, fileiraCls, fileiraItemCls,
} from "@/components/ui";
import { carregarPublico } from "@/lib/repo";
import { depoimentos } from "@/lib/depoimentos";
import type { Curso, Perfil } from "@/lib/types";

export const revalidate = 300;

export default async function Home() {
  const { cursos, vagas, talentos } = await carregarPublico();
  const destaques = cursos.filter((c) => c.destaque).slice(0, 3);
  const totalHoras = cursos.reduce((a, c) => a + c.cargaHoraria, 0);

  // A nota exibida junto aos depoimentos sai do catálogo real, não do arquivo
  // de vitrine: os textos são de composição, mas o número agregado não precisa
  // ser — e inventar média é o tipo de mentira que dá para evitar de graça.
  const comNota = cursos.filter((c) => c.nota > 0);
  const media = comNota.length
    ? comNota.reduce((a, c) => a + c.nota, 0) / comNota.length
    : 0;
  const totalAlunos = cursos.reduce((a, c) => a + c.alunos, 0);

  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Numeros trilhas={cursos.length} horas={totalHoras} />
        <Cursos destaques={destaques} />
        <Trilhas />
        <Gamificacao />
        <Talentos talentos={talentos} totalVagas={vagas.length} />
        <ParaEmpresas />
        <IA />
        <Depoimentos media={media} alunos={totalAlunos} />
        <Planos />
        <CTAFinal />
      </main>
      <SiteFooter />
    </>
  );
}

/* --------------------------------- Hero ---------------------------------- */
function Hero() {
  return (
    <section className="brand-gradient relative overflow-hidden">
      <div className="grid-lines absolute inset-0" />
      <div
        className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #C89F50 0%, transparent 70%)" }}
      />
      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-28">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/35 bg-gold-400/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-gold-300">
            <Sparkles size={13} /> Castelo Branco Academy
          </span>

          <h1 className="mt-6 text-balance text-3xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
            A escola do contador que{" "}
            <span className="gold-text">decide</span>, não só apura.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-navy-100/80">
            Formação prática em tributário, logística e comércio exterior — com
            certificação válida para educação continuada, trilhas de carreira e um
            banco de talentos que conecta você direto às empresas do setor.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button href="/cadastro" variant="gold" size="lg" className="w-full sm:w-auto">
              Criar minha conta grátis <ArrowRight size={16} />
            </Button>
            <Button
              href="/login"
              variant="outline"
              size="lg"
              className="w-full !border-white/25 !bg-white/5 !text-white hover:!border-gold-400 hover:!text-gold-300 sm:w-auto"
            >
              <PlayCircle size={16} /> Ver a plataforma
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-[13px] text-navy-100/70">
            {[
              [ShieldCheck, "Certificado com código de validação"],
              [Award, "Pontos para educação continuada"],
              [Briefcase, "Selo de qualidade no banco de talentos"],
            ].map(([Icon, txt]) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <span key={txt as string} className="inline-flex items-center gap-2">
                  <I size={15} className="text-gold-400" /> {txt as string}
                </span>
              );
            })}
          </div>
        </div>

        <HeroCard />
      </div>
    </section>
  );
}

function HeroCard() {
  return (
    <div className="animate-fade-up space-y-4 [animation-delay:120ms]">
      <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <p className="eyebrow text-gold-300">Continuar assistindo</p>
          <Badge tone="gold">62%</Badge>
        </div>
        <p className="mt-3 text-lg font-semibold text-white">Reforma Tributária na Prática</p>
        <p className="mt-1 text-sm text-navy-100/60">
          Módulo 2 · Split payment: o crédito condicionado ao pagamento
        </p>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/12">
          <div className="gold-gradient h-full w-[62%] rounded-full" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-navy-100/55">
          <span className="inline-flex items-center gap-1.5"><Clock size={13} /> 19 min restantes</span>
          <span className="inline-flex items-center gap-1.5"><Flame size={13} className="text-gold-400" /> 12 dias de ofensiva</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MiniCard icon={<Trophy size={17} />} valor="4.820" rotulo="pontos XP" />
        <MiniCard icon={<BadgeCheck size={17} />} valor="2" rotulo="certificados" />
        <MiniCard icon={<Target size={17} />} valor="40 pts" rotulo="meta PEPC 2026" />
        <MiniCard icon={<Briefcase size={17} />} valor="3" rotulo="vagas compatíveis" />
      </div>
    </div>
  );
}

function MiniCard({ icon, valor, rotulo }: { icon: React.ReactNode; valor: string; rotulo: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-4">
      <span className="text-gold-400">{icon}</span>
      <p className="mt-2 text-lg font-bold text-white sm:text-xl">{valor}</p>
      <p className="text-[11px] uppercase tracking-wider text-navy-100/50">{rotulo}</p>
    </div>
  );
}

/* -------------------------------- Números -------------------------------- */
function Numeros({ trilhas, horas }: { trilhas: number; horas: number }) {
  const itens = [
    ["+20", "anos de experiência contábil"],
    [String(trilhas), "cursos publicados"],
    [`${horas}h`, "de conteúdo no catálogo"],
    ["40 pts", "meta anual de educação continuada"],
  ];
  return (
    <section className="border-b border-navy-100 bg-cream">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-10 sm:gap-8 lg:grid-cols-4 lg:px-8">
        {itens.map(([n, l]) => (
          <div key={l} className="text-center sm:text-left">
            <p className="text-2xl font-bold text-navy-700 sm:text-3xl">{n}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted">{l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- Cursos --------------------------------- */
function Cursos({ destaques }: { destaques: Curso[] }) {
  return (
    <section id="cursos" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-20 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionTitle
          eyebrow="Catálogo"
          title="Conteúdo que resolve o problema de segunda-feira."
          description="Cada curso nasce de um caso real atendido pela Castelo Branco. Nada de teoria solta: você sai com planilha, checklist e método aplicável no cliente."
        />
        <Button href="/app/cursos" variant="outline" className="w-full sm:w-auto">
          Ver catálogo completo <ArrowRight size={15} />
        </Button>
      </div>

      {/* Empilhados, os três destaques ficavam a uma tela de distância um do
          outro — e quem escolhe curso compara. Deitados na fileira o vizinho
          aparece de lado; do `md` para cima volta a ser a mesma grade. */}
      <div className="mt-12">
        <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted sm:hidden">
          <MoveHorizontal size={13} className="text-gold-500" />
          Arraste para o lado para ver os outros destaques
        </p>
        <div className={cn(fileiraCls, "sm:gap-6 md:grid-cols-2 lg:grid-cols-3")}>
        {destaques.map((c) => (
          <Link key={c.slug} href={`/app/cursos/${c.slug}`} className={fileiraItemCls}>
            <Card hover className="flex h-full flex-col">
              <div
                className="mb-5 flex h-32 items-end justify-between gap-2 rounded-xl p-4"
                style={{ background: `linear-gradient(135deg, ${c.cor} 0%, #001838 100%)` }}
              >
                <GraduationCap size={26} className="shrink-0 text-gold-300" />
                <div className="flex flex-wrap justify-end gap-1.5">
                  {c.novo && <Badge tone="gold">Novo</Badge>}
                  <Badge tone="navy" className="!bg-white/10 !text-white !border-white/20">
                    {c.nivel}
                  </Badge>
                </div>
              </div>

              <p className="text-[11px] font-bold uppercase tracking-wider text-gold-500">
                {c.categoria}
              </p>
              <h3 className="mt-1.5 text-lg font-bold leading-snug text-navy-700">{c.titulo}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{c.subtitulo}</p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-navy-100 pt-4 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={13} /> {c.cargaHoraria}h · {c.pontosPEPC} pts
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-navy-700">
                  <Star size={13} className="fill-gold-400 text-gold-400" /> {c.nota.toFixed(1)}
                </span>
              </div>
            </Card>
          </Link>
        ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- Trilhas -------------------------------- */
function Trilhas() {
  const trilhas = [
    {
      nome: "Analista Fiscal",
      de: "Do zero ao primeiro emprego",
      cursos: ["Departamento Fiscal do Zero", "Contabilidade para Transporte", "Comex"],
      horas: 60,
      cor: "#00204D",
    },
    {
      nome: "Especialista Tributário",
      de: "Para quem quer conduzir projetos",
      cursos: ["Reforma Tributária", "Recuperação de Créditos", "Consultiva"],
      horas: 54,
      cor: "#B88A45",
    },
    {
      nome: "Contador Consultivo",
      de: "Da rotina à mesa de decisão",
      cursos: ["Consultiva", "Reforma Tributária", "Precificação"],
      horas: 46,
      cor: "#2F6E75",
    },
  ];

  return (
    <section id="trilhas" className="scroll-mt-20 bg-cream py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionTitle
          eyebrow="Trilhas de carreira"
          title="Não é uma lista de cursos. É um caminho."
          description="Escolha o cargo que você quer ocupar e a plataforma monta a sequência, o ritmo e as avaliações — com selo próprio no fim da trilha."
        />
        <div className="mt-12">
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted sm:hidden">
            <MoveHorizontal size={13} className="text-gold-500" />
            Arraste para o lado para comparar as trilhas
          </p>
          <div className={cn(fileiraCls, "sm:gap-6 lg:grid-cols-3")}>
          {trilhas.map((t, i) => (
            <Card key={t.nome} hover className={cn(fileiraItemCls, "relative overflow-hidden")}>
              <span
                className="absolute right-4 top-4 text-5xl font-bold opacity-10"
                style={{ color: t.cor }}
              >
                0{i + 1}
              </span>
              <div
                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: `${t.cor}12`, color: t.cor }}
              >
                <Target size={20} />
              </div>
              <h3 className="text-lg font-bold text-navy-700">{t.nome}</h3>
              <p className="mt-1 text-sm text-muted">{t.de}</p>
              <ul className="mt-5 space-y-2.5">
                {t.cursos.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-sm text-ink">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-gold-400" />
                    {c}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-navy-100 pt-4 text-xs font-semibold uppercase tracking-wider text-muted">
                {t.horas}h · selo de trilha
              </p>
            </Card>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- Gamificação -------------------------------- */
function Gamificacao() {
  const itens = [
    [Flame, "Ofensiva diária", "Estudou hoje? A sequência cresce. Quebrou? Volta a zero — e isso muda comportamento."],
    [Trophy, "Ranking do escritório", "Times competem por XP. Gestor vê quem evoluiu no mês sem precisar cobrar."],
    [BadgeCheck, "Conquistas verificáveis", "Cada badge tem lastro: nota mínima, projeto entregue ou avaliação prática."],
    [BarChart3, "Meta PEPC no painel", "A barra de pontos de educação continuada fica visível o ano inteiro."],
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
      <SectionTitle
        eyebrow="Engajamento"
        title="Curso comprado não é curso concluído."
        description="O gargalo do EAD brasileiro não é conteúdo, é conclusão. A Academy foi desenhada em torno da métrica que importa: quantos terminam."
        center
      />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {itens.map(([Icon, titulo, desc]) => {
          const I = Icon as typeof Flame;
          return (
            <Card key={titulo as string} hover className="h-full">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold-50 text-gold-500">
                <I size={20} />
              </div>
              <h3 className="text-base font-bold text-navy-700">{titulo as string}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{desc as string}</p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------- Talentos --------------------------------- */
function Talentos({ talentos, totalVagas }: { talentos: Perfil[]; totalVagas: number }) {
  return (
    <section id="talentos" className="brand-gradient relative scroll-mt-20 overflow-hidden py-20">
      <div className="grid-lines absolute inset-0" />
      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <SectionTitle
            light
            eyebrow="Banco de Talentos"
            title="Concluir um curso aqui vale como carta de recomendação."
            description="O diferencial da plataforma: quem termina uma trilha entra no banco de talentos com histórico verificado — nota, projeto entregue, certificação e habilidades comprovadas. Empresas do setor buscam direto por isso."
          />
          <div className="mt-8 space-y-4">
            {[
              ["Para o aluno", "Perfil público, currículo em PDF gerado automaticamente e candidatura em um clique."],
              ["Para a empresa", "Busca por certificação, cidade, senioridade e habilidade — com prova de que a pessoa realmente estudou."],
              ["Para a Castelo Branco", "Um ativo que nenhum concorrente copia: o histórico de aprendizado do mercado contábil."],
            ].map(([t, d]) => (
              <div key={t} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-gold-400" />
                <div>
                  <p className="text-sm font-semibold text-white">{t}</p>
                  <p className="mt-1 text-sm text-navy-100/65">{d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Button href="/app/talentos" variant="gold">
              Explorar o banco de talentos <ArrowRight size={15} />
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/12 bg-navy-800/60 px-4 py-2.5">
            <Search size={15} className="text-gold-400" />
            <span className="text-sm text-navy-100/60">
              analista fiscal · certificado em CT-e · Bahia
            </span>
          </div>
          <div className="space-y-3">
            {talentos.slice(0, 3).map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5"
              >
                <span className="gold-gradient inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-navy-800">
                  {t.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  {/* O selo de senioridade à direita deixa pouco mais de 130px
                      para o nome no celular: cortado, o perfil deixa de ser
                      identificável — que é o único papel dele aqui. */}
                  <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">
                    {t.nome}
                  </p>
                  <p className="line-clamp-2 text-xs leading-snug text-navy-100/55">
                    {t.cargo} · {t.cidade}/{t.uf}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-gold-400/35 bg-gold-400/10 px-2.5 py-1 text-[10px] font-bold text-gold-300">
                  {t.senioridade}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-navy-100/45">
            {talentos.length} perfis · {totalVagas} vagas abertas
          </p>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- Para empresas ------------------------------ */
function ParaEmpresas() {
  return (
    <section id="empresas" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-20 lg:px-8">
      <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
        <div className="order-2 grid gap-4 sm:grid-cols-2 lg:order-1">
          {[
            [Users, "Universidade corporativa", "Onboarding padronizado do time fiscal, com trilha obrigatória e relatório de conclusão."],
            [BarChart3, "Relatórios de evolução", "Quem assistiu, quem parou, quem foi bem na avaliação — por colaborador e por time."],
            [Building2, "Publicação de vagas", "Anuncie e receba candidatos já qualificados pela própria plataforma."],
            [ShieldCheck, "Contratos e LGPD", "Consentimento explícito, exportação e exclusão de dados do titular no próprio painel."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Users;
            return (
              <Card key={t as string} hover>
                <I size={19} className="text-gold-500" />
                <p className="mt-3 text-sm font-bold text-navy-700">{t as string}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{d as string}</p>
              </Card>
            );
          })}
        </div>
        <div className="order-1 lg:order-2">
          <SectionTitle
            eyebrow="Para empresas"
            title="Treine seu time e contrate no mesmo lugar."
            description="Escritórios contábeis, transportadoras e traders usam a Academy como universidade corporativa — e como funil de contratação. O mesmo login resolve os dois."
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/cadastro?perfil=empresa" variant="primary" className="w-full sm:w-auto">
              Criar conta empresarial <ArrowRight size={15} />
            </Button>
            <Button href="/app/vagas" variant="outline" className="w-full sm:w-auto">
              Ver vagas publicadas
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- IA ------------------------------------ */
function IA() {
  const itens = [
    ["Assistente contábil com RAG", "Pergunta livre respondida sobre a base de aulas, legislação e materiais — sempre com a fonte citada."],
    ["Resumo automático da aula", "Transcrição, resumo em tópicos e flashcards gerados no upload do vídeo."],
    ["Matching vaga ↔ candidato", "Score explicável: por que este perfil apareceu para esta vaga."],
    ["Análise de currículo", "Aponta lacunas e recomenda exatamente qual curso preenche cada uma."],
  ];
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionTitle
          eyebrow="Inteligência artificial"
          title="IA onde ela realmente encurta o caminho."
          description="Sem enfeite. Quatro aplicações que reduzem custo de produção de conteúdo, aumentam conclusão e tornam o banco de talentos mais preciso."
          center
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {itens.map(([t, d]) => (
            <Card key={t} hover className="flex gap-4">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-700 text-gold-300">
                <Bot size={18} />
              </div>
              <div>
                <p className="text-base font-bold text-navy-700">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{d}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Depoimentos -------------------------------
   Prova social vem logo antes do preço: é a última pergunta que a pessoa faz
   antes de olhar quanto custa.

   Os textos são de vitrine (ver src/lib/depoimentos.ts). A média e a contagem
   ao lado, não — vêm do catálogo.
   -------------------------------------------------------------------------- */
function Depoimentos({ media, alunos }: { media: number; alunos: number }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow mb-3 text-gold-500">Depoimentos</p>
        <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight text-navy-700 sm:text-4xl">
          Quem estudou aqui voltou para o escritório{" "}
          <span className="text-gold-500">sabendo fazer</span>
        </h2>
        <p className="mx-auto mt-4 text-[15px] leading-relaxed text-muted">
          Não é curso para colecionar certificado. É o método que a Castelo Branco usa
          nos próprios clientes de transporte, logística e comércio exterior — virado
          em aula.
        </p>
      </div>

      {/* Selo agregado */}
      {media > 0 && (
        <div className="mt-8 flex justify-center">
          {/* Em tela de celular o conteúdo do selo ocupa três linhas, e a
              pílula redonda vira uma bolha — por isso o canto só fica
              totalmente arredondado quando ele volta a ser uma linha única. */}
          <div className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-3 rounded-2xl border border-navy-100 bg-white px-5 py-3 shadow-sm sm:rounded-full sm:px-6">
            <span className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-navy-700">
                {media.toFixed(1).replace(".", ",")}
              </span>
              <Estrelas nota={Math.round(media)} />
            </span>
            <span className="hidden h-6 w-px bg-navy-100 sm:block" />
            <span className="flex items-center">
              <span className="flex -space-x-2.5">
                {depoimentos.slice(0, 4).map((d) => (
                  <img
                    key={d.nome}
                    src={d.foto}
                    alt=""
                    aria-hidden="true"
                    className="h-8 w-8 rounded-full border-2 border-white object-cover"
                  />
                ))}
              </span>
              <span className="ml-3 text-sm text-muted">
                média dos {alunos.toLocaleString("pt-BR")} alunos do catálogo
              </span>
            </span>
          </div>
        </div>
      )}

      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {depoimentos.map((d) => (
          <Card key={d.nome} hover className="flex flex-col">
            <div className="flex items-center gap-3">
              <img
                src={d.foto}
                alt={`Foto de ${d.nome}`}
                className="h-11 w-11 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-bold leading-tight text-navy-700">
                  {d.nome}
                </p>
                <p className="line-clamp-2 text-xs leading-snug text-muted">
                  {d.cargo} · {d.cidade}
                </p>
              </div>
            </div>

            <Estrelas nota={d.nota} className="mt-3.5" />

            <p className="mt-3 flex-1 text-sm leading-relaxed text-ink">“{d.texto}”</p>

            <p className="mt-4 flex items-center gap-1.5 border-t border-navy-100 pt-3 text-[11px] font-semibold text-gold-600">
              <BadgeCheck size={13} /> Concluiu {d.formacao}
            </p>
          </Card>
        ))}

        {/* O último cartão é o convite, não um depoimento: a grade fecha com
            ação em vez de ficar com um buraco em telas de três colunas. */}
        <Card className="flex flex-col items-start justify-center !bg-navy-700">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-gold-300">
            <GraduationCap size={20} />
          </span>
          <p className="mt-4 text-lg font-bold leading-snug text-white">
            O próximo depoimento pode ser o seu
          </p>
          <p className="mt-2 text-sm leading-relaxed text-navy-100/75">
            Comece pelas aulas gratuitas de todos os cursos. Sem cartão, sem
            compromisso.
          </p>
          <div className="mt-5">
            <Button href="/cadastro" variant="gold">
              Criar conta gratuita <ArrowRight size={15} />
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}

function Estrelas({ nota, className = "" }: { nota: number; className?: string }) {
  return (
    <span className={`flex gap-0.5 ${className}`} aria-label={`${nota} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={i <= nota ? "fill-gold-400 text-gold-400" : "text-navy-200"}
        />
      ))}
    </span>
  );
}

/* --------------------------------- Planos --------------------------------- */
function Planos() {
  const planos = [
    {
      nome: "Free",
      preco: "R$ 0",
      periodo: "para sempre",
      desc: "Conheça o método com aulas abertas.",
      itens: ["Aulas gratuitas de cada curso", "Perfil no banco de talentos", "Candidatura a vagas", "Newsletter fiscal"],
      cta: "Criar conta",
      destaque: false,
    },
    {
      nome: "Pro",
      preco: "R$ 89",
      periodo: "/mês",
      desc: "Acesso total ao catálogo e às trilhas.",
      itens: ["Todos os cursos e trilhas", "Certificados com validação", "Pontos de educação continuada", "Mentorias ao vivo mensais", "Assistente de IA", "Selo verificado no perfil"],
      cta: "Assinar Pro",
      destaque: true,
    },
    {
      nome: "Empresarial",
      preco: "Sob consulta",
      periodo: "",
      desc: "Universidade corporativa + contratação.",
      itens: ["Licenças por colaborador", "Trilhas obrigatórias e relatórios", "Publicação ilimitada de vagas", "Busca avançada no banco de talentos", "Conteúdo exclusivo da empresa", "Gestor de conta dedicado"],
      cta: "Falar com vendas",
      destaque: false,
    },
  ];

  return (
    <section id="planos" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-20 lg:px-8">
      <SectionTitle
        eyebrow="Planos"
        title="Assinatura para a pessoa. Licença para a empresa."
        description="O modelo recorrente sustenta a plataforma; a venda avulsa de cursos e a licença corporativa aceleram o caixa."
        center
      />
      {/* Mesma fileira de /app/planos: preço só se compara vendo dois planos
          ao mesmo tempo. O `pt-4` é o espaço do selo "Mais popular", que fica
          meio passo acima da borda e a rolagem lateral cortaria. */}
      <div className="mt-12">
        <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted sm:hidden">
          <MoveHorizontal size={13} className="text-gold-500" />
          Arraste para o lado para comparar os planos
        </p>
        <div className={cn(fileiraCls, "pt-4 sm:gap-6 sm:pt-0 lg:grid-cols-3")}>
        {planos.map((p) => (
          <div
            key={p.nome}
            className={cn(
              fileiraItemCls,
              "rounded-2xl p-5 sm:p-7",
              p.destaque
                ? "relative border-2 border-gold-400 bg-navy-700 shadow-2xl shadow-navy-700/25"
                : "border border-navy-100 bg-white"
            )}
          >
            {p.destaque && (
              <span className="gold-gradient absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-navy-800">
                Mais popular
              </span>
            )}
            <p className={p.destaque ? "text-sm font-bold text-gold-300" : "text-sm font-bold text-gold-500"}>
              {p.nome}
            </p>
            <p className="mt-3 flex flex-wrap items-end gap-1.5">
              <span className={cn("text-3xl font-bold sm:text-4xl", p.destaque ? "text-white" : "text-navy-700")}>
                {p.preco}
              </span>
              <span className={p.destaque ? "pb-1 text-sm text-navy-100/60" : "pb-1 text-sm text-muted"}>
                {p.periodo}
              </span>
            </p>
            <p className={p.destaque ? "mt-2 text-sm text-navy-100/70" : "mt-2 text-sm text-muted"}>
              {p.desc}
            </p>
            <ul className="mt-6 space-y-3">
              {p.itens.map((i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2
                    size={16}
                    className={p.destaque ? "mt-0.5 shrink-0 text-gold-400" : "mt-0.5 shrink-0 text-gold-500"}
                  />
                  <span className={p.destaque ? "text-navy-100/85" : "text-ink"}>{i}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <Button href="/cadastro" variant={p.destaque ? "gold" : "outline"} full>
                {p.cta}
              </Button>
            </div>
          </div>
        ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- CTA final ------------------------------- */
function CTAFinal() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
      <div className="brand-gradient relative overflow-hidden rounded-3xl px-5 py-12 text-center sm:px-8 sm:py-16 lg:px-16">
        <div className="grid-lines absolute inset-0" />
        <div className="relative">
          <p className="eyebrow text-gold-300">Comece hoje</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-balance text-3xl font-bold leading-tight text-white sm:text-4xl">
            Sua próxima promoção começa com uma aula de 14 minutos.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-navy-100/70">
            Crie a conta gratuita, assista às aulas abertas e veja quantas vagas do banco
            de talentos já combinam com o seu perfil.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/cadastro" variant="gold" size="lg" className="w-full sm:w-auto">
              Criar conta grátis <ArrowRight size={16} />
            </Button>
            <Button
              href="/login"
              variant="outline"
              size="lg"
              className="w-full !border-white/25 !bg-white/5 !text-white hover:!border-gold-400 hover:!text-gold-300 sm:w-auto"
            >
              Já tenho conta
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
