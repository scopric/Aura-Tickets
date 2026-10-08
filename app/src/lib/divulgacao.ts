// Links de divulgação do produtor: link público do evento + UTM, e a lista dos links criados (guardada no navegador).
// Funções puras (a tela só desenha). O pedido ainda não grava a origem: o UTM só chega ao Google Analytics.
import { refDoEvento, situacaoEvento } from './eventoProdutor'
import { siteUrl } from './appHost'
import { toCsv } from './exportCsv'

export const CANAIS = [
  { id: 'instagram', rotulo: 'Instagram', source: 'instagram', medium: 'social' },
  { id: 'whatsapp', rotulo: 'WhatsApp', source: 'whatsapp', medium: 'mensagem' },
  { id: 'email', rotulo: 'E-mail', source: 'email', medium: 'email' },
  { id: 'cartaz', rotulo: 'Cartaz/QR', source: 'cartaz', medium: 'qr' },
  { id: 'outro', rotulo: 'Outro', source: 'outro', medium: 'link' },
] as const
export type CanalId = (typeof CANAIS)[number]['id']
export const canalDe = (id: string) => CANAIS.find(c => c.id === id)

export const MAX_CAMPANHA = 40
export const MAX_LISTA = 30

/** Minúscula, sem acento, só [a-z0-9], hífen no lugar do resto, sem hífen nas pontas, até 40 caracteres */
export function normalizaCampanha(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, MAX_CAMPANHA).replace(/-+$/, '')
}

/** Só evento no ar (publicado e aprovado) tem página pública */
export const temLinkPublico = (e: { status: string; approval_status?: string | null; rejection_reason?: string | null }) =>
  situacaoEvento(e) === 'Publicado'

/** Endereço público do evento, sem UTM */
export const linkDoEvento = (e: { id: string; slug?: string | null; visibility?: string | null }) =>
  siteUrl(`/event/${encodeURIComponent(refDoEvento(e))}`)

/** Link com utm_source/medium/campaign. URL + URLSearchParams: o texto da campanha nunca vira parâmetro extra. Campanha vazia não entra. */
export function linkComUtm(base: string, canal: CanalId, campanha: string): string {
  const c = canalDe(canal) ?? CANAIS[CANAIS.length - 1]
  const url = new URL(base)
  url.searchParams.set('utm_source', c.source)
  url.searchParams.set('utm_medium', c.medium)
  const camp = normalizaCampanha(campanha)
  if (camp) url.searchParams.set('utm_campaign', camp)
  return url.toString()
}

export type LinkSalvo = { id: string; eventId: string; evento: string; canal: CanalId; campanha: string; url: string; criadoEm: string }

const chaveLista = (userId: string) => `evk.divulgacao.${userId}`

/** Lê a lista do usuário; qualquer coisa fora do formato é descartada (o navegador guarda texto livre) */
export function lerLinks(userId: string): LinkSalvo[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(chaveLista(userId)) ?? '[]')
    if (!Array.isArray(v)) return []
    return v.filter((x): x is LinkSalvo =>
      !!x && typeof x === 'object' && ['id', 'eventId', 'evento', 'canal', 'campanha', 'url', 'criadoEm'].every(k => typeof (x as Record<string, unknown>)[k] === 'string')
      && canalDe((x as LinkSalvo).canal) !== undefined && (x as LinkSalvo).url.startsWith(siteUrl('/event/'))).slice(0, MAX_LISTA)
  } catch { return [] }
}

/** Grava a lista; devolve false se o navegador não deixar (modo privado, cheio) */
export function gravarLinks(userId: string, lista: LinkSalvo[]): boolean {
  try { localStorage.setItem(chaveLista(userId), JSON.stringify(lista.slice(0, MAX_LISTA))); return true } catch { return false }
}

/** Link novo no topo; o mesmo endereço não repete (sobe para o topo); até 30 */
export const comLinkNovo = (lista: LinkSalvo[], novo: LinkSalvo): LinkSalvo[] =>
  [novo, ...lista.filter(l => l.url !== novo.url)].slice(0, MAX_LISTA)

/** Copia com a API do navegador; sem ela (ou sem permissão) cai no execCommand. false se nada funcionou. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true } catch { /* tenta o plano B */ }
  try {
    const campo = document.createElement('textarea')
    campo.value = texto
    campo.setAttribute('readonly', '')
    campo.style.position = 'fixed'
    campo.style.opacity = '0'
    document.body.appendChild(campo)
    campo.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(campo)
    return ok
  } catch { return false }
}

/** Baixa um arquivo (blob ou data URL) com este nome */
export function baixarArquivo(nome: string, conteudo: Blob | string) {
  const href = typeof conteudo === 'string' ? conteudo : URL.createObjectURL(conteudo)
  const a = document.createElement('a')
  a.href = href
  a.download = nome
  a.style.visibility = 'hidden'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  if (typeof conteudo !== 'string') setTimeout(() => URL.revokeObjectURL(href), 1000) // revogar na hora cancela o download em alguns navegadores
}

/** Faixa de abas da área, igual nas quatro telas */
export const ABAS_DIVULGACAO = [
  { to: '/producer/divulgacao', label: 'Links e QR' },
  { to: '/producer/afiliados', label: 'Afiliados' },
  { to: '/producer/banners', label: 'Banners' },
  { to: '/producer/lista-interesse', label: 'Lista de interesse' },
]

export const AVISO_CSV_INTERESSE = 'ATENCAO: este arquivo contem dados pessoais (nome, e-mail e cidade) de pessoas que pediram aviso do evento, protegidos pela LGPD. Use so para avisar sobre o evento e nao compartilhe.'
export const COLUNAS_CSV_INTERESSE = ['nome', 'email', 'cidade', 'evento', 'inscricao', 'avisado_em']

/** CSV da lista de interesse como a tela mostra (nome, e-mail e cidade vêm nulos de quem não consentiu). Primeira linha: aviso de dado pessoal. */
export function csvInteressados(lista: { full_name: string | null; email: string | null; city: string | null; event_title: string; created_at: string; notified_at: string | null }[]): string {
  const corpo = toCsv(lista.map(i => ({
    nome: i.full_name, email: i.email, cidade: i.city, evento: i.event_title,
    inscricao: i.created_at.slice(0, 10), avisado_em: i.notified_at?.slice(0, 10) ?? '',
  })), COLUNAS_CSV_INTERESSE)
  return `﻿${AVISO_CSV_INTERESSE}\r\n${corpo.slice(1)}`
}

/** O link guardado ainda serve: o evento é do produtor, está no ar e o endereço continua sendo o dele */
export const linkGuardadoVale = (l: LinkSalvo, eventos: { id: string; slug?: string | null; visibility?: string | null; status: string; approval_status?: string | null; rejection_reason?: string | null }[]) => {
  const e = eventos.find(x => x.id === l.eventId)
  return !!e && temLinkPublico(e) && l.url.startsWith(`${linkDoEvento(e)}?`)
}
