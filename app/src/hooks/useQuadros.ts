import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { ErroTela } from './useCartao'
import { atrasada } from '../lib/tarefas'
import type { ColunaQuadro, DbTask } from './useProducerTools'

// Camada de dados da tela "Meus quadros" (docs/sql/20261108_quadro_f2f_varios_quadros.sql, fatia F do banco).
// ponytail: cliente sem tipos (`any` do supabase-js), como useCartao: os tipos gerados do banco estão desatualizados.
const db = supabase as unknown as SupabaseClient

// ─── Tipos (espelham as colunas do SQL) ───
export type KindQuadro = 'evento' | 'equipe' | 'pessoal'
export type VisQuadro = 'pessoal' | 'equipe' | 'escolhidas'
export type NivelQuadro = 'ver' | 'editar'
export type CorQuadro = 'violeta' | 'azul' | 'verde' | 'marinho'
export interface QuadroLinha {
  id: string; producer_id: string; event_id: string | null; name: string; kind: KindQuadro; visibility: VisQuadro
  description: string | null; color: CorQuadro | null; archived_at: string | null; template_key: string | null
  position: number | null; created_by: string | null; is_default: boolean; created_at: string
}
export interface ColunaModelo { name: string; kind: 'todo' | 'doing' | 'done' }
export interface CartaoModelo { titulo: string; coluna: number; papel?: string; dias?: number; vinculos?: string[] }
export interface ModeloQuadro {
  key: string; name: string; description: string | null; kind_sugerido: KindQuadro
  columns: ColunaModelo[]; cards: CartaoModelo[]; owner_id: string | null
}
export interface MembroQuadro { board_id: string; user_id: string; nivel: NivelQuadro }
export interface PessoaEquipe { id: string; nome: string }
export interface ContagemQuadro { abertos: number; atrasados: number }

// Tetos do banco (o gatilho é quem garante; aqui só para avisar antes)
export const LIMITE_QUADROS = 30
export const LIMITE_PESSOAS = 50
export const LIMITE_MODELOS = 20
export const NOME_MAX = 40

export const COR_DO_QUADRO: Record<CorQuadro, string> = { violeta: '#8f33f5', azul: '#3f7fe0', verde: '#1f9d8f', marinho: '#0c2340' }
export const ROTULO_COR: Record<CorQuadro, string> = { violeta: 'Violeta', azul: 'Azul', verde: 'Verde', marinho: 'Marinho' }
const COR_PADRAO: Record<KindQuadro, CorQuadro> = { evento: 'violeta', equipe: 'verde', pessoal: 'marinho' }
export const corDoQuadro = (b: Pick<QuadroLinha, 'color' | 'kind'>) => COR_DO_QUADRO[b.color ?? COR_PADRAO[b.kind]]
export const ROTULO_KIND: Record<KindQuadro, string> = { pessoal: 'Pessoal', equipe: 'Equipe e empresa', evento: 'Evento' }
export const ROTULO_VIS: Record<VisQuadro, string> = { pessoal: 'Só eu', equipe: 'Equipe toda', escolhidas: 'Pessoas escolhidas' }

// ─── Funções puras ───
// Mesma regra de quadro_texto_ok do SQL: sem < >, controle, formatação bidirecional nem caracteres invisíveis
// eslint-disable-next-line no-control-regex -- os caracteres de controle são justamente o que o banco (quadro_texto_ok) recusa
const PROIBIDOS = /[<>\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\u200b-\u200f\u061c\ufeff\u2060\u3164\u00ad\u2028\u2029\u115f\u1160\u180e]/
/** '' = nome válido; senão a frase para a tela */
export function validarNome(v: string, quem = 'quadro'): string {
  const n = v.trim()
  if (!n) return `Digite um nome para o ${quem}.`
  if ([...n].length > NOME_MAX) return `O nome pode ter no máximo ${NOME_MAX} caracteres.`
  if (PROIBIDOS.test(n)) return 'O nome não pode ter os sinais < ou >, nem caracteres de controle ou invisíveis.'
  return ''
}

// Mensagens em português que o SQL levanta e podem ir para a tela (lista fechada; o resto vira frase genérica)
const MENSAGENS_DO_BANCO = new Set([
  'O nome do quadro deve ter de 1 a 40 caracteres, sem < ou >.', 'O nome do modelo deve ter de 1 a 40 caracteres, sem < ou >.',
  'Tipo de quadro inválido.', 'Escolha um evento seu para o quadro.', 'Só quadro de evento leva um evento.', 'Visibilidade inválida.',
  'Lista de pessoas inválida.', 'Limite de 50 pessoas por quadro.', 'Cada pessoa precisa de user_id e nível (ver ou editar).',
  'Pessoa repetida na lista.', 'Só pessoas ativas da sua equipe podem entrar no quadro.', 'Modelo de quadro não encontrado.',
  'Limite de 30 quadros por produtor (os arquivados contam).', 'Limite de 20 modelos de quadro por produtor.',
  'Sem permissão para este quadro.', 'O quadro padrão é da equipe toda e não muda.', 'Quadro pessoal só pode ser pessoal.',
  'O quadro padrão não pode ser arquivado.', 'O quadro padrão é da equipe toda e não pode ser arquivado.', 'Diga se é para arquivar ou desarquivar.',
  'Este quadro não vira modelo: precisa de 2 a 12 colunas, com ao menos uma de "a fazer" e uma de "feito".',
  'Só o dono ou alguém ativo da equipe pode entrar no quadro.',
])
const GENERICA = 'Não foi possível concluir. Tente de novo.'

/** Frase em português para um erro do banco. 42501 = sem permissão (ou sem 2FA); CHECKs do UPDATE direto viram a frase do nome */
export function textoDoErroQuadro(error: { message?: string; code?: string }): string {
  const msg = error.message ?? ''
  if (['22023', '23514', '42501'].includes(error.code ?? '') && MENSAGENS_DO_BANCO.has(msg)) return msg
  if (error.code === '42501') return 'Sem permissão para esta ação.'
  if (error.code === '23514' && /task_boards_nome_ck/.test(msg)) return 'O nome do quadro deve ter de 1 a 40 caracteres, sem < ou >.'
  if (error.code === '23514' && /task_boards_descricao_ck/.test(msg)) return 'A descrição deve ter até 200 caracteres, sem < ou >.'
  if (import.meta.env.DEV) console.error('[quadros]', error)
  return GENERICA
}
function falharQuadro(error: { message?: string; code?: string }): never {
  throw Object.assign(new ErroTela(textoDoErroQuadro(error)), { code: error.code })
}
/** Texto seguro para a tela: só erros nossos; o resto vira a frase genérica */
export const mensagemQuadro = (e: unknown) => (e instanceof ErroTela ? e.message : GENERICA)

export const visibilidadePadrao = (k: KindQuadro): VisQuadro => (k === 'pessoal' ? 'pessoal' : 'equipe')

/** Escolha da tela ({id: nível}) no formato de p_membros: [{user_id, nivel}] */
export const membrosParaRpc = (sel: Record<string, NivelQuadro>) => Object.entries(sel).map(([user_id, nivel]) => ({ user_id, nivel }))

/** "D-45" antes do evento, "D+3" depois, "D0" no dia (como o protótipo e o modelo de cartão) */
export const rotuloDias = (d: number) => (d > 0 ? `D-${d}` : d === 0 ? 'D0' : `D+${-d}`)

export type FiltroQuadro = 'todos' | KindQuadro
export type OrdemQuadro = 'recentes' | 'az' | 'prazo'
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Arquivados ou ativos, por tipo e por trecho do nome (sem acento nem caixa) */
export function filtrarQuadros(lista: QuadroLinha[], o: { busca: string; filtro: FiltroQuadro; arquivados: boolean }) {
  const termo = semAcento(o.busca.trim())
  return lista.filter(b => !!b.archived_at === o.arquivados && (o.filtro === 'todos' || b.kind === o.filtro) && (!termo || semAcento(b.name).includes(termo)))
}

/** `prazoDe` devolve o dia (AAAA-MM-DD) do quadro, se houver (a data do evento); sem prazo vai para o fim */
export function ordenarQuadros(lista: QuadroLinha[], ordem: OrdemQuadro, prazoDe: (b: QuadroLinha) => string | null) {
  return lista.slice().sort((a, b) => {
    if (ordem === 'az') return a.name.localeCompare(b.name, 'pt-BR')
    if (ordem === 'prazo') {
      const x = prazoDe(a), y = prazoDe(b)
      return x && y ? x.localeCompare(y) : x ? -1 : y ? 1 : 0
    }
    return b.created_at.localeCompare(a.created_at)
  })
}

/** Abertos (não arquivados, fora da coluna "feito") e atrasados por quadro */
export function contarPorQuadro(tarefas: Pick<DbTask, 'board_id' | 'status' | 'due_date' | 'archived_at'>[], hoje?: string) {
  const m = new Map<string, ContagemQuadro>()
  for (const t of tarefas) {
    if (!t.board_id || t.archived_at) continue
    const c = m.get(t.board_id) ?? { abertos: 0, atrasados: 0 }
    if (t.status !== 'done') c.abertos++
    if (atrasada(t, hoje)) c.atrasados++
    m.set(t.board_id, c)
  }
  return m
}

// ─── Leituras ───
const CAMPOS_QUADRO = 'id, producer_id, event_id, name, kind, visibility, description, color, archived_at, template_key, position, created_by, is_default, created_at'

/** Quadros que a pessoa enxerga (a regra do banco já filtra: dono, equipe ou pessoas escolhidas) */
export function useQuadros() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['quadros', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<QuadroLinha[]> => {
      const { data, error } = await db.from('task_boards').select(CAMPOS_QUADRO).order('created_at', { ascending: false })
      if (error) falharQuadro(error)
      return (data ?? []) as QuadroLinha[]
    },
  })
}

/** Um quadro e suas colunas (tela do kanban); null = não existe ou a pessoa não tem acesso (a regra esconde as duas coisas) */
export function useQuadroPorId(boardId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['quadros', user?.id, 'um', boardId],
    enabled: !!user?.id && !!boardId,
    queryFn: async (): Promise<{ quadro: QuadroLinha; colunas: ColunaQuadro[] } | null> => {
      const { data, error } = await db.from('task_boards').select(CAMPOS_QUADRO).eq('id', boardId!).maybeSingle()
      if (error) falharQuadro(error)
      if (!data) return null
      const cols = await db.from('task_columns').select('id, name, kind').eq('board_id', boardId!).order('position')
      if (cols.error) falharQuadro(cols.error)
      return { quadro: data as QuadroLinha, colunas: (cols.data ?? []) as ColunaQuadro[] }
    },
  })
}

/** Cartões do quadro. Chave sob ['producer-tasks', uid]: mover, criar e apagar cartão já invalidam esta lista */
export function useTarefasDoQuadro(boardId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['producer-tasks', user?.id, 'quadro', boardId],
    enabled: !!user?.id && !!boardId,
    queryFn: async (): Promise<DbTask[]> => {
      const { data, error } = await db.from('producer_tasks').select('*').eq('board_id', boardId!).order('created_at', { ascending: false })
      if (error) falharQuadro(error)
      return (data ?? []) as DbTask[]
    },
  })
}

/** Abertos e atrasados de cada quadro visível. ponytail: leitura limitada pelo teto de linhas do PostgREST (1000 por padrão) */
export function useContagemQuadros() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['producer-tasks', user?.id, 'contagem'],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db.from('producer_tasks').select('board_id, status, due_date, archived_at').not('board_id', 'is', null)
      if (error) falharQuadro(error)
      return contarPorQuadro((data ?? []) as DbTask[])
    },
  })
}

/** Quem está em cada quadro "pessoas escolhidas" (leitura liberada a quem vê o quadro) */
export function useMembrosQuadros() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['quadros', user?.id, 'membros'],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db.from('task_board_members').select('board_id, user_id, nivel')
      if (error) falharQuadro(error)
      const m = new Map<string, MembroQuadro[]>()
      for (const x of (data ?? []) as MembroQuadro[]) m.set(x.board_id, [...(m.get(x.board_id) ?? []), x])
      return m
    },
  })
}

/** Modelos do sistema (8) e os do próprio produtor; a regra do banco já separa */
export function useModelosQuadro(ativo = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['quadros', user?.id, 'modelos'],
    enabled: !!user?.id && ativo,
    staleTime: 60_000,
    queryFn: async (): Promise<ModeloQuadro[]> => {
      const { data, error } = await db.from('task_board_templates').select('key, name, description, kind_sugerido, columns, cards, owner_id').order('created_at').order('key')
      if (error) falharQuadro(error)
      return (data ?? []) as ModeloQuadro[]
    },
  })
}

/** Equipe ativa do produtor para escolher pessoas: só id e nome (a função nunca devolve e-mail) */
export function useEquipeQuadros(ativo: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['quadros', user?.id, 'equipe'],
    enabled: !!user?.id && ativo,
    staleTime: 60_000,
    queryFn: async (): Promise<PessoaEquipe[]> => {
      const { data, error } = await db.rpc('quadro_equipe_lista')
      if (error) falharQuadro(error)
      return (data ?? []) as PessoaEquipe[]
    },
  })
}

// ─── Gravações ───
function useInvalidar() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return (cartoes = false) => {
    qc.invalidateQueries({ queryKey: ['quadros', user?.id] })
    if (cartoes) qc.invalidateQueries({ queryKey: ['producer-tasks', user?.id] })
  }
}

export interface NovoQuadro { nome: string; kind: KindQuadro; eventId: string | null; modelo: string | null; visibilidade: VisQuadro; membros: Record<string, NivelQuadro> }

/** quadro_criar(p_nome, p_kind, p_evento, p_template, p_visibilidade, p_membros) → id do quadro */
export function useCriarQuadro() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (n: NovoQuadro): Promise<string> => {
      const { data, error } = await db.rpc('quadro_criar', {
        p_nome: n.nome.trim(), p_kind: n.kind, p_evento: n.kind === 'evento' ? n.eventId : null, p_template: n.modelo,
        p_visibilidade: n.visibilidade, p_membros: n.visibilidade === 'escolhidas' ? membrosParaRpc(n.membros) : null,
      })
      if (error) falharQuadro(error)
      return data as string
    },
    onSuccess: () => invalidar(true), // o modelo cria cartões
  })
}

/** Nome e cor: UPDATE direto das colunas com grant (só o dono; 0 linhas = sem permissão) */
export function useAtualizarQuadro() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, ...campos }: { id: string; name?: string; color?: CorQuadro }) => {
      const { data, error } = await db.from('task_boards').update(campos).eq('id', id).select('id')
      if (error) falharQuadro(error)
      if (!data?.length) throw new ErroTela('Sem permissão para este quadro.')
    },
    onSuccess: () => invalidar(),
  })
}

/** quadro_membros_definir(p_board, p_visibilidade, p_membros) */
export function useDefinirMembros() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (v: { id: string; visibilidade: VisQuadro; membros: Record<string, NivelQuadro> }) => {
      const { error } = await db.rpc('quadro_membros_definir', {
        p_board: v.id, p_visibilidade: v.visibilidade, p_membros: v.visibilidade === 'escolhidas' ? membrosParaRpc(v.membros) : null,
      })
      if (error) falharQuadro(error)
    },
    onSuccess: () => invalidar(),
  })
}

/** quadro_arquivar(p_board, p_arquivar) */
export function useArquivarQuadro() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (v: { id: string; arquivar: boolean }) => {
      const { error } = await db.rpc('quadro_arquivar', { p_board: v.id, p_arquivar: v.arquivar })
      if (error) falharQuadro(error)
    },
    onSuccess: () => invalidar(),
  })
}

/** quadro_salvar_como_modelo(p_board, p_nome, p_cartoes) → chave do modelo */
export function useSalvarComoModelo() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (v: { id: string; nome: string; cartoes: boolean }): Promise<string> => {
      const { data, error } = await db.rpc('quadro_salvar_como_modelo', { p_board: v.id, p_nome: v.nome.trim(), p_cartoes: v.cartoes })
      if (error) falharQuadro(error)
      return data as string
    },
    onSuccess: () => invalidar(),
  })
}

/** Cartão novo numa coluna do quadro (o gatilho do banco confere quadro e coluna e copia o evento do quadro) */
export function useCriarCartao(quadro: Pick<QuadroLinha, 'id' | 'producer_id'> | undefined) {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (v: { titulo: string; colunaId: string }) => {
      const titulo = v.titulo.trim()
      if (!titulo) throw new ErroTela('Digite o título do cartão.')
      if (titulo.length > 200) throw new ErroTela('O título pode ter no máximo 200 caracteres.')
      const { error } = await db.from('producer_tasks').insert({ producer_id: quadro!.producer_id, board_id: quadro!.id, column_id: v.colunaId, title: titulo })
      if (error) throw new ErroTela(error.code === '42501' ? 'Sem permissão para criar cartão neste quadro.' : 'Não foi possível criar o cartão.')
    },
    onSuccess: () => invalidar(true),
  })
}
