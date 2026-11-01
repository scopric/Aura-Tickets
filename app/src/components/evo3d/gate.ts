// Decide se a cena 3D do Evo pode montar ou se fica no poster (regra do DESIGN-SYSTEM §8).
// Recebe o ambiente como argumento para o teste não depender de jsdom simular matchMedia.

type Ambiente = {
  matchMedia?: (q: string) => { matches: boolean }
  navigator?: { connection?: { saveData?: boolean }; deviceMemory?: number }
  window?: object
}

export type MotivoDoPoster = 'movimento-reduzido' | 'economia-de-dados' | 'pouca-memoria' | 'sem-webgl2'

export function motivoDoPoster(amb: Ambiente = ambienteDoNavegador()): MotivoDoPoster | null {
  if (amb.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'movimento-reduzido'
  if (amb.navigator?.connection?.saveData) return 'economia-de-dados'
  const mem = amb.navigator?.deviceMemory
  if (typeof mem === 'number' && mem < 4) return 'pouca-memoria'
  if (!amb.window || !('WebGL2RenderingContext' in amb.window)) return 'sem-webgl2'
  return null
}

function ambienteDoNavegador(): Ambiente {
  if (typeof window === 'undefined') return {}
  // deviceMemory e connection não estão nos tipos DOM; Safari não tem nenhum dos dois (aí a cena passa)
  return { matchMedia: window.matchMedia?.bind(window), navigator: navigator as Ambiente['navigator'], window }
}
