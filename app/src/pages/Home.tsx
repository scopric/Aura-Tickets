import { Link } from 'react-router-dom'
import { ArrowRight, Zap, Users, BarChart3, Palette, Ticket, Shield, Check, CheckCircle2, Paintbrush, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useSEO } from '../hooks/useSEO'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import ModernHero from '../components/ModernHero'
import FAQSection from '../components/FAQSection'
import ContactSection from '../components/ContactSection'
import PricingSection from '../components/PricingSection'
import EventCarousel from '../components/EventCarousel'


gsap.registerPlugin(ScrollTrigger)

// ================= WIDGETS E CARDS AUXILIARES DO BENTO GRID =================

function FeatureCard({ 
  title, 
  desc, 
  accent = '#1D68C4', 
  className = '', 
  children 
}: { 
  title: string
  desc: string
  accent?: string
  className?: string
  children: React.ReactNode 
}) {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    cardRef.current.style.setProperty('--mouse-x', `${x}px`)
    cardRef.current.style.setProperty('--mouse-y', `${y}px`)
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(29,104,196,0.06)] group flex flex-col justify-between min-h-[350px] ${className}`}
      style={{
        '--mouse-x': '0px',
        '--mouse-y': '0px',
      } as React.CSSProperties}
    >
      {/* Background Spotlight Glow */}
      <div 
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"
        style={{
          background: `radial-gradient(350px circle at var(--mouse-x) var(--mouse-y), ${accent}0d, transparent 85%)`
        }}
      />
      {/* Border Spotlight Glow */}
      <div 
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"
        style={{
          background: `radial-gradient(120px circle at var(--mouse-x) var(--mouse-y), ${accent}33, transparent 80%)`,
          padding: '1px',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude'
        }}
      />
      
      {/* Conteúdo Superior: Ilustração / Widget */}
      <div className="relative z-20 flex-1 flex items-center justify-center mb-6">
        {children}
      </div>

      {/* Conteúdo Inferior: Título e Descrição */}
      <div className="relative z-20 space-y-2 mt-auto">
        <h4 className="text-slate-900 text-[15px] font-bold tracking-tight font-serif flex items-center gap-2 group-hover:text-slate-950 transition-colors">
          {title}
        </h4>
        <p className="text-[13px] text-slate-400 font-light leading-relaxed">
          {desc}
        </p>
      </div>
    </div>
  )
}

function WizardWidget() {
  return (
    <div className="w-full max-w-[240px] bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 shadow-inner">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold">
          <Check className="w-3 h-3 stroke-[3]" />
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-bold text-slate-800 leading-none">1. Dados do Evento</div>
          <div className="text-[8px] text-slate-400 mt-0.5">Festival de Música Eletrônica</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border border-blue-500 bg-blue-50 flex items-center justify-center text-blue-600 text-[10px] font-bold relative">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping absolute" />
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full relative" />
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-bold text-slate-800 leading-none">2. Configurar Ingressos</div>
          {/* Barra de progresso animada */}
          <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div className="bg-blue-500 h-full w-[60%] rounded-full group-hover:w-full transition-all duration-1000 ease-out" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 opacity-40 group-hover:opacity-75 transition-opacity duration-500">
        <div className="w-5 h-5 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-[10px] font-bold">
          3
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-bold text-slate-800 leading-none">3. Publicar na Plataforma</div>
        </div>
      </div>
    </div>
  )
}

function TicketWidget() {
  return (
    <div className="w-full max-w-[420px] flex flex-col sm:flex-row items-center gap-6 p-2">
      {/* Ingresso Holográfico com perspectiva e rotação */}
      <div 
        className="w-[180px] h-[95px] relative rounded-xl bg-gradient-to-br from-[#1D68C4] via-[#8F33F5] to-[#4A60E3] p-[1px] shadow-[0_15px_35px_rgba(143,51,245,0.15)] transition-all duration-700 ease-out [transform-style:preserve-3d] group-hover:[transform:rotateX(12deg)_rotateY(-15deg)_translateZ(10px)] [perspective:800px] shrink-0"
      >
        <div className="w-full h-full rounded-xl bg-slate-950 p-3 flex flex-col justify-between overflow-hidden relative">
          {/* Efeito Holográfico de brilho */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out" />
          
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="text-[7px] font-bold text-white/50 tracking-wider uppercase">EVOKAA VIP PASS</span>
            <Ticket className="w-3.5 h-3.5 text-white/80" />
          </div>
          
          <div className="mt-2">
            <div className="text-[9px] font-bold text-white tracking-wide uppercase leading-none">Pista Premium</div>
            <div className="text-[7px] text-white/40 mt-0.5">Lote 02 • Entrada Prioritária</div>
          </div>

          <div className="flex items-end justify-between mt-1">
            <span className="text-[12px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-300">R$ 150,00</span>
            <div className="flex gap-[1.5px] items-end h-3">
              {[6, 8, 4, 10, 6, 8, 2, 7, 5].map((h, i) => (
                <div key={i} className="w-[1.5px] bg-white/20" style={{ height: `${h}px` }} />
              ))}
            </div>
          </div>

          {/* Recortes do ticket na lateral */}
          <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-r border-slate-100 rounded-full z-20" />
          <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-l border-slate-100 rounded-full z-20" />
        </div>
      </div>

      {/* Estatísticas de Venda e Progresso */}
      <div className="flex-1 w-full space-y-3 text-left">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Lote 02 (Premium)</div>
            <div className="text-base font-bold text-slate-800 leading-none mt-1">94% Vendido</div>
          </div>
          <span className="text-[10px] font-semibold text-slate-400">470 / 500 un</span>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div className="bg-gradient-to-r from-[#1D68C4] to-[#8F33F5] h-full w-[94%] rounded-full group-hover:w-[100%] transition-all duration-700 ease-out" />
        </div>
        <p className="text-[10px] text-slate-400 font-light leading-relaxed">
          Atualizado em tempo real. Disparo automático de novo lote configurado.
        </p>
      </div>
    </div>
  )
}

function PaletteWidget() {
  const [activeColor, setActiveColor] = useState('#8F33F5')
  
  const colors = [
    { value: '#1D68C4', label: 'Azul' },
    { value: '#8F33F5', label: 'Roxo' },
    { value: '#06B6D4', label: 'Ciano' },
    { value: '#E11D48', label: 'Rosa' },
  ]

  return (
    <div className="w-full max-w-[240px] flex flex-col items-center gap-4">
      {/* Mini Visualizador de Card de Evento */}
      <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3.5 flex flex-col gap-2.5 relative shadow-sm">
        <div className="w-full h-16 rounded-lg bg-slate-200/40 overflow-hidden relative flex items-center justify-center">
          <div className="absolute inset-0 opacity-10 transition-colors duration-500" style={{ backgroundColor: activeColor }} />
          <Paintbrush className="w-5 h-5 transition-colors duration-500" style={{ color: activeColor }} />
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-slate-800">Conexão Eletrônica</div>
          <div className="flex gap-1.5 items-center">
            <span 
              className="text-[8px] font-bold text-white px-2 py-0.5 rounded transition-colors duration-500"
              style={{ backgroundColor: activeColor }}
            >
              Comprar Ingresso
            </span>
            <span className="text-[8px] text-slate-400 font-light">Customizado</span>
          </div>
        </div>
      </div>

      {/* Seletor de Cores */}
      <div className="flex gap-3 justify-center items-center">
        {colors.map((c) => (
          <button
            key={c.value}
            onClick={() => setActiveColor(c.value)}
            className="w-4 h-4 rounded-full border border-white shadow hover:scale-110 active:scale-95 transition-all duration-300 relative flex items-center justify-center"
            style={{ backgroundColor: c.value }}
          >
            {activeColor === c.value && (
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function SocialWidget() {
  const avatares = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80',
  ]

  return (
    <div className="w-full max-w-[240px] flex flex-col items-center gap-5">
      {/* Avatares Empilhados */}
      <div className="flex -space-x-2.5 items-center">
        {avatares.map((src, i) => (
          <img
            key={i}
            src={src}
            alt="Participante"
            className="w-7 h-7 rounded-full border border-white object-cover shadow-sm group-hover:scale-105 transition-all duration-300"
          />
        ))}
        <div className="w-7 h-7 rounded-full border border-white bg-[#8F33F5] text-white flex items-center justify-center text-[8px] font-extrabold shadow-sm">
          +42
        </div>
      </div>

      {/* Pop-up de Comprovação */}
      <div className="w-full bg-[#8F33F5]/[0.01] border border-[#8F33F5]/10 rounded-xl p-2.5 flex items-center gap-2.5 shadow-sm group-hover:bg-[#8F33F5]/5 transition-all duration-500">
        <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-[9px] font-extrabold text-slate-800">Ana Souza comprou!</div>
          <div className="text-[7px] text-slate-400 font-light mt-0.5">Há 4s • Ingresso VIP Pista</div>
        </div>
      </div>
    </div>
  )
}

function ChartWidget() {
  return (
    <div className="w-full max-w-[420px] flex flex-col sm:flex-row items-center gap-6 p-2">
      {/* Painel Financeiro */}
      <div className="space-y-1.5 text-center sm:text-left min-w-[130px] shrink-0">
        <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">FATURAMENTO</div>
        <h3 className="text-xl font-extrabold tracking-tight font-serif text-slate-900 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 transition-all duration-500">
          R$ 84.192,00
        </h3>
        <span className="inline-flex items-center gap-1 text-[8px] font-extrabold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
          +18.4% esta semana
        </span>
      </div>

      {/* Gráfico SVG de Linha Animada */}
      <div className="flex-1 w-full h-20 relative flex items-end">
        <svg viewBox="0 0 200 100" className="w-full h-full overflow-visible">
          {/* Gradiente sob a linha */}
          <defs>
            <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1D68C4" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#8F33F5" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1D68C4" />
              <stop offset="100%" stopColor="#8F33F5" />
            </linearGradient>
          </defs>

          {/* Curva preenchida */}
          <path
            d="M 0 100 Q 30 70, 60 85 T 120 40 T 170 10 T 200 15 L 200 100 Z"
            fill="url(#chart-grad)"
          />

          {/* Linha do Gráfico */}
          <path
            d="M 0 100 Q 30 70, 60 85 T 120 40 T 170 10 T 200 15"
            fill="none"
            stroke="url(#line-grad)"
            strokeWidth="3"
            strokeLinecap="round"
            className="stroke-[#1D68C4] group-hover:stroke-[#8F33F5] transition-colors duration-1000"
          />

          {/* Ponto Pulsante na extremidade */}
          <circle
            cx="200"
            cy="15"
            r="3.5"
            fill="#8F33F5"
            className="animate-pulse"
          />
          <circle
            cx="200"
            cy="15"
            r="8"
            fill="none"
            stroke="#8F33F5"
            strokeWidth="1"
            className="animate-ping origin-center"
            style={{ transformOrigin: '200px 15px' }}
          />
        </svg>
      </div>
    </div>
  )
}

function SecurityWidget() {
  return (
    <div className="w-full max-w-[240px] flex flex-col items-center justify-center h-[110px] relative">
      {/* Ondas e Anéis Concêntricos de Radar */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 rounded-full border border-slate-100 flex items-center justify-center animate-[spin_12s_linear_infinite] group-hover:border-blue-200/50 transition-colors">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full translate-y-[-40px]" />
        </div>
        <div className="w-24 h-24 rounded-full border border-dashed border-slate-100 flex items-center justify-center absolute animate-[spin_20s_linear_infinite_reverse] group-hover:border-purple-200/30 transition-colors">
          <div className="w-1.5 h-1.5 bg-purple-500 rounded-full translate-x-[48px]" />
        </div>
      </div>

      {/* Escudo Central */}
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white to-slate-50 border border-slate-100 flex items-center justify-center text-slate-800 shadow relative z-10 group-hover:scale-105 transition-all duration-300">
        <Shield className="w-5 h-5 text-[#1D68C4] group-hover:text-[#8F33F5] transition-colors duration-500 fill-current opacity-10 absolute" />
        <Shield className="w-5 h-5 text-[#1D68C4] group-hover:text-[#8F33F5] transition-colors duration-500 relative z-10" />
      </div>
      <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-3.5 relative z-10">
        Criptografia Ativa
      </div>
    </div>
  )
}

// widgets interativos para a seção Como Funciona
function WidgetStep1({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="w-12 h-12 relative flex items-center justify-center">
      <svg 
        className={`absolute inset-0 w-full h-full text-[#8f33f5]/25 transition-transform duration-1000 ease-out ${
          isHovered ? 'rotate-180 scale-110' : 'rotate-0 scale-100'
        }`}
        viewBox="0 0 48 48"
        fill="none"
      >
        <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 2" />
      </svg>
      <svg
        className={`w-6 h-6 text-[#8f33f5] relative z-10 transition-transform duration-500 ease-out ${
          isHovered ? 'scale-115 rotate-[15deg] filter drop-shadow-[0_0_6px_rgba(143,51,245,0.4)]' : 'scale-100 rotate-0'
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="13" x2="13" y2="13" />
        <path d="M16 16v-2" strokeWidth="1" />
        <circle cx="16" cy="12" r="1.5" strokeWidth="1" className="opacity-80" />
      </svg>
    </div>
  )
}

function WidgetStep2({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="w-12 h-12 relative flex items-center justify-center">
      <svg 
        className={`absolute inset-0 w-full h-full text-[#1d68c4]/30 transition-transform duration-1000 ease-out ${
          isHovered ? 'rotate-90 scale-110' : 'rotate-0 scale-100'
        }`}
        viewBox="0 0 48 48"
        fill="none"
      >
        <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
        <line x1="6" y1="24" x2="42" y2="24" stroke="currentColor" strokeWidth="0.5" className="opacity-40" />
        <line x1="24" y1="4" x2="24" y2="44" stroke="currentColor" strokeWidth="0.5" className="opacity-40" />
      </svg>
      <svg
        className={`w-6 h-6 text-[#1d68c4] relative z-10 transition-transform duration-500 ease-out ${
          isHovered ? 'scale-115 -translate-y-1 filter drop-shadow-[0_0_6px_rgba(29,104,196,0.4)]' : 'scale-100 translate-y-0'
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <path d="M12 11h3m-3 4h5" strokeWidth="1" strokeDasharray="2 2" className="opacity-70" />
        <circle cx="8" cy="13" r="1" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

function WidgetStep3({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="w-12 h-12 relative flex items-center justify-center">
      <svg 
        className={`absolute inset-0 w-full h-full text-[#10b981]/25 transition-transform duration-1000 ease-out ${
          isHovered ? 'scale-120 rotate-45' : 'scale-100 rotate-0'
        }`}
        viewBox="0 0 48 48"
        fill="none"
      >
        <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1" strokeDasharray="4 2" />
        <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 3" />
      </svg>
      <svg
        className={`w-6 h-6 text-[#10b981] relative z-10 transition-all duration-500 ease-out ${
          isHovered ? 'scale-115 -translate-y-1.5 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'scale-100 translate-y-0'
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 9V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 1 0-4z" />
        <line x1="13" y1="8" x2="13" y2="16" strokeDasharray="2 2" />
        <line x1="8" y1="12" x2="10" y2="12" strokeWidth="1.2" />
        <line x1="16" y1="12" x2="18" y2="12" strokeWidth="1.2" />
      </svg>
      <div className={`absolute top-0 right-1.5 w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping pointer-events-none transition-opacity duration-300 ${
        isHovered ? 'opacity-100' : 'opacity-0'
      }`} />
    </div>
  )
}

function HowItWorksCard({ 
  num, 
  title, 
  desc, 
  stepIndex
}: { 
  num: string
  title: string
  desc: string
  stepIndex: number
}) {
  const [isHovered, setIsHovered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    cardRef.current.style.setProperty('--mouse-x', `${x}px`)
    cardRef.current.style.setProperty('--mouse-y', `${y}px`)
  }

  const renderWidget = () => {
    switch (stepIndex) {
      case 0: return <WidgetStep1 isHovered={isHovered} />
      case 1: return <WidgetStep2 isHovered={isHovered} />
      case 2: return <WidgetStep3 isHovered={isHovered} />
      default: return null
    }
  }

  const getBadgeColors = () => {
    switch (stepIndex) {
      case 0: return 'bg-[#8f33f5]/10 text-[#8f33f5] border-[#8f33f5]/20'
      case 1: return 'bg-[#1d68c4]/10 text-[#1d68c4] border-[#1d68c4]/20'
      case 2: return 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20'
      default: return 'bg-white/10 text-white/80 border-white/20'
    }
  }

  const getPreviewImage = () => {
    switch (stepIndex) {
      case 0: return '/images/preview_create_event.png'
      case 1: return '/images/preview_manage_event.png'
      case 2: return '/images/preview_sell_tickets.png'
      default: return ''
    }
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative overflow-hidden rounded-3xl border border-white/[0.04] bg-white/[0.01] p-8 backdrop-blur-md transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(29,104,196,0.03)] hover:bg-white/[0.02] hover:border-white/[0.07] group flex flex-col justify-between min-h-[450px]"
      style={{
        '--mouse-x': '0px',
        '--mouse-y': '0px',
      } as React.CSSProperties}
    >
      <div 
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"
        style={{
          background: `radial-gradient(150px circle at var(--mouse-x) var(--mouse-y), rgba(255, 255, 255, 0.03), transparent 80%)`
        }}
      />
      <div 
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-15"
        style={{
          background: `radial-gradient(80px circle at var(--mouse-x) var(--mouse-y), rgba(255, 255, 255, 0.12), transparent 80%)`,
          padding: '1.2px',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude'
        }}
      />

      <div className="relative z-20 flex flex-col justify-between h-full space-y-6">
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <span className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest border ${getBadgeColors()}`}>
              Passo {num}
            </span>
            <div className="transition-transform duration-500">
              {renderWidget()}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-white text-lg font-bold font-serif group-hover:text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-200 transition-all duration-300">
              {title}
            </h3>
            <p className="text-white/40 text-[11.5px] font-light leading-relaxed group-hover:text-white/50 transition-colors duration-300">
              {desc}
            </p>
          </div>
        </div>

        {/* Preview de captura da plataforma real */}
        <div className="relative mt-4 overflow-hidden rounded-xl border border-white/[0.05] bg-slate-900/60 aspect-[16/10] group-hover:border-white/[0.12] transition-all duration-500 shadow-lg shadow-black/40">
          <img
            src={getPreviewImage()}
            alt={title}
            className={`w-full h-full object-cover object-top transition-all duration-700 ease-out ${
              isHovered 
                ? 'scale-[1.08] translate-y-0 opacity-100 filter brightness-110' 
                : 'scale-[1.02] translate-y-1 opacity-70 filter brightness-90'
            }`}
          />
          {/* Overlay de gradiente inferior para integrar o preview ao fundo escuro */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  )
}

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

      // GSAP Animacao de Contagem Numerica Progressiva
      const statsElements = document.querySelectorAll('.stat-count')
      statsElements.forEach((el) => {
        const target = parseFloat(el.getAttribute('data-target') || '0')
        const suffix = el.getAttribute('data-suffix') || ''
        const obj = { val: 0 }
        
        gsap.to(obj, {
          val: target,
          duration: 1.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: statsRef.current,
            start: 'top 85%',
          },
          onUpdate: () => {
            el.textContent = Math.floor(obj.val).toLocaleString('pt-BR') + suffix
          }
        })
      })

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

  const stats = [
    { target: 10, suffix: 'K+', label: 'Eventos', trend: 'Criados no último ano' },
    { target: 500, suffix: 'K+', label: 'Ingressos', trend: 'Vendas acumuladas' },
    { target: 98, suffix: '%', label: 'Satisfação', trend: 'NPS de excelência' },
    { target: 50, suffix: '+', label: 'Países', trend: 'Disponibilidade global' },
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

      {/* Stats - minimal dynamic style */}
      <section ref={statsRef} className="py-24 relative overflow-hidden bg-slate-950 border-y border-slate-900">
        {/* Grid pattern sutil */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{ 
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px' 
          }}
        />
        {/* Orbs de luz degradê */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-80 h-80 bg-[#1D68C4]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-[#8F33F5]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
            {stats.map((stat) => (
              <div 
                key={stat.label} 
                className="stat-num bg-white/[0.01] border border-white/[0.05] backdrop-blur-sm rounded-2xl p-6 hover:border-white/10 hover:bg-white/[0.03] transition-all duration-500 flex flex-col justify-between h-36 group text-left"
              >
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-[0.15em] font-extrabold block">
                    {stat.label}
                  </span>
                  {/* Número que conta via GSAP */}
                  <div 
                    className="font-extrabold text-4xl lg:text-5xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 group-hover:from-white group-hover:to-blue-200 transition-colors mt-2 font-serif"
                  >
                    <span 
                      className="stat-count" 
                      data-target={stat.target} 
                      data-suffix={stat.suffix}
                    >
                      0
                    </span>
                  </div>
                </div>
                
                {/* Indicador de Tendência / Crescimento */}
                <div className="flex items-center gap-1.5 border-t border-white/[0.04] pt-3 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[9px] text-slate-400 font-light tracking-wide block">
                    {stat.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features - Bento Grid */}
      <section ref={featuresRef} className="py-28 bg-white border-t border-slate-100 relative overflow-hidden">
        {/* Orbs de fundo leves */}
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-[#1D68C4]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-[#8F33F5]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="text-center mb-20 anim-fade-up">
            <span className="text-[10px] font-extrabold tracking-[0.25em] uppercase text-[#1D68C4] bg-[#1D68C4]/5 px-3 py-1 rounded-md animate-pulse">
              Recursos Avançados
            </span>
            <h2 className="text-slate-900 font-serif text-4xl sm:text-5xl font-extrabold tracking-tight mt-5 leading-tight">
              Tudo que você <em className="text-gradient not-italic">precisa</em>
            </h2>
            <p className="text-slate-400 text-sm mt-4 max-w-md mx-auto leading-relaxed font-light">
              Ferramentas de altíssima fidelidade e UX projetadas para elevar o nível da produção do seu evento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* 1. Crie em Minutos - col-span-12 md:col-span-5 */}
            <div className="feature-item md:col-span-5">
              <FeatureCard
                title="Crie em Minutos"
                desc="Configure lotes, prazos e regras do seu evento em uma interface linear com progresso automatizado e sem atritos."
                accent="#1D68C4"
              >
                <WizardWidget />
              </FeatureCard>
            </div>

            {/* 2. Gestão de Ingressos - col-span-12 md:col-span-7 */}
            <div className="feature-item md:col-span-7">
              <FeatureCard
                title="Gestão de Ingressos"
                desc="Controle total sobre vendas em tempo real. Troca de lotes inteligente, ingressos holográficos e regras financeiras robustas."
                accent="#8F33F5"
              >
                <TicketWidget />
              </FeatureCard>
            </div>

            {/* 3. Brand Studio - col-span-12 md:col-span-4 */}
            <div className="feature-item md:col-span-4">
              <FeatureCard
                title="Brand Studio"
                desc="Aplique seu tom de marca com paletas personalizadas, links de domínio próprios e layouts exclusivos para os ingressos."
                accent="#06B6D4"
              >
                <PaletteWidget />
              </FeatureCard>
            </div>

            {/* 4. Comprovação Social - col-span-12 md:col-span-4 */}
            <div className="feature-item md:col-span-4">
              <FeatureCard
                title="Comprovação Social"
                desc="Desperte desejo instantâneo nos compradores exibindo atualizações de vendas ao vivo e quem do círculo social já confirmou."
                accent="#f59e0b"
              >
                <SocialWidget />
              </FeatureCard>
            </div>

            {/* 5. Segurança Total - col-span-12 md:col-span-4 */}
            <div className="feature-item md:col-span-4">
              <FeatureCard
                title="Segurança Total"
                desc="Autenticação antifraude em cada transação, proteção total de dados de acordo com a LGPD e check-in criptografado."
                accent="#ef4444"
              >
                <SecurityWidget />
              </FeatureCard>
            </div>

            {/* 6. Analytics Real-Time - col-span-12 md:col-span-8 */}
            <div className="feature-item md:col-span-8">
              <FeatureCard
                title="Analytics Real-Time"
                desc="Monitore conversão, faturamento e cliques de campanhas em um gráfico financeiro preciso com atualização contínua."
                accent="#6366f1"
              >
                <ChartWidget />
              </FeatureCard>
            </div>

            {/* 7. Card Extra: Sua Marca Autônoma - col-span-12 md:col-span-4 */}
            <div className="feature-item md:col-span-4">
              <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-[#0c2340] to-slate-950 p-8 flex flex-col justify-between min-h-[350px] group text-left">
                <div className="absolute inset-0 opacity-[0.03]"
                  style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '24px 24px' }}
                />
                
                <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white mb-2">
                    <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                  </div>
                  <h5 className="text-white text-base font-bold font-serif">Infraestrutura Exclusiva</h5>
                  <p className="text-[11px] text-white/40 max-w-[180px] font-light leading-relaxed">
                    Sua plataforma própria com taxas customizadas de produtor sênior.
                  </p>
                </div>

                <div className="relative z-10 mt-auto">
                  <Link
                    to="/auth/register"
                    className="w-full py-3 bg-white text-slate-950 hover:bg-slate-100 active:scale-[0.98] text-xs font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-1.5 uppercase tracking-wider"
                  >
                    <span>Criar Plataforma</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works - dark section */}
      <section 
        ref={howItWorksRef}
        className="py-28 relative overflow-hidden bg-slate-950"
      >
        <div className="absolute inset-0 opacity-[0.03] z-0"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '40px 40px' }}
        />
        
        {/* Glows de fundo sutil */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#8f33f5]/[0.06] rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#1d68c4]/[0.06] rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 z-10">
          <div className="text-center mb-20">
            <h2 className="text-white">
              Como <em className="text-gradient not-italic">Funciona</em>
            </h2>
            <p className="text-white/30 text-sm mt-4 max-w-sm mx-auto font-light">
              Três passos simples para transformar sua visão em realidade.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            <HowItWorksCard 
              num="01" 
              title="Crie" 
              desc="Escolha o tipo de evento, defina data, local e lotes de ingresso. Nossa calculadora mostra seus números em tempo real." 
              stepIndex={0} 
            />
            <HowItWorksCard 
              num="02" 
              title="Gerencie" 
              desc="Controle orçamento, fornecedores, equipe e cronograma em uma única pasta. Tudo centralizado." 
              stepIndex={1} 
            />
            <HowItWorksCard 
              num="03" 
              title="Venda" 
              desc="Publique, venda ingressos e acompanhe tudo em tempo real. Check-in na porta com QR code." 
              stepIndex={2} 
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <PricingSection />

      {/* FAQ */}
      <section className="py-28 bg-slate-50 relative overflow-hidden">
        {/* Glows de fundo sutil */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#8f33f5]/[0.02] rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#1d68c4]/[0.02] rounded-full blur-3xl" />
        </div>
        <div className="max-w-5xl mx-auto px-6 relative z-10">
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
