import { Link } from 'react-router-dom'
import { Ingressos } from './icones/evokaa16'
import { Button } from './ui/button'
import { useUserOrders } from '../hooks/useCheckout'
import { abrirAjudaIngresso } from '../lib/ingresso'

export function NaoVejoMeuIngresso({ className = '', antes }: { className?: string; antes?: () => void }) {
  return (
    <Button type="button" variant="ghost" onClick={() => { antes?.(); abrirAjudaIngresso() }} className={`h-11 px-1 text-sm font-semibold text-primary ${className}`}>
      Não vejo meu ingresso
    </Button>
  )
}

// Tela sem ingresso que vale: diz por quê, pelo que os pedidos da conta mostram
export default function SemIngressos({ anteriores = 0 }: { anteriores?: number }) {
  const { data: pedidos = [], isLoading } = useUserOrders()
  const pendentes = pedidos.filter(o => o.status === 'pending').length
  const pagos = pedidos.filter(o => o.status === 'paid').length
  const motivo = isLoading ? ''
    : pagos > 0
      ? 'Seu pagamento aparece como confirmado, mas o ingresso ainda não chegou à conta. Fale com a equipe.'
      : pendentes > 0
        ? `Você tem ${pendentes} pedido${pendentes > 1 ? 's' : ''} aguardando pagamento. O ingresso só aparece depois que o pagamento é confirmado.`
        : anteriores > 0
          ? 'Os ingressos de eventos que já passaram ficam em Anteriores.'
          : 'Você ainda não comprou ingressos. Eles aparecem aqui depois da compra.'
  return (
    <div className="flex flex-col items-start gap-3 py-4">
      <Ingressos size={40} className="text-muted-foreground" aria-hidden="true" />
      <p className="text-base font-semibold">Nenhum ingresso para usar agora.</p>
      <p className="text-[13px] leading-[18px] text-muted-foreground">{motivo}</p>
      <div className="flex flex-wrap items-center gap-2">
        {pendentes + pagos > 0 && <Button asChild variant="outline"><Link to="/app/orders">Ver minhas compras</Link></Button>}
        <Button asChild variant={pendentes + pagos > 0 ? 'ghost' : 'outline'}><Link to="/app/events">Explorar eventos</Link></Button>
      </div>
      <NaoVejoMeuIngresso className="-ml-1" />
    </div>
  )
}
