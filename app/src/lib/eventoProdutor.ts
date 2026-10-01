import type { DbEvent, DbTicketType } from '../hooks/useEvents'

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

// Excluir evento ligado a afiliado, pedido ou ingresso dá 23503 (FK sem cascata; o vínculo de afiliado não se
// apaga, B3 DECISÕES 18). Devolve a mensagem e se vale oferecer "Cancelar evento".
export function erroAoExcluir(err: unknown): { mensagem: string; oferecerCancelar: boolean } {
  const e = err as { code?: string; message?: string; details?: string } | null
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

// Cópia como rascunho, com os mesmos tipos de ingresso (sem vendas)
export function copiaDoEvento(e: DbEvent): { event: Partial<DbEvent>; tickets: Partial<DbTicketType>[] } {
  return {
    event: {
      title: `${e.title} (cópia)`,
      subtitle: e.subtitle,
      description: e.description,
      short_description: e.short_description,
      cover_image: e.cover_image,
      image_url: e.image_url,
      category: e.category,
      tags: e.tags,
      venue_name: e.venue_name,
      venue_address: e.venue_address,
      venue_city: e.venue_city,
      venue_state: e.venue_state,
      date: e.date,
      time: e.time,
      start_date: e.start_date,
      end_date: e.end_date,
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
    })),
  }
}
