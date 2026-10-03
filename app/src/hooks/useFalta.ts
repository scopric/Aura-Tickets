import { useEffect, useState } from 'react'
import { diasAte, formatarFalta, inicioDoEvento, leituraFalta } from '../lib/ingresso'

// Contagem regressiva até o início, só no dia do evento e antes da hora (data + hora reais). Atualiza a cada segundo;
// com "reduzir movimento" só a cada minuto e sem os segundos. Fora disso `falta` é null e não há relógio nenhum.
export function useFalta(data?: string | null, hora?: string | null): { falta: { texto: string; leitura: string } | null; comecou: boolean } {
  const [agora, setAgora] = useState(() => Date.now())
  const inicio = inicioDoEvento(data, hora)
  const falta = inicio ? inicio.getTime() - agora : null
  const ativa = falta !== null && falta > 0 && diasAte(data, undefined) === 0
  const porMinuto = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!ativa) return
    const id = setInterval(() => setAgora(Date.now()), porMinuto ? 60_000 : 1000)
    return () => clearInterval(id)
  }, [ativa, porMinuto])

  return {
    falta: ativa && falta !== null ? { texto: formatarFalta(falta, porMinuto), leitura: leituraFalta(falta) } : null,
    comecou: falta !== null && falta <= 0, // "agora" é o da abertura da tela e anda a cada tick enquanto a contagem está ativa
  }
}
