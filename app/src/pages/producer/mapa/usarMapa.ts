import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabase'
import { normalizarEnvs, novosPavimentos, type Environment } from './modelo'

// ponytail: copia a lógica de carregar/salvar do SeatingMap antigo (mesma tabela, mesmo JSON) em vez de extraí-la
// de um arquivo de 4,9 mil linhas em produção; unificar quando o editor antigo for aposentado.
// config.zoom/pan/background são regravados como foram lidos: este editor não mexe na planta de fundo.
type Config = { zoom?: unknown; pan?: unknown; background?: unknown }

export function usarMapa(eventId: string | null) {
  const [envs, setEnvs] = useState<Environment[]>(novosPavimentos)
  const [pronto, setPronto] = useState(false)
  const [erroMapa, setErroMapa] = useState(false)
  const [salvo, setSalvo] = useState<string | null>(null)
  const config = useRef<Config>({})
  const eventIdRef = useRef(eventId)
  eventIdRef.current = eventId

  useEffect(() => {
    let cancelado = false
    const iniciais = novosPavimentos()
    setPronto(false)
    setErroMapa(false)
    setSalvo(null)
    setEnvs(iniciais)
    config.current = {}
    if (!eventId) return
    ;(async () => {
      const { data: mapa, error } = await supabase.from('seating_maps').select('*').eq('event_id', eventId).maybeSingle()
      const data: any = mapa // a tabela não está nos tipos gerados
      if (cancelado) return
      // Com erro de leitura o mapa não fica pronto: Salvar fica travado para não gravar um mapa vazio por cima do real
      if (error) {
        setErroMapa(true)
        toast.error(`Erro ao carregar mapa: ${error.message}`)
        return
      }
      if (data?.environments && Array.isArray(data.environments)) {
        const lidos = normalizarEnvs(data.environments as Environment[])
        if (data.config && typeof data.config === 'object') config.current = data.config as Config
        setEnvs(lidos)
        setSalvo(JSON.stringify(lidos))
      } else {
        setSalvo(JSON.stringify(iniciais))
      }
      setPronto(true)
    })()
    return () => { cancelado = true }
  }, [eventId])

  const sujo = useMemo(() => pronto && salvo !== null && JSON.stringify(envs) !== salvo, [pronto, salvo, envs])

  const salvar = async (ativo: number) => {
    if (!eventId || !pronto) {
      toast.error('Escolha um evento e espere o mapa carregar antes de salvar.')
      return
    }
    const evento = eventId
    const c = config.current
    const { error } = await supabase
      .from('seating_maps')
      .upsert({
        event_id: eventId,
        name: envs[ativo]?.name || 'Principal',
        config: { zoom: c.zoom, pan: c.pan, background: c.background ?? null },
        environments: envs,
      }, { onConflict: 'event_id' })
    if (error) {
      toast.error(`Não foi possível salvar o mapa: ${error.message}`, { duration: 6500 })
    } else {
      // Se trocou de evento durante o salvamento, o "salvo" já é de outro mapa: não mexe nele
      if (evento === eventIdRef.current) setSalvo(JSON.stringify(envs))
      toast.success('Mapa de assentos salvo!')
    }
  }

  return { envs, setEnvs, pronto, erroMapa, sujo, salvar }
}
