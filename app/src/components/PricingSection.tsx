import { useState, useRef } from 'react'
import { Crown, Check, X, Sparkles, Shield, Zap, Star, Gift, TrendingUp, Calculator, ChevronDown, ChevronUp } from 'lucide-react'

// ================= COMPONENTE TRUST CARD COM SPOTLIGHT DE MOUSE =================

// widgets interativos para os Trust Badges
function WidgetShield({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="w-16 h-16 relative flex items-center justify-center">
      <div className={`absolute inset-0 rounded-full border border-[#1d68c4]/15 transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'}`} />
      <div className="absolute inset-2 rounded-full border border-dashed border-[#1d68c4]/10 animate-spin-slow" />
      
      <div className="relative z-10 w-8 h-8 flex flex-col items-center justify-center">
        <div className={`w-5 h-5 rounded-t-full border-2 border-[#1d68c4] border-b-0 -mb-[2px] transition-transform duration-500 ${
          isHovered ? '-translate-y-[3px]' : 'translate-y-0'
        }`} />
        <div className="w-7 h-5 rounded-md bg-gradient-to-br from-[#1d68c4] to-[#4a60e3] flex items-center justify-center shadow-lg relative overflow-hidden">
          <div className={`w-1.5 h-1.5 rounded-full bg-white transition-all duration-300 ${isHovered ? 'bg-cyan-300 scale-125' : 'bg-white'}`} />
          <div className={`absolute left-0 right-0 h-[1.5px] bg-cyan-300 transition-all duration-700 ease-in-out ${
            isHovered ? 'top-full opacity-100' : 'top-0 opacity-0'
          }`} />
        </div>
      </div>
    </div>
  )
}

function WidgetFidelity({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="w-16 h-16 relative flex flex-col items-center justify-center gap-1.5">
      <div className="w-12 h-3.5 rounded-full bg-slate-100 border border-slate-200/60 p-[2px] relative overflow-hidden flex items-center justify-between">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300/80 z-10" />
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300/80 z-10" />
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300/80 z-10" />
        <div 
          className="absolute h-2.5 w-4 rounded-full bg-gradient-to-r from-[#8f33f5] to-[#4a60e3] shadow-md transition-all duration-750 ease-out"
          style={{
            transform: isHovered ? 'translateX(24px)' : 'translateX(0px)',
          }}
        />
      </div>
      <span className={`text-[7px] font-extrabold tracking-widest text-[#8f33f5] uppercase transition-all duration-500 ${
        isHovered ? 'opacity-100 scale-105' : 'opacity-60 scale-100'
      }`}>
        Sem Vínculo
      </span>
    </div>
  )
}

function WidgetNoFees({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="w-16 h-16 relative flex items-center justify-center">
      <div className={`absolute inset-2 rounded-full bg-[#06b6d4]/5 transition-all duration-500 ${
        isHovered ? 'scale-110 bg-[#06b6d4]/10' : 'scale-100'
      }`} />
      <div className="flex flex-col items-center gap-1 relative z-10">
        <div className="relative text-[9px] font-bold text-slate-400 font-sans tracking-tight">
          R$ 299
          <div className={`absolute top-1/2 left-0 right-0 h-[1.5px] bg-red-500 origin-left transition-transform duration-500 ${
            isHovered ? 'scale-x-100' : 'scale-x-0'
          }`} />
        </div>
        <div className={`px-2.5 py-0.5 rounded-full bg-gradient-to-br from-[#06b6d4] to-[#1d68c4] text-white font-extrabold text-[9px] tracking-wide shadow-md transition-all duration-500 ${
          isHovered ? 'scale-105 shadow-cyan-500/20' : 'scale-90'
        }`}>
          GRÁTIS
        </div>
      </div>
    </div>
  )
}

function WidgetFastActivation({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="w-16 h-16 relative flex flex-col items-center justify-center">
      <svg className="w-11 h-11 transform -rotate-90 relative z-10">
        <circle 
          cx="22" 
          cy="22" 
          r="18" 
          stroke="rgba(239, 68, 68, 0.08)" 
          strokeWidth="2.5" 
          fill="transparent" 
        />
        <circle 
          cx="22" 
          cy="22" 
          r="18" 
          stroke="url(#activationGrad)" 
          strokeWidth="2.5" 
          fill="transparent" 
          strokeDasharray="113" 
          strokeDashoffset={isHovered ? "0" : "113"} 
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="activationGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center z-20">
        <span className={`text-[10px] font-extrabold transition-all duration-500 ${
          isHovered ? 'text-green-500 scale-110' : 'text-[#ef4444]'
        }`}>
          5min
        </span>
      </div>
      <div className={`absolute -bottom-1 bg-green-500/10 border border-green-500/25 px-1.5 py-0.5 rounded-full flex items-center gap-1 transition-all duration-500 ${
        isHovered ? 'opacity-100 scale-90 translate-y-0' : 'opacity-0 scale-75 translate-y-1'
      }`}>
        <span className="w-1 h-1 rounded-full bg-green-500 animate-ping" />
        <span className="text-[6px] font-black text-green-600 uppercase tracking-widest">Online</span>
      </div>
    </div>
  )
}

function TrustCard({ iconType, title, desc, accent = '#1d68c4' }: { iconType: 'shield' | 'fidelity' | 'nofees' | 'activation', title: string, desc: string, accent?: string }) {
  const [isHovered, setIsHovered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    cardRef.current.style.setProperty('--mouse-x', `${x}px`)
    cardRef.current.style.setProperty('--mouse-y', `${y}px`)

    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * -8
    const rotateY = ((x - centerX) / centerX) * 8
    cardRef.current.style.setProperty('--rotate-x', `${rotateX}deg`)
    cardRef.current.style.setProperty('--rotate-y', `${rotateY}deg`)
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (!cardRef.current) return
    cardRef.current.style.setProperty('--rotate-x', `0deg`)
    cardRef.current.style.setProperty('--rotate-y', `0deg`)
  }

  const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
    const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b)
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex)
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` 
      : '29, 104, 196'
  }

  const rgbAccent = hexToRgb(accent)

  const renderWidget = () => {
    switch (iconType) {
      case 'shield':
        return <WidgetShield isHovered={isHovered} />
      case 'fidelity':
        return <WidgetFidelity isHovered={isHovered} />
      case 'nofees':
        return <WidgetNoFees isHovered={isHovered} />
      case 'activation':
        return <WidgetFastActivation isHovered={isHovered} />
      default:
        return null
    }
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden rounded-[24px] border border-slate-200/50 bg-white/70 backdrop-blur-md p-6 text-center hover:border-transparent transition-all duration-300 ease-out group"
      style={{
        '--mouse-x': '0px',
        '--mouse-y': '0px',
        '--rotate-x': '0deg',
        '--rotate-y': '0deg',
        transform: 'perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y))',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.03)',
      } as React.CSSProperties}
    >
      <div 
        className="pointer-events-none absolute -inset-px rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"
        style={{
          background: `radial-gradient(180px circle at var(--mouse-x) var(--mouse-y), rgba(${rgbAccent}, 0.07), transparent 80%)`
        }}
      />
      <div 
        className="pointer-events-none absolute -inset-px rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"
        style={{
          background: `radial-gradient(100px circle at var(--mouse-x) var(--mouse-y), rgba(${rgbAccent}, 0.3), transparent 80%)`,
          padding: '1.5px',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude'
        }}
      />
      <div 
        className="absolute inset-0 -z-10 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          boxShadow: `0 20px 40px -15px rgba(${rgbAccent}, 0.25)`
        }}
      />

      <div className="relative z-20 flex flex-col items-center">
        <div className="mb-5 transition-transform duration-500 ease-out group-hover:scale-105">
          {renderWidget()}
        </div>
        
        <h4 className="text-sm font-bold text-slate-800 tracking-tight font-serif mb-2 group-hover:text-slate-950 transition-colors duration-300">
          {title}
        </h4>
        <p className="text-[12px] text-slate-500/90 font-light leading-relaxed max-w-[200px]">
          {desc}
        </p>
      </div>
    </div>
  )
}// widgets interativos para os planos de preços
function WidgetFree({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="w-12 h-12 relative flex items-center justify-center">
      {/* Círculo pontilhado de radar/órbita em volta */}
      <svg 
        className={`absolute inset-0 w-full h-full text-[#10b981]/25 transition-transform duration-1000 ease-out ${
          isHovered ? 'rotate-180 scale-110' : 'rotate-0 scale-100'
        }`}
        viewBox="0 0 48 48"
        fill="none"
      >
        <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 3" className="opacity-60" />
      </svg>
      
      {/* Símbolo central: Cubo geométrico em perspectiva (estilo blueprint/outline) */}
      <svg
        className={`w-6 h-6 text-[#10b981] relative z-10 transition-transform duration-500 ${
          isHovered ? 'scale-110' : 'scale-100'
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Tampa do cubo (move-se ligeiramente para cima no hover) */}
        <g className={`transition-transform duration-500 ease-out ${isHovered ? '-translate-y-1.5' : 'translate-y-0'}`}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M12 2.5v4" strokeWidth="1" className="opacity-80" />
        </g>
        
        {/* Base do cubo */}
        <path d="M2 7v10l10 5 10-5V7" />
        <path d="M12 12v10" />
        
        {/* Detalhes internos estruturais pontilhados */}
        <path d="M12 12L2 7M12 12l10-5" strokeDasharray="2 2" className="opacity-40" />
      </svg>

      {/* Partículas flutuantes ascendentes neon */}
      <div className={`absolute top-0 left-3 w-1.5 h-1.5 rounded-full bg-[#10b981]/80 transition-all duration-700 pointer-events-none ${
        isHovered ? 'opacity-100 -translate-y-3 -translate-x-1 scale-125' : 'opacity-0 translate-y-0 scale-50'
      }`} />
      <div className={`absolute top-0 right-3 w-1 h-1 rounded-full bg-[#10b981] transition-all duration-700 pointer-events-none ${
        isHovered ? 'opacity-100 -translate-y-4 translate-x-1 scale-110' : 'opacity-0 translate-y-0 scale-50'
      }`} />
    </div>
  )
}

function WidgetStarter({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="w-12 h-12 relative flex items-center justify-center">
      {/* Órbitas Elípticas Pontilhadas */}
      <svg 
        className={`absolute inset-0 w-full h-full text-[#8f33f5]/30 transition-transform duration-1000 ease-out ${
          isHovered ? 'rotate-[45deg] scale-115' : 'rotate-0 scale-100'
        }`}
        viewBox="0 0 48 48"
        fill="none"
      >
        {/* Órbita inclinada 1 */}
        <ellipse cx="24" cy="24" rx="20" ry="8" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" transform="rotate(-30 24 24)" />
        {/* Órbita inclinada 2 */}
        <ellipse cx="24" cy="24" rx="16" ry="6" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 2" transform="rotate(30 24 24)" className="opacity-50" />
      </svg>
      
      {/* Partícula na órbita */}
      <div className={`absolute w-1.5 h-1.5 rounded-full bg-[#8f33f5] transition-all duration-700 ease-out pointer-events-none ${
        isHovered ? 'translate-x-4 -translate-y-3 scale-125 shadow-[0_0_8px_#8f33f5]' : 'translate-x-0 translate-y-0 scale-100'
      }`} />

      {/* Raio em Fine-Line */}
      <svg 
        className={`w-6 h-6 text-[#8f33f5] relative z-10 transition-transform duration-500 ease-out ${
          isHovered ? 'scale-115 -skew-x-6 filter drop-shadow-[0_0_6px_rgba(143,51,245,0.4)]' : 'scale-100'
        }`}
        viewBox="0 0 24 24" 
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        <path d="M12 6l-6 7h6l-1 5" strokeWidth="1" className="opacity-55" strokeDasharray="1 1" />
      </svg>
    </div>
  )
}

function WidgetPlus({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="w-12 h-12 relative flex items-center justify-center">
      {/* Retículo Cartesiano de Fundo */}
      <svg 
        className={`absolute inset-0 w-full h-full text-[#1d68c4]/20 transition-all duration-700 ${
          isHovered ? 'scale-105 opacity-100' : 'scale-95 opacity-70'
        }`}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
      >
        {/* Eixo X e Y */}
        <line x1="6" y1="24" x2="42" y2="24" strokeDasharray="2 2" />
        <line x1="24" y1="6" x2="24" y2="42" strokeDasharray="2 2" />
        {/* Ticks nas pontas */}
        <line x1="6" y1="22" x2="6" y2="26" />
        <line x1="42" y1="22" x2="42" y2="26" />
        <line x1="22" y1="6" x2="26" y2="6" />
        <line x1="22" y1="42" x2="26" y2="42" />
        {/* Círculo concentrico */}
        <circle cx="24" cy="24" r="12" strokeWidth="0.5" strokeDasharray="1 3" />
      </svg>

      {/* Estrela em Linha Fina Dupla */}
      <svg 
        className={`w-6 h-6 text-[#1d68c4] relative z-10 transition-all duration-700 ease-out ${
          isHovered ? 'rotate-[180deg] scale-120 filter drop-shadow-[0_0_8px_rgba(29,104,196,0.5)]' : 'rotate-0 scale-100'
        }`}
        viewBox="0 0 24 24" 
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Estrela externa */}
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        {/* Estrela interna de linha fina */}
        <path 
          d="M12 6.5l1.54 3.13 3.46.5-2.5 2.43.59 3.44-3.09-1.62-3.09 1.62.59-3.44-2.5-2.43 3.46-.5L12 6.5z" 
          strokeWidth="0.75" 
          strokeDasharray="2 1"
          className="opacity-70"
        />
      </svg>
    </div>
  )
}

function WidgetPro({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="w-12 h-12 relative flex items-center justify-center">
      {/* Fundo Giroscópico Pontilhado */}
      <svg 
        className={`absolute inset-0 w-full h-full text-[#4a60e3]/25 transition-transform duration-1000 ease-out ${
          isHovered ? 'rotate-90 scale-110' : 'rotate-0 scale-100'
        }`}
        viewBox="0 0 48 48"
        fill="none"
      >
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="0.75" strokeDasharray="4 4" />
        <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="0.5" className="opacity-30" />
        <line x1="24" y1="4" x2="24" y2="44" stroke="currentColor" strokeWidth="0.5" className="opacity-30" />
      </svg>

      {/* Coroa Geométrica */}
      <svg 
        className={`w-6 h-6 text-[#4a60e3] relative z-10 transition-all duration-500 ease-out ${
          isHovered ? '-translate-y-1.5 scale-110 filter drop-shadow-[0_4px_8px_rgba(74,96,227,0.4)]' : 'translate-y-0 scale-100'
        }`}
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        {/* Linhas da coroa estilizada de forma poligonal moderna */}
        <path d="M2 4l3 12h14l3-12-5 6-4-8-4 8-5-6z" />
        <line x1="4" y1="19" x2="20" y2="19" strokeWidth="1" className="opacity-80" />
        
        {/* Os 3 círculos no topo da coroa */}
        <circle 
          cx="2" 
          cy="4" 
          r="1" 
          className={`transition-all duration-500 fill-[#4a60e3] ${isHovered ? 'scale-150 fill-yellow-400' : 'scale-100'}`} 
          style={{ transformOrigin: '2px 4px' }}
        />
        <circle 
          cx="12" 
          cy="2" 
          r="1" 
          className={`transition-all duration-500 fill-[#4a60e3] ${isHovered ? 'scale-150 fill-yellow-400' : 'scale-100'}`}
          style={{ transformOrigin: '12px 2px' }}
        />
        <circle 
          cx="22" 
          cy="4" 
          r="1" 
          className={`transition-all duration-500 fill-[#4a60e3] ${isHovered ? 'scale-150 fill-yellow-400' : 'scale-100'}`}
          style={{ transformOrigin: '22px 4px' }}
        />
      </svg>
    </div>
  )
}

function WidgetEnterprise({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="w-12 h-12 relative flex items-center justify-center">
      {/* Radar Hexagonal de Fundo */}
      <svg 
        className={`absolute inset-0 w-full h-full text-[#0c2340]/25 transition-transform duration-1000 ease-out ${
          isHovered ? 'rotate-[60deg] scale-110' : 'rotate-0 scale-100'
        }`}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
      >
        <polygon points="24,4 41.3,14 41.3,34 24,44 6.7,34 6.7,14" strokeDasharray="3 3" />
        <polygon points="24,10 36.1,17 36.1,31 24,38 11.9,31 11.9,17" strokeDasharray="1 2" className="opacity-60" />
        
        <line x1="24" y1="4" x2="24" y2="44" strokeWidth="0.5" className="opacity-40" />
        <line x1="6.7" y1="14" x2="41.3" y2="34" strokeWidth="0.5" className="opacity-40" />
        <line x1="6.7" y1="34" x2="41.3" y2="14" strokeWidth="0.5" className="opacity-40" />
      </svg>

      {/* Escudo de Linha Dupla Fina */}
      <svg 
        className={`w-6 h-6 text-[#0c2340] relative z-10 transition-all duration-500 ease-out ${
          isHovered ? 'scale-115 filter drop-shadow-[0_4px_8px_rgba(12,35,64,0.3)]' : 'scale-100'
        }`}
        viewBox="0 0 24 24" 
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M12 19.5s6-3 6-7.5V7l-6-2.25L6 7v5c0 4.5 6 7.5 6 7.5z" strokeWidth="0.75" strokeDasharray="2 2" className="opacity-70" />
      </svg>
    </div>
  )
}


interface PlanCardProps {
  plan: Plan & { monthlyCost: number; totalCost: number }
  isBest: boolean
  period: 'mensal' | 'trimestral' | 'semestral' | 'anual'
}

function PlanCard({ plan, isBest, period }: PlanCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    cardRef.current.style.setProperty('--mouse-x', `${x}px`)
    cardRef.current.style.setProperty('--mouse-y', `${y}px`)

    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * -6
    const rotateY = ((x - centerX) / centerX) * 6
    cardRef.current.style.setProperty('--rotate-x', `${rotateX}deg`)
    cardRef.current.style.setProperty('--rotate-y', `${rotateY}deg`)
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (!cardRef.current) return
    cardRef.current.style.setProperty('--rotate-x', `0deg`)
    cardRef.current.style.setProperty('--rotate-y', `0deg`)
  }

  const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
    const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b)
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex)
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` 
      : '29, 104, 196'
  }

  const rgbAccent = hexToRgb(plan.color)

  const renderPlanWidget = () => {
    switch (plan.id) {
      case 'free':
        return <WidgetFree isHovered={isHovered} />
      case 'starter':
        return <WidgetStarter isHovered={isHovered} />
      case 'plus':
        return <WidgetPlus isHovered={isHovered} />
      case 'pro':
        return <WidgetPro isHovered={isHovered} />
      case 'enterprise':
        return <WidgetEnterprise isHovered={isHovered} />
      default:
        return null
    }
  }

  const baseCardStyles = plan.popular
    ? "h-full bg-white rounded-[22px] p-6 flex flex-col justify-between relative z-20"
    : `h-full p-6 bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-3xl flex flex-col justify-between transition-all duration-300 relative z-20 ${
        plan.free ? 'border-green-200/50 hover:border-green-300/80' : 'hover:border-slate-300/80'
      }`

  const cardContent = (
    <div className={baseCardStyles}>
      {plan.free && !plan.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-bold text-white uppercase tracking-wider bg-green-500 z-30">
          Gratuito
        </span>
      )}
      {isBest && (
        <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-wider bg-green-500 shadow-md z-30">
          Ideal para Você
        </span>
      )}

      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="transition-transform duration-500 ease-out group-hover:scale-105">
            {renderPlanWidget()}
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-900 font-serif">{plan.name}</h3>
        <p className="text-xs text-slate-400 mt-1 min-h-[32px] leading-relaxed">{plan.tagline}</p>

        <div className="flex items-baseline gap-1 mt-5 mb-5">
          {plan.free ? (
            <span className="text-3xl font-extrabold text-green-600">Grátis</span>
          ) : (
            <>
              <span className="text-3xl font-extrabold text-slate-900">R$ {plan.monthlyCost}</span>
              <span className="text-xs text-slate-400">/mês</span>
            </>
          )}
        </div>

        <div className="mb-6 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Taxa de venda</span>
            <span className="text-xs font-bold" style={{ color: plan.color }}>{plan.fee}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Valor mínimo</span>
            {plan.feeMin > 0 ? (
              <span className="text-[10px] text-slate-600 font-medium">R$ {plan.feeMin}</span>
            ) : (
              <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider bg-green-50 px-1.5 py-0.5 rounded">Isento</span>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {plan.highlights.map((feat, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[11px] text-slate-500 leading-snug">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>{feat}</span>
            </div>
          ))}
        </div>
      </div>

      <button 
        className={`w-full py-3 text-xs font-bold rounded-full transition-all duration-300 focus:outline-none ${
          plan.free 
            ? 'bg-green-500 hover:bg-green-600 text-white hover:shadow-lg' 
            : plan.popular
              ? 'text-white hover:shadow-lg'
              : 'border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
        }`}
        style={plan.popular ? { background: 'linear-gradient(135deg, #1d68c4, #8f33f5)' } : undefined}
      >
        {plan.free ? 'Criar Evento Grátis' : 'Escolher Plano'}
      </button>
    </div>
  )

  if (plan.popular) {
    return (
      <div 
        id={`plan-card-${plan.id}`}
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="flex-shrink-0 w-[290px] sm:w-[320px] lg:w-auto snap-center relative p-[2.5px] rounded-3xl bg-gradient-to-br from-[#1d68c4] via-[#4a60e3] to-[#8f33f5] shadow-[0_15px_40px_rgba(29,104,196,0.15)] hover:shadow-[0_20px_45px_rgba(29,104,196,0.22)] transition-all duration-300 group"
        style={{
          '--mouse-x': '0px',
          '--mouse-y': '0px',
          '--rotate-x': '0deg',
          '--rotate-y': '0deg',
          transform: 'perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y))',
        } as React.CSSProperties}
      >
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[9px] font-bold text-white uppercase tracking-wider bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] z-30 shadow-sm">
          Mais Popular
        </span>

        <div 
          className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"
          style={{
            background: `radial-gradient(180px circle at var(--mouse-x) var(--mouse-y), rgba(${rgbAccent}, 0.05), transparent 80%)`
          }}
        />

        {cardContent}
      </div>
    )
  }

  return (
    <div
      id={`plan-card-${plan.id}`}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="flex-shrink-0 w-[290px] sm:w-[320px] lg:w-auto snap-center relative p-[1px] rounded-3xl transition-all duration-300 hover:shadow-xl group"
      style={{
        '--mouse-x': '0px',
        '--mouse-y': '0px',
        '--rotate-x': '0deg',
        '--rotate-y': '0deg',
        transform: 'perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y))',
      } as React.CSSProperties}
    >
      <div 
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"
        style={{
          background: `radial-gradient(180px circle at var(--mouse-x) var(--mouse-y), rgba(${rgbAccent}, 0.07), transparent 80%)`
        }}
      />
      <div 
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-15"
        style={{
          background: `radial-gradient(100px circle at var(--mouse-x) var(--mouse-y), rgba(${rgbAccent}, 0.25), transparent 80%)`,
          padding: '1.5px',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude'
        }}
      />
      <div 
        className="absolute inset-0 -z-10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          boxShadow: `0 20px 40px -15px rgba(${rgbAccent}, 0.2)`
        }}
      />

      {cardContent}
    </div>
  )
}

interface Plan {
  id: string
  name: string
  tagline: string
  monthlyPrice: number
  color: string
  popular?: boolean
  free?: boolean
  fee: number
  feeMin: number
  highlights: string[]
}

const pricingPlans: Plan[] = [
  {
    id: 'free',
    name: 'Gratuito',
    tagline: 'Perfeito para começar sem custos fixos',
    monthlyPrice: 0,
    color: '#10b981', // Verde
    free: true,
    fee: 12,
    feeMin: 3.99,
    highlights: [
      '1 evento ativo por vez',
      'Até 50 ingressos por mês',
      'Venda de ingressos online',
      'Check-in básico via painel web',
      'Suporte por e-mail (até 48h)'
    ]
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Ideal para produtores iniciantes',
    monthlyPrice: 49,
    color: '#8f33f5', // Roxo Evokaa
    fee: 8,
    feeMin: 2.99,
    highlights: [
      'Até 5 eventos ativos simultâneos',
      'Até 200 ingressos por mês',
      'Check-in completo via aplicativo',
      'Formulários personalizados de inscrição',
      'Lista de interesse e espera ativada',
      'Suporte prioritário por e-mail (até 24h)'
    ]
  },
  {
    id: 'plus',
    name: 'Plus',
    tagline: 'Melhor alcance e vendas ampliadas',
    monthlyPrice: 99,
    color: '#1d68c4', // Azul Royal Evokaa
    popular: true,
    fee: 6,
    feeMin: 1.99,
    highlights: [
      'Até 15 eventos ativos simultâneos',
      'Até 1.000 ingressos por mês',
      'Sistema de Afiliados e Cupons exclusivos',
      'CRM de vendas e CRM Pipeline',
      'Certificados automáticos pós-evento',
      'Parcelamento sem juros para clientes'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Liberdade e recursos para escalar',
    monthlyPrice: 199,
    color: '#4a60e3', // Azul Violeta
    fee: 4,
    feeMin: 0,
    highlights: [
      'Eventos ativos ilimitados',
      'Ingressos emitidos ilimitados',
      'Mesa Coletiva (Matchmaking por perfil)',
      'Lugar Marcado interativo 3D',
      'Antecipação de receitas de vendas',
      'Acesso à API de integrações e Webhooks'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Solução sob medida para grandes marcas',
    monthlyPrice: 499,
    color: '#0c2340', // Navy profundo
    fee: 2.5,
    feeMin: 0,
    highlights: [
      'Taxas de vendas negociáveis e personalizadas',
      'White-label de marca completo (sem logo Evokaa)',
      'Múltiplas contas de produtores vinculadas',
      'Contrato de SLA garantido por suporte',
      'Onboarding VIP e Consultoria de marketing',
      'Suporte 24/7 via WhatsApp dedicado'
    ]
  }
]

const comparisonCategories = [
  {
    name: 'Vendas e Ingressos',
    features: [
      { name: 'Venda de ingressos online', values: { free: 'Disponível', starter: 'Disponível', plus: 'Disponível', pro: 'Disponível', enterprise: 'Disponível' } },
      { name: 'Lotes e tipos de ingressos', values: { free: '1 lote por evento', starter: 'Ilimitados', plus: 'Ilimitados', pro: 'Ilimitados', enterprise: 'Ilimitados' } },
      { name: 'Formulários de inscrição personalizados', values: { free: false, starter: true, plus: true, pro: true, enterprise: true } },
      { name: 'Mesa Coletiva (Matchmaking por perfil)', values: { free: false, starter: false, plus: false, pro: true, enterprise: true } },
      { name: 'Lugar marcado interativo', values: { free: false, starter: false, plus: false, pro: true, enterprise: true } },
      { name: 'Parcelamento sem juros para o cliente', values: { free: false, starter: false, plus: true, pro: true, enterprise: true } }
    ]
  },
  {
    name: 'Gestão e Operação',
    features: [
      { name: 'Eventos simultâneos ativos', values: { free: '1 evento', starter: '5 eventos', plus: '15 eventos', pro: 'Ilimitados', enterprise: 'Ilimitados' } },
      { name: 'Check-in de participantes', values: { free: 'Painel Web', starter: 'App Completo', plus: 'App Completo', pro: 'App Scanner', enterprise: 'App Scanner' } },
      { name: 'Relatórios pós-evento', values: { free: 'Básico', starter: 'Completo', plus: 'Avançado', pro: 'Avançado', enterprise: 'Customizado' } },
      { name: 'Certificados automáticos pós-evento', values: { free: false, starter: false, plus: true, pro: true, enterprise: true } },
      { name: 'Múltiplos usuários administradores', values: { free: false, starter: false, plus: false, pro: false, enterprise: true } }
    ]
  },
  {
    name: 'Marketing e Divulgação',
    features: [
      { name: 'Lista de interesse e espera', values: { free: false, starter: true, plus: true, pro: true, enterprise: true } },
      { name: 'Afiliados + Cupons de desconto', values: { free: false, starter: false, plus: true, pro: true, enterprise: true } },
      { name: 'Evokaa Store (Upgrades e temas)', values: { free: false, starter: true, plus: true, pro: true, enterprise: true } },
      { name: 'Marketing integrado (E-mail/WhatsApp)', values: { free: false, starter: false, plus: true, pro: true, enterprise: true } },
      { name: 'White-label de marca completo', values: { free: false, starter: false, plus: false, pro: false, enterprise: true } }
    ]
  },
  {
    name: 'Integrações e Suporte',
    features: [
      { name: 'Acesso à API e Webhooks', values: { free: false, starter: false, plus: false, pro: true, enterprise: true } },
      { name: 'Canal de atendimento principal', values: { free: 'E-mail', starter: 'Suporte VIP (24h)', plus: 'Suporte VIP (24h)', pro: 'Suporte VIP 24/7', enterprise: 'WhatsApp & Telefone 24/7' } },
      { name: 'Gerente de Contas dedicado', values: { free: false, starter: false, plus: false, pro: false, enterprise: true } },
      { name: 'Onboarding e Treinamento de equipe', values: { free: false, starter: false, plus: false, pro: false, enterprise: true } }
    ]
  }
]

export default function PricingSection() {
  const [period, setPeriod] = useState<'mensal' | 'trimestral' | 'semestral' | 'anual'>('mensal')
  const [showComparison, setShowComparison] = useState(false)

  // Estados da Calculadora
  const [ticketPrice, setTicketPrice] = useState(80)
  const [ticketsCount, setTicketsCount] = useState(250)

  // Estados do Quiz Recomendador de Planos
  const [quizStep, setQuizStep] = useState<number>(0)
  const [quizAnswers, setQuizAnswers] = useState<string[]>([])

  const quizQuestions = [
    {
      title: "Qual é o seu objetivo principal ao usar a Evokaa?",
      options: [
        { label: "Começar sem custos fixos e taxas mensais", value: "free" },
        { label: "Organizar pequenos eventos com painel de produtor", value: "starter" },
        { label: "Aumentar vendas usando afiliados, cupons e CRM", value: "plus" },
        { label: "Criar mapa de lugar marcado e integrar APIs", value: "pro" },
        { label: "White-label completo com taxas diferenciadas", value: "enterprise" },
      ]
    },
    {
      title: "Quantos ingressos você estima vender por mês?",
      options: [
        { label: "Até 50 ingressos por mês", value: "free" },
        { label: "Até 200 ingressos por mês", value: "starter" },
        { label: "Até 1.000 ingressos por mês", value: "plus" },
        { label: "Mais de 1.000 ingressos por mês", value: "pro" },
        { label: "Grandes lotes e faturamento de alta escala", value: "enterprise" },
      ]
    },
    {
      title: "Qual o canal de atendimento e suporte que você prefere?",
      options: [
        { label: "Suporte básico por e-mail (em até 48h)", value: "free" },
        { label: "Suporte prioritário por e-mail (em até 24h)", value: "starter" },
        { label: "Suporte por e-mail VIP (em até 12h)", value: "plus" },
        { label: "Suporte completo 24/7 via chat e ticket", value: "pro" },
        { label: "WhatsApp & telefone dedicado 24/7 com gerente de contas", value: "enterprise" },
      ]
    }
  ]

  const handleSelectQuizOption = (value: string) => {
    const newAnswers = [...quizAnswers, value]
    setQuizAnswers(newAnswers)
    setQuizStep(quizStep + 1)
  }

  const handleResetQuiz = () => {
    setQuizStep(0)
    setQuizAnswers([])
  }

  const getQuizRecommendedPlan = () => {
    const points = { free: 0, starter: 0, plus: 0, pro: 0, enterprise: 0 }
    quizAnswers.forEach((ans) => {
      if (ans in points) {
        points[ans as keyof typeof points] += 1
      }
    })
    
    let recommendedId = 'plus'
    let maxPoints = -1
    
    const planOrder = ['free', 'starter', 'plus', 'pro', 'enterprise']
    planOrder.forEach((id) => {
      const pts = points[id as keyof typeof points]
      if (pts > maxPoints) {
        maxPoints = pts
        recommendedId = id
      }
    })
    
    return pricingPlans.find(p => p.id === recommendedId) || pricingPlans[2]
  }

  const quizRecommendedPlan = quizStep === 4 ? getQuizRecommendedPlan() : null

  const scrollToPlan = (planId: string) => {
    const element = document.getElementById(`plan-card-${planId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.classList.add('scale-[1.03]', 'ring-2', 'ring-[#8f33f5]/50')
      setTimeout(() => {
        element.classList.remove('scale-[1.03]', 'ring-2', 'ring-[#8f33f5]/50')
      }, 1500)
    }
  }

  const getPeriodMultiplier = (p: 'mensal' | 'trimestral' | 'semestral' | 'anual') => {
    switch (p) {
      case 'trimestral': return 0.95
      case 'semestral': return 0.90
      case 'anual': return 0.80
      default: return 1.0
    }
  }

  // Lista dos planos calculados com base no período atual
  const calculatedPlans = pricingPlans.map(plan => {
    const multiplier = getPeriodMultiplier(period)
    const monthlyCost = Math.round(plan.monthlyPrice * multiplier)
    
    let feePerTicket = 0
    if (ticketPrice > 0) {
      const calculatedFee = ticketPrice * (plan.fee / 100)
      feePerTicket = plan.feeMin > 0 ? Math.max(plan.feeMin, calculatedFee) : calculatedFee
    }
    const totalCost = monthlyCost + (ticketsCount * feePerTicket)
    return { ...plan, monthlyCost, totalCost }
  })

  // Encontra o plano economicamente mais vantajoso (menor totalCost)
  const bestPlan = calculatedPlans.reduce((best, current) => {
    return current.totalCost < best.totalCost ? current : best
  }, calculatedPlans[0])

  // Cálculos decompostos para o painel recomendado
  const grossSales = ticketsCount * ticketPrice
  const bestMultiplier = getPeriodMultiplier(period)
  
  const getPlanFees = (plan: Plan) => {
    let feePerTicket = 0
    if (ticketPrice > 0) {
      const calculatedFee = ticketPrice * (plan.fee / 100)
      feePerTicket = plan.feeMin > 0 ? Math.max(plan.feeMin, calculatedFee) : calculatedFee
    }
    return feePerTicket * ticketsCount
  }

  const bestPlanFees = getPlanFees(bestPlan)
  const bestPlanMonthlyCost = Math.round(bestPlan.monthlyPrice * bestMultiplier)
  
  // Faturamento líquido
  const netSales = Math.max(0, grossSales - bestPlanFees)

  // Economia em taxas de conveniência em relação ao plano Starter (ou Free)
  const starterPlan = pricingPlans[1]
  const starterMultiplier = getPeriodMultiplier(period)
  const starterCost = Math.round(starterPlan.monthlyPrice * starterMultiplier) + getPlanFees(starterPlan)
  const bestPlanTotalCost = bestPlanMonthlyCost + bestPlanFees
  
  // Economia projetada
  const savingsAmount = Math.max(0, starterCost - bestPlanTotalCost)

  return (
    <section className="py-24 bg-slate-50 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-0 w-[500px] h-[500px] bg-[#1d68c4]/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#8f33f5]/[0.02] rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Header Section */}
        <div className="text-center mb-16">
          <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-[#1d68c4] bg-[#1d68c4]/5 px-4 py-1.5 rounded-full">
            Planos & Tarifas
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold mt-6 mb-4 text-slate-900 tracking-tight font-serif">
            Preços transparentes, <span className="text-gradient">sem surpresas</span>
          </h2>
          <p className="text-base max-w-lg mx-auto leading-relaxed text-slate-500 font-light">
            Crie seus eventos gratuitamente. Só pague taxas sobre ingressos vendidos. À medida que suas vendas sobem, suas taxas despencam.
          </p>
        </div>

        {/* 1. CALCULADORA DINÂMICA DE TAXAS (Inovação UX) */}
        <div className="max-w-4xl mx-auto mb-12 bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#1d68c4]/10 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-[#1d68c4]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 font-serif">Simule sua Economia Real</h3>
              <p className="text-xs text-slate-400">Descubra qual plano é o mais vantajoso com base no seu volume de vendas.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Sliders */}
            <div className="space-y-6 flex flex-col justify-center">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Preço médio do ingresso</span>
                  <span className="font-semibold text-slate-900">R$ {ticketPrice}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="5"
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1d68c4]"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>R$ 0 (Gratuito)</span>
                  <span>R$ 500</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Volume de vendas (Ingressos/mês)</span>
                  <span className="font-semibold text-slate-900">{ticketsCount} ingressos</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="2000"
                  step="10"
                  value={ticketsCount}
                  onChange={(e) => setTicketsCount(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1d68c4]"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>10 ingressos</span>
                  <span>2.000 ingressos</span>
                </div>
              </div>
            </div>

            {/* Painel do Recomendado (UX Decomposta) */}
            <div className="bg-[#0c2340] rounded-2xl p-6 text-white relative overflow-hidden shadow-lg flex flex-col justify-between min-h-[220px]">
              {/* Glow background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#1d68c4] to-[#8f33f5] rounded-full blur-2xl opacity-40 pointer-events-none" />

              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <span className="text-[9px] uppercase tracking-widest font-bold text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-full">
                    Plano Ideal Recomendado: {bestPlan.name}
                  </span>
                  {savingsAmount > 0 && (
                    <span className="text-[9px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Economia de R$ {Math.round(savingsAmount)}/mês
                    </span>
                  )}
                </div>

                {/* Decomposição detalhada dos custos simulados */}
                <div className="border-t border-b border-white/10 py-3.5 space-y-2 text-xs font-light text-white/80">
                  <div className="flex justify-between">
                    <span>Faturamento Estimado:</span>
                    <span className="font-semibold text-white">R$ {grossSales.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mensalidade Fixa do Plano:</span>
                    <span className="font-semibold text-white">R$ {bestPlanMonthlyCost}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxa de Vendas Acumulada ({bestPlan.fee}%):</span>
                    <span className="font-semibold text-white">R$ {Math.round(bestPlanFees).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold border-t border-white/10 pt-2 mt-1">
                    <span>Repasse Líquido Estimado:</span>
                    <span className="text-cyan-400 text-sm">R$ {Math.round(netSales).toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                <p className="text-[9px] text-white/40 leading-relaxed font-light">
                  * As taxas de vendas por ingresso são descontadas diretamente de cada venda realizada e não vêm cobradas no seu boleto/fatura mensal.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Switcher Multi-Período (Mensal, Trimestral, Semestral, Anual) */}
        <div className="flex justify-center mb-16">
          <div className="bg-white/85 backdrop-blur-sm border border-slate-200/50 rounded-full p-1 flex gap-1 w-full sm:w-auto overflow-x-auto no-scrollbar shadow-sm">
            {(['mensal', 'trimestral', 'semestral', 'anual'] as const).map((p) => {
              const label = p.charAt(0).toUpperCase() + p.slice(1)
              const isActive = period === p
              const discount = p === 'trimestral' ? '5% OFF' : p === 'semestral' ? '10% OFF' : p === 'anual' ? '20% OFF' : ''
              
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`flex-1 sm:flex-initial px-5 py-2 text-xs font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    isActive 
                      ? 'bg-plum text-cream shadow-md scale-[1.02]' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{label}</span>
                  {discount && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-green-500/10 text-green-600'
                    }`}>
                      {discount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. GRID DE CARDS DE PLANOS (Visual Premium) */}
        {/* Mobile: Horizontal scroll container | Desktop/Tablet: Flex grid */}
        <div className="flex overflow-x-auto pb-8 -mx-6 px-6 sm:-mx-0 sm:px-0 sm:overflow-x-visible lg:grid lg:grid-cols-5 gap-6 snap-x snap-mandatory scroll-smooth no-scrollbar">
          {calculatedPlans.map(p => (
            <PlanCard 
              key={p.id}
              plan={p}
              isBest={p.id === bestPlan.id}
              period={period}
            />
          ))}
        </div>

        {/* Indicadores de Scroll no Mobile */}
        <div className="flex justify-center gap-1.5 mt-4 lg:hidden">
          {pricingPlans.map((_, idx) => (
            <div key={idx} className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          ))}
        </div>

        {/* 3. TABELA COMPARATIVA DE RECURSOS (Accordion Retrátil) */}
        <div className="mt-16 text-center">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-200 hover:border-[#1d68c4] bg-white hover:bg-slate-50 font-semibold text-slate-700 hover:text-[#1d68c4] text-xs transition-all duration-300 shadow-sm"
          >
            <span>{showComparison ? 'Ocultar Comparação Detalhada' : 'Comparar Todos os Recursos'}</span>
            {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showComparison && (
          <div className="mt-10 max-w-5xl mx-auto overflow-hidden border border-slate-200/80 rounded-3xl bg-white shadow-xl animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-serif">
                    <th className="p-4 sm:p-5 text-xs uppercase tracking-wider font-bold min-w-[200px]">Recursos & Ferramentas</th>
                    <th className="p-4 text-center text-xs uppercase tracking-wider font-bold">Gratuito</th>
                    <th className="p-4 text-center text-xs uppercase tracking-wider font-bold">Starter</th>
                    <th className="p-4 text-center text-xs uppercase tracking-wider font-bold">Plus</th>
                    <th className="p-4 text-center text-xs uppercase tracking-wider font-bold">Pro</th>
                    <th className="p-4 text-center text-xs uppercase tracking-wider font-bold">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparisonCategories.map((category, catIdx) => (
                    <div key={catIdx} className="contents">
                      {/* Categoria Header */}
                      <tr className="bg-slate-50/80">
                        <td colSpan={6} className="p-4 font-bold text-slate-800 text-xs uppercase tracking-wider font-serif border-y border-slate-200/50">
                          {category.name}
                        </td>
                      </tr>
                      {category.features.map((feat, featIdx) => (
                        <tr key={featIdx} className="hover:bg-slate-50/40 transition-colors">
                          <td className="p-4 text-slate-700 text-xs font-medium">
                            {feat.name}
                          </td>
                          {['free', 'starter', 'plus', 'pro', 'enterprise'].map((pKey) => {
                            const val = feat.values[pKey as keyof typeof feat.values]
                            return (
                              <td key={pKey} className="p-4 text-center text-xs text-slate-500">
                                {typeof val === 'boolean' ? (
                                  val ? (
                                    <Check className="w-4 h-4 text-green-500 mx-auto" />
                                  ) : (
                                    <X className="w-4 h-4 text-slate-300 mx-auto" />
                                  )
                                ) : (
                                  <span className="font-semibold text-slate-600">{val}</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </div>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= RECOMENDADOR INTELIGENTE DE PLANOS ================= */}
        <div className="mt-16 max-w-4xl mx-auto">
          {quizStep === 0 ? (
            <div className="bg-white/60 backdrop-blur-md border border-slate-200/50 p-6 sm:p-8 rounded-3xl shadow-md text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group">
              {/* Orb neon sutil */}
              <div className="absolute -right-20 -bottom-20 w-48 h-48 bg-[#8f33f5]/5 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
              
              <div className="space-y-1 relative z-10">
                <h3 className="text-base sm:text-lg font-bold text-slate-800 font-serif">Ficou com dúvida sobre qual plano escolher?</h3>
                <p className="text-xs text-slate-400 font-light max-w-xl">Nós te ajudamos a escolher o melhor plano com base no tamanho do seu evento e no suporte que você precisa.</p>
              </div>
              
              <button
                type="button"
                onClick={() => setQuizStep(1)}
                className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] text-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] text-xs font-bold rounded-full transition-all duration-300 uppercase tracking-wider relative z-10"
              >
                Achar Meu Plano Ideal
              </button>
            </div>
          ) : quizStep >= 1 && quizStep <= 3 ? (
            <div className="bg-white/70 backdrop-blur-md border border-slate-200/50 p-6 sm:p-8 rounded-3xl shadow-lg relative z-20">
              {/* Barra de progresso do Quiz */}
              <div className="w-full h-1 bg-slate-100 rounded-full mb-6 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] transition-all duration-500 ease-out"
                  style={{ width: `${(quizStep / quizQuestions.length) * 100}%` }}
                />
              </div>

              {/* Botão Cancelar */}
              <button 
                type="button" 
                onClick={handleResetQuiz}
                className="absolute top-4 right-4 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider"
              >
                Cancelar
              </button>

              <div className="space-y-6">
                <div>
                  <span className="text-[9px] font-bold text-[#8f33f5] uppercase tracking-widest">Pergunta {quizStep} de 3</span>
                  <h4 className="text-sm sm:text-base font-bold text-slate-800 font-serif mt-1">
                    {quizQuestions[quizStep - 1].title}
                  </h4>
                </div>

                {/* Opções de Resposta */}
                <div className="grid grid-cols-1 gap-2.5">
                  {quizQuestions[quizStep - 1].options.map((opt, oIdx) => (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => handleSelectQuizOption(opt.value)}
                      className="w-full p-3.5 text-left text-xs text-slate-600 hover:text-[#8f33f5] bg-slate-50/50 hover:bg-[#8f33f5]/5 border border-slate-200/50 hover:border-[#8f33f5]/30 rounded-xl transition-all duration-300 flex items-center justify-between font-medium group"
                    >
                      <span>{opt.label}</span>
                      <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center group-hover:border-[#8f33f5] transition-all duration-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#8f33f5] scale-0 group-hover:scale-100 transition-transform duration-300" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-md border border-slate-200/50 p-6 sm:p-8 rounded-3xl shadow-xl text-center space-y-6 relative overflow-hidden group">
              {/* Glows de celebração */}
              <div className="absolute -left-20 -top-20 w-48 h-48 bg-[#10b981]/5 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -right-20 -bottom-20 w-48 h-48 bg-[#8f33f5]/5 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-2 relative z-10">
                <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest bg-green-500/10 px-3 py-1 rounded-full">Recomendação Concluída</span>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-800 font-serif pt-2">
                  O plano perfeito para você é o <span className="text-gradient font-extrabold">{quizRecommendedPlan?.name}</span>!
                </h3>
                <p className="text-xs text-slate-400 font-light max-w-md mx-auto leading-relaxed">
                  {quizRecommendedPlan?.tagline}. Só pague comissão de {quizRecommendedPlan?.fee}% sobre ingressos vendidos e tenha acesso completo aos recursos ideais.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    if (quizRecommendedPlan) {
                      scrollToPlan(quizRecommendedPlan.id)
                    }
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] text-white font-bold text-xs rounded-full hover:shadow-lg transition-all duration-300 uppercase tracking-wider"
                >
                  Ver Plano Recomendado
                </button>
                <button
                  type="button"
                  onClick={handleResetQuiz}
                  className="w-full sm:w-auto px-6 py-3 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 text-xs font-bold rounded-full transition-all duration-300 uppercase tracking-wider"
                >
                  Refazer Teste
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. TRUST BADGES E SEGURANÇA */}
        <div className="mt-20 border-t border-slate-200/60 pt-16 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { type: 'shield' as const, title: 'Transações Protegidas', desc: 'Criptografia SSL de 256 bits nas compras.', accent: '#1d68c4' },
            { type: 'fidelity' as const, title: 'Sem Fidelidade', desc: 'Faça upgrades ou cancele a qualquer momento.', accent: '#8f33f5' },
            { type: 'nofees' as const, title: 'Sem Taxa de Adesão', desc: 'Só pague a mensalidade e taxas de vendas.', accent: '#06b6d4' },
            { type: 'activation' as const, title: 'Ativação Rápida', desc: 'Crie sua conta e comece a vender em 5 minutos.', accent: '#ef4444' },
          ].map((t, idx) => (
            <TrustCard key={idx} iconType={t.type} title={t.title} desc={t.desc} accent={t.accent} />
          ))}
        </div>
      </div>
    </section>
  )
}
