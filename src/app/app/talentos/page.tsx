"use client";

import { BancoDeTalentos } from "@/components/banco-de-talentos";
import { TravaBancoDeTalentos } from "@/components/trava-talentos";

export default function TalentosPage() {
  return (
    <TravaBancoDeTalentos>
      <BancoDeTalentos base="/app" />
    </TravaBancoDeTalentos>
  );
}
