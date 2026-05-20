import { useState, useEffect, useRef } from 'react'
import {
  ScanLine, CheckCircle2, XCircle, Clock, Users,
  Search, Ticket, AlertTriangle, Zap
} from 'lucide-react'
import { toast } from 'sonner'

interface TicketCheck {
  id: string
  name: string
  email: string
  ticketType: string
  ticketCode: string
  status: 'pendente' | 'usado' | 'cancelado'
  checkInTime: string | null
  seat: string
  avatar: string
  eventName: string
}

const mockTickets: TicketCheck[] = [
  { id: 't1', name: 'Ana Costa', email: 'ana@email.com', ticketType: 'VIP', ticketCode: 'AUR-2025-001', status: 'pendente', checkInTime: null, seat: 'Mesa 3', avatar: 'https://i.pravatar.cc/150?img=5', eventName: 'Noite Eletro 2025' },
  { id: 't2', name: 'Pedro Lima', email: 'pedro@email.com', ticketType: 'Pista', ticketCode: 'AUR-2025-002', status: 'usado', checkInTime: '17 Mai, 22:15', seat: '-', avatar: 'https://i.pravatar.cc/150?img=3', eventName: 'Noite Eletro 2025' },
  { id: 't3', name: 'Maria Souza', email: 'maria@email.com', ticketType: 'Mesa Coletiva', ticketCode: 'AUR-2025-003', status: 'pendente', checkInTime: null, seat: 'Mesa 1', avatar: 'https://i.pravatar.cc/150?img=9', eventName: 'Noite Eletro 2025' },
  { id: 't4', name: 'Joao Silva', email: 'joao@email.com', ticketType: 'VIP', ticketCode: 'AUR-2025-004', status: 'usado', checkInTime: '17 Mai, 21:30', seat: 'Mesa 2', avatar: 'https://i.pravatar.cc/150?img=11', eventName: 'Noite Eletro 2025' },
  { id: 't5', name: 'Fernanda Rocha', email: 'fernanda@email.com', ticketType: 'Pista', ticketCode: 'AUR-2025-005', status: 'pendente', checkInTime: null, seat: '-', avatar: 'https://i.pravatar.cc/150?img=10', eventName: 'Noite Eletro 2025' },
  { id: 't6', name: 'Lucas Oliveira', email: 'lucas@email.com', ticketType: 'VIP', ticketCode: 'AUR-2025-006', status: 'cancelado', checkInTime: null, seat: 'Mesa 4', avatar: 'https://i.pravatar.cc/150?img=8', eventName: 'Noite Eletro 2025' },
  { id: 't7', name: 'Beatriz Lima', email: 'bia@email.com', ticketType: 'Pista', ticketCode: 'AUR-2025-007', status: 'pendente', checkInTime: null, seat: '-', avatar: 'https://i.pravatar.cc/150?img=20', eventName: 'Noite Eletro 2025' },
  { id: 't8', name: 'Rafael Torres', email: 'rafael@email.com', ticketType: 'VIP', ticketCode: 'AUR-2025-008', status: 'pendente', checkInTime: null, seat: 'Mesa 5', avatar: 'https://i.pravatar.cc/150?img=13', eventName: 'Noite Eletro 2025' },
]

export default function ProducerCheckIn() {
  const [tickets, setTickets] = useState<TicketCheck[]>(mockTickets)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'scanner' | 'list'>('scanner')
  const [lastScan, setLastScan] = useState<{ ticket: TicketCheck; success: boolean } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const total = tickets.length
  const checked = tickets.filter(t => t.status === 'usado').length
  const pending = tickets.filter(t => t.status === 'pendente').length
  const cancelled = tickets.filter(t => t.status === 'cancelado').length
  const progress = total > 0 ? (checked / total) * 100 : 0

  const filtered = tickets.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.ticketCode.toLowerCase().includes(search.toLowerCase())
  )

  const handleScan = (code: string) => {
    const ticket = tickets.find(t => t.ticketCode.toLowerCase() === code.toLowerCase())
    if (!ticket) {
      setLastScan({ ticket: { id: '', name: 'Nao encontrado', email: '', ticketType: '', ticketCode: code, status: 'pendente', checkInTime: null, seat: '', avatar: '', eventName: '' }, success: false })
      toast.error('Ingresso nao encontrado!')
      return
    }
    if (ticket.status === 'usado') {
      setLastScan({ ticket, success: false })
      toast.warning('Ingresso ja foi utilizado!')
      return
    }
    if (ticket.status === 'cancelado') {
      setLastScan({ ticket, success: false })
      toast.error('Ingresso cancelado!')
      return
    }
    const updated = tickets.map(t =>
      t.id === ticket.id ? { ...t, status: 'usado' as const, checkInTime: new Date().toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } : t
    )
    setTickets(updated)
    setLastScan({ ticket: { ...ticket, status: 'usado', checkInTime: 'Agora' }, success: true })
    toast.success(`Bem-vindo, ${ticket.name}!`)
  }

  const manualCheckIn = (id: string) => {
    const ticket = tickets.find(t => t.id === id)
    if (!ticket || ticket.status !== 'pendente') return
    const updated = tickets.map(t =>
      t.id === id ? { ...t, status: 'usado' as const, checkInTime: new Date().toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } : t
    )
    setTickets(updated)
    toast.success(`${ticket.name} confirmado!`)
  }

  useEffect(() => {
    if (mode === 'scanner' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [mode])

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Check-in</h1>
          <p className="text-sm text-espresso/50 mt-1">Escaneie ou busque ingressos na porta do evento</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMode('scanner')} className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${mode === 'scanner' ? 'bg-plum text-cream' : 'bg-white/40 border border-white/60 text-espresso/50'}`}>
            <ScanLine className="w-4 h-4 inline mr-1.5" /> Scanner
          </button>
          <button onClick={() => setMode('list')} className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${mode === 'list' ? 'bg-plum text-cream' : 'bg-white/40 border border-white/60 text-espresso/50'}`}>
            <Users className="w-4 h-4 inline mr-1.5" /> Lista
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total', value: total.toString(), icon: Ticket, color: 'text-plum' },
          { label: 'Entraram', value: checked.toString(), icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Pendentes', value: pending.toString(), icon: Clock, color: 'text-amber-600' },
          { label: 'Cancelados', value: cancelled.toString(), icon: XCircle, color: 'text-red-400' },
        ].map(k => (
          <div key={k.label} className="p-4 rounded-2xl bg-white/60 border border-white/60 text-center">
            <k.icon className={`w-4 h-4 ${k.color} mx-auto mb-1.5`} />
            <div className={`font-serif text-xl ${k.color}`}>{k.value}</div>
            <div className="text-[10px] text-espresso/40">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="mb-8 p-4 rounded-2xl bg-white/60 border border-white/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-espresso/50">Progresso do check-in</span>
          <span className="text-xs font-medium text-plum">{progress.toFixed(0)}% · {checked}/{total}</span>
        </div>
        <div className="w-full h-3 bg-canvas rounded-full overflow-hidden">
          <div className="h-full bg-plum rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Scanner Mode */}
      {mode === 'scanner' && (
        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-white/60 border border-white/60 text-center">
            <div className="w-20 h-20 rounded-full bg-plum/10 flex items-center justify-center mx-auto mb-4">
              <ScanLine className="w-10 h-10 text-plum" />
            </div>
            <p className="text-sm text-espresso/60 mb-4">Escaneie o QR code ou digite o codigo do ingresso</p>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); if (e.target.value.length >= 8) { handleScan(e.target.value); setSearch('') } }}
              onKeyDown={e => { if (e.key === 'Enter' && search.length >= 3) { handleScan(search); setSearch('') } }}
              placeholder="Digite o codigo do ingresso..."
              className="w-full max-w-sm mx-auto px-6 py-4 bg-white/60 border border-white/60 rounded-full text-center text-lg text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 font-mono tracking-wider"
            />
          </div>

          {/* Last Scan Result */}
          {lastScan && (
            <div className={`p-6 rounded-2xl border ${lastScan.success ? 'bg-green-50/60 border-green-200/60' : lastScan.ticket.status === 'usado' ? 'bg-amber-50/60 border-amber-200/60' : 'bg-red-50/60 border-red-200/60'}`}>
              <div className="flex items-center gap-4">
                {lastScan.ticket.avatar && <img src={lastScan.ticket.avatar} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-canvas" />}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {lastScan.success ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : lastScan.ticket.status === 'usado' ? <AlertTriangle className="w-5 h-5 text-amber-600" /> : <XCircle className="w-5 h-5 text-red-500" />}
                    <h3 className="text-lg font-serif text-espresso">{lastScan.ticket.name}</h3>
                  </div>
                  <p className="text-xs text-espresso/40 mt-0.5">{lastScan.ticket.ticketType} · {lastScan.ticket.seat !== '-' ? lastScan.ticket.seat : 'Pista'} · {lastScan.ticket.ticketCode}</p>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${lastScan.success ? 'bg-green-100 text-green-600' : lastScan.ticket.status === 'usado' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-500'}`}>
                  {lastScan.success ? 'Liberado' : lastScan.ticket.status === 'usado' ? 'Ja usado' : 'Bloqueado'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* List Mode */}
      {mode === 'list' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou codigo..." className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
          {filtered.map(t => (
            <div key={t.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${t.status === 'usado' ? 'bg-green-50/40 border-green-100/40' : t.status === 'cancelado' ? 'bg-red-50/30 border-red-100/30 opacity-50' : 'bg-white/60 border-white/60'}`}>
              <img src={t.avatar} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-canvas flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-espresso font-medium">{t.name}</div>
                <div className="text-[10px] text-espresso/30">{t.ticketType} · {t.seat !== '-' ? t.seat : 'Pista'} · {t.ticketCode}</div>
              </div>
              <div className="text-right flex-shrink-0">
                {t.status === 'usado' && <div className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {t.checkInTime}</div>}
                {t.status === 'cancelado' && <div className="text-xs text-red-400">Cancelado</div>}
                {t.status === 'pendente' && (
                  <button onClick={() => manualCheckIn(t.id)} className="px-4 py-1.5 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Confirmar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
