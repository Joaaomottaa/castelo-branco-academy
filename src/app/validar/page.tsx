import type { Metadata } from "next";
import { ValidadorCertificado } from "@/components/validador-certificado";

export const metadata: Metadata = {
  title: "Validar certificado",
  description:
    "Confira a autenticidade de um certificado emitido pela Castelo Branco Academy: "
    + "concluinte, curso ou trilha, carga horária e data de conclusão.",
};

/**
 * A tela de digitar o código.
 *
 * Aceita `?codigo=` para os links antigos, mas o formulário promove o código
 * para `/validar/CODIGO` — endereço que dá para colar num e-mail.
 */
export default async function ValidarPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo } = await searchParams;
  return <ValidadorCertificado codigoInicial={codigo} />;
}
