// Bipe curto dos avisos do quadro (Web Audio). Nunca em laço: um toque por chamada, de até ~0,4 s.
// O navegador só libera o som depois de um gesto da pessoa; por isso o contexto nasce no primeiro clique ou tecla.
const TONS: Record<string, [number, number][]> = {
  atribuicao: [[880, 0.09], [1175, 0.12]],
  mencao: [[660, 0.08], [990, 0.08], [1320, 0.14]],
  mensagem: [[740, 0.07], [988, 0.1]],
  prazo: [[520, 0.12], [0, 0.05], [520, 0.12]],
  movido: [[600, 0.1]],
  automacao: [[440, 0.09], [660, 0.12]],
}

let ctx: AudioContext | null = null
let armado = false

function criar() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return }
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!C) return
  try { ctx = new C() } catch { ctx = null }
}

/** Liga a espera pelo primeiro gesto (uma vez só) */
export function armarAudio() {
  if (armado || typeof window === 'undefined') return
  armado = true
  const solta = () => { criar(); window.removeEventListener('pointerdown', solta); window.removeEventListener('keydown', solta) }
  window.addEventListener('pointerdown', solta)
  window.addEventListener('keydown', solta)
}

/** Toca o tom do tipo. Devolve false (sem som) se a pessoa ainda não interagiu com a página ou a aba está oculta */
export function bipar(tipo: string): boolean {
  if (!ctx || document.hidden) return false
  try {
    if (ctx.state === 'suspended') void ctx.resume()
    let t = ctx.currentTime
    for (const [freq, dur] of TONS[tipo] ?? TONS.mensagem) {
      if (freq) {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'sine'; o.frequency.value = freq
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.25, t + 0.012)
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        o.connect(g); g.connect(ctx.destination)
        o.start(t); o.stop(t + dur + 0.03)
      }
      t += dur + 0.035
    }
    return true
  } catch { return false }
}

/** Só para teste: esquece o contexto */
export function _zerarAudio() { ctx = null; armado = false }
