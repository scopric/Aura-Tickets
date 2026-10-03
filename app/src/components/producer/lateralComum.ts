import * as I from '@/components/icones/evokaa16'
import type { DbEvent } from '../../hooks/useEvents'
import { dataPorVir } from '../../lib/eventoProdutor'
import type { Secao } from '../../lib/navegacaoProdutor'

// O que a lateral (Lateral.tsx) e a folha Menu do celular (FolhaMenu.tsx) compartilham: ícone de cada área e lista de eventos.

type Evento = DbEvent

export const ICONE: Record<Secao, I.IconeEvokaa> = {
  Topo: I.Inicio, Eventos: I.Eventos, Vendas: I.Ingressos, Público: I.Publico,
  Operação: I.Cronograma, Financeiro: I.Financeiro, Conta: I.Configuracoes,
}
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const VISIVEIS = 3 // eventos na lista da produtora

export function dataCurta(e: Evento) {
  const d = e.date ? new Date(`${e.date}T12:00:00`) : new Date(e.start_date)
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MES[d.getMonth()]}`
}

const quando = (e: Evento) => new Date(e.date ? `${e.date}T${e.time || '00:00:00'}-03:00` : e.start_date).getTime()

/** Eventos da lista da produtora: fixados primeiro (estrela), depois os próximos (sem cancelado), até 3 (lateral e folha Menu) */
export function eventosDaLista(eventos: Evento[], fixados: string[]) {
  const fix = fixados.map(id => eventos.find(e => e.id === id)).filter((e): e is Evento => !!e)
  const proximos = eventos
    .filter(e => !fixados.includes(e.id) && e.status !== 'cancelled' && dataPorVir(e))
    .sort((a, b) => quando(a) - quando(b))
  return [...fix, ...proximos].slice(0, VISIVEIS)
}
