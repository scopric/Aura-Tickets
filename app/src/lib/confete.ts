// O único confete do produto (contrato M14): ~1,5 s. A biblioteca só é baixada aqui (fora do pacote de entrada) e,
// com "reduzir movimento" ligado, nem é baixada. Devolve o cancelamento (useEffect/StrictMode: a 1ª montagem não solta).
export function soltarConfete(colors: string[]) {
  let cancelado = false
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelado) return
      confetti({ particleCount: 70, spread: 75, startVelocity: 38, ticks: 110, origin: { y: 0.28 }, colors, disableForReducedMotion: true })
    }).catch(() => {})
  }
  return () => { cancelado = true }
}
