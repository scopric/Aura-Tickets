import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Upload, Plus, X } from 'lucide-react'

export default function ProducerNewEvent() {
  const [step, setStep] = useState(1)
  const [tickets, setTickets] = useState([{ id: '1', name: '', price: '', capacity: '' }])
  const [image, setImage] = useState<string | null>(null)
  const [eventType, setEventType] = useState('Festa')
  const [customType, setCustomType] = useState('')

  const addTicket = () => {
    setTickets([...tickets, { id: Date.now().toString(), name: '', price: '', capacity: '' }])
  }

  const removeTicket = (id: string) => {
    setTickets(tickets.filter(t => t.id !== id))
  }

  const steps = [
    { num: 1, label: 'Informacoes' },
    { num: 2, label: 'Ingressos' },
    { num: 3, label: 'Imagem' },
    { num: 4, label: 'Revisao' },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/events" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-espresso">Novo Evento</h1>
          <p className="text-sm text-espresso/50 mt-1">Crie um novo evento em poucos passos</p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-10">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => setStep(s.num)}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                step === s.num ? 'bg-plum text-cream shadow-glow' :
                step > s.num ? 'bg-plum/20 text-plum' :
                'bg-white/40 text-espresso/30'
              }`}
            >
              {step > s.num ? '✓' : s.num}
            </button>
            <span className={`text-xs font-medium hidden sm:block ${step === s.num ? 'text-plum' : 'text-espresso/30'}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-px ${step > s.num ? 'bg-plum/30' : 'bg-espresso/5'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Info */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white/60 border border-white/60 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="font-serif text-xl text-espresso mb-6">Informacoes do Evento</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-espresso/70 mb-2 block">Titulo</label>
                <input type="text" placeholder="Nome do evento" className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
              <div>
                <label className="text-sm font-medium text-espresso/70 mb-2 block">Descricao</label>
                <textarea rows={4} placeholder="Descreva seu evento..." className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-espresso/70 mb-2 block">Data</label>
                  <input type="date" className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-sm font-medium text-espresso/70 mb-2 block">Horario</label>
                  <input type="time" className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-espresso/70 mb-2 block">Local</label>
                <input type="text" placeholder="Endereco do evento" className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
              {/* Tipo de Evento */}
              <div>
                <label className="text-sm font-medium text-espresso/70 mb-2 block">Tipo de Evento</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {['Festa', 'Corporativo', 'Workshop', 'Show', 'Palestra', 'Networking', 'Gastronomia', 'Esporte'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setCustomType(tag === 'Outro' ? '' : tag)}
                      className={`px-4 py-2 rounded-full text-xs font-medium transition-all border ${
                        (eventType === tag && tag !== 'Outro')
                          ? 'bg-plum/10 text-plum border-plum/30'
                          : 'bg-white/40 border-white/60 text-espresso/60 hover:bg-plum/10 hover:text-plum hover:border-plum/20'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                  <button
                    onClick={() => setEventType('Outro')}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all border ${
                      eventType === 'Outro'
                        ? 'bg-plum/10 text-plum border-plum/30'
                        : 'bg-white/40 border-white/60 text-espresso/60 hover:bg-plum/10 hover:text-plum hover:border-plum/20'
                    }`}
                  >
                    + Outro
                  </button>
                </div>
                {eventType === 'Outro' && (
                  <input
                    type="text"
                    value={customType}
                    onChange={e => setCustomType(e.target.value)}
                    placeholder="Digite o tipo do seu evento..."
                    className="w-full px-4 py-3 bg-white/60 border border-plum/20 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/40"
                  />
                )}
              </div>
            </div>
          </div>
          <button onClick={() => setStep(2)} className="px-8 py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all">
            Proximo
          </button>
        </div>
      )}

      {/* Step 2: Tickets */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white/60 border border-white/60 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="font-serif text-xl text-espresso mb-6">Ingressos</h2>
            <div className="space-y-4">
              {tickets.map((ticket, i) => (
                <div key={ticket.id} className="p-4 bg-white/40 border border-white/60 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-espresso">Ingresso {i + 1}</h3>
                    {tickets.length > 1 && (
                      <button onClick={() => removeTicket(ticket.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/30 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-espresso/50 mb-1 block">Nome</label>
                      <input type="text" placeholder="Ex: VIP" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                    </div>
                    <div>
                      <label className="text-xs text-espresso/50 mb-1 block">Preco (R$)</label>
                      <input type="number" placeholder="0,00" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                    </div>
                    <div>
                      <label className="text-xs text-espresso/50 mb-1 block">Capacidade</label>
                      <input type="number" placeholder="Quantidade" className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addTicket} className="flex items-center gap-2 px-4 py-3 border border-dashed border-espresso/15 rounded-xl text-sm text-espresso/40 hover:text-plum hover:border-plum/30 transition-all w-full justify-center">
                <Plus className="w-4 h-4" />
                Adicionar Ingresso
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setStep(1)} className="px-6 py-3 border border-espresso/15 text-espresso text-sm font-medium rounded-full hover:bg-espresso/5 transition-all">
              Voltar
            </button>
            <button onClick={() => setStep(3)} className="px-8 py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all">
              Proximo
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Image */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white/60 border border-white/60 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="font-serif text-xl text-espresso mb-6">Imagem do Evento</h2>
            <div className="border-2 border-dashed border-espresso/10 rounded-2xl p-12 text-center hover:border-plum/30 transition-colors">
              {image ? (
                <div className="relative">
                  <img src={image} alt="Preview" className="w-full max-h-64 object-cover rounded-xl" />
                  <button onClick={() => setImage(null)} className="absolute top-2 right-2 p-2 rounded-full bg-void/50 text-cream hover:bg-void transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-full bg-plum/10 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6 text-plum" />
                  </div>
                  <p className="text-sm text-espresso/60">Arraste uma imagem ou clique para selecionar</p>
                  <p className="text-xs text-espresso/30">PNG, JPG ate 5MB</p>
                  <button className="px-6 py-2.5 border border-espresso/15 text-espresso text-sm rounded-full hover:bg-espresso/5 transition-all">
                    Selecionar Arquivo
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setStep(2)} className="px-6 py-3 border border-espresso/15 text-espresso text-sm font-medium rounded-full hover:bg-espresso/5 transition-all">
              Voltar
            </button>
            <button onClick={() => setStep(4)} className="px-8 py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all">
              Proximo
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-white/60 border border-white/60 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="font-serif text-xl text-espresso mb-6">Revisao</h2>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between py-3 border-b border-espresso/5">
                <span className="text-espresso/50">Titulo</span>
                <span className="text-espresso font-medium">Noite Eletro 2025</span>
              </div>
              <div className="flex justify-between py-3 border-b border-espresso/5">
                <span className="text-espresso/50">Data</span>
                <span className="text-espresso font-medium">15 de Junho, 2025</span>
              </div>
              <div className="flex justify-between py-3 border-b border-espresso/5">
                <span className="text-espresso/50">Local</span>
                <span className="text-espresso font-medium">Warehouse Central</span>
              </div>
              <div className="flex justify-between py-3 border-b border-espresso/5">
                <span className="text-espresso/50">Ingressos</span>
                <span className="text-espresso font-medium">{tickets.length} tipo(s)</span>
              </div>
            </div>
            <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100">
              <p className="text-sm text-green-700">Tudo pronto! Clique em "Criar Evento" para publicar.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setStep(3)} className="px-6 py-3 border border-espresso/15 text-espresso text-sm font-medium rounded-full hover:bg-espresso/5 transition-all">
              Voltar
            </button>
            <button className="px-8 py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all">
              Criar Evento
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
