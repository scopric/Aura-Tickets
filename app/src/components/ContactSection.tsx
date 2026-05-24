import { useState } from 'react'
import {
  Mail, Phone, MapPin, Clock, Send, Instagram, MessageCircle,
  CheckCircle2, Globe
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

export default function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) {
      toast.error('Preencha nome, email e mensagem')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Por favor, insira um e-mail valido.')
      return
    }

    try {
      const { error } = await supabase.from('contact_messages').insert({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim() || 'Contato via site',
        message: form.message.trim(),
        page: window.location.pathname,
      })

      if (error) {
        console.error('[Contact]', error)
        toast.error('Erro ao enviar. Tente novamente.')
        return
      }

      setSent(true)
      toast.success('Mensagem enviada! Responderemos em ate 24h.')
      setTimeout(() => {
        setSent(false)
        setForm({ name: '', email: '', subject: '', message: '' })
      }, 3000)
    } catch (err) {
      console.error('[Contact]', err)
      toast.error('Erro ao enviar. Tente novamente.')
    }
  }

  const contactInfo = [
    { icon: Mail, label: 'Email', value: 'contato@aura.events', href: 'mailto:contato@aura.events' },
    { icon: Phone, label: 'Telefone', value: '(11) 4000-2025', href: 'tel:+551140002025' },
    { icon: MapPin, label: 'Endereco', value: 'Rua Augusta, 1500 — Consolacao, Sao Paulo/SP', href: '#' },
    { icon: Clock, label: 'Atendimento', value: 'Seg a Sex: 9h as 18h | Sab: 10h as 14h', href: '#' },
  ]

  return (
    <section className="py-28 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-plum/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-plum/[0.02] rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="w-12 h-12 rounded-full bg-plum/10 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-6 h-6 text-plum" />
          </div>
          <h2 className="font-serif text-4xl text-espresso mb-3">
            Fale com a <em style={{ color: 'var(--plum)' }}>Aura</em>
          </h2>
          <p className="text-sm text-espresso/50 max-w-md mx-auto leading-relaxed">
            Tem uma ideia, duvida ou quer criar algo incrivel junto? Estamos aqui para ouvir voce.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Contact Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Info Cards */}
            <div className="space-y-3">
              {contactInfo.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm hover:bg-white/80 hover:border-plum/20 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-plum/10 flex items-center justify-center flex-shrink-0 group-hover:bg-plum/20 transition-colors">
                    <item.icon className="w-4 h-4 text-plum" />
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-espresso/30 uppercase tracking-wider">{item.label}</div>
                    <div className="text-sm text-espresso mt-0.5">{item.value}</div>
                  </div>
                </a>
              ))}
            </div>

            {/* Social */}
            <div className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
              <div className="text-[10px] font-medium text-espresso/30 uppercase tracking-wider mb-3">Redes Sociais</div>
              <div className="flex items-center gap-3">
                {[
                  { icon: Instagram, label: 'Instagram', href: '#' },
                  { icon: MessageCircle, label: 'WhatsApp', href: '#' },
                  { icon: Globe, label: 'Site', href: '#' },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    className="w-10 h-10 rounded-xl bg-canvas flex items-center justify-center text-espresso/30 hover:bg-plum/10 hover:text-plum transition-all"
                    title={social.label}
                  >
                    <social.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Response Badge */}
            <div className="p-4 rounded-2xl bg-green-50/60 border border-green-100 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
              <div>
                <div className="text-xs text-green-700 font-medium">Resposta rapida garantida</div>
                <div className="text-[10px] text-green-500/70">Respondemos em ate 24 horas uteis</div>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-3">
            <div className="p-6 lg:p-8 rounded-3xl bg-white/60 border border-white/60 backdrop-blur-sm">
              {sent ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-serif text-xl text-espresso mb-2">Mensagem enviada!</h3>
                  <p className="text-sm text-espresso/50">Obrigado pelo contato. Nossa equipe vai responder em ate 24h.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-medium text-espresso/40 uppercase tracking-wider mb-1.5 block">Nome *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="Seu nome"
                        className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-espresso/40 uppercase tracking-wider mb-1.5 block">Email *</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="seu@email.com"
                        className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-espresso/40 uppercase tracking-wider mb-1.5 block">Assunto</label>
                    <select
                      value={form.subject}
                      onChange={e => setForm({ ...form, subject: e.target.value })}
                      className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso/60 focus:outline-none focus:border-plum/30 transition-colors"
                    >
                      <option value="">Selecione um assunto...</option>
                      <option value="evento">Quero criar um evento</option>
                      <option value="afiliado">Quero ser afiliado</option>
                      <option value="suporte">Suporte tecnico</option>
                      <option value="parceria">Proposta de parceria</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium text-espresso/40 uppercase tracking-wider mb-1.5 block">Mensagem *</label>
                    <textarea
                      value={form.message}
                      onChange={e => setForm({ ...form, message: e.target.value })}
                      placeholder="Conte-nos como podemos ajudar..."
                      rows={5}
                      className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Enviar Mensagem
                  </button>

                  <p className="text-[10px] text-espresso/20 text-center">
                    Ao enviar, voce concorda com nossa politica de privacidade.
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
