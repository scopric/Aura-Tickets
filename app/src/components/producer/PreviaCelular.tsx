import { useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import type { DbEvent } from '../../hooks/useEvents'
import EventoConteudo from '../EventoConteudo'

// Prévia da página pública no painel do evento (F1 PR3d-1): o mesmo EventoConteudo, na memória, sem gravar nada.
// Nada de iframe (a página pública responde X-Frame-Options: DENY). O conteúdo vai com inert e aria-hidden: é só para olhar
// (compra desligada); a rolagem fica no contêiner, que recebe foco e tem nome.
function Tela({ evento, previa, className }: { evento: DbEvent; previa: 'moldura' | 'folha'; className: string }) {
  return (
    <div tabIndex={0} role="region" aria-label="Prévia da página do evento no celular (rola com o teclado)" className={className}>
      <div inert aria-hidden="true"><EventoConteudo evento={evento} previa={previa} /></div>
    </div>
  )
}

/** Moldura de celular ao lado do formulário (a partir de 1180 px) */
export function PreviaMoldura({ evento }: { evento: DbEvent }) {
  return (
    <aside aria-label="Prévia no celular" className="sticky top-5 hidden self-start min-[1180px]:grid">
      <div className="w-[300px] justify-self-center overflow-hidden rounded-[36px] border-[6px] border-foreground bg-background">
        <Tela evento={evento} previa="moldura" className="h-[608px] overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_hsl(var(--ring))]" />
      </div>
      <p className="mt-3 text-center text-[13px] leading-5 text-muted-foreground">Prévia do que o público vê. Na prévia a compra fica desligada.</p>
    </aside>
  )
}

/** Abaixo de 1180 px não há moldura: o botão abre a prévia numa folha */
export function PreviaFolha({ evento }: { evento: DbEvent }) {
  const [aberta, setAberta] = useState(false)
  return (
    <div className="mb-4 min-[1180px]:hidden">
      <Drawer open={aberta} onOpenChange={setAberta}>
        <DrawerTrigger asChild>
          <Button variant="outline"><I.Celular aria-hidden="true" />Ver no celular</Button>
        </DrawerTrigger>
        <DrawerContent className="h-[88dvh] max-h-[88dvh] mx-auto max-w-xl">
          <DrawerHeader className="flex-row items-center justify-between group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <div>
              <DrawerTitle>Ver no celular · prévia</DrawerTitle>
              <DrawerDescription>Do jeito que o público vê. Na prévia a compra fica desligada.</DrawerDescription>
            </div>
            <DrawerClose asChild><Button variant="ghost">Fechar</Button></DrawerClose>
          </DrawerHeader>
          {/* ponytail: a moldura (escondida abaixo de 1180 px) e a folha repetem ids da página; ninguém lê id nos dois ao mesmo tempo */}
          <Tela evento={evento} previa="folha" className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_hsl(var(--ring))]" />
        </DrawerContent>
      </Drawer>
    </div>
  )
}
