import { useState, type CSSProperties } from 'react'
import { compDoCartaz, corDoEvento, diaMesDoCartaz, ehHex, linhasDoCartaz, temFoto, varsDoEvento } from '../lib/corEvento'
import './EventoCapa.css'

// Capa do evento (contrato v3.4, 2.2; Decisão 173): foto original inteira (contain, sobra preenchida pela própria foto
// desfocada) ou, se o produtor ligou capa_na_cor, a foto em duotone na cor do evento; sem foto (vazio ou /images/hero-bg.jpg),
// cartaz tipográfico. Foto que não carrega cai no cartaz. Tamanhos: mini (40x50), mini-p (32), cartao (4:5) e faixa
// (preenche o cabeçalho; ver .evcapa-faixa). Nas miniaturas o nome fica fora (o texto ao lado já diz); o cartão é
// uma imagem com o nome no aria-label.
export interface EventoCapaDados {
  id: string
  title: string
  cover_image?: string | null
  image_url?: string | null
  accent_color?: string | null
  capa_na_cor?: boolean | null // true: duotone na cor do evento; senão, foto original
  date?: string | null
}

const TAMANHO = { mini: 'evcapa-mini', 'mini-p': 'evcapa-mini-p', cartao: 'evcapa-cartao', faixa: 'evcapa-faixa' } as const

export default function EventoCapa({ evento, tamanho = 'cartao', cor, className = '', prioridade = false }: {
  evento: EventoCapaDados
  tamanho?: keyof typeof TAMANHO
  cor?: string // sobrepõe a cor salva (prévia no formulário)
  className?: string
  prioridade?: boolean // capa do topo da página (a maior imagem da tela): carrega já, sem esperar (LCP)
}) {
  const url = [evento.cover_image, evento.image_url].find(temFoto)
  const [falhou, setFalhou] = useState<string>()
  const foto = url && url !== falhou ? url : undefined

  const corEv = cor && ehHex(cor) ? cor : corDoEvento(evento)
  const faixa = tamanho === 'faixa'
  const cartao = tamanho === 'cartao'
  const mini = tamanho === 'mini' || tamanho === 'mini-p'
  const comp = compDoCartaz(evento.id)
  const dm = diaMesDoCartaz(evento.date)
  const { linhas, k } = linhasDoCartaz(evento.title)
  const estilo = { ...varsDoEvento(corEv, faixa), '--cz-k': k.toFixed(2) } as CSSProperties
  const aria = cartao
    ? { role: 'img', 'aria-label': foto ? `Capa do evento ${evento.title}` : `Cartaz de ${evento.title}${dm ? `, ${dm.dia} de ${dm.mes.toLowerCase()}` : ''}` }
    : { 'aria-hidden': true as const }

  const img = foto && <img src={foto} alt="" loading={prioridade ? 'eager' : 'lazy'} fetchPriority={prioridade ? 'high' : undefined} decoding="async" onError={() => setFalhou(foto)} />

  return (
    <span className={`evcapa ${TAMANHO[tamanho]} ${className}`} style={estilo} {...aria}>
      {foto && evento.capa_na_cor === true ? (
        <span className="evcapa-duo">{img}</span>
      ) : foto ? (
        <span className="evcapa-orig">
          {/* fundo desfocado: a mesma URL (um só download), só enfeite; nas miniaturas basta o cover */}
          {!mini && <img className="evcapa-fundo" src={foto} alt="" aria-hidden="true" loading={prioridade ? 'eager' : 'lazy'} fetchPriority={prioridade ? 'high' : undefined} decoding="async" />}
          {img}
        </span>
      ) : (
        <span className={`evcapa-cz evcz-${comp}`}>
          {cartao && dm && (
            <span className="evcz-data"><span className="evcz-dia">{dm.dia}</span><span className="evcz-mes">{dm.mes}</span></span>
          )}
          {cartao && <span className="evcz-tit">{linhas.map((l, i) => <span key={i}>{l}</span>)}</span>}
          {faixa && dm && <span className="evcz-faixa-dia">{dm.dia}</span>}
        </span>
      )}
    </span>
  )
}
