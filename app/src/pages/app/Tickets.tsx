import { useState } from 'react'
import {
  Ticket, QrCode, Calendar, MapPin, Clock, CheckCircle2, XCircle,
  AlertTriangle, Share2, Download, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { useUserTickets, type DbTicket } from '../../hooks/useUserTickets'
import TicketQRCode from '../../components/TicketQRCode'

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  active: { label: 'Ativo', bg: 'bg-green-500/10 border-green-500/20', text: 'text-green-400', icon: CheckCircle2 },
  used: { label: 'Utilizado', bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', icon: XCircle },
  transferred: { label: 'Transferido', bg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-400', icon: AlertTriangle },
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function ParticipantTickets() {
  const [filter, setFilter] = useState<'all' | 'active' | 'past'>('all')
  const [selected, setSelected] = useState<DbTicket | null>(null)
  const { data: tickets = [], isLoading } = useUserTickets()

  const filtered = tickets.filter(t => {
    if (filter === 'all') return true
    if (filter === 'active') return t.status === 'active'
    return t.status !== 'active'
  })

  const activeCount = tickets.filter(t => t.status === 'active').length
  const totalSpent = tickets
    .filter(t => t.status !== 'cancelled' && t.status !== 'transferred')
    .reduce((s, t) => s + (t.ticket_types?.price || 0), 0)

  const handleShare = (code: string) => {
    navigator.clipboard.writeText(`https://evokaa.events/ingresso/${code}`)
    toast.success('Link copiado!')
  }
  const handleCancel = (_id: string) => {
    toast.success('Solicitacao de cancelamento enviada. Reembolso em ate 7 dias.')
  }
  const handleDownload = () => {
    toast.success('Ingresso PDF baixado!')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-cream">Meus Ingressos</h1>
        <p className="text-sm text-white/60 mt-1">Gerencie seus ingressos e acompanhe seus eventos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Ativos', value: activeCount.toString(), color: 'text-green-400' },
          { label: 'Total Gasto', value: `R$ ${totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'text-plum-light' },
          { label: 'Eventos', value: tickets.length.toString(), color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md text-center">
            <div className={`font-serif text-2xl ${s.color}`}>{s.value}</div>
            <div className="text-xs text-white/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-full w-fit mb-6">
        {(['all', 'active', 'past'] as const).map((key) => {
          const labels: Record<string, string> = { all: 'Todos', active: 'Ativos', past: 'Histórico' }
          return (
            <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${filter === key ? 'bg-plum text-cream' : 'text-white/40 hover:text-white/60'}`}>{labels[key]}</button>
          )
        })}
      </div>

      {/* Tickets */}
      {isLoading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-plum animate-spin mx-auto mb-3" />
          <p className="text-sm text-white/45">Carregando ingressos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Ticket className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-sm text-white/40">Nenhum ingresso encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(t => {
            const sc = statusConfig[t.status] || statusConfig.active
            return (
              <div key={t.id} className={`p-5 rounded-2xl border backdrop-blur-md transition-all hover:shadow-glow ${t.status === 'active' ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white/[0.01] border-white/[0.04] opacity-50'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-medium text-cream">{t.events?.title || 'Evento'}</h3>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-white/30">
                      <Calendar className="w-3 h-3" />{formatDate(t.events?.date || null)} · <Clock className="w-3 h-3" />{t.events?.time || '--:--'}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${sc.bg} ${sc.text} flex items-center gap-1`}><sc.icon className="w-3 h-3" />{sc.label}</span>
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1 text-xs text-white/50"><MapPin className="w-3 h-3" />{t.events?.venue_name || '-'}</div>
                  <div className="flex items-center gap-1 text-xs text-plum-light font-medium"><Ticket className="w-3 h-3" />{t.ticket_types?.name || 'Ingresso'}</div>
                  <div className="text-xs font-medium text-cream">R$ {(t.ticket_types?.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>

                {t.status === 'active' && (
                  <>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 flex-shrink-0">
                          <TicketQRCode code={t.code} size={40} className="rounded-lg" />
                        </div>
                        <div>
                          <div className="text-[10px] text-white/30">Código</div>
                          <div className="text-xs font-mono text-cream">{t.code}</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-white/20">{t.seat_info || 'Livre'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelected(t)} className="flex-1 py-2 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-1"><QrCode className="w-3 h-3" /> Ver QR</button>
                      <button onClick={() => handleShare(t.code)} className="p-2 rounded-xl bg-white/[0.05] text-white/40 hover:text-plum transition-colors"><Share2 className="w-3.5 h-3.5" /></button>
                      <button onClick={handleDownload} className="p-2 rounded-xl bg-white/[0.05] text-white/40 hover:text-plum transition-colors"><Download className="w-3.5 h-3.5" /></button>
                    </div>
                  </>
                )}

                {t.status === 'cancelled' && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="text-xs text-red-400">Ingresso cancelado</div>
                  </div>
                )}

                {t.status === 'transferred' && (
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <div className="text-xs text-purple-400">Ingresso transferido</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* QR Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-sm bg-slate-950 border border-white/10 rounded-3xl p-6 shadow-elevated">
            <div className="text-center">
              <h3 className="font-serif text-xl text-cream mb-1">{selected.events?.title || 'Evento'}</h3>
              <p className="text-xs text-white/40">{formatDate(selected.events?.date || null)} · {selected.events?.time || '--:--'}</p>
              <div className="w-48 h-48 mx-auto my-6">
                <TicketQRCode code={selected.code} size={192} className="rounded-2xl" />
              </div>
              <div className="text-xs font-mono text-white/30 mb-4">{selected.code}</div>
              <div className="flex items-center gap-2">
                <button onClick={handleDownload} className="flex-1 py-2.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-1"><Download className="w-3.5 h-3.5" /> Baixar PDF</button>
                <button onClick={() => handleCancel(selected.id)} className="flex-1 py-2.5 bg-red-500/10 text-red-400 text-xs rounded-full hover:bg-red-500/20 transition-all">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
