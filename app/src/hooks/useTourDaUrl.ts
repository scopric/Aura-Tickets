import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { tourDaRota } from '../lib/tours'
import { useRegistrarTour } from './useTourLog'

// Tour aberto por ?tour=<id> (ProducerLayout e AppLayout). `fim` vai no onFim do <Tour>: grava tour:<id>, tira só o
// parâmetro `tour` da URL e devolve o foco ao h1 da página (`paginaRef`), depois que o Tour tira o inert do #root.
// ?tour= que não existe ou não é desta tela também sai da URL.
export function useTourDaUrl(paginaRef: RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()
  const [params, setSearchParams] = useSearchParams()
  const registrar = useRegistrarTour()
  const tourId = params.get('tour')
  const tour = tourDaRota(tourId, pathname)
  const tirarParametro = useCallback(
    () => setSearchParams((p: URLSearchParams) => { const n = new URLSearchParams(p); n.delete('tour'); return n }, { replace: true }),
    [setSearchParams])
  useEffect(() => { if (tourId && !tour) tirarParametro() }, [tourId, tour, tirarParametro])
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
