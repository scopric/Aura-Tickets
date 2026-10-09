import { useRef, useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { coordenadasValidas, ehApple, linksDeMapa } from '../lib/mapaEvento'

// Pílula "Abrir no mapa" (fica na linha Local): abre a folha com Apple Mapas, Google Maps e Waze, na ordem da plataforma.
export default function MapaEvento({ lat, lng, nome, consulta, mapaUrl }: {
  lat?: unknown; lng?: unknown; nome: string; consulta: string; mapaUrl: string
}) {
  const [aberta, setAberta] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const links = linksDeMapa({ coords: coordenadasValidas(lat, lng), consulta, nome, googleSemCoord: mapaUrl }, ehApple())
  const muda = (v: boolean) => {
    setAberta(v)
    if (!v) requestAnimationFrame(() => botao.current?.focus()) // Esc ou toque fora: o foco volta à pílula
  }
  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => muda(true)}
        aria-haspopup="dialog"
        className="alvo-44 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold transition-colors duration-rapido hover:bg-[var(--ev-tint-hover)] focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none"
      >
        <I.Local size={16} aria-hidden="true" />
        Abrir no mapa
      </button>

      <Drawer open={aberta} onOpenChange={muda}>
        <DrawerContent className="mx-auto max-w-xl">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl">Abrir no mapa</DrawerTitle>
            <DrawerDescription className="sr-only">Escolha o aplicativo para ver o caminho até {nome}</DrawerDescription>
          </DrawerHeader>
          <ul className="space-y-2 px-4 pb-8">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => muda(false)}
                  className="alvo-44 flex min-h-14 items-center gap-3 rounded-ev-xl border border-border bg-card px-4 text-base font-semibold transition-colors duration-rapido hover:bg-accent focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none"
                >
                  <I.Local size={20} aria-hidden="true" />
                  <span className="flex-1">{l.nome}<span className="sr-only"> (abre em nova aba)</span></span>
                  <I.AbrirExterno size={16} className="text-muted-foreground" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </DrawerContent>
      </Drawer>
    </>
  )
}
