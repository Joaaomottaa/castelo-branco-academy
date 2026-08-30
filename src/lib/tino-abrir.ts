/**
 * Abre o chat do Tino de qualquer tela.
 *
 * Com `enviar = true` a pergunta já sai como mensagem — é o que a caixinha do
 * painel usa: a pessoa escreveu, apertou enviar, e ver o texto reaparecer num
 * campo vazio para apertar enviar de novo seria trabalho repetido.
 *
 * O widget escuta este evento em `components/tino.tsx`.
 */
export interface ChamadaTino {
  pergunta?: string;
  enviar?: boolean;
}

export function abrirTino(pergunta?: string, enviar = false) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ChamadaTino>("cba:abrir-tino", { detail: { pergunta, enviar } })
  );
}
