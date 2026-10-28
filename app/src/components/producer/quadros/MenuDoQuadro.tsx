import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth } from '../../../hooks/useAuth'
import { mensagemQuadro, useArquivarQuadro, type QuadroLinha } from '../../../hooks/useQuadros'
import { EditarQuadro, MembrosQuadro, SalvarModelo } from './DialogosQuadro'

type Aberto = 'editar' | 'membros' | 'modelo' | null
const item = 'min-h-11 sm:min-h-8'

/** Menu "⋯" do quadro: abrir, renomear e cor, membros, salvar como modelo, arquivar. Só o dono altera; quem não é dono só vê os membros. */
export default function MenuDoQuadro({ quadro, comAbrir = true, className }: { quadro: QuadroLinha; comAbrir?: boolean; className?: string }) {
  const { user } = useAuth()
  const dono = quadro.producer_id === user?.id
  const arquivar = useArquivarQuadro()
  const [aberto, setAberto] = useState<Aberto>(null)
  const arquivado = !!quadro.archived_at
  const alternar = () => arquivar.mutate({ id: quadro.id, arquivar: !arquivado }, {
    onSuccess: () => toast.success(arquivado ? 'Quadro desarquivado.' : 'Quadro arquivado.'),
    onError: e => toast.error(mensagemQuadro(e)),
  })
  const so = (txt: string, off: boolean) => txt + (off ? ' (só o dono)' : '')
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={className ?? 'size-11 text-muted-foreground hover:bg-foreground/5 hover:text-foreground'} aria-label={`Ações do quadro ${quadro.name}`}>
            <I.Mais aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {comAbrir && <DropdownMenuItem asChild className={item}><Link to={`/producer/quadros/${quadro.id}`}>Abrir</Link></DropdownMenuItem>}
          <DropdownMenuItem className={item} disabled={!dono} onSelect={() => setAberto('editar')}>{so('Renomear e cor', !dono)}</DropdownMenuItem>
          <DropdownMenuItem className={item} onSelect={() => setAberto('membros')}>{dono ? 'Membros e visibilidade' : 'Ver membros'}</DropdownMenuItem>
          <DropdownMenuItem className={item} disabled={!dono} onSelect={() => setAberto('modelo')}>{so('Salvar como modelo', !dono)}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={item} disabled={!dono || quadro.is_default} onSelect={alternar}>
            {quadro.is_default ? 'Arquivar (o quadro padrão não arquiva)' : so(arquivado ? 'Desarquivar' : 'Arquivar', !dono)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {aberto === 'editar' && <EditarQuadro quadro={quadro} onFechar={() => setAberto(null)} />}
      {aberto === 'membros' && <MembrosQuadro quadro={quadro} dono={dono} onFechar={() => setAberto(null)} />}
      {aberto === 'modelo' && <SalvarModelo quadro={quadro} onFechar={() => setAberto(null)} />}
    </>
  )
}
