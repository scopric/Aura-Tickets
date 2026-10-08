import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../../lib/supabase'
import { lerFundo, normalizarEnvs, novosPavimentos, type Environment, type Fundo } from './modelo'

// ponytail: copia a lógica de carregar/salvar do SeatingMap antigo (mesma tabela, mesmo JSON) em vez de extraí-la
// de um arquivo de 4,9 mil linhas em produção; unificar quando o editor antigo for aposentado.
// config.zoom/pan são regravados como foram lidos. A planta de fundo (config.background) é estado daqui: sem mudança, volta igual.
type Config = { zoom?: unknown; pan?: unknown; background?: unknown }

export function useMapa(eventId: string | null) {
  const [envs, setEnvs] = useState<Environment[]>(novosPavimentos)
  const [pronto, setPronto] = useState(false)
  const [erroMapa, setErroMapa] = useState(false)
  const [fundo, setFundoEstado] = useState<Fundo | null>(null)
  const [visivel, setVisivel] = useState(false) // seating_maps.is_active: o comprador só vê o mapa se o produtor ligar; grava junto com Salvar
  const [salvo, setSalvo] = useState<{ e: string; f: Fundo | null; v: boolean } | null>(null) // pavimentos serializados + a planta por referência (não serializa o base64 a cada edição)
  const config = useRef<Config>({})
  const eventIdRef = useRef(eventId)
  eventIdRef.current = eventId

  useEffect(() => {
    let cancelado = false
    const iniciais = novosPavimentos()
    setPronto(false)
    setErroMapa(false)
    setSalvo(null)
    setVisivel(false)
    setEnvs(iniciais)
    setFundoEstado(null)
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
      if (Array.isArray(data?.environments) && data.environments.length) {
        const lidos = normalizarEnvs(data.environments as Environment[])
        if (data.config && typeof data.config === 'object') config.current = data.config as Config
        const f = lerFundo(config.current.background)
        const v = data.is_active === true
        setVisivel(v)
        setEnvs(lidos)
        setFundoEstado(f)
        setSalvo({ e: JSON.stringify(lidos), f, v })
      } else {
        setSalvo({ e: JSON.stringify(iniciais), f: null, v: false })
      }
      setPronto(true)
    })()
    return () => { cancelado = true }
  }, [eventId])

  // Tirar a planta também apaga a que veio do banco (mesmo a inválida, que o editor não exibe)
  const setFundo = (f: Fundo | null) => { if (!f) config.current = { ...config.current, background: null }; setFundoEstado(f) }
  const sujo = useMemo(() => pronto && salvo !== null && (fundo !== salvo.f || visivel !== salvo.v || JSON.stringify(envs) !== salvo.e), [pronto, salvo, envs, fundo, visivel])

  const salvar = async (ativo: number) => {
    if (!eventId || !pronto) {
      toast.error('Escolha um evento e espere o mapa carregar antes de salvar.')
      return
    }
    const evento = eventId
    const c = config.current
    const { error } = await (supabase as any) // a tabela não está nos tipos gerados
      .from('seating_maps')
      .upsert({
        event_id: eventId,
        name: envs[ativo]?.name || 'Principal',
        config: { zoom: c.zoom, pan: c.pan, background: fundo ?? c.background ?? null },
        environments: envs,
        is_active: visivel, // o valor lido (ou o que o produtor escolheu): salvar sem mexer no interruptor nunca desliga o mapa
      }, { onConflict: 'event_id' })
    if (error) {
      toast.error(`Não foi possível salvar o mapa: ${error.message}`, { duration: 6500 })
    } else {
      // Se trocou de evento durante o salvamento, o "salvo" já é de outro mapa: não mexe nele
      if (evento === eventIdRef.current) setSalvo({ e: JSON.stringify(envs), f: fundo, v: visivel })
      toast.success('Mapa de assentos salvo!')
    }
  }

  return { envs, setEnvs, fundo, setFundo, visivel, setVisivel, pronto, erroMapa, sujo, salvar }
}
