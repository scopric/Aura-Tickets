import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from './useAuth'
import { useCreateEvent, type DbEvent } from './useEvents'
import { duplicarEvento, resumoDuplicacao } from '../lib/eventoProdutor'

// Duplicar o evento do produtor (Meus eventos, Pasta do evento, começo rápido): copia, avisa o que foi e o que não foi
// e abre o painel do evento novo. A confirmação fica com a tela (cada uma pergunta do seu jeito).
export function useDuplicarEvento() {
  const { user } = useAuth()
  const criar = useCreateEvent()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [duplicando, setDuplicando] = useState(false)
  const emCurso = useRef(false) // o estado só vale no próximo render: o ref impede o duplo clique

  const duplicar = async (original: DbEvent) => {
    if (emCurso.current || !user?.id) return
    emCurso.current = true
    setDuplicando(true)
    try {
      const r = await duplicarEvento(original, criar.mutateAsync, user.id)
      // depois dos ingressos: o useCreateEvent já invalidou na criação do evento, antes de eles existirem, e a lista
      // buscada nesse intervalo ficaria sem os ingressos (e a cópia da cópia sairia sem ingressos e sem aviso)
      queryClient.invalidateQueries({ queryKey: ['producer-events'] })
      if (r.avisos.length) toast.warning(resumoDuplicacao(r), { duration: 10000 })
      else toast.success(resumoDuplicacao(r), { duration: 8000 })
      navigate(`/producer/events/${r.id}/edit`)
    } catch (err) {
      console.error('[duplicar] evento', err)
      toast.error('Não foi possível duplicar o evento. Confira a internet e tente de novo.')
    } finally {
      emCurso.current = false
      setDuplicando(false)
    }
  }
  return { duplicar, duplicando }
}
