import { useState, useRef } from 'react'
import { Plus, MessageSquare, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface FAQItem {
  question: string
  answer: string
}

interface FAQSectionProps {
  title: string
  subtitle: string
  items: FAQItem[]
}

function FAQAccordionItem({ 
  question, 
  answer, 
  isOpen, 
  onToggle 
}: { 
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void 
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
      className={`relative overflow-hidden rounded-[20px] border transition-all duration-500 ease-out group ${
        isOpen 
          ? 'border-[#8f33f5]/30 bg-white/90 shadow-[0_15px_30px_rgba(143,51,245,0.06)] scale-[1.01]' 
          : 'border-slate-200/50 bg-white/60 hover:bg-white/80 hover:border-slate-300'
      }`}
      style={{
        '--mouse-x': '0px',
        '--mouse-y': '0px',
      } as React.CSSProperties}
    >
      {/* Background Spotlight Glow (Purple hue) */}
      <div 
        className="pointer-events-none absolute -inset-px rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"
        style={{
          background: `radial-gradient(220px circle at var(--mouse-x) var(--mouse-y), rgba(143, 51, 245, 0.05), transparent 80%)`
        }}
      />
      
      {/* Border Spotlight Glow */}
      <div 
        className="pointer-events-none absolute -inset-px rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"
        style={{
          background: `radial-gradient(100px circle at var(--mouse-x) var(--mouse-y), rgba(143, 51, 245, 0.25), transparent 80%)`,
          padding: '1.5px',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude'
        }}
      />

      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 sm:p-6 text-left relative z-20 focus:outline-none"
      >
        <span className={`text-[13px] sm:text-sm font-semibold tracking-tight transition-all duration-300 leading-snug ${
          isOpen ? 'text-[#8f33f5] font-bold' : 'text-slate-800 group-hover:text-slate-950'
        }`}>
          {question}
        </span>
        
        {/* Botão circular de toggle com animação de rotação */}
        <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-500 flex-shrink-0 ml-4 ${
          isOpen 
            ? 'bg-gradient-to-br from-[#8f33f5] to-[#1d68c4] border-transparent text-white shadow-md' 
            : 'border-slate-200 bg-slate-50/50 text-slate-400 group-hover:border-slate-300 group-hover:text-slate-600 group-hover:bg-white'
        }`}>
          <Plus className={`w-3.5 h-3.5 transition-transform duration-500 ease-out ${
            isOpen ? 'rotate-[135deg]' : 'rotate-0'
          }`} />
        </div>
      </button>

      {/* Animação Suave de Altura */}
      <div 
        className={`transition-all duration-500 ease-in-out overflow-hidden relative z-20 ${
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 border-t border-slate-100/50">
          <p className="text-[12px] sm:text-[13px] text-slate-500 leading-relaxed font-light mt-3">
            {answer}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function FAQSection({ title, subtitle, items }: FAQSectionProps) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        
        {/* Coluna da Esquerda: Título Monumental & Card de Suporte */}
        <div className="lg:col-span-5 space-y-6 text-left">
          <div>
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#8f33f5] bg-[#8f33f5]/5 px-3 py-1.5 rounded-full">
              Dúvidas Comuns
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight font-serif mt-4 mb-3 leading-tight">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-light max-w-sm">
              {subtitle}
            </p>
          </div>

          {/* Card de Suporte Adicional */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-[#0c2340] to-slate-950 p-6 text-white shadow-xl group">
            {/* Grid de fundo sutil */}
            <div className="absolute inset-0 opacity-[0.02]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}
            />
            {/* Orb de brilho */}
            <div className="absolute -right-10 -bottom-10 w-28 h-28 bg-[#8f33f5]/30 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
            
            <div className="relative z-10 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white">
                <MessageSquare className="w-5 h-5 text-purple-400 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold font-serif mb-1">Ainda com alguma dúvida?</h4>
                <p className="text-[11px] text-white/50 leading-relaxed font-light">
                  Se você não encontrou a resposta que procurava, nossa equipe está pronta para te atender.
                </p>
              </div>
              <Link
                to="/contato"
                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 hover:text-white hover:translate-x-1.5 transition-all duration-300 mt-2"
              >
                <span>Falar com o Suporte</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Acordeões FAQ */}
        <div className="lg:col-span-7 space-y-4">
          {items.map((item, i) => (
            <FAQAccordionItem
              key={i}
              question={item.question}
              answer={item.answer}
              isOpen={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
