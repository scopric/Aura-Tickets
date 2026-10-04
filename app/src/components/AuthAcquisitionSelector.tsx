import { Instagram, Search, Users, Music, HelpCircle, type LucideIcon } from 'lucide-react'

interface AcquisitionOption {
  id: string
  label: string
  icon: LucideIcon
  description: string
}

const options: AcquisitionOption[] = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, description: 'Vi nos stories ou feed' },
  { id: 'google', label: 'Google', icon: Search, description: 'Pesquisei e encontrei' },
  { id: 'friend', label: 'Indicação', icon: Users, description: 'Um amigo me indicou' },
  { id: 'event', label: 'Evento', icon: Music, description: 'Fui em um evento que usava Evokaa' },
  { id: 'other', label: 'Outro', icon: HelpCircle, description: 'Outra forma' },
]

interface AcquisitionSelectorProps {
  value: string
  onChange: (value: string) => void
}

export default function AuthAcquisitionSelector({ value, onChange }: AcquisitionSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {options.map((option) => {
          const isSelected = value === option.id
          const Icon = option.icon
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(option.id)}
              className={`p-4 rounded-2xl border transition-all duration-300 text-left group ${
                isSelected
                  ? 'bg-plum/10 border-plum/30 shadow-lg shadow-plum/10'
                  : 'bg-white/60 border-white/60 hover:bg-white dark:hover:bg-white/10 hover:border-plum/20 hover:shadow-md'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                isSelected ? 'bg-plum text-cream' : 'bg-espresso/5 text-espresso/70 group-hover:bg-plum/10 group-hover:text-plum'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className={`text-xs font-medium mb-0.5 ${isSelected ? 'text-plum' : 'text-espresso'}`}>
                {option.label}
              </p>
              <p className="text-[10px] text-espresso/70 leading-tight">{option.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
