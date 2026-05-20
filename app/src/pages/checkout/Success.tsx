import { Link } from 'react-router'
import { CheckCircle, Download, Ticket, Mail, Calendar, Users, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import YourTable from '../../components/YourTable'

export default function CheckoutSuccess() {
  const ref = useRef<HTMLDivElement>(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.success-icon', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' })
      gsap.fromTo('.success-text', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.3 })
      gsap.fromTo('.success-card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'power3.out', delay: 0.5 })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={ref} className="min-h-screen bg-canvas pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="success-icon w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="success-text font-serif text-3xl text-espresso mb-2">Pagamento Confirmado!</h1>
          <p className="success-text text-espresso/50">Seu ingresso foi reservado com sucesso. Enviamos os detalhes para seu e-mail.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Ticket + Actions */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-4">
              {/* Ticket Card */}
              <div className="success-card bg-void text-cream rounded-3xl p-6 text-left">
                <div className="flex items-center gap-3 mb-4">
                  <img src="/images/ticket-vip.png" alt="Ticket" className="w-16 h-auto" />
                  <div>
                    <div className="text-sm font-medium">Noite Eletro 2025</div>
                    <div className="text-xs text-cream/40">Mesa Coletiva x1</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-cream/40 mb-2">
                  <Calendar className="w-3 h-3" />
                  15 de Junho, 2025 · 22:00
                </div>
                <div className="flex items-center gap-2 text-xs text-cream/40">
                  <Ticket className="w-3 h-3" />
                  #MC-001 · Lugar 1
                </div>
                <div className="mt-4 p-3 rounded-xl bg-plum/10 border border-plum/20">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-plum" />
                    <span className="text-xs text-cream/70">Seu matchmaking está em andamento</span>
                  </div>
                </div>
              </div>

              {/* Toggle Table View */}
              <button
                onClick={() => setShowTable(!showTable)}
                className="success-card w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {showTable ? 'Ocultar Minha Mesa' : 'Ver Minha Mesa'}
              </button>

              {/* Actions */}
              <div className="success-card space-y-3">
                <button className="w-full py-3 bg-void text-cream font-medium rounded-full hover:bg-void/80 transition-all flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />
                  Baixar Ingresso
                </button>
                <button className="w-full py-3 border border-espresso/15 text-espresso font-medium rounded-full hover:bg-espresso/5 transition-all flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4" />
                  Enviar por E-mail
                </button>
                <Link to="/event/noite-eletro-2025" className="block w-full py-3 text-sm text-espresso/50 hover:text-plum transition-colors text-center">
                  Voltar ao evento
                </Link>
              </div>
            </div>
          </div>

          {/* Right: Your Table */}
          <div className="lg:col-span-3">
            {showTable ? (
              <YourTable />
            ) : (
              <div className="success-card bg-void text-cream rounded-3xl p-8 text-center h-full flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-plum/20 flex items-center justify-center mb-4 animate-pulse-glow">
                  <Users className="w-8 h-8 text-plum" />
                </div>
                <h3 className="font-serif text-2xl mb-2">Sua Mesa Está Sendo Montada</h3>
                <p className="text-sm text-cream/50 mb-6 max-w-sm">
                  Nosso algoritmo está analisando perfis de compatibilidade para formar 
                  o grupo ideal para você. Em 48h você recebe seus colegas de mesa.
                </p>
                <div className="flex items-center gap-3 mb-6">
                  {['Temperamento', 'Interesses', 'Vibe'].map((tag) => (
                    <span key={tag} className="px-3 py-1.5 bg-white/5 text-cream/50 text-xs rounded-full border border-white/10 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-plum" />
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="w-full max-w-xs">
                  <div className="flex items-center justify-between text-xs text-cream/30 mb-2">
                    <span>Analisando perfis</span>
                    <span>85%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-plum rounded-full animate-pulse" style={{ width: '85%' }} />
                  </div>
                </div>
                <button
                  onClick={() => setShowTable(true)}
                  className="mt-6 text-sm text-plum hover:text-cream transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-4 h-4" />
                  Ver preview da minha mesa
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
