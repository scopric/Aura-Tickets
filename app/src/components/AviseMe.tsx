import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '../hooks/useAuth'
import { useInteresse } from '../hooks/useInteresse'
import { CONSENTIMENTO_TEXTO } from '../lib/interesse'
import { appUrl, getAppMode } from '../lib/appHost'

// "Avise-me quando abrir" na página do evento com venda futura. Só visitante e participante (papel `user`).
// Visitante: leva ao login e volta para o evento; o consentimento é dado depois, com a pessoa já logada.
export default function AviseMe({ eventId }: { eventId: string }) {
  const { isAuthenticated, isLoading } = useAuth()
  const { userId, inscrito, entrar, sair } = useInteresse(eventId)
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [aceito, setAceito] = useState(false)

  if (isAuthenticated && (isLoading || !userId)) return null

  const login = () => {
    const caminho = `/auth/login?volta=${encodeURIComponent(`/event/${eventId}`)}`
    if (getAppMode() === 'app') navigate(caminho)
    else window.location.assign(appUrl(caminho))
  }

  if (isAuthenticated && inscrito) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-ev-xl border border-border p-3">
        <p className="min-w-0 flex-1 text-sm leading-5">Você será avisado quando as vendas abrirem.</p>
        <Button type="button" variant="outline" size="sm" loading={sair.isPending} onClick={() => sair.mutate()}>Remover aviso</Button>
      </div>
    )
  }

  return (
    <>
      <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => (isAuthenticated ? setAberto(true) : login())}>
        Avise-me quando abrir
      </Button>
      <Dialog open={aberto} onOpenChange={(o) => { setAberto(o); if (!o) setAceito(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Avise-me quando abrir</DialogTitle>
            <DialogDescription>Você recebe um aviso no aplicativo e por e-mail no momento em que as vendas abrirem.</DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-3 text-sm leading-5">
            <Checkbox checked={aceito} onCheckedChange={(v) => setAceito(v === true)} className="mt-0.5" />
            <span>
              {CONSENTIMENTO_TEXTO}{' '}
              <Link to="/privacidade" target="_blank" className="font-semibold text-primary underline underline-offset-4">Política de Privacidade</Link>.
            </span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button disabled={!aceito} loading={entrar.isPending} onClick={() => entrar.mutate(undefined, { onSuccess: () => setAberto(false) })}>
              Quero ser avisado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
