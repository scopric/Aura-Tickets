import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface Destino { id: string; name: string }

// Alternativa ao arrastar (celular, teclado, leitor de tela): Subir, Descer e Para coluna. Alvo de 44 px.
export default function MenuMover({ titulo, destinos, podeSubir, podeDescer, ordenavel, onSubir, onDescer, onPara }: {
  titulo: string
  destinos: Destino[]
  podeSubir: boolean
  podeDescer: boolean
  /** Subir/Descer só existem quando a ordem é do cartão (modo novo) */
  ordenavel: boolean
  onSubir: () => void
  onDescer: () => void
  onPara: (colunaId: string) => void
}) {
  const item = 'min-h-11 sm:min-h-8'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 text-muted-foreground hover:bg-foreground/5 hover:text-foreground" aria-label={`Mover ${titulo}`}>
          <I.Mais aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ordenavel && (
          <>
            <DropdownMenuItem className={item} disabled={!podeSubir} onSelect={onSubir}><I.Sobe aria-hidden="true" />Subir</DropdownMenuItem>
            <DropdownMenuItem className={item} disabled={!podeDescer} onSelect={onDescer}><I.Desce aria-hidden="true" />Descer</DropdownMenuItem>
            {destinos.length > 0 && <DropdownMenuSeparator />}
          </>
        )}
        {destinos.length > 0 && <DropdownMenuLabel>Para coluna</DropdownMenuLabel>}
        {destinos.map(d => <DropdownMenuItem key={d.id} className={item} onSelect={() => onPara(d.id)}>{d.name}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
