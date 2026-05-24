import { Check, X } from 'lucide-react'
import { usePasswordValidation } from '../hooks/usePasswordValidation'

interface PasswordStrengthProps {
  password: string
  confirmPassword?: string
}

export default function AuthPasswordStrength({ password, confirmPassword }: PasswordStrengthProps) {
  const { strength, strengthLabel, strengthColor, checks, isValid } = usePasswordValidation(password)

  const requirements = [
    { key: 'minLength' as const, label: 'Mínimo 8 caracteres' },
    { key: 'hasLowercase' as const, label: 'Pelo menos 1 letra minúscula' },
    { key: 'hasUppercase' as const, label: 'Pelo menos 1 letra maiúscula' },
    { key: 'hasNumber' as const, label: 'Pelo menos 1 número' },
    { key: 'hasSpecial' as const, label: 'Pelo menos 1 caractere especial (!@#$%)' },
  ]

  const passwordsMatch = confirmPassword !== undefined && password === confirmPassword && password.length > 0

  return (
    <div className="space-y-3">
      {/* Medidor de força */}
      {password.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-espresso/40 uppercase tracking-wider">Força da senha</span>
            <span className={`text-[10px] font-medium ${strength === 5 ? 'text-plum' : strength >= 3 ? 'text-emerald-600' : 'text-red-500'}`}>
              {strengthLabel}
            </span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  strength >= level ? strengthColor : 'bg-espresso/10'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-1.5">
        {requirements.map((req) => {
          const met = checks[req.key]
          return (
            <div key={req.key} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300 ${
                met ? 'bg-emerald-100 text-emerald-600' : 'bg-espresso/5 text-espresso/20'
              }`}>
                {met ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
              </div>
              <span className={`text-[11px] transition-colors duration-300 ${met ? 'text-emerald-700' : 'text-espresso/40'}`}>
                {req.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Confirmação de senha */}
      {confirmPassword !== undefined && confirmPassword.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300 ${
            passwordsMatch ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-500'
          }`}>
            {passwordsMatch ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
          </div>
          <span className={`text-[11px] ${passwordsMatch ? 'text-emerald-700' : 'text-red-500'}`}>
            {passwordsMatch ? 'Senhas coincidem' : 'Senhas não coincidem'}
          </span>
        </div>
      )}

      {isValid && (
        <p className="text-[11px] text-plum font-medium flex items-center gap-1.5 pt-1">
          <span>🔒</span> Senha nível Aura — sua conta está blindada
        </p>
      )}
    </div>
  )
}
