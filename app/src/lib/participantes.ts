// Participantes do produtor: pedidos e ingressos que o banco já grava, agrupados por pedido. Funções puras (a tela só desenha).
// Só colunas que o produtor pode ler: CPF e telefone estão revogados (docs/sql/20261011) e nunca entram aqui.
import { normaliza } from './navegacaoProdutor'
import { toCsv } from './exportCsv'
import { forma } from './bordero'

export const ABAS = ['confirmados', 'pendentes', 'cancelados', 'convidados'] as const
export type Aba = (typeof ABAS)[number]
export const ROTULO_ABA: Record<Aba, string> = { confirmados: 'Confirmados', pendentes: 'Pendentes', cancelados: 'Cancelados', convidados: 'Convidados' }

export type Pedido = {
  id: string; status: string; customer_name: string | null; customer_email: string | null; total: number
  payment_method: string | null; created_at: string; event_id: string
}
export type Ingresso = {
  id: string; order_id: string; ticket_type_id: string; status: string; buyer_name: string | null; buyer_email: string | null
  price_paid: number; checked_in_at: string | null; created_at: string; ticket_types: { name: string } | null
}
export type Participante = Pedido & { ingressos: Ingresso[] }

/** Aba do pedido pelo status do banco; status desconhecido não aparece em aba nenhuma */
export function abaDoPedido(status: string): Exclude<Aba, 'convidados'> | null {
  if (status === 'paid') return 'confirmados'
  if (status === 'pending') return 'pendentes'
  if (status === 'cancelled' || status === 'refunded' || status === 'failed') return 'cancelados'
  return null
}

export function agrupar(pedidos: Pedido[], ingressos: Ingresso[]): Participante[] {
  const porPedido = new Map<string, Ingresso[]>()
  for (const t of ingressos) porPedido.set(t.order_id, [...(porPedido.get(t.order_id) ?? []), t])
  return pedidos.map(p => ({ ...p, ingressos: porPedido.get(p.id) ?? [] }))
}

export const entradasFeitas = (p: Participante) => p.ingressos.filter(t => t.checked_in_at).length

export type FiltroCheckin = 'todos' | 'feito' | 'nao'
export type Filtros = { aba: Aba; busca: string; tipo: string; checkin: FiltroCheckin }

export function filtrar(lista: Participante[], f: Filtros): Participante[] {
  const termo = normaliza(f.busca.trim())
  return lista.filter(p => {
    if (abaDoPedido(p.status) !== f.aba) return false
    if (f.tipo && !p.ingressos.some(t => t.ticket_type_id === f.tipo)) return false
    const feitas = entradasFeitas(p)
    if (f.checkin === 'feito' && feitas === 0) return false
    if (f.checkin === 'nao' && feitas > 0) return false
    if (!termo) return true
    return [p.customer_name, p.customer_email, ...p.ingressos.flatMap(t => [t.buyer_name, t.buyer_email])]
      .some(x => !!x && normaliza(x).includes(termo))
  })
}

export function resumo(lista: Participante[]) {
  const n = { confirmados: 0, pendentes: 0, cancelados: 0, entradas: 0, ingressos: 0 }
  for (const p of lista) {
    const aba = abaDoPedido(p.status)
    if (aba) n[aba]++
    if (aba === 'confirmados') { n.entradas += entradasFeitas(p); n.ingressos += p.ingressos.length }
  }
  return n
}

export type Marco = { chave: string; texto: string; quando: string | null }

/** Linha do tempo do pedido. O banco não grava a hora do pagamento: o marco "pago" sai sem hora (quando = null). */
export function linhaDoTempo(p: Participante): Marco[] {
  const marcos: Marco[] = [{ chave: 'criado', texto: 'Pedido criado', quando: p.created_at }]
  if (p.status === 'paid') marcos.push({ chave: 'pago', texto: 'Pagamento confirmado', quando: null })
  else if (p.status === 'refunded') marcos.push({ chave: 'estorno', texto: 'Pedido reembolsado', quando: null })
  else if (p.status === 'cancelled') marcos.push({ chave: 'cancelado', texto: 'Pedido cancelado', quando: null })
  else if (p.status === 'failed') marcos.push({ chave: 'falhou', texto: 'Pagamento não aprovado', quando: null })
  for (const t of [...p.ingressos].sort((a, b) => (a.checked_in_at ?? '').localeCompare(b.checked_in_at ?? ''))) {
    if (t.checked_in_at) marcos.push({ chave: `in-${t.id}`, texto: `Check-in: ${t.ticket_types?.name ?? 'ingresso'}${t.buyer_name ? `, ${t.buyer_name}` : ''}`, quando: t.checked_in_at })
  }
  return marcos
}

/** Data e hora de Brasília, igual na tela e no CSV */
export const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export const AVISO_CSV = 'ATENCAO: este arquivo contem dados pessoais (nome e e-mail) protegidos pela LGPD. Use so para o evento e nao compartilhe.'
export const COLUNAS_CSV = ['pedido', 'comprador', 'email', 'situacao', 'forma_de_pagamento', 'total', 'ingressos', 'entradas_feitas', 'criado_em']
export const SITUACAO: Record<string, string> = { paid: 'Confirmado', pending: 'Pendente', cancelled: 'Cancelado', refunded: 'Reembolsado', failed: 'Pagamento não aprovado' }

/** CSV do filtro atual: primeira linha é o aviso de dado pessoal; sem CPF nem telefone (nem existem nos dados) */
export function csvParticipantes(lista: Participante[]): string {
  const corpo = toCsv(lista.map(p => ({
    pedido: p.id, comprador: p.customer_name, email: p.customer_email, situacao: SITUACAO[p.status] ?? p.status,
    forma_de_pagamento: forma(p.payment_method), total: (Number(p.total) || 0).toFixed(2).replace('.', ','),
    ingressos: p.ingressos.map(t => t.ticket_types?.name ?? 'Ingresso').join(' | '), entradas_feitas: entradasFeitas(p), criado_em: quando(p.created_at),
  })), COLUNAS_CSV)
  return `﻿${AVISO_CSV}\r\n${corpo.slice(1)}`
}
