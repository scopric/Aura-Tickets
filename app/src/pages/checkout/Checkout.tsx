import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePublicEvent } from '../../hooks/useEvents'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import ContadorIngresso from '../../components/ContadorIngresso'
import { noLimite, tetoPorPedido } from '../../lib/lotacao'
import { chaveItem, lerChave, totaisItens, vendaBloqueada } from '../../lib/pedido'
import type { Database } from '../../types/database'
import EventoCapa from '../../components/EventoCapa'
import { chaveDoLugar, itensDosLugares, tipoDoLugar, type Estado } from '../../lib/lugares'

// Match de Mesa: só maiores de 18 (o banco confere de novo no pedido, mesa_pedido_guard)
function maiorDe18(iso: string) {
  const n = new Date(iso + 'T00:00:00')
  const limite = new Date()
  limite.setFullYear(limite.getFullYear() - 18)
  return n <= limite && n.getFullYear() >= 1900
}
import { brl, textoPreco, TAXA_PERCENTUAL, TAXA_MINIMA } from '../../lib/taxa'

// Benefícios nacionais de meia-entrada (os mesmos que reservar_ingressos aceita)
const BENEFICIOS = [
  { valor: 'estudante', nome: 'Estudante' },
  { valor: 'pcd', nome: 'Pessoa com deficiência' },
  { valor: 'pcd_acompanhante', nome: 'Acompanhante de pessoa com deficiência' },
  { valor: 'jovem_baixa_renda', nome: 'Jovem de baixa renda' },
]
type Vitrine = Database['public']['Functions']['vitrine_ingressos']['Returns'][number]
// Carrinho antigo (página do evento ou sessionStorage): chave só com o id do tipo = inteira
const normalizarCarrinho = (c: Record<string, number>) => Object.fromEntries(Object.entries(c).map(([k, q]) => [k.includes('|') ? k : chaveItem(k), q]))

export default function Checkout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { eventId: stateEventId, cart: stateCart, abrirMapa } = (location.state || {}) as { eventId?: string; cart?: Record<string, number>; abrirMapa?: boolean }

  // Recuperar carrinho pendente do sessionStorage (quando volta do login)
  const pendingCheckout = (() => {
    try {
      const raw = sessionStorage.getItem('aura_pending_checkout')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })()

  const eventId = stateEventId || pendingCheckout?.eventId
  const initialCart = stateCart || pendingCheckout?.cart || {}

  const { data: event, isLoading, error } = usePublicEvent(eventId)
  const { isAuthenticated, user } = useAuth()
  const [cart, setCart] = useState<Record<string, number>>(normalizarCarrinho(initialCart || {}))
  // Meia-entrada: preço e vagas vêm do servidor (vitrine_ingressos); só esta tela lê. Falha de leitura = sem meia na tela.
  const [vitrine, setVitrine] = useState<Record<string, Vitrine>>({})
  const [meiaTipo, setMeiaTipo] = useState<Record<string, string>>({}) // benefício escolhido em cada tipo (padrão: estudante)
  const [nascimento, setNascimento] = useState('')
  const [salvandoNascimento, setSalvandoNascimento] = useState(false)

  // Mapa de Assentos: o produtor liga (is_active); o comprador escolhe o lugar e "Continuar" o reserva por 10 min (reservar_assentos)
  const [seatingMap, setSeatingMap] = useState<any | null>(null)
  const [loadingMap, setLoadingMap] = useState(false)
  const [chooseViaMap, setChooseViaMap] = useState(!!abrirMapa)
  const [escolhidos, setEscolhidos] = useState<string[]>(Array.isArray(pendingCheckout?.seats) ? pendingCheckout.seats : [])
  const [ocupados, setOcupados] = useState<Record<string, Estado>>({})
  const [reservando, setReservando] = useState(false)

  // Estados para Navegação (Pan e Zoom) no Checkout
  const [mapZoom, setMapZoom] = useState(0.8)
  const [mapPan, setMapPan] = useState({ x: 10, y: 10 })
  const [isDraggingMap, setIsDraggingMap] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const mapContainerRef = useRef<HTMLDivElement | null>(null)

  const handleAutoFit = useCallback((env: any) => {
    if (!mapContainerRef.current || !env) return
    const containerW = mapContainerRef.current.clientWidth || 500
    const containerH = mapContainerRef.current.clientHeight || 340
    
    const roomWidth = env.roomWidth || 40
    const roomHeight = env.roomHeight || 40
    const ppm = 18
    const canvasW = Math.max(60, roomWidth + 20) * ppm
    const canvasH = Math.max(60, roomHeight + 20) * ppm
    
    const fitZoom = Math.min(
      (containerW - 16) / canvasW,
      (containerH - 16) / canvasH
    )
    
    const finalZoom = Math.max(0.15, Math.min(1.5, fitZoom))
    const panX = (containerW - canvasW * finalZoom) / 2
    const panY = (containerH - canvasH * finalZoom) / 2
    
    setMapZoom(finalZoom)
    setMapPan({ x: panX, y: panY })
  }, [])

  // Efeito para ajustar mapa no carregamento e mudanças de janela
  useEffect(() => {
    if (!seatingMap || !chooseViaMap) return
    const activeEnv = seatingMap.environments?.[0]
    if (!activeEnv) return

    // Executa após a DOM atualizar
    const timer = setTimeout(() => {
      handleAutoFit(activeEnv)
    }, 150)

    const handleResize = () => {
      handleAutoFit(activeEnv)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [seatingMap, chooseViaMap, handleAutoFit])

  // Handlers para clique e arrasto (Pan)
  const handleMapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    setIsDraggingMap(true)
    setDragStart({ x: e.clientX - mapPan.x, y: e.clientY - mapPan.y })
  }

  const handleMapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingMap) return
    setMapPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMapMouseUp = () => {
    setIsDraggingMap(false)
  }

  // Toques no mobile (Touch)
  const handleMapTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    setIsDraggingMap(true)
    setDragStart({ x: touch.clientX - mapPan.x, y: touch.clientY - mapPan.y })
  }

  const handleMapTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingMap || e.touches.length !== 1) return
    const touch = e.touches[0]
    setMapPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    })
  }

  const handleMapTouchEnd = () => {
    setIsDraggingMap(false)
  }

  // Roda do mouse (Zoom)
  const handleMapWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!mapContainerRef.current) return
    
    const rect = mapContainerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const zoomFactor = 1.1
    let newZoom = mapZoom
    if (e.deltaY < 0) {
      newZoom = Math.min(3.0, mapZoom * zoomFactor)
    } else {
      newZoom = Math.max(0.15, mapZoom / zoomFactor)
    }
    
    const xs = (mouseX - mapPan.x) / mapZoom
    const ys = (mouseY - mapPan.y) / mapZoom
    
    setMapZoom(newZoom)
    setMapPan({
      x: mouseX - xs * newZoom,
      y: mouseY - ys * newZoom
    })
  }


  useEffect(() => {
    if (!eventId) return // sem evento: a tela "carrinho vazio" abaixo cuida disso

    async function loadSeatingMap() {
      setLoadingMap(true)
      const { data, error } = await supabase
        .from('seating_maps')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_active', true) // mapa desligado pelo produtor não aparece
        .maybeSingle()
        
      if (data) {
        setSeatingMap(data) // abre na seleção rápida: o carrinho da página do evento fica como veio
        await carregarOcupados()
      }
      setLoadingMap(false)
    }
    
    loadSeatingMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    let vivo = true
    ;(async () => {
      try {
        const { data } = await supabase.rpc('vitrine_ingressos' as never, { p_event_id: eventId } as never)
        if (!vivo || !Array.isArray(data)) return
        const mapa = Object.fromEntries((data as Vitrine[]).map(v => [v.ticket_type_id, v]))
        setVitrine(mapa)
      } catch { /* sem vitrine: só inteira */ }
    })()
    return () => { vivo = false }
  }, [eventId])

  // Carrinho salvo pode ter meia que já não existe (tipo sem meia) ou duas chaves de meia do mesmo tipo: ao chegar a vitrine, tira as órfãs
  // e junta as repetidas na primeira, para a contagem do teto bater com o que a tela mostra.
  useEffect(() => {
    if (!Object.keys(vitrine).length) return
    const escolhido: Record<string, string> = {}
    const novo: Record<string, number> = {}
    for (const [k, q] of Object.entries(cart)) {
      const { ticket_type_id: id, beneficio, meia_tipo } = lerChave(k)
      if (beneficio !== 'meia') { novo[k] = q; continue }
      if (vitrine[id]?.preco_meia == null) continue
      escolhido[id] ??= meia_tipo!
      const c = chaveItem(id, 'meia', escolhido[id])
      novo[c] = (novo[c] || 0) + q
    }
    const igual = Object.keys(novo).length === Object.keys(cart).length && Object.entries(novo).every(([k, q]) => cart[k] === q)
    if (!igual) setCart(novo)
    if (Object.keys(escolhido).length) setMeiaTipo(m => ({ ...m, ...escolhido }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitrine])

  // Lugares vendidos e reservados (só chave e estado; sem dado pessoal). Falha de leitura deixa tudo "livre": o banco recusa de novo ao reservar.
  async function carregarOcupados() {
    const { data } = await supabase.rpc('assentos_ocupados' as never, { p_event: eventId } as never)
    const lista = (Array.isArray(data) ? data : []) as { seat_key: string; estado: Estado }[]
    setOcupados(Object.fromEntries(lista.map(o => [o.seat_key, o.estado])))
    return lista
  }

  const ticketTypes = event?.ticket_types || []

  const updateQty = (chave: string, delta: number) => {
    const id = lerChave(chave).ticket_type_id
    if (delta > 0 && escolhidos.length) {
      toast.info('Você escolheu lugares no mapa. Para comprar pela seleção rápida, tire os lugares escolhidos.')
      return
    }
    // Match de Mesa: 1 lugar por conta em cada evento
    const max = ticketTypes.find(t => t.id === id)?.type === 'coletiva' ? 1 : Infinity
    setCart(prev => {
      const current = prev[chave] || 0
      const next = Math.min(max, Math.max(0, current + delta))
      if (next === 0) {
        const n = { ...prev }
        delete n[chave]
        return n
      }
      return { ...prev, [chave]: next }
    })
  }

  const qtdDoTipo = (id: string) => Object.entries(cart).reduce((n, [k, q]) => n + (lerChave(k).ticket_type_id === id ? q : 0), 0)
  const tipoMeia = (id: string) => meiaTipo[id] ?? 'estudante'
  // Troca o benefício da meia e leva a quantidade já escolhida para a chave nova
  const trocarBeneficio = (id: string, novo: string) => {
    const de = chaveItem(id, 'meia', tipoMeia(id))
    setMeiaTipo(m => ({ ...m, [id]: novo }))
    setCart(prev => {
      if (!prev[de]) return prev
      const { [de]: q, ...resto } = prev
      return { ...resto, [chaveItem(id, 'meia', novo)]: q }
    })
  }

  const bloqueio = (t: { sale_start?: string | null; sale_end?: string | null }) => (event ? vendaBloqueada(event, t) : null)

  const itemsRapidos = Object.entries(cart).map(([chave, qty]) => {
    const { ticket_type_id, beneficio, meia_tipo } = lerChave(chave)
    const ticket = ticketTypes.find(t => t.id === ticket_type_id)
    const vt = vitrine[ticket_type_id]
    if (!ticket) return null
    if (beneficio === 'meia') {
      if (vt?.preco_meia == null) return null // meia sem vitrine (ou tipo que já não aceita meia): fica de fora
      return { ...ticket, name: `${ticket.name} (meia-entrada)`, price: vt.preco_meia, taxa_unit: vt.taxa_meia, beneficio, meia_tipo, qty, total: vt.preco_meia * qty }
    }
    return { ...ticket, taxa_unit: vt ? vt.taxa : null, beneficio, meia_tipo, qty, total: (ticket.price || 0) * qty }
  }).filter(Boolean) as any[]
  // Com lugares escolhidos no mapa, o pedido é só deles (a seleção rápida fica de fora: um pedido não mistura os dois)
  const ambiente = seatingMap?.environments?.[0]
  const itensLugar = ambiente && escolhidos.length
    ? itensDosLugares(ambiente, escolhidos, id => { const t = ticketTypes.find(x => x.id === id); return t ? { name: t.name, price: t.price || 0 } : undefined })
    : []
  const items = itensLugar.length
    ? itensLugar.map(i => ({ ...ticketTypes.find(t => t.id === i.ticket_type_id)!, qty: i.quantity, total: i.price * i.quantity }))
    : itemsRapidos

  const resumo = totaisItens(items.map(i => ({ price: i.price || 0, quantity: i.qty, taxa_unit: i.taxa_unit })))
  const grandTotal = resumo.total
  const temColetiva = items.some(i => i.type === 'coletiva')
  const nascimentoPerfil = user?.birth_date || null

  const handleSeatClick = (seat: any) => {
    if (seat.status === 'contact') {
      toast.info(`Para comprar o(a) ${seat.label}, entre em contato com o organizador do evento pelo WhatsApp ou e-mail de suporte.`, { duration: 6000 })
      return
    }
    if (!ambiente || !tipoDoLugar(ambiente, seat)) return // bloqueado, sem ingresso ligado ou não é lugar
    const chave = chaveDoLugar(ambiente, seat)
    if (ocupados[chave]) return
    if (escolhidos.includes(chave)) return setEscolhidos(e => e.filter(k => k !== chave))
    if (Object.keys(cart).length) {
      toast.info('Você já escolheu ingressos na seleção rápida. Tire-os para escolher lugares no mapa.')
      return
    }
    setEscolhidos(e => [...e, chave])
  }

  // Grava em profiles.birth_date só se estiver vazia (conferido no cliente): com o perfil ainda carregando, nunca sobrescreve
  const salvarNascimento = async () => {
    if (!user?.id || !nascimento) return
    if (!maiorDe18(nascimento)) {
      toast.error('O Match de Mesa é só para maiores de 18. Para grupos com menores, escolha outro tipo de ingresso.')
      return
    }
    setSalvandoNascimento(true)
    try {
      // birth_date não é filtrável pela API (42501, docs/sql/20261018b_admin_s4b_colunas.sql): a conferência "só se
      // estiver vazia" é no cliente; perfil ainda não carregado (undefined) é relido antes.
      // Se depois da releitura continuar indefinido (perfil provisório, rede, 2FA sem código), NÃO grava: poderia sobrescrever
      if (useAuthStore.getState().user?.birth_date === undefined) await useAuthStore.getState().fetchProfile({ force: true })
      if (useAuthStore.getState().user?.birth_date === undefined) { toast.error('Aguarde o perfil terminar de carregar e tente de novo'); return }
      if (useAuthStore.getState().user?.birth_date) { toast.info('Seu Perfil já tinha data de nascimento: vale a que está lá.'); return }
      const { data, error } = await supabase
        .from('profiles')
        // ponytail: `as never` até regenerar os tipos do Supabase (mesmo erro em Profile.tsx)
        .update({ birth_date: nascimento } as never)
        .eq('id', user.id)
        .select('id')
      if (error) throw error
      if (!data?.length) {
        await useAuthStore.getState().fetchProfile({ force: true })
        if (useAuthStore.getState().user?.birth_date) toast.info('Seu Perfil já tinha data de nascimento: vale a que está lá.')
        else toast.error('Não foi possível salvar a data. Tente pelo seu Perfil.')
        return
      }
      const atual = useAuthStore.getState().user
      if (atual) useAuthStore.getState().setUser({ ...atual, birth_date: nascimento })
      toast.success('Data de nascimento salva no seu Perfil.')
    } catch (err) {
      toast.error((err as Error)?.message || 'Não foi possível salvar a data.')
    } finally {
      setSalvandoNascimento(false)
    }
  }

  const handleContinuePayment = () => {
    if (items.length === 0) {
      toast.error('Selecione pelo menos um ingresso para continuar.')
      return
    }
    const fechado = items.find(i => bloqueio(i))
    if (fechado) {
      toast.error(`${fechado.name}: ${bloqueio(fechado)}`)
      return
    }
    // Match de Mesa: 1 lugar por conta em cada evento (cobre o carrinho vindo do state/sessionStorage,
    // o mapa de assentos e 2 tipos coletivos no mesmo pedido)
    const coletivas = items.filter(i => i.type === 'coletiva')
    if (coletivas.length > 1 || coletivas.some(i => i.qty > 1)) {
      toast.error('No Match de Mesa é 1 lugar por conta em cada evento.')
      return
    }
    const resumoItens = items.map(i => ({ ticket_type_id: i.id, quantity: i.qty, name: i.name, price: i.price, max_por_cpf: i.max_por_cpf ?? null, beneficio: i.beneficio ?? 'inteira', meia_tipo: i.meia_tipo ?? null, taxa_unit: i.taxa_unit ?? null }))
    if (!isAuthenticated) {
      // Salvar carrinho no sessionStorage para recuperar após login
      sessionStorage.setItem('aura_pending_checkout', JSON.stringify({
        eventId,
        cart,
        seats: escolhidos,
        totalAmount: grandTotal,
        itemsSummary: resumoItens
      }))
      toast.info('Faça login para continuar sua compra.')
      navigate('/auth/login', { state: { from: '/checkout' } })
      return
    }
    // Match de Mesa: data de nascimento com 18+ antes de criar o pedido
    if (temColetiva && !nascimentoPerfil) {
      toast.error('Informe sua data de nascimento para comprar o Match de Mesa.')
      return
    }
    if (temColetiva && !maiorDe18(nascimentoPerfil!)) {
      toast.error('O Match de Mesa é só para maiores de 18. Para grupos com menores, escolha outro tipo de ingresso.')
      return
    }
    if (escolhidos.length) {
      reservarLugares(resumoItens)
      return
    }
    navigate('/checkout/payment', { state: { eventId, cart, totalAmount: grandTotal, itemsSummary: resumoItens } })
  }

  // Reserva no servidor (10 min) e segue para o pagamento com o pedido já criado pelo banco
  const reservarLugares = async (itemsSummary: { ticket_type_id: string; quantity: number; name: string; price: number }[]) => {
    setReservando(true)
    try {
      const { data, error } = await supabase.rpc('reservar_assentos' as never, { p_event: eventId, p_seats: escolhidos } as never)
      if (error) throw error
      const r = data as unknown as { order_id: string; expira_em: string; agora: string }
      // prazo pelo relógio do servidor: a diferença entre expira_em e agora vale no relógio deste aparelho
      const venceEm = Date.now() + (new Date(r.expira_em).getTime() - new Date(r.agora).getTime())
      navigate('/checkout/payment', { state: { eventId, cart: {}, totalAmount: grandTotal, itemsSummary, orderId: r.order_id, venceEm } })
    } catch (err) {
      toast.error((err as Error)?.message || 'Não foi possível reservar os lugares.', { duration: 7000 })
      const lista = await carregarOcupados() // lugar tomado por outra pessoa sai da escolha
      setEscolhidos(e => e.filter(k => !lista.some(o => o.seat_key === k)))
    } finally {
      setReservando(false)
    }
  }

  if (!eventId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground">
        <div className="max-w-md rounded-ev-2xl bg-card p-8 shadow-ev-secondary">
          <I.Carrinho size={40} className="mx-auto mb-4 text-muted-foreground" />
          <h2 className="mb-3 text-2xl font-semibold">Seu carrinho está vazio</h2>
          <p className="mb-6 text-sm text-muted-foreground">Escolha um evento e adicione ingressos para continuar.</p>
          <Button asChild size="lg" className="rounded-full">
            <Link to="/events"><I.Ingressos size={16} /> Ver eventos</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <Spinner className="mb-4 size-8" />
        <p className="text-sm text-muted-foreground">Carregando detalhes do seu pedido...</p>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground">
        <div className="max-w-md rounded-ev-2xl bg-card p-8 shadow-ev-secondary">
          <h2 className="mb-3 text-2xl font-semibold">Erro no Pedido</h2>
          <p className="mb-6 text-sm text-muted-foreground">Não conseguimos processar o seu pedido. Por favor, tente novamente.</p>
          <Button asChild size="lg" className="rounded-full">
            <Link to="/"><I.SetaEsquerda size={16} /> Voltar para Explorar</Link>
          </Button>
        </div>
      </div>
    )
  }

  const cartao = 'rounded-ev-xl bg-card p-5 shadow-ev-secondary'

  return (
    <div className="min-h-screen bg-background pb-16 text-foreground">
      <div className="mx-auto max-w-4xl px-4 pt-4 sm:px-6 lg:px-8">
        {/* Passo 2 de 3: escolha (página do evento) → pedido (aqui) → pagamento */}
        <div className="mb-6 flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="-ml-2 rounded-full" onClick={() => navigate(-1)} aria-label="Voltar">
            <I.ChevronEsquerda size={20} />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7">Seu pedido</h1>
            <p className="truncate text-[13px] leading-5 text-muted-foreground">Passo 2 de 3 · {event.title}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left: Tickets */}
          <div className="space-y-4 lg:col-span-3">
            <div className={cartao}>
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold leading-5">Ingressos</h2>
                {seatingMap && (
                  <button
                    onClick={() => setChooseViaMap(!chooseViaMap)}
                    className="text-[13px] font-semibold text-primary underline underline-offset-4"
                  >
                    {chooseViaMap ? 'Esconder o mapa do salão' : 'Ver o mapa do salão'}
                  </button>
                )}
              </div>

              {ticketTypes.length > 0 ? (
                ticketTypes.map(ticket => {
                  const chaveInteira = chaveItem(ticket.id)
                  const qty = cart[chaveInteira] || 0
                  const fechado = bloqueio(ticket)
                  const vt = vitrine[ticket.id]
                  const tipo = tipoMeia(ticket.id)
                  const qtyMeia = cart[chaveItem(ticket.id, 'meia', tipo)] || 0
                  const noTeto = qtdDoTipo(ticket.id) >= tetoPorPedido(ticket)
                  return (
                    <div key={ticket.id} className="border-t border-border first-of-type:border-t-0">
                    <div className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-medium leading-6">{ticket.name}</div>
                        <div className="text-[13px] leading-5 text-muted-foreground">{fechado ?? `${ticket.price > 0 ? `${textoPreco(ticket.price)} cada` : 'Gratuito'} · máx. ${tetoPorPedido(ticket)} por pedido`}</div>
                      </div>
                      <ContadorIngresso
                        nome={ticket.name}
                        qtd={qty}
                        onMenos={() => updateQty(chaveInteira, -1)}
                        onMais={() => updateQty(chaveInteira, 1)}
                        maisDesligado={!!fechado || (ticket.type === 'coletiva' && qty >= 1) || noLimite(ticket, qty) || noTeto || (vt?.disponiveis != null && qty >= vt.disponiveis)}
                      />
                    </div>
                    {vt?.permite_meia && vt.preco_meia != null && vt.meias_total > 0 && !fechado && (
                      <div className="space-y-2 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-medium leading-6">Meia-entrada</div>
                            <div className="text-[13px] leading-5 text-muted-foreground">{textoPreco(vt.preco_meia, 1, true)} cada · até {vt.meias_disponiveis} disponíveis</div>
                          </div>
                          <ContadorIngresso
                            nome={`${ticket.name} (meia-entrada)`}
                            qtd={qtyMeia}
                            onMenos={() => updateQty(chaveItem(ticket.id, 'meia', tipo), -1)}
                            onMais={() => updateQty(chaveItem(ticket.id, 'meia', tipo), 1)}
                            maisDesligado={noTeto || qtyMeia >= vt.meias_disponiveis}
                          />
                        </div>
                        <label htmlFor={`meia-${ticket.id}`} className="block text-[13px] font-semibold leading-5">Quem tem direito à meia</label>
                        <select id={`meia-${ticket.id}`} value={tipo} onChange={e => trocarBeneficio(ticket.id, e.target.value)} className="h-12 w-full rounded-ev-lg bg-card px-3 text-base">
                          {BENEFICIOS.map(b => <option key={b.valor} value={b.valor}>{b.nome}</option>)}
                        </select>
                        <p className="text-xs leading-4 text-muted-foreground">Ao escolher a meia-entrada, você declara ter direito ao benefício e que apresentará o documento que comprova esse direito na portaria do evento. Cupom de desconto não vale na meia-entrada.</p>
                      </div>
                    )}
                    </div>
                  )
                })
              ) : (
                <p className="py-4 text-sm text-muted-foreground">Nenhum ingresso cadastrado para este evento.</p>
              )}
            </div>

            {temColetiva && isAuthenticated && (
              !nascimentoPerfil ? (
                <div className={`${cartao} space-y-3`}>
                  <h2 className="text-[15px] font-semibold leading-5">Match de Mesa: sua data de nascimento</h2>
                  <p className="text-[13px] leading-5 text-muted-foreground">
                    Só maiores de 18 participam, com 1 lugar por conta em cada evento. A data fica no seu Perfil; os
                    colegas de mesa veem só a faixa de idade.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      aria-label="Data de nascimento"
                      value={nascimento}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setNascimento(e.target.value)}
                      className="h-12 w-auto rounded-ev-lg bg-card"
                    />
                    <Button type="button" size="lg" className="rounded-full" onClick={salvarNascimento} disabled={!nascimento || salvandoNascimento}>
                      {salvandoNascimento ? 'Salvando...' : 'Salvar data'}
                    </Button>
                  </div>
                </div>
              ) : !maiorDe18(nascimentoPerfil) && (
                <div role="alert" className="rounded-ev-xl bg-destructive/10 p-5 text-sm">
                  O Match de Mesa é só para maiores de 18. Para grupos com menores, escolha outro tipo de ingresso.
                </div>
              )
            )}

            {/* Renderização Interativa do Mapa de Assentos se ativo */}
            {seatingMap && chooseViaMap && (
              <div className={`${cartao} space-y-4`}>
                <div className="flex items-center gap-2">
                  <I.Lugar size={20} className="text-muted-foreground" />
                  <h3 className="text-[15px] font-semibold leading-5">Mapa do Salão</h3>
                </div>

                <p role="note" className="text-[13px] leading-5 text-muted-foreground">
                  Toque nos lugares livres para escolher. Ao continuar, eles ficam reservados para você por 10 minutos enquanto você paga.
                  {escolhidos.length > 0 && ' Para voltar à seleção rápida, tire os lugares escolhidos.'}
                </p>
                {escolhidos.length > 0 && (
                  <div role="status" className="flex items-center justify-between gap-3 rounded-ev-lg bg-secondary px-3 py-2 text-[13px] font-semibold leading-5">
                    <span>{escolhidos.length} {escolhidos.length === 1 ? 'lugar escolhido' : 'lugares escolhidos'}</span>
                    <button type="button" onClick={() => setEscolhidos([])} className="text-primary underline underline-offset-4">Limpar</button>
                  </div>
                )}

                {/* Legenda de Status */}
                <div className="flex flex-wrap gap-3 rounded-ev-lg bg-secondary p-2.5 text-[11px] font-semibold text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Livre</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <span>Escolhido</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                    <span>Vendido</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>Reservado</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-stone-550" style={{ backgroundColor: '#78716c' }} />
                    <span>Bloqueado</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" style={{ backgroundColor: '#0284c7' }} />
                    <span>Contato</span>
                  </div>
                </div>

                {loadingMap ? (
                  <div className="flex justify-center items-center py-12">
                    <Spinner className="size-6" />
                  </div>
                ) : (() => {
                  const activeEnv = seatingMap.environments?.[0] || seatingMap.environments?.[0]
                  if (!activeEnv) return <p className="text-xs text-espresso/70 italic">Mapa vazio.</p>
                  
                  const seats = activeEnv.seats || []
                  const walls = activeEnv.walls || []
                  const roomShape = activeEnv.roomShape || 'rectangle'
                  const roomWidth = activeEnv.roomWidth || 40
                  const roomHeight = activeEnv.roomHeight || 40
                  const roomLWidth = activeEnv.roomLWidth || 20
                  const roomLHeight = activeEnv.roomLHeight || 20
                  const roomRotation = activeEnv.roomRotation || 0
                  const ppm = 18 // Escala reduzida para visualização confortável no checkout

                  const canvasW = Math.max(60, roomWidth + 20) * ppm
                  const canvasH = Math.max(60, roomHeight + 20) * ppm

                  return (
                    <div className="light mapa-claro relative overflow-hidden rounded-ev-xl bg-stone-100 p-2 shadow-inner select-none" /* planta desenhada em branco: fica clara nos dois temas */>
                      {/* Controles de Zoom Flutuantes */}
                      <div className="absolute bottom-3 right-3 z-35 flex items-center gap-1 bg-white/95 dark:bg-canvas/90 backdrop-blur-xs p-1 rounded-xl border border-stone-200/80 shadow-md">
                        <button 
                          onClick={(ev) => {
                            ev.stopPropagation()
                            setMapZoom(z => Math.max(0.15, z - 0.15))
                          }}
                          title="Afastar"
                          className="p-1.5 rounded-lg hover:bg-stone-50 text-espresso/70 hover:text-espresso transition-colors"
                        >
                          <I.Reduzir size={14} />
                        </button>
                        <span className="text-[10px] font-mono font-bold text-espresso/80 w-10 text-center">
                          {Math.round(mapZoom * 100)}%
                        </span>
                        <button 
                          onClick={(ev) => {
                            ev.stopPropagation()
                            setMapZoom(z => Math.min(3.0, z + 0.15))
                          }}
                          title="Aproximar"
                          className="p-1.5 rounded-lg hover:bg-stone-50 text-espresso/70 hover:text-espresso transition-colors"
                        >
                          <I.Ampliar size={14} />
                        </button>
                        <button 
                          onClick={(ev) => {
                            ev.stopPropagation()
                            handleAutoFit(activeEnv)
                          }}
                          title="Auto-Ajustar (Centralizar)"
                          className="p-1.5 rounded-lg hover:bg-stone-50 text-espresso/70 hover:text-espresso transition-colors border-l border-stone-200"
                        >
                          <I.Restaurar size={14} />
                        </button>
                      </div>

                      {/* Contêiner de Visualização (Viewport) */}
                      <div 
                        ref={mapContainerRef}
                        className="w-full h-[360px] relative overflow-hidden cursor-grab active:cursor-grabbing"
                        onMouseDown={handleMapMouseDown}
                        onMouseMove={handleMapMouseMove}
                        onMouseUp={handleMapMouseUp}
                        onMouseLeave={handleMapMouseUp}
                        onTouchStart={handleMapTouchStart}
                        onTouchMove={handleMapTouchMove}
                        onTouchEnd={handleMapTouchEnd}
                        onWheel={handleMapWheel}
                      >
                        <div 
                          className="absolute origin-top-left"
                          style={{ 
                            width: canvasW, 
                            height: canvasH,
                            transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})`,
                          }}
                        >
                          {/* Contorno do Pavilhão */}
                          {roomShape === 'rectangle' && (
                            <div 
                              className="absolute border-stone-650 bg-white dark:bg-white/5 shadow pointer-events-none transition-all"
                              style={{
                                left: 10 * ppm,
                                top: 10 * ppm,
                                width: roomWidth * ppm,
                                height: roomHeight * ppm,
                                borderWidth: `${Math.max(2, 0.2 * ppm)}px`,
                                transform: `rotate(${roomRotation}deg)`,
                                transformOrigin: 'top left',
                                zIndex: 0
                              }}
                            />
                          )}

                          {roomShape === 'l_shape' && (
                            <svg 
                              className="absolute pointer-events-none overflow-visible transition-all"
                              style={{
                                left: 10 * ppm,
                                top: 10 * ppm,
                                width: roomWidth * ppm,
                                height: roomHeight * ppm,
                                transform: `rotate(${roomRotation}deg)`,
                                transformOrigin: 'top left',
                                zIndex: 0
                              }}
                            >
                              <polygon 
                                points={`
                                  0,0 
                                  ${roomWidth * ppm},0 
                                  ${roomWidth * ppm},${(roomHeight - roomLHeight) * ppm} 
                                  ${(roomWidth - roomLWidth) * ppm},${(roomHeight - roomLHeight) * ppm} 
                                  ${(roomWidth - roomLWidth) * ppm},${roomHeight * ppm} 
                                  0,${roomHeight * ppm}
                                `}
                                fill="#ffffff"
                                stroke="#44403c"
                                strokeWidth={Math.max(2, 0.2 * ppm)}
                                strokeLinejoin="miter"
                              />
                            </svg>
                          )}

                          {/* Muros */}
                          {walls.map((w: any) => {
                            const p1x = w.x1 * ppm
                            const p1y = w.y1 * ppm
                            const p2x = w.x2 * ppm
                            const p2y = w.y2 * ppm
                            const len = Math.hypot(p2x - p1x, p2y - p1y)
                            const angle = Math.atan2(p2y - p1y, p2x - p1x) * (180 / Math.PI)
                            const thickPx = w.thickness * ppm

                            return (
                              <div 
                                key={w.id}
                                className="absolute origin-top-left pointer-events-none"
                                style={{
                                  left: p1x,
                                  top: p1y,
                                  width: len,
                                  height: thickPx,
                                  backgroundColor: w.color || '#4b5563',
                                  transform: `translateY(${-thickPx / 2}px) rotate(${angle}deg)`,
                                  zIndex: 1
                                }}
                              />
                            )
                          })}

                          {/* Assentos */}
                          {seats.map((s: any) => {
                            const w = (s.widthMeter || 0.5) * ppm
                            const h = (s.heightMeter || 0.5) * ppm

                            const chave = chaveDoLugar(activeEnv, s)
                            const vendavel = !!tipoDoLugar(activeEnv, s)
                            const estado = ocupados[chave]
                            const escolhido = escolhidos.includes(chave)
                            const livre = vendavel && !estado
                            let statusColor = escolhido ? '#2563eb' : s.color
                            if (s.status === 'sold' || estado === 'vendido') statusColor = '#dc2626'
                            else if (s.status === 'reserved' || estado === 'reservado') statusColor = '#d97706'
                            else if (s.status === 'blocked') statusColor = '#78716c'
                            else if (s.status === 'contact') statusColor = '#0284c7'

                            return (
                              <div
                                key={s.id}
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  handleSeatClick(s)
                                }}
                                tabIndex={livre ? 0 : undefined}
                                onKeyDown={livre ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handleSeatClick(s) } } : undefined}
                                role={livre ? 'button' : undefined}
                                aria-pressed={livre ? escolhido : undefined}
                                aria-label={livre ? `${s.label || 'Lugar'}${escolhido ? ', escolhido' : ''}` : undefined}
                                className={`absolute origin-center transition-all ${s.status === 'contact' || livre ? 'hover:scale-105 hover:brightness-105 active:scale-95 cursor-pointer' : s.status === 'free' && !estado ? '' : 'opacity-55 cursor-not-allowed'} z-10`}
                                style={{
                                  left: s.x * ppm - w / 2,
                                  top: s.y * ppm - h / 2,
                                  width: w,
                                  height: h,
                                  transform: `rotate(${s.rotation || 0}deg)`,
                                }}
                              >
                                {s.type === 'seat' && (
                                  <div 
                                    className="w-full h-full rounded border flex items-center justify-center bg-white dark:bg-white/5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                                    style={{ borderColor: statusColor, background: `${statusColor}10` }}
                                  >
                                    <I.Lugar size={10} style={{ color: statusColor }} />
                                  </div>
                                )}

                                {s.type === 'table' && (
                                  <div className="w-full h-full relative flex items-center justify-center">
                                    <div 
                                      className={`border flex flex-col items-center justify-center shadow-xs bg-white dark:bg-white/5 z-10 ${s.tableShape === 'circle' ? 'rounded-full' : s.tableShape === 'square' ? 'rounded-sm' : 'rounded'}`}
                                      style={{ 
                                        borderColor: statusColor, 
                                        width: '72%', 
                                        height: '72%',
                                        background: '#ffffff'
                                      }}
                                    >
                                      <span className="text-[5px] font-bold text-espresso/90 truncate max-w-[85%] leading-none">{s.label}</span>
                                    </div>
                                    
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0">
                                      {(() => {
                                        const count = s.seatsCount || s.capacity || 6
                                        const chairs = []
                                        const chairSize = 5.5

                                        if (s.tableShape === 'circle') {
                                          const radiusX = w / 2
                                          const radiusY = h / 2
                                          for (let i = 0; i < count; i++) {
                                            const angle = (i * 2 * Math.PI) / count
                                            const cx = w / 2 + Math.cos(angle) * (radiusX * 0.94)
                                            const cy = h / 2 + Math.sin(angle) * (radiusY * 0.94)
                                            chairs.push(
                                              <circle 
                                                key={`chair-${i}`}
                                                cx={cx} 
                                                cy={cy} 
                                                r={chairSize / 2}
                                                fill="#ffffff" 
                                                stroke={statusColor} 
                                                strokeWidth="0.8"
                                              />
                                            )
                                          }
                                        } else {
                                          const pad = 2
                                          const rw = w - pad * 2
                                          const rh = h - pad * 2
                                          const peri = 2 * (rw + rh)
                                          for (let i = 0; i < count; i++) {
                                            const dist = ((i + 0.5) * peri) / count
                                            let cx = 0
                                            let cy = 0
                                            if (dist < rw) { cx = pad + dist; cy = pad }
                                            else if (dist < rw + rh) { cx = pad + rw; cy = pad + (dist - rw) }
                                            else if (dist < rw * 2 + rh) { cx = pad + rw - (dist - rw - rh); cy = pad + rh }
                                            else { cx = pad; cy = pad + rh - (dist - rw * 2 - rh) }
                                            chairs.push(
                                              <circle 
                                                key={`chair-${i}`}
                                                cx={cx} 
                                                cy={cy} 
                                                r={chairSize / 2}
                                                fill="#ffffff" 
                                                stroke={statusColor} 
                                                strokeWidth="0.8"
                                              />
                                            )
                                          }
                                        }
                                        return chairs
                                      })()}
                                    </svg>
                                  </div>
                                )}

                                {s.type !== 'seat' && s.type !== 'table' && (
                                  <div 
                                    className="w-full h-full rounded-sm border flex flex-col items-center justify-center text-[5px] font-bold text-center bg-white dark:bg-white/5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-0.5 overflow-hidden"
                                    style={{ borderColor: statusColor, background: `${statusColor}05`, color: statusColor }}
                                  >
                                    <span className="truncate max-w-full leading-none">{s.label}</span>
                                  </div>
                                )}

                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Event Info */}
            <div className={cartao}>
              <h2 className="mb-4 text-[15px] font-semibold leading-5">Resumo do Evento</h2>
              <div className="flex items-start gap-4">
                <EventoCapa evento={event} tamanho="mini" />
                <div className="min-w-0">
                  <div className="text-base font-medium leading-6">{event.title}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[13px] leading-5 text-muted-foreground">
                    <I.Agenda size={16} />
                    {event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Data a definir'}
                  </div>
                  <div className="flex items-center gap-1.5 text-[13px] leading-5 text-muted-foreground">
                    <I.Local size={16} />
                    {event.venue_name || event.location || 'Local a definir'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 rounded-ev-xl bg-card p-6 shadow-ev-secondary">
              <h2 className="mb-4 text-[15px] font-semibold leading-5">Resumo</h2>
              {items.length > 0 ? (
                <div className="mb-4">
                  {items.map((item, i) => (
                    <div key={i} className="flex justify-between gap-3 border-b border-border py-2.5 text-[15px] leading-5">
                      <span>{item.qty} × {item.name}</span>
                      <span className="font-display font-semibold tabular-nums">{brl(item.total || 0)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-4 text-sm text-muted-foreground">Seu carrinho está vazio.</p>
              )}

              <div className="space-y-2">
                <div className="flex justify-between gap-3 text-[15px] leading-5">
                  <span>Ingressos</span>
                  <span className="font-display font-semibold tabular-nums">{brl(resumo.subtotal)}</span>
                </div>
                <div className="flex justify-between gap-3 text-[15px] leading-5 text-muted-foreground">
                  <span>Taxa de serviço ({TAXA_PERCENTUAL}%{items.some(i => i.beneficio === 'meia') ? '; mín. ' + brl(TAXA_MINIMA) + ' por inteira' : ', mín. ' + brl(TAXA_MINIMA) + ' por ingresso'})</span>
                  <span className="font-display font-semibold tabular-nums">{brl(resumo.taxa)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3 pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span className="font-display text-xl tabular-nums">{brl(grandTotal)}</span>
                </div>
              </div>

              <Button
                type="button"
                size="lg"
                className="mt-5 w-full rounded-full"
                onClick={handleContinuePayment}
                disabled={items.length === 0 || reservando}
                loading={reservando}
              >
                {isAuthenticated ? (
                  <>
                    <I.Cartao size={16} />
                    Continuar para Pagamento
                  </>
                ) : (
                  <>
                    <I.Entrar size={16} />
                    Entrar e Continuar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
