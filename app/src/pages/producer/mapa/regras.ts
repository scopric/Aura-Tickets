import { defaultSections, normalizarEnvs, type Environment, type SeatNode } from './modelo'
import { caixaDosElementos, ORIGEM_SALA } from './geometria'
import { ESTRUTURA } from './paleta'

const vendido = (n: SeatNode) => n.sold > 0 || n.status === 'sold' || n.status === 'reserved'

// Próximo rótulo livre: maior número já usado com o mesmo prefixo + 1 ("Mesa 3" -> "Mesa 4"; base '' -> "7")
export function proximoRotulo(nos: Pick<SeatNode, 'label'>[], base: string): string {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s?(\\d+)$`)
  const max = nos.reduce((m, n) => Math.max(m, Number(re.exec(n.label)?.[1] ?? 0)), 0)
  return base ? `${base} ${max + 1}` : String(max + 1)
}

// Rótulo da cópia: troca o número final pelo próximo livre; sem número, só muda se o nó vende lugar
export function rotuloDaCopia(nos: Pick<SeatNode, 'label'>[], no: Pick<SeatNode, 'label' | 'capacity'>): string {
  const m = /^(.*?)\s*\d+$/.exec(no.label)
  if (m) return proximoRotulo(nos, m[1])
  return no.capacity > 0 ? proximoRotulo(nos, no.label) : no.label
}

// Apagar: vendido/reservado nunca; bloqueado só com confirmação
export function decidirApagar(no: Pick<SeatNode, 'sold' | 'status' | 'label'>): { acao: 'ok' | 'confirmar' | 'recusar'; msg?: string } {
  if (vendido(no as SeatNode)) return { acao: 'recusar', msg: `"${no.label}" tem venda ou reserva e não pode ser apagado.` }
  if (no.status !== 'free') return { acao: 'confirmar', msg: `"${no.label}" está bloqueado. Apagar mesmo assim?` }
  return { acao: 'ok' }
}

// Aplicar template: impedido se algum elemento tem venda ou reserva
export function decidirTemplate(nos: SeatNode[]): { permitido: boolean; vendidos: number; bloqueados: number } {
  return { permitido: !nos.some(vendido), vendidos: nos.filter(vendido).length, bloqueados: nos.filter(n => n.status === 'blocked').length }
}

const MARGEM = 0.5

// Traz tudo para dentro da sala com a mesma translação (posições relativas intactas).
// Se o conjunto não cabe, amplia a sala (metros inteiros). Com lugar vendido/reservado não mexe em nada.
// ponytail: só sala retangular (ignora roomRotation e L), como `limites`
export function encaixarNaSala(env: Environment): { env: Environment; motivo?: string } {
  const c = caixaDosElementos(env)
  if (!c) return { env }
  const W = env.roomWidth || 40, H = env.roomHeight || 40
  const e = 1e-6
  if (c.x >= ORIGEM_SALA - e && c.y >= ORIGEM_SALA - e && c.x + c.w <= ORIGEM_SALA + W + e && c.y + c.h <= ORIGEM_SALA + H + e) return { env }
  if ((env.seats || []).some(vendido)) {
    return { env, motivo: 'Há lugares vendidos ou reservados neste mapa. Movê-los desalinharia os ingressos já vendidos.' }
  }
  const w = Math.max(W, Math.ceil(c.w + 2 * MARGEM - e)), h = Math.max(H, Math.ceil(c.h + 2 * MARGEM - e))
  const alvo = (ini: number, tam: number, sala: number) =>
    ini < ORIGEM_SALA + MARGEM ? ORIGEM_SALA + MARGEM - ini : ini + tam > ORIGEM_SALA + sala - MARGEM ? ORIGEM_SALA + sala - MARGEM - (ini + tam) : 0
  if ((env.walls || []).length && (w !== W || h !== H)) {
    return { env, motivo: 'As paredes ocupam a sala inteira; ajuste a sala ou mova o que está fora à mão.' }
  }
  const dx = alvo(c.x, c.w, w), dy = alvo(c.y, c.h, h)
  return {
    env: {
      ...env, roomWidth: w, roomHeight: h,
      seats: (env.seats || []).map(n => ({ ...n, x: n.x + dx, y: n.y + dy })),
      walls: (env.walls || []).map(p => ({ ...p, x1: p.x1 + dx, y1: p.y1 + dy, x2: p.x2 + dx, y2: p.y2 + dy })),
    },
  }
}

// ---- Lotes (seções vendáveis). 'Estrutura' não é lote: não aparece, não liga ingresso, não se apaga. ----
export const lotesDe = (env: Environment) => (env.sections || []).filter(s => s.id !== ESTRUTURA.id)
export const precoValido = (n: number) => Number.isFinite(n) && n >= 0

// Troca um lote e os elementos dele de uma vez (cor/preço dos nós seguem o lote, como no editor antigo)
const noLote = (env: Environment, id: string, sec: Partial<Environment['sections'][number]>, nos: Partial<SeatNode>): Environment => ({
  ...env,
  sections: env.sections.map(x => (x.id === id ? { ...x, ...sec } : x)),
  seats: env.seats.map(n => (n.sectionId === id ? { ...n, ...nos } : n)),
})

export function definirPreco(env: Environment, id: string, preco: number): Environment {
  if (id === ESTRUTURA.id || !precoValido(preco)) return env
  return noLote(env, id, { price: preco }, { price: preco })
}

// Ligar um ingresso copia o preço dele (quem manda no valor cobrado é o ingresso); desligar mantém o preço
export function ligarIngresso(env: Environment, id: string, ingresso?: { id: string; price: number }): Environment {
  if (id === ESTRUTURA.id) return env
  if (!ingresso) return noLote(env, id, { ticketTypeId: undefined }, {})
  if (!precoValido(ingresso.price)) return env
  return noLote(env, id, { ticketTypeId: ingresso.id, price: ingresso.price }, { price: ingresso.price })
}

// Apagar lote: precisa sobrar outro; recusa se algum elemento dele tem venda/reserva; os elementos vão para o primeiro outro lote
export function apagarLote(env: Environment, id: string): { env: Environment; destino?: string; erro?: string } {
  const lotes = lotesDe(env)
  if (id === ESTRUTURA.id || !lotes.some(s => s.id === id)) return { env, erro: 'Este item não é um lote.' }
  const destino = lotes.find(s => s.id !== id)
  if (!destino) return { env, erro: 'Precisa de pelo menos um lote.' }
  const vendidos = env.seats.filter(n => n.sectionId === id && vendido(n)).length
  if (vendidos) return { env, erro: `Este lote tem ${vendidos} elemento(s) com venda ou reserva e não pode ser apagado.` }
  const apagado = noLote(env, id, {}, { sectionId: destino.id, price: destino.price, color: destino.color })
  return { env: { ...apagado, sections: apagado.sections.filter(x => x.id !== id) }, destino: destino.name }
}

// ---- Rodapé: mesmas fórmulas do editor antigo, sobre o pavimento ativo ----
export function metricas(env: Environment) {
  const nos = env.seats || []
  const soma = (f: (n: SeatNode) => number) => nos.reduce((t, n) => t + f(n), 0)
  return {
    assentos: soma(n => n.capacity || 0),
    mesas: nos.filter(n => n.type === 'table').length,
    muros: (env.walls || []).length,
    vendido: soma(n => n.sold || 0),
    reservados: nos.filter(n => n.status === 'reserved').length,
    receita: soma(n => n.price * (n.sold || 0)),
    potencial: soma(n => n.price * (n.capacity || 0)),
  }
}

// ---- Pavimentos: só acrescenta ao fim ou remove um; a ordem e os ids dos outros nunca mudam (o checkout lê environments[0]) ----
export function novoPavimento(envs: Environment[], id: string): Environment[] {
  let n = envs.length + 1
  while (envs.some(e => e.name === `Pavimento ${n}`)) n++
  return [...envs, { id, name: `Pavimento ${n}`, seats: [], sections: JSON.parse(JSON.stringify(defaultSections)), walls: [], pixelsPerMeter: 40 }]
}

export function apagarPavimento(envs: Environment[], id: string): { envs: Environment[]; erro?: string } {
  const alvo = envs.find(e => e.id === id)
  if (!alvo) return { envs, erro: 'Pavimento não encontrado.' }
  if (envs.length <= 1) return { envs, erro: 'Precisa de pelo menos um pavimento.' }
  const v = (alvo.seats || []).filter(vendido).length
  if (v) return { envs, erro: `"${alvo.name}" tem ${v} elemento(s) com venda ou reserva e não pode ser apagado.` }
  return { envs: envs.filter(e => e.id !== id) }
}

// ---- Importar JSON: valida antes de tocar no mapa; recusa se o mapa atual tem venda/reserva ----
export const MAX_IMPORTAR = 5 * 1024 * 1024
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

export function lerImportacao(texto: string, atual: Environment[]): { envs?: Environment[]; erro?: string } {
  if (texto.length > MAX_IMPORTAR) return { erro: 'Arquivo grande demais (limite de 5 MB).' }
  if ((atual || []).some(e => (e.seats || []).some(vendido))) return { erro: 'Há lugares vendidos ou reservados neste mapa. Importar apagaria o mapa em que os ingressos já vendidos se apoiam.' }
  let dados: unknown
  try { dados = JSON.parse(texto) } catch { return { erro: 'Arquivo de mapa inválido (não é um JSON).' } }
  const lista = obj(dados) ? dados.environments : null
  if (!Array.isArray(lista) || !lista.length) return { erro: 'Arquivo de mapa inválido: falta a lista de pavimentos (environments).' }
  const ids = new Set<string>()
  for (const e of lista) {
    if (!obj(e) || typeof e.id !== 'string' || !e.id || ids.has(e.id) || typeof e.name !== 'string' || !Array.isArray(e.seats) || !Array.isArray(e.sections)) return { erro: 'Arquivo de mapa inválido: pavimento sem id único, nome, elementos ou lotes.' }
    ids.add(e.id)
    const nosIds = new Set<string>()
    for (const n of e.seats) {
      if (!obj(n) || typeof n.id !== 'string' || !n.id || nosIds.has(n.id) || !num(n.x) || !num(n.y) || typeof n.type !== 'string') return { erro: `Arquivo de mapa inválido: elemento sem id único, tipo ou posição (x, y) em "${e.name}".` }
      nosIds.add(n.id)
      for (const k of ['price', 'sold', 'capacity']) if (n[k] !== undefined && !(num(n[k]) && (n[k] as number) >= 0)) return { erro: `Arquivo de mapa inválido: "${k}" negativo ou não numérico em "${e.name}".` }
    }
    for (const x of e.sections) if (!obj(x) || typeof x.id !== 'string' || typeof x.name !== 'string' || !num(x.price) || (x.price as number) < 0) return { erro: `Arquivo de mapa inválido: lote com id, nome ou preço inválido em "${e.name}".` }
  }
  return { envs: normalizarEnvs(lista as Environment[]) }
}
