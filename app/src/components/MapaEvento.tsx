import { useRef, useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { coordenadasValidas, ehApple, linksDeMapa, pecasDoMapa } from '../lib/mapaEvento'

const LARGURA = 768 // 3 peças de 256 px

function Pino() {
  return (
    <span aria-hidden="true" className="evv-pino">
      <svg viewBox="0 0 24 32" width="28" height="36"><path d="M12 1C6 1 1.5 5.4 1.5 11c0 7.5 10.5 20 10.5 20s10.5-12.5 10.5-20C22.5 5.4 18 1 12 1z" fill="var(--evento)" stroke="#fff" strokeWidth="1.5" /><circle cx="12" cy="11" r="4" fill="#fff" /></svg>
    </span>
  )
}

// Cartão do mapa: peças do OpenStreetMap com coordenadas válidas; sem elas, grade estilizada. Tocar abre a escolha do app.
export default function MapaEvento({ lat, lng, nome, endereco, consulta, mapaUrl }: {
  lat?: unknown; lng?: unknown; nome: string; endereco: string; consulta: string; mapaUrl: string
}) {
  const [aberta, setAberta] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const [falhou, setFalhou] = useState(false) // uma peça que não carrega (OSM fora do ar ou bloqueado): cai no cartão estilizado
  if (!endereco) return null // sem endereço nem cidade: fica só a linha "Local"
  const coords = coordenadasValidas(lat, lng)
  const mapa = coords && !falhou ? pecasDoMapa(coords.lat, coords.lng, 15) : null
  const links = linksDeMapa({ coords, consulta, nome, googleSemCoord: mapaUrl }, ehApple())
  const muda = (v: boolean) => {
    setAberta(v)
    if (!v) requestAnimationFrame(() => botao.current?.focus()) // Esc ou toque fora: o foco volta ao cartão
  }
  return (
    <div className="relative mx-5 my-4 max-w-[512px] lg:mx-0">
      <button
        ref={botao}
        type="button"
        onClick={() => muda(true)}
        aria-haspopup="dialog"
        aria-label={`Escolher aplicativo de mapa para ${nome}`}
        className="evv-mapa group block w-full overflow-hidden rounded-[20px] border border-border bg-card text-left focus-visible:outline-none focus-visible:shadow-ev-foco"
      >
        <span className="evv-mapa-vista" aria-hidden="true">
          {mapa ? (
            <span
              className="evv-mapa-pecas"
              style={{ width: LARGURA, transform: `translate(calc(50cqw - ${mapa.pinoX}px), calc(50cqh - ${mapa.pinoY}px))` }}
            >
              {mapa.pecas.map((p) => (
                <img key={`${p.x}/${p.y}`} src={p.url} alt="" width={256} height={256} loading="lazy" decoding="async" draggable={false} onError={() => setFalhou(true)} />
              ))}
            </span>
          ) : (
            <span className="evv-mapa-grade" />
          )}
          <span className="evv-mapa-tinta" />
          <Pino />
        </span>
        <span className="flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block break-words text-[15px] font-semibold leading-5">{nome}</span>
            <span className="block break-words text-[13px] leading-5 text-muted-foreground">{endereco}</span>
          </span>
          <span className="alvo-44 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-[13px] font-semibold text-background transition-transform duration-rapido group-hover:-translate-y-px motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
            Como chegar <I.ChevronDireita size={14} />
          </span>
        </span>
      </button>
      {mapa && (
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-2 top-2 rounded-full bg-card px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:shadow-ev-foco"
        >
          © OpenStreetMap<span className="sr-only"> (abre em nova aba)</span>
        </a>
      )}

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
                  className={cn('alvo-44 flex min-h-14 items-center gap-3 rounded-ev-xl border border-border bg-card px-4 text-base font-semibold transition-colors duration-rapido hover:bg-accent focus-visible:outline-none focus-visible:shadow-ev-foco motion-reduce:transition-none')}
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
    </div>
  )
}
