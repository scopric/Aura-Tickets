import { useLocation, useNavigate } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useCreateOrder } from '../../hooks/useCheckout'
import { usePayment } from '../../hooks/usePayment'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { cpfValido, formatCPF, formatCurrency } from '../../lib/formatters'
import { useAuthStore } from '../../stores/authStore'
import { mesaErro } from '../../hooks/useMatchmaking'
import { totaisItens } from '../../lib/pedido'

const CHAVE_PIX = 'aura_pix_pendente' // só {pedidoId, expiraEm, eventId, userId}: nunca CPF nem copia-e-cola
const ESPERA_EXTRA = 5 * 60_000 // o banco ainda pode confirmar um Pix pago na hora em que a reserva vence
// deltaMs = hora do servidor menos a do aparelho (da reserva). // ponytail: sem `agora` (lugar marcado) vale 0 e o relógio do
// aparelho decide só a mensagem "Pix venceu"; o status 'paid' do banco manda ao sucesso de qualquer jeito. Teto: mensagem errada.
type PixPendente = { pedidoId: string; expiraEm: string; eventId?: string; userId?: string; deltaMs?: number }
// Vale até expiraEm + ESPERA_EXTRA (o banco ainda pode confirmar); de outro evento ou de outro usuário é descartada e apagada.
// Sem usuário carregado ainda (userId indefinido) não decide nada: ignora sem apagar.
const lerPixPendente = (eventId?: string, userId?: string): PixPendente | null => {
  if (!userId) return null
  try {
    const r = JSON.parse(sessionStorage.getItem(CHAVE_PIX) || 'null') as PixPendente | null
    if (r?.pedidoId && r?.expiraEm && r.eventId === eventId && r.userId === userId && new Date(r.expiraEm).getTime() + ESPERA_EXTRA > Date.now() + (r.deltaMs ?? 0)) return r
  } catch { /* chave corrompida: ignora */ }
  sessionStorage.removeItem(CHAVE_PIX)
  return null
}

export default function CheckoutPayment() {
  const location = useLocation()
  const navigate = useNavigate()
  const userId = useAuthStore(s => s.user?.id)

  // Recuperar do location.state ou do sessionStorage (quando volta do login)
  const locationState = (location.state || {}) as {
    eventId?: string
    cart?: Record<string, number>
    totalAmount?: number
    itemsSummary?: { ticket_type_id: string; quantity: number; name: string; price: number; max_por_cpf?: number | null; beneficio?: 'inteira' | 'meia'; meia_tipo?: string | null; taxa_unit?: number | null }[]
    orderId?: string // pedido de lugar marcado, já criado (e reservado por 10 min) pelo banco em reservar_assentos
    venceEm?: number // fim da reserva no relógio deste aparelho (Date.now)
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
  const resumo = totaisItens(itemsSummary || [])
  // Depois de reservar, quem manda nos valores é o retorno do servidor (desconto do cupom, meia, taxa); antes é só prévia
  const [valores, setValores] = useState<{ subtotal: number; desconto: number; taxa: number; total: number } | null>(null)
  const v = valores ?? { ...resumo, desconto: 0 }
  const temMeia = (itemsSummary || []).some((i: { beneficio?: string }) => i.beneficio === 'meia')
  const [cupom, setCupom] = useState('')
  const [erroCupom, setErroCupom] = useState<string | null>(null)

  const orderIdLugar = locationState.orderId
  const gratis = resumo.total === 0 && (itemsSummary?.length ?? 0) > 0
  // Só Pix no lançamento; o cartão aparece como "Em breve" (decisão 3DS x Liable pendente)
  const [pixData, setPixData] = useState<{ pedidoId: string; copiaECola: string; expiraEm: string } | null>(null)
  const [pedidoCriado, setPedidoCriado] = useState<{ id: string; total: number | string; deltaMs?: number } | null>(null) // se o Pix falhar, o novo clique reaproveita o pedido
  // Pix gerado (também após recarregar a página, quando só o pedido e o prazo voltam do sessionStorage)
  const [espera, setEspera] = useState<PixPendente | null>(() => lerPixPendente(eventId, userId))
  // retomada tardia: o usuário pode chegar depois do primeiro render
  useEffect(() => {
    if (!espera && !pedidoCriado) setEspera(lerPixPendente(eventId, userId)) // eslint-disable-line react-hooks/set-state-in-effect -- sessionStorage + usuário que chega depois
  }, [userId, eventId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!espera) return
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [espera])
  const pixVenceu = !!espera && agora + (espera.deltaMs ?? 0) >= new Date(espera.expiraEm).getTime()
  // Retomada após recarregar: o total vem do banco (o resumo da tela é só prévia do carrinho)
  const [totalBanco, setTotalBanco] = useState<number | null>(null)
  const retomada = !!espera && !valores
  useEffect(() => {
    if (!retomada || !espera) return
    supabase.from('orders').select('total').eq('id', espera.pedidoId).maybeSingle()
      .then(({ data }) => { const t = (data as { total?: number | string } | null)?.total; if (t != null) setTotalBanco(Number(t)) })
  }, [retomada, espera?.pedidoId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [refazer, setRefazer] = useState(false) // 409 do pagamento: a reserva não serve mais

  const createOrderMutation = useCreateOrder()
  const { pagarPix } = usePayment()
  const [processing, setProcessing] = useState(false)

  // CPF do comprador: o PagBank exige para o Pix; vale também para o limite por CPF do ingresso (o banco grava só o hash).
  // Fica só neste estado, nunca em storage, URL, log ou toast.
  // O carrinho pode estar velho (limite ligado depois, ou volta do login): o banco também pode exigir (exigeCpfServidor).
  const [exigeCpfServidor, setExigeCpfServidor] = useState(false)
  const exigeCpf = !orderIdLugar && (exigeCpfServidor || (itemsSummary || []).some((i: { max_por_cpf?: number | null }) => i.max_por_cpf != null))
  const pedeCpf = !gratis || exigeCpf
  const [cpf, setCpf] = useState('')
  const [erroCpf, setErroCpf] = useState<string | null>(null)
  useEffect(() => { if (erroCpf) document.getElementById('comprador-cpf')?.focus() }, [erroCpf])
  // Contagem regressiva da reserva (10 min do servidor): lugar marcado chega com venceEm; ingresso comum ganha o prazo ao reservar
  const [venceEm, setVenceEm] = useState<number | undefined>(locationState.venceEm)
  const [restante, setRestante] = useState(() => (locationState.venceEm ? Math.max(0, Math.ceil((locationState.venceEm - Date.now()) / 1000)) : null))
  useEffect(() => {
    if (!venceEm) return
    const tick = () => setRestante(Math.max(0, Math.ceil((venceEm - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [venceEm])
  const esgotado = (!!venceEm && restante === 0) || refazer || pixVenceu
  const [qrAberto, setQrAberto] = useState(false)
  const [pixCopiado, setPixCopiado] = useState(false)

  useEffect(() => {
    if (!eventId || !itemsSummary?.length) { // total 0 (evento gratuito) é válido
      toast.error('Sessão de pagamento expirada ou inválida.')
      navigate('/')
    }
  }, [eventId, itemsSummary, navigate])

  // Espera do Pix: consulta o status do pedido a cada 5 s (orders não está no Realtime). Continua depois que a reserva ou o Pix
  // vencem, por mais 5 min, porque o banco ainda pode confirmar um pagamento feito na hora; para ao pagar ou ao sair da tela.
  const pixPedidoId = espera?.pedidoId
  const pixExpiraEm = espera?.expiraEm
  const pixDelta = espera?.deltaMs ?? 0
  useEffect(() => {
    if (!pixPedidoId || !pixExpiraEm) return
    let feito = false
    const limite = new Date(pixExpiraEm).getTime() + ESPERA_EXTRA
    const reforco = setInterval(async () => {
      if (Date.now() + pixDelta > limite) { clearInterval(reforco); sessionStorage.removeItem(CHAVE_PIX); return }
      const { data } = await supabase.from('orders').select('status').eq('id', pixPedidoId).maybeSingle()
      if (feito || (data as { status?: string } | null)?.status !== 'paid') return
      feito = true // navega uma vez só
      clearInterval(reforco)
      toast.success('Pagamento via Pix confirmado!')
      sessionStorage.removeItem(CHAVE_PIX)
      sessionStorage.removeItem('aura_pending_checkout')
      navigate(`/checkout/success?pedido=${pixPedidoId}`, { state: { orderId: pixPedidoId, totalAmount: totalBanco ?? v.total, paymentMethod: 'pix' } })
    }, 5000)
    return () => { feito = true; clearInterval(reforco) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- v.total e navigate só entram no aviso final
  }, [pixPedidoId, pixExpiraEm, pixDelta])

  // Pede o Pix ao PagBank para um pedido já criado (a mesma função serve para "mostrar de novo": devolve o mesmo pedido)
  const gerarPix = async (id: string, deltaMs = 0) => {
    const r = await pagarPix({ orderId: id, cpf })
    if (!r.ok) {
      toast.error(r.mensagem, { duration: 7000 })
      if (r.refazerReserva) { setRefazer(true); sessionStorage.removeItem(CHAVE_PIX) }
      if (r.sessaoExpirada) { // volta depois do login com o carrinho, como o resto do checkout
        if (eventId && itemsSummary) sessionStorage.setItem('aura_pending_checkout', JSON.stringify({ eventId, cart, itemsSummary }))
        navigate('/auth/login', { state: { from: '/checkout' } })
        return
      }
      setProcessing(false) // em 429/502/503/rede o botão volta; o novo clique reaproveita este pedido
      return
    }
    const pendente = { pedidoId: id, expiraEm: r.expiraEm, eventId, userId, deltaMs }
    sessionStorage.setItem(CHAVE_PIX, JSON.stringify(pendente))
    setEspera(pendente)
    setPixData({ pedidoId: id, copiaECola: r.pixCopiaECola, expiraEm: r.expiraEm })
    toast.info('Pix gerado! Efetue o pagamento para concluir a compra.')
  }

  // Depois do pedido pronto: grátis confirma no banco; o Pix pede a cobrança ao PagBank
  const seguir = async (order: { id: string; total: number | string; deltaMs?: number }) => {
        setPedidoCriado(order)
        try {
          // Quem decide é o total devolvido pelo banco, não o que a tela mostrava (sessionStorage pode estar velho)
          if (Number(order.total) === 0) {
            // O banco confere que todos os itens têm preço 0 e emite os ingressos (docs/sql/20261022_pedido_gratis_e_estoque.sql)
            const { error } = await supabase.rpc('confirmar_pedido_gratis' as never, { p_order: order.id } as never)
            if (error) throw error
            sessionStorage.removeItem('aura_pending_checkout')
            navigate(`/checkout/success?pedido=${order.id}`, { state: { orderId: order.id, totalAmount: 0, paymentMethod: null } })
            return
          }
          if (gratis) throw new Error('O valor do pedido mudou. Volte ao evento e escolha de novo.')
          await gerarPix(order.id, order.deltaMs)
        } catch (err: any) {
          toast.error(err.message || 'Falha ao processar pagamento.')
          setProcessing(false)
        }
  }

  const handlePay = async () => {
    if (!eventId || !cart || !itemsSummary) {
      toast.error('Detalhes do pedido inválidos.')
      return
    }

    if (esgotado || processing || createOrderMutation.isPending) return // clique duplo não cria 2 pedidos
    if (pedeCpf && !cpfValido(cpf)) {
      setErroCpf('CPF inválido: confira os 11 números.')
      return
    }

    setProcessing(true)
    if (espera) { await gerarPix(espera.pedidoId, espera.deltaMs); return } // Pix já gerado antes (recarregou a página): mesmo pedido
    if (pedidoCriado) { await seguir(pedidoCriado); return } // pedido já criado e Pix que falhou: não cria outro

    // 1. Criar o pedido (Order) no banco via Supabase (pedido de lugar: o banco já criou em reservar_assentos, só lê)
    if (orderIdLugar) {
      const { data, error } = await supabase.from('orders')
        .select('id, total, status, customer_name, customer_email').eq('id', orderIdLugar).maybeSingle()
      const pedido = data as unknown as { id: string; total: number; status: string; customer_name: string | null; customer_email: string | null } | null
      if (error || !pedido || pedido.status !== 'pending') {
        toast.error('O tempo da reserva acabou. Escolha os lugares de novo.')
        setRestante(0)
        setProcessing(false)
        return
      }
      await seguir(pedido)
      return
    }
    createOrderMutation.mutate({
      event_id: eventId,
      items: itemsSummary.map(i => ({ ticket_type_id: i.ticket_type_id, quantity: i.quantity, beneficio: i.beneficio ?? 'inteira', meia_tipo: i.meia_tipo ?? null })),
      cupom: cupom.trim() || undefined,
      ...(pedeCpf ? { customer_cpf: cpf.replace(/\D/g, '') } : {}),
    }, {
      onSuccess: (pedido) => {
        setValores({ subtotal: pedido.subtotal, desconto: pedido.desconto, taxa: pedido.taxa, total: pedido.total })
        setVenceEm(pedido.venceEm)
        seguir(pedido)
      },
      onError: (err) => {
        const e = err as { code?: string; message?: string; motivo?: string }
        setProcessing(false)
        if (e.code === '22023' && /^Informe o CPF do comprador/.test(e.message ?? '')) {
          setExigeCpfServidor(true); setErroCpf('Informe o CPF para continuar')
          return
        }
        if (e.motivo === 'cupom_invalido') { setErroCupom(e.message ?? 'Cupom inválido'); return }
        // recusas de regra do servidor (cpf_da_conta, indisponivel, regra): a mensagem dele, sem reescrever
        if (e.motivo) { toast.error(e.message, { duration: 7000 }); return }
        // 22023: regra do Match de Mesa e limites ("Muitas tentativas"); 42501: sem login ou sem 2FA
        toast.error(e.code === '22023' || e.code === '42501' ? mesaErro(err) : `Erro ao criar pedido: ${e.message}`, { duration: 7000 })
      }
    })
  }

  const ocupado = createOrderMutation.isPending || processing
  const metodo = 'flex min-h-16 w-full items-center gap-3 rounded-ev-xl bg-card p-3.5 text-left shadow-ev-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-checked:shadow-[inset_0_0_0_2px_hsl(var(--primary))]'
  const radio = 'grid size-5 shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1.5px_hsl(var(--input))] group-aria-checked:shadow-[inset_0_0_0_6px_hsl(var(--primary))]'
  const rotulo = 'mb-1.5 block text-[13px] font-semibold leading-5'
  const campo = 'h-12 rounded-ev-lg bg-card'

  const copiarPix = async () => {
    if (!pixData) return
    try {
      await navigator.clipboard.writeText(pixData.copiaECola)
      setPixCopiado(true)
      toast.success('Código Pix copiado!')
    } catch {
      toast.error('Não consegui copiar. Toque no código abaixo, selecione e copie.')
    }
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
          {esgotado ? (
            <div role="alert" className="space-y-3 rounded-ev-xl bg-card p-5 shadow-ev-secondary">
              <h2 className="text-lg font-semibold leading-7">{pixVenceu ? 'Este Pix venceu' : 'Tempo esgotado'}</h2>
              <p className="text-sm leading-5 text-muted-foreground">{orderIdLugar ? 'Os lugares voltaram a ficar livres. Escolha de novo no mapa.' : 'Os ingressos voltaram a ficar livres. Volte e escolha de novo.'}</p>
              <Button type="button" size="lg" className="w-full rounded-full" onClick={() => { sessionStorage.removeItem(CHAVE_PIX); navigate('/checkout', { replace: true, state: orderIdLugar ? { eventId, cart: {}, abrirMapa: true } : { eventId, cart } }) }}>
                {orderIdLugar ? 'Voltar ao mapa' : 'Voltar ao pedido'}
              </Button>
            </div>
          ) : restante !== null && venceEm && (
            <p role="timer" className="flex items-center gap-2 rounded-ev-xl bg-secondary px-4 py-3 text-sm font-semibold leading-5">
              <I.Lugar size={16} aria-hidden="true" />
              {orderIdLugar ? 'Seu lugar fica' : 'Seus ingressos ficam'} reservado{orderIdLugar ? '' : 's'} por {String(Math.floor(restante / 60)).padStart(2, '0')}:{String(restante % 60).padStart(2, '0')}
            </p>
          )}

          {/* Forma de pagamento */}
          {!pixData && !gratis && !esgotado && (
            <div role="radiogroup" aria-label="Forma de pagamento" className="grid gap-2">
              <div role="radio" aria-checked="false" aria-disabled="true" className={`group ${metodo} cursor-not-allowed opacity-60`}>
                <span className={radio} aria-hidden="true" />
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold leading-5">Cartão de Crédito</span>
                  <span className="block text-[13px] leading-[18px] text-muted-foreground">Em breve</span>
                </span>
                <I.Cartao size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
              <div role="radio" aria-checked="true" className={`group ${metodo}`}>
                <span className={radio} aria-hidden="true" />
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold leading-5">Pagar com Pix</span>
                  <span className="block text-[13px] leading-[18px] text-muted-foreground">Única forma disponível agora: código Pix Copia e Cola e QR Code</span>
                </span>
              </div>
            </div>
          )}

          {!pixData && espera && !esgotado && (
            <p role="status" className="flex items-center gap-2 rounded-ev-xl bg-secondary px-4 py-3 text-sm font-semibold leading-5">
              <Spinner className="size-4" />
              Pix já gerado, aguardando pagamento
            </p>
          )}
          {!pixData && espera && !esgotado && (
            <p className="px-1 text-[13px] leading-5 text-muted-foreground">Informe seu CPF para mostrar o Pix de novo.</p>
          )}

          {!pixData && !esgotado && pedeCpf && (
            <div className="rounded-ev-xl bg-card p-5 shadow-ev-secondary">
              <label htmlFor="comprador-cpf" className={rotulo}>CPF do comprador</label>
              <Input id="comprador-cpf" type="text" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf} className={campo} disabled={!!pedidoCriado}
                aria-invalid={!!erroCpf} aria-describedby={erroCpf ? 'comprador-cpf-ajuda comprador-cpf-erro' : 'comprador-cpf-ajuda'}
                onChange={e => { setCpf(formatCPF(e.target.value)); setErroCpf(null) }} />
              {erroCpf && <p id="comprador-cpf-erro" role="alert" className="mt-1.5 text-xs text-destructive">{erroCpf}</p>}
              <p id="comprador-cpf-ajuda" className="mt-1.5 text-xs text-muted-foreground">{gratis ? 'Usamos o CPF só para limitar a compra por pessoa neste ingresso. Guardamos apenas um código (hash), não o CPF.' : 'O PagBank exige o CPF para gerar o Pix; usamos também para o limite de compra por pessoa, quando houver. Não guardamos o CPF, só um código (hash).'}</p>
            </div>
          )}

          {!pixData && !esgotado && !gratis && !orderIdLugar && !espera && (
            <div className="rounded-ev-xl bg-card p-5 shadow-ev-secondary">
              <label htmlFor="cupom" className={rotulo}>Cupom (opcional)</label>
              <Input id="cupom" type="text" autoComplete="off" autoCapitalize="characters" value={cupom} className={campo}
                aria-invalid={!!erroCupom} aria-describedby={erroCupom ? 'cupom-erro' : temMeia ? 'cupom-ajuda' : undefined}
                onChange={e => { setCupom(e.target.value); setErroCupom(null) }} />
              {erroCupom && <p id="cupom-erro" role="alert" className="mt-1.5 text-xs text-destructive">{erroCupom}</p>}
              {temMeia && <p id="cupom-ajuda" className="mt-1.5 text-xs text-muted-foreground">O cupom não vale para a meia-entrada: o desconto vale só nas inteiras.</p>}
            </div>
          )}

          {!pixData && !gratis && (
            <p className="px-1 text-[13px] leading-5 text-muted-foreground">
              Ao clicar em "Pagar Agora", geramos o código Pix Copia e Cola.
            </p>
          )}

          {/* Pix gerado: copiar o código primeiro, QR recolhido */}
          {pixData && !esgotado && (
            <div className="space-y-3 rounded-ev-xl bg-card p-5 shadow-ev-secondary">
              <h2 className="text-lg font-semibold leading-7">Efetue o pagamento Pix</h2>
              <Button type="button" size="lg" className="w-full rounded-full" onClick={copiarPix}>
                {pixCopiado && <I.Check size={16} />}
                <span>{pixCopiado ? 'Código copiado' : 'Copiar código Pix'}</span>
              </Button>
              <p role="status" className="text-sm leading-5">{pixCopiado && 'Código copiado. Abra o app do seu banco e cole na área Pix.'}</p>
              <div className="truncate rounded-ev-lg bg-secondary px-3 py-2.5 font-display text-[13px] leading-[18px] text-muted-foreground" title="Código Pix Copia e Cola">
                {pixData.copiaECola}
              </div>
              <Button type="button" variant="outline" className="rounded-full" aria-expanded={qrAberto} onClick={() => setQrAberto(!qrAberto)}>
                {qrAberto ? 'Esconder QR' : 'Mostrar QR'}
              </Button>
              {qrAberto && (
                <div className="w-fit rounded-ev-xl bg-white p-3">
                  <QRCodeSVG value={pixData.copiaECola} size={176} role="img" aria-label="QR Code Pix" />
                </div>
              )}
              <p className="text-sm leading-5 text-muted-foreground">Este Pix vale até {new Date(pixData.expiraEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</p>
              <p role="status" className="flex items-center gap-2 pt-1 text-sm font-medium leading-5">
                <Spinner className="size-4" />
                Aguardando confirmação de pagamento do banco...
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="rounded-ev-xl bg-card p-6 shadow-ev-secondary">
            {!retomada && <div className="flex justify-between gap-3 border-b border-border py-2.5 text-[15px] leading-5">
              <span>Ingressos</span>
              <span className="font-display font-semibold tabular-nums">{formatCurrency(v.subtotal)}</span>
            </div>}
            {!retomada && v.desconto > 0 && (
              <div className="flex justify-between gap-3 border-b border-border py-2.5 text-[15px] leading-5">
                <span>Desconto do cupom</span>
                <span className="font-display font-semibold tabular-nums">-{formatCurrency(v.desconto)}</span>
              </div>
            )}
            {!retomada && <div className="flex justify-between gap-3 border-b border-border py-2.5 text-[15px] leading-5 text-muted-foreground">
              <span>Taxa de serviço</span>
              <span className="font-display font-semibold tabular-nums">{formatCurrency(v.taxa)}</span>
            </div>}
            <div className="flex items-baseline justify-between gap-3 pt-3 text-base font-semibold">
              <span>Total a pagar</span>
              <span className="font-display text-xl tabular-nums">{retomada ? (totalBanco != null ? formatCurrency(totalBanco) : '...') : formatCurrency(v.total)}</span>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs leading-4 text-muted-foreground">
              <I.Info size={14} aria-hidden="true" />
              {gratis ? 'Evento gratuito: nenhum valor é cobrado.' : 'Pagamento por Pix, processado pelo PagBank. Os ingressos são emitidos quando o banco confirma o pagamento.'}
            </p>
            {!pixData && !esgotado && (
              <Button type="button" size="lg" className="mt-4 w-full rounded-full" onClick={handlePay} loading={ocupado}>
                {!gratis && <I.Cadeado size={16} />}
                {gratis ? 'Garantir ingresso grátis' : espera ? 'Mostrar o Pix de novo' : 'Pagar Agora'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
