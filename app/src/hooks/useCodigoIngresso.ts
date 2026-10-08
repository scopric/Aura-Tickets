import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { apagarLista, codigoAgora, guardarLista, horasRestantes, lerLista, listaDaResposta, type ListaDeCodigos } from '../lib/codigoIngresso'

// Ao abrir o QR e ao voltar para a aba a lista é pedida de novo (o relógio do aparelho pode ter mudado desde a última vez); com a tela
// aberta, só renova se faltarem menos de 6 h (a lista cobre 12 h).
const RENOVAR_COM_MENOS_DE_H = 6
const DERIVA_MAX_MS = 5_000 // relógio do aparelho pulou mais que isso com a tela aberta: pede a lista de novo (o desvio medido ficou velho)
type Resultado = 'ok' | 'sem-rede' | 'falha' | 'indisponivel'
const emVoo = new Map<string, Promise<Resultado>>() // duas telas pedindo o mesmo ingresso fazem uma chamada só

export type EstadoQr = 'carregando' | 'ok' | 'sem-rede' | 'sem-lista' | 'vencida' | 'falha' | 'indisponivel'

async function buscar(donoId: string, ingressoId: string): Promise<Resultado> {
  const antes = Date.now()
  try {
    const { data, error } = await supabase.functions.invoke('ingresso-codigo', { body: { ticketId: ingressoId } })
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status
      if (status === 403) { apagarLista(donoId, ingressoId); return 'indisponivel' } // não é seu ou não está ativo
      // 401 (sessão vencida), 429 e 5xx NÃO apagam a lista: o QR guardado segue valendo; sem status é a rede
      return status === undefined ? 'sem-rede' : 'falha'
    }
    const lista = listaDaResposta(data, (antes + Date.now()) / 2) // meio da viagem: erra menos o relógio do servidor
    if (!lista) return 'falha'
    guardarLista(donoId, ingressoId, lista)
    return 'ok'
  } catch { return 'sem-rede' }
}

/**
 * O QR dinâmico de um ingresso. `ativo` = o QR está sendo mostrado (só então chama a função, que marca o ingresso como migrado:
 * abrir "Meus ingressos" sem mostrar o QR não migra nada). Sem internet, usa a lista guardada enquanto ela valer.
 */
export function useCodigoIngresso(donoId: string, ingressoId: string, ativo = true) {
  const [lista, setLista] = useState<ListaDeCodigos | null>(() => lerLista(donoId, ingressoId))
  const [fim, setFim] = useState<'buscando' | Resultado>('buscando')
  const [agora, setAgora] = useState(() => Date.now())
  const base = useRef(Date.now() - performance.now()) // relógio de parede menos o monotônico: muda se o aparelho acertar a hora

  const atualizar = useCallback((forcar: boolean) => {
    const atual = lerLista(donoId, ingressoId)
    if (!forcar && atual && horasRestantes(atual, Date.now()) >= RENOVAR_COM_MENOS_DE_H) { setLista(atual); return }
    const k = `${donoId}.${ingressoId}`
    const p = emVoo.get(k) ?? buscar(donoId, ingressoId).finally(() => emVoo.delete(k))
    emVoo.set(k, p)
    void p.then(r => { base.current = Date.now() - performance.now(); setLista(lerLista(donoId, ingressoId)); setFim(r) })
  }, [donoId, ingressoId])

  useEffect(() => {
    if (!ativo) return
    setLista(lerLista(donoId, ingressoId)) // outro ingresso no mesmo componente: não herda o estado do anterior
    setFim('buscando')
    atualizar(true)
    const aoVoltar = () => { if (document.visibilityState === 'visible') atualizar(true) }
    document.addEventListener('visibilitychange', aoVoltar)
    const relogio = setInterval(() => {
      const t = Date.now()
      if (Math.abs(t - performance.now() - base.current) > DERIVA_MAX_MS) { base.current = t - performance.now(); atualizar(true) }
      setAgora(t)
    }, 1000)
    const confere = setInterval(() => atualizar(false), 60_000) // a lista pode ter encostado no limite com a tela aberta
    return () => { document.removeEventListener('visibilitychange', aoVoltar); clearInterval(relogio); clearInterval(confere) }
  }, [ativo, atualizar, donoId, ingressoId])

  const vez = lista ? codigoAgora(lista, agora) : null
  const estado: EstadoQr = vez ? (fim === 'sem-rede' ? 'sem-rede' : 'ok')
    : fim === 'indisponivel' ? 'indisponivel'
    : fim === 'buscando' ? 'carregando'
    : fim === 'falha' ? 'falha'
    : lista ? 'vencida' : 'sem-lista' // sem-rede: tinha lista (venceu) ou nunca teve
  return { estado, qr: vez?.qr ?? null, restanteS: vez ? Math.ceil(vez.restanteMs / 1000) : 0, horas: lista ? horasRestantes(lista, agora) : 0, tentarDeNovo: () => { setFim('buscando'); atualizar(true) } }
}
