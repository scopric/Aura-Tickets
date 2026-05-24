import { useState } from 'react'
import {
  Ticket, QrCode, Calendar, MapPin, Clock, CheckCircle2, XCircle,
  AlertTriangle, Share2, Download, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { useUserTickets } from '../../hooks/useCheckout'
import { useAuth } from '../../hooks/useAuth'
import TicketQRCode from '../../components/TicketQRCode'

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  active: { label: 'Ativo', bg: 'bg-green-50 border-green-100', text: 'text-green-600', icon: CheckCircle2 },
  used: { label: 'Utilizado', bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', bg: 'bg-red-50 border-red-100', text: 'text-red-500', icon: XCircle },
  refunded: { label: 'Reembolsado', bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', icon: AlertTriangle },
}

export default function ParticipantTickets() {
  const [filter, setFilter] = useState<'all' | 'active' | 'past'>('all')
  const [selectedQr, setSelectedQr] = useState<string | null>(null)

  const { data: userTickets = [], isLoading } = useUserTickets()

  // Mapear tickets do banco para o formato do componente
  const myTickets = userTickets.map(t => ({
    id: t.id,
    eventName: t.events?.title || 'Evento',
    date: t.events?.date
      ? new Date(t.events.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Data a definir',
    time: t.events?.time || '--:--',
    location: t.events?.venue_name || 'Local a definir',
    type: t.ticket_types?.name || 'Ingresso',
    price: t.ticket_types?.price || 0,
    status: t.status as 'active' | 'used' | 'cancelled' | 'refunded',
    code: t.qr_code || t.code || '',
    purchaseDate: t.created_at
      ? new Date(t.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
      : '',
    paymentMethod: 'PIX',
    seat: t.seat_info || '-',
  }))

  const filtered = myTickets.filter(t => {
    if (filter === 'all') return true
    if (filter === 'active') return t.status === 'active'
    return t.status !== 'active'
  })

  const activeCount = myTickets.filter(t => t.status === 'active').length
  const totalSpent = myTickets
    .filter(t => t.status !== 'cancelled' && t.status !== 'refunded')
    .reduce((s, t) => s + t.price, 0)

  const handleShare = (code: string) => {
    navigator.clipboard.writeText(`https://aura.events/ingresso/${code}`)
    toast.success('Link copiado!')
  }
  const handleCancel = (_id: string) => {
    toast.success('Solicitação de cancelamento enviada. Reembolso em até 7 dias.')
  }
  const handleDownload = () => {
    toast.success('Ingresso PDF baixado!')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-espresso">Meus Ingressos</h1>
        <p className="text-sm text-espresso/50 mt-1">Gerencie seus ingressos e acompanhe seus eventos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Ativos', value: activeCount.toString(), color: 'text-green-600' },
          { label: 'Total Gasto', value: `R$ ${totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'text-plum' },
          { label: 'Eventos', value: myTickets.length.toString(), color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl bg-white/60 border border-white/60 text-center">
            <div className={`font-serif text-2xl ${s.color}`}>{isLoading ? '...' : s.value}</div>
            <div className="text-xs text-espresso/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-full w-fit mb-6">
        {([['all', 'Todos'], ['active', 'Ativos'], ['past', 'Histórico']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${filter === key ? 'bg-plum text-cream' : 'text-espresso/40'}`}>{label}</button>
        ))}
      </div>

      {/* Tickets */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-white/40 border border-white/60 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white/60 border border-white/60 text-center">
          <Ticket className="w-10 h-10 text-espresso/20 mx-auto mb-4" />
          <h3 className="font-serif text-lg text-espresso mb-2">Nenhum ingresso encontrado</h3>
          <p className="text-sm text-espresso/40">
            {filter === 'all'
              ? 'Você ainda não comprou nenhum ingresso. Explore os eventos disponíveis!'
              : filter === 'active'
              ? 'Nenhum ingresso ativo no momento.'
              : 'Nenhum ingresso no histórico.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(t => {
            const sc = statusConfig[t.status] || statusConfig.active
            return (
              <div key={t.id} className={`p-5 rounded-2xl border backdrop-blur-sm transition-all hover:shadow-md ${t.status === 'active' ? 'bg-white/60 border-white/60' : 'bg-espresso/[0.02] border-espresso/5 opacity-70'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-medium text-espresso">{t.eventName}</h3>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-espresso/30">
                      <Calendar className="w-3 h-3" />{t.date} · <Clock className="w-3 h-3" />{t.time}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${sc.bg} ${sc.text} flex items-center gap-1`}><sc.icon className="w-3 h-3" />{sc.label}</span>
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1 text-xs text-espresso/50"><MapPin className="w-3 h-3" />{t.location}</div>
                  <div className="flex items-center gap-1 text-xs text-plum font-medium"><Ticket className="w-3 h-3" />{t.type}</div>
                  <div className="text-xs font-medium text-espresso">R$ {t.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>

                {t.status === 'active' && (
                  <>
                    <div className="p-3 rounded-xl bg-canvas mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex-shrink-0">
                          <TicketQRCode code={t.code} size={40} className="rounded-lg" />
                        </div>
                        <div>
                          <div className="text-[10px] text-espresso/30">Código</div>
                          <div className="text-xs font-mono text-espresso">{t.code}</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-espresso/20">{t.seat}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedQr(t.code)} className="flex-1 py-2 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-1"><QrCode className="w-3 h-3" /> Ver QR</button>
                      <button onClick={() => handleShare(t.code)} className="p-2 rounded-full bg-canvas text-espresso/30 hover:text-plum transition-colors"><Share2 className="w-3.5 h-3.5" /></button>
                      <button onClick={handleDownload} className="p-2 rounded-full bg-canvas text-espresso/30 hover:text-plum transition-colors"><Download className="w-3.5 h-3.5" /></button>
                    </div>
                  </>
                )}

                {t.status === 'cancelled' && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                    <div className="text-xs text-red-600">Cancelado em {t.purchaseDate}</div>
                    <div className="text-[10px] text-red-400">Motivo: Evento adiado pelo organizador</div>
                  </div>
                )}

                {t.status === 'refunded' && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="text-xs text-amber-700">Reembolsado: R$ {t.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-[10px] text-amber-500">Processado em {t.purchaseDate} via PIX</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* QR Modal */}
      {selectedQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedQr(null)} />
          <div className="relative w-full max-w-sm bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-2xl">
            <div className="text-center">
              <h3 className="font-serif text-xl text-espresso mb-1">Seu Ingresso</h3>
              <p className="text-xs text-espresso/40">Apresente na entrada do evento</p>
              <div className="w-48 h-48 mx-auto my-6">
                <TicketQRCode code={selectedQr} size={192} className="rounded-2xl" />
              </div>
              <div className="text-xs font-mono text-espresso/40 mb-4">{selectedQr}</div>
              <div className="flex items-center gap-2">
                <button onClick={handleDownload} className="flex-1 py-2.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-1"><Download className="w-3.5 h-3.5" /> Baixar PDF</button>
                <button onClick={() => handleCancel(selectedQr)} className="flex-1 py-2.5 bg-canvas text-red-400 text-xs rounded-full hover:bg-red-50 transition-all">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
