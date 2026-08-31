import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { DadosProvider } from "@/lib/dados";
import { Tino } from "@/components/tino";

export const metadata: Metadata = {
  title: {
    default: "Castelo Branco Academy | Educação contábil de alta performance",
    template: "%s · Castelo Branco Academy",
  },
  description:
    "Plataforma de cursos, certificação e banco de talentos para o mercado contábil. Formação prática em tributário, logística e comércio exterior.",
};

// Garante a largura real do aparelho. Sem esta declaração explícita alguns
// navegadores móveis preservam uma viewport de desktop quando o zoom muda.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SessionProvider>
          <DadosProvider>
            {children}
            {/* O Tino vive aqui, não dentro do AppShell. Antes ele só existia
                depois do login — justamente quem tem mais dúvida (quem ainda
                não criou conta) nunca o encontrava. Ele lida com sessão
                ausente sozinho: sem nome, a saudação é genérica. */}
            <Tino />
          </DadosProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
