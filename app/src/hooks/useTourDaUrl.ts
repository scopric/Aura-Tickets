import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { tourDaRota } from '../lib/tours'
import { useCamada } from '../lib/camadas'
import { useRegistrarTour } from './useTourLog'

// Tour aberto por ?tour=<id> (ProducerLayout e AppLayout). `fim` vai no onFim do <Tour>: grava tour:<id>, tira só o
// parâmetro `tour` da URL e devolve o foco ao h1 da página (`paginaRef`), depois que o Tour tira o inert do #root.
// ?tour= que não existe ou não é desta tela também sai da URL. O véu do tour cobriria o aviso de cookies e o da Política
// (que não receberiam clique): com uma camada da V9a aberta o tour espera, e o ?tour= válido fica na URL até ela fechar.
export function useTourDaUrl(paginaRef: RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  const [params, setSearchParams] = useSearchParams()
  const registrar = useRegistrarTour()
  const tourId = params.get('tour')
  const camada = useCamada()
  const daUrl = tourDaRota(tourId, pathname)
  const tour = camada === null ? daUrl : null
  const tirarParametro = useCallback(
    () => setSearchParams((p: URLSearchParams) => { const n = new URLSearchParams(p); n.delete('tour'); return n }, { replace: true }),
    [setSearchParams])
  useEffect(() => { if (tourId && !daUrl) tirarParametro() }, [tourId, daUrl, tirarParametro])
  const focar = useRef(false)
  useEffect(() => {
    if (tour || !focar.current) return
    focar.current = false
    const h1 = paginaRef.current?.querySelector('h1')
    if (h1) { h1.tabIndex = -1; h1.focus() }
  }, [tour, paginaRef])
  const fim = (puladas: boolean) => {
    void registrar(`tour:${tourId}`, { skipped: puladas })
    focar.current = true
    tirarParametro()
  }
  return { tour, tourId, fim }
}
