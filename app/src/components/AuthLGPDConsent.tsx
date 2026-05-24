import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Shield, Mail, Share2, Check } from 'lucide-react'

interface LGPDConsentProps {
  acceptedTerms: boolean
  acceptedPrivacy: boolean
  marketingConsent: boolean
  dataSharingConsent: boolean
  onChange: (values: {
    acceptedTerms: boolean
    acceptedPrivacy: boolean
    marketingConsent: boolean
    dataSharingConsent: boolean
  }) => void
}

export default function AuthLGPDConsent({
  acceptedTerms,
  acceptedPrivacy,
  marketingConsent,
  dataSharingConsent,
  onChange,
}: LGPDConsentProps) {
  const [showDetails, setShowDetails] = useState(false)

  const allRequired = acceptedTerms && acceptedPrivacy

  return (
    <div className="space-y-4">
      {/* Card de consentimento principal */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-plum/5 to-plum/10 border border-plum/10">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-plum/20 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-plum" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-espresso">Seus dados, suas regras</h3>
            <p className="text-[11px] text-espresso/50 mt-0.5">
              A Aura respeita sua privacidade. Você está no controle.
            </p>
          </div>
        </div>

        {/* Termos obrigatórios */}
        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3 rounded-xl bg-white/60 border border-white/60 cursor-pointer hover:bg-white transition-colors group">
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
              acceptedTerms ? 'bg-plum border-plum' : 'border-espresso/20 group-hover:border-plum/40'
            }`}>
              {acceptedTerms && <Check className="w-3 h-3 text-cream" />}
            </div>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => onChange({ acceptedTerms: e.target.checked, acceptedPrivacy, marketingConsent, dataSharingConsent })}
              className="sr-only"
            />
            <div className="flex-1">
              <p className="text-xs text-espresso font-medium flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-espresso/30" />
                Aceito os Termos de Uso <span className="text-red-500">*</span>
              </p>
              <p className="text-[10px] text-espresso/40 mt-0.5">
                Leia os <Link to="/termos" target="_blank" className="text-plum hover:underline">Termos de Uso</Link> completos.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-white/60 border border-white/60 cursor-pointer hover:bg-white transition-colors group">
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
              acceptedPrivacy ? 'bg-plum border-plum' : 'border-espresso/20 group-hover:border-plum/40'
            }`}>
              {acceptedPrivacy && <Check className="w-3 h-3 text-cream" />}
            </div>
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(e) => onChange({ acceptedTerms, acceptedPrivacy: e.target.checked, marketingConsent, dataSharingConsent })}
              className="sr-only"
            />
            <div className="flex-1">
              <p className="text-xs text-espresso font-medium flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-espresso/30" />
                Aceito a Política de Privacidade <span className="text-red-500">*</span>
              </p>
              <p className="text-[10px] text-espresso/40 mt-0.5">
                Leia a <Link to="/privacidade" target="_blank" className="text-plum hover:underline">Política de Privacidade</Link> completa.
              </p>
            </div>
          </label>
        </div>

        {!allRequired && (
          <p className="text-[10px] text-red-500 mt-3 flex items-center gap-1">
            <span>*</span> Campos obrigatórios para criar a conta
          </p>
        )}
      </div>

      {/* Opções opcionais */}
      <div>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-plum hover:text-espresso transition-colors flex items-center gap-1"
        >
          {showDetails ? 'Ocultar' : 'Mostrar'} opções de comunicação e personalização
        </button>

        {showDetails && (
          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2">
            <label className="flex items-start gap-3 p-3 rounded-xl bg-white/40 border border-white/40 cursor-pointer hover:bg-white/60 transition-colors group">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                marketingConsent ? 'bg-plum border-plum' : 'border-espresso/20 group-hover:border-plum/40'
              }`}>
                {marketingConsent && <Check className="w-3 h-3 text-cream" />}
              </div>
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => onChange({ acceptedTerms, acceptedPrivacy, marketingConsent: e.target.checked, dataSharingConsent })}
                className="sr-only"
              />
              <div className="flex-1">
                <p className="text-xs text-espresso font-medium flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-espresso/30" />
                  Comunicações de marketing
                </p>
                <p className="text-[10px] text-espresso/40 mt-0.5">
                  Aceito receber e-mails sobre eventos, promoções e novidades da Aura.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-white/40 border border-white/40 cursor-pointer hover:bg-white/60 transition-colors group">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                dataSharingConsent ? 'bg-plum border-plum' : 'border-espresso/20 group-hover:border-plum/40'
              }`}>
                {dataSharingConsent && <Check className="w-3 h-3 text-cream" />}
              </div>
              <input
                type="checkbox"
                checked={dataSharingConsent}
                onChange={(e) => onChange({ acceptedTerms, acceptedPrivacy, marketingConsent, dataSharingConsent: e.target.checked })}
                className="sr-only"
              />
              <div className="flex-1">
                <p className="text-xs text-espresso font-medium flex items-center gap-1.5">
                  <Share2 className="w-3 h-3 text-espresso/30" />
                  Personalização de experiência
                </p>
                <p className="text-[10px] text-espresso/40 mt-0.5">
                  Aceito que a Aura use meus dados para recomendar eventos e melhorar minha experiência.
                </p>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
