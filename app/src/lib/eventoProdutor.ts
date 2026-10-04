import type { DbEvent, DbTicketType } from '../hooks/useEvents'
import { FOTO_PADRAO } from './corEvento'

// Regras de evento usadas pelas telas do produtor (Meus eventos, Pasta do evento).

export type Situacao = 'Rascunho' | 'Em análise' | 'Publicado' | 'Encerrado' | 'Cancelado' | 'Recusado'

// Selo de situação, o mesmo do Início (B2): status do produtor + moderação do admin (F0a).
// "Publicado" = no ar para o público: publicado E aprovado.
export function situacaoEvento(e: { status: string; approval_status?: string | null }): Situacao {
  if (e.status === 'draft') return 'Rascunho'
  if (e.status === 'ended') return 'Encerrado'
  if (e.status === 'cancelled') return 'Cancelado'
  if (e.approval_status === 'approved') return 'Publicado'
  if (e.approval_status === 'rejected') return 'Recusado'
  return 'Em análise'
}

// Decisão 129: com ingresso vendido o produtor não tira o evento do ar nem reabre o cancelado até existir reembolso
// (M12). O banco recusa (gatilho gf_protect_event_cancel, docs/sql/20261006_saldo_e_cancelamento.sql): EV001 ao
// cancelar; EV002 ao voltar a rascunho ou encerrar antes da data; EV003 ao reabrir um cancelado.
export const CANCELAR_COM_VENDA = 'Este evento tem ingressos vendidos. Para cancelar, fale com o suporte da Evokaa.'
export const SAIR_DO_AR_COM_VENDA = 'Este evento tem ingressos vendidos e não pode sair do ar. Fale com o suporte da Evokaa.'
export const REABRIR_COM_VENDA = 'Evento cancelado com ingressos vendidos só é reaberto pelo suporte da Evokaa.'

export function erroDeStatus(err: unknown, padrao: string): string {
  const code = (err as { code?: string } | null)?.code
  return code === 'EV001' ? CANCELAR_COM_VENDA : code === 'EV002' ? SAIR_DO_AR_COM_VENDA
    : code === 'EV003' ? REABRIR_COM_VENDA : padrao
}

// Vendidos do evento pela contagem da tela (useVendidosPorEvento): número quando se sabe, undefined quando não.
// Com a lista cortada (mais de 1.000 ingressos), evento com zero na lista pode ter venda fora dela: "não sei".
export function vendidosDe(vendidos: { porEvento: Record<string, number>; cortado: boolean } | undefined, id: string): number | undefined {
  if (!vendidos) return undefined
  const n = vendidos.porEvento[id] ?? 0
  return n > 0 ? n : vendidos.cortado ? undefined : 0
}

// A maior data conhecida do evento ainda não passou (favorece o bloqueio): o mesmo critério do gatilho. NewEvent e
// EventPlanner gravam só date e time, e start_date fica com a hora da criação; por isso entra date + time (sem
// hora = 23:59:59), na hora de Brasília.
// ponytail: fuso fixo -03:00 (Brasil sem horário de verão desde 2019); o banco usa 'America/Sao_Paulo'.
export function dataPorVir(
  e: { start_date: string; end_date: string | null; date?: string | null; time?: string | null },
  agora = Date.now(),
): boolean {
  const datas = [e.start_date, e.end_date].map(d => (d ? new Date(d).getTime() : NaN))
  if (e.date) datas.push(new Date(`${e.date}T${e.time || '23:59:59'}-03:00`).getTime())
  return datas.some(t => t > agora) // NaN > agora é falso: data ausente ou ilegível não conta
}

// Arquivar (= encerrar). Sem saber se há venda e com a data por vir, avisa que o banco pode recusar.
export function confirmacaoArquivar(titulo: string, vendidos: number | undefined, porVir: boolean): string {
  const base = `Arquivar "${titulo}"? A situação passa a ser Encerrado.`
  return vendidos === undefined && porVir
    ? `${base}\n\nSe o evento tiver ingressos vendidos, ele não pode sair do ar antes da data: fale com o suporte da Evokaa.`
    : base
}

// Excluir evento ligado a afiliado, pedido ou ingresso dá 23503 (FK sem cascata; o vínculo de afiliado não se
// apaga, B3 DECISÕES 18). Devolve a mensagem e se vale oferecer "Cancelar evento": com vendidos > 0 não vale
// (Decisão 129). Sem saber os vendidos (contagem não carregou) oferece; se houver venda, o banco recusa.
export function erroAoExcluir(err: unknown, vendidos?: number): { mensagem: string; oferecerCancelar: boolean } {
  const e = err as { code?: string; message?: string; details?: string } | null
  if (e?.code === '23503' && (vendidos ?? 0) > 0) return { mensagem: CANCELAR_COM_VENDA, oferecerCancelar: false }
  if (e?.code === '23503') {
    const afiliado = /affiliates/.test(`${e.message ?? ''} ${e.details ?? ''}`)
    return {
      mensagem: afiliado
        ? 'Este evento tem afiliados vinculados. Cancele o evento em vez de excluir.'
        : 'Este evento tem vendas ou registros vinculados. Cancele o evento em vez de excluir.',
      oferecerCancelar: true,
    }
  }
  return { mensagem: 'Não foi possível excluir o evento.', oferecerCancelar: false }
}

// Texto da confirmação de cancelar. Só é usado sem venda conhecida (com vendidos > 0 a tela mostra
// CANCELAR_COM_VENDA, Decisão 129); sem saber se há venda (contagem não carregou), avisa que o banco pode recusar.
export function confirmacaoCancelar(titulo: string, vendidos: number | undefined): string {
  const base = `Cancelar o evento "${titulo}"? A situação passa a ser Cancelado.`
  return vendidos === 0
    ? base
    : `${base}\n\nSe o evento tiver ingressos vendidos, o cancelamento é recusado: fale com o suporte da Evokaa.`
}

// Cópia como rascunho, com os mesmos tipos de ingresso (sem vendas). Sem datas (date, time, start_date, end_date):
// o evento novo nasce "sem data" e o produtor escolhe uma (F1).
export function copiaDoEvento(e: DbEvent): { event: Partial<DbEvent>; tickets: Partial<DbTicketType>[] } {
  return {
    event: {
      title: `${e.title} (cópia)`,
      subtitle: e.subtitle,
      description: e.description,
      short_description: e.short_description,
      cover_image: FOTO_PADRAO, // a foto do original não vai: a trava do banco aceita só a pasta do próprio evento
      image_url: FOTO_PADRAO,
      accent_color: e.accent_color,
      category: e.category,
      temas: e.temas,
      estilos: e.estilos,
      classificacao: e.classificacao,
      local_modo: e.local_modo,
      tags: e.tags,
      venue_name: e.venue_name,
      venue_address: e.venue_address,
      venue_city: e.venue_city,
      venue_state: e.venue_state,
      status: 'draft',
      visibility: e.visibility,
      capacity: e.capacity,
      branding: e.branding,
      settings: e.settings,
    },
    tickets: (e.ticket_types || []).map(t => ({
      name: t.name,
      description: t.description,
      price: t.price,
      // quantity_total é a coluna real; capacity é legado (useCreateEvent grava as duas a partir daqui)
      capacity: t.quantity_total ?? t.capacity,
      type: t.type,
      perks: t.perks,
      is_active: t.is_active, // tipo oculto continua oculto na cópia
      inclui_bebida: t.inclui_bebida,
    })),
  }
}
