import { Check, Loader2, ShieldCheck } from 'lucide-react'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'

export type MfaStatus = 'idle' | 'verificando' | 'ok' | 'erro'

interface Props {
  codigo: string
  status: MfaStatus
  erro: string
  onChange: (v: string) => void
  onCompleto: (v: string) => void
  onVoltar: () => void
}

// Passo do código de 6 dígitos do login: Evo no anel que reage ao que se digita (mfa-* em index.css),
// caixas que viram ✓ verdes no acerto e tremem em vermelho no erro. Envia sozinho ao completar.
export default function MfaCodigo({ codigo, status, erro, onChange, onCompleto, onVoltar }: Props) {
  const ocupado = status === 'verificando' || status === 'ok'
  const anel =
    status === 'ok' ? 'mfa-anel--ok' : status === 'erro' ? 'mfa-anel--erro' : codigo.length > 0 ? 'mfa-anel--digitando' : ''

  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center">
        <div className={`mfa-anel ${anel} relative w-24 h-24 rounded-full p-1`}>
          <img src="/evo/evo-avatar.webp" alt="" width={96} height={96} className="w-full h-full rounded-full" />
          <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
            {status === 'ok' ? (
              <Check className="w-4 h-4 text-emerald-600" aria-hidden />
            ) : (
              <ShieldCheck className="w-4 h-4 text-plum" aria-hidden />
            )}
          </span>
        </div>
        <p className="mt-5 text-[11px] font-semibold tracking-[0.18em] uppercase text-espresso/60">Verificação de segurança</p>
        <h2 className="mt-1 text-xl font-semibold text-espresso">Digite o código do seu app</h2>
        <p className="mt-1.5 text-sm text-espresso/70 max-w-xs">
          Abra o Google Authenticator (ou similar) e digite os 6 dígitos que aparecem para a Evokaa.
        </p>
      </div>

      <div className={status === 'erro' ? 'mfa-tremer' : ''}>
        <InputOTP
          maxLength={6}
          value={codigo}
          onChange={v => { if (!ocupado) onChange(v.replace(/\D/g, '')) }}
          onComplete={onCompleto}
          inputMode="numeric"
          autoFocus
          aria-label="Código de 6 dígitos"
          containerClassName="justify-center gap-2"
        >
          <InputOTPGroup className="gap-2">
            {[0, 1, 2].map(i => (
              <InputOTPSlot key={i} index={i} className={slot(status)} />
            ))}
          </InputOTPGroup>
          <span className="w-2 h-px bg-espresso/30" aria-hidden />
          <InputOTPGroup className="gap-2">
            {[3, 4, 5].map(i => (
              <InputOTPSlot key={i} index={i} className={slot(status)} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <p role="status" aria-live="polite" className={`text-xs min-h-4 flex items-center justify-center gap-1.5 ${
        status === 'erro' ? 'text-red-600' : status === 'ok' ? 'text-emerald-600' : 'text-espresso/60'
      }`}>
        {status === 'verificando' && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
        {status === 'verificando' ? 'Verificando…' : status === 'ok' ? 'Código confirmado' : status === 'erro' ? erro : 'O código muda a cada 30 segundos. Dica: cole para preencher tudo.'}
      </p>

      <button
        type="button"
        disabled={ocupado}
        onClick={onVoltar}
        className="w-full py-2.5 px-4 text-espresso/70 hover:text-espresso text-xs font-medium rounded-full hover:bg-espresso/5 transition-all disabled:opacity-50"
      >
        Voltar para a tela de login
      </button>
    </div>
  )
}

// h-12 w-10 (48px de altura) = alvo de toque confortável; cada caixa é redonda e solta como no vídeo
function slot(status: MfaStatus) {
  const base = 'h-12 w-10 sm:w-11 !rounded-xl !border text-lg font-semibold font-mono bg-white/70 text-espresso transition-all duration-200 data-[active=true]:scale-105 data-[active=true]:!border-plum/60 data-[active=true]:!ring-plum/20'
  if (status === 'ok') return `${base} !border-emerald-400 !bg-emerald-50 !text-emerald-700`
  if (status === 'erro') return `${base} !border-red-400 !bg-red-50 !text-red-600`
  return `${base} border-white/80`
}
