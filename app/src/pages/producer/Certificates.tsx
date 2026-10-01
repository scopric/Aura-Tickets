import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, GraduationCap, Palette, Loader2 } from 'lucide-react'
import { useProducerEvents } from '../../hooks/useEvents'
import { useEventCertificates } from '../../hooks/useProducerTools'

export default function Certificates() {
  const { data: events = [], isLoading: eventsLoading } = useProducerEvents()
  const [pickedEventId, setPickedEventId] = useState<string | null>(null)
  // a lista chega depois do 1º render: sem escolha, vale o primeiro evento
  const selectedEventId = pickedEventId ?? events[0]?.id ?? null

  // certificates guarda MODELOS (CertificateBuilder), não participantes
  const { data: models = [], isLoading: certsLoading } = useEventCertificates(selectedEventId)

  const isLoading = eventsLoading || certsLoading

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/70 text-sm">Carregando certificados...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/event-manager" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/70 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">Certificados</h1>
          <p className="text-sm text-espresso/70 mt-1">Emissao automatica de certificados para participantes</p>
        </div>
        <select
          value={selectedEventId || ''}
          onChange={e => setPickedEventId(e.target.value || null)}
          className="px-4 py-2 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30"
        >
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
        <Link to="/producer/certificado-editor" className="px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2">
          <Palette className="w-4 h-4" /> Editor de Modelos
        </Link>
      </div>

      {/* emissão grava em issued_certificates, que ainda não tem regra de acesso do produtor (fase B3) */}
      <div className="text-center py-20">
        <GraduationCap className="w-12 h-12 text-espresso/10 mx-auto mb-4" />
        <p className="text-espresso/70 text-sm">Emissão de certificados disponível em breve</p>
        {selectedEventId && (
          <p className="text-xs text-espresso/70 mt-1">
            {models.length === 1 ? '1 modelo salvo' : `${models.length} modelos salvos`} para este evento
          </p>
        )}
        {selectedEventId && models.length > 0 && (
          <Link to={`/producer/certificado-editor?eventId=${selectedEventId}`} className="inline-block mt-3 text-xs text-plum hover:underline">
            Abrir modelo no editor
          </Link>
        )}
      </div>
    </div>
  )
}
