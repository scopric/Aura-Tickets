import { contraste, ehHex } from './corEvento'

// Estilo do ingresso do produtor (Decisão 206). O modelo padrão da Evokaa é o do PDF atual (azul da marca). Sem texto livre (rodapé): sai pela Evokaa sem moderação.
// "Meu estilo" é do plano PRO; hoje useFeatures libera para todos e a cobrança entra depois.
export const AZUL_EVOKAA = '#4a60e3'
export const TINTA = '#0c2340'
export const FEATURE_ESTILO = 'ingresso_estilo'

export type PosicaoLogo = 'esquerda' | 'centro'
export type EstiloIngresso = { cor: string | null; logo: PosicaoLogo }
export const ESTILO_PADRAO: EstiloIngresso = { cor: null, logo: 'esquerda' }

/** Cor do topo: a escolhida (#rrggbb) ou o azul da Evokaa. */
export const corDoTopo = (e: EstiloIngresso) => (ehHex(e.cor) ? e.cor : AZUL_EVOKAA)

/** Texto branco quando passa de 4,5:1 sobre a cor; senão a tinta escura da marca. */
export const textoSobre = (cor: string) => (contraste(cor, '#ffffff') >= 4.5 ? '#ffffff' : TINTA)

/** Aceita só o que o ingresso sabe desenhar (o banco repete esta conferência). */
export function estiloLimpo(e: Partial<EstiloIngresso> | null | undefined): EstiloIngresso {
  return {
    cor: ehHex(e?.cor) ? e.cor : null,
    logo: e?.logo === 'centro' ? 'centro' : 'esquerda',
  }
}

/** events.ticket_style (jsonb) -> estilo; o que não for reconhecido vira o padrão. */
export const estiloDoBanco = (raw: unknown): EstiloIngresso => estiloLimpo(raw && typeof raw === 'object' ? (raw as Partial<EstiloIngresso>) : null)

/** Estilo -> o que se grava: só as chaves escolhidas ({} = modelo padrão). */
export function estiloParaBanco(e: EstiloIngresso): Record<string, string> {
  const l = estiloLimpo(e)
  return { ...(l.cor ? { cor: l.cor } : {}), ...(l.logo !== 'esquerda' ? { logo: l.logo } : {}) }
}
