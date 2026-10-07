import { useLocation, useNavigate } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect } from 'react'
import { useCreateOrder } from '../../hooks/useCheckout'
import { usePayment } from '../../hooks/usePayment'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { formatCurrency } from '../../lib/formatters'
import { mesaErro } from '../../hooks/useMatchmaking'
import { resumoCarrinho } from '../../lib/taxa'

export default function CheckoutPayment() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  // Recuperar do location.state ou do sessionStorage (quando volta do login)
  const locationState = (location.state || {}) as {
    eventId?: string
    cart?: Record<string, number>
    totalAmount?: number
    itemsSummary?: { ticket_type_id: string; quantity: number; name: string; price: number }[]
  }
  const pendingCheckout = (() => {
    try {
      const raw = sessionStorage.getItem('aura_pending_checkout')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })()

  const { eventId, cart, itemsSummary } = {
    eventId: locationState.eventId || pendingCheckout?.eventId,
    cart: locationState.cart || pendingCheckout?.cart,
    itemsSummary: locationState.itemsSummary || pendingCheckout?.itemsSummary,
  }
  // Recalcula aqui: o totalAmount do sessionStorage pode ter a taxa antiga de 5%.
  const resumo = resumoCarrinho((itemsSummary || []).map((i: { price: number; quantity: number }) => ({ preco: i.price, qtd: i.quantity })))

  const gratis = resumo.total === 0 && (itemsSummary?.length ?? 0) > 0
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix'>('credit_card')
  const [pixData, setPixData] = useState<{ qrCodeData: string; qrCodeImageUrl: string } | null>(null)
  
  const createOrderMutation = useCreateOrder()
  const { processPayment } = usePayment()
  const [processing, setProcessing] = useState(false)

  // Campos do cartão (ainda sem cobrança)
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [qrAberto, setQrAberto] = useState(false)
  const [pixCopiado, setPixCopiado] = useState(false)

  useEffect(() => {
    if (!eventId || !itemsSummary?.length) { // total 0 (evento gratuito) é válido
      toast.error('Sessão de pagamento expirada ou inválida.')
      navigate('/')
    }
  }, [eventId, itemsSummary, navigate])

  const handlePay = async () => {
    if (!eventId || !cart || !itemsSummary) {
      toast.error('Detalhes do pedido inválidos.')
      return
    }

    if (!gratis && paymentMethod === 'credit_card') {
      if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
        toast.error('Por favor, preencha todos os campos do cartão.')
        return
      }
    }

    setProcessing(true)

    // 1. Criar o pedido (Order) no banco via Supabase
    createOrderMutation.mutate({
      event_id: eventId,
      items: itemsSummary.map(i => ({ ticket_type_id: i.ticket_type_id, quantity: i.quantity })),
      payment_method: gratis ? null : paymentMethod,
    }, {
      onSuccess: async (order) => {
        try {
          if (gratis) {
            // O banco confere que todos os itens têm preço 0 e emite os ingressos (docs/sql/20261022_pedido_gratis_e_estoque.sql)
            const { error } = await supabase.rpc('confirmar_pedido_gratis' as never, { p_order: order.id } as never)
            if (error) throw error
            sessionStorage.removeItem('aura_pending_checkout')
            navigate(`/checkout/success?pedido=${order.id}`, { state: { orderId: order.id, totalAmount: 0, paymentMethod: null } })
            return
          }
          if (paymentMethod === 'credit_card') {
            // 2. Pedir o pagamento ao hook usePayment
            const result = await processPayment({
              orderId: order.id,
              method: 'credit_card',
              amount: Number(order.total),
              customerEmail: order.customer_email || user?.email || '',
              customerName: order.customer_name || user?.full_name || '',
              customerCpf: '', // orders.customer_cpf nunca é gravado e não tem SELECT (E4)
            })

            if (result.status === 'error') {
              throw new Error(result.message || 'Erro ao processar pagamento do cartão')
            }

            // Simula sucesso ou chama o processamento
            toast.info('Pedido registrado. A cobrança no cartão ainda não está ativa.')
            sessionStorage.removeItem('aura_pending_checkout')
            navigate(`/checkout/success?pedido=${order.id}`, {
              state: {
                orderId: order.id,
                totalAmount: Number(order.total),
                paymentMethod
              }
            })

          } else if (paymentMethod === 'pix') {
            // 2. Chamar o hook de pagamentos para gerar a cobrança Pix
            const result = await processPayment({
              orderId: order.id,
              method: 'pix',
              amount: Number(order.total),
              customerEmail: order.customer_email || user?.email || '',
              customerName: order.customer_name || user?.full_name || '',
              customerCpf: '', // orders.customer_cpf nunca é gravado e não tem SELECT (E4)
            })

            if (result.status === 'error' || !result.qrCodeData || !result.qrCodeImageUrl) {
              throw new Error(result.message || 'Erro ao gerar Pix')
            }

            setPixData({
              qrCodeData: result.qrCodeData,
              qrCodeImageUrl: result.qrCodeImageUrl
            })

            toast.info('Pix gerado! Por favor, efetue o pagamento para concluir a compra.')

            // Configurar canal em tempo real (Supabase Realtime) para escutar a confirmação de que o webhook processou o Pix
            const orderChannel = supabase
              .channel(`order-update-${order.id}`)
              .on(
                'postgres_changes',
                {
                  event: 'UPDATE',
                  schema: 'public',
                  table: 'orders',
                  filter: `id=eq.${order.id}`,
                },
                async (payload: any) => {
                  if (payload.new.status === 'paid') {
                    toast.success('Pagamento via Pix confirmado!')
                    sessionStorage.removeItem('aura_pending_checkout')
                    supabase.removeChannel(orderChannel)
                    navigate(`/checkout/success?pedido=${order.id}`, {
                      state: {
                        orderId: order.id,
                        totalAmount: Number(order.total),
                        paymentMethod: 'pix'
                      }
                    })
                  }
                }
              )
              .subscribe()
          }
        } catch (err: any) {
          toast.error(err.message || 'Falha ao processar pagamento.')
          setProcessing(false)
        }
      },
      onError: (err) => {
        // 22023: regra do Match de Mesa no banco (menor de idade, 1 por conta, quantidade 1)
        toast.error((err as { code?: string }).code === '22023' ? mesaErro(err) : `Erro ao criar pedido: ${err.message}`, { duration: 7000 })
        setProcessing(false)
      }
    })
  }

  const ocupado = createOrderMutation.isPending || processing
  const metodo = 'flex min-h-16 w-full items-center gap-3 rounded-ev-xl bg-card p-3.5 text-left shadow-ev-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-checked:shadow-[inset_0_0_0_2px_hsl(var(--primary))]'
  const radio = 'grid size-5 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1.5px_hsl(var(--input))] group-aria-checked:shadow-[inset_0_0_0_6px_hsl(var(--primary))]'
  const rotulo = 'mb-1.5 block text-[13px] font-semibold leading-5'
  const campo = 'h-12 rounded-ev-lg bg-card'

  const copiarPix = () => {
    if (!pixData) return
    navigator.clipboard.writeText(pixData.qrCodeData)
    setPixCopiado(true)
    toast.success('Código Pix copiado!')
  }

  return (
    <div className="min-h-screen bg-background pb-16 text-foreground">
      <div className="mx-auto max-w-lg px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="-ml-2 rounded-full" onClick={() => navigate(-1)} aria-label="Voltar para a página anterior" title="Voltar">
            <I.ChevronEsquerda size={20} />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7">Pagamento</h1>
            <p className="text-[13px] leading-5 text-muted-foreground">Passo 3 de 3</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Forma de pagamento */}
          {!pixData && !gratis && (
            <div role="radiogroup" aria-label="Forma de pagamento" className="grid gap-2">
              <button type="button" role="radio" aria-checked={paymentMethod === 'credit_card'} onClick={() => setPaymentMethod('credit_card')} className={`group ${metodo}`}>
                <span className={radio} aria-hidden="true" />
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold leading-5">Cartão de Crédito</span>
                  <span className="block text-[13px] leading-[18px] text-muted-foreground">Cobrança ainda não ativa (ambiente de teste)</span>
                </span>
                <I.Cartao size={20} className="shrink-0 text-muted-foreground" />
              </button>
              <button type="button" role="radio" aria-checked={paymentMethod === 'pix'} onClick={() => setPaymentMethod('pix')} className={`group ${metodo}`}>
                <span className={radio} aria-hidden="true" />
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold leading-5">Pagar com Pix</span>
                  <span className="block text-[13px] leading-[18px] text-muted-foreground">Cobrança ainda não ativa (ambiente de teste)</span>
                </span>
              </button>
            </div>
          )}

          {!pixData && !gratis && paymentMethod === 'credit_card' && (
            <div className="space-y-3 rounded-ev-xl bg-card p-5 shadow-ev-secondary">
              <div>
                <label htmlFor="cartao-numero" className={rotulo}>Número do Cartão</label>
                <Input id="cartao-numero" type="text" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={e => setCardNumber(e.target.value)} className={campo} />
              </div>
              <div>
                <label htmlFor="cartao-nome" className={rotulo}>Nome no Cartão</label>
                <Input id="cartao-nome" type="text" autoComplete="cc-name" placeholder="Nome completo" value={cardName} onChange={e => setCardName(e.target.value)} className={campo} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cartao-validade" className={rotulo}>Validade</label>
                  <Input id="cartao-validade" type="text" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} className={campo} />
                </div>
                <div>
                  <label htmlFor="cartao-cvv" className={rotulo}>CVV</label>
                  <Input id="cartao-cvv" type="text" inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={cardCvv} onChange={e => setCardCvv(e.target.value)} className={campo} />
                </div>
              </div>
            </div>
          )}

          {!pixData && !gratis && paymentMethod === 'pix' && (
            <p className="px-1 text-[13px] leading-5 text-muted-foreground">
              Ao clicar em "Pagar Agora", tentaremos gerar o código Pix Copia e Cola.
            </p>
          )}

          {/* Pix gerado: copiar o código primeiro, QR recolhido */}
          {pixData && (
            <div className="space-y-3 rounded-ev-xl bg-card p-5 shadow-ev-secondary">
              <h2 className="text-lg font-semibold leading-7">Efetue o pagamento Pix</h2>
              <Button type="button" size="lg" className="w-full rounded-full" onClick={copiarPix}>
                {pixCopiado && <I.Check size={16} />}
                <span role="status">{pixCopiado ? 'Código copiado' : 'Copiar código Pix'}</span>
              </Button>
              {pixCopiado && <p className="text-sm leading-5">Abra o app do seu banco e cole na área Pix.</p>}
              <div className="truncate rounded-ev-lg bg-secondary px-3 py-2.5 font-display text-[13px] leading-[18px] text-muted-foreground" title="Código Pix Copia e Cola">
                {pixData.qrCodeData}
              </div>
              <Button type="button" variant="outline" className="rounded-full" aria-expanded={qrAberto} onClick={() => setQrAberto(!qrAberto)}>
                {qrAberto ? 'Esconder QR' : 'Mostrar QR'}
              </Button>
              {qrAberto && (
                <div className="w-fit rounded-ev-xl bg-white p-3">
                  <img src={pixData.qrCodeImageUrl} alt="Pix QR Code" className="size-44" />
                </div>
              )}
              <p role="status" className="flex items-center gap-2 pt-1 text-sm font-medium leading-5">
                <Spinner className="size-4" />
                Aguardando confirmação de pagamento do banco...
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="rounded-ev-xl bg-card p-6 shadow-ev-secondary">
            <div className="flex justify-between gap-3 border-b border-border py-2.5 text-[15px] leading-5">
              <span>Ingressos</span>
              <span className="font-display font-semibold tabular-nums">{formatCurrency(resumo.subtotal)}</span>
            </div>
            <div className="flex justify-between gap-3 border-b border-border py-2.5 text-[15px] leading-5 text-muted-foreground">
              <span>Taxa de serviço</span>
              <span className="font-display font-semibold tabular-nums">{formatCurrency(resumo.taxa)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 pt-3 text-base font-semibold">
              <span>Total a pagar</span>
              <span className="font-display text-xl tabular-nums">{formatCurrency(resumo.total)}</span>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs leading-4 text-muted-foreground">
              <I.Info size={14} />
              Ambiente de teste: a cobrança ainda não está ativa e nenhum valor é debitado.
            </p>
            {!pixData && (
              <Button type="button" size="lg" className="mt-4 w-full rounded-full" onClick={handlePay} loading={ocupado}>
                {!gratis && <I.Cadeado size={16} />}
                {gratis ? 'Garantir ingresso grátis' : 'Pagar Agora'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
