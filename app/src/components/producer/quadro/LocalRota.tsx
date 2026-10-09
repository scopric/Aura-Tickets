import { useEffect, useState, type ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import * as I from '@/components/icones/evokaa16'
import { linkApple, linkGoogle, linkWaze, temCoordenadas } from '../../../lib/quadroMapa'
import type { LocalCartao } from '../../../hooks/useCartao'

const linkRota = 'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-[var(--ev-tint-hover)] focus-visible:outline-none focus-visible:shadow-ev-foco sm:min-h-8'

/** Prévia do mapa: o Leaflet só é baixado quando há coordenadas e este bloco aparece */
function Mapa({ lat, lng }: { lat: number; lng: number }) {
  const [Comp, setComp] = useState<ComponentType<{ lat: number; lng: number }> | null>(null)
  const [falhou, setFalhou] = useState(false)
  useEffect(() => {
    let vivo = true
    import('./MapaCartao').then(m => { if (vivo) setComp(() => m.default) }).catch(() => { if (vivo) setFalhou(true) })
    return () => { vivo = false }
  }, [])
  if (falhou) return <p role="status" className="text-xs text-muted-foreground">Mapa indisponível agora. Os links de rota abaixo continuam funcionando.</p>
  if (!Comp) return <div role="status" className="grid h-44 place-items-center rounded-md bg-muted text-xs text-muted-foreground">Carregando o mapa…</div>
  return <Comp lat={lat} lng={lng} />
}

/** Local do cartão: texto, mapa (se houver coordenadas) e "Ir até lá" com Google Maps, Waze e Mapas da Apple */
export default function LocalRota({ local }: { local: LocalCartao }) {
  // O mapa só é baixado (Leaflet e imagens do OpenStreetMap) depois do clique: antes disso nada sai do navegador
  const [mostrar, setMostrar] = useState(false)
  const google = linkGoogle(local), waze = linkWaze(local), apple = linkApple(local)
  return (
    <div className="grid gap-2">
      {local.txt && <p className="break-words text-sm">{local.txt}</p>}
      {temCoordenadas(local) && (
        <>
          <p className="text-xs text-muted-foreground">{local.lat}, {local.lng}</p>
          {mostrar ? <Mapa lat={local.lat} lng={local.lng} /> : (
            <div><Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" onClick={() => setMostrar(true)}><I.Local aria-hidden="true" />Mostrar mapa</Button></div>
          )}
          <p className="text-[11px] text-muted-foreground">© OpenStreetMap contributors. O mapa vem do OpenStreetMap, que recebe o seu endereço IP.</p>
        </>
      )}
      {google && waze && apple && (
        <div role="group" aria-label="Ir até lá" className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><I.AbrirExterno aria-hidden="true" />Ir até lá</span>
          <a className={linkRota} href={google} target="_blank" rel="noopener noreferrer">Google Maps</a>
          <a className={linkRota} href={waze} target="_blank" rel="noopener noreferrer">Waze</a>
          <a className={linkRota} href={apple} target="_blank" rel="noopener noreferrer">Mapas da Apple</a>
        </div>
      )}
    </div>
  )
}
