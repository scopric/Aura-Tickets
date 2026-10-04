import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { alertaErro } from '@/components/admin/ui'
import { supabase } from '../lib/supabase'

// Reautenticação recente para dinheiro (S9, Decisão 163 item 12): o banco recusa saque, comissão, taxa e Pix quando o código
// do aplicativo não foi digitado nos últimos 5 minutos (42501 com hint 'reautenticar', docs/sql/20261019_admin_s9_reautenticar.sql).
// `reautenticar(acao)` roda a ação; se vier esse erro, abre a janela do código (challenge + verify do fator TOTP da conta) e
// repete a ação UMA vez. Outro erro passa direto; cancelar devolve o erro original. A tela coloca `modal` no fim do JSX.
// A ação devolve o resultado do supabase-js ({ data, error }) ou lança: os dois jeitos valem.
type Erro = { code?: string; hint?: string } | null | undefined

const pedeCodigo = (e: Erro) => e?.code === '42501' && e?.hint === 'reautenticar'

export function useReautenticar() {
  const [aberto, setAberto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [verificando, setVerificando] = useState(false)
  const resposta = useRef<((ok: boolean) => void) | null>(null)
  const esperando = useRef<Promise<boolean> | null>(null) // duas ações juntas dividem a mesma janela

  // Sair da tela com a janela aberta: quem espera o código recebe "não"
  useEffect(() => () => { resposta.current?.(false) }, [])

  const fechar = (ok: boolean) => {
    setAberto(false)
    resposta.current?.(ok)
    resposta.current = null
    esperando.current = null
  }

  const pedir = useCallback(() => {
    esperando.current ??= new Promise<boolean>((resolve) => {
      resposta.current = resolve
      setCodigo('')
      setErro('')
      setAberto(true)
    })
    return esperando.current
  }, [])

  const reautenticar = useCallback(async <T,>(acao: () => PromiseLike<T>): Promise<T> => {
    let primeiro: T
    try {
      primeiro = await acao()
    } catch (e) {
      if (!pedeCodigo(e as Erro)) throw e
      return (await pedir()) ? acao() : Promise.reject(e)
    }
    if (!pedeCodigo((primeiro as { error?: Erro } | null)?.error)) return primeiro
    return (await pedir()) ? acao() : primeiro
  }, [pedir])

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // o submit sobe pela árvore do React (portal): não pode disparar o <form> da tela que abriu a janela
    if (verificando) return
    if (codigo.length !== 6) { setErro('Digite o código de 6 dígitos do aplicativo.'); return }
    setErro('')
    setVerificando(true)
    try {
      const { data, error: listaErro } = await supabase.auth.mfa.listFactors()
      if (listaErro) throw listaErro
      const fator = data.totp[0] // listFactors só devolve em `totp` os confirmados
      if (!fator) { setErro('Esta conta não tem a verificação em duas etapas ativa.'); return }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo })
      if (error) throw error
      fechar(true)
    } catch (err) {
      console.error('[reautenticar] Erro ao confirmar o código:', err)
      setErro('Código inválido ou expirado. Confira o aplicativo e tente de novo.')
    } finally {
      setVerificando(false)
    }
  }

  const modal = (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v && !verificando) fechar(false) }}>
      <DialogContent>
        <form onSubmit={confirmar} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Confirme com o código do aplicativo</DialogTitle>
            <DialogDescription>
              Esta ação mexe com dinheiro. Digite o código de 6 dígitos do seu aplicativo autenticador para continuar.
            </DialogDescription>
          </DialogHeader>
          {erro && <div role="alert" className={alertaErro}>{erro}</div>}
          <div>
            <label htmlFor="reauth-codigo" className="mb-1.5 block text-xs font-medium">Código de verificação</label>
            <Input
              id="reauth-codigo"
              autoFocus
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              disabled={verificando}
              className="text-center font-mono text-lg tracking-widest"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={verificando} onClick={() => fechar(false)}>Cancelar</Button>
            <Button type="submit" loading={verificando}>Confirmar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return { reautenticar, modal }
}
