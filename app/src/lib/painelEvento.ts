import type { DbEvent, DbTicketType } from '../hooks/useEvents'
import { instanteLocal, situacaoEvento } from './eventoProdutor'
import { supabase } from './supabase'
import { pendencias, type Pendencia } from './tipoEvento'

// Regras do painel do evento (F1 PR3b), sem tela: o formulário e o que vai ao banco, o diff do salvamento
// automático, a validação do link e dos ingressos, o estado do cabeçalho e o envio para aprovação.

// ---- formulário -----------------------------------------------------------------------------------------------
export type Form = {
  title: string; subtitle: string; category: string; temas: string[]; estilos: string[]; tags: string[]; description: string
  inicioD: string; inicioH: string; fimD: string; fimH: string // dia (AAAA-MM-DD) e hora (HH:MM) de Brasília
  local_modo: string; venue_name: string; cep: string; numero: string; rua: string; bairro: string; venue_city: string; venue_state: string
  link: string // online_url (evento_privado)
  classificacao: string
  accent_color: string | null
}

// O que vai ao banco: colunas de events (a lista branca é colunasDoEvento) e online_url (evento_privado).
// end_date e online_url faltam quando o campo está incompleto ou inválido: o que está salvo continua como está.
export type Snap = {
  title: string; subtitle: string; category: string; temas: string[]; estilos: string[]; tags: string[]; description: string
  date: string; time: string; end_date?: string | null
  local_modo: string; venue_name: string; venue_zip: string; venue_address: string; venue_city: string; venue_state: string
  classificacao: string; accent_color: string | null; online_url?: string
}

const FUSO = 'America/Sao_Paulo'
const formataBR = new Intl.DateTimeFormat('sv-SE', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "2026-12-13T07:00:00+00:00" → { d: '2026-12-13', h: '04:00' } na hora de Brasília */
export function partesBrasilia(iso: string | null | undefined): { d: string; h: string } {
  const t = iso ? new Date(iso) : null
  if (!t || isNaN(t.getTime())) return { d: '', h: '' }
  const [d, h] = formataBR.format(t).split(' ')
  return { d, h }
}

// venue_address guarda "Rua X, 123 - Bairro" (a página pública mostra a linha como está). Endereço antigo que não
// segue o padrão fica inteiro em `rua`, e recompor devolve o mesmo texto.
export const enderecoDe = (rua: string, numero: string, bairro: string) =>
  [[rua.trim(), numero.trim()].filter(Boolean).join(', '), bairro.trim()].filter(Boolean).join(' - ')

export function separaEndereco(endereco: string | null | undefined): { rua: string; numero: string; bairro: string } {
  const [antes, ...resto] = (endereco ?? '').split(' - ')
  const m = antes.match(/^(.+), ([^,]+)$/)
  return { rua: m ? m[1] : antes, numero: m ? m[2] : '', bairro: resto.join(' - ') }
}

export function formDoEvento(e: DbEvent, link: string): Form {
  const fim = partesBrasilia(e.end_date)
  return {
    title: e.title ?? '', subtitle: e.subtitle ?? '', category: e.category ?? '', temas: e.temas ?? [], estilos: e.estilos ?? [], tags: e.tags ?? [],
    description: e.description ?? '', inicioD: e.date ?? '', inicioH: (e.time ?? '').slice(0, 5), fimD: fim.d, fimH: fim.h,
    local_modo: e.local_modo ?? 'presencial', venue_name: e.venue_name ?? '', cep: e.venue_zip ?? '', ...separaEndereco(e.venue_address),
    venue_city: e.venue_city ?? '', venue_state: e.venue_state ?? '', link, classificacao: e.classificacao ?? '', accent_color: e.accent_color ?? null,
  }
}

/** O inverso de snapDoForm: o que "Descartar" devolve à tela (o último salvo) */
export function formDoSnap(s: Snap): Form {
  const fim = partesBrasilia(s.end_date)
  return {
    title: s.title, subtitle: s.subtitle, category: s.category, temas: s.temas, estilos: s.estilos, tags: s.tags, description: s.description,
    inicioD: s.date, inicioH: s.time, fimD: fim.d, fimH: fim.h, local_modo: s.local_modo, venue_name: s.venue_name, cep: s.venue_zip,
    ...separaEndereco(s.venue_address), venue_city: s.venue_city, venue_state: s.venue_state, link: s.online_url ?? '',
    classificacao: s.classificacao, accent_color: s.accent_color,
  }
}

/** comLink = false: quem não é dono do evento não grava o link (a regra de evento_privado só deixa o dono e o admin) */
export function snapDoForm(f: Form, comLink = true): Snap {
  const link = f.link.trim()
  const fimCompleto = !!f.fimD && !!f.fimH
  return {
    title: f.title, subtitle: f.subtitle, category: f.category, temas: f.temas, estilos: f.estilos, tags: f.tags, description: f.description,
    date: f.inicioD, time: f.inicioH,
    ...(fimCompleto ? { end_date: `${f.fimD}T${f.fimH}:00-03:00` } : !f.fimD && !f.fimH ? { end_date: null } : {}),
    local_modo: f.local_modo, venue_name: f.venue_name, venue_zip: f.cep, venue_address: enderecoDe(f.rua, f.numero, f.bairro),
    venue_city: f.venue_city, venue_state: f.venue_state, classificacao: f.classificacao, accent_color: f.accent_color,
    ...(comLink && (link === '' || linkValido(link)) ? { online_url: link } : {}),
  }
}

/** Só as chaves que mudaram. date e time vão juntos: o time sozinho, sem date, é gravado como vazio (colunasDoEvento). */
export function diffCampos<T extends Record<string, unknown>>(base: T, atual: T): Partial<T> {
  const d: Record<string, unknown> = {}
  for (const k of Object.keys(atual)) if (JSON.stringify(atual[k]) !== JSON.stringify(base[k])) d[k] = atual[k]
  if ('date' in d || 'time' in d) { d.date = atual.date; d.time = atual.time }
  return d as Partial<T>
}

const ROTULO_CAMPO: Record<string, string> = {
  title: 'nome', subtitle: 'subtítulo', category: 'formato', temas: 'temas', estilos: 'estilo musical', tags: 'etiquetas', description: 'descrição',
  date: 'data', time: 'hora', end_date: 'fim', local_modo: 'local', venue_name: 'local', venue_zip: 'local', venue_address: 'local',
  venue_city: 'local', venue_state: 'local', online_url: 'link', classificacao: 'classificação', accent_color: 'cor', capa: 'capa',
}
/** Os campos mudados em texto, sem repetir ("data, hora, local") */
export const rotulosDoDiff = (d: object) => [...new Set(Object.keys(d).map(k => ROTULO_CAMPO[k]).filter(Boolean))]

// ---- link da transmissão ---------------------------------------------------------------------------------------
// O mesmo que o CHECK de evento_privado (^https://[^\s]+$, 500) e mais: sem "usuário@" no endereço (https://site.com@outro.com
// abre outro.com). O que a pessoa vê é o domínio real.
export function linkValido(url: string): boolean {
  if (!/^https:\/\/[^\s]+$/.test(url) || url.length > 500) return false
  const autoridade = url.slice(8).split(/[/?#]/)[0]
  return autoridade !== '' && !autoridade.includes('@')
}

export function dominioDoLink(url: string): string {
  try { return new URL(url).hostname } catch { return '' }
}

// ---- datas ---------------------------------------------------------------------------------------------------------
export type ErrosData = { inicio?: string; fim?: string }

/** Início só conta como "no passado" quando a pessoa o mudou (base = o que estava salvo): evento antigo continua editável */
export function errosDeData(f: Form, base: Pick<Form, 'inicioD' | 'inicioH'>, agora = Date.now()): ErrosData {
  const e: ErrosData = {}
  const inicio = f.inicioD && f.inicioH ? instanteLocal(f.inicioD, f.inicioH) : null
  if (f.inicioD && !f.inicioH) e.inicio = 'Informe a hora de início.'
  else if (!f.inicioD && f.inicioH) e.inicio = 'Informe a data de início.'
  else if (inicio !== null && inicio < agora && (f.inicioD !== base.inicioD || f.inicioH !== base.inicioH)) e.inicio = 'O início já passou. Escolha uma data e uma hora futuras.'
  if (!!f.fimD !== !!f.fimH) e.fim = 'Informe a data e a hora do fim, ou deixe os dois vazios.'
  else if (f.fimD && f.fimH && inicio !== null && instanteLocal(f.fimD, f.fimH) <= inicio) e.fim = 'O fim precisa ser depois do início.'
  return e
}

// ---- estado do evento --------------------------------------------------------------------------------------------
export type ModoPainel = 'rascunho' | 'recusado' | 'analise' | 'publicado' | 'fechado'

type EventoEstado = Pick<DbEvent, 'status' | 'approval_status' | 'rejection_reason'>

// situacaoEvento diz "Rascunho" para todo draft; "Recusado" vem do motivo. Depois de reenviar, o gatilho do banco mantém
// rejection_reason mas põe pending: published + pending é "Em análise", não "Recusado".
export function modoPainel(e: EventoEstado): ModoPainel {
  if (e.status === 'cancelled' || e.status === 'ended') return 'fechado'
  if (e.approval_status === 'rejected' || (e.status === 'draft' && !!e.rejection_reason)) return 'recusado'
  if (e.status === 'draft') return 'rascunho'
  return e.approval_status === 'approved' ? 'publicado' : 'analise'
}

export function rotuloDoModo(e: EventoEstado): string {
  const m = modoPainel(e)
  return m === 'recusado' ? 'Recusado' : m === 'publicado' ? 'À venda' : situacaoEvento(e)
}

// ---- ingressos ---------------------------------------------------------------------------------------------------
export type Ing = {
  id: string; nome: string; preco: string; qtd: string; bebida: boolean
  tipo: string // 'individual' | 'coletiva' no novo; o tipo gravado (inclusive vip e mesa) no existente, fixo
  ativo: boolean; vendidos: number; novo: boolean
}

export const brTexto = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })

export function ingDoBanco(t: DbTicketType, vendidos: number): Ing {
  return {
    id: t.id, nome: t.name, preco: brTexto(Number(t.price) || 0), qtd: String(t.quantity_total ?? t.capacity ?? ''), bebida: !!t.inclui_bebida,
    tipo: t.type, ativo: t.is_active, vendidos, novo: false,
  }
}

/** Reais, ou null se inválido. Com vírgula, o ponto é milhar; sem vírgula, o ponto é decimal. Vazio, negativo e texto: inválido. */
export function precoDe(tx: string): number | null {
  const s = tx.trim()
  const n = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  return /^\d+(\.\d{1,2})?$/.test(n) ? Math.round(parseFloat(n) * 100) / 100 : null
}

export const quantidadeDe = (tx: string): number | null => (/^\d+$/.test(tx.trim()) && Number(tx) > 0 ? Number(tx) : null)

export type ErrosIng = { nome?: string; preco?: string; qtd?: string }

export function errosDeIngresso(i: Ing): ErrosIng {
  const e: ErrosIng = {}
  if (!i.nome.trim()) e.nome = 'Dê um nome ao ingresso.'
  if (precoDe(i.preco) === null) e.preco = 'Preço inválido: use só números, com vírgula nos centavos (ex.: 80,00).'
  const q = quantidadeDe(i.qtd)
  if (q === null) e.qtd = 'Quantidade inválida: use um número inteiro maior que zero.'
  else if (q < i.vendidos) e.qtd = `Já foram vendidos ${i.vendidos}: a quantidade não pode ser menor.`
  return e
}

export const temErro = (e: object) => Object.keys(e).length > 0

// ---- pendências ------------------------------------------------------------------------------------------------------
// Seção do painel de cada um dos 8 itens da barra
export const SECAO_DA_PENDENCIA: Record<Pendencia['id'], string> = {
  nome: 'oque', formato: 'oque', descricao: 'oque', data: 'quando', local: 'quando', ingresso: 'ing', classificacao: 'regras', aceite: 'pub',
}

/** Os 8 itens com o que está na tela. Ingressos: só os SALVOS e ativos contam (o envio olha o banco). */
export function pendenciasDoPainel(f: Form, ingressosSalvos: Ing[], aceite: boolean): Pendencia[] {
  const link = f.link.trim()
  return pendencias({
    title: f.title, category: f.category, description: f.description, date: f.inicioD, time: f.inicioH, local_modo: f.local_modo,
    venue_name: f.venue_name, venue_city: f.venue_city, classificacao: f.classificacao, online_url: linkValido(link) ? link : '', aceite,
    ticket_types: ingressosSalvos.filter(i => i.ativo).map(i => ({ name: i.nome, price: precoDe(i.preco) ?? -1, quantity_total: quantidadeDe(i.qtd) ?? 0 })),
  })
}

// ---- enviar para aprovação ---------------------------------------------------------------------------------------
export type ResultadoEnvio = { ok: true } | { ok: false; erro: string }

async function erroDoAceite(err: unknown): Promise<string> {
  const resp = (err as { context?: { status?: number; json?: () => Promise<{ error?: string }> } } | null)?.context
  if (resp?.status === 409) return 'O texto do aceite mudou. Recarregue a página e envie de novo.'
  if (resp?.status === 422) return 'Escolha a classificação indicativa antes de enviar.'
  if (resp?.status === 429) return 'Muitas tentativas de envio em pouco tempo. Aguarde um pouco e tente de novo.'
  let servidor = ''
  try { servidor = (await resp?.json?.())?.error ?? '' } catch { /* resposta sem JSON */ }
  return servidor || 'Não foi possível registrar o aceite. Confira a internet e tente de novo.'
}

/**
 * Ordem que não muda (plano PR3b): (1) grava o que falta e espera; (2) para se houver ingresso não salvo; (3) aceite no
 * servidor (a classificação e a bebida valem as GRAVADAS, por isso o passo 1 vem antes); (4) compara o que o servidor
 * registrou com a tela e para se divergir; (5) rascunho e recusado publicam (o gatilho do banco põe approval pending);
 * evento já aprovado só grava (o conteúdo mudado já o devolve para análise) e refaz o aceite se classificação ou bebida mudaram.
 */
export async function enviarEvento(p: {
  eventId: string
  gravarPendentes: () => Promise<void>
  ingressosNaoSalvos: () => boolean
  tela: { classificacao: string | null; temBebida: boolean }
  aceitar: boolean
  publicar: boolean
}): Promise<ResultadoEnvio> {
  try {
    await p.gravarPendentes()
  } catch {
    return { ok: false, erro: 'Não foi possível salvar o evento. Confira a internet e tente de novo.' }
  }
  if (p.ingressosNaoSalvos()) return { ok: false, erro: 'Há ingressos com mudanças não salvas. Salve os ingressos antes de enviar.' }
  if (p.aceitar) {
    const { data, error } = await supabase.functions.invoke('aceite-evento', { body: { event_id: p.eventId } })
    if (error) return { ok: false, erro: await erroDoAceite(error) }
    if ((data?.classificacao ?? null) !== p.tela.classificacao || !!data?.tem_bebida !== p.tela.temBebida) {
      return { ok: false, erro: 'A classificação ou a bebida dos ingressos não é a que está na tela. Confira as duas e envie de novo; nada foi publicado.' }
    }
  }
  if (p.publicar) {
    const { error } = await supabase.from('events').update({ status: 'published' } as never).eq('id', p.eventId).select('id').single()
    if (error) return { ok: false, erro: 'Não foi possível enviar o evento. Tente de novo.' }
  }
  return { ok: true }
}
