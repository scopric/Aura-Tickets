import { Link } from 'react-router'
import { Smartphone, Apple, ArrowRight, QrCode, Bell, MapPin, CreditCard } from 'lucide-react'

export default function AppDownload() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <Link to="/" className="inline-flex items-center gap-2 mb-8">
          <img src="/images/logo-aura.png" alt="Aura" className="h-12 w-auto" />
        </Link>

        <h1 className="font-serif text-4xl text-espresso mb-3">
          Baixe o <span className="italic text-plum">App</span>
        </h1>
        <p className="text-espresso/50 mb-10">
          Uma experiencia completa na palma da sua mao. Ingressos, comandas, networking e muito mais.
        </p>

        {/* Phone mockup */}
        <div className="relative mx-auto mb-10 w-48 h-80 bg-void rounded-[2.5rem] border-4 border-espresso/10 shadow-elevated overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-espresso/10 rounded-b-xl" />
          <div className="p-4 pt-8 h-full flex flex-col">
            <div className="text-center mb-4">
              <img src="/images/logo-aura.png" alt="Aura" className="h-6 w-auto mx-auto mb-2" />
              <p className="text-[8px] text-cream/40">Aura Events</p>
            </div>
            <div className="space-y-2 flex-1">
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[9px] text-cream font-medium">Noite Eletro 2025</div>
                <div className="text-[8px] text-cream/40">15 Jun · Warehouse</div>
              </div>
              <div className="p-2 rounded-xl bg-plum/10 border border-plum/20">
                <div className="text-[9px] text-cream font-medium">Mesa Aurora</div>
                <div className="text-[8px] text-plum/60">6 membros · 94% match</div>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <div className="text-[9px] text-cream font-medium">Comanda Digital</div>
                <div className="text-[8px] text-cream/40">3 itens · R$ 85</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cream/20" />
              <div className="w-1.5 h-1.5 rounded-full bg-plum" />
              <div className="w-1.5 h-1.5 rounded-full bg-cream/20" />
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mb-8 text-left">
          {[
            { icon: QrCode, label: 'Ingresso Digital', desc: 'QR Code na tela' },
            { icon: Bell, label: 'Notificacoes', desc: 'Alertas em tempo real' },
            { icon: MapPin, label: 'Navegacao', desc: 'Mapa do evento' },
            { icon: CreditCard, label: 'Comanda', desc: 'Pre-order facil' },
          ].map(f => (
            <div key={f.label} className="p-3 rounded-xl bg-white/60 border border-white/60 flex items-center gap-2">
              <f.icon className="w-4 h-4 text-plum flex-shrink-0" />
              <div>
                <div className="text-xs font-medium text-espresso">{f.label}</div>
                <div className="text-[10px] text-espresso/40">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Download buttons */}
        <div className="space-y-3">
          <button className="w-full py-3.5 bg-void text-cream font-medium rounded-2xl hover:bg-void/80 transition-all flex items-center justify-center gap-3">
            <Apple className="w-5 h-5" />
            Download para iOS
          </button>
          <button className="w-full py-3.5 bg-void text-cream font-medium rounded-2xl hover:bg-void/80 transition-all flex items-center justify-center gap-3">
            <Smartphone className="w-5 h-5" />
            Download para Android
          </button>
        </div>

        <p className="text-xs text-espresso/30 mt-6">
          Disponivel em breve nas lojas oficiais
        </p>

        <Link to="/" className="inline-flex items-center gap-1 text-xs text-plum hover:underline mt-4">
          <ArrowRight className="w-3 h-3" />
          Voltar para o site
        </Link>
      </div>
    </div>
  )
}
