import { forwardRef, type ForwardRefExoticComponent, type RefAttributes, type SVGProps } from 'react'

// Família Evokaa 16 (fase V3b): viewBox 16, traço fixo 1,5 com pontas e junções redondas.
// Camadas: tint (silhueta do estado ativo), half (secundária a 45%), stroke (traço), solid (acento).
export interface IconeProps extends Omit<SVGProps<SVGSVGElement>, 'ref' | 'children'> {
  size?: number | string
  /** Liga a camada tint (silhueta suave do estado ativo). Sem ele, o pai acende com `--ek-tint` (ex.: `.ativo { --ek-tint: .28 }`). */
  ativo?: boolean
}

export type IconeEvokaa = ForwardRefExoticComponent<IconeProps & RefAttributes<SVGSVGElement>>

export interface Camadas {
  tint?: string
  stroke?: string
  solid?: string
  half?: string
}

export const criar = (nome: string, { tint, stroke, solid, half }: Camadas): IconeEvokaa => {
  const Icone = forwardRef<SVGSVGElement, IconeProps>(function Icone(
    // strokeWidth é descartado de propósito: o traço da família é fixo.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { size = 24, ativo = false, strokeWidth, ...resto },
    ref,
  ) {
    const rotulado = !!(resto['aria-label'] || resto['aria-labelledby'])
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        {...(rotulado ? { role: 'img' } : { 'aria-hidden': true })}
        {...resto}
      >
        {tint && (
          <path d={tint} fill="currentColor" stroke="none" data-camada="tint" style={{ fillOpacity: ativo ? 0.28 : 'var(--ek-tint, 0)' }} />
        )}
        {half && <path d={half} fill="currentColor" stroke="none" opacity={0.45} />}
        {stroke && <path d={stroke} />}
        {solid && <path d={solid} fill="currentColor" stroke="none" />}
      </svg>
    )
  })
  Icone.displayName = nome
  return Icone
}
