import { useEffect, useState } from 'react'

// Mantém a tela acesa enquanto `ativo` (Screen Wake Lock API; técnica do MDN, CC0). A web não controla o brilho:
// só dá para manter a tela ligada. Onde a API não existe, ou o aparelho recusa (bateria baixa), segue sem erro.
// Devolve true só enquanto a trava está valendo, para a tela não prometer o que não aconteceu.
export function useTelaAcesa(ativo: boolean): boolean {
  const [acesa, setAcesa] = useState(false)
  useEffect(() => {
    if (!ativo || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let trava: WakeLockSentinel | null = null
    let saiu = false
    const pedir = async () => {
      try {
        const nova = await navigator.wakeLock.request('screen')
        if (saiu) { nova.release().catch(() => {}); return } // saiu enquanto o pedido estava em andamento
        trava = nova
        nova.addEventListener('release', () => setAcesa(false)) // o navegador solta sozinho quando a aba some
        setAcesa(true)
      } catch { setAcesa(false) /* recusado: segue sem */ }
    }
    // ao voltar para a aba, pede de novo
    const aoVoltar = () => { if (document.visibilityState === 'visible') pedir() }
    pedir()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      saiu = true
      document.removeEventListener('visibilitychange', aoVoltar)
      trava?.release().catch(() => {})
    }
  }, [ativo])
  return acesa
}
