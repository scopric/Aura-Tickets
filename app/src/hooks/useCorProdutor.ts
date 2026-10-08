import { useEffect } from 'react'

/** Cor de marca do painel do produtor (Decisão 223): marca o body enquanto o painel está aberto, para a cor chegar também às
 *  janelas e menus que o Radix abre fora da raiz. Usado pelo ProducerLayout e pelo editor de assentos (que fica fora dele). */
export function useCorProdutor() {
  useEffect(() => {
    document.body.classList.add('cor-produtor')
    return () => document.body.classList.remove('cor-produtor')
  }, [])
}
