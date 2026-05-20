import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

interface FAQSectionProps {
  title: string
  subtitle: string
  items: FAQItem[]
}

export default function FAQSection({ title, subtitle, items }: FAQSectionProps) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <div className="w-12 h-12 rounded-full bg-plum/10 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-6 h-6 text-plum" />
        </div>
        <h2 className="font-serif text-3xl text-espresso">{title}</h2>
        <p className="text-sm text-espresso/50 mt-2">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden backdrop-blur-sm">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-white/40 transition-colors"
            >
              <span className={`text-sm font-medium ${open === i ? 'text-plum' : 'text-espresso'}`}>{item.question}</span>
              <ChevronDown className={`w-4 h-4 text-espresso/30 transition-transform flex-shrink-0 ml-4 ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && (
              <div className="px-5 pb-5">
                <p className="text-sm text-espresso/60 leading-relaxed">{item.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
