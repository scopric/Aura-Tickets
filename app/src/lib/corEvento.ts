// Cor do evento (contrato v3.4, 2.2 e 2.8). Salva em events.accent_color (#rrggbb), sugerida pela foto no envio da
// capa e editável pela produtora. Aqui ficam as contas: cor viva da foto, sorteio estável, derivados com contraste
// AA nos dois temas e os pequenos ajudantes do cartaz. Sem dependência.

const COR_PADRAO = '#1d68c4' // --brand
const TINTA = '#0b0d12' // --bg escuro e --fg claro
const BG = { claro: '#ffffff', escuro: '#0b0d12' }
const SURFACE = { claro: '#ffffff', escuro: '#14171d' }
// Cores das pranchas (vinho, verde-petróleo, mostarda, azul da marca, ferrugem), para o evento sem cor salva
const SORTEIO = ['#a55c65', '#1f7a74', '#d9a521', COR_PADRAO, '#b5482e']
// Decisão 142: a luz do duotone sem texto é a do participante; para as outras cores, 45% de branco (como nas pranchas)
const LUZ_DUO: Record<string, string> = { '#a55c65': '#eaa2aa' }
export const FOTO_PADRAO = '/images/hero-bg.jpg' // conta como "sem foto" (V6a)

export const ehHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const hex = (c: number[]) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

// WCAG 2.x
const luminancia = (h: string) => {
  const [r, g, b] = rgb(h).map(v => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// Mistura em sRGB: t = quanto de b entra
const mistura = (a: string, b: string, t: number) => {
  const [p, q] = [rgb(a), rgb(b)]
  return hex(p.map((v, i) => v * (1 - t) + q[i] * t))
}

// color-mix(in oklab, cor p%, base): a mesma conta do CSS, para conferir o contraste antes de gravar
const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const gama = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)
function oklab(h: string): number[] {
  const [r, g, b] = rgb(h).map(lin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}
export function misturaOklab(cor: string, base: string, p: number): string {
  const [A, B] = [oklab(cor), oklab(base)]
  const [L, a, b] = A.map((v, i) => v * p + B[i] * (1 - p))
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return hex([gama(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), gama(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), gama(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)])
}

// Texto na cor do evento: escurece (claro) ou clareia (escuro) a cor até dar 4,5:1 em TODAS as superfícies onde ele fica.
// A cor crua nunca vira texto pequeno (2.2).
function textoAte(cor: string, rumo: string, contra: string[]): string {
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = mistura(cor, rumo, Math.min(t, 1))
    if (contra.every(f => contraste(c, f) >= 4.5)) return c
  }
  return rumo
}

// Cores do evento nos dois temas (claro/escuro), tinta do cartaz e luz/sombra do duotone. duoLuzTexto: com texto branco
// por cima, o pixel mais claro ainda dá >= 4,6:1.
export function derivarCor(entrada: string) {
  const cor = ehHex(entrada) ? entrada.toLowerCase() : COR_PADRAO
  const fundoClaro = misturaOklab(cor, '#ffffff', 0.14)
  // fundo escuro: 55% da cor; se a cor for clara demais para o branco passar (4,5:1), a parte da cor diminui
  let p = 0.55
  let fundoEscuro = misturaOklab(cor, TINTA, p)
  while (contraste('#ffffff', fundoEscuro) < 4.5 && p > 0.05) fundoEscuro = misturaOklab(cor, TINTA, (p -= 0.05))
  let duoLuzTexto = cor
  for (let t = 0; contraste(duoLuzTexto, '#ffffff') < 4.6 && t < 1; ) duoLuzTexto = mistura(cor, TINTA, (t += 0.05))
  return {
    cor,
    claro: {
      fundo: fundoClaro,
      texto: textoAte(cor, TINTA, [fundoClaro, BG.claro, SURFACE.claro]),
      grafico: contraste(cor, SURFACE.claro) >= 3 ? cor : COR_PADRAO,
    },
    escuro: {
      fundo: fundoEscuro,
      texto: textoAte(cor, '#ffffff', [fundoEscuro, BG.escuro, SURFACE.escuro]),
      grafico: contraste(cor, SURFACE.escuro) >= 3 ? cor : COR_PADRAO,
    },
    tinta: contraste(cor, '#ffffff') >= contraste(cor, TINTA) ? '#ffffff' : TINTA,
    duoSombra: mistura(cor, TINTA, 0.8),
    duoLuz: LUZ_DUO[cor] ?? mistura(cor, '#ffffff', 0.45),
    duoLuzTexto,
  }
}

// Variáveis CSS do evento. Os pares -c (claro) e -e (escuro) viram --evento-fundo/-texto/-grafico pela classe
// .evento-cor (EventoCapa.css), que escolhe pelo .dark. Quem pinta com a cor do evento usa
// <div className="evento-cor" style={varsDoEvento(cor)}>.
export function varsDoEvento(entrada: string, comTexto = false): Record<string, string> {
  const d = derivarCor(entrada)
  return {
    '--evento': d.cor,
    '--evento-fundo-c': d.claro.fundo, '--evento-fundo-e': d.escuro.fundo,
    '--evento-texto-c': d.claro.texto, '--evento-texto-e': d.escuro.texto,
    '--evento-grafico-c': d.claro.grafico, '--evento-grafico-e': d.escuro.grafico,
    '--cz': d.cor, '--cz-tinta': d.tinta,
    '--duo-sombra': d.duoSombra, '--duo-luz': comTexto ? d.duoLuzTexto : d.duoLuz,
  }
}

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }

// Sorteio estável: o mesmo id (ou texto) dá sempre a mesma cor
export const corSorteada = (semente: string) => SORTEIO[hash(semente) % SORTEIO.length]

// Cor do pixel mais saturado (peso para luminosidade média) numa imagem 24x24 (RGBA); null se a foto é cinza demais.
// Testado em 03/10/2026 na foto concert-1.jpg: a média dá rgb(57 32 38), barrenta; esta dá rgb(165 92 101).
export function corVivaDePixels(d: Uint8ClampedArray | number[]): string | null {
  let melhor: string | null = null
  let nota = 20 // abaixo disso a foto não tem cor para tirar (preto e branco, cinza)
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]]
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    const s = (mx - mn) * (1 - Math.abs((mx + mn) / 2 - 128) / 128)
    if (s > nota) { nota = s; melhor = hex([r, g, b]) }
  }
  return melhor
}

// Cor dominante viva da foto (qualquer fonte de canvas, já em memória: sem CORS); sem foto ou foto cinza, sorteio estável.
export function corViva(fonte: CanvasImageSource | null, semente: string): string {
  if (fonte) {
    try {
      const n = 24
      const c = document.createElement('canvas')
      c.width = c.height = n
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(fonte, 0, 0, n, n)
        const viva = corVivaDePixels(ctx.getImageData(0, 0, n, n).data)
        if (viva) return viva
      }
    } catch { /* canvas sujo ou indisponível: cai no sorteio */ }
  }
  return corSorteada(semente)
}

// ---- Capa -----------------------------------------------------------------------------------------------------
// Foto real = URL do bucket (https), um arquivo local de prévia (blob:) ou caminho do site, menos a foto padrão.
export const temFoto = (url?: string | null): url is string =>
  !!url && url !== FOTO_PADRAO && /^(https:\/\/|blob:|\/(?!\/))/.test(url)

export const compDoCartaz = (id: string) => (['a', 'b', 'c'] as const)[hash(id) % 3]

// Nome em linhas curtas (palavra de até 3 letras gruda na seguinte) e o tamanho que cabe na largura (como nas pranchas)
export function linhasDoCartaz(titulo: string): { linhas: string[]; k: number } {
  const linhas: string[] = []
  for (const w of titulo.toUpperCase().split(/\s+/).filter(Boolean)) {
    const u = linhas[linhas.length - 1]
    if (u !== undefined && u.length <= 3) linhas[linhas.length - 1] = `${u} ${w}`
    else linhas.push(w)
  }
  if (!linhas.length) linhas.push('EVENTO')
  return { linhas, k: Math.min(24, 112 / Math.max(...linhas.map(l => l.length))) }
}

const MES3 = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
export function diaMesDoCartaz(data?: string | null): { dia: string; mes: string } | null {
  const m = data?.match(/^\d{4}-(\d{2})-(\d{2})/)
  return m && +m[1] >= 1 && +m[1] <= 12 ? { dia: String(+m[2]), mes: MES3[+m[1] - 1] } : null
}
