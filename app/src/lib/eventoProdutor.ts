import type { DbEvent, DbTicketType } from '../hooks/useEvents'
import { FOTO_PADRAO, temFoto } from './corEvento'
import { enviarEGravarCapa } from './capaEvento'
import { supabase } from './supabase'

// Regras de evento usadas pelas telas do produtor (Meus eventos, Pasta do evento).

export type Situacao = 'Rascunho' | 'Em análise' | 'Publicado' | 'Encerrado' | 'Cancelado' | 'Recusado'

// Selo de situação, o mesmo do Início (B2): status do produtor + moderação do admin (F0a).
// "Publicado" = no ar para o público: publicado E aprovado.
export function situacaoEvento(e: { status: string; approval_status?: string | null; rejection_reason?: string | null }): Situacao {
  // recusado pela equipe volta a rascunho (useApproveEvent) mas guarda o motivo e approval_status 'rejected'
  if (e.status === 'draft') return e.approval_status === 'rejected' || e.rejection_reason ? 'Recusado' : 'Rascunho'
  if (e.status === 'ended') return 'Encerrado'
  if (e.status === 'cancelled') return 'Cancelado'
  if (e.approval_status === 'approved') return 'Publicado'
  if (e.approval_status === 'rejected') return 'Recusado'
  return 'Em análise'
}

// Fila de moderação do admin (F1): só o que o produtor ENVIOU (published) e ainda não foi decidido. Rascunho com
// approval_status 'pending' (o padrão do banco) não é pedido de análise. Sem approval_status conta como pendente.
/** Referência do link público: fora de 'public' só o uuid abre (evento_publico, PR3e); o slug é chutável. */
export const refDoEvento = (e: { id: string; slug?: string | null; visibility?: string | null }) =>
  e.visibility === 'public' ? e.slug || e.id : e.id

export const naFilaDeModeracao = (e: { status: string; approval_status?: string | null }): boolean =>
  e.status === 'published' && (e.approval_status === 'pending' || !e.approval_status)

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

// A maior data conhecida do evento ainda não passou (favorece o bloqueio): o mesmo critério do gatilho. O começo
// rápido e o Evo gravam só date e time, e start_date fica com a hora da criação; por isso entra date + time (sem
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

// Início e fim do evento (os mesmos do "ao vivo" do celular): fim = end_date ou início + 12 h; evento só com dia (sem hora) vale 24 h.
// A hora do evento (date + time) é a de Brasília.
const FUSO = 'America/Sao_Paulo'
const HORA = 3_600_000
const DURACAO_PADRAO = 12 * HORA
const DIA = 24 * HORA

// ms que o fuso está à frente do UTC no instante t (derivado do Intl: segue a regra do fuso, sem deslocamento fixo)
function deslocamento(t: number): number {
  const p: Record<string, string> = {}
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: FUSO, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t))) p[x.type] = x.value
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000
}

/** Instante (ms UTC) de "AAAA-MM-DD" + "HH:MM[:SS]" na hora de Brasília */
export function instanteLocal(data: string, hora = '00:00:00'): number {
  const [a, m, d] = data.split('-').map(Number)
  const [h = 0, mi = 0, s = 0] = hora.split(':').map(Number)
  const parede = Date.UTC(a, m - 1, d, h, mi, s)
  return parede - deslocamento(parede - deslocamento(parede))
}

export const diaInteiro = (e: DbEvent) => !!e.date && !e.time
export const inicioDe = (e: DbEvent) => (e.date ? instanteLocal(e.date, e.time || '00:00:00') : new Date(e.start_date).getTime())
export const fimDe = (e: DbEvent) => (e.end_date ? new Date(e.end_date).getTime() : inicioDe(e) + (diaInteiro(e) ? DIA : DURACAO_PADRAO))
// No ar (Decisão 163 item 5): aprovado, publicado e ainda visível ao comprador: o evento não terminou (fim = end_date
// ou início + 12 h, o mesmo do "ao vivo"), então evento em andamento conta. Igual no Painel e em Eventos.
export const noAr = (e: { status: string; approval_status?: string | null; start_date: string; end_date: string | null; date?: string | null; time?: string | null }, agora = Date.now()): boolean =>
  e.status === 'published' && e.approval_status === 'approved' && fimDe(e as DbEvent) > agora

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
    const txt = `${e.message ?? ''} ${e.details ?? ''}`
    const o = 'Cancele o evento em vez de excluir.'
    return {
      mensagem: /affiliates/.test(txt) ? `Este evento tem afiliados vinculados. ${o}`
        : /\borders\b/.test(txt) ? `Este evento tem pedidos. ${o}`
        : /\btickets\b/.test(txt) ? `Este evento tem ingressos emitidos. ${o}`
        : `Este evento tem vendas ou registros vinculados. ${o}`,
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
      capa_na_cor: e.capa_na_cor,
      accent_intensity: e.accent_intensity,
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
      max_per_order: t.max_per_order, // teto por pedido (#217)
    })),
  }
}

export interface Duplicacao {
  id: string // o evento novo
  ingressos: number // tipos de ingresso copiados
  foto: boolean // a capa foi copiada
  avisos: string[] // o que não foi copiado e deveria ter sido
}

// Duplica em três etapas, como o EvoPlanejar: o evento (guarda o id), os ingressos e a foto. Falha de ingresso ou de
// foto não perde nem repete o evento: devolve o id com o aviso. Só a criação do evento lança erro (nada foi criado).
// `criar` é o mutateAsync do useCreateEvent (o contrato dele não muda); produtorId é o dono da pasta da capa.
export async function duplicarEvento(
  original: DbEvent,
  criar: (v: { event: Partial<DbEvent>; tickets: Partial<DbTicketType>[] }) => Promise<unknown>,
  produtorId: string,
): Promise<Duplicacao> {
  const { event, tickets } = copiaDoEvento(original)
  const novo = (await criar({ event, tickets: [] })) as { id: string }
  const r: Duplicacao = { id: novo.id, ingressos: 0, foto: false, avisos: [] }

  if (tickets.length > 0) {
    // mesmos campos do useCreateEvent (sem lot_number: Decisão 20); `as never`: os tipos gerados do banco devolvem
    // never para ticket_types (mesmo erro herdado em useEvents). Toda linha leva as mesmas chaves e nenhum undefined:
    // no insert em lote o supabase-js lista as colunas da primeira linha e a que faltar vira NULL (inclui_bebida é not null).
    const { error } = await supabase.from('ticket_types').insert(tickets.map((t, i) => ({
      event_id: novo.id, name: t.name || `Ingresso ${i + 1}`, description: t.description || null, price: Number(t.price) || 0,
      capacity: t.capacity ? Number(t.capacity) : null, quantity_total: t.capacity ? Number(t.capacity) : 0, sold: 0, quantity_sold: 0,
      type: t.type === 'coletiva' ? 'coletiva' : 'individual', perks: t.perks || [], is_active: t.is_active ?? true, inclui_bebida: !!t.inclui_bebida, max_per_order: t.max_per_order ?? null,
    })) as never)
    if (error) { console.error('[duplicarEvento] ingressos', error); r.avisos.push('os ingressos não foram copiados') } else r.ingressos = tickets.length
  }

  const url = [original.cover_image, original.image_url].find(temFoto)
  if (url) {
    try {
      // só foto pública em https (a do bucket capas-eventos). A do bucket já é webp ou jpeg de até 2 MB, passada pelo
      // prepararCapa no envio original: sobe como está (sem recodificar), com nome novo, na pasta do evento novo.
      if (!url.startsWith('https://')) throw new Error('foto fora do bucket')
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      if (blob.type !== 'image/webp' && blob.type !== 'image/jpeg') throw new Error(`tipo ${blob.type}`)
      r.foto = await enviarEGravarCapa({ blob, previewUrl: '', cor: '' }, produtorId, novo.id)
    } catch (err) {
      console.error('[duplicarEvento] foto', err instanceof Error ? err.message : err)
    }
    if (!r.foto) r.avisos.push('foto não copiada')
  }
  return r
}

export const confirmacaoDuplicar = (titulo: string) =>
  `Duplicar "${titulo}"? A cópia nasce como rascunho, com os ingressos e a foto. Datas, vendas, aprovação e destaque não vão.`

// Texto do aviso depois de duplicar: o que foi copiado e o que não
export function resumoDuplicacao(r: Duplicacao): string {
  const copiado = ['os dados do evento', r.ingressos > 0 && `${r.ingressos} ${r.ingressos === 1 ? 'tipo de ingresso' : 'tipos de ingresso'}`, r.foto && 'a foto']
    .filter(Boolean).join(', ')
  const falhas = r.avisos.length ? ` Atenção: ${r.avisos.join('; ')}.` : ''
  return `Cópia criada como rascunho. Copiado: ${copiado}. Não vão: datas, vendas, aprovação e destaque.${falhas}`
}
