import { contraste, ehHex } from './corEvento'

// Estilo do ingresso do produtor (Decisão 206). O modelo padrão da Evokaa é o do PDF atual (azul da marca). Sem texto livre (rodapé): sai pela Evokaa sem moderação.
// "Meu estilo" é do plano PRO; hoje useFeatures libera para todos e a cobrança entra depois.
export const AZUL_EVOKAA = '#1d68c4' // azul da marca; o PDF do servidor usa o mesmo
export const TINTA = '#0c2340'
export const FEATURE_ESTILO = 'ingresso_estilo'

export type PosicaoLogo = 'esquerda' | 'centro'
export type EstiloIngresso = { cor: string | null; logo: PosicaoLogo }
export const ESTILO_PADRAO: EstiloIngresso = { cor: null, logo: 'esquerda' }

/** Cor do topo: a escolhida (#rrggbb) ou o azul da Evokaa. */
export const corDoTopo = (e: EstiloIngresso) => (ehHex(e.cor) ? e.cor : AZUL_EVOKAA)

/** O de maior contraste entre branco e a tinta escura da marca (igual ao servidor). */
export const textoSobre = (cor: string) => (contraste(cor, '#ffffff') >= contraste(cor, TINTA) ? '#ffffff' : TINTA)

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
