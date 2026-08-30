import type { Metadata } from "next";
import { ValidadorCertificado } from "@/components/validador-certificado";

/**
 * Link direto do certificado — `/validar/CBA-2026-0000-0000`.
 *
 * É o endereço impresso no rodapé do documento e o que o aluno compartilha.
 * A página abre já consultando: quem recebeu o link não precisa digitar nada.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>;
}): Promise<Metadata> {
  const { codigo } = await params;
  const limpo = decodeURIComponent(codigo).toUpperCase();
  return {
    title: `Certificado ${limpo}`,
    description: `Validação pública do certificado ${limpo}.`,
  };
}

export default async function ValidarCodigoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  return <ValidadorCertificado codigoInicial={decodeURIComponent(codigo)} />;
}
