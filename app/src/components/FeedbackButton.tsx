import { useState } from 'react'
import { MessageSquarePlus, X, Send, Star, Bug, Lightbulb, HelpCircle, ThumbsUp, Check } from 'lucide-react'
import { toast } from 'sonner'

type FeedbackType = 'melhoria' | 'bug' | 'duvida' | 'sugestao' | 'elogio'

interface FeedbackItem {
  id: string
  type: FeedbackType
  role: 'cliente' | 'produtor' | 'admin'
  name: string
  email: string
  message: string
  rating: number
  page: string
  status: 'novo' | 'lido' | 'respondido' | 'resolvido'
  createdAt: string
}

const typeConfig: Record<FeedbackType, { icon: typeof Star; label: string; color: string }> = {
  melhoria: { icon: Lightbulb, label: 'Melhoria', color: 'text-amber-600' },
  bug: { icon: Bug, label: 'Bug', color: 'text-red-500' },
  duvida: { icon: HelpCircle, label: 'Duvida', color: 'text-blue-600' },
  sugestao: { icon: Star, label: 'Sugestao', color: 'text-violet-600' },
  elogio: { icon: ThumbsUp, label: 'Elogio', color: 'text-green-600' },
}

export const feedbackMock: FeedbackItem[] = [
  { id: 'f1', type: 'melhoria', role: 'produtor', name: 'Joao Silva', email: 'joao@email.com', message: 'Gostaria de poder duplicar eventos para nao ter que criar tudo do zero.', rating: 0, page: '/producer/events', status: 'novo', createdAt: '17 Mai 2025' },
  { id: 'f2', type: 'bug', role: 'cliente', name: 'Ana Costa', email: 'ana@email.com', message: 'O botao de comprar ingresso nao funciona no celular.', rating: 0, page: '/event/noite-eletro-2025', status: 'lido', createdAt: '16 Mai 2025' },
  { id: 'f3', type: 'elogio', role: 'cliente', name: 'Pedro Lima', email: 'pedro@email.com', message: 'Adorei o sistema de mesa coletiva! Conheci pessoas incriveis.', rating: 5, page: '/app/hub', status: 'respondido', createdAt: '15 Mai 2025' },
  { id: 'f4', type: 'duvida', role: 'produtor', name: 'Maria Souza', email: 'maria@email.com', message: 'Como faco para adicionar um cupom de desconto?', rating: 0, page: '/producer/dashboard', status: 'novo', createdAt: '14 Mai 2025' },
  { id: 'f5', type: 'sugestao', role: 'admin', name: 'Carlos Admin', email: 'admin@aura.com', message: 'Precisamos de um relatorio de engagement por evento.', rating: 0, page: '/admin/analytics', status: 'lido', createdAt: '13 Mai 2025' },
  { id: 'f6', type: 'melhoria', role: 'produtor', name: 'Fernanda Rocha', email: 'fernanda@email.com', message: 'Seria otimo ter integracao com WhatsApp para enviar lembretes.', rating: 0, page: '/producer/crm', status: 'novo', createdAt: '12 Mai 2025' },
]

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ type: 'melhoria' as FeedbackType, message: '', rating: 0, name: '', email: '' })
  const [step, setStep] = useState<'form' | 'success'>('form')

  const handleSubmit = () => {
    if (!form.message.trim()) { toast.error('Escreva sua mensagem'); return }
    toast.success('Feedback enviado! Obrigado.')
    setForm({ type: 'melhoria', message: '', rating: 0, name: '', email: '' })
    setStep('success')
    setTimeout(() => { setStep('form'); setOpen(false) }, 2000)
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 ${
          open ? 'bg-espresso/80 rotate-0' : 'bg-plum hover:shadow-glow'
        }`}
        style={{ boxShadow: open ? '0 4px 16px rgba(26,14,20,0.3)' : '0 4px 16px rgba(122,59,105,0.4)' }}
      >
        {open ? <X className="w-5 h-5 text-cream" /> : <MessageSquarePlus className="w-5 h-5 text-cream" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[60] w-[380px] max-w-[calc(100vw-2rem)] bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl overflow-hidden">
          {step === 'form' ? (
            <>
              {/* Header */}
              <div className="p-5 border-b border-espresso/5">
                <h3 className="font-serif text-lg text-espresso">Envie seu feedback</h3>
                <p className="text-[11px] text-espresso/40 mt-0.5">Ajude-nos a melhorar a plataforma</p>
              </div>

              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Type */}
                <div>
                  <label className="text-[10px] font-medium text-espresso/40 uppercase tracking-wider mb-2 block">Tipo</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(typeConfig) as [FeedbackType, typeof typeConfig['melhoria']][]).map(([key, cfg]) => (
                      <button key={key} onClick={() => setForm({ ...form, type: key })} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-medium border transition-all ${form.type === key ? 'bg-plum/10 border-plum/30 text-plum' : 'bg-white/40 border-white/60 text-espresso/50 hover:text-espresso/70'}`}>
                        <cfg.icon className="w-3 h-3" /> {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating (for elogio) */}
                {form.type === 'elogio' && (
                  <div>
                    <label className="text-[10px] font-medium text-espresso/40 uppercase tracking-wider mb-2 block">Avaliacao</label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button key={s} onClick={() => setForm({ ...form, rating: s })} className="p-1 transition-colors">
                          <Star className={`w-5 h-5 ${s <= form.rating ? 'text-amber-400 fill-amber-400' : 'text-espresso/15'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Name & Email */}
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Seu nome" className="px-3 py-2.5 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Seu email" className="px-3 py-2.5 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                </div>

                {/* Message */}
                <div>
                  <label className="text-[10px] font-medium text-espresso/40 uppercase tracking-wider mb-2 block">Mensagem</label>
                  <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Conte-nos o que voce pensa..." rows={4} className="w-full px-3 py-2.5 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 resize-none" />
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-espresso/5">
                <button onClick={handleSubmit} className="w-full py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2">
                  <Send className="w-3.5 h-3.5" /> Enviar Feedback
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-serif text-lg text-espresso mb-1">Obrigado!</h4>
              <p className="text-xs text-espresso/40">Seu feedback foi enviado com sucesso.</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
