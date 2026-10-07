// Contas da carteira e do ingresso (V10a): .ics gerado no navegador, link de mapa e separação Próximos/Anteriores.
// Sem dependência; só dados que o ingresso já tem (nada de campo inventado).
import type { DbTicket } from '../hooks/useCheckout'
import { corSorteada, ehHex } from './corEvento'

type Evento = NonNullable<DbTicket['events']>

const dois = (n: number) => String(n).padStart(2, '0')
const AAAAMMDD = /^(\d{4})-(\d{2})-(\d{2})/
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Cor do evento: a salva (accent_color) ou o sorteio estável pelo id (a mesma regra do EventoCapa)
export const corDoEvento = (e: Pick<Evento, 'id' | 'accent_color'>) => (ehHex(e.accent_color) ? e.accent_color : corSorteada(e.id))

// "22h" ou "22h30"
export function horaCurta(hora?: string | null): string | null {
  const m = hora?.match(/^(\d{2}):(\d{2})/)
  return m ? `${+m[1]}h${m[2] === '00' ? '' : m[2]}` : null
}

// "Sáb, 12 dez" (sem fuso: a data do evento é a do calendário, não um instante)
export function dataCurta(data?: string | null): string | null {
  const m = data?.match(AAAAMMDD)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return `${SEMANA[d.getDay()]}, ${d.getDate()} ${MES[d.getMonth()]}`
}

// O evento acontece no horário de Brasília (UTC-3 o ano todo: o Brasil não tem horário de verão desde 2019). Datas e horas
// do banco são desse relógio, e "hoje" também, qualquer que seja o fuso do aparelho.
const BRASILIA = 3 * 3_600_000
export const hojeISO = (d = new Date()) => new Date(d.getTime() - BRASILIA).toISOString().slice(0, 10)

// 0 = hoje; negativo = já passou; null = sem data
export function diasAte(data: string | null | undefined, hoje = hojeISO()): number | null {
  const [a, b] = [data, hoje].map(s => s?.match(AAAAMMDD))
  if (!a || !b) return null
  const dia = (m: RegExpMatchArray) => Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86_400_000
  return Math.round(dia(a) - dia(b))
}

// Instante em que o evento começa (data + hora de Brasília); null sem data ou sem hora
export function inicioDoEvento(data?: string | null, hora?: string | null): Date | null {
  const d = data?.match(AAAAMMDD)
  const h = hora?.match(/^(\d{2}):(\d{2})/)
  return d && h ? new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], +h[1], +h[2]) + BRASILIA) : null
}

// "HH:MM:SS" (ou "HH:MM" quando a tela atualiza só a cada minuto) e a leitura para quem usa leitor de tela
export function formatarFalta(ms: number, semSegundos = false): string {
  const t = Math.max(0, Math.floor(ms / 1000))
  const [h, m, s] = [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60]
  return semSegundos ? `${dois(h)}:${dois(m)}` : `${dois(h)}:${dois(m)}:${dois(s)}`
}
export function leituraFalta(ms: number): string {
  const [h, m] = [Math.floor(ms / 3_600_000), Math.floor((ms % 3_600_000) / 60_000)]
  const partes = [h && `${h} hora${h > 1 ? 's' : ''}`, m && `${m} minuto${m > 1 ? 's' : ''}`].filter(Boolean)
  return `Começa em ${partes.length ? partes.join(' e ') : 'menos de um minuto'}`
}

export const quandoFalta = (dias: number) => (dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `Em ${dias} dias`)

// ---- Próximos / Anteriores --------------------------------------------------------------------------------------
// Próximo = ingresso ativo e evento que ainda não acabou. Com end_date (instante real, timestamptz) vale ele; sem, o
// evento "dura" até as 12h do dia seguinte (evento noturno passa da meia-noite e o QR não pode sumir na porta).
export function ehProximo(t: DbTicket, agora = Date.now()): boolean {
  if (t.status !== 'active') return false
  const dia = t.events?.date?.match(AAAAMMDD)
  const fim = t.events?.end_date ? Date.parse(t.events.end_date) : dia ? Date.UTC(+dia[1], +dia[2] - 1, +dia[3] + 1, 12) + BRASILIA : NaN
  return Number.isNaN(fim) || agora < fim
}

// Por que o QR deste ingresso não vale (null = vale): ingresso que não está ativo, evento cancelado ou já encerrado.
// "Encerrado" só vale com end_date (o cadastro do evento não tem esse campo): sem ele o QR fica e o servidor valida na portaria,
// senão o evento de vários dias perderia o QR no 2º dia.
// Aviso do evento em si: cancelado ou tirado do ar (rascunho). A leitura do evento segue liberada a quem tem ingresso (RLS "Quem tem ingresso lê o evento").
export function motivoEvento(e?: { status?: string | null } | null): string | null {
  return e?.status === 'cancelled' ? 'Evento cancelado' : e?.status === 'draft' ? 'Evento fora do ar' : null
}
const MOTIVO_STATUS: Record<string, string> = {
  used: 'Ingresso já usado', cancelled: 'Ingresso cancelado', transferred: 'Ingresso transferido', refunded: 'Ingresso reembolsado',
}
export function motivoSemQr(t: DbTicket, agora = Date.now()): string | null {
  if (t.status !== 'active') return MOTIVO_STATUS[t.status] ?? 'Ingresso indisponível'
  const aviso = motivoEvento(t.events)
  if (aviso) return aviso
  return t.events?.end_date && agora >= Date.parse(t.events.end_date) ? 'Evento encerrado' : null
}

export interface GrupoIngressos { id: string; evento: Evento | undefined; ingressos: DbTicket[] }

// Um grupo por evento, em ordem cronológica (ou do mais recente ao mais antigo, para os anteriores)
export function agruparPorEvento(tickets: DbTicket[], recentePrimeiro = false): GrupoIngressos[] {
  const mapa = new Map<string, GrupoIngressos>()
  for (const t of tickets) {
    const id = t.events?.id ?? t.event_id
    const g = mapa.get(id) ?? { id, evento: t.events, ingressos: [] }
    g.ingressos.push(t)
    mapa.set(id, g)
  }
  const chave = (g: GrupoIngressos) => `${g.evento?.date ?? '9999-99-99'}${g.evento?.time ?? ''}`
  const lista = [...mapa.values()].sort((a, b) => chave(a).localeCompare(chave(b)))
  return recentePrimeiro ? lista.reverse() : lista
}

// ---- Como chegar ------------------------------------------------------------------------------------------------
export const enderecoDoEvento = (e?: Evento) =>
  [e?.venue_name, e?.venue_address, e?.venue_city, e?.venue_state].filter(Boolean).join(', ')

// ponytail: um link só (Google Maps abre no app ou no navegador em qualquer aparelho); Apple Maps separado se pedirem
export const linkMapa = (endereco: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`

// ---- Adicionar à agenda (.ics, RFC 5545) ------------------------------------------------------------------------
const escapar = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n')

// Linhas com mais de 75 bytes continuam na seguinte, começando com um espaço (sem partir um caractere ao meio)
function dobrar(linha: string): string {
  const enc = new TextEncoder()
  const partes: string[] = []
  let atual = ''
  let bytes = 0
  for (const c of linha) {
    const n = enc.encode(c).length
    if (bytes + n > (partes.length ? 74 : 75)) { partes.push(atual); atual = ''; bytes = 0 }
    atual += c
    bytes += n
  }
  partes.push(atual)
  return partes.join('\r\n ')
}

export interface DadosAgenda { id: string; titulo: string; data: string | null; hora?: string | null; fim?: string | null; local?: string }

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')

// null sem data. Com hora, início e fim em UTC (o instante certo em qualquer fuso); o fim é o end_date do evento, se
// existir e vier depois do início (o banco não guarda duração). Sem hora vira evento de dia inteiro (sem DTEND, vale 1 dia).
export function gerarIcs(d: DadosAgenda, agora = new Date()): string | null {
  const dia = d.data?.match(AAAAMMDD)
  if (!dia) return null
  const inicio = inicioDoEvento(d.data, d.hora)
  const fim = d.fim ? new Date(d.fim) : null
  const quando = inicio
    ? [`DTSTART:${utc(inicio)}`, ...(fim && fim > inicio ? [`DTEND:${utc(fim)}`] : [])]
    : [`DTSTART;VALUE=DATE:${dia[1]}${dia[2]}${dia[3]}`]
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Evokaa//Ingresso//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${d.id}@evokaa`, `DTSTAMP:${utc(agora)}`, ...quando,
    `SUMMARY:${escapar(d.titulo)}`,
    ...(d.local ? [`LOCATION:${escapar(d.local)}`] : []),
    // lembrete 2 h antes (só com hora: evento de dia inteiro não tem "antes" que valha)
    ...(inicio ? ['BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT2H', `DESCRIPTION:${escapar(`${d.titulo} começa em 2 horas`)}`, 'END:VALARM'] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ].map(dobrar).join('\r\n') + '\r\n'
}

// Baixa um arquivo pelo navegador (Blob). No iPhone o Safari oferece abrir no Calendário (.ics) ou salvar a imagem (.png).
function baixarBlob(blob: Blob, nome: string, ext: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'evento'}.${ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const baixarIcs = (ics: string, nome: string) => baixarBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), nome, 'ics')

// ---- Salvar o QR como imagem ---------------------------------------------------------------------------------------
// Desenha o <svg> do QR que já está na tela num PNG de 640 px com fundo branco. Com compartilhamento de arquivo (iPhone e
// Android) abre a folha "Salvar imagem"; sem ele, baixa o arquivo. Cancelar a folha não é erro.
export async function salvarQrPng(svg: SVGSVGElement, nome: string) {
  const px = 640
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
  await img.decode()
  const c = document.createElement('canvas')
  c.width = c.height = px
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, px, px)
  g.drawImage(img, 0, 0, px, px)
  const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/png'))
  if (!blob) throw new Error('png')
  const arquivo = new File([blob], `${nome}.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo] }); return } catch (e) { if ((e as Error).name === 'AbortError') return }
  }
  baixarBlob(blob, nome, 'png')
}

// ---- "Não vejo meu ingresso" ---------------------------------------------------------------------------------------
export const ASSUNTO_INGRESSO = 'Não recebi ou não acho meu ingresso' // rótulo do assunto do chat (docs/sql/20261001_chat.sql)
// Pede ao Evo (EvoHub escuta `evo:suporte`) que abra a janela de suporte já no formulário desse assunto
export const abrirAjudaIngresso = () => window.dispatchEvent(new CustomEvent('evo:suporte', { detail: { assunto: ASSUNTO_INGRESSO } }))

// Suporte sobre um pedido: abre o formulário já com o número do pedido na mensagem
export const ASSUNTO_PAGAMENTO = 'Pagamento: cobrança, Pix ou cartão' // docs/sql/20261001_chat.sql
export const abrirAjudaPedido = (pedidoId: string, pago: boolean) => window.dispatchEvent(new CustomEvent('evo:suporte', {
  detail: { assunto: pago ? ASSUNTO_INGRESSO : ASSUNTO_PAGAMENTO, texto: `Pedido #${pedidoId.slice(0, 8).toUpperCase()} (código completo: ${pedidoId}): ` },
}))
