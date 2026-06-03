import { useState } from 'react'
import {
  Mail, Phone, MapPin, Clock, Send, Instagram, MessageCircle,
  CheckCircle2, Globe, ChevronDown, Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { useContact } from '../hooks/useContact'

export default function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const { mutateAsync: sendContact, isPending } = useContact()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.phone || !form.message) {
      toast.error('Por favor, preencha todos os campos obrigatórios: Nome, E-mail, Celular e Mensagem.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Por favor, insira um e-mail válido.')
      return
    }

    try {
      await sendContact({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: form.subject.trim() || 'Contato Geral (Home)',
        message: form.message.trim(),
      })

      setSent(true)
      toast.success('Mensagem enviada! Retornaremos em breve.')
      setTimeout(() => {
        setSent(false)
        setForm({ name: '', email: '', phone: '', subject: '', message: '' })
      }, 5000)
    } catch (err) {
      console.error('[ContactSection]', err)
      toast.error('Erro ao enviar mensagem. Tente novamente.')
    }
  }

  const contactInfo = [
    { icon: Mail, label: 'Email', value: 'contato@evokaa.com.br', href: 'mailto:contato@evokaa.com.br', color: '#1d68c4' },
    { icon: Phone, label: 'Telefone', value: '(11) 4000-2025', href: 'tel:+551140002025', color: '#8f33f5' },
    { icon: MapPin, label: 'Endereço', value: 'Rua Augusta, 1500 — São Paulo/SP', href: '#', color: '#0d9488' },
    { icon: Clock, label: 'Atendimento', value: 'Seg a Sex: 9h as 18h | Sab: 10h as 14h', href: '#', color: '#ea580c' },
  ]

  const labelClasses = (field: string) => `text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
    focusedField === field ? 'text-[#1d68c4] translate-x-0.5' : 'text-slate-400'
  }`

  const inputWrapperClasses = (field: string) => `relative border-b transition-all duration-300 py-1.5 ${
    focusedField === field ? 'border-[#1d68c4] shadow-[0_1px_0_0_#1d68c4]' : 'border-slate-200'
  }`

  return (
    <section className="py-28 relative overflow-hidden bg-white text-slate-850 font-sans">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-[#1d68c4]/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-[#8f33f5]/[0.02] rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <span className="text-[11px] font-extrabold tracking-[0.25em] uppercase text-[#1d68c4] bg-[#1d68c4]/5 px-4 py-1.5 rounded-full">
            Fale Conosco
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold mt-6 mb-4 text-slate-900 tracking-tight font-serif">
            Fale com a <span className="text-gradient">Evokaa</span>
          </h2>
          <p className="text-sm max-w-md mx-auto leading-relaxed text-slate-500 font-light">
            Tem uma ideia, dúvida ou quer criar algo incrível junto? Deixe sua mensagem e nós te responderemos rapidamente.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-stretch">
          
          {/* Left: Contact Info (Painel Bento Glassmorphism Unificado) */}
          <div className="lg:col-span-5 flex">
            <div className="bg-white/70 backdrop-blur-md border border-slate-250/50 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group hover:border-[#1d68c4]/20 transition-all duration-500 w-full flex flex-col justify-between">
              
              {/* Orb decorativo sutil de fundo */}
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-[#1d68c4]/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="space-y-6">
                {/* Badge de Resposta Rápida compacta no topo */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/5 border border-green-500/10 w-fit">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-green-700 font-extrabold uppercase tracking-wider">Resposta Rápida Garantida</span>
                </div>

                {/* Título interno do painel */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 font-serif">Canais de Atendimento</h3>
                  <p className="text-xs text-slate-400 font-light mt-1">Escolha o canal de sua preferência para nos contatar.</p>
                </div>

                {/* Lista compacta de canais com divisórias horizontais */}
                <div className="space-y-5">
                  {contactInfo.map((item, idx) => (
                    <div key={item.label} className="group/item">
                      {idx > 0 && <div className="h-[1px] w-full bg-slate-100/80 mb-5" />}
                      <a
                        href={item.href}
                        className="flex items-start gap-4 transition-transform duration-300 hover:translate-x-1"
                      >
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
                          style={{ backgroundColor: `${item.color}08`, color: item.color }}
                        >
                          <item.icon className="w-4 h-4 transition-transform duration-300 group-hover/item:scale-110" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-bold text-slate-450 uppercase tracking-widest">{item.label}</div>
                          <div className="text-sm font-semibold text-slate-800 mt-1 break-words group-hover/item:text-[#1d68c4] transition-colors">{item.value}</div>
                        </div>
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Redes Sociais integradas no rodapé do painel */}
              <div className="pt-6 border-t border-slate-100/80 mt-8">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-450 block mb-3">Redes Sociais</span>
                <div className="flex items-center gap-2">
                  {[
                    { icon: Instagram, label: 'Instagram', href: '#', color: '#e1306c' },
                    { icon: MessageCircle, label: 'WhatsApp', href: 'https://wa.me/551140002025', color: '#22c55e' },
                    { icon: Globe, label: 'Website', href: '/', color: '#1d68c4' },
                  ].map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:shadow-sm transition-all duration-300"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = social.color
                        e.currentTarget.style.backgroundColor = `${social.color}08`
                        e.currentTarget.style.borderColor = `${social.color}20`
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#94a3b8'
                        e.currentTarget.style.backgroundColor = '#f8fafc'
                        e.currentTarget.style.borderColor = '#f1f5f9'
                      }}
                      title={social.label}
                    >
                      <social.icon className="w-4 h-4" />
                    </a>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-7 flex">
            <div className="p-6 sm:p-8 lg:p-10 rounded-3xl bg-white/70 border border-slate-200/50 backdrop-blur-md shadow-sm w-full flex flex-col justify-between h-full">
              {sent ? (
                <div className="py-16 text-center animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-200 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-slate-900 mb-3">Mensagem Enviada!</h3>
                  <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed font-light">
                    Obrigado pelo contato. Nossa equipe responderá diretamente ao seu e-mail em até 24 horas úteis.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* Grid Nome & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Nome */}
                    <div className="space-y-1">
                      <label htmlFor="sec-name" className={labelClasses('sec-name')}>
                        Nome Completo *
                      </label>
                      <div className={inputWrapperClasses('sec-name')}>
                        <input
                          id="sec-name"
                          type="text"
                          value={form.name}
                          onChange={e => setForm({ ...form, name: e.target.value })}
                          onFocus={() => setFocusedField('sec-name')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Seu nome"
                          className="w-full bg-transparent border-none outline-none text-slate-800 text-sm placeholder:text-slate-450 font-medium"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                      <label htmlFor="sec-email" className={labelClasses('sec-email')}>
                        E-mail *
                      </label>
                      <div className={inputWrapperClasses('sec-email')}>
                        <input
                          id="sec-email"
                          type="email"
                          value={form.email}
                          onChange={e => setForm({ ...form, email: e.target.value })}
                          onFocus={() => setFocusedField('sec-email')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="seu@email.com"
                          className="w-full bg-transparent border-none outline-none text-slate-800 text-sm placeholder:text-slate-455 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Grid Celular & Assunto */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Celular */}
                    <div className="space-y-1">
                      <label htmlFor="sec-phone" className={labelClasses('sec-phone')}>
                        Celular / WhatsApp *
                      </label>
                      <div className={inputWrapperClasses('sec-phone')}>
                        <input
                          id="sec-phone"
                          type="tel"
                          value={form.phone}
                          onChange={e => setForm({ ...form, phone: e.target.value })}
                          onFocus={() => setFocusedField('sec-phone')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="(11) 99999-9999"
                          className="w-full bg-transparent border-none outline-none text-slate-800 text-sm placeholder:text-slate-455 font-medium"
                        />
                      </div>
                    </div>

                    {/* Assunto */}
                    <div className="space-y-1">
                      <label htmlFor="sec-subject" className={labelClasses('sec-subject')}>
                        Assunto
                      </label>
                      <div className={inputWrapperClasses('sec-subject')}>
                        <select
                          id="sec-subject"
                          value={form.subject}
                          onChange={e => setForm({ ...form, subject: e.target.value })}
                          onFocus={() => setFocusedField('sec-subject')}
                          onBlur={() => setFocusedField(null)}
                          className="w-full bg-transparent border-none outline-none text-slate-800 text-sm cursor-pointer appearance-none font-medium"
                        >
                          <option value="">Selecione um assunto...</option>
                          <option value="Quero criar um evento">Quero criar um evento</option>
                          <option value="Quero ser parceiro/afiliado">Quero ser afiliado</option>
                          <option value="Problemas com suporte técnico">Suporte técnico</option>
                          <option value="Proposta comercial ou parcerias">Proposta de parceria</option>
                          <option value="Outro assunto">Outro assunto</option>
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mensagem */}
                  <div className="space-y-1">
                    <label htmlFor="sec-message" className={labelClasses('sec-message')}>
                      Mensagem *
                    </label>
                    <div className={inputWrapperClasses('sec-message')}>
                      <textarea
                        id="sec-message"
                        value={form.message}
                        onChange={e => setForm({ ...form, message: e.target.value })}
                        onFocus={() => setFocusedField('sec-message')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Conte-nos como podemos te ajudar..."
                        rows={4}
                        className="w-full bg-transparent border-none outline-none text-slate-800 text-sm placeholder:text-slate-455 font-medium resize-none leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Enviar botão */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="w-full py-4 text-white text-xs font-bold rounded-full transition-all duration-300 hover:shadow-[0_8px_25px_rgba(29,104,196,0.25)] hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                      style={{ background: 'linear-gradient(135deg, #1d68c4, #8f33f5)' }}
                    >
                      <Send className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      <span>{isPending ? 'Enviando...' : 'Enviar Mensagem'}</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center font-light leading-relaxed">
                    Ao enviar, você concorda com a nossa política de privacidade.
                  </p>
                </form>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
