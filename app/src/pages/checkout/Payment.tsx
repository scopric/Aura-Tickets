import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CreditCard, Lock, Shield, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useCreateOrder } from '../../hooks/useCheckout'
import { usePayment } from '../../hooks/usePayment'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export default function CheckoutPayment() {
  const location = useLocation()
  const navigate = useNavigate()
  const { eventId, cart, totalAmount, itemsSummary } = (location.state || {}) as {
    eventId?: string
    cart?: Record<string, number>
    totalAmount?: number
    itemsSummary?: { ticket_type_id: string; quantity: number; name: string; price: number }[]
  }

  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix'>('credit_card')
  const [pixData, setPixData] = useState<{ qrCodeData: string; qrCodeImageUrl: string } | null>(null)
  
  const createOrderMutation = useCreateOrder()
  const { processPayment } = usePayment()
  const [processing, setProcessing] = useState(false)

  // Formulário de cartão de crédito nativo genérico (Gateway-Agnostic)
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')

  useEffect(() => {
    if (!eventId || !totalAmount) {
      toast.error('Sessão de pagamento expirada ou inválida.')
      navigate('/')
    }
  }, [eventId, totalAmount, navigate])

  const handlePay = async () => {
    if (!eventId || !cart || !totalAmount || !itemsSummary) {
      toast.error('Detalhes do pedido inválidos.')
      return
    }

    if (paymentMethod === 'credit_card') {
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
      payment_method: paymentMethod,
      total_amount: totalAmount
    }, {
      onSuccess: async (order) => {
        try {
          if (paymentMethod === 'credit_card') {
            // 2. Processar pagamento de forma genérica (Gateway-Agnostic)
            // Envia para o hook usePayment genérico
            const result = await processPayment({
              orderId: order.id,
              method: 'credit_card',
              amount: totalAmount,
              customerEmail: order.customer_email || 'comprador@cliente.com',
              customerName: order.customer_name || 'Comprador Aura',
              customerCpf: order.customer_cpf || '',
            })

            if (result.status === 'error') {
              throw new Error(result.message || 'Erro ao processar pagamento do cartão')
            }

            // Simula sucesso ou chama o processamento
            toast.success('Pagamento com cartão processado com sucesso!')
            navigate('/checkout/success', {
              state: {
                orderId: order.id,
                totalAmount,
                paymentMethod
              }
            })

          } else if (paymentMethod === 'pix') {
            // 2. Chamar o hook de pagamentos para gerar cobrança Pix via Woovi
            const result = await processPayment({
              orderId: order.id,
              method: 'pix',
              amount: totalAmount,
              customerEmail: order.customer_email || '',
              customerName: order.customer_name || '',
              customerCpf: order.customer_cpf || '',
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
                (payload: any) => {
                  if (payload.new.status === 'paid') {
                    toast.success('Pagamento via Pix confirmado!')
                    supabase.removeChannel(orderChannel)
                    navigate('/checkout/success', {
                      state: {
                        orderId: order.id,
                        totalAmount,
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
        toast.error(`Erro ao criar pedido: ${err.message}`)
        setProcessing(false)
      }
    })
  }

  return (
    <div className="min-h-screen bg-canvas pt-24 pb-16">
      <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            aria-label="Voltar para a página anterior"
            title="Voltar"
            className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-serif text-3xl text-espresso">Pagamento</h1>
        </div>

        <div className="space-y-4">
          {/* Card Option Header */}
          {!pixData && (
            <div
              onClick={() => setPaymentMethod('credit_card')}
              className={`p-6 rounded-2xl border backdrop-blur-sm cursor-pointer transition-all ${
                paymentMethod === 'credit_card'
                  ? 'bg-white/80 border-plum/30 shadow-sm'
                  : 'bg-white/40 border-white/60 hover:bg-white/60'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-plum/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-plum" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-medium text-espresso">Cartão de Crédito</h2>
                  <p className="text-xs text-espresso/40">Pagamento seguro com formulário genérico</p>
                </div>
                <input
                  type="radio"
                  name="payment"
                  aria-label="Selecionar Cartão de Crédito"
                  title="Selecionar Cartão de Crédito"
                  checked={paymentMethod === 'credit_card'}
                  onChange={() => setPaymentMethod('credit_card')}
                  className="accent-plum"
                />
              </div>

              {paymentMethod === 'credit_card' && (
                <div className="space-y-4 pt-2 border-t border-espresso/5 animate-fade-in">
                  <div>
                    <label className="text-xs text-espresso/50 mb-1 block">Número do Cartão</label>
                    <input
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={e => setCardNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-espresso/50 mb-1 block">Nome no Cartão</label>
                    <input
                      type="text"
                      placeholder="Nome completo"
                      value={cardName}
                      onChange={e => setCardName(e.target.value)}
                      className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-espresso/50 mb-1 block">Validade</label>
                      <input
                        type="text"
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={e => setCardExpiry(e.target.value)}
                        className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-espresso/50 mb-1 block">CVV</label>
                      <input
                        type="text"
                        placeholder="123"
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value)}
                        className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pix Option */}
          {!pixData && (
            <div
              onClick={() => setPaymentMethod('pix')}
              className={`p-6 rounded-2xl border backdrop-blur-sm cursor-pointer transition-all ${
                paymentMethod === 'pix'
                  ? 'bg-white/80 border-plum/30 shadow-sm'
                  : 'bg-white/40 border-white/60 hover:bg-white/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-green-600">Pix</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-medium text-espresso">Pagar com Pix</h2>
                  <p className="text-xs text-espresso/40">Aprovação em segundos</p>
                </div>
                <input
                  type="radio"
                  name="payment"
                  aria-label="Selecionar Pix"
                  title="Selecionar Pix"
                  checked={paymentMethod === 'pix'}
                  onChange={() => setPaymentMethod('pix')}
                  className="accent-plum"
                />
              </div>
              {paymentMethod === 'pix' && (
                <p className="text-xs text-espresso/50 mt-4 pt-3 border-t border-espresso/5 animate-fade-in">
                  Ao clicar em "Pagar Agora", geraremos o código Pix Copia e Cola. O pedido será confirmado instantaneamente após o pagamento.
                </p>
              )}
            </div>
          )}

          {/* Pix Getted View */}
          {pixData && (
            <div className="p-6 rounded-2xl border bg-white/80 border-plum/30 shadow-sm text-center space-y-4 animate-fade-in">
              <h2 className="text-lg font-bold text-espresso">Efetue o pagamento Pix</h2>
              <div className="flex justify-center">
                <img 
                  src={pixData.qrCodeImageUrl} 
                  alt="Pix QR Code" 
                  className="w-48 h-48 border rounded-lg p-2 bg-white"
                />
              </div>
              <div>
                <label htmlFor="pix-copia-cola" className="text-xs text-espresso/50 block mb-1">Código Copia e Cola:</label>
                <textarea
                  id="pix-copia-cola"
                  readOnly
                  value={pixData.qrCodeData}
                  onClick={(e) => {
                    (e.target as HTMLTextAreaElement).select();
                    navigator.clipboard.writeText(pixData.qrCodeData);
                    toast.success('Código Pix copiado!');
                  }}
                  className="w-full p-2 bg-white/50 border border-white/60 rounded-xl text-xs font-mono text-espresso text-center h-16 resize-none focus:outline-none"
                />
              </div>
              <p className="text-xs text-espresso/40">Aguardando confirmação de pagamento do banco...</p>
              <div className="flex justify-center items-center gap-2 text-xs text-plum font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sincronizando Pix...
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="p-6 rounded-2xl bg-void text-cream">
            <div className="flex justify-between items-center mb-4">
              <span className="text-cream/50">Total a pagar</span>
              <span className="font-serif text-2xl">
                R$ {totalAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-cream/30 mb-4">
              <Shield className="w-3 h-3" />
              Pagamento seguro e criptografado
            </div>
            {!pixData && (
              <button
                onClick={handlePay}
                disabled={createOrderMutation.isPending || processing}
                className="w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {createOrderMutation.isPending || processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Pagar Agora
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
