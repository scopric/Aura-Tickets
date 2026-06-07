import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Minus, Plus, Ticket, MapPin, Calendar, CreditCard, Loader2, LogIn, Lock, Info, Building2, Armchair, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePublicEvent } from '../../hooks/useEvents'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

export default function Checkout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { eventId: stateEventId, cart: stateCart } = (location.state || {}) as { eventId?: string; cart?: Record<string, number> }

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
  const { isAuthenticated } = useAuth()
  const [cart, setCart] = useState<Record<string, number>>(initialCart || {})

  // Estados do Mapa de Assentos
  const [seatingMap, setSeatingMap] = useState<any | null>(null)
  const [loadingMap, setLoadingMap] = useState(false)
  const [selectedSeats, setSelectedSeats] = useState<Record<string, { seatId: string; label: string; price: number; ticketTypeId: string; occupantName: string }>>(
    pendingCheckout?.selectedSeats || {}
  )
  const [chooseViaMap, setChooseViaMap] = useState(false)
  const [occupantModal, setOccupantModal] = useState<{
    open: boolean
    seatId: string
    label: string
    ticketTypeId: string
    price: number
  } | null>(null)
  const [tempOccupantName, setTempOccupantName] = useState('')

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
    if (!eventId) {
      toast.error('Nenhum evento selecionado para checkout.')
      navigate('/')
      return
    }

    async function loadSeatingMap() {
      setLoadingMap(true)
      const { data, error } = await supabase
        .from('seating_maps')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle()
        
      if (data) {
        setSeatingMap(data)
        setChooseViaMap(true)
      } else {
        const local = localStorage.getItem(`seating_map_${eventId}`)
        if (local) {
          try {
            setSeatingMap(JSON.parse(local))
            setChooseViaMap(true)
          } catch (e) {
            console.error('Erro ao ler mapa local no checkout', e)
          }
        }
      }
      setLoadingMap(false)
    }
    
    loadSeatingMap()
  }, [eventId, navigate])

  // Sincronizar carrinho com os assentos escolhidos no mapa
  useEffect(() => {
    if (seatingMap) {
      const newCart: Record<string, number> = {}
      Object.values(selectedSeats).forEach(s => {
        newCart[s.ticketTypeId] = (newCart[s.ticketTypeId] || 0) + 1
      })
      setCart(newCart)
    }
  }, [selectedSeats, seatingMap])

  const ticketTypes = event?.ticket_types || []

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const current = prev[id] || 0
      const next = Math.max(0, current + delta)
      if (next === 0) {
        const n = { ...prev }
        delete n[id]
        return n
      }
      return { ...prev, [id]: next }
    })
  }

  const items = Object.entries(cart).map(([id, qty]) => {
    const ticket = ticketTypes.find(t => t.id === id)
    if (!ticket) return null
    return { ...ticket, qty, total: (ticket.price || 0) * qty }
  }).filter(Boolean) as any[]

  const total = items.reduce((s, i) => s + (i.total || 0), 0)
  const fees = Number((total * 0.05).toFixed(2)) // 5% fee
  const grandTotal = total + fees

  const handleSeatClick = (seat: any) => {
    if (seat.status === 'contact') {
      toast.info(`Para comprar o(a) ${seat.label}, entre em contato com o organizador do evento pelo WhatsApp ou e-mail de suporte.`, { duration: 6000 })
      return
    }
    if (seat.status !== 'free') return
    
    if (selectedSeats[seat.id]) {
      setSelectedSeats(prev => {
        const next = { ...prev }
        delete next[seat.id]
        return next
      })
      return
    }
    
    setOccupantModal({
      open: true,
      seatId: seat.id,
      label: seat.label,
      ticketTypeId: seat.sectionId,
      price: seat.price
    })
    setTempOccupantName('')
  }

  const handleConfirmSeat = () => {
    if (!tempOccupantName.trim()) {
      toast.error('Por favor, informe o nome do ocupante.')
      return
    }
    if (!occupantModal) return
    
    setSelectedSeats(prev => ({
      ...prev,
      [occupantModal.seatId]: {
        seatId: occupantModal.seatId,
        label: occupantModal.label,
        price: occupantModal.price,
        ticketTypeId: occupantModal.ticketTypeId,
        occupantName: tempOccupantName
      }
    }))
    
    setOccupantModal(null)
    toast.success(`${occupantModal.label} reservado(a) no seu carrinho!`)
  }

  const handleContinuePayment = () => {
    if (items.length === 0) {
      toast.error('Selecione pelo menos um ingresso para continuar.')
      return
    }
    if (!isAuthenticated) {
      // Salvar carrinho no sessionStorage para recuperar após login
      sessionStorage.setItem('aura_pending_checkout', JSON.stringify({
        eventId,
        cart,
        selectedSeats,
        totalAmount: grandTotal,
        itemsSummary: items.map(i => ({ ticket_type_id: i.id, quantity: i.qty, name: i.name, price: i.price }))
      }))
      toast.info('Faça login para continuar sua compra.')
      navigate('/auth/login', { state: { from: '/checkout' } })
      return
    }
    navigate('/checkout/payment', {
      state: {
        eventId,
        cart,
        selectedSeats,
        totalAmount: grandTotal,
        itemsSummary: items.map(i => ({ ticket_type_id: i.id, quantity: i.qty, name: i.name, price: i.price }))
      }
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando detalhes do seu pedido...</p>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white/60 border border-white/60 rounded-3xl p-8 backdrop-blur-sm shadow-elevated">
          <h2 className="font-serif text-2xl text-espresso mb-3">Erro no Pedido</h2>
          <p className="text-sm text-espresso/60 mb-6">Não conseguimos processar o seu pedido. Por favor, tente novamente.</p>
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar para Explorar
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-serif text-3xl text-espresso">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Tickets */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg text-espresso">Ingressos</h2>
                {seatingMap && (
                  <button
                    onClick={() => setChooseViaMap(!chooseViaMap)}
                    className="text-xs font-bold text-plum hover:underline"
                  >
                    {chooseViaMap ? 'Seleção rápida de ingressos' : 'Escolher assentos no mapa'}
                  </button>
                )}
              </div>
              
              {ticketTypes.length > 0 ? (
                ticketTypes.map(ticket => {
                  const qty = cart[ticket.id] || 0
                  return (
                    <div key={ticket.id} className="flex items-center gap-4 py-4 border-b border-espresso/5 last:border-0">
                      <div className="w-10 h-10 rounded-xl bg-plum/10 flex items-center justify-center">
                        <Ticket className="w-5 h-5 text-plum" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-espresso">{ticket.name}</div>
                        <div className="text-xs text-espresso/40">R$ {ticket.price} cada</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {chooseViaMap ? (
                          <div className="text-xs font-bold text-plum/70 bg-plum/5 px-2.5 py-1 rounded-full border border-plum/15 font-mono">
                            {qty} assento(s)
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => updateQty(ticket.id, -1)}
                              className="w-8 h-8 rounded-full bg-espresso/5 flex items-center justify-center text-espresso hover:bg-plum/10 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-medium">{qty}</span>
                            <button
                              onClick={() => updateQty(ticket.id, 1)}
                              className="w-8 h-8 rounded-full bg-espresso/5 flex items-center justify-center text-espresso hover:bg-plum/10 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-espresso/40 italic py-4">Nenhum ingresso cadastrado para este evento.</p>
              )}
            </div>

            {/* Renderização Interativa do Mapa de Assentos se ativo */}
            {seatingMap && chooseViaMap && (
              <div className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-plum" />
                  <h3 className="font-serif text-base text-espresso">Mapa do Salão - Seleção de Poltronas/Mesas</h3>
                </div>
                
                <p className="text-xs text-espresso/60">
                  Clique nos assentos/mesas livres (em verde/cores do setor) para reservá-los digitando o nome do ocupante. Assentos azuis requerem contato.
                </p>

                {/* Legenda de Status */}
                <div className="flex flex-wrap gap-3 text-[9px] font-bold text-espresso/60 bg-stone-50 p-2.5 rounded-xl border border-stone-200/50">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Livre</span>
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
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600" style={{ backgroundColor: '#7c3aed' }} />
                    <span>Meu Carrinho</span>
                  </div>
                </div>

                {loadingMap ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-plum" />
                  </div>
                ) : (() => {
                  const activeEnv = seatingMap.environments?.[0] || seatingMap.environments?.[0]
                  if (!activeEnv) return <p className="text-xs text-espresso/40 italic">Mapa vazio.</p>
                  
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
                    <div className="relative border border-stone-200/50 rounded-2xl bg-stone-100 p-2 shadow-inner overflow-hidden select-none">
                      {/* Controles de Zoom Flutuantes */}
                      <div className="absolute bottom-3 right-3 z-35 flex items-center gap-1 bg-white/95 backdrop-blur-xs p-1 rounded-xl border border-stone-200/80 shadow-md">
                        <button 
                          onClick={(ev) => {
                            ev.stopPropagation()
                            setMapZoom(z => Math.max(0.15, z - 0.15))
                          }}
                          title="Afastar"
                          className="p-1.5 rounded-lg hover:bg-stone-50 text-espresso/60 hover:text-espresso transition-colors"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
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
                          className="p-1.5 rounded-lg hover:bg-stone-50 text-espresso/60 hover:text-espresso transition-colors"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(ev) => {
                            ev.stopPropagation()
                            handleAutoFit(activeEnv)
                          }}
                          title="Auto-Ajustar (Centralizar)"
                          className="p-1.5 rounded-lg hover:bg-stone-50 text-espresso/60 hover:text-espresso transition-colors border-l border-stone-200"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
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
                              className="absolute border-stone-650 bg-white shadow pointer-events-none transition-all"
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
                            const isSelected = !!selectedSeats[s.id]
                            const w = (s.widthMeter || 0.5) * ppm
                            const h = (s.heightMeter || 0.5) * ppm

                            let statusColor = s.color
                            if (isSelected) statusColor = '#7c3aed'
                            else if (s.status === 'sold') statusColor = '#dc2626'
                            else if (s.status === 'reserved') statusColor = '#d97706'
                            else if (s.status === 'blocked') statusColor = '#78716c'
                            else if (s.status === 'contact') statusColor = '#0284c7'

                            return (
                              <div
                                key={s.id}
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  handleSeatClick(s)
                                }}
                                className={`absolute origin-center transition-all ${s.status === 'free' || s.status === 'contact' || isSelected ? 'hover:scale-105 hover:brightness-105 active:scale-95 cursor-pointer' : 'opacity-55 cursor-not-allowed'} ${isSelected ? 'z-20 scale-105' : 'z-10'}`}
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
                                    className="w-full h-full rounded border flex items-center justify-center bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                                    style={{ borderColor: statusColor, background: isSelected ? `${statusColor}25` : `${statusColor}10` }}
                                  >
                                    <Armchair className="w-2.5 h-2.5" style={{ color: statusColor }} />
                                  </div>
                                )}

                                {s.type === 'table' && (
                                  <div className="w-full h-full relative flex items-center justify-center">
                                    <div 
                                      className={`border flex flex-col items-center justify-center shadow-xs bg-white z-10 ${s.tableShape === 'circle' ? 'rounded-full' : s.tableShape === 'square' ? 'rounded-sm' : 'rounded'}`}
                                      style={{ 
                                        borderColor: statusColor, 
                                        width: '72%', 
                                        height: '72%',
                                        background: isSelected ? `${statusColor}15` : '#ffffff'
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
                                    className="w-full h-full rounded-sm border flex flex-col items-center justify-center text-[5px] font-bold text-center bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-0.5 overflow-hidden"
                                    style={{ borderColor: statusColor, background: isSelected ? `${statusColor}15` : `${statusColor}05`, color: statusColor }}
                                  >
                                    <span className="truncate max-w-full leading-none">{s.label}</span>
                                  </div>
                                )}

                                {(isSelected && selectedSeats[s.id]?.occupantName) && (
                                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 bg-stone-850 text-white text-[5px] rounded whitespace-nowrap pointer-events-none font-bold z-10 shadow">
                                    {selectedSeats[s.id].occupantName}
                                  </div>
                                )}
                                
                                {(!isSelected && s.occupantName) && (
                                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 bg-stone-750 text-white text-[5px] rounded whitespace-nowrap pointer-events-none font-bold z-10 shadow">
                                    Dono: {s.occupantName}
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
            <div className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
              <h2 className="font-serif text-lg text-espresso mb-4">Resumo do Evento</h2>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={event.cover_image || '/images/hero-bg.jpg'} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-sm font-medium text-espresso">{event.title}</div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-espresso/50">
                    <Calendar className="w-3 h-3" />
                    {event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Data a definir'}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-espresso/50">
                    <MapPin className="w-3 h-3" />
                    {event.venue_name || event.location || 'Local a definir'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-2">
            <div className="p-6 rounded-2xl bg-void text-cream sticky top-24">
              <h2 className="font-serif text-xl mb-6">Resumo</h2>
              {items.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-cream/60">{item.name} x{item.qty}</span>
                      <span className="font-medium">R$ {item.total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-cream/40 italic mb-6">Seu carrinho está vazio.</p>
              )}
              
              <div className="border-t border-white/10 pt-4 space-y-2">
                <div className="flex justify-between text-sm text-cream/50">
                  <span>Subtotal</span>
                  <span>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-cream/50">
                  <span>Taxas (5%)</span>
                  <span>R$ {fees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-lg font-serif pt-2 border-t border-white/10">
                  <span>Total</span>
                  <span>R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              
              <button
                onClick={handleContinuePayment}
                disabled={items.length === 0}
                className="mt-6 w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isAuthenticated ? (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Continuar para Pagamento
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Entrar e Continuar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Ocupante */}
      {occupantModal && occupantModal.open && (
        <div className="fixed inset-0 bg-void/50 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fade-in">
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 max-w-sm w-full space-y-4 shadow-elevated">
            <div className="flex items-center gap-2 text-plum">
              <Ticket className="w-5 h-5" />
              <h3 className="font-serif text-lg text-espresso">Identificar Assento</h3>
            </div>
            <p className="text-xs text-espresso/60 font-medium">
              Digite o nome completo da pessoa que irá ocupar o(a) <strong className="text-plum">{occupantModal.label}</strong> (Lote: R$ {occupantModal.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).
            </p>
            <div>
              <label htmlFor="modal-occ-inp" className="block text-[9px] text-espresso/40 uppercase mb-1 font-bold">Nome do Ocupante</label>
              <input 
                id="modal-occ-inp"
                type="text"
                value={tempOccupantName}
                onChange={e => setTempOccupantName(e.target.value)}
                placeholder="Nome completo do ocupante"
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-bold text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 shadow-xs"
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setOccupantModal(null)}
                className="flex-1 py-2 rounded-full border border-stone-200 hover:bg-stone-50 text-xs font-bold text-espresso/60 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSeat}
                className="flex-1 py-2 rounded-full bg-plum text-cream hover:bg-plum/90 hover:shadow-glow text-xs font-bold transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
