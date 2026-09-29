import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { useIsMobile } from '../hooks/use-mobile'
import { FeedbackForm } from './FeedbackButton'

const caixa = 'bg-canvas border border-white/60 rounded-2xl shadow-xl p-4'

/** Ícone de feedback das barras de topo (produtor e participante): Popover no desktop, Dialog no celular. */
export default function FeedbackTopButton({ className }: { className: string }) {
  const [aberto, setAberto] = useState(false)
  const celular = useIsMobile()
  const fechar = () => setAberto(false)

  const botao = (
    <button type="button" aria-label="Enviar feedback" className={className}>
      <MessageSquarePlus className="h-5 w-5" aria-hidden="true" />
    </button>
  )
  const comDica = (trigger: React.ReactNode) => (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent>Feedback</TooltipContent>
    </Tooltip>
  )

  if (celular) {
    return (
      <Dialog open={aberto} onOpenChange={setAberto}>
        {comDica(<DialogTrigger asChild>{botao}</DialogTrigger>)}
        <DialogContent className={`${caixa} max-w-[calc(100%-2rem)] sm:max-w-sm`}>
          <DialogTitle className="sr-only">Enviar feedback</DialogTitle>
          <DialogDescription className="sr-only">Conte o que achou da Evokaa</DialogDescription>
          <FeedbackForm onDone={fechar} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      {comDica(<PopoverTrigger asChild>{botao}</PopoverTrigger>)}
      <PopoverContent align="end" className={`${caixa} w-80`}>
        <FeedbackForm onDone={fechar} />
      </PopoverContent>
    </Popover>
  )
}
