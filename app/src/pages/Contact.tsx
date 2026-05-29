import { useState, useEffect, useRef } from 'react'
import {
  Mail, Phone, MapPin, Clock, Send, Instagram, MessageCircle,
  CheckCircle2, Globe, Headphones, Zap, Shield,
  ChevronRight, MessageSquarePlus, ArrowUpRight, Sparkles,
  User, AtSign, FileText, AlignLeft
} from 'lucide-react'
import { toast } from 'sonner'
import gsap from 'gsap'
import { useContact } from '../hooks/useContact'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.contact-hero-badge',
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.7)' }
      )
      gsap.fromTo('.contact-hero-title',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, delay: 0.1, ease: 'power3.out' }
      )
      gsap.fromTo('.contact-hero-sub',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, delay: 0.2, ease: 'power3.out' }
      )
      gsap.fromTo('.dept-card',
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, stagger: 0.08, duration: 0.8, delay: 0.3, ease: 'power3.out' }
      )
      gsap.fromTo('.info-panel',
        { opacity: 0, x: -30 },
        { opacity: 1, x: 0, duration: 0.8, delay: 0.4, ease: 'power3.out' }
      )
      gsap.fromTo('.form-panel',
        { opacity: 0, x: 30 },
        { opacity: 1, x: 0, duration: 0.8, delay: 0.4, ease: 'power3.out' }
      )
    })
    return () => ctx.revert()
  }, [])

  const { mutateAsync: sendContact, isPending } = useContact()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) {
      toast.error('Por favor, preencha os campos obrigatórios: Nome, E-mail e Mensagem.')
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
      toast.success('Mensagem de contato enviada com sucesso!')
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
    { 
      icon: Headphones, 
      title: 'Suporte Técnico', 
      desc: 'Dificuldades com pagamentos, acesso aos ingressos ou problemas na plataforma.', 
      email: 'suporte@evokaa.events', 
      time: 'Resposta: ~2h', 
      color: 'from-blue-500/10 to-indigo-500/5', 
      accent: '#1d68c4' 
    },
    { 
      icon: Zap, 
      title: 'Vendas & Eventos', 
      desc: 'Quero criar e publicar meu primeiro evento ou tenho dúvidas comerciais sobre as taxas.', 
      email: 'vendas@evokaa.events', 
      time: 'Resposta: ~4h', 
      color: 'from-purple-500/10 to-pink-500/5', 
      accent: '#8f33f5' 
    },
    { 
      icon: Shield, 
      title: 'Parcerias & Mídia', 
      desc: 'Propostas de integração de marcas, patrocínios exclusivos ou contato com a imprensa.', 
      email: 'parcerias@evokaa.events', 
      time: 'Resposta: ~1 dia', 
      color: 'from-teal-500/10 to-emerald-500/5', 
      accent: '#0d9488' 
    },
    { 
      icon: MessageSquarePlus, 
      title: 'Sugestões & Bugs', 
      desc: 'Quer sugerir uma funcionalidade inovadora ou encontrou alguma inconsistência?', 
      email: 'feedback@evokaa.events', 
      time: 'Resposta: ~1 dia', 
      color: 'from-orange-500/10 to-rose-500/5', 
      accent: '#ea580c' 
    },
  ]

  const contactDetails = [
    { icon: Mail, label: 'E-mail Principal', value: 'contato@evokaa.events', sub: 'Retorno em até 24 horas úteis' },
    { icon: Phone, label: 'Atendimento por Telefone', value: '(11) 4000-2025', sub: 'Segunda a Sexta, das 9h às 18h' },
    { icon: MapPin, label: 'Nosso Escritório', value: 'Rua Augusta, 1500', sub: 'Consolação, São Paulo/SP' },
    { icon: Clock, label: 'Horários de Operação', value: 'Seg a Sex: 9h-18h | Sáb: 10h-14h', sub: 'Disponibilidade de equipe física' },
  ]

  const inputLabelClasses = "text-[10px] font-bold uppercase tracking-wider mb-2 block flex items-center gap-2 text-slate-500"
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200/60 font-sans">
      
      {/* ===== HERO SECTION ===== */}
      <section ref={heroRef} className="pt-32 pb-16 relative overflow-hidden">
        {/* Orbes flutuantes decorativos */}
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-gradient-to-tr from-[#1d68c4]/10 to-transparent rounded-full blur-3xl opacity-60 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-br from-[#8f33f5]/5 to-transparent rounded-full blur-3xl opacity-50 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 text-center relative z-10">
          <div className="contact-hero-badge inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#1d68c4]/5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1d68c4] animate-ping" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1d68c4]">Central de Relacionamento</span>
          </div>

          <h1 className="contact-hero-title font-serif text-5xl sm:text-6xl lg:text-[80px] font-extrabold tracking-tight text-slate-900 leading-[0.95] mb-6">
            Fale com a <span className="text-gradient">Evokaa</span>
          </h1>
          <p className="contact-hero-sub text-base sm:text-lg max-w-xl mx-auto leading-relaxed text-slate-500 font-light">
            Tem alguma ideia, dúvida ou deseja criar uma experiência memorável conosco? 
            Selecione o canal ideal e nossa equipe retornará rapidamente.
          </p>
        </div>
      </section>

      {/* ===== DEPARTMENTS CARDS ===== */}
      <section ref={cardsRef} className="pb-16 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {departments.map((d) => (
              <div
                key={d.title}
                className="dept-card group relative p-6 rounded-[24px] border border-white/60 bg-white/65 backdrop-blur-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-[#1d68c4]/25 hover:-translate-y-1"
              >
                {/* Efeito de brilho de gradiente no hover */}
                <div 
                  className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" 
                  style={{ background: `linear-gradient(135deg, ${d.accent}08 0%, ${d.accent}02 100%)` }} 
                />

                <div className="relative z-10 flex flex-col justify-between h-full">
                  <div>
                    <div 
                      className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-105" 
                      style={{ background: `${d.accent}12` }}
                    >
                      <d.icon className="w-5 h-5" style={{ color: d.accent }} />
                    </div>

                    <h3 className="text-sm font-bold text-slate-800 tracking-tight">{d.title}</h3>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed min-h-[64px] font-light">{d.desc}</p>
                  </div>

                  <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-slate-100/60">
                    <span className="text-[10px] font-bold text-slate-700 tracking-wide break-all">{d.email}</span>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider" style={{ background: `${d.accent}10`, color: d.accent }}>
                        {d.time}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FORM + INFO GRID ===== */}
      <section className="pb-28 relative z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Info Panel (4 Columns) */}
            <div className="lg:col-span-5 info-panel space-y-4">
              
              {/* Informações detalhadas */}
              <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-3xl p-4 space-y-3 shadow-md">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3.5 pt-2 block">Informações de Contato</span>
                {contactDetails.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-4 p-4 rounded-2xl border border-transparent hover:border-slate-200/60 hover:bg-white/90 transition-all duration-300 group"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#1d68c4]/10 transition-transform duration-300 group-hover:scale-105">
                      <item.icon className="w-4 h-4 text-[#1d68c4]" />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{item.label}</div>
                      <div className="text-sm font-bold text-slate-800">{item.value}</div>
                      <div className="text-[10px] text-slate-400/80 font-light mt-0.5">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Redes Sociais */}
              <div className="p-6 rounded-3xl border border-white/60 bg-white/50 backdrop-blur-md shadow-md">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4">Comunidade & Social</div>
                <div className="flex flex-col gap-2.5">
                  {[
                    { icon: Instagram, label: '@evokaa.events', desc: 'Acompanhe novidades de eventos', link: '#' },
                    { icon: Globe, label: 'evokaa.events', desc: 'Visite nossa plataforma oficial', link: '/' },
                  ].map((s) => (
                    <a 
                      key={s.label}
                      href={s.link}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/70 hover:bg-[#1d68c4]/5 border border-transparent hover:border-[#1d68c4]/10 text-slate-700 transition-all duration-300 group"
                    >
                      <div className="flex items-center gap-3">
                        <s.icon className="w-4 h-4 text-[#1d68c4]" />
                        <div>
                          <div className="text-xs font-bold">{s.label}</div>
                          <div className="text-[10px] text-slate-400 font-light mt-0.5">{s.desc}</div>
                        </div>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#1d68c4] transition-colors" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Botão WhatsApp */}
              <a 
                href="https://wa.me/551140002025" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-5 rounded-3xl border border-green-200 bg-green-500/10 hover:bg-green-500/20 transition-all duration-300 hover:shadow-lg group"
              >
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  <MessageCircle className="w-6 h-6 text-white fill-current" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-green-800">Canal de Suporte Rápido</div>
                  <div className="text-xs text-green-600 font-light mt-0.5">Clique para falar no WhatsApp</div>
                </div>
                <ChevronRight className="w-4 h-4 text-green-500 transition-transform group-hover:translate-x-1" />
              </a>
            </div>

            {/* Right Form Panel (7 Columns) */}
            <div className="lg:col-span-7 form-panel">
              <div className="relative p-[1.5px] rounded-[32px] bg-gradient-to-br from-white/80 via-slate-200/50 to-white/40 shadow-2xl">
                
                {/* Linha de design elegante superior */}
                <div className="absolute top-0 left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-[#1d68c4] to-[#8f33f5] opacity-80" />

                <div className="p-8 sm:p-10 rounded-[30px] bg-white/95 backdrop-blur-xl">
                  {sent ? (
                    <div className="py-16 text-center animate-fade-in">
                      <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-200 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                      </div>
                      <h3 className="font-serif text-3xl font-bold text-slate-900 mb-3">Mensagem Enviada!</h3>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed font-light">
                        Agradecemos o seu contato. A equipe da <strong className="text-slate-800">Evokaa</strong> recebeu os seus dados e responderá ao seu e-mail em até 24 horas úteis.
                      </p>
                      <button
                        onClick={() => { setSent(false); setForm({ name: '', email: '', phone: '', subject: '', message: '' }) }}
                        className="mt-8 px-8 py-3 rounded-full text-xs font-bold text-white transition-all duration-300 bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] hover:shadow-lg focus:outline-none"
                      >
                        Enviar Nova Mensagem
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      
                      <div className="border-b border-slate-100 pb-4 mb-6">
                        <h2 className="text-xl font-bold text-slate-900 font-serif">Envie uma Mensagem Direta</h2>
                        <p className="text-xs text-slate-400 mt-1 font-light">Seus dados serão enviados por e-mail à nossa central de atendimento.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Name Input */}
                        <div className="relative">
                          <label className={inputLabelClasses}>
                            <User className="w-3.5 h-3.5 text-[#1d68c4]" /> Nome completo *
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={form.name}
                              onChange={e => setForm({ ...form, name: e.target.value })}
                              onFocus={() => setFocusedField('name')}
                              onBlur={() => setFocusedField(null)}
                              placeholder="Como devemos te chamar?"
                              className="w-full pl-5 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm transition-all duration-300 outline-none placeholder:text-slate-400/70 focus:bg-white focus:border-[#1d68c4] focus:ring-4 focus:ring-[#1d68c4]/10 text-slate-800"
                            />
                          </div>
                        </div>

                        {/* Email Input */}
                        <div className="relative">
                          <label className={inputLabelClasses}>
                            <AtSign className="w-3.5 h-3.5 text-[#1d68c4]" /> E-mail *
                          </label>
                          <div className="relative">
                            <input
                              type="email"
                              value={form.email}
                              onChange={e => setForm({ ...form, email: e.target.value })}
                              onFocus={() => setFocusedField('email')}
                              onBlur={() => setFocusedField(null)}
                              placeholder="seu.email@provedor.com"
                              className="w-full pl-5 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm transition-all duration-300 outline-none placeholder:text-slate-400/70 focus:bg-white focus:border-[#1d68c4] focus:ring-4 focus:ring-[#1d68c4]/10 text-slate-800"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Phone Input */}
                        <div className="relative">
                          <label className={inputLabelClasses}>
                            <Phone className="w-3.5 h-3.5 text-[#1d68c4]" /> Telefone de contato
                          </label>
                          <div className="relative">
                            <input
                              type="tel"
                              value={form.phone}
                              onChange={e => setForm({ ...form, phone: e.target.value })}
                              onFocus={() => setFocusedField('phone')}
                              onBlur={() => setFocusedField(null)}
                              placeholder="(11) 99999-9999"
                              className="w-full pl-5 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm transition-all duration-300 outline-none placeholder:text-slate-400/70 focus:bg-white focus:border-[#1d68c4] focus:ring-4 focus:ring-[#1d68c4]/10 text-slate-800"
                            />
                          </div>
                        </div>

                        {/* Subject Select */}
                        <div className="relative">
                          <label className={inputLabelClasses}>
                            <FileText className="w-3.5 h-3.5 text-[#1d68c4]" /> Assunto
                          </label>
                          <div className="relative">
                            <select
                              value={form.subject}
                              onChange={e => setForm({ ...form, subject: e.target.value })}
                              onFocus={() => setFocusedField('subject')}
                              onBlur={() => setFocusedField(null)}
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm transition-all duration-300 outline-none focus:bg-white focus:border-[#1d68c4] focus:ring-4 focus:ring-[#1d68c4]/10 text-slate-800 cursor-pointer appearance-none"
                            >
                              <option value="">Selecione um assunto...</option>
                              <option value="Quero criar um evento">Quero criar um evento</option>
                              <option value="Quero ser parceiro/afiliado">Quero ser afiliado</option>
                              <option value="Problemas com suporte técnico">Suporte técnico</option>
                              <option value="Proposta comercial ou parcerias">Proposta de parceria</option>
                              <option value="Outro assunto">Outro assunto</option>
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Message Input */}
                      <div className="relative">
                        <label className={inputLabelClasses}>
                          <AlignLeft className="w-3.5 h-3.5 text-[#1d68c4]" /> Mensagem *
                        </label>
                        <textarea
                          value={form.message}
                          onChange={e => setForm({ ...form, message: e.target.value })}
                          onFocus={() => setFocusedField('message')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Digite aqui o motivo do seu contato em detalhes..."
                          rows={5}
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm transition-all duration-300 outline-none placeholder:text-slate-400/70 focus:bg-white focus:border-[#1d68c4] focus:ring-4 focus:ring-[#1d68c4]/10 text-slate-800 resize-none leading-relaxed"
                        />
                      </div>

                      {/* Submit Button */}
                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isPending}
                          className="w-full py-4 rounded-full text-xs font-bold text-white transition-all duration-300 hover:shadow-[0_10px_25px_rgba(29,104,196,0.25)] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                          style={{
                            background: 'linear-gradient(135deg, #1d68c4, #8f33f5)'
                          }}
                        >
                          <Send className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                          <span>{isPending ? 'Enviando Mensagem...' : 'Enviar Mensagem'}</span>
                        </button>
                        <p className="text-[10px] text-center text-slate-400 mt-4 font-light">
                          Ao enviar, você concorda com nossos Termos de Uso e Políticas de Privacidade.
                        </p>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===== MAP SECTION ===== */}
      <section className="relative overflow-hidden bg-slate-100 border-t border-slate-200/60 pb-12">
        <div className="w-full h-80 relative overflow-hidden flex items-center justify-center">
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
            backgroundImage: `linear-gradient(rgba(29,104,196,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(29,104,196,0.3) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
          
          <div className="absolute inset-0 bg-gradient-to-b from-slate-200/50 via-transparent to-slate-200/50 pointer-events-none" />

          {/* Pino Central Animado */}
          <div className="relative z-10 text-center">
            <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              {/* Anel de radar pulsando */}
              <div className="absolute inset-0 rounded-full bg-[#1d68c4]/20 animate-ping duration-1000" />
              <div className="relative w-12 h-12 rounded-full bg-[#1d68c4] flex items-center justify-center shadow-lg shadow-[#1d68c4]/45">
                <MapPin className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="font-serif text-lg font-bold text-slate-800">Rua Augusta, 1500</h3>
            <p className="text-xs text-slate-400 mt-1.5 font-light">Consolação, São Paulo/SP — Próximo ao Metrô Consolação</p>
          </div>

          <div className="absolute top-6 left-6 opacity-30">
            <Sparkles className="w-5 h-5 text-[#1d68c4]" />
          </div>
          <div className="absolute bottom-6 right-6 opacity-30">
            <Sparkles className="w-5 h-5 text-[#8f33f5]" />
          </div>
        </div>
      </section>

    </div>
  )
}
