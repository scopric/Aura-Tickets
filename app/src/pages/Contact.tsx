import { useState, useEffect, useRef } from 'react'
import {
  Mail, Phone, MapPin, Clock, Send, Instagram, MessageCircle,
  CheckCircle2, Globe, Headphones, Zap, Shield,
  ChevronRight, ChevronDown, MessageSquarePlus, ArrowUpRight, Sparkles,
  User, AtSign, FileText, AlignLeft
} from 'lucide-react'
import { toast } from 'sonner'
import gsap from 'gsap'
import { useContact } from '../hooks/useContact'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.anim-fade-up',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out' }
      )
      gsap.fromTo('.anim-fade-left',
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.8, delay: 0.2, ease: 'power3.out' }
      )
      gsap.fromTo('.anim-fade-right',
        { opacity: 0, x: 30 },
        { opacity: 1, x: 0, duration: 0.8, delay: 0.2, ease: 'power3.out' }
      )
    })
    return () => ctx.revert()
  }, [])

  const { mutateAsync: sendContact, isPending } = useContact()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.phone || !form.message) {
      toast.error('Por favor, preencha todos os campos obrigatórios: Nome, E-mail, Telefone e Mensagem.')
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
        phone: form.phone.trim() || undefined,
        subject: form.subject.trim() || 'Contato Geral',
        message: form.message.trim(),
      })

      setSent(true)
      toast.success('Mensagem enviada com sucesso!')
      setTimeout(() => {
        setSent(false)
        setForm({ name: '', email: '', phone: '', subject: '', message: '' })
      }, 5000)
    } catch (err) {
      console.error('[Contact]', err)
      toast.error('Falha ao enviar mensagem. Por favor, tente novamente.')
    }
  }

  const departments = [
    { icon: Headphones, title: 'Suporte Técnico', email: 'suporte@evokaa.com.br', color: '#1d68c4' },
    { icon: Zap, title: 'Vendas & Eventos', email: 'vendas@evokaa.com.br', color: '#8f33f5' },
    { icon: Shield, title: 'Parcerias & Imprensa', email: 'parcerias@evokaa.com.br', color: '#0d9488' },
    { icon: MessageSquarePlus, title: 'Sugestões & Bugs', email: 'feedback@evokaa.com.br', color: '#ea580c' },
  ]

  const labelClasses = (field: string) => `text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
    focusedField === field ? 'text-[#1d68c4] translate-x-0.5' : 'text-slate-400'
  }`

  const inputWrapperClasses = (field: string) => `relative border-b transition-all duration-300 py-1.5 ${
    focusedField === field ? 'border-[#1d68c4] shadow-[0_1px_0_0_#1d68c4]' : 'border-slate-200'
  }`

  return (
    <div className="min-h-screen bg-white text-slate-850 selection:bg-[#1d68c4]/10 selection:text-[#1d68c4] pt-28">
      {/* Decorative Orbs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-[#1d68c4]/5 via-transparent to-transparent rounded-full blur-3xl opacity-70 pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-[#8f33f5]/3 via-transparent to-transparent rounded-full blur-3xl opacity-50 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-start">
          
          {/* ================= LEFT COLUMN: GIGANTIC TYPOGRAPHY & CONTACT DETAILS ================= */}
          <div className="lg:col-span-5 space-y-12 anim-fade-left">
            <div>
              <span className="text-[11px] font-extrabold tracking-[0.25em] uppercase text-[#1d68c4] bg-[#1d68c4]/5 px-3 py-1 rounded-md">
                Fale Conosco
              </span>
              <h1 className="font-serif text-6xl sm:text-7xl font-extrabold tracking-tight text-slate-900 leading-[0.95] mt-6">
                Como podemos <span className="text-gradient">ajudar?</span>
              </h1>
              <p className="text-sm text-slate-500 font-light mt-6 max-w-sm leading-relaxed">
                Quer criar um evento extraordinário, tirar dúvidas sobre as tarifas ou conversar sobre parcerias? Nossa equipe está de prontidão.
              </p>
            </div>

            {/* Clean minimalist list of details */}
            <div className="space-y-6">
              <div className="flex gap-4 group">
                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#1d68c4] group-hover:border-[#1d68c4]/20 transition-all duration-300">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">E-mail Principal</div>
                  <a href="mailto:contato@evokaa.com.br" className="text-sm font-semibold text-slate-800 hover:text-[#1d68c4] transition-colors mt-0.5 block">
                    contato@evokaa.com.br
                  </a>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#1d68c4] group-hover:border-[#1d68c4]/20 transition-all duration-300">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Central Telefônica</div>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                    (11) 4000-2025
                  </span>
                </div>
              </div>

              <div className="flex gap-4 group">
                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#1d68c4] group-hover:border-[#1d68c4]/20 transition-all duration-300">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Localização</div>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                    Rua Augusta, 1500
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-light">
                    Consolação, São Paulo/SP
                  </span>
                </div>
              </div>
            </div>

            {/* Social channels (Clean Links) */}
            <div className="pt-6 border-t border-slate-100">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-3">Siga-nos</span>
              <div className="flex gap-4">
                <a href="#" className="text-xs font-semibold text-slate-500 hover:text-[#1d68c4] transition-colors flex items-center gap-1 group">
                  <Instagram className="w-3.5 h-3.5" />
                  <span>Instagram</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                <a href="/" className="text-xs font-semibold text-slate-500 hover:text-[#1d68c4] transition-colors flex items-center gap-1 group">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Website</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </div>
            </div>

            {/* WhatsApp Premium CTA */}
            <a 
              href="https://wa.me/551140002025" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-5 rounded-2xl border border-[#22c55e]/20 bg-[#22c55e]/[0.02] hover:bg-[#22c55e]/5 transition-all duration-300 group max-w-sm shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#22c55e] flex items-center justify-center text-white shadow-md">
                  <MessageCircle className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Atendimento WhatsApp</div>
                  <div className="text-[10px] text-[#22c55e] font-semibold mt-0.5">Resposta instantânea</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#22c55e] transition-transform group-hover:translate-x-1" />
            </a>
          </div>

          {/* ================= RIGHT COLUMN: MINIMALIST INTEGRATED FORM ================= */}
          <div className="lg:col-span-7 anim-fade-right">
            {sent ? (
              <div className="py-20 text-center border border-slate-100 rounded-3xl bg-slate-50/50 backdrop-blur-sm animate-fade-in shadow-sm">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-200 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-serif text-3xl font-bold text-slate-900 mb-3">Mensagem Enviada!</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed font-light">
                  Agradecemos o seu contato. A equipe da <strong>Evokaa</strong> responderá diretamente ao seu e-mail em até 24 horas úteis.
                </p>
                <button
                  onClick={() => { setSent(false); setForm({ name: '', email: '', phone: '', subject: '', message: '' }) }}
                  className="mt-8 px-6 py-2.5 rounded-full text-xs font-bold text-white transition-all duration-300 bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] hover:shadow-lg focus:outline-none"
                >
                  Enviar Outra Mensagem
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* Inputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                  {/* Name Input */}
                  <div className="space-y-1">
                    <label htmlFor="name" className={labelClasses('name')}>
                      Nome Completo *
                    </label>
                    <div className={inputWrapperClasses('name')}>
                      <input
                        id="name"
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Como devemos te chamar?"
                        className="w-full bg-transparent border-none outline-none text-slate-800 text-sm placeholder:text-slate-400/50 font-medium"
                      />
                    </div>
                  </div>

                  {/* Email Input */}
                  <div className="space-y-1">
                    <label htmlFor="email" className={labelClasses('email')}>
                      E-mail *
                    </label>
                    <div className={inputWrapperClasses('email')}>
                      <input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="seu.email@provedor.com"
                        className="w-full bg-transparent border-none outline-none text-slate-800 text-sm placeholder:text-slate-400/50 font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                  {/* Phone Input */}
                  <div className="space-y-1">
                    <label htmlFor="phone" className={labelClasses('phone')}>
                      Telefone de Contato *
                    </label>
                    <div className={inputWrapperClasses('phone')}>
                      <input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        onFocus={() => setFocusedField('phone')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="(11) 99999-9999"
                        className="w-full bg-transparent border-none outline-none text-slate-800 text-sm placeholder:text-slate-400/50 font-medium"
                      />
                    </div>
                  </div>

                  {/* Subject Selection */}
                  <div className="space-y-1">
                    <label htmlFor="subject" className={labelClasses('subject')}>
                      Qual o motivo do contato?
                    </label>
                    <div className={inputWrapperClasses('subject')}>
                      <select
                        id="subject"
                        value={form.subject}
                        onChange={e => setForm({ ...form, subject: e.target.value })}
                        onFocus={() => setFocusedField('subject')}
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

                {/* Message Textarea */}
                <div className="space-y-1">
                  <label htmlFor="message" className={labelClasses('message')}>
                    Mensagem *
                  </label>
                  <div className={inputWrapperClasses('message')}>
                    <textarea
                      id="message"
                      value={form.message}
                      onChange={e => setForm({ ...form, message: e.target.value })}
                      onFocus={() => setFocusedField('message')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Conte-nos em detalhes como podemos te ajudar..."
                      rows={4}
                      className="w-full bg-transparent border-none outline-none text-slate-800 text-sm placeholder:text-slate-400/50 font-medium resize-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-8 py-3.5 rounded-full text-xs font-bold text-white transition-all duration-300 hover:shadow-[0_8px_25px_rgba(29,104,196,0.25)] hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                    style={{
                      background: 'linear-gradient(135deg, #1d68c4, #8f33f5)'
                    }}
                  >
                    <Send className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    <span>{isPending ? 'Enviando...' : 'Enviar Mensagem'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Direct e-mails list (Compact & Clean) */}
            <div className="mt-16 pt-8 border-t border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-6">
                E-mails diretos de setores
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {departments.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center" style={{ color: d.color }}>
                      <d.icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block">{d.title}</span>
                      <a href={`mailto:${d.email}`} className="text-xs font-bold text-slate-700 hover:text-[#1d68c4] transition-colors mt-0.5 block">
                        {d.email}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* ===== MAP SECTION (Ultra clean minimal pino) ===== */}
      <section className="relative overflow-hidden bg-slate-50 border-t border-slate-100 py-16 mt-12">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="relative w-12 h-12 mx-auto mb-4 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[#1d68c4]/15 animate-ping duration-1000" />
            <div className="relative w-8 h-8 rounded-full bg-[#1d68c4] flex items-center justify-center shadow-md">
              <MapPin className="w-4 h-4 text-white" />
            </div>
          </div>
          <h3 className="font-serif text-lg font-bold text-slate-800">Rua Augusta, 1500</h3>
          <p className="text-xs text-slate-400 mt-1 font-light">Consolação, São Paulo/SP — Próximo ao Metrô Consolação</p>
        </div>
      </section>

    </div>
  )
}
