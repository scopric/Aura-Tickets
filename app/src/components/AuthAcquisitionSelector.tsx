import { useState } from 'react'
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
  referralEmail?: string
  onChange: (value: string, referralEmail?: string) => void
}

export default function AuthAcquisitionSelector({ value, referralEmail, onChange }: AcquisitionSelectorProps) {
  const [localReferral, setLocalReferral] = useState(referralEmail || '')

  const handleSelect = (id: string) => {
    onChange(id, id === 'friend' ? localReferral : undefined)
  }

  const handleReferralChange = (email: string) => {
    setLocalReferral(email)
    if (value === 'friend') {
      onChange(value, email)
    }
  }

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
              onClick={() => handleSelect(option.id)}
              className={`p-4 rounded-2xl border transition-all duration-300 text-left group ${
                isSelected
                  ? 'bg-plum/10 border-plum/30 shadow-lg shadow-plum/10'
                  : 'bg-white/60 border-white/60 hover:bg-white hover:border-plum/20 hover:shadow-md'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                isSelected ? 'bg-plum text-cream' : 'bg-espresso/5 text-espresso/30 group-hover:bg-plum/10 group-hover:text-plum'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className={`text-xs font-medium mb-0.5 ${isSelected ? 'text-plum' : 'text-espresso'}`}>
                {option.label}
              </p>
              <p className="text-[10px] text-espresso/40 leading-tight">{option.description}</p>
            </button>
          )
        })}
      </div>

      {value === 'friend' && (
        <div className="p-4 rounded-2xl bg-plum/5 border border-plum/10 animate-in fade-in slide-in-from-top-2">
          <label className="text-xs font-medium text-espresso mb-2 block">
            Quem te indicou? Envie um abraço de volta 🫂
          </label>
          <input
            type="email"
            value={localReferral}
            onChange={(e) => handleReferralChange(e.target.value)}
            placeholder="email@do.amigo.com"
            className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors"
          />
          <p className="text-[10px] text-espresso/40 mt-2">
            Em breve você poderá ganhar recompensas por indicações!
          </p>
        </div>
      )}

      {value === 'other' && (
        <div className="p-4 rounded-2xl bg-plum/5 border border-plum/10 animate-in fade-in slide-in-from-top-2">
          <label className="text-xs font-medium text-espresso mb-2 block">Conta pra gente como foi:</label>
          <textarea
            value={localReferral}
            onChange={(e) => handleReferralChange(e.target.value)}
            placeholder="Vi um panfleto, ouvi no rádio..."
            rows={3}
            className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors resize-none"
          />
        </div>
      )}
    </div>
  )
}
