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
  capa_na_cor: boolean
  accent_intensity: number
}

// O que vai ao banco: colunas de events (a lista branca é colunasDoEvento) e online_url (evento_privado).
// end_date e online_url faltam quando o campo está incompleto ou inválido: o que está salvo continua como está.
export type Snap = {
  title: string; subtitle: string; category: string; temas: string[]; estilos: string[]; tags: string[]; description: string
  date: string; time: string; end_date?: string | null
  local_modo: string; venue_name: string; venue_zip: string; venue_address: string; venue_city: string; venue_state: string
  classificacao: string; accent_color: string | null; capa_na_cor: boolean; accent_intensity: number; online_url?: string
}

export const USA_LINK = ['online', 'hibrido']
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
    venue_city: e.venue_city ?? '', venue_state: e.venue_state ?? '', link, classificacao: e.classificacao ?? '', accent_color: e.accent_color ?? null, capa_na_cor: e.capa_na_cor === true, accent_intensity: e.accent_intensity ?? 100,
  }
}

/** O inverso de snapDoForm: o que "Descartar" devolve à tela (o último salvo) */
export function formDoSnap(s: Snap): Form {
  const fim = partesBrasilia(s.end_date)
  return {
    title: s.title, subtitle: s.subtitle, category: s.category, temas: s.temas, estilos: s.estilos, tags: s.tags, description: s.description,
    inicioD: s.date, inicioH: s.time, fimD: fim.d, fimH: fim.h, local_modo: s.local_modo, venue_name: s.venue_name, cep: s.venue_zip,
    ...separaEndereco(s.venue_address), venue_city: s.venue_city, venue_state: s.venue_state, link: s.online_url ?? '',
    classificacao: s.classificacao, accent_color: s.accent_color, capa_na_cor: s.capa_na_cor, accent_intensity: s.accent_intensity,
  }
}

export function snapDoForm(f: Form): Snap {
  const link = f.link.trim()
  const fimCompleto = !!f.fimD && !!f.fimH
  return {
    title: f.title, subtitle: f.subtitle, category: f.category, temas: f.temas, estilos: f.estilos, tags: f.tags, description: f.description,
    date: f.inicioD, time: f.inicioH,
    ...(fimCompleto ? { end_date: `${f.fimD}T${f.fimH}:00-03:00` } : !f.fimD && !f.fimH ? { end_date: null } : {}),
    local_modo: f.local_modo, venue_name: f.venue_name, venue_zip: f.cep, venue_address: enderecoDe(f.rua, f.numero, f.bairro),
    venue_city: f.venue_city, venue_state: f.venue_state, classificacao: f.classificacao, accent_color: f.accent_color, capa_na_cor: f.capa_na_cor, accent_intensity: f.accent_intensity,
    // modo sem link (presencial, a definir): o link salvo some de evento_privado
    ...(!USA_LINK.includes(f.local_modo) ? { online_url: '' } : link === '' || linkValido(link) ? { online_url: link } : {}),
  }
}

/** Só as chaves que mudaram. date e time vão juntos: o time sozinho, sem date, é gravado como vazio (colunasDoEvento). */
export function diffCampos<T extends Record<string, unknown>>(base: T, atual: T): Partial<T> {
  const d: Record<string, unknown> = {}
  for (const k of Object.keys(atual)) if (JSON.stringify(atual[k]) !== JSON.stringify(base[k])) d[k] = atual[k]
  if ('date' in d || 'time' in d) { d.date = atual.date; d.time = atual.time }
  return d as Partial<T>
}

// O que o gatilho do banco (gf_protect_event_moderation) trata como conteúdo: mudar isto num evento aprovado o devolve
// para análise. A cor (accent_color), sua intensidade (accent_intensity) e a escolha da capa (capa_na_cor) ficam de fora: vale na hora. A capa (cover_image) é conteúdo (Decisão 136).
const FORA_DA_MODERACAO = ['accent_color', 'accent_intensity', 'capa_na_cor']
export const mudouConteudo = (d: object, capa = false) => capa || Object.keys(d).some(k => !FORA_DA_MODERACAO.includes(k))

export const ERRO_NOME = 'Escreva o nome: ele aparece na página e no ingresso.'

/** O diff sem o nome vazio (só espaços também): o salvamento espera, em vez de gravar {"title":""} */
export function semNomeVazio<T extends Record<string, unknown>>(d: Partial<T>, nome: string): Partial<T> {
  if (nome.trim() !== '' || !('title' in d)) return d
  const c = { ...d }
  delete c.title
  return c
}

/** Mensagem do erro ao gravar os ingressos: dado recusado pelo banco (400/422, códigos 22 e 23) não é problema de internet */
export function erroDosIngressos(err: unknown): string {
  const e = err as { code?: string; status?: number } | null
  const msg = (err as { message?: string } | null)?.message ?? ''
  if (e?.code === '23514' && msg.startsWith('Já foram vendidos')) return msg
  if (e?.code === '22023' && msg.startsWith('Este ingresso é vendido por lugar marcado')) return msg
  if (e?.code === '23503') return 'Este ingresso já tem pedidos ligados e não pode ser removido. Use Ocultar.'
  if (e?.status === 400 || e?.status === 422 || /^(22|23)/.test(e?.code ?? '') || /^PGRST1/.test(e?.code ?? '')) return 'O banco recusou um dos ingressos: confira nome, preço e quantidade.'
  return 'Não foi possível salvar os ingressos. Confira a internet e tente de novo.'
}

/** O diff sem as datas que têm erro: o salvamento espera a pessoa corrigir (início, fim ou os dois) */
export function semDatasInvalidas<T extends Record<string, unknown>>(d: Partial<T>, e: ErrosData): Partial<T> {
  const c: Record<string, unknown> = { ...d }
  if (e.inicio) { delete c.date; delete c.time }
  if (e.fim) delete c.end_date
  return c as Partial<T>
}

const ROTULO_CAMPO: Record<string, string> = {
  title: 'nome', subtitle: 'subtítulo', category: 'formato', temas: 'temas', estilos: 'estilo musical', tags: 'etiquetas', description: 'descrição',
  date: 'data', time: 'hora', end_date: 'fim', local_modo: 'local', venue_name: 'local', venue_zip: 'local', venue_address: 'local',
  venue_city: 'local', venue_state: 'local', online_url: 'link', classificacao: 'classificação', accent_color: 'cor', capa_na_cor: 'estilo da capa', accent_intensity: 'cor', capa: 'capa',
}
/** Os campos mudados em texto, sem repetir ("data, hora, local") */
export const rotulosDoDiff = (d: object) => [...new Set(Object.keys(d).map(k => ROTULO_CAMPO[k]).filter(Boolean))]

// ---- link da transmissão ---------------------------------------------------------------------------------------
// O mesmo que o CHECK de evento_privado (^https://[^\s]+$, 500) e mais: o endereço tem de ser um endereço de verdade
// (new URL aceita, protocolo https, domínio não vazio) e sem "usuário@" (https://site.com@outro.com abre outro.com; a forma
// codificada https://a%40b.com também cai: o username/password vira parte da URL). O que a pessoa vê é o domínio real.
export function linkValido(url: string): boolean {
  if (!/^https:\/\/[^\s]+$/.test(url) || url.length > 500) return false
  const autoridade = url.slice(8).split(/[/?#]/)[0]
  if (autoridade === '' || autoridade.includes('@')) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname !== '' && u.hostname !== '.' && !u.hostname.startsWith('.') && u.username === '' && u.password === '' && !autoridade.includes('%40')
  } catch {
    return false
  }
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
  return modoPainel(e) === 'publicado' ? 'À venda' : situacaoEvento(e)
}

// ---- ingressos ---------------------------------------------------------------------------------------------------
export type Ing = {
  id: string; nome: string; preco: string; qtd: string; bebida: boolean
  tipo: string // 'individual' | 'coletiva' no novo; o tipo gravado (inclusive vip e mesa) no existente, fixo
  ativo: boolean; vendidos: number; novo: boolean
  inicioVenda: string; fimVenda: string // datetime-local (AAAA-MM-DDTHH:MM, Brasília); vazio = sem data
  descricao: string; minPed: string; maxPed: string // maxPed vazio = null no banco (vale 10, ver tetoPorPedido)
  maxCpf: string // limite por CPF do comprador; vazio = sem limite (null no banco)
}

export const brTexto = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })

const venda = (iso: string | null | undefined) => { const p = partesBrasilia(iso); return p.d ? `${p.d}T${p.h}` : '' }
/** datetime-local → timestamptz de Brasília; vazio → null */
export const vendaParaBanco = (tx: string) => (tx ? `${tx}:00-03:00` : null)

export function ingDoBanco(t: DbTicketType, vendidos: number): Ing {
  return {
    id: t.id, nome: t.name, preco: brTexto(Number(t.price) || 0), qtd: String(t.quantity_total ?? t.capacity ?? ''), bebida: !!t.inclui_bebida,
    tipo: t.type, ativo: t.is_active, vendidos, novo: false,
    inicioVenda: venda(t.sale_start), fimVenda: venda(t.sale_end),
    descricao: t.description ?? '', minPed: String(t.min_per_order ?? 1), maxPed: t.max_per_order == null ? '' : String(t.max_per_order),
    maxCpf: t.max_por_cpf == null ? '' : String(t.max_por_cpf),
  }
}

/** Limites por pedido e por CPF para o banco: mínimo número, máximo e limite por CPF número ou null (vazio limpa) */
export const pedidoParaBanco = (i: Ing) => ({
  min_per_order: Number(i.minPed), max_per_order: i.maxPed.trim() === '' ? null : Number(i.maxPed),
  max_por_cpf: i.maxCpf.trim() === '' ? null : Number(i.maxCpf),
})

/** Reais, ou null se inválido. Com vírgula, o ponto é milhar; sem vírgula, o ponto é decimal. Vazio, negativo e texto: inválido. */
export function precoDe(tx: string): number | null {
  const s = tx.trim()
  const n = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  return /^\d+(\.\d{1,2})?$/.test(n) ? Math.round(parseFloat(n) * 100) / 100 : null
}

export const QUANTIDADE_MAX = 1_000_000
export const quantidadeDe = (tx: string): number | null => (/^\d+$/.test(tx.trim()) && Number(tx) > 0 && Number(tx) <= QUANTIDADE_MAX ? Number(tx) : null)

export type ErrosIng = { nome?: string; preco?: string; qtd?: string; venda?: string; pedido?: string; cpf?: string }

/** fimEvento: instante (ms) do fim do evento, se houver */
export function errosDeIngresso(i: Ing, fimEvento?: number): ErrosIng {
  const e: ErrosIng = {}
  if (!i.nome.trim()) e.nome = 'Dê um nome ao ingresso.'
  if (precoDe(i.preco) === null) e.preco = 'Preço inválido: use só números, com vírgula nos centavos (ex.: 80,00).'
  const q = quantidadeDe(i.qtd)
  if (q === null) e.qtd = 'Quantidade inválida: use um número inteiro entre 1 e 1.000.000.'
  else if (q < i.vendidos) e.qtd = `Já foram vendidos ${i.vendidos}: a quantidade não pode ser menor.`
  const min = /^\d+$/.test(i.minPed.trim()) ? Number(i.minPed) : null
  const max = i.maxPed.trim() === '' ? undefined : /^\d+$/.test(i.maxPed.trim()) ? Number(i.maxPed) : null
  if (min === null || min < 1 || (q !== null && min > q)) e.pedido = 'Mínimo por pedido inválido: use um número inteiro de 1 até a quantidade.'
  else if (max === null || max === 0) e.pedido = 'Máximo por pedido inválido: use um número inteiro de 1 a 10 ou deixe vazio (vale 10).'
  else if (max !== undefined && max > 10) e.pedido = 'O máximo por pedido é 10.'
  else if (max !== undefined && max < min) e.pedido = 'O máximo por pedido não pode ser menor que o mínimo.'
  else if (max === undefined && min > 10) e.pedido = 'Sem máximo, o limite por pedido é 10: use um mínimo de até 10.'
  else if (max !== undefined && q !== null && max > q) e.pedido = 'O máximo por pedido não pode passar da quantidade de ingressos.'
  const cpf = i.maxCpf.trim()
  if (cpf !== '' && (!/^\d+$/.test(cpf) || Number(cpf) < 1)) e.cpf = 'Limite por CPF inválido: use um número inteiro a partir de 1 ou deixe vazio para não limitar.'
  else if (cpf !== '' && q !== null && Number(cpf) > q) e.cpf = 'O limite por CPF não pode passar da quantidade de ingressos.'
  const ini = i.inicioVenda ? Date.parse(vendaParaBanco(i.inicioVenda)!) : null
  const fim = i.fimVenda ? Date.parse(vendaParaBanco(i.fimVenda)!) : null
  if (ini !== null && fim !== null && fim <= ini) e.venda = 'O fim da venda precisa ser depois do início.'
  else if (fim !== null && fimEvento !== undefined && fim > fimEvento) e.venda = 'A venda não pode terminar depois do fim do evento.'
  return e
}

export const temErro = (e: object) => Object.keys(e).length > 0

// ---- prévia no celular (PR3d-1) -----------------------------------------------------------------------------------
/** O evento como a página pública o mostraria com o que está na tela (sem gravar). Só ingressos ativos: o banco só mostra esses ao público. */
export function eventoDaPrevia(form: Form, ings: Ing[], { evento, capaUrl }: { evento: DbEvent; capaUrl: string | null }): DbEvent {
  return {
    ...evento, ...snapDoForm(form),
    // start_date é obrigatório para publicar; sem data na tela, um rascunho antigo mostraria "Evento encerrado" na prévia
    ...(form.inicioD ? {} : { start_date: new Date().toISOString() }),
    cover_image: capaUrl, image_url: capaUrl,
    ticket_types: ings.filter(i => i.ativo).map(i => {
      const db = evento.ticket_types?.find(t => t.id === i.id) // o que não é editado no formulário (descrição, benefícios, datas de venda) vem do salvo
      return {
        ...db, id: i.id, event_id: evento.id, perks: Array.isArray(db?.perks) ? db.perks : [], name: i.nome.trim() || 'Ingresso sem nome', price: precoDe(i.preco) ?? 0,
        description: i.descricao.trim() || null, ...pedidoParaBanco(i), capacity: quantidadeDe(i.qtd), quantity_total: quantidadeDe(i.qtd), sold: db?.sold ?? 0, type: i.tipo as DbTicketType['type'], is_active: true, inclui_bebida: i.bebida,
      }
    }),
  } as DbEvent
}

// ---- pendências ------------------------------------------------------------------------------------------------------
// Seção do painel de cada um dos 8 itens da barra
export const SECAO_DA_PENDENCIA: Record<Pendencia['id'], string> = {
  nome: 'oque', formato: 'oque', descricao: 'oque', data: 'quando', local: 'quando', ingresso: 'ing', classificacao: 'regras', aceite: 'pub',
}

// O que dizer em cada pendência (no campo e no balão) e qual campo focar. Ids: os das seções do painel.
export const MSG_PENDENCIA: Record<Pendencia['id'], string> = {
  nome: 'Escreva o nome do evento.', formato: 'Escolha o formato.', descricao: 'Escreva a descrição, com pelo menos 20 caracteres.',
  data: 'Escolha a data e a hora de início.', local: 'Preencha o local.', ingresso: 'Salve um ingresso com nome, quantidade e preço.',
  classificacao: 'Escolha a classificação indicativa.', aceite: 'Marque o aceite do produtor.',
}

/** Passos do destaque por modo, um por campo: rascunho e recusado = pendências + bloqueios; no ar e em análise = só os bloqueios (o aceite e as pendências antigas não impedem); fechado = nenhum. Com vendas (travado) data e hora estão desabilitadas: o alvo vira o cabeçalho da seção. */
export function alvosDoModo<T extends { campo: string }>(modo: ModoPainel, pendencias: T[], bloqueios: T[], travado = false): T[] {
  const base = modo === 'rascunho' || modo === 'recusado' ? [...pendencias, ...bloqueios] : modo === 'publicado' || modo === 'analise' ? bloqueios : []
  const campo = (c: string) => (travado && (c === 'f-inicio' || c === 'f-fim') ? 's-quando' : c)
  return base.map(x => ({ ...x, campo: campo(x.campo) })).filter((x, i, l) => l.findIndex(y => y.campo === x.campo) === i)
}

/** Id do campo que resolve a pendência. Ingresso: com mudança não salva, o botão "Salvar" (é o que falta); senão o primeiro sem nome ou sem quantidade; sem ingresso, o botão "Adicionar". */
export function campoDaPendencia(id: Pendencia['id'], f: Form, ings: Ing[], ingSujo = false): string {
  switch (id) {
    case 'nome': return 'f-nome'
    case 'formato': return 'f-formato'
    case 'descricao': return 'f-desc'
    case 'data': return 'f-inicio'
    case 'local':
      if (f.local_modo === 'online') return 'f-link'
      return !f.venue_name.trim() ? 'f-lnome' : !f.venue_city.trim() ? 'f-cep' : 'f-link'
    case 'ingresso': {
      if (ingSujo) return 'ing-salvar'
      const g = ings.find(i => i.ativo && (!i.nome.trim() || !quantidadeDe(i.qtd)))
      if (g) return `ing-${g.id}-${!g.nome.trim() ? 'nome' : 'qtd'}`
      const alvo = ings.find(i => i.ativo) ?? ings[0]
      return alvo ? `ing-${alvo.id}-preco` : 'ing-novo'
    }
    case 'classificacao': return 'f-class'
    case 'aceite': return 'f-aceite'
  }
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
// divergiu: o servidor gravou um aceite que não é o texto lido; a tela relê o evento do banco para o próximo refazer.
export type ResultadoEnvio = { ok: true } | { ok: false; erro: string; divergiu?: boolean }

export const ERRO_ACEITE_NO_AR = 'As alterações já foram para análise, mas o aceite não foi registrado.'

// Texto do próprio front por status: a mensagem do servidor não é mostrada (a função pode mudar o texto e não deve vazar detalhe)
function erroDoAceite(err: unknown): string {
  const status = (err as { context?: { status?: number } } | null)?.context?.status
  const porStatus: Record<number, string> = {
    400: 'O pedido de aceite saiu incompleto. Recarregue a página e envie de novo.',
    401: 'Sua sessão expirou. Entre de novo e envie outra vez.',
    403: 'O servidor recusou o aceite. Confirme a verificação em duas etapas no seu perfil e envie de novo.',
    404: 'Não encontramos este evento para registrar o aceite. Recarregue a página.',
    409: 'O texto do aceite mudou. Recarregue a página e envie de novo.',
    422: 'Escolha a classificação indicativa antes de enviar.',
    429: 'Muitas tentativas de envio em pouco tempo. Aguarde um pouco e tente de novo.',
    500: 'O servidor não conseguiu registrar o aceite. Tente de novo em instantes.',
  }
  return (status && porStatus[status]) || 'Não foi possível registrar o aceite. Confira a internet e tente de novo.'
}

export async function sha256Hex(texto: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Ordem que não muda (plano PR3b): (1) grava o que falta e espera; (2) para se houver ingresso não salvo; (3) aceite no
 * servidor (a classificação e a bebida valem as GRAVADAS, por isso o passo 1 vem antes); (4) compara o que o servidor
 * registrou com a tela (classificação, bebida e o hash do texto que a pessoa leu) e para se divergir; (5) rascunho e
 * recusado publicam (o gatilho do banco põe approval pending); evento já aprovado só grava (o conteúdo mudado já o devolve
 * para análise) e refaz o aceite se classificação ou bebida mudaram. Resposta sem texto_hash conta como divergência.
 */
export async function enviarEvento(p: {
  eventId: string
  gravarPendentes: () => Promise<void>
  ingressosNaoSalvos: () => boolean
  tela: { classificacao: string | null; temBebida: boolean }
  textoAceito: string // o texto que a pessoa leu (textoAceite montado da tela)
  aceitar: boolean
  publicar: boolean
  soAceite?: boolean // só refaz o aceite do que já está salvo: gravarPendentes não grava conteúdo
}): Promise<ResultadoEnvio> {
  try {
    await p.gravarPendentes()
  } catch (e) {
    // falha parcial: o evento gravou e o link não (o banco já pode estar em análise)
    const parcial = (e as { parcial?: boolean } | null)?.parcial
    return { ok: false, erro: parcial
      ? (p.publicar ? 'O evento foi salvo, mas o link não foi gravado. Nada foi publicado: envie de novo.' : 'O evento foi salvo e enviado para análise, mas o link não foi gravado: ele será salvo de novo.')
      : 'Não foi possível salvar o evento. Confira a internet e tente de novo.' }
  }
  // Evento no ar que enviou alterações: o passo 1 já o mandou para análise, então a falha do aceite precisa dizer isso
  const aposAlteracoes = !p.publicar && !p.soAceite
  const falha = (erro: string, divergiu = false) => ({ ok: false as const, erro, divergiu })
  if (p.ingressosNaoSalvos()) return falha('Há ingressos com mudanças não salvas. Salve os ingressos antes de enviar.')
  if (p.aceitar) {
    const { data, error } = await supabase.functions.invoke('aceite-evento', { body: { event_id: p.eventId } })
    if (error) return falha(`${aposAlteracoes ? `${ERRO_ACEITE_NO_AR} ` : ''}${erroDoAceite(error)}`)
    const hashLido = await sha256Hex(p.textoAceito)
    if ((data?.classificacao ?? null) !== p.tela.classificacao || !!data?.tem_bebida !== p.tela.temBebida || data?.texto_hash !== hashLido) {
      // o aceite FOI gravado, mas não é o texto que a pessoa leu
      return falha(`O aceite gravado não confere com o texto que você leu (classificação, bebida ou texto). Recarregue a página e refaça o aceite.${p.publicar ? ' Nada foi publicado.' : aposAlteracoes ? ' As alterações já foram para análise.' : ''}`, true)
    }
  }
  if (p.publicar) {
    const { error } = await supabase.from('events').update({ status: 'published' } as never).eq('id', p.eventId).select('id').single()
    if (error) return { ok: false, erro: (error as { code?: string }).code === '42501' ? 'Refaça o aceite: a classificação ou a bebida mudou.' : 'Não foi possível enviar o evento. Tente de novo.' }
  }
  return { ok: true }
}
