import { defaultSections, normalizarEnvs, typeLabels, type Environment, type Section, type SeatNode, type SeatStatus, type WallNode } from './modelo'
import { caixaDosElementos, ORIGEM_SALA } from './geometria'
import { ESTRUTURA, ITENS, comSecao, criarNo, destinoDe } from './paleta'
import type { nosDaProposta } from '../../../lib/plantaIA'

const vendido = (n: SeatNode) => n.sold > 0 || n.status === 'sold' || n.status === 'reserved'

// Próximo rótulo livre: maior número já usado com o mesmo prefixo + 1 ("Mesa 3" -> "Mesa 4"; base '' -> "7")
export function proximoRotulo(nos: Pick<SeatNode, 'label'>[], base: string): string {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s?(\\d+)$`)
  const max = nos.reduce((m, n) => Math.max(m, Number(re.exec(n.label)?.[1] ?? 0)), 0)
  return base ? `${base} ${max + 1}` : String(max + 1)
}

// Leitor de planta: acrescenta as peças aprovadas ao pavimento, sem tocar nos nós que já existem
export function acrescentarPecas(e: Environment, nos: ReturnType<typeof nosDaProposta>, sec: Section, novoId: () => string): { env: Environment; ids: string[] } {
  let sections = e.sections
  const seats = [...e.seats]
  const ids: string[] = []
  for (const n of nos) {
    const it = ITENS[n.tipo]
    if (!it) continue
    const destino = destinoDe(it, sec)
    sections = comSecao(sections, destino)
    const label = n.rotulo && !seats.some(s => s.label === n.rotulo) ? n.rotulo : proximoRotulo(seats, n.tipo === 'seat' ? '' : n.tipo === 'table' ? 'Mesa' : it.nome) // numeração como na criação manual
    const quadrada = Math.abs(n.widthMeter - n.heightMeter) <= 0.15 * Math.max(n.widthMeter, n.heightMeter)
    const no = criarNo(it, n.x, n.y, novoId(), destino, { label, widthMeter: n.widthMeter, heightMeter: n.heightMeter, ...(n.tipo === 'table' ? { tableShape: quadrada ? 'circle' : 'rectangle' } : {}) })
    seats.push(no)
    ids.push(no.id)
  }
  return { env: { ...e, sections, seats }, ids }
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

// Elementos com venda/reserva que ficaram com preço diferente do lote (para avisar o produtor)
export const vendidosComPrecoAntigo = (env: Environment, id: string) => {
  const preco = (env.sections || []).find(x => x.id === id)?.price
  return env.seats.filter(n => n.sectionId === id && vendido(n) && n.price !== preco).length
}

// Preço digitado: milhar com ponto e decimal com vírgula ("1.200,50"), ou número simples com 1-2 decimais ("12,5", "12.5").
// Sem notação científica, sinal, texto ou valor acima de R$ 1.000.000. "1.200" (um grupo de 3 dígitos) é lido como mil e duzentos,
// mas marcado como ambíguo: a tela pede confirmação antes de aplicar.
export function lerPreco(txt: string): { valor: number; ambiguo: boolean } | null {
  const t = txt.trim()
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(t)) return null
  const milhar = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)
  const valor = Number((milhar ? t.replace(/\./g, '') : t).replace(',', '.'))
  return valor <= 1_000_000 ? { valor, ambiguo: /^\d{1,3}\.\d{3}$/.test(t) } : null
}

// Nome de lote: até 60 caracteres, nunca vazio (volta ao anterior) e sem repetir outro lote (ganha " (2)", " (3)"...)
export function nomeUnico(nome: string, outros: string[], anterior: string): string {
  const base = nome.trim().slice(0, 60)
  if (!base) return anterior
  const usado = (n: string) => outros.some(o => o.toLowerCase() === n.toLowerCase())
  let n = base, i = 2
  while (usado(n)) n = `${base.slice(0, 60 - ` (${i})`.length)} (${i++})`
  return n
}

// O que o Desfazer vai desfazer: o histórico do pavimento ativo; só sem nenhum histórico em qualquer pavimento volta a importação
export function alvoDesfazer(hist: Record<string, unknown[] | undefined>, ativoId: string, temImportacao: boolean): 'pavimento' | 'importacao' | null {
  if (hist[ativoId]?.length) return 'pavimento'
  return temImportacao && !Object.values(hist).some(h => h?.length) ? 'importacao' : null
}

// Troca um lote e os elementos dele de uma vez (cor/preço dos nós seguem o lote, como no editor antigo).
// Elemento com venda ou reserva não muda: a receita já feita (preço x vendidos) não pode ser reescrita.
const noLote = (env: Environment, id: string, sec: Partial<Environment['sections'][number]>, nos: Partial<SeatNode>): Environment => ({
  ...env,
  sections: env.sections.map(x => (x.id === id ? { ...x, ...sec } : x)),
  seats: env.seats.map(n => (n.sectionId === id && !vendido(n) ? { ...n, ...nos } : n)),
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

// Cadeiras que a mesa vende: a regra de reservar_assentos (1º valor NUMÉRICO de seatsCount, senão capacity, senão 6; de 1 a 50)
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
export const lugaresDaMesa = (n: Pick<SeatNode, 'seatsCount' | 'capacity'>) => Math.min(Math.max(numero(n.seatsCount) ?? numero(n.capacity) ?? 6, 1), 50)

const UUID_RE = /^[0-9a-fA-F-]{36}$/
// Venda por lugar no checkout (reservar_assentos): só seat/table livre, em lote ligado a um ingresso ATIVO e não coletivo, é vendável.
// `ingressos` = os ingressos vendáveis do evento (null enquanto não carregaram: aí não se afirma que um ingresso é indisponível).
// `foraDoPrimeiro`: o checkout só mostra o primeiro pavimento (environments[0]), embora o banco aceite todos.
// `naoVendePorLugar`: item de outro tipo (pista, arquibancada, VIP...) em lote com ingresso: o comprador o compra por quantidade.
export function resumoVenda(envs: Environment[], ingressos: { id: string }[] | null = null) {
  let vendaveis = 0, semIngresso = 0, foraDoPrimeiro = 0, naoVendePorLugar = 0
  const indisponiveis = new Set<string>()
  envs.forEach((env, i) => {
    for (const n of env.seats || []) {
      const sec = n.sectionId === ESTRUTURA.id ? undefined : (env.sections || []).find(x => x.id === n.sectionId)
      if (n.type !== 'seat' && n.type !== 'table') { if (sec?.ticketTypeId) naoVendePorLugar++; continue }
      if ((n.status ?? 'free') !== 'free') continue
      const tid = sec?.ticketTypeId
      if (!tid) { if (n.sectionId !== ESTRUTURA.id) semIngresso++; continue }
      if (!ingressos) { if (UUID_RE.test(tid)) { vendaveis++; if (i > 0) foraDoPrimeiro++ } continue }
      if (UUID_RE.test(tid) && ingressos.some(t => t.id === tid)) { vendaveis++; if (i > 0) foraDoPrimeiro++ } else indisponiveis.add(`${env.id}:${sec!.id}`)
    }
  })
  return { vendaveis, semIngresso, foraDoPrimeiro, naoVendePorLugar, ingressoIndisponivel: indisponiveis.size }
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

const so = <T,>(o: Record<string, unknown>, k: string, ok: (v: unknown) => boolean, pad: T): T | null => (o[k] === undefined ? pad : ok(o[k]) ? (o[k] as T) : null)
const str = (v: unknown) => typeof v === 'string'
const nao_neg = (v: unknown) => num(v) && (v as number) >= 0

// Só campos conhecidos entram (nada de __proto__ ou lixo do arquivo); venda e reserva nunca vêm do arquivo
function limparNo(n: Record<string, unknown>, lote: string, lotes: Set<string>): SeatNode | null {
  const campos = {
    label: so(n, 'label', str, '')?.slice(0, 80) ?? null, color: so(n, 'color', str, ''), price: so(n, 'price', nao_neg, 0), capacity: so(n, 'capacity', nao_neg, 0),
    rotation: so(n, 'rotation', num, 0), locked: so(n, 'locked', v => typeof v === 'boolean', false),
    widthMeter: so(n, 'widthMeter', nao_neg, undefined), heightMeter: so(n, 'heightMeter', nao_neg, undefined), seatsCount: so(n, 'seatsCount', nao_neg, undefined),
  }
  if (Object.values(campos).some(v => v === null)) return null
  const forma = n.tableShape
  return {
    ...(campos as Omit<SeatNode, 'id' | 'x' | 'y' | 'type' | 'sold' | 'status' | 'sectionId'>),
    id: n.id as string, x: n.x as number, y: n.y as number, type: n.type as SeatNode['type'],
    sold: 0, status: n.status === 'blocked' || n.status === 'contact' ? n.status : 'free',
    sectionId: typeof n.sectionId === 'string' && lotes.has(n.sectionId) ? n.sectionId : lote,
    ...(forma === 'circle' || forma === 'rectangle' || forma === 'square' ? { tableShape: forma } : {}),
  }
}

export function lerImportacao(texto: string, atual: Environment[], ingressos: string[] = []): { envs?: Environment[]; erro?: string; avisos?: string[] } {
  if (texto.length > MAX_IMPORTAR) return { erro: 'Arquivo grande demais (limite de 5 MB).' }
  if ((atual || []).some(e => (e.seats || []).some(vendido))) return { erro: 'Há lugares vendidos ou reservados neste mapa. Importar apagaria o mapa em que os ingressos já vendidos se apoiam.' }
  let dados: unknown
  try { dados = JSON.parse(texto) } catch { return { erro: 'Arquivo de mapa inválido (não é um JSON).' } }
  const lista = obj(dados) ? dados.environments : null
  if (!Array.isArray(lista) || !lista.length) return { erro: 'Arquivo de mapa inválido: falta a lista de pavimentos (environments).' }
  const ids = new Set<string>()
  const desconhecidos = new Set<string>()
  let semIngresso = 0, vendaZerada = 0
  const envs: Environment[] = []
  for (const e of lista) {
    if (!obj(e) || typeof e.id !== 'string' || !e.id || ids.has(e.id) || typeof e.name !== 'string' || !Array.isArray(e.seats) || !Array.isArray(e.sections) || !e.sections.length) return { erro: 'Arquivo de mapa inválido: pavimento sem id único, nome, elementos ou ao menos um lote.' }
    ids.add(e.id)
    const secoes: Environment['sections'] = []
    for (const x of e.sections) {
      if (!obj(x) || typeof x.id !== 'string' || typeof x.name !== 'string' || !num(x.price) || (x.price as number) < 0 || (x.color !== undefined && !str(x.color))) return { erro: `Arquivo de mapa inválido: lote com id, nome ou preço inválido em "${e.name}".` }
      const tid = typeof x.ticketTypeId === 'string' && ingressos.includes(x.ticketTypeId) ? x.ticketTypeId : undefined
      if (x.ticketTypeId && !tid) semIngresso++
      secoes.push({ id: x.id, name: x.name.slice(0, 60), color: (x.color as string) || '#7a3b69', price: x.price as number, ...(tid ? { ticketTypeId: tid } : {}) })
    }
    const lote = (secoes.find(x => x.id !== ESTRUTURA.id) || secoes[0])?.id ?? ''
    const idsSecoes = new Set(secoes.map(x => x.id))
    const nosIds = new Set<string>()
    const seats: SeatNode[] = []
    for (const n of e.seats) {
      if (!obj(n) || typeof n.id !== 'string' || !n.id || nosIds.has(n.id) || !num(n.x) || !num(n.y) || typeof n.type !== 'string') return { erro: `Arquivo de mapa inválido: elemento sem id único, tipo ou posição (x, y) em "${e.name}".` }
      nosIds.add(n.id)
      const no = limparNo(n, lote, idsSecoes)
      if (!no) return { erro: `Arquivo de mapa inválido: campo numérico negativo ou fora do tipo em um elemento de "${e.name}".` }
      if ((num(n.sold) && (n.sold as number) > 0) || n.status === 'sold' || n.status === 'reserved') vendaZerada++
      if (!typeLabels[no.type]) desconhecidos.add(no.type)
      seats.push(no)
    }
    const paredes: WallNode[] = []
    for (const p of Array.isArray(e.walls) ? e.walls : []) {
      if (!obj(p) || typeof p.id !== 'string' || !p.id || !['x1', 'y1', 'x2', 'y2'].every(k => num(p[k])) || !num(p.thickness) || (p.thickness as number) <= 0 || (p.thickness as number) > 5) return { erro: `Arquivo de mapa inválido: parede sem id, coordenadas ou espessura válidas em "${e.name}".` }
      paredes.push({ id: p.id, x1: p.x1 as number, y1: p.y1 as number, x2: p.x2 as number, y2: p.y2 as number, thickness: p.thickness as number, color: str(p.color) ? (p.color as string) : '#4b5563', locked: p.locked === true })
    }
    const sala = (k: string) => (num(e[k]) && (e[k] as number) > 0 ? { [k]: e[k] as number } : {})
    envs.push({
      id: e.id, name: e.name.slice(0, 60), seats, sections: secoes, walls: paredes,
      ...(num(e.pixelsPerMeter) && (e.pixelsPerMeter as number) > 0 ? { pixelsPerMeter: e.pixelsPerMeter as number } : {}),
      ...(e.roomShape === 'rectangle' || e.roomShape === 'l_shape' ? { roomShape: e.roomShape } : {}),
      ...sala('roomWidth'), ...sala('roomHeight'), ...sala('roomLWidth'), ...sala('roomLHeight'), ...(num(e.roomRotation) ? { roomRotation: e.roomRotation as number } : {}),
    })
  }
  const avisos: string[] = []
  if (semIngresso) avisos.push(`${semIngresso} lote(s) estavam ligados a ingressos que não existem neste evento: ficam sem ingresso (não vendem) até você ligar de novo.`)
  if (vendaZerada) avisos.push(`${vendaZerada} elemento(s) vinham com venda ou reserva no arquivo: foram zerados (venda real só vem do sistema).`)
  if (desconhecidos.size) avisos.push(`Tipo(s) de elemento desconhecido(s), mantidos como estão: ${[...desconhecidos].slice(0, 5).join(', ')}.`)
  return { envs: normalizarEnvs(envs), avisos }
}

// ---- Busca por rótulo ou tipo (sem acento, sem diferenciar maiúsculas); devolve o primeiro ----
const plano = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function buscarNo(nos: SeatNode[], termo: string): SeatNode | undefined {
  const t = plano(termo.trim())
  return t ? nos.find(n => plano(n.label || '').includes(t) || plano(typeLabels[n.type] || String(n.type)).includes(t)) : undefined
}

// ---- Status: só Livre ⇄ Bloqueado; vendido/reservado (do sistema) e contato nunca mudam por aqui ----
export const statusEditavel = (n: Pick<SeatNode, 'sold' | 'status'>) => !vendido(n as SeatNode) && n.status !== 'contact'
export function alternarStatus(n: SeatNode, novo: SeatStatus): SeatNode {
  return statusEditavel(n) && (novo === 'free' || novo === 'blocked') ? { ...n, status: novo } : n
}
