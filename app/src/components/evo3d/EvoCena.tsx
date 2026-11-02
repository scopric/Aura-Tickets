import { useEffect, useRef } from 'react'
import { motivoDoPoster } from './gate'
import modelo from './evo-web.glb?url'
import marca from './marca.png?url'
import marcaTexto from './marca-texto.png?url'
import poster from './evo-3d-poster.webp?url'
import posterRetrato from './evo-3d-poster-retrato.webp?url'
import './evo3d.css'

/** Evo 3D com poster de reserva (DESIGN-SYSTEM §8). O poster é o padrão; a cena só monta se o gate liberar e
 *  cruza por opacidade quando o primeiro quadro sai. O three vem por import() dinâmico: chunk próprio, só nesta rota. */
export default function EvoCena({ className = '' }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host || motivoDoPoster() !== null) return
    let vivo = true, destruir = () => {}
    import('./cena').then(async ({ montar }) => {
      const d = await montar(host, { modelo, marca, marcaTexto })
      if (vivo) destruir = d; else d() // desmontou enquanto carregava (StrictMode monta duas vezes)
    }).catch(e => console.warn('Evo: cena não carregou, fica o poster', e))
    return () => { vivo = false; destruir() }
  }, [])

  return (
    <div ref={hostRef} className={`evo3d ${className}`} data-testid="evo3d">
      <picture>
        <source media="(max-aspect-ratio: 3/4)" srcSet={posterRetrato} />
        <img src={poster} alt="Evo, mascote da Evokaa" fetchPriority="high" /> {/* maior elemento da primeira tela da Home (LCP) */}
      </picture>
    </div>
  )
}
