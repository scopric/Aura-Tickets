import { useCallback, useEffect, useRef, useState } from 'react'

export type EstadoSalvar = 'ocioso' | 'salvando' | 'salvo' | 'erro'

/**
 * Salvamento automático do painel: ~800 ms depois da última mudança, uma gravação por vez. Mudou durante a gravação:
 * grava de novo ao terminar. Quem sabe o que mudou é o chamador (`temMudanca` e `gravar` leem o estado mais novo por ref,
 * porque o diff é contra o que já foi salvo); o gatilho é `mudou` (qualquer valor que muda quando o formulário muda).
 * Ao sair da tela ou esconder a aba, grava o que sobrou.
 */
export function useAutoSave({ ativo, mudou, temMudanca, gravar, esperaMs = 800 }: {
  ativo: boolean
  mudou: unknown
  temMudanca: () => boolean
  gravar: () => Promise<void>
  esperaMs?: number
}) {
  const [estado, setEstado] = useState<EstadoSalvar>('ocioso')
  const fn = useRef({ ativo, temMudanca, gravar })
  const gravando = useRef(false)
  const refazer = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const vivo = useRef(true)

  useEffect(() => { fn.current = { ativo, temMudanca, gravar } })

  const rodar = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current)
    if (gravando.current) { refazer.current = true; return }
    gravando.current = true
    try {
      do {
        refazer.current = false
        if (!fn.current.ativo || !fn.current.temMudanca()) break
        if (vivo.current) setEstado('salvando')
        try {
          await fn.current.gravar()
          if (vivo.current) setEstado('salvo')
        } catch (err) {
          console.error('[painel] salvamento automático falhou:', err instanceof Error ? err.message : err)
          if (vivo.current) setEstado('erro')
          break // depois de erro não insiste: a próxima mudança ou "Tentar de novo" grava
        }
      } while (refazer.current) // mudou durante a gravação: grava de novo
    } finally {
      gravando.current = false
    }
  }, [])

  useEffect(() => {
    if (!ativo) return
    timer.current = setTimeout(rodar, esperaMs)
    return () => clearTimeout(timer.current)
  }, [mudou, ativo, esperaMs, rodar])

  useEffect(() => {
    const esconde = () => { if (document.visibilityState === 'hidden') void rodar() }
    document.addEventListener('visibilitychange', esconde)
    return () => document.removeEventListener('visibilitychange', esconde)
  }, [rodar])

  useEffect(() => {
    vivo.current = true
    return () => { vivo.current = false; void rodar() } // sair da tela grava o que sobrou
  }, [rodar])

  return { estado, tentarDeNovo: rodar }
}
