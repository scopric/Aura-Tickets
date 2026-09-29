import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'

// 2FA por aplicativo autenticador (TOTP do Supabase), usado nas configurações do participante,
// do produtor e do admin. A tela desenha o próprio interruptor com `enabled`/`loading`/`toggle`
// e coloca `modal` no fim do JSX. O pedido do código no login fica em auth/Login.tsx.
export function useTwoFactor() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false) // trava imediata contra clique duplo (o estado só desabilita no próximo render)
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    supabase.auth.mfa.listFactors()
      .then(({ data }) => setEnabled((data?.totp || []).length > 0))
      .catch(err => console.error('[2FA] Erro ao carregar:', err))
      .finally(() => setLoading(false))
  }, [])

  const start = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setError('')
    setCode('')
    setBusy(true)
    try {
      // Tentativa anterior abandonada deixa um fator "não confirmado" na conta; sem apagar, o Supabase
      // recusa o novo cadastro (mfa_factor_name_conflict) e o 2FA nunca mais ativa.
      const { data: list, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) throw listError
      for (const f of list.all) {
        if (f.status !== 'unverified') continue
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
        // Já apagado por um Cancelar que ainda estava a caminho: segue
        if (error && error.code !== 'mfa_factor_not_found') throw error
      }

      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Evokaa Tickets' })
      if (error) throw error
      // qr_code já vem como data URL (data:image/svg+xml): vai no <img src>, não em innerHTML
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    } catch (err: any) {
      console.error('[2FA] Erro ao iniciar:', err)
      toast.error(
        err?.code === 'mfa_totp_enroll_not_enabled' ? 'O 2FA está desligado no servidor. Avise o suporte.'
        : err?.code === 'mfa_factor_name_conflict' ? 'Já existe uma ativação em andamento. Recarregue a página e tente de novo.'
        : err?.message || 'Erro ao iniciar a ativação do 2FA')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!enroll) return
    if (code.length !== 6) { setError('Digite o código de 6 dígitos do aplicativo'); return }

    setVerifying(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code })
      if (error) throw error
      toast.success('Autenticação de dois fatores (2FA) ativada!')
      setEnabled(true)
      setEnroll(null)
    } catch (err: any) {
      console.error('[2FA] Erro ao confirmar:', err)
      setError('Código inválido ou expirado. Confira o aplicativo e tente de novo.')
    } finally {
      setVerifying(false)
    }
  }

  // Descarta o fator não confirmado para não ficar pendurado na conta
  const cancel = async () => {
    const factorId = enroll?.id
    setEnroll(null)
    if (!factorId) return
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) console.error('[2FA] Erro ao descartar fator não confirmado:', error)
  }

  const disable = async () => {
    if (!window.confirm('Desativar a autenticação em duas etapas (2FA)? Sua conta ficará menos protegida.')) return
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      // Lista na hora: outra aba ou aparelho pode ter cadastrado outro autenticador
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) throw listError
      for (const f of data.totp) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
        if (error) throw error
      }
      toast.success('2FA desativado.')
      setEnabled(false)
    } catch (err: any) {
      console.error('[2FA] Erro ao desativar:', err)
      // O Supabase só remove um fator confirmado numa sessão AAL2 (login feito com o código)
      toast.error(/aal2/i.test(err?.message || '')
        ? 'Saia e entre de novo com o código para desativar o 2FA'
        : err?.message || 'Erro ao desativar o 2FA')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const modal = enroll && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onKeyDown={e => { if (e.key === 'Escape' && !verifying) cancel() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="twofa-title" className="w-full max-w-md bg-white dark:bg-canvas border border-espresso/10 rounded-2xl p-6 shadow-2xl relative text-espresso">
        <h3 id="twofa-title" className="font-serif text-xl mb-2 flex items-center gap-2">
          <Shield className="w-5 h-5 text-plum" /> Configurar Autenticador (2FA)
        </h3>
        <p className="text-xs text-espresso/60 mb-4">
          Instale o Google Authenticator ou Microsoft Authenticator no seu celular, escaneie o código abaixo e digite o código de 6 dígitos para validar.
        </p>

        <img src={enroll.qr} alt="QR Code para o aplicativo autenticador" className="w-48 h-48 mx-auto my-6 bg-white p-3 rounded-xl border border-espresso/10" />

        <div className="bg-slate-50 dark:bg-white/5 border border-espresso/5 rounded-xl p-3 mb-4 text-center">
          <span className="text-[10px] text-espresso/60 block mb-1">Chave manual (se o QR Code falhar)</span>
          <code className="text-xs font-mono font-bold tracking-wider select-all break-all text-plum">{enroll.secret}</code>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-600 text-center">{error}</div>
        )}

        <form onSubmit={verify} className="space-y-4">
          <div>
            <label htmlFor="twofa-code" className="text-xs font-medium text-espresso/60 mb-1 block">Código de verificação</label>
            <input
              id="twofa-code"
              autoFocus
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              disabled={verifying}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/60 border border-slate-200 dark:border-white/60 rounded-xl text-center text-lg font-mono tracking-widest text-espresso focus:outline-none focus:border-plum/30 transition-colors disabled:opacity-50"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" disabled={verifying} onClick={cancel} className="px-4 py-2 text-xs text-espresso/60 hover:text-espresso transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={verifying} className="px-5 py-2 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-1.5 disabled:opacity-50">
              {verifying ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando...</> : 'Ativar 2FA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return { enabled, loading: loading || busy, toggle: enabled ? disable : start, modal }
}
