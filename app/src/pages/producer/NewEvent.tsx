import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Check } from 'lucide-react'
import { useCreateEvent } from '../../hooks/useEvents'
import { toast } from 'sonner'
import CapaEventoCampo from '../../components/producer/CapaEventoCampo'
import { enviarEGravarCapa, useLiberarPrevia, type CapaPronta } from '../../lib/capaEvento'
import { corSorteada } from '../../lib/corEvento'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const TIPOS = ['Festa', 'Corporativo', 'Workshop', 'Show', 'Palestra', 'Networking', 'Gastronomia', 'Esporte']
const cartao = 'rounded-[10px] border border-border bg-card p-4 sm:p-6'
const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'

export default function ProducerNewEvent() {
  const navigate = useNavigate()
  const createEvent = useCreateEvent()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
  })

  const [tickets, setTickets] = useState([{ id: '1', name: '', price: '', capacity: '' }])
  const [capa, setCapa] = useState<CapaPronta | null>(null) // foto pronta; só sobe depois de o evento existir (o caminho do Storage leva o id)
  const [cor, setCor] = useState<{ valor: string; manual: boolean } | null>(null) // null: ainda a cor sorteada pelo título
  const [salvando, setSalvando] = useState(false) // cobre o criar + enviar a foto: sem clique duplo
  useLiberarPrevia(capa)
  const semente = formData.title || 'evento'
  const corAtual = cor?.valor ?? corSorteada(semente)
  const [eventType, setEventType] = useState('Festa')
  const [customType, setCustomType] = useState('')

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addTicket = () => {
    setTickets([...tickets, { id: Date.now().toString(), name: '', price: '', capacity: '' }])
  }

  const removeTicket = (id: string) => {
    setTickets(tickets.filter(t => t.id !== id))
  }

  const updateTicket = (id: string, field: 'name' | 'price' | 'capacity', value: string) => {
    setTickets(tickets.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const handleCreate = async () => {
    setSalvando(true)
    try {
      const category = eventType === 'Outro' ? customType || 'Outro' : eventType

      const eventPayload = {
        title: formData.title || 'Sem título',
        description: formData.description || null,
        date: formData.date || null,
        time: formData.time || null,
        location: formData.location || null,
        category: category,
        status: 'published' as const,
        cover_image: '/images/hero-bg.jpg', // Usar cover de placeholder; a foto entra depois, quando o evento já existe
        accent_color: corAtual,
        capacity: tickets.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0) || null
      }

      const ticketsPayload = tickets
        .filter(t => t.name && t.price)
        .map(t => ({
          name: t.name,
          price: Number(t.price) || 0,
          capacity: t.capacity ? Number(t.capacity) : null,
          type: 'individual' as const
        }))

      const novo = (await createEvent.mutateAsync({
        event: eventPayload,
        tickets: ticketsPayload
      })) as { id: string }

      let fotoFalhou = false
      if (capa && user?.id) {
        fotoFalhou = !(await enviarEGravarCapa(capa, user.id, novo.id))
      }
      if (fotoFalhou) toast.warning('Evento criado, mas a foto de capa não foi enviada. Abra "Editar evento" para enviar de novo.')
      else toast.success('Evento criado! Aguardando moderação administrativa.')
      setTimeout(() => navigate('/producer/events'), 800)
    } catch (err: any) {
      setSalvando(false)
      toast.error(err.message || 'Erro ao criar evento no Supabase')
    }
  }

  const steps = [
    { num: 1, label: 'Informações' },
    { num: 2, label: 'Ingressos' },
    { num: 3, label: 'Imagem' },
    { num: 4, label: 'Revisão' },
  ]

  const canNextStep1 = () => {
    return !!formData.title && !!formData.date && !!formData.location
  }

  const canNextStep2 = () => {
    return tickets.length > 0 && tickets.every(t => t.name && t.price && t.capacity)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Novo evento"
        description="Crie um novo evento em poucos passos"
        actions={<Button asChild variant="outline"><Link to="/producer/events"><ArrowLeft aria-hidden="true" />Meus eventos</Link></Button>}
      />

      {/* Passos */}
      <ol className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s.num} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              aria-current={step === s.num ? 'step' : undefined}
              aria-label={`Passo ${s.num}: ${s.label}`}
              onClick={() => {
                if (s.num === 1) setStep(1)
                else if (s.num === 2 && canNextStep1()) setStep(2)
                else if (s.num === 3 && canNextStep1() && canNextStep2()) setStep(3)
                else if (s.num === 4 && canNextStep1() && canNextStep2()) setStep(4)
              }}
              className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium tabular-nums transition-colors ${
                step === s.num ? 'border-primary bg-primary text-primary-foreground' :
                step > s.num ? 'border-primary text-primary' :
                'border-border text-muted-foreground hover:bg-foreground/5'
              }`}
            >
              {step > s.num ? <Check className="size-4" aria-hidden="true" /> : s.num}
            </button>
            <span className={`hidden text-xs font-medium sm:block ${step === s.num ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
            {i < steps.length - 1 && <span className={`h-px flex-1 ${step > s.num ? 'bg-primary' : 'bg-border'}`} aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {/* Passo 1: Informações */}
      {step === 1 && (
        <div className="space-y-6">
          <section className={cartao}>
            <h2 className="mb-4 text-base font-semibold text-foreground">Informações do evento</h2>
            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="evento-titulo">Título *</Label>
                <Input id="evento-titulo" value={formData.title} onChange={e => handleInputChange('title', e.target.value)} placeholder="Ex: Noite Eletro 2025" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="evento-descricao">Descrição</Label>
                <Textarea id="evento-descricao" rows={4} value={formData.description} onChange={e => handleInputChange('description', e.target.value)} placeholder="Descreva seu evento…" className="resize-none" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="evento-data">Data *</Label>
                  <Input id="evento-data" type="date" value={formData.date} onChange={e => handleInputChange('date', e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="evento-horario">Horário</Label>
                  <Input id="evento-horario" type="time" value={formData.time} onChange={e => handleInputChange('time', e.target.value)} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="evento-local">Local *</Label>
                <Input id="evento-local" value={formData.location} onChange={e => handleInputChange('location', e.target.value)} placeholder="Endereço ou nome do espaço" />
              </div>
              <div>
                <p id="evento-tipo" className="mb-2 text-sm font-medium text-foreground">Tipo de evento</p>
                <div role="group" aria-labelledby="evento-tipo" className="mb-3 flex flex-wrap gap-1">
                  {TIPOS.map((tag) => (
                    <Button key={tag} type="button" size="sm" variant={eventType === tag ? 'secondary' : 'ghost'} aria-pressed={eventType === tag} className={eventType === tag ? '' : icone}
                      onClick={() => { setEventType(tag); setCustomType('') }}>
                      {tag}
                    </Button>
                  ))}
                  <Button type="button" size="sm" variant={eventType === 'Outro' ? 'secondary' : 'ghost'} aria-pressed={eventType === 'Outro'} className={eventType === 'Outro' ? '' : icone} onClick={() => setEventType('Outro')}>
                    <Plus aria-hidden="true" />Outro
                  </Button>
                </div>
                {eventType === 'Outro' && (
                  <>
                    <Label htmlFor="evento-tipo-outro" className="sr-only">Tipo do evento</Label>
                    <Input id="evento-tipo-outro" value={customType} onChange={e => setCustomType(e.target.value)} placeholder="Digite o tipo do seu evento…" />
                  </>
                )}
              </div>
            </div>
          </section>
          <Button onClick={() => setStep(2)} disabled={!canNextStep1()}>Próximo</Button>
        </div>
      )}

      {/* Passo 2: Ingressos */}
      {step === 2 && (
        <div className="space-y-6">
          <section className={cartao}>
            <h2 className="mb-4 text-base font-semibold text-foreground">Ingressos</h2>
            <div className="space-y-3">
              {tickets.map((ticket, i) => (
                <div key={ticket.id} className="rounded-lg border border-border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Ingresso {i + 1}</h3>
                    {tickets.length > 1 && (
                      <Button variant="ghost" size="icon-sm" className={icone} onClick={() => removeTicket(ticket.id)} aria-label={`Remover o ingresso ${i + 1}`}>
                        <X aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`ingresso-nome-${ticket.id}`} className="text-xs text-muted-foreground">Nome *</Label>
                      <Input id={`ingresso-nome-${ticket.id}`} value={ticket.name} onChange={e => updateTicket(ticket.id, 'name', e.target.value)} placeholder="Ex: VIP" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`ingresso-preco-${ticket.id}`} className="text-xs text-muted-foreground">Preço (R$) *</Label>
                      <Input id={`ingresso-preco-${ticket.id}`} type="number" inputMode="decimal" value={ticket.price} onChange={e => updateTicket(ticket.id, 'price', e.target.value)} placeholder="0,00" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`ingresso-capacidade-${ticket.id}`} className="text-xs text-muted-foreground">Capacidade *</Label>
                      <Input id={`ingresso-capacidade-${ticket.id}`} type="number" inputMode="numeric" value={ticket.capacity} onChange={e => updateTicket(ticket.id, 'capacity', e.target.value)} placeholder="Quantidade" />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full border border-dashed border-input shadow-none" onClick={addTicket}>
                <Plus aria-hidden="true" />Adicionar ingresso
              </Button>
            </div>
          </section>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
            <Button onClick={() => setStep(3)} disabled={!canNextStep2()}>Próximo</Button>
          </div>
        </div>
      )}

      {/* Passo 3: Imagem */}
      {step === 3 && (
        <div className="space-y-6">
          <section className={cartao}>
            <h2 className="mb-4 text-base font-semibold text-foreground">Capa e cor do evento</h2>
            <CapaEventoCampo
              evento={{ id: semente, title: formData.title, date: formData.date }}
              capa={capa}
              onCapa={setCapa}
              onRemover={() => {}}
              cor={corAtual}
              corManual={!!cor?.manual}
              onCor={(valor, manual) => setCor(c => ({ valor, manual: manual || !!c?.manual }))}
              ocupado={salvando}
            />
          </section>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
            <Button onClick={() => setStep(4)}>Próximo</Button>
          </div>
        </div>
      )}

      {/* Passo 4: Revisão */}
      {step === 4 && (
        <div className="space-y-6">
          <section className={cartao}>
            <h2 className="mb-2 text-base font-semibold text-foreground">Revisão</h2>
            <dl className="divide-y divide-border text-sm">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Título</dt>
                <dd className="text-right font-medium text-foreground">{formData.title || '-'}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Data</dt>
                <dd className="text-right font-medium text-foreground">
                  {formData.date ? new Date(formData.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Local</dt>
                <dd className="text-right font-medium text-foreground">{formData.location || '-'}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Ingressos</dt>
                <dd className="text-right font-medium text-foreground">{tickets.length} tipo(s)</dd>
              </div>
            </dl>
            <p className="mt-4 rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
              Seu evento será enviado para moderação e ficará visível ao público depois da aprovação da equipe.
            </p>
          </section>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setStep(3)}>Voltar</Button>
            <Button onClick={handleCreate} disabled={salvando}>
              {salvando ? (capa ? 'Enviando a foto…' : 'Criando…') : <><Check aria-hidden="true" />Criar evento</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
