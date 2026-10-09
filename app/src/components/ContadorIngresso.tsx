import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'

// Tirar / quantidade / pôr mais (contrato v3.4, 5.4). Serve à página do evento e ao checkout; as regras de
// quantidade (máximo, Match de Mesa) ficam com quem usa: aqui só desliga o "mais" quando mandam. Desligado é
// aria-disabled (não disabled): o botão ignora o clique mas mantém o foco do teclado ao chegar no limite.
// (mesmas cores do disabled do Button; hover e active também, senão o desligado "acende" ao passar o mouse)
const desligado = 'aria-disabled:cursor-not-allowed aria-disabled:bg-[var(--ev-disabled-bg)] aria-disabled:text-[var(--ev-disabled-fg)] aria-disabled:shadow-none aria-disabled:hover:bg-[var(--ev-disabled-bg)] aria-disabled:active:bg-[var(--ev-disabled-bg)] aria-disabled:active:scale-100'

export default function ContadorIngresso({ nome, qtd, onMenos, onMais, maisDesligado = false }: {
  nome: string
  qtd: number
  onMenos: () => void
  onMais: () => void
  maisDesligado?: boolean
}) {
  return (
    <div role="group" aria-label={`Quantidade de ${nome}`} className="flex shrink-0 items-center gap-1">
      <Button type="button" variant="outline" size="icon" className={`rounded-full ${desligado}`} onClick={() => qtd !== 0 && onMenos()} aria-disabled={qtd === 0} aria-label={`Tirar um ${nome}`}>
        <I.Menos size={16} aria-hidden="true" />
      </Button>
      <span className={`cont-n${qtd ? '' : ' zero'}`}>
        <span key={qtd} aria-hidden="true" className={qtd ? 'evv-pop' : undefined}>{qtd}</span>
        <span className="sr-only" aria-live="polite" aria-atomic="true">{qtd} {nome}</span>
      </span>
      <Button type="button" variant="outline" size="icon" className={`rounded-full ${desligado}`} onClick={() => !maisDesligado && onMais()} aria-disabled={maisDesligado} aria-label={`Adicionar um ${nome}`}>
        <I.Criar size={16} aria-hidden="true" />
      </Button>
    </div>
  )
}
