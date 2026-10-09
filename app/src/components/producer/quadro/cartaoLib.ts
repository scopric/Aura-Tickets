import type { KindVinculo } from '../../../hooks/useCartao'
import type { Pessoa } from './useEquipe'

/** Destino do foco quando o cartão aberto some (arquivado ou excluído) */
export const ID_QUADRO = 'quadro-tarefas'

/** Cor #rrggbb vinda do banco; qualquer outra coisa não vai para o estilo */
export const corSegura = (c: string | null | undefined, padrao = '#8f33f5') => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : padrao)

/** Texto preto ou branco por cima de uma cor, pela luminância relativa (WCAG) */
export function corDoTexto(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#0b0d12' : '#ffffff'
}

/** Cores fixas para etiqueta e capa */
export const PALETA = ['#8f33f5', '#0c2340', '#3f7fd0', '#17784a', '#c08a3e', '#c8322b', '#c4638a', '#58aeb0']

/** Lista fechada de páginas da plataforma que um cartão pode apontar (todas conferidas em App.tsx) */
export const ROTAS_VINCULO: Record<KindVinculo, [string, string]> = {
  ingresso: ['Ingressos', '/producer/ingressos'], cupom: ['Cupons', '/producer/cupons'], participantes: ['Participantes', '/producer/participantes'],
  checkin: ['Check-in', '/producer/checkin'], orcamento: ['Orçamento', '/producer/caixinha'], financeiro: ['Financeiro', '/producer/finance'],
  bordero: ['Borderô', '/producer/bordero'], parceiro: ['Parceiros', '/producer/parceiros'], crm: ['CRM', '/producer/crm'],
  equipe: ['Equipe', '/producer/team'], mapa: ['Lugar marcado', '/producer/lugar-marcado'], divulgacao: ['Divulgação', '/producer/divulgacao'],
  certificados: ['Certificados', '/producer/certificados'], cronograma: ['Cronograma', '/producer/timeline'], evento: ['Visão geral do evento', '/producer/event/:eventId'],
}
/** Destino do atalho; null quando a página pede um evento e o cartão não tem */
export function destinoVinculo(kind: KindVinculo, eventId: string | null) {
  const rota = ROTAS_VINCULO[kind][1]
  if (rota.includes(':eventId')) return eventId ? rota.replace(':eventId', eventId) : null
  return eventId ? `${rota}?eventId=${eventId}` : rota
}

/** O banco recusa comentário com mais menções que isto */
export const LIMITE_MENCOES = 20

const escapa = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Quem foi marcado com @nome (nome completo ou primeiro nome, sem diferenciar maiúscula). Só texto, nada de HTML */
export function mencoesDe(corpo: string, pessoas: Pessoa[]): string[] {
  return pessoas.filter(p => {
    const nomes = [p.nome, p.nome.split(/\s+/)[0]].filter(Boolean).map(escapa)
    return new RegExp(`(^|[^\\p{L}\\p{N}])@(${nomes.join('|')})(?![\\p{L}\\p{N}])`, 'iu').test(corpo)
  }).map(p => p.id)
}
