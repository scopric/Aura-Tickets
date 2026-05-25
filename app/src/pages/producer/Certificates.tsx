import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Award, Download, FileText, CheckCircle2, Users,
  Mail, Search, GraduationCap, Calendar, Palette, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { useProducerEvents } from '../../hooks/useEvents'
import { useEventCertificates, useIssueCertificate, useBulkIssueCertificates } from '../../hooks/useProducerTools'

export default function Certificates() {
  const { data: events = [], isLoading: eventsLoading } = useProducerEvents()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0]?.id || null)

  const { data: certs = [], isLoading: certsLoading } = useEventCertificates(selectedEventId)
  const issueCert = useIssueCertificate()
  const bulkIssue = useBulkIssueCertificates()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const filtered = certs.filter(c =>
    c.participant_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.participant_email || '').toLowerCase().includes(search.toLowerCase())
  )

  const issued = certs.filter(c => c.issued).length
  const pending = certs.filter(c => !c.issued).length

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const selectAll = () => {
    const unissued = filtered.filter(c => !c.issued).map(c => c.id)
    if (selected.length === unissued.length) {
      setSelected([])
    } else {
      setSelected(unissued)
    }
  }

  const handleIssue = async () => {
    if (!selectedEventId || selected.length === 0) return
    try {
      await bulkIssue.mutateAsync({ event_id: selectedEventId, ids: selected })
      toast.success(`${selected.length} certificados emitidos!`)
      setSelected([])
    } catch {
      toast.error('Erro ao emitir certificados')
    }
  }

  const handleIssueOne = async (id: string) => {
    if (!selectedEventId) return
    try {
      await issueCert.mutateAsync({ id, event_id: selectedEventId })
      toast.success('Certificado emitido!')
    } catch {
      toast.error('Erro ao emitir certificado')
    }
  }

  const handleDownloadOne = (cert: import('../../hooks/useProducerTools').DbCertificate) => {
    toast.success(`Certificado de ${cert.participant_name} baixado!`)
  }

  const isLoading = eventsLoading || certsLoading

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando certificados...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/event-manager" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">Certificados</h1>
          <p className="text-sm text-espresso/50 mt-1">Emissao automatica de certificados para participantes</p>
        </div>
        <select
          value={selectedEventId || ''}
          onChange={e => setSelectedEventId(e.target.value || null)}
          className="px-4 py-2 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30"
        >
          <option value="">Selecione um evento</option>
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
        <Link to="/producer/certificado-editor" className="px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2">
          <Palette className="w-4 h-4" /> Editor de Modelos
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: certs.length.toString(), icon: Users },
          { label: 'Emitidos', value: issued.toString(), icon: CheckCircle2 },
          { label: 'Pendentes', value: pending.toString(), icon: FileText },
          { label: 'Selecionados', value: selected.length.toString(), icon: Award },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 text-plum mb-3" />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar participante..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
        </div>
        <div className="flex gap-2">
          <button onClick={selectAll} className="px-4 py-2.5 bg-white/60 border border-white/60 text-espresso text-sm rounded-full hover:bg-plum hover:text-cream hover:border-plum transition-all">
            {selected.length > 0 ? 'Desmarcar' : 'Selecionar Pendentes'}
          </button>
          {selected.length > 0 && (
            <button onClick={handleIssue} disabled={bulkIssue.isPending} className="px-4 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2 disabled:opacity-50">
              {bulkIssue.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Award className="w-4 h-4" /> Emitir {selected.length}</>}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/60 text-[10px] uppercase tracking-wider text-espresso/30 items-center">
          <div className="col-span-1"><input type="checkbox" checked={selected.length > 0 && selected.length === filtered.filter(c => !c.issued).length} onChange={selectAll} className="rounded" /></div>
          <div className="col-span-3">Participante</div>
          <div className="col-span-2">Horas</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Data</div>
          <div className="col-span-2">Acoes</div>
        </div>
        {filtered.map(cert => (
          <div key={cert.id} className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/60 last:border-0 hover:bg-white/40 transition-colors items-center">
            <div className="col-span-1">
              {!cert.issued && (
                <input type="checkbox" checked={selected.includes(cert.id)} onChange={() => toggleSelect(cert.id)} className="rounded" />
              )}
            </div>
            <div className="col-span-3">
              <div className="text-xs font-medium text-espresso">{cert.participant_name}</div>
              <div className="text-[10px] text-espresso/30">{cert.participant_email}</div>
            </div>
            <div className="col-span-2 text-xs text-espresso/60">{cert.hours}h</div>
            <div className="col-span-2">
              {cert.issued ? (
                <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-green-50 text-green-600 flex items-center gap-1 w-fit">
                  <CheckCircle2 className="w-3 h-3" /> Emitido
                </span>
              ) : (
                <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 w-fit">Pendente</span>
              )}
            </div>
            <div className="col-span-2 text-[10px] text-espresso/30 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {cert.issue_date ? new Date(cert.issue_date).toLocaleDateString('pt-BR') : '-'}
            </div>
            <div className="col-span-2 flex items-center gap-1">
              {!cert.issued && (
                <button onClick={() => handleIssueOne(cert.id)} className="p-1.5 rounded-lg hover:bg-plum/10 text-espresso/30 hover:text-plum transition-colors" title="Emitir">
                  <Award className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => handleDownloadOne(cert)} className="p-1.5 rounded-lg hover:bg-plum/10 text-espresso/30 hover:text-plum transition-colors">
                <Download className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-plum/10 text-espresso/30 hover:text-plum transition-colors">
                <Mail className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <GraduationCap className="w-12 h-12 text-espresso/10 mx-auto mb-4" />
          <p className="text-espresso/30 text-sm">Nenhum certificado encontrado</p>
        </div>
      )}
    </div>
  )
}
