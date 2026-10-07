import type { CSSProperties, ReactNode } from 'react'
import type { Familia } from './referencias'

// Ilustração plana 2D (traço de 1,6 px, sem 3D). Anima só dentro de .mapa-cartao:hover/foco/ativo ou de .mapa-viva (ver index.css).
// Cada peça móvel leva uma classe i-* e um atraso --d.
const dl = (s: number) => ({ '--d': `${s}s` }) as CSSProperties
const FORMAS: Record<Familia, ReactNode> = {
  onda: <><rect x="4" y="17" width="9" height="14" rx="2" /><path d="M13 20l6-5v18l-6-5" />
    {[0, 1, 2].map(n => <path key={n} className="i-pisca" style={dl(n * 0.3)} d={`M${24 + n * 6} ${19 - n * 2}q${4 + n * 1} ${5 + n * 2} 0 ${10 + n * 4}`} fill="none" />)}</>,
  mesa: <>{[0, 1, 2].map(n => <g key={n}><line x1={12 + n * 12} y1="8" x2={12 + n * 12} y2="40" /><rect className="i-fader" style={dl(n * 0.5)} x={8 + n * 12} y="20" width="8" height="5" rx="1.5" /></g>)}</>,
  luz: <><path d="M18 8h12l3 6H15z" /><path className="i-pisca" d="M15 18l-6 22h30l-6-22z" fill="currentColor" fillOpacity="0.25" stroke="none" />{[0, 1, 2].map(n => <line key={n} className="i-pisca" style={dl(n * 0.4)} x1={19 + n * 5} y1="19" x2={14 + n * 10} y2="38" />)}</>,
  amp: <><rect x="8" y="8" width="32" height="32" rx="3" /><circle cx="15" cy="14" r="1.5" /><circle cx="22" cy="14" r="1.5" /><circle className="i-pulsa" cx="24" cy="29" r="7" /><circle cx="24" cy="29" r="2" /></>,
  energia: <><path className="i-pulsa" d="M27 5L12 27h10l-3 16 17-24H26z" fill="currentColor" fillOpacity="0.25" /></>,
  fluxo: <><line x1="6" y1="38" x2="42" y2="38" /><path d="M36 33l6 5-6 5" fill="none" />{[0, 1, 2].map(n => <g key={n} className="i-desliza" style={dl(n * 0.35)}><circle cx={10 + n * 12} cy="16" r="3.2" /><path d={`M${10 + n * 12} 20v10`} /></g>)}</>,
  cruz: <><path className="i-pulsa" d="M19 7h10v12h12v10H29v12H19V29H7V19h12z" fill="currentColor" fillOpacity="0.25" /></>,
  gota: <><path className="i-cai" d="M24 6c7 9 10 14 10 19a10 10 0 01-20 0c0-5 3-10 10-19z" fill="currentColor" fillOpacity="0.25" /><path className="i-pisca" style={dl(0.4)} d="M6 43q9-4 18 0t18 0" fill="none" /></>,
  vapor: <><path d="M10 26h28l-3 14H13z" />{[0, 1, 2].map(n => <path key={n} className="i-sobe" style={dl(n * 0.5)} d={`M${17 + n * 7} 22q-3-4 0-8t0-8`} fill="none" />)}</>,
  carga: <><rect className="i-desliza" x="6" y="14" width="16" height="14" rx="2" /><line x1="6" y1="38" x2="42" y2="38" /><path d="M36 33l6 5-6 5" fill="none" /></>,
  sombra: <><path d="M6 24L24 8l18 16z" fill="currentColor" fillOpacity="0.2" /><line x1="10" y1="24" x2="10" y2="38" /><line x1="38" y1="24" x2="38" y2="38" /><ellipse className="i-balanca" cx="24" cy="41" rx="14" ry="2.5" fill="currentColor" fillOpacity="0.3" stroke="none" /></>,
  lugar: <><rect x="14" y="8" width="20" height="14" rx="3" /><rect x="12" y="24" width="24" height="9" rx="3" /><line x1="16" y1="33" x2="16" y2="41" /><line x1="32" y1="33" x2="32" y2="41" /><circle className="i-cai" cx="24" cy="4" r="3" fill="currentColor" fillOpacity="0.3" /></>,
  pisca: <><path d="M6 36h36" />{[0, 1, 2].map(n => <g key={n}><circle className="i-pisca" style={dl(n * 0.4)} cx={12 + n * 12} cy="12" r="3.5" fill="currentColor" fillOpacity="0.4" /><path className="i-pisca" style={dl(n * 0.4)} d={`M${12 + n * 12} 17v14`} /></g>)}</>,
}

export default function Ilustracao({ familia, cor, tamanho, className = '' }: { familia: Familia; cor: string; tamanho: number; className?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 48 48" aria-hidden className={`mapa-ilu ${className}`} style={{ '--c': cor } as CSSProperties}>{FORMAS[familia]}</svg>
  )
}
