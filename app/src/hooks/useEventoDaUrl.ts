import { useSearchParams } from 'react-router-dom'
import { gravarNav, lerNav, ULTIMO_EVENTO } from '../lib/navegacaoProdutor'

/**
 * Evento da tela do produtor: vale o `?eventId=` da URL; sem ele, o último evento usado (lembrado em evk.nav.*).
 * Só vale id que está em `ids` (evento apagado ou lista ainda carregando dá null: a tela usa o seu padrão).
 * Trocar grava na URL (replace), então a lateral acompanha o evento e o link da tela pode ser compartilhado.
 */
export function useEventoDaUrl(ids: string[]) {
  const [daUrl, trocarNaUrl] = useFiltroEvento()
  const id = [daUrl, lerNav(ULTIMO_EVENTO)].find(x => x && ids.includes(x)) ?? null
  const trocar = (novo: string | null) => {
    trocarNaUrl(novo)
    if (novo) gravarNav(ULTIMO_EVENTO, novo)
  }
  return [id, trocar] as const
}

/**
 * Filtro por evento das telas de lista (V4a2): vale só o `?eventId=`; sem ele a tela mostra todos os eventos
 * (aqui não cai no último usado: a lateral da produtora leva a tela sem `?eventId=` de propósito).
 */
export function useFiltroEvento() {
  const [params, setParams] = useSearchParams()
  const trocar = (novo: string | null) =>
    setParams((p: URLSearchParams) => {
      const n = new URLSearchParams(p)
      if (novo) n.set('eventId', novo); else n.delete('eventId')
      return n
    }, { replace: true })
  return [params.get('eventId') || null, trocar] as const
}

/** Itens do evento. Sem evento, a lista toda */
export const doEvento = <T extends { event_id: string | null }>(lista: T[], id: string | null): T[] =>
  id ? lista.filter(x => x.event_id === id) : lista
