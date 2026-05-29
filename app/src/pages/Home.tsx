import { Link } from 'react-router-dom'
import { ArrowRight, Zap, Users, BarChart3, Palette, Ticket, Shield } from 'lucide-react'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useSEO } from '../hooks/useSEO'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import ModernHero from '../components/ModernHero'
import FAQSection from '../components/FAQSection'
import ContactSection from '../components/ContactSection'
import PricingSection from '../components/PricingSection'
import EventCarousel from '../components/EventCarousel'


gsap.registerPlugin(ScrollTrigger)

export default function Home() {
  useSEO({
    title: 'Evokaa Eventos — Plataforma Completa',
    description: 'Descubra eventos incríveis, compre ingressos com segurança e viva experiências inesquecíveis. A plataforma completa para produtores e participantes.',
    image: '/images/logo-evokaa.png',
  })

  const featuresRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const howItWorksRef = useRef<HTMLDivElement>(null)

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
      gsap.fromTo('.hiw-step',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, stagger: 0.15, ease: 'power3.out',
          scrollTrigger: { trigger: howItWorksRef.current, start: 'top 75%' }
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
    { icon: Zap, title: 'Crie em Minutos', desc: 'Configure seu evento com poucos cliques. Interface intuitiva e rápida.', accent: '#3b82f6' },
    { icon: Ticket, title: 'Gestão de Ingressos', desc: 'Múltiplos tipos, lotes, controle de capacidade em tempo real.', accent: '#06b6d4' },
    { icon: Palette, title: 'Brand Studio', desc: 'Personalize cores, fontes e estilos que combinam com sua marca.', accent: '#8b5cf6' },
    { icon: Users, title: 'Comprovação Social', desc: 'Mostre quem confirmou presença. Crie urgência natural.', accent: '#f59e0b' },
    { icon: BarChart3, title: 'Analytics Real-Time', desc: 'Acompanhe vendas, engajamento e métricas em dashboard elegante.', accent: '#6366f1' },
    { icon: Shield, title: 'Segurança Total', desc: 'Pagamentos seguros, validação de ingressos e proteção contra fraudes.', accent: '#ef4444' },
  ]

  const stats = [
    { value: '10K+', label: 'Eventos' },
    { value: '500K+', label: 'Ingressos' },
    { value: '98%', label: 'Satisfação' },
    { value: '50+', label: 'Países' },
  ]

  const landingFAQs = [
    { question: 'O que é a Evokaa?', answer: 'Evokaa é uma plataforma completa para criação e gestão de eventos. Desde o planejamento até a venda de ingressos e check-in na porta, tudo em um só lugar. Conectamos produtores, participantes e afiliados em uma experiência única.' },
    { question: 'Quanto custa usar a Evokaa?', answer: 'Criar uma conta é gratuita. Cobramos uma comissão sobre as vendas de ingressos (geralmente 5-10%), sem custo fixo mensal. Você só paga quando vende.' },
    { question: 'Como funciona a Mesa Coletiva?', answer: 'A Mesa Coletiva é um tipo de ingresso exclusivo onde 6 pessoas desconhecidas são agrupadas por afinidade de perfil. Cada pessoa responde um questionário rápido e nosso algoritmo forma mesas equilibradas. Inclui welcome drink e finger food.' },
    { question: 'Posso ter afiliados vendendo meus ingressos?', answer: 'Sim! Nosso sistema de afiliados permite que você cadastre vendedores com códigos únicos, cupons de desconto exclusivos e limites de ingressos. Acompanhe tudo em tempo real no painel.' },
    { question: 'Quais formas de pagamento são aceitas?', answer: 'Aceitamos PIX, Cartão de Crédito, Cartão de Débito, Boleto, Dinheiro e Transferência bancária. O dinheiro cai na sua conta em até 2 dias úteis.' },
    { question: 'Como funciona o check-in?', answer: 'Na porta do evento, você pode usar o modo Scanner (digita o código do ingresso) ou o modo Lista (busca o nome do participante). Ambos funcionam offline e atualizam em tempo real.' },
    { question: 'A Evokaa funciona para qualquer tipo de evento?', answer: 'Sim! Festas, shows, workshops, palestras, eventos corporativos, networking, gastronomia, esportes e muito mais. Você também pode criar tipos personalizados.' },
    { question: 'Como entro em contato com o suporte?', answer: 'Use o botão de feedback no canto inferior direito de qualquer página. Nossa equipe responde em até 24h. Produtores têm acesso ao FAQ completo no painel.' },
  ]

  return (
    <div>
      <ModernHero />

      {/* Destaques (Carrossel) */}
      <section className="py-16 md:py-24 max-w-5xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-[var(--espresso)]">
              Eventos em <em style={{ color: 'var(--plum)' }}>Destaque</em>
            </h2>
            <p className="text-[var(--ink-faint)] text-sm mt-2 max-w-md">
              Fique por dentro das experiências mais exclusivas e procuradas na nossa plataforma.
            </p>
          </div>
          <Link
            to="/events"
            className="text-xs font-bold text-plum hover:text-plum/80 flex items-center gap-1 group transition-all"
          >
            Buscar Todos os Eventos 
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <EventCarousel />
      </section>

      {/* Stats - minimal divider style */}
      <section ref={statsRef} className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="divider mb-16" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-16">
            {stats.map((stat) => (
              <div key={stat.label} className="stat-num text-center">
                <div className="font-bold text-4xl lg:text-5xl tracking-tight text-gradient">
                  {stat.value}
                </div>
                <div className="text-[11px] text-slate-400 uppercase tracking-[0.15em] mt-2">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          <div className="divider mt-16" />
        </div>
      </section>

      {/* Features - cleaner grid */}
      <section ref={featuresRef} className="py-28 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-slate-900">
              Tudo que você <em className="text-gradient not-italic">precisa</em>
            </h2>
            <p className="text-slate-400 text-sm mt-4 max-w-md mx-auto leading-relaxed">
              Ferramentas poderosas para criar experiências memoráveis, do início ao fim.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="feature-item group p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 bg-white border border-slate-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5"
              >
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-105"
                  style={{ background: `${f.accent}12` }}
                >
                  <f.icon className="w-5 h-5" style={{ color: f.accent }} />
                </div>
                <h4 className="text-slate-900 mb-2 text-[15px] font-semibold">{f.title}</h4>
                <p className="text-[13px] text-slate-400 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works - dark section */}
      <section 
        ref={howItWorksRef}
        className="py-28 relative overflow-hidden bg-slate-950"
      >
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '40px 40px' }}
        />
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-white">
              Como <em className="text-gradient not-italic">Funciona</em>
            </h2>
            <p className="text-white/30 text-sm mt-4 max-w-sm mx-auto">
              Três passos simples para transformar sua visão em realidade.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
            {[
              { num: '01', title: 'Crie', desc: 'Escolha o tipo de evento, defina data, local e lotes de ingresso. Nossa calculadora mostra seus números em tempo real.' },
              { num: '02', title: 'Gerencie', desc: 'Controle orçamento, fornecedores, equipe e cronograma em uma única pasta. Tudo centralizado.' },
              { num: '03', title: 'Venda', desc: 'Publique, venda ingressos e acompanhe tudo em tempo real. Check-in na porta com QR code.' },
            ].map((step, i) => (
              <div key={step.num} className="hiw-step relative">
                <div className="font-bold text-7xl mb-5 select-none text-gradient opacity-20">
                  {step.num}
                </div>
                <h3 className="text-white text-lg font-semibold mb-3">
                  {step.title}
                </h3>
                <p className="text-white/30 text-[13px] leading-relaxed">
                  {step.desc}
                </p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 -right-8 w-16 h-px bg-gradient-to-r from-white/10 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <PricingSection />

      {/* FAQ */}
      <section className="py-28 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <FAQSection
            title="Perguntas Frequentes"
            subtitle="Tudo que você precisa saber antes de começar"
            items={landingFAQs}
          />
        </div>
      </section>

      {/* Contact */}
      <ContactSection />

      {/* CTA */}
      <section ref={ctaRef} className="py-28 bg-slate-50">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="cta-block">
            <h2 className="text-slate-900 leading-tight mb-6">
              Pronto para criar<br />
              <em className="text-gradient not-italic">algo extraordinário?</em>
            </h2>
            <p className="text-slate-400 text-sm mb-10 max-w-sm mx-auto leading-relaxed">
              Junte-se a milhares de criadores que já transformam experiências com a Evokaa.
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
