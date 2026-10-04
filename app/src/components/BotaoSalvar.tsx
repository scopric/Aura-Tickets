import { useNavigate } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { cn } from '@/lib/utils'
import { useAuth } from '../hooks/useAuth'
import { useFavoritos } from '../hooks/useFavoritos'
import { appUrl, getAppMode } from '../lib/appHost'

// Coração "Salvar evento" (VF). Só para visitante e participante (papel `user`): produtor e equipe não veem.
// Visitante: leva ao login no app.* e volta para a página do evento, onde o favorito é gravado (useSalvarPendente).
// Rótulo fixo; o estado vai em aria-pressed. Botão simples (não ui/button): o ghost põe fundo e cor que apagam o .vidro da capa.
export default function BotaoSalvar({ eventId, className }: { eventId: string; className?: string }) {
  const { isAuthenticated, isLoading } = useAuth()
  const { userId, salvo, definir } = useFavoritos()
  const navigate = useNavigate()

  // logado com papel ainda provisório (isLoading) também fica escondido: evita piscar o coração para o produtor
  if (isAuthenticated && (isLoading || !userId)) return null

  const marcado = isAuthenticated && salvo(eventId)
  const entrar = () => {
    const caminho = `/auth/login?volta=${encodeURIComponent(`/event/${eventId}`)}`
    if (getAppMode() === 'app') navigate(caminho)
    else window.location.assign(appUrl(caminho))
  }

  return (
    <button
      type="button"
      aria-pressed={marcado}
      aria-label="Salvar evento"
      onClick={() => (isAuthenticated ? definir(eventId, !marcado) : entrar())}
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full alvo-44',
        'transition-transform duration-micro active:scale-105 motion-reduce:active:scale-100',
        'focus-visible:outline-none focus-visible:shadow-ev-foco aria-pressed:[--ek-tint:1]',
        className,
      )}
    >
      <I.Salvar size={20} />
    </button>
  )
}
