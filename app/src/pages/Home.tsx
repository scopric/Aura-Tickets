import { Link } from 'react-router-dom'
import { ArrowRight, Zap, Users, BarChart3, Palette, Ticket, Shield } from 'lucide-react'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useSEO } from '../hooks/useSEO'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import VideoHero from '../components/VideoHero'
import FAQSection from '../components/FAQSection'
import ContactSection from '../components/ContactSection'
import PricingSection from '../components/PricingSection'

gsap.registerPlugin(ScrollTrigger)

export default function Home() {
  useSEO({
    title: 'Aura Tickets — Plataforma de Ingressos Sociais',
    description: 'Descubra eventos incríveis, compre ingressos com segurança e viva experiências inesquecíveis. A plataforma completa para produtores e participantes.',
    image: '/og-image.jpg',
  })

  const featuresRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.feature-item',
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: 'power3.out',
          scrollTrigger: { trigger: featuresRef.current, start: 'top 80%' }
        }
      )
      gsap.fromTo('.stat-num',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out',
          scrollTrigger: { trigger: statsRef.current, start: 'top 85%' }
        }
      )
      gsap.fromTo('.cta-block',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: ctaRef.current, start: 'top 80%' }
        }
      )
    })
    return () => ctx.revert()
  }, [])

  const features = [
    { icon: Zap, title: 'Crie em Minutos', desc: 'Configure seu evento com poucos cliques. Interface intuitiva e rapida.', accent: 'var(--plum)' },
    { icon: Ticket, title: 'Gestao de Ingressos', desc: 'Multiplos tipos, lotes, controle de capacidade em tempo real.', accent: '#22c55e' },
    { icon: Palette, title: 'Brand Studio', desc: 'Personalize cores, fontes e estilos que combinam com sua marca.', accent: '#3b82f6' },
    { icon: Users, title: 'Comprovacao Social', desc: 'Mostre quem confirmou presenca. Crie urgencia natural.', accent: '#f59e0b' },
    { icon: BarChart3, title: 'Analytics Real-Time', desc: 'Acompanhe vendas, engajamento e metricas em dashboard elegante.', accent: '#8b5cf6' },
    { icon: Shield, title: 'Seguranca Total', desc: 'Pagamentos seguros, validacao de ingressos e protecao contra fraudes.', accent: '#ef4444' },
  ]

  const stats = [
    { value: '10K+', label: 'Eventos' },
    { value: '500K+', label: 'Ingressos' },
    { value: '98%', label: 'Satisfacao' },
    { value: '50+', label: 'Paises' },
  ]

  const landingFAQs = [
    { question: 'O que e a Aura?', answer: 'Aura e uma plataforma completa para criacao e gestao de eventos. Desde o planejamento ate a venda de ingressos e check-in na porta, tudo em um so lugar. Conectamos produtores, participantes e afiliados em uma experiencia unica.' },
    { question: 'Quanto custa usar a Aura?', answer: 'Criar uma conta e gratuita. Cobramos uma comissao sobre as vendas de ingressos (geralmente 5-10%), sem custo fixo mensal. Voce so paga quando vende.' },
    { question: 'Como funciona a Mesa Coletiva?', answer: 'A Mesa Coletiva e um tipo de ingresso exclusivo onde 6 pessoas desconhecidas sao agrupadas por afinidade de perfil. Cada pessoa responde um questionario rapido e nosso algoritmo forma mesas equilibradas. Inclui welcome drink e finger food.' },
    { question: 'Posso ter afiliados vendendo meus ingressos?', answer: 'Sim! Nosso sistema de afiliados permite que voce cadastre vendedores com codigos unicos, cupons de desconto exclusivos e limites de ingressos. Acompanhe tudo em tempo real no painel.' },
    { question: 'Quais formas de pagamento sao aceitas?', answer: 'Aceitamos PIX, Cartao de Credito, Cartao de Debito, Boleto, Dinheiro e Transferencia bancaria. O dinheiro cai na sua conta em ate 2 dias uteis.' },
    { question: 'Como funciona o check-in?', answer: 'Na porta do evento, voce pode usar o modo Scanner (digita o codigo do ingresso) ou o modo Lista (busca o nome do participante). Ambos funcionam offline e atualizam em tempo real.' },
    { question: 'A Aura funciona para qualquer tipo de evento?', answer: 'Sim! Festas, shows, workshops, palestras, eventos corporativos, networking, gastronomia, esportes e muito mais. Voce tambem pode criar tipos personalizados.' },
    { question: 'Como entro em contato com o suporte?', answer: 'Use o botao de feedback no canto inferior direito de qualquer pagina. Nossa equipe responde em ate 24h. Produtores tem acesso ao FAQ completo no painel.' },
  ]

  return (
    <div>
      <VideoHero />

      {/* Stats - minimal divider style */}
      <section ref={statsRef} className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="divider mb-16" />
          <div className="grid grid-cols-4 gap-8 lg:gap-16">
            {stats.map((stat) => (
              <div key={stat.label} className="stat-num text-center">
                <div 
                  className="font-serif text-4xl lg:text-5xl tracking-tight"
                  style={{ color: 'var(--plum)' }}
                >
                  {stat.value}
                </div>
                <div className="text-[11px] text-[var(--ink-faint)] uppercase tracking-[0.15em] mt-2">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          <div className="divider mt-16" />
        </div>
      </section>

      {/* Features - cleaner grid */}
      <section ref={featuresRef} className="pb-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-[var(--espresso)]">
              Tudo que voce <em style={{ color: 'var(--plum)' }}>precisa</em>
            </h2>
            <p className="text-[var(--ink-faint)] text-sm mt-4 max-w-md mx-auto leading-relaxed">
              Ferramentas poderosas para criar experiencias memoraveis, do inicio ao fim.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="feature-item group p-6 rounded-2xl transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background: 'rgba(255,255,255,0.4)',
                  border: '1px solid rgba(255,255,255,0.5)',
                  boxShadow: '0 1px 2px rgba(26,14,20,0.03)',
                }}
              >
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-105"
                  style={{ background: `${f.accent}10` }}
                >
                  <f.icon className="w-4.5 h-4.5" style={{ color: f.accent }} />
                </div>
                <h4 className="text-[var(--espresso)] mb-2">{f.title}</h4>
                <p className="text-[13px] text-[var(--ink-faint)] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works - dark section */}
      <section 
        className="py-28 relative overflow-hidden"
        style={{ background: 'var(--void)' }}
      >
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '40px 40px' }}
        />
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-[var(--cream)]">
              Como <em style={{ color: '#c49ab8' }}>Funciona</em>
            </h2>
            <p className="text-white/30 text-sm mt-4 max-w-sm mx-auto">
              Tres passos simples para transformar sua visao em realidade.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
            {[
              { num: '01', title: 'Crie', desc: 'Escolha o tipo de evento, defina data, local e lotes de ingresso. Nossa calculadora mostra seus numeros em tempo real.' },
              { num: '02', title: 'Gerencie', desc: 'Controle orcamento, fornecedores, equipe e cronograma em uma unica pasta. Tudo centralizado.' },
              { num: '03', title: 'Venda', desc: 'Publique, venda ingressos e acompanhe tudo em tempo real. Check-in na porta com QR code.' },
            ].map((step, i) => (
              <div key={step.num} className="relative">
                <div 
                  className="font-serif text-7xl mb-5 select-none"
                  style={{ color: 'rgba(122,59,105,0.2)' }}
                >
                  {step.num}
                </div>
                <h3 className="text-[var(--cream)] text-lg font-semibold mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {step.title}
                </h3>
                <p className="text-white/30 text-[13px] leading-relaxed">
                  {step.desc}
                </p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 -right-8 w-16 divider" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.08), transparent)' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <PricingSection />

      {/* FAQ */}
      <section className="py-28">
        <div className="max-w-4xl mx-auto px-6">
          <FAQSection
            title="Perguntas Frequentes"
            subtitle="Tudo que voce precisa saber antes de comecar"
            items={landingFAQs}
          />
        </div>
      </section>

      {/* Contact */}
      <ContactSection />

      {/* CTA */}
      <section ref={ctaRef} className="py-28">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="cta-block">
            <h2 className="text-[var(--espresso)] leading-tight mb-6">
              Pronto para criar<br />
              <em style={{ color: 'var(--plum)' }}>algo extraordinario?</em>
            </h2>
            <p className="text-[var(--ink-faint)] text-sm mb-10 max-w-sm mx-auto leading-relaxed">
              Junte-se a milhares de criadores que ja transformam experiencias com a Aura.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/auth/register"
                className="btn-primary flex items-center gap-2"
              >
                Criar Meu Evento
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/producer/brand"
                className="btn-ghost"
              >
                Explorar Brand Studio
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
