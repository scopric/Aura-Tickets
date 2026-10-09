import { toCsv } from './exportCsv'

// Certificados do produtor: modelos, campos, saneamento do template (JSONB lido do banco é dado não confiável),
// substituição de variáveis, lote, histórico de edição e CSV. Tudo puro, sem React nem Supabase.

// Só fontes que o site já carrega (index.html: Plus Jakarta Sans, Outfit, Archivo; CSP font-src: 'self' e gstatic)
// mais a serifada do sistema. Nada de fonte externa nova.
export type FonteId = 'jakarta' | 'outfit' | 'archivo' | 'serifa'
export const FONTES: { id: FonteId; nome: string; css: string }[] = [
  { id: 'jakarta', nome: 'Plus Jakarta Sans', css: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: 'outfit', nome: 'Outfit', css: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: 'archivo', nome: 'Archivo', css: "'Archivo', 'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: 'serifa', nome: 'Serifada (Georgia)', css: "Georgia, 'Times New Roman', serif" },
]
export const cssDaFonte = (id: FonteId | undefined, padrao: FonteId): string => (FONTES.find(f => f.id === (id ?? padrao)) ?? FONTES[0]).css

export type TipoCampo = 'text' | 'logo' | 'signature' | 'qrcode' | 'date' | 'hours'
export type Alinhamento = 'left' | 'center' | 'right'
export interface Campo {
  id: string
  type: TipoCampo
  label: string
  /** centro do campo, em % da folha */
  x: number
  y: number
  /** tamanho do texto numa folha de 700 de largura (a folha escala junto com a tela) */
  fontSize: number
  color: string
  value: string
  /** largura em % da folha */
  width: number
  fontFamily?: FonteId
  align?: Alinhamento
  bold?: boolean
}

export type Moldura = 'duplo' | 'lateral' | 'topo' | 'tracejado' | 'fino' | 'grosso' | 'moldura' | 'faixa' | 'cantos' | 'duasfaixas'
export interface Modelo {
  id: string
  nome: string
  categoria: string
  descricao: string
  /** cores do próprio papel; não são cores do painel */
  bg: string
  accent: string
  tinta: string
  suave: string
  fonte: FonteId
  moldura: Moldura
}

// Os 6 primeiros são os modelos que já existiam (mesmas cores e molduras); os outros 6 são novos.
export const MODELOS: Modelo[] = [
  { id: 'classic', nome: 'Clássico elegante', categoria: 'geral', descricao: 'Bordas duplas', bg: '#ffffff', accent: '#1a0e14', tinta: '#1a0e14', suave: '#78716c', fonte: 'jakarta', moldura: 'duplo' },
  { id: 'modern', nome: 'Moderno minimalista', categoria: 'tech', descricao: 'Linha lateral, fonte limpa', bg: '#f8f7f5', accent: '#7a3b69', tinta: '#1a0e14', suave: '#78716c', fonte: 'jakarta', moldura: 'lateral' },
  { id: 'corporate', nome: 'Corporativo', categoria: 'corporativo', descricao: 'Azul corporativo, faixa no topo', bg: '#ffffff', accent: '#1e3a5f', tinta: '#1a0e14', suave: '#78716c', fonte: 'jakarta', moldura: 'topo' },
  { id: 'creative', nome: 'Criativo artístico', categoria: 'arte', descricao: 'Cores quentes, borda tracejada', bg: '#fdf6f0', accent: '#d97706', tinta: '#1a0e14', suave: '#78716c', fonte: 'jakarta', moldura: 'tracejado' },
  { id: 'academic', nome: 'Acadêmico', categoria: 'educacao', descricao: 'Sóbrio e formal', bg: '#ffffff', accent: '#374151', tinta: '#1a0e14', suave: '#78716c', fonte: 'jakarta', moldura: 'fino' },
  { id: 'sport', nome: 'Esporte e bem-estar', categoria: 'esporte', descricao: 'Verde, borda larga', bg: '#f0fdf4', accent: '#16a34a', tinta: '#14301f', suave: '#4b6355', fonte: 'jakarta', moldura: 'grosso' },
  { id: 'noturno', nome: 'Noturno dourado', categoria: 'gala', descricao: 'Fundo escuro, dourado, serifada', bg: '#14161f', accent: '#c9a24b', tinta: '#f5efe0', suave: '#b9b3a3', fonte: 'serifa', moldura: 'moldura' },
  { id: 'oceano', nome: 'Oceano', categoria: 'geral', descricao: 'Azul-petróleo, faixa embaixo, Outfit', bg: '#f2f8fb', accent: '#0e7490', tinta: '#0b2a35', suave: '#4a6a75', fonte: 'outfit', moldura: 'faixa' },
  { id: 'rose', nome: 'Rosé', categoria: 'arte', descricao: 'Rosa, cantos decorados, serifada', bg: '#fff5f7', accent: '#be185d', tinta: '#4a1230', suave: '#8a5a6e', fonte: 'serifa', moldura: 'cantos' },
  { id: 'grafite', nome: 'Grafite técnico', categoria: 'tech', descricao: 'Cinza e preto, duas faixas, Archivo', bg: '#f4f4f5', accent: '#111827', tinta: '#111827', suave: '#52525b', fonte: 'archivo', moldura: 'duasfaixas' },
  { id: 'terra', nome: 'Terra', categoria: 'educacao', descricao: 'Tons de terra, moldura interna, serifada', bg: '#faf5ec', accent: '#92400e', tinta: '#3b2410', suave: '#7c6248', fonte: 'serifa', moldura: 'moldura' },
  { id: 'vibrante', nome: 'Vibrante', categoria: 'esporte', descricao: 'Violeta, linha lateral, Outfit', bg: '#faf5ff', accent: '#7c3aed', tinta: '#2e1065', suave: '#6b5a8e', fonte: 'outfit', moldura: 'lateral' },
]
export const MODELO_PADRAO = 'classic'
export const modeloPorId = (id: string | null | undefined): Modelo => MODELOS.find(m => m.id === id) ?? MODELOS[0]
/** cor de destaque escolhida no editor vale sobre a do modelo */
export const modeloComCor = (m: Modelo, accent: string | null): Modelo => (accent ? { ...m, accent } : m)

// Cor de cada campo conforme o papel dele no modelo (o id do campo diz o papel)
const PAPEL: Record<string, 'tinta' | 'accent' | 'suave'> = { title: 'tinta', subtitle: 'accent', participant: 'tinta', event: 'tinta', details: 'suave', sigLabel: 'suave', date: 'suave', code: 'suave' }
const corDoPapel = (m: Modelo, id: string) => m[PAPEL[id] ?? 'tinta']

export const LIMITES = { campos: 30, fonteMin: 6, fonteMax: 96, texto: 300, rotulo: 60, imagemBytes: 1024 * 1024, imagemChars: 1_500_000, loteMax: 50 }
const LARGURA_IMAGEM = { logo: 18, signature: 20, qrcode: 12 } as const

export const camposPadrao = (m: Modelo = modeloPorId(MODELO_PADRAO)): Campo[] => [
  { id: 'logo', type: 'logo', label: 'Logo', x: 50, y: 10, fontSize: 0, color: '#000000', value: '', width: LARGURA_IMAGEM.logo },
  { id: 'title', type: 'text', label: 'Título', x: 50, y: 24, fontSize: 28, color: corDoPapel(m, 'title'), value: 'Certificado de Participação', width: 80 },
  { id: 'subtitle', type: 'text', label: 'Subtítulo', x: 50, y: 33, fontSize: 14, color: corDoPapel(m, 'subtitle'), value: 'Reconhecemos que', width: 80 },
  { id: 'participant', type: 'text', label: 'Nome do participante', x: 50, y: 44, fontSize: 32, color: corDoPapel(m, 'participant'), value: '{{NOME}}', width: 80 },
  { id: 'event', type: 'text', label: 'Evento', x: 50, y: 55, fontSize: 16, color: corDoPapel(m, 'event'), value: 'participou do {{EVENTO}}', width: 80 },
  { id: 'details', type: 'text', label: 'Detalhes', x: 50, y: 63, fontSize: 12, color: corDoPapel(m, 'details'), value: 'realizado em {{DATA}} com carga horária de {{HORAS}}h', width: 80 },
  { id: 'signature', type: 'signature', label: 'Assinatura', x: 72, y: 80, fontSize: 14, color: corDoPapel(m, 'title'), value: '{{ASSINATURA}}', width: LARGURA_IMAGEM.signature },
  { id: 'sigLabel', type: 'text', label: 'Legenda da assinatura', x: 72, y: 88, fontSize: 10, color: corDoPapel(m, 'sigLabel'), value: 'Assinatura do Produtor', width: 30 },
  { id: 'qrcode', type: 'qrcode', label: 'QR Code', x: 14, y: 80, fontSize: 0, color: '#000000', value: '', width: LARGURA_IMAGEM.qrcode },
  { id: 'date', type: 'date', label: 'Data de emissão', x: 14, y: 93, fontSize: 9, color: corDoPapel(m, 'date'), value: 'Emitido em {{DATA_EMISSAO}}', width: 24 },
  { id: 'code', type: 'text', label: 'Código do certificado', x: 50, y: 96, fontSize: 8, color: corDoPapel(m, 'code'), value: 'Código {{CODIGO}}', width: 50 },
]

/** Troca o modelo mantendo textos, posições e tamanhos; cores e fontes voltam ao padrão do novo modelo. */
export const aplicarModelo = (campos: Campo[], m: Modelo): Campo[] =>
  campos.map(c => (c.type === 'logo' || c.type === 'signature' || c.type === 'qrcode' ? c : { ...c, color: corDoPapel(m, c.id), fontFamily: undefined }))

// ── variáveis ──
export interface DadosCertificado { nome: string; evento: string; data: string; horas: string; emissao: string; codigo: string }
export const VARIAVEIS = ['{{NOME}}', '{{EVENTO}}', '{{DATA}}', '{{HORAS}}', '{{ASSINATURA}}', '{{DATA_EMISSAO}}', '{{CODIGO}}'] as const

/** Troca todas as variáveis conhecidas; texto livre e variável desconhecida ficam como estão. Resultado é texto puro (o React escapa). */
export function resolverTexto(valor: string, d: DadosCertificado): string {
  const mapa: Record<string, string> = { NOME: d.nome, EVENTO: d.evento, DATA: d.data, HORAS: d.horas, ASSINATURA: '_________________', DATA_EMISSAO: d.emissao, CODIGO: d.codigo }
  return valor.replace(/\{\{([A-Z_]+)\}\}/g, (t, k: string) => (k in mapa ? mapa[k] : t))
}

// ── saneamento do template vindo do banco ──
export interface TemplateCert {
  selectedTemplate: string; accentColor: string | null; fields: Campo[]; logoUrl: string | null; sigUrl: string | null; horas: string
  /** logo/assinatura que existiam no banco mas o saneamento recusou (formato ou tamanho): o valor bruto, para não apagar sem aviso */
  logoDescartada?: unknown; sigDescartada?: unknown
}

const HEX = /^#[0-9a-f]{6}$/i
export const corValida = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)
const TIPOS: TipoCampo[] = ['text', 'logo', 'signature', 'qrcode', 'date', 'hours']
const num = (v: unknown, min: number, max: number, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao)
const txt = (v: unknown, max: number, padrao = '') => (typeof v === 'string' ? v.slice(0, max) : padrao)

/** Endereço público do bucket das logos (logos-produtor) no Supabase do projeto; sem VITE_SUPABASE_URL nenhum https vale. */
const baseLogos = () => `${import.meta.env.VITE_SUPABASE_URL ?? '\u0000'}/storage/v1/object/public/logos-produtor/`

/** Pixels máximos de uma imagem embutida (25 MP: cabe foto de 6000x4000). PNG pequeno que declara dezenas de milhares de pixels
 *  ("bomba de descompressão") abre em gigabytes e mata a aba de quem abre o certificado. */
export const IMAGEM_MAX_PIXELS = 25_000_000

/** Largura e altura lidas do cabeçalho de uma imagem em data URL (png, jpeg ou webp), sem decodificar a imagem. null se não achar. */
export function medidasDaImagem(dataUrl: string): { w: number; h: number } | null {
  const virgula = dataUrl.indexOf(',')
  if (virgula < 0) return null
  let b: Uint8Array
  try { // só o começo: o cabeçalho cabe nos primeiros 96 KB (múltiplo de 4 caracteres base64)
    const bin = atob(dataUrl.slice(virgula + 1, virgula + 1 + 131072))
    b = Uint8Array.from(bin, c => c.charCodeAt(0))
  } catch { return null }
  const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
  const le24 = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
  const tag = (i: number, t: string) => t.split('').every((c, k) => b[i + k] === c.charCodeAt(0))
  if (b.length >= 24 && b[0] === 0x89 && tag(1, 'PNG')) return { w: u32(16), h: u32(20) }
  if (b.length >= 30 && tag(0, 'RIFF') && tag(8, 'WEBP')) {
    if (tag(12, 'VP8X')) return { w: le24(24) + 1, h: le24(27) + 1 }
    if (tag(12, 'VP8 ')) return { w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff }
    if (tag(12, 'VP8L')) { const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 } }
    return null
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue }
      const m = b[i + 1]
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: (b[i + 7] << 8) | b[i + 8], h: (b[i + 5] << 8) | b[i + 6] }
      i += 2 + ((b[i + 2] << 8) | b[i + 3])
    }
  }
  return null
}

/** Imagem do certificado: data URL png/jpeg/webp em base64 (nunca SVG, no máximo 25 MP, medidas legíveis) ou https do storage de logos do próprio projeto. */
export function imagemSegura(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > LIMITES.imagemChars) return null
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v)) {
    const m = medidasDaImagem(v)
    return m && m.w > 0 && m.h > 0 && m.w * m.h <= IMAGEM_MAX_PIXELS ? v : null
  }
  if (v.length <= 500 && v.startsWith(baseLogos()) && /^https:\/\/[^\s"'<>()\\]+$/.test(v)) return v
  return null
}

/** Erro em português se o arquivo não serve (tipo fora de png/jpeg/webp ou acima de 1 MB); null se serve. */
export function erroDaImagem(file: { type: string; size: number }): string | null {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return 'Use uma imagem PNG, JPG ou WebP.'
  if (file.size > LIMITES.imagemBytes) return 'A imagem deve ter no máximo 1 MB.'
  return null
}

function sanearCampo(raw: unknown, i: number, usados: Set<string>): Campo | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!TIPOS.includes(r.type as TipoCampo)) return null
  const type = r.type as TipoCampo
  let id = typeof r.id === 'string' && /^[\w-]{1,40}$/.test(r.id) ? r.id : `c${i}`
  while (usados.has(id)) id = `${id.slice(0, 36)}_${i}`
  usados.add(id)
  const imagem = type === 'logo' || type === 'signature' || type === 'qrcode'
  // valores antigos de imagem eram largos demais (50 a 100%): voltam ao tamanho certo
  const largura = imagem
    ? (typeof r.width === 'number' && r.width >= 5 && r.width <= 40 ? r.width : LARGURA_IMAGEM[type])
    : num(r.width, 10, 100, 60)
  return {
    id, type, label: txt(r.label, LIMITES.rotulo, 'Campo'),
    x: num(r.x, 0, 100, 50), y: num(r.y, 0, 100, 50),
    fontSize: imagem ? 0 : num(r.fontSize, LIMITES.fonteMin, LIMITES.fonteMax, 14),
    color: corValida(r.color) ? r.color : '#1a0e14',
    value: txt(r.value, LIMITES.texto),
    width: largura,
    fontFamily: FONTES.some(f => f.id === r.fontFamily) ? (r.fontFamily as FonteId) : undefined,
    align: r.align === 'left' || r.align === 'center' || r.align === 'right' ? r.align : undefined,
    bold: typeof r.bold === 'boolean' ? r.bold : undefined,
  }
}

export function sanearTemplate(raw: unknown): TemplateCert {
  const t = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const usados = new Set<string>()
  const lidos = Array.isArray(t.fields) ? t.fields.slice(0, LIMITES.campos).map((c, i) => sanearCampo(c, i, usados)).filter((c): c is Campo => !!c) : []
  return {
    selectedTemplate: modeloPorId(typeof t.selectedTemplate === 'string' ? t.selectedTemplate : null).id,
    accentColor: corValida(t.accentColor) ? t.accentColor : null,
    fields: lidos.length ? lidos : camposPadrao(),
    logoUrl: imagemSegura(t.logoUrl),
    sigUrl: imagemSegura(t.sigUrl),
    logoDescartada: t.logoUrl && !imagemSegura(t.logoUrl) ? t.logoUrl : undefined,
    sigDescartada: t.sigUrl && !imagemSegura(t.sigUrl) ? t.sigUrl : undefined,
    horas: typeof t.horas === 'string' && /^[\d.,]{1,6}$/.test(t.horas) ? t.horas : '',
  }
}

// ── mover e propriedades ──
const arred = (n: number) => Math.round(n * 10) / 10
export const mover = (c: Campo, dx: number, dy: number): Campo => ({ ...c, x: arred(Math.min(100, Math.max(0, c.x + dx))), y: arred(Math.min(100, Math.max(0, c.y + dy))) })
export const PASSO = { normal: 1, grande: 5 }

// ── desfazer e refazer (pilha pequena) ──
export interface Hist<T> { passado: T[]; futuro: T[]; chave: string | null }
export const histVazio = <T,>(): Hist<T> => ({ passado: [], futuro: [], chave: null })
const PILHA_MAX = 50

/** Guarda o estado de ANTES da edição. Edições seguidas com a mesma `chave` (digitar num campo) viram um passo só. */
export function registrar<T>(h: Hist<T>, antes: T, chave: string | null = null): Hist<T> {
  if (chave && h.chave === chave) return { ...h, futuro: [] }
  return { passado: [...h.passado, antes].slice(-PILHA_MAX), futuro: [], chave }
}
export function desfazer<T>(h: Hist<T>, atual: T): { hist: Hist<T>; estado: T } | null {
  if (!h.passado.length) return null
  return { estado: h.passado[h.passado.length - 1], hist: { passado: h.passado.slice(0, -1), futuro: [atual, ...h.futuro], chave: null } }
}
export function refazer<T>(h: Hist<T>, atual: T): { hist: Hist<T>; estado: T } | null {
  if (!h.futuro.length) return null
  return { estado: h.futuro[0], hist: { passado: [...h.passado, atual].slice(-PILHA_MAX), futuro: h.futuro.slice(1), chave: null } }
}

// ── lote e CSV ──
/** Divide em partes de até `loteMax` (50): a impressão em lote é uma parte por vez. */
export function partesDoLote<T>(lista: T[], tamanho = LIMITES.loteMax): T[][] {
  const partes: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) partes.push(lista.slice(i, i + tamanho))
  return partes
}

export interface LinhaEmitida { nome: string; codigo: string; emitidoEm: string; /** "Ativo" (padrão) ou "Revogado em DD/MM/AAAA" */ situacao?: string }
/** Só nome, código, data e situação: nenhum outro dado pessoal sai no arquivo. */
export const csvEmitidos = (linhas: LinhaEmitida[]): string =>
  toCsv(linhas.map(l => ({ Nome: l.nome, 'Código': l.codigo, 'Emitido em': l.emitidoEm, 'Situação': l.situacao ?? 'Ativo' })), ['Nome', 'Código', 'Emitido em', 'Situação'])

/** "2026-06-15" -> "15 de junho de 2026"; data ausente ou inválida -> "" */
export function dataLonga(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return ''
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}
