import type { Metadata } from "next";
import { TelaDoConvite } from "@/components/tela-convite";

/**
 * Link do convite — `/convite/CB-4K7P-92XD`.
 *
 * É o endereço que o gestor cola no WhatsApp do time. Abre sem sessão: quem
 * chega aqui muitas vezes ainda não tem conta, e ver de quem é o convite antes
 * de se cadastrar é o que faz a pessoa seguir em frente.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>;
}): Promise<Metadata> {
  const { codigo } = await params;
  return {
    title: `Convite ${decodeURIComponent(codigo).toUpperCase()}`,
    description: "Você foi convidado para a equipe de uma empresa na Castelo Branco Academy.",
  };
}

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  return <TelaDoConvite codigo={decodeURIComponent(codigo)} />;
}
