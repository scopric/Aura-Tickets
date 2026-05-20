import { useState, useEffect, useRef } from 'react'
import {
  Mail, Phone, MapPin, Clock, Send, Instagram, MessageCircle,
  CheckCircle2, Globe, Headphones, Zap, Shield,
  ChevronRight, MessageSquarePlus, ArrowUpRight, Sparkles,
  User, AtSign, FileText, AlignLeft
} from 'lucide-react'
import { toast } from 'sonner'
import Header from '../components/Header'
import Footer from '../components/Footer'
import gsap from 'gsap'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.contact-hero-title', { opacity: 0, y: 40, duration: 1, ease: 'power3.out' })
      gsap.from('.contact-hero-sub', { opacity: 0, y: 30, duration: 1, delay: 0.2, ease: 'power3.out' })
      gsap.from('.contact-hero-line', { scaleX: 0, duration: 1.2, delay: 0.4, ease: 'power3.out', transformOrigin: 'center' })
      gsap.from('.dept-card', { opacity: 0, y: 40, stagger: 0.1, duration: 0.8, delay: 0.3, ease: 'power3.out' })
      gsap.from('.form-panel', { opacity: 0, x: 30, duration: 0.8, delay: 0.4, ease: 'power3.out' })
      gsap.from('.info-panel', { opacity: 0, x: -30, duration: 0.8, delay: 0.4, ease: 'power3.out' })
    })
    return () => ctx.revert()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) { toast.error('Preencha nome, email e mensagem'); return }
    setSent(true)
    toast.success('Mensagem enviada com sucesso!')
  }

  const departments = [
    { icon: Headphones, title: 'Suporte Tecnico', desc: 'Problemas com a plataforma, pagamentos ou acesso.', email: 'suporte@aura.events', time: '2h', color: 'from-violet-500/10 to-violet-500/5', accent: '#7c3aed' },
    { icon: Zap, title: 'Vendas & Eventos', desc: 'Quero criar um evento ou tenho duvidas sobre precos.', email: 'vendas@aura.events', time: '4h', color: 'from-amber-500/10 to-amber-500/5', accent: '#d97706' },
    { icon: Shield, title: 'Parcerias', desc: 'Propostas comerciais, patrocinios e midia.', email: 'parcerias@aura.events', time: '24h', color: 'from-emerald-500/10 to-emerald-500/5', accent: '#059669' },
    { icon: MessageSquarePlus, title: 'Feedback', desc: 'Sugestoes, melhorias ou reportar bugs.', email: 'feedback@aura.events', time: '24h', color: 'from-rose-500/10 to-rose-500/5', accent: '#e11d48' },
  ]

  const contactDetails = [
    { icon: Mail, label: 'Email', value: 'contato@aura.events', sub: 'Respondemos em ate 24h' },
    { icon: Phone, label: 'Telefone', value: '(11) 4000-2025', sub: 'Seg a Sex, 9h as 18h' },
    { icon: MapPin, label: 'Endereco', value: 'Rua Augusta, 1500', sub: 'Consolacao, Sao Paulo/SP' },
    { icon: Clock, label: 'Horario', value: 'Seg a Sex: 9h-18h', sub: 'Sab: 10h-14h' },
  ]

  const inputClasses = "w-full px-5 py-4 bg-white/40 border rounded-2xl text-sm transition-all duration-300 outline-none placeholder:font-light"
  const inputStyle = { color: 'var(--espresso)' } as React.CSSProperties

  return (
    <div className="min-h-screen" style={{ background: 'var(--cream)' }}>
      <Header />

      {/* ===== HERO ===== */}
      <section ref={heroRef} className="pt-32 pb-20 relative overflow-hidden">
        {/* Decorative */}
        <div className="absolute top-40 right-0 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, var(--plum) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, var(--plum) 0%, transparent 70%)' }} />

        <div className="max-w-6xl mx-auto px-6 text-center relative">
          <div className="contact-hero-line w-16 h-px mx-auto mb-8" style={{ background: 'var(--plum)' }} />
          <span className="text-[10px] font-medium tracking-[0.35em] uppercase block mb-6" style={{ color: 'var(--plum)' }}>
            Entre em contato
          </span>
          <h1 className="contact-hero-title font-serif text-6xl lg:text-7xl leading-[0.95] mb-6" style={{ color: 'var(--espresso)' }}>
            Fale com a <em className="not-italic" style={{ color: 'var(--plum)' }}>Aura</em>
          </h1>
          <p className="contact-hero-sub text-sm max-w-md mx-auto leading-[1.8] font-light" style={{ color: 'var(--espresso)', opacity: 0.45 }}>
            Tem uma ideia, duvida ou quer criar algo incrivel junto?<br />
            Nossa equipe esta pronta para ouvir voce.
          </p>
        </div>
      </section>

      {/* ===== DEPARTMENTS ===== */}
      <section ref={cardsRef} className="pb-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {departments.map((d) => (
              <div
                key={d.title}
                className="dept-card group relative p-6 rounded-3xl border backdrop-blur-sm overflow-hidden transition-all duration-500 hover:shadow-xl hover:-translate-y-1"
                style={{
                  background: 'rgba(255,255,255,0.5)',
                  borderColor: 'rgba(255,255,255,0.6)',
                }}
              >
                {/* Gradient bg on hover */}
                <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(135deg, ${d.accent}08 0%, ${d.accent}03 100%)` }} />

                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-500 group-hover:scale-110" style={{ background: `${d.accent}15` }}>
                    <d.icon className="w-5 h-5" style={{ color: d.accent }} />
                  </div>

                  <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--espresso)' }}>{d.title}</h3>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--espresso)', opacity: 0.4 }}>{d.desc}</p>

                  <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(26,14,20,0.06)' }}>
                    <span className="text-[10px] font-medium" style={{ color: d.accent }}>{d.email}</span>
                    <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: `${d.accent}10`, color: d.accent }}>{d.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FORM + INFO ===== */}
      <section className="pb-32">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section header */}
          <div className="text-center mb-14">
            <span className="text-[10px] font-medium tracking-[0.3em] uppercase" style={{ color: 'var(--plum)' }}>Envie uma mensagem</span>
            <h2 className="font-serif text-3xl mt-3" style={{ color: 'var(--espresso)' }}>Como podemos ajudar?</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Info Panel */}
            <div className="lg:col-span-4 info-panel space-y-4">
              {contactDetails.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-4 p-5 rounded-2xl border backdrop-blur-sm transition-all duration-300 hover:bg-white/70 group"
                  style={{ background: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.6)' }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:shadow-md" style={{ background: 'var(--plum-10)' }}>
                    <item.icon className="w-4 h-4" style={{ color: 'var(--plum)' }} />
                  </div>
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--espresso)', opacity: 0.3 }}>{item.label}</div>
                    <div className="text-sm font-medium" style={{ color: 'var(--espresso)' }}>{item.value}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--espresso)', opacity: 0.35 }}>{item.sub}</div>
                  </div>
                </div>
              ))}

              {/* Social */}
              <div className="p-6 rounded-2xl border backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.6)' }}>
                <div className="text-[10px] font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--espresso)', opacity: 0.3 }}>Redes Sociais</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: Instagram, label: '@aura.events' },
                    { icon: MessageCircle, label: 'WhatsApp' },
                    { icon: Globe, label: 'aura.events' },
                  ].map((s) => (
                    <button key={s.label} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs transition-all duration-300 hover:bg-plum/10" style={{ background: 'rgba(247,245,240,0.8)', color: 'var(--espresso)', opacity: 0.6 }}>
                      <s.icon className="w-3.5 h-3.5" /> {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* WhatsApp CTA */}
              <a href="#" className="flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 hover:shadow-lg group" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#22c55e' }}>
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: '#166534' }}>Atendimento via WhatsApp</div>
                  <div className="text-xs mt-0.5" style={{ color: '#16a34a' }}>Resposta mais rapida</div>
                </div>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" style={{ color: '#16a34a' }} />
              </a>
            </div>

            {/* Right Form Panel */}
            <div className="lg:col-span-8 form-panel">
              <div className="p-8 lg:p-10 rounded-3xl border backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.6)' }}>
                {sent ? (
                  <div className="py-20 text-center">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#dcfce7' }}>
                      <CheckCircle2 className="w-10 h-10" style={{ color: '#16a34a' }} />
                    </div>
                    <h3 className="font-serif text-2xl mb-3" style={{ color: 'var(--espresso)' }}>Mensagem enviada!</h3>
                    <p className="text-sm max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--espresso)', opacity: 0.5 }}>
                      Obrigado pelo contato. Nossa equipe vai responder em ate 24 horas uteis.
                    </p>
                    <button
                      onClick={() => { setSent(false); setForm({ name: '', email: '', phone: '', subject: '', message: '' }) }}
                      className="mt-8 px-8 py-3 rounded-full text-sm font-medium transition-all hover:shadow-glow"
                      style={{ background: 'var(--plum)', color: 'var(--cream)' }}
                    >
                      Enviar outra mensagem
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Name */}
                      <div className="relative">
                        <label className="text-[10px] font-medium uppercase tracking-wider mb-2 block flex items-center gap-1.5" style={{ color: 'var(--espresso)', opacity: 0.35 }}>
                          <User className="w-3 h-3" /> Nome completo *
                        </label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={e => setForm({ ...form, name: e.target.value })}
                          onFocus={() => setFocusedField('name')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Como devemos te chamar?"
                          className={inputClasses}
                          style={{
                            ...inputStyle,
                            borderColor: focusedField === 'name' ? 'var(--plum-30)' : 'rgba(255,255,255,0.6)',
                            background: focusedField === 'name' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                          }}
                        />
                      </div>
                      {/* Email */}
                      <div className="relative">
                        <label className="text-[10px] font-medium uppercase tracking-wider mb-2 block flex items-center gap-1.5" style={{ color: 'var(--espresso)', opacity: 0.35 }}>
                          <AtSign className="w-3 h-3" /> Email *
                        </label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => setForm({ ...form, email: e.target.value })}
                          onFocus={() => setFocusedField('email')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="seu@email.com"
                          className={inputClasses}
                          style={{
                            ...inputStyle,
                            borderColor: focusedField === 'email' ? 'var(--plum-30)' : 'rgba(255,255,255,0.6)',
                            background: focusedField === 'email' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Phone */}
                      <div className="relative">
                        <label className="text-[10px] font-medium uppercase tracking-wider mb-2 block flex items-center gap-1.5" style={{ color: 'var(--espresso)', opacity: 0.35 }}>
                          <Phone className="w-3 h-3" /> Telefone
                        </label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={e => setForm({ ...form, phone: e.target.value })}
                          onFocus={() => setFocusedField('phone')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="(11) 99999-9999"
                          className={inputClasses}
                          style={{
                            ...inputStyle,
                            borderColor: focusedField === 'phone' ? 'var(--plum-30)' : 'rgba(255,255,255,0.6)',
                            background: focusedField === 'phone' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                          }}
                        />
                      </div>
                      {/* Subject */}
                      <div className="relative">
                        <label className="text-[10px] font-medium uppercase tracking-wider mb-2 block flex items-center gap-1.5" style={{ color: 'var(--espresso)', opacity: 0.35 }}>
                          <FileText className="w-3 h-3" /> Assunto
                        </label>
                        <select
                          value={form.subject}
                          onChange={e => setForm({ ...form, subject: e.target.value })}
                          onFocus={() => setFocusedField('subject')}
                          onBlur={() => setFocusedField(null)}
                          className={inputClasses + ' cursor-pointer appearance-none'}
                          style={{
                            ...inputStyle,
                            borderColor: focusedField === 'subject' ? 'var(--plum-30)' : 'rgba(255,255,255,0.6)',
                            background: focusedField === 'subject' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                            opacity: form.subject ? 1 : 0.5,
                          }}
                        >
                          <option value="">Selecione um assunto...</option>
                          <option value="evento">Quero criar um evento</option>
                          <option value="afiliado">Quero ser afiliado</option>
                          <option value="suporte">Suporte tecnico</option>
                          <option value="parceria">Proposta de parceria</option>
                          <option value="outro">Outro assunto</option>
                        </select>
                      </div>
                    </div>

                    {/* Message */}
                    <div className="relative">
                      <label className="text-[10px] font-medium uppercase tracking-wider mb-2 block flex items-center gap-1.5" style={{ color: 'var(--espresso)', opacity: 0.35 }}>
                        <AlignLeft className="w-3 h-3" /> Mensagem *
                      </label>
                      <textarea
                        value={form.message}
                        onChange={e => setForm({ ...form, message: e.target.value })}
                        onFocus={() => setFocusedField('message')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Conte-nos como podemos ajudar voce..."
                        rows={6}
                        className={inputClasses + ' resize-none leading-relaxed'}
                        style={{
                          ...inputStyle,
                          borderColor: focusedField === 'message' ? 'var(--plum-30)' : 'rgba(255,255,255,0.6)',
                          background: focusedField === 'message' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                        }}
                      />
                    </div>

                    {/* Submit */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full py-4 rounded-full text-sm font-medium transition-all duration-500 hover:shadow-glow flex items-center justify-center gap-3 group"
                        style={{ background: 'var(--plum)', color: 'var(--cream)' }}
                      >
                        <Send className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        Enviar Mensagem
                        <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                      </button>
                      <p className="text-[10px] text-center mt-4" style={{ color: 'var(--espresso)', opacity: 0.2 }}>
                        Ao enviar, voce concorda com nossa Politica de Privacidade e Termos de Uso.
                      </p>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MAP SECTION ===== */}
      <section className="relative">
        <div className="w-full h-72 relative overflow-hidden">
          {/* Gradient overlay */}
          <div className="absolute inset-0 z-10" style={{ background: 'linear-gradient(to bottom, var(--cream) 0%, transparent 30%, transparent 70%, var(--cream) 100%)' }} />

          {/* Grid pattern */}
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(122,59,105,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(122,59,105,0.06) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />

          {/* Center pin */}
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--plum)', boxShadow: '0 8px 32px rgba(122,59,105,0.3)' }}>
                <MapPin className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-serif text-lg" style={{ color: 'var(--espresso)' }}>Rua Augusta, 1500</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--espresso)', opacity: 0.4 }}>Consolacao, Sao Paulo/SP — Proximo ao Metro Consolacao</p>
            </div>
          </div>

          {/* Corner decorations */}
          <div className="absolute top-6 left-6 z-20">
            <Sparkles className="w-5 h-5" style={{ color: 'var(--plum)', opacity: 0.3 }} />
          </div>
          <div className="absolute bottom-6 right-6 z-20">
            <Sparkles className="w-5 h-5" style={{ color: 'var(--plum)', opacity: 0.3 }} />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
