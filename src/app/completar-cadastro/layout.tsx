import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terminar cadastro · Castelo Branco Academy",
  // A tela é pessoal e fica atrás do login — não tem por que ser indexada.
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
