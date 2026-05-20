import { Link } from 'react-router'
import {
  ArrowLeft, ScanLine, Users, BarChart3, Bell,
  QrCode, Wifi, WifiOff, Download, Star, Shield, Zap, Check
} from 'lucide-react'
import { toast } from 'sonner'

const features = [
  {
    icon: ScanLine, title: 'Check-in Rapido', color: '#22c55e',
    desc: 'Leia QR codes na porta do evento. Valide ingressos em segundos.',
  },
  {
    icon: Users, title: 'Lista de Participantes', color: '#3b82f6',
    desc: 'Busque por nome, email ou CPF. Veja status de cada ingresso em tempo real.',
  },
  {
    icon: BarChart3, title: 'Dashboard em Tempo Real', color: '#7a3b69',
    desc: 'Acompanhe vendas, ocupacao e receita ao vivo durante o evento.',
  },
  {
    icon: Bell, title: 'Notificacoes Push', color: '#f59e0b',
    desc: 'Receba alertas de vendas, lotes esgotando e mensagens importantes.',
  },
  {
    icon: WifiOff, title: 'Funciona Offline', color: '#06b6d4',
    desc: 'Sem internet? Sem problema. O check-in funciona offline e sincroniza depois.',
  },
  {
    icon: QrCode, title: 'Scanner QR Code', color: '#8b5cf6',
    desc: 'Use a camera do celular para ler ingressos rapidamente.',
  },
]

export default function OrganizerApp() {
  const handleInstall = () => { toast.success('Instalacao iniciada!') }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/dashboard" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">App do Organizador</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie seus eventos na palma da mao</p>
        </div>
      </div>

      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-medium mb-4">
            <Zap className="w-3 h-3" /> PWA — Funciona em qualquer celular
          </div>
          <h2 className="font-serif text-3xl text-espresso mb-4">
            Controle total do seu evento, <em style={{ color: 'var(--plum)' }}>onde estiver</em>
          </h2>
          <p className="text-sm text-espresso/50 mb-6 leading-relaxed">
            Nosso app PWA (Progressive Web App) funciona diretamente no navegador do seu celular, 
            sem precisar baixar nada da loja. Instale na tela inicial e use como um app nativo.
          </p>
          <div className="flex flex-wrap gap-3 mb-6">
            <button onClick={handleInstall} className="px-6 py-3 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2">
              <Download className="w-4 h-4" /> Instalar App
            </button>
            <Link to="/app/download" className="px-6 py-3 border border-espresso/15 text-espresso text-sm rounded-full hover:bg-espresso/5 transition-all">
              Saiba Mais
            </Link>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-espresso/30">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> 100% Seguro</span>
            <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> Funciona offline</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3" /> 4.9 estrelas</span>
          </div>
        </div>
        {/* Phone mockup */}
        <div className="flex justify-center">
          <div className="w-64 h-[520px] rounded-[40px] border-4 border-espresso/10 bg-void p-3 shadow-2xl relative">
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 h-5 rounded-full bg-espresso/20" />
            <div className="w-full h-full rounded-[32px] overflow-hidden" style={{ background: 'var(--cream)' }}>
              {/* Fake app screen */}
              <div className="p-4 h-full">
                <div className="flex items-center justify-between mb-6 mt-4">
                  <div>
                    <div className="text-[10px] text-espresso/30">Noite Eletro 2025</div>
                    <div className="text-sm font-medium text-espresso">Dashboard</div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-plum/10 flex items-center justify-center">
                    <ScanLine className="w-4 h-4 text-plum" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="p-3 bg-white/60 rounded-xl">
                    <div className="text-lg font-medium text-espresso">184</div>
                    <div className="text-[9px] text-espresso/30">Check-ins</div>
                  </div>
                  <div className="p-3 bg-white/60 rounded-xl">
                    <div className="text-lg font-medium text-green-600">92%</div>
                    <div className="text-[9px] text-espresso/30">Ocupacao</div>
                  </div>
                </div>
                <div className="p-3 bg-white/60 rounded-xl mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-[10px] text-espresso/40">Vendas em tempo real</span>
                    <span className="text-[10px] text-green-600">+12%</span>
                  </div>
                  <div className="flex items-end gap-1 h-16">
                    {[40, 60, 45, 80, 55, 90, 70, 85, 60, 75].map((h, i) => (
                      <div key={i} className="flex-1 bg-plum/20 rounded-t" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-white/60 rounded-xl">
                  <div className="text-[10px] text-espresso/40 mb-2">Ultimos check-ins</div>
                  {['Ana Silva', 'Pedro Costa', 'Mariana Lima'].map((name, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/40 last:border-0">
                      <div className="w-6 h-6 rounded-full bg-plum/10 flex items-center justify-center">
                        <span className="text-[8px] text-plum">{name[0]}</span>
                      </div>
                      <span className="text-[10px] text-espresso flex-1">{name}</span>
                      <Check className="w-3 h-3 text-green-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {features.map(f => (
          <div key={f.title} className="p-5 rounded-2xl bg-white/60 border border-white/60 hover:-translate-y-0.5 hover:shadow-lg transition-all">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${f.color}15` }}>
              <f.icon className="w-5 h-5" style={{ color: f.color }} />
            </div>
            <h3 className="text-sm font-medium text-espresso mb-1">{f.title}</h3>
            <p className="text-xs text-espresso/40 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* How to install */}
      <div className="p-6 bg-white/60 border border-white/60 rounded-2xl">
        <h2 className="font-serif text-xl text-espresso mb-6 text-center">Como Instalar</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: '01', title: 'Acesse pelo celular', desc: 'Abra a Aura no navegador do seu celular (Chrome ou Safari)' },
            { step: '02', title: 'Toque no menu', desc: 'No Chrome, toque nos 3 pontos. No Safari, toque no botao de compartilhar' },
            { step: '03', title: 'Adicione a tela inicial', desc: 'Selecione "Adicionar a tela inicial" e pronto! O app esta instalado' },
          ].map(s => (
            <div key={s.step} className="text-center">
              <div className="font-serif text-4xl mb-3" style={{ color: 'var(--plum)', opacity: 0.3 }}>{s.step}</div>
              <h3 className="text-sm font-medium text-espresso mb-1">{s.title}</h3>
              <p className="text-xs text-espresso/40">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
