// Cálculos puros do planejamento de eventos (Evo). Sem Deno, sem rede: roda na Edge Function
// (supabase/functions/agent) e no vitest (app/src/test/planejar.test.ts).
// Os números saem daqui, nunca do modelo: ele chama a ferramenta e cita a `fonte`.

export type Layout = 'em_pe' | 'mesas' | 'plateia'

export const AVISO_NORMAS =
  'Referência: Corpo de Bombeiros de SP (2025). Varia por estado. Não substitui o projeto técnico nem o AVCB.'

// Tira o ruído de ponto flutuante antes de arredondar para cima (0,02 × 850 = 17,000000000000004).
const acima = (x: number) => Math.ceil(x - 1e-9)

function inteiro(valor: unknown, nome: string, min: number, max: number): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < min || valor > max) {
    throw new Error(`${nome} deve ser um número inteiro entre ${min} e ${max}.`)
  }
  return valor
}

function numero(valor: unknown, nome: string, min: number, max: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < min || valor > max) {
    throw new Error(`${nome} deve ser um número entre ${min} e ${max}.`)
  }
  return valor
}

const publicoValido = (p: unknown) => inteiro(p, 'O público', 1, 200000)
// ponytail: teto de 72 h cobre festival de 3 dias; evento maior se planeja por dia
const duracaoValida = (d: unknown) => numero(d, 'A duração (horas)', 0.5, 72)

export function normas({ publico, layout, lugares_sentados }: { publico: number; layout: Layout; lugares_sentados?: number }) {
  publicoValido(publico)
  if (!['em_pe', 'mesas', 'plateia'].includes(layout)) throw new Error('O leiaute deve ser em_pe, mesas ou plateia.')
  if (lugares_sentados !== undefined && lugares_sentados !== null) inteiro(lugares_sentados, 'Os lugares sentados', 1, 200000)

  const unidades = Math.ceil(publico / 100)
  const dois = publico > 300

  let brigadistas: number
  if (publico <= 1000) brigadistas = 5
  else if (publico <= 2500) brigadistas = 10
  else if (publico <= 5000) brigadistas = 15
  else if (publico <= 10000) brigadistas = 20
  else brigadistas = 20 + Math.ceil((publico - 10000) / 500)

  const n = lugares_sentados ?? publico
  const pcd = n <= 1000 ? Math.max(1, acima((2 * n) / 100)) : 20 + acima((n - 1000) / 100)

  return {
    saidas: {
      unidades_de_passagem: unidades,
      largura_total_m: Math.round(unidades * 55) / 100,
      fonte: 'IT 11/2025 CB-SP, 4.4.1 e Tabela 1',
    },
    largura_minima_por_saida_m: { valor: 1.2, fonte: 'IT 11/2025, 4.4.2' },
    saidas_minimas: {
      valor: dois ? 2 : 1,
      distancia_minima_entre_saidas_m: dois ? 10 : null,
      fonte: 'IT 11/2025, 4.4.3.4',
    },
    antipanico: { exigido: publico > 100, fonte: 'IT 11/2025, 4.5.4.6' },
    area_minima_m2: {
      valor: layout === 'em_pe' ? publico / 2 : layout === 'mesas' ? acima((publico * 67) / 100) : null,
      observacao: layout === 'plateia' ? 'Em plateia a área sai do leiaute das fileiras e corredores, não de uma conta por pessoa.' : undefined,
      fonte: 'IT 11/2025, Tabela 1 e nota P',
    },
    brigadistas: { valor: brigadistas, fonte: 'IT 17/2025 CB-SP, 4.11.2' },
    pcd: {
      base_lugares: n,
      cadeira_de_rodas: pcd,
      assentos_pcd_mobilidade: pcd,
      espaco_cadeira_m: '0,80 × 1,20',
      fonte: 'Decreto 5.296/2004, art. 23; NBR 9050:2020, 10.3',
    },
    aviso: AVISO_NORMAS,
  }
}

export function estimarConsumo({ formato, publico, duracao_h }: { formato?: string; publico: number; duracao_h: number }) {
  publicoValido(publico)
  duracaoValida(duracao_h)
  const f = duracao_h / 4.5
  const copos = publico * 2 + publico * Math.floor(duracao_h / 2)
  return {
    formato: formato ?? null,
    itens: [
      { item: 'cerveja', unidade: 'L', min: acima(publico * 1 * f), max: acima(publico * 2 * f) },
      { item: 'agua', unidade: 'L', min: acima(publico * 0.5 * f), max: acima(publico * 1 * f) },
      { item: 'gelo', unidade: 'kg', min: acima(publico * 0.5), max: acima(publico * 1) },
      { item: 'copos', unidade: 'un', min: copos, max: copos },
    ],
    fonte: 'Heurística pública de varejo (iFood 2025; Divvino 2025) — sem método publicado; ajuste com seus dados',
    observacao: 'Ainda não há dado de consumo por formato de evento; a estimativa é a mesma para todos. A Evokaa vai aprender com os eventos reais.',
  }
}

export function sugerirLotes({ preco_alvo, capacidade }: { preco_alvo: number; capacidade: number }) {
  numero(preco_alvo, 'O preço-alvo', 1, 100000)
  inteiro(capacidade, 'A capacidade', 1, 200000)
  const q1 = Math.floor(capacidade * 0.3)
  const q2 = Math.floor(capacidade * 0.4)
  const lotes = [
    { nome: '1º lote', quantidade: q1, preco: Math.round(preco_alvo * 0.85) },
    { nome: '2º lote', quantidade: q2, preco: Math.round(preco_alvo) },
    { nome: '3º lote', quantidade: capacidade - q1 - q2, preco: Math.round(preco_alvo * 1.2) },
  ].filter(l => l.quantidade > 0) // capacidade < 4 zera os primeiros lotes
  return { lotes, sugestao_editavel: true as const }
}

const CATEGORIAS = [
  ['local', 'Local (aluguel do espaço)'],
  ['som_luz', 'Som e luz'],
  ['atracao', 'Atração (artistas, DJ, cachê)'],
  ['seguranca', 'Segurança'],
  ['brigada', 'Brigada de incêndio'],
  ['bar_bebidas', 'Bar e bebidas'],
  ['limpeza', 'Limpeza'],
  ['divulgacao', 'Divulgação'],
  ['taxas_plataforma', 'Taxas da plataforma'],
  ['impostos', 'Impostos'],
] as const

export function checklistOrcamento({ publico, duracao_h, uf }: { publico: number; duracao_h: number; uf: string }) {
  if (typeof uf !== 'string' || !/^[A-Za-z]{2}$/.test(uf)) throw new Error('A UF deve ter 2 letras.')
  const brigada = normas({ publico, layout: 'em_pe' }).brigadistas
  const consumo = estimarConsumo({ publico, duracao_h })
  return {
    uf: uf.toUpperCase(),
    categorias: CATEGORIAS.map(([categoria, rotulo]) => {
      if (categoria === 'brigada') return { categoria, rotulo, calculado: { pessoas: brigada.valor }, fonte: brigada.fonte }
      if (categoria === 'bar_bebidas') return { categoria, rotulo, calculado: { quantidades: consumo.itens }, fonte: consumo.fonte }
      return { categoria, rotulo, pergunte_ao_produtor: true as const }
    }),
    observacao: 'Os valores em reais dependem dos fornecedores da sua região: peça orçamentos e preencha. A Evokaa não sugere preço de fornecedor.',
    aviso: AVISO_NORMAS,
  }
}

// Data AAAA-MM-DD anterior a hoje (mesmo formato; texto nesse formato compara como data).
// Formato errado não conta como passado: a validação da proposta recusa por outro motivo.
export const dataPassada = (data: unknown, hoje: string) =>
  typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data) && data < hoje
