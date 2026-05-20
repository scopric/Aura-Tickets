import { useState } from 'react'
import {
  Ticket, QrCode, Calendar, MapPin, Clock, CheckCircle2, XCircle,
  AlertTriangle, Share2, Download
} from 'lucide-react'
import { toast } from 'sonner'

interface MyTicket {
  id: string
  eventName: string
  date: string
  time: string
  location: string
  type: string
  price: number
  status: 'ativo' | 'usado' | 'cancelado' | 'reembolsado'
  code: string
  qrUrl: string
  purchaseDate: string
  paymentMethod: string
  seat: string
}

const myTickets: MyTicket[] = [
  { id: 'mt1', eventName: 'Noite Eletro 2025', date: '20 Mai 2025', time: '21:00', location: 'Sao Paulo/SP', type: 'VIP', price: 150, status: 'ativo', code: 'AUR-VIP-001', qrUrl: '/qr-1', purchaseDate: '15 Mai 2025', paymentMethod: 'PIX', seat: 'Mesa 3' },
  { id: 'mt2', eventName: 'Jazz Sunset Session', date: '22 Mai 2025', time: '18:00', location: 'Sao Paulo/SP', type: 'Pista', price: 80, status: 'ativo', code: 'AUR-PIS-002', qrUrl: '/qr-2', purchaseDate: '10 Mai 2025', paymentMethod: 'Cartao Credito', seat: '-' },
  { id: 'mt3', eventName: 'Workshop UX Design', date: '15 Abr 2025', time: '14:00', location: 'Rio de Janeiro/RJ', type: 'VIP', price: 120, status: 'usado', code: 'AUR-VIP-003', qrUrl: '/qr-3', purchaseDate: '01 Abr 2025', paymentMethod: 'PIX', seat: 'Fila A' },
  { id: 'mt4', eventName: 'Festa Junina Tech', date: '10 Jun 2025', time: '19:00', location: 'Campinas/SP', type: 'Mesa Coletiva', price: 200, status: 'ativo', code: 'AUR-MC-004', qrUrl: '/qr-4', purchaseDate: '05 Mai 2025', paymentMethod: 'Cartao Debito', seat: 'Mesa Coletiva #12' },
  { id: 'mt5', eventName: 'Conferencia AI 2025', date: '01 Mar 2025', time: '09:00', location: 'Sao Paulo/SP', type: 'Pista', price: 60, status: 'cancelado', code: 'AUR-PIS-005', qrUrl: '/qr-5', purchaseDate: '15 Fev 2025', paymentMethod: 'Boleto', seat: '-' },
  { id: 'mt6', eventName: 'Show de Rock', date: '10 Fev 2025', time: '20:00', location: 'Sao Paulo/SP', type: 'VIP', price: 180, status: 'reembolsado', code: 'AUR-VIP-006', qrUrl: '/qr-6', purchaseDate: '20 Jan 2025', paymentMethod: 'PIX', seat: 'Camarote' },
]

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  ativo: { label: 'Ativo', bg: 'bg-green-50 border-green-100', text: 'text-green-600', icon: CheckCircle2 },
  usado: { label: 'Utilizado', bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', bg: 'bg-red-50 border-red-100', text: 'text-red-500', icon: XCircle },
  reembolsado: { label: 'Reembolsado', bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', icon: AlertTriangle },
}

export default function ParticipantTickets() {
  const [filter, setFilter] = useState<'all' | 'ativo' | 'passado'>('all')
  const [selected, setSelected] = useState<MyTicket | null>(null)

  const filtered = myTickets.filter(t => {
    if (filter === 'all') return true
    if (filter === 'ativo') return t.status === 'ativo'
    return t.status !== 'ativo'
  })

  const activeCount = myTickets.filter(t => t.status === 'ativo').length
  const totalSpent = myTickets.filter(t => t.status !== 'cancelado' && t.status !== 'reembolsado').reduce((s, t) => s + t.price, 0)

  const handleShare = (code: string) => { navigator.clipboard.writeText(`https://aura.events/ingresso/${code}`); toast.success('Link copiado!') }
  const handleCancel = (_id: string) => { toast.success('Solicitacao de cancelamento enviada. Reembolso em ate 7 dias.') }
  const handleDownload = () => { toast.success('Ingresso PDF baixado!') }

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
          { label: 'Total Gasto', value: `R$ ${totalSpent}`, color: 'text-plum' },
          { label: 'Eventos', value: myTickets.length.toString(), color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl bg-white/60 border border-white/60 text-center">
            <div className={`font-serif text-2xl ${s.color}`}>{s.value}</div>
            <div className="text-xs text-espresso/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-full w-fit mb-6">
        {([['all', 'Todos'], ['ativo', 'Ativos'], ['passado', 'Historico']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${filter === key ? 'bg-plum text-cream' : 'text-espresso/40'}`}>{label}</button>
        ))}
      </div>

      {/* Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(t => {
          const sc = statusConfig[t.status]
          return (
            <div key={t.id} className={`p-5 rounded-2xl border backdrop-blur-sm transition-all hover:shadow-md ${t.status === 'ativo' ? 'bg-white/60 border-white/60' : 'bg-espresso/[0.02] border-espresso/5 opacity-70'}`}>
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
                <div className="text-xs font-medium text-espresso">R$ {t.price}</div>
              </div>

              {t.status === 'ativo' && (
                <>
                  <div className="p-3 rounded-xl bg-canvas mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-8 h-8 text-espresso/20" />
                      <div>
                        <div className="text-[10px] text-espresso/30">Codigo</div>
                        <div className="text-xs font-mono text-espresso">{t.code}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-espresso/20">{t.seat}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelected(t)} className="flex-1 py-2 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-1"><QrCode className="w-3 h-3" /> Ver QR</button>
                    <button onClick={() => handleShare(t.code)} className="p-2 rounded-full bg-canvas text-espresso/30 hover:text-plum transition-colors"><Share2 className="w-3.5 h-3.5" /></button>
                    <button onClick={handleDownload} className="p-2 rounded-full bg-canvas text-espresso/30 hover:text-plum transition-colors"><Download className="w-3.5 h-3.5" /></button>
                  </div>
                </>
              )}

              {t.status === 'cancelado' && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                  <div className="text-xs text-red-600">Cancelado em 28 Fev 2025</div>
                  <div className="text-[10px] text-red-400">Motivo: Evento adiado pelo organizador</div>
                </div>
              )}

              {t.status === 'reembolsado' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="text-xs text-amber-700">Reembolsado: R$ {t.price}</div>
                  <div className="text-[10px] text-amber-500">Processado em 12 Fev 2025 via PIX</div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* QR Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-sm bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-2xl">
            <div className="text-center">
              <h3 className="font-serif text-xl text-espresso mb-1">{selected.eventName}</h3>
              <p className="text-xs text-espresso/40">{selected.date} · {selected.time}</p>
              <div className="w-48 h-48 mx-auto my-6 bg-canvas rounded-2xl flex items-center justify-center">
                <QrCode className="w-32 h-32 text-espresso/20" />
              </div>
              <div className="text-xs font-mono text-espresso/40 mb-4">{selected.code}</div>
              <div className="flex items-center gap-2">
                <button onClick={handleDownload} className="flex-1 py-2.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-1"><Download className="w-3.5 h-3.5" /> Baixar PDF</button>
                <button onClick={() => handleCancel(selected.id)} className="flex-1 py-2.5 bg-canvas text-red-400 text-xs rounded-full hover:bg-red-50 transition-all">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
