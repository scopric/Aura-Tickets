import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'

/**
 * Arrastar cartões entre colunas (CRM e Quadro): mouse/toque pelo arrastar do navegador e teclado no cartão
 * (Espaço pega, setas esquerda/direita escolhem a coluna, Espaço solta, Esc cancela). `aviso` é para uma região
 * aria-live. O teclado só age com o foco no próprio cartão, para não tomar o Espaço/Enter dos botões de dentro.
 */
export function useArrastar(colunas: string[], onSoltar: (cartao: string, coluna: string) => void, nomeDaColuna: (id: string) => string) {
  const [pegado, setPegado] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  // solto pelo teclado, o cartão remonta na outra coluna e perderia o foco: o ref devolve o foco a ele
  const focar = useRef<string | null>(null)

  const largar = () => { setPegado(null); setAlvo(null) }
  const soltar = (coluna: string) => { if (pegado) onSoltar(pegado, coluna); largar() }

  const propsColuna = (id: string) => ({
    onDragOver: (e: DragEvent) => { e.preventDefault(); setAlvo(id) },
    onDragLeave: () => setAlvo(null),
    onDrop: () => soltar(id),
  })

  const propsCartao = (id: string, colunaAtual: string) => ({
    draggable: true,
    tabIndex: 0,
    ref: (el: HTMLElement | null) => { if (el && focar.current === id) { focar.current = null; el.focus() } },
    onDragStart: () => setPegado(id),
    onDragEnd: largar, // soltou fora de uma coluna: nada fica pego
    onKeyDown: (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return
      if (e.key === ' ' && pegado !== id) {
        e.preventDefault(); setPegado(id); setAlvo(colunaAtual)
        setAviso(`Cartão pego. Use as setas para escolher a coluna, Espaço para soltar, Esc para cancelar. Coluna atual: ${nomeDaColuna(colunaAtual)}.`)
      } else if (pegado === id && e.key === ' ') {
        e.preventDefault(); const destino = alvo ?? colunaAtual
        focar.current = id; soltar(destino); setAviso(destino === colunaAtual ? 'Cartão solto na mesma coluna.' : `Cartão solto em ${nomeDaColuna(destino)}.`)
      } else if (pegado === id && e.key === 'Escape') {
        e.preventDefault(); largar(); setAviso('Movimento cancelado.')
      } else if (pegado === id && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        const i = colunas.indexOf(alvo ?? colunaAtual)
        const novo = colunas[Math.min(colunas.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))]
        setAlvo(novo); setAviso(`Coluna ${nomeDaColuna(novo)}.`)
      }
    },
  })

  return { pegado, alvo, aviso, propsColuna, propsCartao }
}
