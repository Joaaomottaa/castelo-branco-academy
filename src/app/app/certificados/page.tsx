"use client";

import { useEffect, useState } from "react";
import {
  Award, Check, CheckCircle2, Copy, Download, ExternalLink, Linkedin,
  Route, ShieldCheck, X,
} from "lucide-react";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { Diploma, type DadosDiploma } from "@/components/certificado";
import { useDados } from "@/lib/dados";
import { useSession } from "@/lib/session";

export default function CertificadosPage() {
  const { user } = useSession();
  const {
    meusCertificados: certificados, minhasTrilhas, trilhas, recarregar,
  } = useDados();
  const [aberto, setAberto] = useState<{ dados: DadosDiploma; tipo: "curso" | "trilha" } | null>(null);

  // O certificado nasce por trigger no banco, no instante em que a última aula
  // fecha. Sem esta recarga, quem chega aqui logo depois vê a lista que estava
  // em memória desde o login — sem o certificado que acabou de ganhar.
  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nome = user?.nome ?? "Aluno";

  const deCurso: DadosDiploma[] = certificados.map((c) => ({
    aluno: nome,
    titulo: c.cursoTitulo,
    cargaHoraria: c.cargaHoraria,
    pontosPEPC: c.pontosPEPC,
    emitidoEm: c.emitidoEm,
    codigo: c.codigo,
  }));

  // Junta o certificado da trilha com o que ela cobre: o certificado guarda o
  // código, o catálogo guarda as habilidades e o nível de saída.
  const deTrilha: DadosDiploma[] = minhasTrilhas.map((c) => {
    const t = trilhas.find((x) => x.slug === c.trilhaSlug);
    return {
      aluno: nome,
      titulo: c.trilhaNome,
      cargaHoraria: c.cargaHoraria,
      pontosPEPC: c.pontosPEPC,
      emitidoEm: c.emitidoEm,
      codigo: c.codigo,
      nivel: t?.nivelSaida,
      habilidades: (t?.habilidades ?? []).map((h) => h.nome),
    };
  });

  const pontos = certificados.reduce((a, c) => a + c.pontosPEPC, 0);
  const horas = certificados.reduce((a, c) => a + c.cargaHoraria, 0);

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy-700">Meus certificados</h1>
        <p className="mt-1.5 text-sm text-muted">
          Cada certificado tem código público de validação e pontuação para educação
          profissional continuada.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold-50 text-gold-500">
            <Award size={19} />
          </span>
          <div>
            <p className="text-xl font-bold text-navy-700">{certificados.length}</p>
            <p className="text-xs text-muted">Certificados emitidos</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-navy-600">
            <CheckCircle2 size={19} />
          </span>
          <div>
            <p className="text-xl font-bold text-navy-700">{horas}h</p>
            <p className="text-xs text-muted">Carga horária certificada</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck size={19} />
          </span>
          <div>
            <p className="text-xl font-bold text-navy-700">{pontos}/40</p>
            <p className="text-xs text-muted">Pontos PEPC 2026</p>
          </div>
        </Card>
      </div>

      {deTrilha.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-navy-700">
            <Route size={15} className="text-gold-500" /> Certificações de trilha
          </h2>
          <p className="mt-1 text-xs text-muted">
            O selo dourado sai da trilha inteira concluída — é o que as empresas
            procuram no banco de talentos.
          </p>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {deTrilha.map((d) => (
              <Card key={d.codigo} hover className="!p-0 overflow-hidden">
                <Diploma dados={d} tipo="trilha" />
                <Acoes
                  dados={d}
                  tipo="trilha"
                  aoAbrir={() => setAberto({ dados: d, tipo: "trilha" })}
                />
              </Card>
            ))}
          </div>
        </div>
      )}

      {certificados.length === 0 ? (
        <EmptyState
          icon={<Award size={34} />}
          title="Você ainda não emitiu certificados"
          description="Conclua 100% das aulas de um curso e a avaliação final para liberar a emissão."
          action={<Button href="/app/cursos" variant="gold">Ver cursos</Button>}
        />
      ) : (
        <div>
          {deTrilha.length > 0 && (
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-navy-700">
              <Award size={15} className="text-gold-500" /> Certificados de curso
            </h2>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            {deCurso.map((d) => (
              <Card key={d.codigo} hover className="!p-0 overflow-hidden">
                <div className="relative">
                  <Diploma dados={d} tipo="curso" />
                  <div className="absolute right-4 top-4">
                    <Badge tone="gold">Válido</Badge>
                  </div>
                </div>
                <Acoes
                  dados={d}
                  tipo="curso"
                  aoAbrir={() => setAberto({ dados: d, tipo: "curso" })}
                />
              </Card>
            ))}
          </div>
        </div>
      )}

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy-900/70 p-4 backdrop-blur-sm"
          onClick={() => setAberto(null)}
        >
          <div className="w-full max-w-3xl py-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-end">
              <button
                onClick={() => setAberto(null)}
                aria-label="Fechar"
                className="text-white/70 transition hover:text-white"
              >
                <X size={22} />
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl bg-white">
              <Diploma dados={aberto.dados} tipo={aberto.tipo} grande />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Acoes({
  dados, tipo, aoAbrir,
}: {
  dados: DadosDiploma;
  tipo: "curso" | "trilha";
  aoAbrir: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-navy-100 p-4">
      <Button variant="primary" size="sm" onClick={aoAbrir}>
        <Award size={14} /> Visualizar
      </Button>
      <Button variant="outline" size="sm">
        <Download size={14} /> PDF
      </Button>
      <BotaoLinkedInCertificado dados={dados} tipo={tipo} />
      <CopiarLink codigo={dados.codigo} />
      <Button href={`/validar/${dados.codigo}`} variant="ghost" size="sm" target="_blank">
        <ExternalLink size={14} /> Validar
      </Button>
    </div>
  );
}

/**
 * "Adicionar ao perfil" do LinkedIn.
 *
 * O botão não compartilha um post: abre o formulário de **licença e
 * certificado** do perfil, já preenchido. É a diferença entre um post que some
 * do feed em dois dias e uma linha permanente no currículo de quem estudou —
 * com o link de validação junto, que é o que dá valor ao nosso certificado.
 *
 * O contrato dos parâmetros é do LinkedIn (`startTask=CERTIFICATION_NAME`) e
 * exige mês e ano separados. `certUrl` precisa ser absoluto e público: por
 * isso sai de `window.location.origin`, e não de um domínio fixo no código —
 * em localhost o botão abre igual, só com um link que só o dono alcança.
 */
function BotaoLinkedInCertificado({
  dados, tipo,
}: {
  dados: DadosDiploma;
  tipo: "curso" | "trilha";
}) {
  function abrir() {
    const emitido = new Date(dados.emitidoEm);
    const p = new URLSearchParams({
      startTask: "CERTIFICATION_NAME",
      name: `${tipo === "trilha" ? "Trilha" : "Curso"}: ${dados.titulo}`,
      organizationName: "Castelo Branco Academy",
      issueYear: String(emitido.getFullYear()),
      issueMonth: String(emitido.getMonth() + 1),
      certUrl: `${window.location.origin}/validar/${dados.codigo}`,
      certId: dados.codigo,
    });
    window.open(
      `https://www.linkedin.com/profile/add?${p.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={abrir}
      title="Adicionar este certificado ao seu perfil do LinkedIn"
    >
      <Linkedin size={14} /> Adicionar ao LinkedIn
    </Button>
  );
}

/**
 * Copia o endereço público de validação.
 *
 * O link é montado com `window.location.origin` de propósito: em produção ele
 * sai com o domínio real, e em `localhost` sai válido para quem está testando.
 * Um domínio fixo no código sairia errado em um dos dois casos.
 */
function CopiarLink({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const url = `${window.location.origin}/validar/${codigo}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Sem permissão de área de transferência (http, navegador antigo): ainda
      // assim mostra o link, para a pessoa copiar à mão.
      window.prompt("Copie o link de validação:", url);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
  }

  return (
    <Button variant="ghost" size="sm" onClick={copiar}>
      {copiado ? <Check size={14} /> : <Copy size={14} />}
      {copiado ? "Link copiado" : "Copiar link"}
    </Button>
  );
}
