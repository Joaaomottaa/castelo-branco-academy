"use client";

import { BancoDeTalentos } from "@/components/banco-de-talentos";

/* ==========================================================================
   BANCO DE TALENTOS — DENTRO DO PAINEL DA EMPRESA

   O menu da empresa apontava para /app/talentos. A pessoa saía do painel, caía
   na casca do aluno (com menu de cursos, questões e conquistas) e não tinha
   caminho de volta visível. A tela é a mesma; o que muda é a área que a
   mostra — e aqui a guarda é a do layout de /empresa, que exige gestor.
   ========================================================================== */

export default function TalentosDaEmpresa() {
  return <BancoDeTalentos base="/empresa" />;
}
