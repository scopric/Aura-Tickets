import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, MailX, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

// O descadastro só acontece no clique: robôs de segurança de e-mail abrem os links sozinhos,
// e um descadastro no simples carregamento da página tiraria da lista quem não pediu.
export default function NewsletterUnsubscribe() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'feito' | 'erro'>('inicial')
  const [erro, setErro] = useState('')

  const confirmar = async () => {
    setEstado('enviando')
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { emailType: 'unsubscribe', unsubscribeToken: token },
      })
      if (error || data?.error) {
        // FunctionsHttpError guarda a resposta da função em error.context; erro de rede não
        const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } } | null)?.context
        const msg = data?.error || (typeof ctx?.json === 'function' ? await ctx.json().then(b => b?.error).catch(() => undefined) : undefined)
        throw new Error(msg || 'Não foi possível concluir o descadastro.')
      }
      setEstado('feito')
    } catch (e) {
      setErro((e as Error).message + ' Tente de novo em instantes.')
      setEstado('erro')
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center p-8 rounded-2xl bg-white/70 border border-espresso/10">
        {estado === 'feito' ? (
          <div role="status">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-4" aria-hidden="true" />
            <h1 className="font-serif text-2xl text-espresso mb-2">Descadastro concluído</h1>
            <p className="text-sm text-espresso/70">Você não vai mais receber a newsletter da Evokaa.</p>
          </div>
        ) : !token ? (
          <>
            <MailX className="w-10 h-10 text-espresso/40 mx-auto mb-4" aria-hidden="true" />
            <h1 className="font-serif text-2xl text-espresso mb-2">Link incompleto</h1>
            <p className="text-sm text-espresso/70">Abra o link "Descadastrar-se" direto do e-mail que você recebeu.</p>
          </>
        ) : (
          <>
            <MailX className="w-10 h-10 text-plum mx-auto mb-4" aria-hidden="true" />
            <h1 className="font-serif text-2xl text-espresso mb-2">Sair da newsletter</h1>
            <p className="text-sm text-espresso/70 mb-6">Confirme para parar de receber os e-mails de novidades da Evokaa.</p>
            {estado === 'erro' && (
              <p role="alert" className="mb-4 text-sm text-red-700">{erro}</p>
            )}
            <button
              type="button"
              onClick={confirmar}
              disabled={estado === 'enviando'}
              className="w-full py-3 rounded-full bg-plum text-cream text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {estado === 'enviando' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Confirmar descadastro
            </button>
          </>
        )}
      </div>
    </div>
  )
}
