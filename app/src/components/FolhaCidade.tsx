import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import * as I from '@/components/icones/evokaa16'
import type { Opcao } from '@/lib/explorar'

// Folha inferior da cidade (prancha Explorar): Vaul cuida do foco, do Esc e de arrastar para fechar.
// Só as cidades que os eventos publicados têm; "Todas as cidades" limpa o filtro (chave null).
export default function FolhaCidade({ aberta, onAbrir, cidades, total, atual, onEscolher }: {
  aberta: boolean
  onAbrir: (aberta: boolean) => void
  cidades: Opcao[]
  total: number
  atual: string | null
  onEscolher: (chave: string | null) => void
}) {
  const itens: { chave: string | null; nome: string; qtd: number }[] = [{ chave: null, nome: 'Todas as cidades', qtd: total }, ...cidades]
  return (
    <Drawer open={aberta} onOpenChange={onAbrir}>
      <DrawerContent className="mx-auto max-w-lg rounded-t-ev-2xl bg-card px-5 pb-7">
        <DrawerTitle className="mb-2 mt-3 text-xl">Cidade</DrawerTitle>
        <DrawerDescription className="sr-only">Escolha a cidade para ver só os eventos dela.</DrawerDescription>
        <div role="radiogroup" aria-label="Cidade" className="overflow-y-auto">
          {itens.map(c => {
            const marcada = c.chave === atual
            return (
              <button
                key={c.chave ?? 'todas'}
                type="button"
                role="radio"
                aria-checked={marcada}
                onClick={() => onEscolher(c.chave)}
                className={`flex h-[52px] w-full items-center gap-3 rounded-ev-md px-1 text-left text-[15px] font-medium text-foreground hover:bg-[var(--ev-tint-hover)] focus-visible:shadow-ev-foco focus-visible:outline-none ${marcada ? 'bg-[var(--ev-tint-ativo)]' : ''}`}
              >
                <span className="flex-1">{c.nome}</span>
                <span className="text-[13px] font-normal text-muted-foreground">{c.qtd === 1 ? '1 evento' : `${c.qtd} eventos`}</span>
                <I.Check size={16} className={`text-primary ${marcada ? '' : 'invisible'}`} />
              </button>
            )
          })}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
