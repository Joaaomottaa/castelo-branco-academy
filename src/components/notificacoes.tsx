"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Megaphone, Sparkles, TriangleAlert, Trophy } from "lucide-react";
import { cn } from "./ui";
import {
  marcarNotificacoesLidas, minhasNotificacoes, type Notificacao,
} from "@/lib/repo-pessoas";
import { useSession } from "@/lib/session";

/* ==========================================================================
   SINO DE NOTIFICAÇÕES

   Recebe o que o admin dispara em /admin/comunicacao e os avisos do sistema
   (plano ativado, por exemplo). É o único canal que chega de verdade hoje —
   não há SMTP configurado —, então ele precisa funcionar bem.

   Marcar como lida acontece ao abrir o painel, não ao clicar em cada item:
   ninguém abre a caixa e deixa metade por ler de propósito.

   O sino vive só na barra escura do AppShell, e por isso é desenhado em claro
   sobre escuro. O painel que ele abre é uma superfície própria e continua
   claro. Reaproveitar o sino num fundo claro exigiria um variante de cor.
   ========================================================================== */

const ICONES: Record<string, typeof Bell> = {
  info: Megaphone,
  alerta: TriangleAlert,
  promo: Sparkles,
  conquista: Trophy,
};

export function SinoDeNotificacoes() {
  const { user, modoDemo } = useSession();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Notificacao[]>([]);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLista(await minhasNotificacoes());
  }, [user]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const naoLidas = lista.filter((n) => !n.lida);

  async function abrir() {
    setAberto((a) => !a);
    if (!aberto && naoLidas.length > 0) {
      await marcarNotificacoesLidas(naoLidas.map((n) => n.id));
      setLista((l) => l.map((n) => ({ ...n, lida: true })));
    }
  }

  return (
    <div className="relative">
      <button
        onClick={abrir}
        className="relative text-white/75 transition hover:text-gold-300"
        title="Notificações"
        aria-label={`Notificações${naoLidas.length ? `: ${naoLidas.length} não lidas` : ""}`}
      >
        <Bell size={19} />
        {naoLidas.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[9px] font-bold text-navy-800 ring-2 ring-navy-700">
            {naoLidas.length > 9 ? "9+" : naoLidas.length}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
              <p className="text-sm font-bold text-navy-700">Notificações</p>
              {lista.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                  <CheckCheck size={12} /> tudo lido
                </span>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {modoDemo ? (
                <p className="px-4 py-8 text-center text-xs leading-relaxed text-muted">
                  No modo demonstração não há caixa de notificações — ela lê do banco.
                  Troque a chave para Supabase para ver os avisos.
                </p>
              ) : lista.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted">
                  Nada por aqui ainda.
                </p>
              ) : (
                lista.map((n) => {
                  const Icone = ICONES[n.tipo] ?? Megaphone;
                  const conteudo = (
                    <div className="flex items-start gap-2.5 px-4 py-3 transition hover:bg-cream/60">
                      <span
                        className={cn(
                          "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          n.tipo === "alerta" ? "bg-red-50 text-red-600"
                            : n.tipo === "promo" ? "gold-gradient text-navy-800"
                              : n.tipo === "conquista" ? "bg-emerald-50 text-emerald-600"
                                : "bg-navy-50 text-navy-600"
                        )}
                      >
                        <Icone size={13} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-navy-700">{n.titulo}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink">{n.mensagem}</p>
                        <p className="mt-1 text-[10px] text-muted">{quando(n.criadoEm)}</p>
                      </div>
                      {!n.lida && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                      )}
                    </div>
                  );

                  return (
                    <div key={n.id} className="border-b border-navy-100 last:border-0">
                      {n.link ? (
                        <Link href={n.link} onClick={() => setAberto(false)}>
                          {conteudo}
                        </Link>
                      ) : (
                        conteudo
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function quando(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}
