import { useEffect, useState } from 'react'
import { gravarNav, lerFixados } from '../lib/navegacaoProdutor'

const AVISO = 'evk:fixados'

/** Eventos fixados na lateral (evk.nav.fixados). A lateral e a Visão geral usam a mesma lista e se avisam por evento da janela. */
export function useFixados() {
  const [fixados, setFixados] = useState(lerFixados)
  useEffect(() => {
    const muda = (e: Event) => setFixados((e as CustomEvent<string[]>).detail)
    const outraAba = (e: StorageEvent) => { if (e.key === null || e.key === 'evk.nav.fixados') setFixados(lerFixados()) }
    window.addEventListener(AVISO, muda)
    window.addEventListener('storage', outraAba) // outra aba mexeu na lista
    return () => { window.removeEventListener(AVISO, muda); window.removeEventListener('storage', outraAba) }
  }, [])
  const alternar = (id: string) => {
    const novos = fixados.includes(id) ? fixados.filter(f => f !== id) : [id, ...fixados]
    gravarNav('fixados', JSON.stringify(novos))
    window.dispatchEvent(new CustomEvent(AVISO, { detail: novos })) // atualiza também este componente
  }
  return [fixados, alternar] as const
}
