import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { ErroTela, falhar } from './useCartao'
import { SEM_SQL_DO_QUADRO } from './useProducerTools'

// Fatia 2C: botões próprios, modelos por tipo de evento, papéis, recorrência e coluna de revisão.
// Antes do SQL as tabelas, funções e colunas não existem: tudo devolve "indisponível" e a tela fica como era (modo antigo).
// ponytail: cliente sem tipos (`any` do supabase-js), como em useCartao: os tipos gerados do banco estão desatualizados.
const db = supabase as unknown as SupabaseClient

/** "Isto ainda não existe no banco": tabela ou função ausente, ou 42703 (coluna nova ainda não criada) */
const semSql = (e: { code?: string }) => !!e.code && [...SEM_SQL_DO_QUADRO, '42703'].includes(e.code)
const objeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Erros ───
// Lista FECHADA das mensagens em português que o nosso SQL levanta (docs/sql/20261107_quadro_f2c_botoes_modelos.sql) e que podem ir para a tela,
// como erro de ação ou como motivo de cartão ignorado. Para acrescentar uma, acrescente aqui e no SQL. Qualquer outro texto nunca aparece.
export const MENSAGENS_DO_SQL = new Set([
  'O cartão não é deste quadro.', 'Escolha um evento: o modelo usa a data dele.', 'Defina a data do evento antes de aplicar o modelo.', 'Modelo desconhecido.',
  'No máximo 60 cartões por vez.', 'O quadro não tem coluna.', 'Este cartão não se repete.', 'Cartão arquivado não se repete.',
  'Já foi gerada uma cópia hoje. A próxima pode ser gerada amanhã.', 'Passos do botão inválidos.', 'Coluna de outro quadro.',
  'Passo mover com coluna de outro quadro.', 'Passo etiqueta com etiqueta de outro quadro.', 'Coluna de revisão de outro quadro.',
  'Essa pessoa não tem acesso ao quadro deste produtor.', 'Um passo falhou neste cartão.', 'Sem mudança.', 'Cartão arquivado.',
  'A coluna de destino do passo mover não existe mais.', 'A etiqueta do passo não existe mais.',
  'Limite de 200 cartões por execução: rode de novo para os demais.',
])
const PADROES_DO_SQL = [
  /^Papel “[^”\n]{1,40}” sem pessoa definida\.$/u, /^Papel “[^”\n]{1,40}”: a pessoa saiu da equipe\.$/u,
  /^Limite de \d{1,4} [\p{L} ]{1,40}\.$/u, // "Limite de 30 anexos por cartão." (2A e 2B)
]
export const mensagemConhecida = (msg: unknown): msg is string => typeof msg === 'string' && (MENSAGENS_DO_SQL.has(msg) || PADROES_DO_SQL.some(p => p.test(msg)))
const MOTIVO_GENERICO = 'Não foi possível neste cartão.'
/** Como `falhar` de useCartao, mas deixa passar as mensagens da lista fechada (P0001, 22023, 23514) */
export function falharAcao(error: { message?: string; code?: string }): never {
  if (['P0001', '22023', '23514'].includes(error.code ?? '') && mensagemConhecida(error.message)) {
    throw Object.assign(new ErroTela(error.message), { code: error.code })
  }
  return falhar(error)
}
async function chamar(nome: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await db.rpc(nome, args)
  if (error) falharAcao(error)
  return data
}

// ─── Papéis ───
export const PAPEIS = [
  { slug: 'portaria', nome: 'Portaria' }, { slug: 'divulgacao', nome: 'Divulgação' }, { slug: 'fornecedores', nome: 'Fornecedores' },
  { slug: 'financeiro', nome: 'Financeiro' }, { slug: 'juridico', nome: 'Jurídico' }, { slug: 'revisao', nome: 'Revisão' },
] as const
export type Papel = (typeof PAPEIS)[number]['slug']
export const nomeDoPapel = (slug: string) => PAPEIS.find(p => p.slug === slug)?.nome ?? slug
const ehPapel = (v: unknown): v is Papel => PAPEIS.some(p => p.slug === v)

// ─── Botões ───
export type TipoPasso = 'mover' | 'atribuir' | 'avisar' | 'etiqueta' | 'prazo' | 'arquivar'
export interface PassoBotao { t: TipoPasso; v?: string | number }
export const TIPOS_PASSO: { tipo: TipoPasso; rotulo: string }[] = [
  { tipo: 'mover', rotulo: 'Mover para' }, { tipo: 'atribuir', rotulo: 'Atribuir ao papel' }, { tipo: 'avisar', rotulo: 'Avisar o papel' },
  { tipo: 'etiqueta', rotulo: 'Adicionar etiqueta' }, { tipo: 'prazo', rotulo: 'Prazo daqui a' }, { tipo: 'arquivar', rotulo: 'Arquivar o cartão' },
]
export const MAX_PASSOS = 6
export const MAX_BOTOES = 50
const MAX_NOME_BOTAO = 40
/** `<`, `>`, caracteres de controle e os de direção de texto (U+202A a U+202E, U+2066 a U+2069) */
// eslint-disable-next-line no-control-regex -- barrar caractere de controle é justamente o objetivo
const NOME_PROIBIDO = /[<>\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/
export interface BotaoQuadro {
  id: string; board_id: string; name: string; scope: 'card' | 'board'; column_id: string | null; steps: PassoBotao[]; position: number
  /** O banco tem passos que esta tela não entende (tipo novo, valor fora do formato): editar aqui salvaria uma lista menor, então só leitura */
  somenteLeitura: boolean
}
export interface NovoBotao { name: string; scope: 'card' | 'board'; columnId: string | null; steps: PassoBotao[] }
export interface ResultadoBotao { afetados: number; ignorados: number; motivos: string[] }

/** Passo bem formado: tipo da lista fechada e valor do formato certo (uuid, papel, 1 a 30 dias); arquivar não leva valor */
function passoValido(p: unknown): p is PassoBotao {
  if (!objeto(p) || !TIPOS_PASSO.some(t => t.tipo === p.t)) return false
  switch (p.t) {
    case 'mover': case 'etiqueta': return typeof p.v === 'string' && UUID.test(p.v)
    case 'atribuir': case 'avisar': return ehPapel(p.v)
    case 'prazo': return Number.isInteger(p.v) && (p.v as number) >= 1 && (p.v as number) <= 30
    default: return p.v === undefined
  }
}
function conferirBotao(b: NovoBotao) {
  const name = b.name.trim()
  if (!name) throw new ErroTela('Nome do botão: escreva alguma coisa')
  if (NOME_PROIBIDO.test(name)) throw new ErroTela('Nome do botão: não use < >, caracteres de controle nem de direção de texto')
  if (name.length > MAX_NOME_BOTAO) throw new ErroTela(`Nome do botão: no máximo ${MAX_NOME_BOTAO} caracteres`)
  if (!b.steps.length) throw new ErroTela('Escolha pelo menos um passo')
  if (b.steps.length > MAX_PASSOS) throw new ErroTela(`No máximo ${MAX_PASSOS} passos`)
  if (!b.steps.every(passoValido)) throw new ErroTela('Há um passo incompleto')
  if (b.scope === 'board' && !(b.columnId && UUID.test(b.columnId))) throw new ErroTela('Escolha a coluna em que o botão age')
  return { name, scope: b.scope, column_id: b.scope === 'board' ? b.columnId : null, steps: b.steps.map(p => (p.t === 'arquivar' ? { t: p.t } : { t: p.t, v: p.v })) }
}
function botaoDaLinha(l: unknown): BotaoQuadro | null {
  if (!objeto(l) || typeof l.id !== 'string' || typeof l.name !== 'string' || (l.scope !== 'card' && l.scope !== 'board') || !Array.isArray(l.steps)) return null
  const steps = l.steps.filter(passoValido)
  return { id: l.id, board_id: String(l.board_id ?? ''), name: l.name, scope: l.scope, column_id: typeof l.column_id === 'string' ? l.column_id : null,
    steps, position: Number(l.position) || 0, somenteLeitura: steps.length !== l.steps.length }
}
function resultadoDaResposta(d: unknown): ResultadoBotao {
  const o = objeto(d) ? d : {}
  const n = (x: unknown) => (Number.isInteger(x) && (x as number) >= 0 ? (x as number) : 0)
  // motivo fora da lista fechada vira a frase genérica (nunca texto de constraint ou de função)
  const motivos = Array.isArray(o.motivos) ? [...new Set(o.motivos.slice(0, 20).map(x => (mensagemConhecida(x) ? x : MOTIVO_GENERICO)))] : []
  return { afetados: n(o.afetados), ignorados: n(o.ignorados), motivos }
}

// ─── Modelos ───
export const TIPOS_MODELO = [
  { chave: 'show', nome: 'Show' }, { chave: 'festa', nome: 'Festa' }, { chave: 'curso', nome: 'Curso' }, { chave: 'congresso', nome: 'Congresso' },
] as const
export type TipoModelo = (typeof TIPOS_MODELO)[number]['chave']
/** Como vem de task_templates.items: `vinculos` (atalhos) e `checklist` (textos) são opcionais e a tela não os usa */
export interface ItemModelo { titulo: string; papel: string; dias: number }
export interface Modelo { key: string; name: string; items: ItemModelo[] }
const itemValido = (i: unknown): i is ItemModelo =>
  objeto(i) && typeof i.titulo === 'string' && typeof i.papel === 'string' && Number.isInteger(i.dias)
/** "D-45" (antes do evento) ou "D+1" (depois) */
export const rotuloDias = (dias: number) => (dias > 0 ? `D-${dias}` : dias === 0 ? 'D0' : `D+${-dias}`)

// ─── Invalidação ───
/** Depois de qualquer ação que mexe em cartões: lista de cartões, resumo do quadro e verso/atividade */
function useRecarregarCartoes() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['producer-tasks'] })
    qc.invalidateQueries({ queryKey: ['cartao-resumo'] })
    qc.invalidateQueries({ queryKey: ['cartao-detalhe'] })
  }
}

// ─── Configuração do quadro: quem pode editar, dono, coluna de revisão ───
export interface ConfigAcoes { disponivel: boolean; dono: boolean; podeEditar: boolean; revisaoId: string | null }
const SEM_CONFIG: ConfigAcoes = { disponivel: false, dono: false, podeEditar: false, revisaoId: null }

/** `disponivel` false = banco sem a coluna review_column_id (SQL da 2C): nenhum item novo funciona. Quem só vê tem podeEditar false */
export function useConfigAcoes(boardId: string | null | undefined) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const chave = ['quadro-acoes-cfg', boardId, user?.id]
  const q = useQuery({
    queryKey: chave,
    enabled: !!boardId && !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<ConfigAcoes> => {
      const { data, error } = await db.from('task_boards').select('producer_id, review_column_id').eq('id', boardId).maybeSingle()
      if (error) { if (semSql(error)) return SEM_CONFIG; throw error }
      if (!objeto(data) || typeof data.producer_id !== 'string') return SEM_CONFIG
      const dono = data.producer_id === user!.id
      let podeEditar = dono
      if (!dono) {
        const r = await db.rpc('equipe_pode', { p_produtor: data.producer_id, p_ferramenta: 'quadro', p_nivel: 'editar' })
        podeEditar = !r.error && r.data === true // na dúvida, só vê
      }
      return { disponivel: true, dono, podeEditar, revisaoId: typeof data.review_column_id === 'string' ? data.review_column_id : null }
    },
  })
  const definirRevisao = useMutation({
    mutationFn: async (colunaId: string | null) => {
      if (colunaId !== null && !UUID.test(colunaId)) throw new ErroTela('Coluna inválida')
      const { data, error } = await db.from('task_boards').update({ review_column_id: colunaId }).eq('id', boardId).select('id')
      if (error) falharAcao(error)
      if (!data?.length) falhar({ code: '42501' }) // a RLS esconde sem erro: 0 linhas = não gravou
    },
    onMutate: async colunaId => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<ConfigAcoes>(chave)
      if (antes) qc.setQueryData<ConfigAcoes>(chave, { ...antes, revisaoId: colunaId })
      return { antes }
    },
    onError: (_e, _v, ctx) => { if (ctx?.antes) qc.setQueryData(chave, ctx.antes) },
    onSettled: () => qc.invalidateQueries({ queryKey: chave }),
  })
  return { config: q.data ?? SEM_CONFIG, carregando: q.isPending && !!boardId, definirRevisao }
}

// ─── Papéis ───
export interface PessoaPapel { id: string; nome: string }

/** Quem é cada papel no quadro. `disponivel` false = sem a tabela task_roles */
export function usePapeis(boardId: string | null | undefined) {
  const qc = useQueryClient()
  const chave = ['quadro-papeis', boardId]
  const q = useQuery({
    queryKey: chave,
    enabled: !!boardId,
    queryFn: async (): Promise<{ disponivel: boolean; mapa: Partial<Record<Papel, string>> }> => {
      const { data, error } = await db.from('task_roles').select('papel, user_id').eq('board_id', boardId)
      if (error) { if (semSql(error)) return { disponivel: false, mapa: {} }; throw error }
      const mapa: Partial<Record<Papel, string>> = {}
      for (const l of data ?? []) if (ehPapel(l.papel) && typeof l.user_id === 'string') mapa[l.papel] = l.user_id
      return { disponivel: true, mapa }
    },
  })
  /** userId null = ninguém. Update por (quadro, papel); sem linha, insert; 23505 = outra aba criou agora: tenta o update de novo. Nunca upsert */
  const definir = useMutation({
    mutationFn: async (v: { papel: Papel; userId: string | null }) => {
      if (!ehPapel(v.papel) || (v.userId !== null && !UUID.test(v.userId))) throw new ErroTela('Papel ou pessoa inválidos')
      if (v.userId === null) {
        const { error } = await db.from('task_roles').delete().eq('board_id', boardId).eq('papel', v.papel)
        if (error) falharAcao(error)
        return
      }
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const up = await db.from('task_roles').update({ user_id: v.userId }).eq('board_id', boardId).eq('papel', v.papel).select('papel')
        if (up.error) falharAcao(up.error)
        if (up.data?.length) return
        const ins = await db.from('task_roles').insert({ board_id: boardId, papel: v.papel, user_id: v.userId })
        if (!ins.error) return
        if (ins.error.code !== '23505') falharAcao(ins.error)
      }
      falhar({ code: '42501' })
    },
    onMutate: async v => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<{ disponivel: boolean; mapa: Partial<Record<Papel, string>> }>(chave)
      if (antes) {
        const mapa = { ...antes.mapa }
        if (v.userId) mapa[v.papel] = v.userId; else delete mapa[v.papel]
        qc.setQueryData(chave, { ...antes, mapa })
      }
      return { antes }
    },
    onError: (_e, _v, ctx) => { if (ctx?.antes) qc.setQueryData(chave, ctx.antes) },
    onSettled: () => qc.invalidateQueries({ queryKey: chave }),
  })
  return { disponivel: q.data?.disponivel ?? false, mapa: q.data?.mapa ?? {}, carregando: q.isPending && !!boardId, erro: q.isError, definir }
}

/** Pessoas que podem assumir um papel (RPC: só id e nome, nunca e-mail). Falha ou RPC ausente = lista vazia */
export function usePessoasSugeridas(boardId: string | null | undefined, ativo = true) {
  return useQuery({
    queryKey: ['quadro-papeis-sugestao', boardId],
    enabled: !!boardId && ativo,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<PessoaPapel[]> => {
      const { data, error } = await db.rpc('quadro_papeis_sugerir', { p_board: boardId })
      if (error?.code === '42501') throw error // sem permissão (ou 2FA): a tela avisa em vez de mostrar "Ninguém"
      if (error || !Array.isArray(data)) return []
      return data.filter((p): p is { id: string; nome?: unknown } => objeto(p) && typeof p.id === 'string' && UUID.test(p.id))
        .map(p => ({ id: p.id, nome: typeof p.nome === 'string' && p.nome.trim() ? p.nome.trim().slice(0, 80) : 'Sem nome' }))
    },
  })
}

// ─── Botões ───
/** Botões do quadro + criar, editar, apagar e rodar. `disponivel` false = sem a tabela task_buttons */
export function useBotoes(boardId: string | null | undefined) {
  const qc = useQueryClient()
  const recarregar = useRecarregarCartoes()
  const chave = ['quadro-botoes', boardId]
  const q = useQuery({
    queryKey: chave,
    enabled: !!boardId,
    queryFn: async (): Promise<{ disponivel: boolean; botoes: BotaoQuadro[] }> => {
      const { data, error } = await db.from('task_buttons').select('id, board_id, name, scope, column_id, steps, position').eq('board_id', boardId).order('position').order('created_at')
      if (error) { if (semSql(error)) return { disponivel: false, botoes: [] }; throw error }
      return { disponivel: true, botoes: (data ?? []).map(botaoDaLinha).filter((b): b is BotaoQuadro => !!b) }
    },
  })
  const botoes = q.data?.botoes ?? []
  const depois = () => qc.invalidateQueries({ queryKey: chave })

  const criar = useMutation({
    mutationFn: async (v: NovoBotao) => {
      const campos = conferirBotao(v)
      if (botoes.length >= MAX_BOTOES) throw new ErroTela(`Máximo de ${MAX_BOTOES} botões por quadro`)
      const position = (botoes.length ? Math.max(...botoes.map(b => b.position)) : 0) + 1000
      const { error } = await db.from('task_buttons').insert({ board_id: boardId, ...campos, position })
      if (error) falharAcao(error)
    },
    onSettled: depois,
  })
  const editar = useMutation({
    mutationFn: async (v: NovoBotao & { id: string }) => {
      const { name, column_id, steps } = conferirBotao(v) // o escopo não muda depois de criado (o grant de update não o cobre)
      const { data, error } = await db.from('task_buttons').update({ name, column_id, steps }).eq('id', v.id).select('id')
      if (error) falharAcao(error)
      if (!data?.length) falhar({ code: '42501' })
    },
    onSettled: depois,
  })
  const apagar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('task_buttons').delete().eq('id', id)
      if (error) falharAcao(error)
    },
    onMutate: async id => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<{ disponivel: boolean; botoes: BotaoQuadro[] }>(chave)
      if (antes) qc.setQueryData(chave, { ...antes, botoes: antes.botoes.filter(b => b.id !== id) })
      return { antes }
    },
    onError: (_e, _v, ctx) => { if (ctx?.antes) qc.setQueryData(chave, ctx.antes) },
    onSettled: depois,
  })
  /** Botão de cartão leva `task`; botão de quadro age em todos os cartões da coluna dele */
  const rodar = useMutation({
    mutationFn: async (v: { button: string; task?: string }): Promise<ResultadoBotao> => {
      if (!UUID.test(v.button) || (v.task !== undefined && !UUID.test(v.task))) throw new ErroTela('Botão ou cartão inválidos')
      return resultadoDaResposta(await chamar('quadro_rodar_botao', { p_button: v.button, p_task: v.task ?? null }))
    },
    onSettled: recarregar,
  })
  return { disponivel: q.data?.disponivel ?? false, botoes, carregando: q.isPending && !!boardId, erro: q.isError, criar, editar, apagar, rodar }
}

// ─── Modelos por tipo de evento ───
/** Modelos (task_templates, só leitura) + aplicar. `disponivel` false = sem a tabela ou sem a semente */
export function useModelos(boardId: string | null | undefined) {
  const recarregar = useRecarregarCartoes()
  const q = useQuery({
    queryKey: ['quadro-modelos'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ disponivel: boolean; modelos: Modelo[] }> => {
      const { data, error } = await db.from('task_templates').select('key, name, items')
      if (error) { if (semSql(error)) return { disponivel: false, modelos: [] }; throw error }
      const modelos = (data ?? []).flatMap((l): Modelo[] =>
        objeto(l) && typeof l.key === 'string' && typeof l.name === 'string' && Array.isArray(l.items)
          ? [{ key: l.key, name: l.name, items: l.items.filter(itemValido).map(i => ({ titulo: i.titulo, papel: i.papel, dias: i.dias })) }] : [])
      return { disponivel: true, modelos }
    },
  })
  /** `itens` = índices marcados na lista do modelo; só eles vão para o banco */
  const aplicar = useMutation({
    mutationFn: async (v: { kind: TipoModelo; itens: number[] }): Promise<{ criados: number; existentes: number }> => {
      if (!TIPOS_MODELO.some(t => t.chave === v.kind)) throw new ErroTela('Tipo de evento inválido')
      if (!v.itens.length) throw new ErroTela('Marque pelo menos um item')
      const d = await chamar('quadro_aplicar_modelo', { p_board: boardId, p_kind: v.kind, p_itens: v.itens })
      const o = objeto(d) ? d : {}
      return { criados: Number.isInteger(o.criados) ? (o.criados as number) : 0, existentes: Number.isInteger(o.existentes) ? (o.existentes as number) : 0 }
    },
    onSettled: recarregar,
  })
  return { disponivel: q.data?.disponivel ?? false, modelos: q.data?.modelos ?? [], carregando: q.isPending, erro: q.isError, aplicar }
}

// ─── Recorrência ───
/** Gera agora a cópia do cartão que se repete (nasce na primeira coluna, com o checklist zerado) */
export function useGerarRecorrente() {
  const recarregar = useRecarregarCartoes()
  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!UUID.test(taskId)) throw new ErroTela('Cartão inválido')
      await chamar('quadro_gerar_recorrente', { p_task: taskId })
    },
    onSettled: recarregar,
  })
}
