import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useProducerEvents } from './useEvents'
import { ehPeriodo, VENDIDO, type Periodo } from '../lib/inicioProdutor'
import { vendasPagas, faltaSegundoFator, janelaDoPeriodo, type VendasPagas } from '../lib/vendasPagas'
import { janelaAnterior } from '../lib/central'
import { lerNav, gravarNav, ULTIMO_EVENTO } from '../lib/navegacaoProdutor'

export const TIPOS = [
  { value: 'ritmo', label: 'Ritmo de vendas' },
  { value: 'portaria', label: 'Dia do evento' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'publico', label: 'Público e conversão' },
] as const
export type Tipo = (typeof TIPOS)[number]['value']
const ehTipo = (v: unknown): v is Tipo => TIPOS.some(t => t.value === v)

// ponytail: lembra só o último tipo e os filtros neste aparelho (localStorage via lerNav/gravarNav); visões salvas na conta ficam para depois
const MEMORIA = 'central'

// Falha de rede ou limite de 10 s viram erro com "Tentar de novo" (mesmo limite do Início)
async function comLimite<T>(f: (sinal: AbortSignal) => Promise<T>): Promise<T> {
  const ctl = new AbortController()
  const relogio = setTimeout(() => ctl.abort(), 10000)
  try { return await f(ctl.signal) } finally { clearTimeout(relogio) }
}

const contagem = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
  const r = await q
  if (r.error) throw r.error
  return r.count ?? 0
}

export type DadosVendas = { agora: number; atual: VendasPagas; anterior: VendasPagas | null; faltaFator: boolean }
export type DadosPublico = {
  iniciados: number; pagos: number; ingressos: number; ingressosAnterior: number | null
  porTipo: { id: string; nome: string; qtd: number }[] | null; faltaFator: boolean
}
export type DadosPortaria = {
  agora: number; lotes: { id: string; nome: string; vendidos: number; entraram: number }[]
  entradas: string[]; cortado: boolean; faltaFator: boolean
}

export function useCentral() {
  const { user } = useAuth()
  const [busca, setBusca] = useSearchParams()
  const eventosQ = useProducerEvents()
  const eventos = eventosQ.data ?? []

  const lembrado = (() => { try { return new URLSearchParams(lerNav(MEMORIA) ?? '') } catch { return new URLSearchParams() } })()
  // param presente (mesmo vazio) vale; só o que a URL não traz vem da lembrança
  const le = (k: string) => (busca.has(k) ? busca.get(k) : lembrado.get(k))
  const t = le('tipo'), p = le('periodo')
  const tipo: Tipo = ehTipo(t) ? t : 'ritmo'
  const periodo: Periodo = ehPeriodo(p) ? p : '30d'
  const comparar = le('comparar') !== '0' && periodo !== 'tudo'
  const evento = le('evento') || null
  const forma = le('forma') || null

  // evento do Dia do evento: o da URL; sem ele, o último usado; sem ele, o primeiro da lista
  const ids = eventos.map(e => e.id)
  const eventoPortaria = [evento, lerNav(ULTIMO_EVENTO)].find(x => x && ids.includes(x)) ?? ids[0] ?? null

  const definir = (k: string, v: string | null) => setBusca((prev: URLSearchParams) => {
    const n = new URLSearchParams(prev)
    n.set(k, v ?? '') // vazio na URL = "sem filtro" de propósito (apagar o param traria de volta o lembrado)
    return n
  }, { replace: true })

  useEffect(() => {
    const m = new URLSearchParams()
    for (const [k, v] of [['tipo', tipo], ['periodo', periodo], ['comparar', comparar ? '1' : '0'], ['evento', evento ?? ''], ['forma', forma ?? '']]) if (v) m.set(k, v)
    gravarNav(MEMORIA, m.toString())
  }, [tipo, periodo, comparar, evento, forma])

  const base = !!user?.id
  const eventoValido = evento && ids.includes(evento) ? evento : null

  // Ritmo e Dinheiro: somas do banco (RPC), do período e do anterior
  const vendasQ = useQuery<DadosVendas>({
    queryKey: ['central-vendas', user?.id, periodo, comparar, eventoValido],
    enabled: base && eventosQ.isSuccess && (tipo === 'ritmo' || tipo === 'dinheiro'),
    retry: 1,
    queryFn: () => comLimite(async sinal => {
      const agora = Date.now()
      const { de } = janelaDoPeriodo(periodo, agora)
      const ant = comparar ? janelaAnterior(periodo, agora) : null
      const [atual, anterior] = await Promise.all([
        vendasPagas({ de, eventId: eventoValido }, sinal),
        ant ? vendasPagas({ de: ant.de, ate: ant.ate, eventId: eventoValido }, sinal) : Promise.resolve(null),
      ])
      // zero vendas pode ser sessão sem 2FA concluído: o banco devolve zero sem erro
      const faltaFator = atual.pedidos === 0 && (anterior?.pedidos ?? 0) === 0 && (await faltaSegundoFator())
      return { agora, atual, anterior, faltaFator }
    }),
  })

  // Público e conversão: contagens no padrão da Visão geral do evento (head + count exato)
  const publicoQ = useQuery<DadosPublico>({
    queryKey: ['central-publico', user?.id, periodo, comparar, eventoValido],
    enabled: base && eventosQ.isSuccess && tipo === 'publico',
    retry: 1,
    queryFn: () => comLimite(async sinal => {
      const agora = Date.now()
      const { de } = janelaDoPeriodo(periodo, agora)
      const ant = comparar ? janelaAnterior(periodo, agora) : null
      // ponytail: builders do PostgREST tipados como any (o genérico do supabase-js não fecha com estes helpers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noEscopo = (q: any) => { const a = q.eq('events.producer_id', user!.id); return eventoValido ? a.eq('event_id', eventoValido) : a }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const janela = (q: any, ini: string | null, fim?: string) => { const a = ini ? q.gte('created_at', ini) : q; return fim ? a.lt('created_at', fim) : a }
      const ingressos = (ini: string | null, fim?: string) => janela(noEscopo(supabase.from('tickets').select('id, events!inner(producer_id)', { count: 'exact', head: true }).in('status', VENDIDO)), ini, fim).abortSignal(sinal)
      const tipos = eventoValido ? eventos.find(e => e.id === eventoValido)?.ticket_types ?? [] : null
      const [vendas, iniciados, ing, ingAnt, ...porTipo] = await Promise.all([
        vendasPagas({ de, eventId: eventoValido }, sinal),
        contagem(janela(noEscopo(supabase.from('orders').select('id, events!inner(producer_id)', { count: 'exact', head: true })), de).abortSignal(sinal)),
        contagem(ingressos(de)),
        ant ? contagem(ingressos(ant.de, ant.ate)) : Promise.resolve(null),
        ...(tipos ?? []).map(x => contagem(janela(supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('ticket_type_id', x.id).in('status', VENDIDO), de).abortSignal(sinal))),
      ])
      const zero = vendas.pedidos === 0 && iniciados === 0 && ing === 0
      return {
        iniciados, pagos: vendas.pedidos, ingressos: ing, ingressosAnterior: ingAnt,
        porTipo: tipos ? tipos.map((x, i) => ({ id: x.id, nome: x.name, qtd: porTipo[i] })) : null,
        faltaFator: zero && (await faltaSegundoFator()),
      }
    }),
  })

  // Dia do evento: por lote (vendidos x entraram, contagem exata) e a hora de cada entrada (até 1.000, o max_rows do PostgREST)
  const portariaQ = useQuery<DadosPortaria>({
    queryKey: ['central-portaria', user?.id, eventoPortaria],
    enabled: base && eventosQ.isSuccess && tipo === 'portaria' && !!eventoPortaria,
    retry: 1,
    queryFn: () => comLimite(async sinal => {
      const agora = Date.now()
      const id = eventoPortaria!
      const tipos = eventos.find(e => e.id === id)?.ticket_types ?? []
      const doTipo = (x: string) => supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('ticket_type_id', x).in('status', VENDIDO)
      const [lotes, linhas] = await Promise.all([
        Promise.all(tipos.map(async x => ({
          id: x.id, nome: x.name,
          vendidos: await contagem(doTipo(x.id).abortSignal(sinal)),
          entraram: await contagem(doTipo(x.id).not('checked_in_at', 'is', null).abortSignal(sinal)),
        }))),
        supabase.from('tickets').select('checked_in_at', { count: 'exact' }).eq('event_id', id).in('status', VENDIDO)
          .not('checked_in_at', 'is', null).order('checked_in_at').limit(1000).abortSignal(sinal),
      ])
      if (linhas.error) throw linhas.error
      const entradas = ((linhas.data ?? []) as unknown as { checked_in_at: string }[]).map(x => x.checked_in_at)
      const faltaFator = lotes.every(l => l.vendidos === 0) && (await faltaSegundoFator())
      return { agora, lotes, entradas, cortado: (linhas.count ?? 0) > entradas.length, faltaFator }
    }),
  })

  return { tipo, periodo, comparar, evento: eventoValido, forma, eventoPortaria, definir, eventos, eventosQ, vendasQ, publicoQ, portariaQ }
}
