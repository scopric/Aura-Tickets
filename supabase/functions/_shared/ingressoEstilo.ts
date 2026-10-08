// Estilo do ingresso do evento (events.ticket_style, docs/sql/20261031b_ingresso_estilo.sql). O banco já trava o formato, mas o servidor
// revalida: o que não for reconhecido vira o modelo padrão da Evokaa. Só cor (#rrggbb) e posição da logo: nada de texto livre
// (revisão e auditoria de segurança de 08/10/2026: texto do produtor sairia pela Evokaa sem moderação). Sem dependência de Deno.
export interface EstiloIngresso {
  cor: string | null; // #rrggbb ou null = azul da Evokaa
  logo: "esquerda" | "centro";
}
export const ESTILO_PADRAO: EstiloIngresso = { cor: null, logo: "esquerda" };

// ponytail: hoje todos os planos estilizam (Decisão 206, "hoje não cobra"). Quando a cobrança entrar, trocar por checagem de
// producer_subscriptions (plano pro) feita AQUI, no servidor: a tela só esconde o botão.
export const ESTILO_LIBERADO = true;

export function estiloValido(raw: unknown): EstiloIngresso {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    cor: typeof o.cor === "string" && /^#[0-9a-fA-F]{6}$/.test(o.cor.trim()) ? o.cor.trim().toLowerCase() : null,
    logo: o.logo === "centro" ? "centro" : "esquerda",
  };
}

/** Estilo do evento do pedido (a linha de `events` já lida pela função). Sem direito ao estilo, o padrão. */
export function estiloDoEvento(ev: { ticket_style?: unknown } | null | undefined): EstiloIngresso {
  return ESTILO_LIBERADO ? estiloValido(ev?.ticket_style) : ESTILO_PADRAO;
}

/** Componentes 0 a 1 de um #rrggbb. */
export function rgbDeHex(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const lum = (h: string) => {
  const [r, g, b] = rgbDeHex(h).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const TINTA = "#0c2340";

/** O de maior contraste entre branco e a tinta escura da marca (#0c2340). Em meio-tom nenhum chega a 4,5:1: vale o melhor dos dois. */
export function textoSobre(cor: string): "claro" | "escuro" {
  const L = lum(cor) + 0.05;
  return 1.05 / L >= L / (lum(TINTA) + 0.05) ? "claro" : "escuro";
}
