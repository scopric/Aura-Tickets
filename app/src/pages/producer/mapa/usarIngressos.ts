import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabase'
import { tetoPorPedido } from '@/lib/lotacao'

export type Ingresso = { id: string; name: string; price: number; max: number } // max = máximo por pedido (o do ingresso ou 10, como o checkout)

// Ingressos do evento para ligar a um lote (só leitura; mesma consulta do editor antigo): coletiva não tem lugar marcado, inativo não vende
export function useIngressos(eventId: string | null) {
  const [tipos, setTipos] = useState<Ingresso[]>([])
  const [carregados, setCarregados] = useState(false) // falso enquanto carrega e se a leitura falhar
  useEffect(() => {
    setTipos([])
    setCarregados(false)
    if (!eventId) return
    let cancelado = false
    supabase
      .from('ticket_types')
      .select('id, name, price, type, is_active, max_per_order')
      .eq('event_id', eventId)
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) { toast.error(`Não consegui carregar os ingressos do evento: ${error.message}`); return }
        const lidos = (data || []) as unknown as { id: string; name: string; price: number; type: string; is_active: boolean; max_per_order: number | null }[] // ticket_types não está nos tipos gerados
        setCarregados(true)
        setTipos(lidos.filter(t => t.type !== 'coletiva' && t.is_active).map(t => ({ id: t.id, name: t.name, price: t.price, max: tetoPorPedido(t) })))
      })
    return () => { cancelado = true }
  }, [eventId])
  return { tipos, carregados }
}
