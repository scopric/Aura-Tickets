import { useSearchParams } from 'react-router-dom'
import { gravarNav, lerNav, ULTIMO_EVENTO } from '../lib/navegacaoProdutor'

/**
 * Evento da tela do produtor: vale o `?eventId=` da URL; sem ele, o último evento usado (lembrado em evk.nav.*).
 * Só vale id que está em `ids` (evento apagado ou lista ainda carregando dá null: a tela usa o seu padrão).
 * Trocar grava na URL (replace), então a lateral acompanha o evento e o link da tela pode ser compartilhado.
 */
export function useEventoDaUrl(ids: string[]) {
  const [params, setParams] = useSearchParams()
  const id = [params.get('eventId'), lerNav(ULTIMO_EVENTO)].find(x => x && ids.includes(x)) ?? null
  const trocar = (novo: string | null) => {
    setParams((p: URLSearchParams) => {
      const n = new URLSearchParams(p)
      if (novo) n.set('eventId', novo); else n.delete('eventId')
      return n
    }, { replace: true })
    if (novo) gravarNav(ULTIMO_EVENTO, novo)
  }
  return [id, trocar] as const
}
