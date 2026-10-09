import { useQuery, useMutation, useQueryClient, keepPreviousData, type QueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { ConflitoCartao, SEM_SQL_DO_QUADRO, type DbTask } from './useProducerTools'

// Camada de dados do cartão completo do quadro (docs/sql/20261105_quadro_f2a_cartao.sql, fatia 2A).
// Antes do SQL as tabelas não existem: as leituras devolvem vazio (modo antigo) e a tela segue como estava.
// ponytail: cliente sem tipos (`any` do supabase-js), como o `as never` de useProducerTools: os tipos gerados do banco estão desatualizados.
const db = supabase as unknown as SupabaseClient

// ─── Tipos (espelham as colunas do SQL) ───
export interface EtiquetaQuadro { id: string; board_id: string; name: string; color: string }
export interface ItemChecklist { id: string; checklist_id: string; text: string; done: boolean; position: number; done_at: string | null; done_by: string | null }
export interface Checklist { id: string; task_id: string; title: string; position: number; itens: ItemChecklist[] }
export const MIMES_ANEXO = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const
export const MAX_BYTES_ANEXO = 10 * 1024 * 1024
export interface AnexoCartao { id: string; task_id: string; storage_path: string; name: string; mime: string; size_bytes: number; created_by: string | null; created_at: string }
export interface ComentarioCartao { id: string; task_id: string; user_id: string; body: string; mentions: string[]; created_at: string }
export const KINDS_VINCULO = ['ingresso', 'cupom', 'participantes', 'checkin', 'orcamento', 'financeiro', 'bordero',
  'parceiro', 'crm', 'equipe', 'mapa', 'divulgacao', 'certificados', 'cronograma', 'evento'] as const
export type KindVinculo = (typeof KINDS_VINCULO)[number]
export interface VinculoCartao { id: string; task_id: string; kind: KindVinculo; ref: string | null }
/** "task_id depende de depends_on"; `titulo` e `concluida` vêm do cartão relacionado (concluída = arquivado ou em coluna 'done') */
export interface DependenciaCartao { task_id: string; depends_on: string; titulo: string; concluida: boolean }
export type KindAtividade = 'criado' | 'movido' | 'arquivado' | 'desarquivado' | 'comentario' | 'comentario_apagado' | 'anexo'
export interface AtividadeCartao { id: string; board_id: string; task_id: string | null; actor: string | null; kind: KindAtividade; data: Record<string, unknown>; created_at: string }
export interface LocalCartao { txt?: string; lat?: number; lng?: number }

// ─── Erros ───
/** Erro cuja mensagem já é em português e pode ir para a tela. Qualquer outro erro (Storage, PostgREST, constraint) não pode */
export class ErroTela extends Error {}
// Mensagens em português que o nosso SQL levanta (docs/sql/20261105_quadro_f2a_cartao.sql); fora desta lista o texto do banco não vai para a tela
const MENSAGENS_DO_BANCO = new Set([
  'Etiqueta de outro quadro.', 'Esse usuário não é da equipe deste produtor.', 'Caminho de anexo inválido.', 'Máximo de 20 menções por comentário.',
  'Menção a quem não é da equipe deste produtor.', 'Dependência entre quadros diferentes.', 'Essa dependência cria um ciclo.',
  'Este cartão depende de outro que ainda não foi concluído.',
])
const LIMITE_DO_BANCO = /^Limite de \d{1,4} [\p{L} ]{1,40}\.$/u // "Limite de 30 anexos por cartão."
const GENERICA = 'Não foi possível salvar. Tente de novo.'

/** Frase em português para um erro do banco; o detalhe técnico só vai para o console em desenvolvimento */
export function textoDoErro(error: { message?: string; code?: string }): string {
  const msg = error.message ?? ''
  const conhecida = MENSAGENS_DO_BANCO.has(msg) || LIMITE_DO_BANCO.test(msg)
  if (error.code === '42501') return 'Sem permissão'
  if (error.code === '23505') return 'Já existe'
  if ((error.code === '23514' || error.code === 'P0001') && conhecida) return msg
  if (error.code === '23514') return 'Valor não permitido'
  if (import.meta.env.DEV) console.error('[cartão]', error)
  return GENERICA
}
export function falhar(error: { message?: string; code?: string }): never {
  throw Object.assign(new ErroTela(textoDoErro(error)), { code: error.code })
}
/** Texto seguro para mostrar ao usuário (toast ou aviso): só erros nossos, o resto vira a frase genérica */
export function mensagemSegura(e: unknown): string {
  if (e instanceof ErroTela || e instanceof ConflitoCartao) return e.message
  if (import.meta.env.DEV) console.error('[cartão]', e)
  return GENERICA
}
const semSql = (error: { code?: string }) => !!error.code && SEM_SQL_DO_QUADRO.includes(error.code)
/** Valida tamanho no cliente (o banco também confere, mas a mensagem dele é técnica) */
function texto(valor: string, max: number, nome: string) {
  const t = valor.trim()
  if (!t) throw new ErroTela(`${nome}: escreva alguma coisa`)
  if (t.length > max) throw new ErroTela(`${nome}: no máximo ${max} caracteres`)
  return t
}

// ─── Resumo para o cartão do quadro (uma consulta por tabela, sem N+1) ───
export interface ResumoCartao {
  etiquetas: EtiquetaQuadro[]
  membros: string[]
  checkFeitos: number
  checkTotal: number
  anexos: number
  comentarios: number
  /** dependências abertas: o cartão não pode sair da primeira coluna */
  bloqueado: boolean
}
export const RESUMO_VAZIO: ResumoCartao = { etiquetas: [], membros: [], checkFeitos: 0, checkTotal: 0, anexos: 0, comentarios: 0, bloqueado: false }
const CHAVE_RESUMO = 'cartao-resumo'

/** Dependência aberta = cartão-pai não arquivado e fora de coluna 'done' (mesma regra do gatilho do banco) */
type PaiDep = { title?: string; archived_at: string | null; task_columns: { kind: string } | null } | null
const dependenciaAberta = (pai: PaiDep) =>
  !!pai && !pai.archived_at && pai.task_columns?.kind !== 'done'

/** Resumo de vários cartões de uma vez, por task_id. Modo antigo (sem as tabelas): Map vazio, sem erro */
export function useResumoCartoes(boardId: string | null | undefined, taskIds: string[]) {
  const ids = [...taskIds].sort()
  return useQuery({
    queryKey: [CHAVE_RESUMO, boardId, ids.join(',')],
    enabled: !!boardId && ids.length > 0,
    placeholderData: keepPreviousData, // criar ou arquivar outro cartão muda a chave: a tela segue com o resumo anterior até o novo chegar
    queryFn: async (): Promise<Map<string, ResumoCartao>> => {
      // ponytail: PostgREST devolve no máximo 1000 linhas por consulta; passando disso os contadores do cartão ficam baixos
      // Blocos de 100 ids: lista longa em .in() estoura o tamanho do endereço (414)
      const blocos: string[][] = []
      for (let i = 0; i < ids.length; i += 100) blocos.push(ids.slice(i, i + 100))
      const partes = await Promise.all(blocos.map(bloco => Promise.all([
        db.from('task_card_labels').select('task_id, etiqueta:task_labels(id, board_id, name, color)').in('task_id', bloco),
        db.from('task_card_members').select('task_id, user_id').in('task_id', bloco),
        db.from('task_checklists').select('task_id, itens:task_checklist_items(done)').in('task_id', bloco),
        db.from('task_attachments').select('task_id').in('task_id', bloco),
        db.from('task_comments').select('task_id').in('task_id', bloco),
        db.from('task_dependencies').select('task_id, pai:producer_tasks!task_dependencies_depends_on_fkey(archived_at, task_columns(kind))').in('task_id', bloco),
      ])))
      for (const p of partes) for (const r of p) {
        if (r.error) { if (semSql(r.error)) return new Map(); throw r.error }
      }
      const mapa = new Map<string, ResumoCartao>()
      const de = (id: string) => {
        let r = mapa.get(id)
        if (!r) { r = { ...RESUMO_VAZIO, etiquetas: [], membros: [] }; mapa.set(id, r) }
        return r
      }
      for (const [etq, mem, chk, anx, com, dep] of partes) {
        for (const l of (etq.data ?? []) as unknown as { task_id: string; etiqueta: EtiquetaQuadro | null }[]) if (l.etiqueta) de(l.task_id).etiquetas.push(l.etiqueta)
        for (const m of mem.data ?? []) de(m.task_id).membros.push(m.user_id)
        for (const c of chk.data ?? []) {
          const r = de(c.task_id)
          r.checkTotal += c.itens.length
          r.checkFeitos += c.itens.filter((i: { done: boolean }) => i.done).length
        }
        for (const a of anx.data ?? []) de(a.task_id).anexos++
        for (const c of com.data ?? []) de(c.task_id).comentarios++
        for (const d of (dep.data ?? []) as unknown as { task_id: string; pai: PaiDep }[]) if (dependenciaAberta(d.pai)) de(d.task_id).bloqueado = true
      }
      return mapa
    },
  })
}

/** Ajusta o cartão em todos os resumos em cache (atualização otimista barata) */
function ajustarResumo(qc: QueryClient, taskId: string, ajuste: (r: ResumoCartao) => ResumoCartao) {
  qc.setQueriesData<Map<string, ResumoCartao>>({ queryKey: [CHAVE_RESUMO] }, old => {
    if (!old) return old
    const novo = new Map(old)
    novo.set(taskId, ajuste(old.get(taskId) ?? RESUMO_VAZIO))
    return novo
  })
}

// ─── Etiquetas do quadro ───
const CHAVE_ETIQUETAS = 'cartao-etiquetas'

/** Etiquetas do quadro (lista vazia no modo antigo) + criar, editar (nome e/ou cor) e apagar */
export function useEtiquetasQuadro(boardId: string | null | undefined) {
  const qc = useQueryClient()
  const chave = [CHAVE_ETIQUETAS, boardId]
  const consulta = useQuery({
    queryKey: chave,
    enabled: !!boardId,
    queryFn: async (): Promise<EtiquetaQuadro[]> => {
      const { data, error } = await db.from('task_labels').select('id, board_id, name, color').eq('board_id', boardId).order('name')
      if (error) { if (semSql(error)) return []; throw error }
      return data ?? []
    },
  })
  const depois = () => { qc.invalidateQueries({ queryKey: chave }); qc.invalidateQueries({ queryKey: [CHAVE_RESUMO] }) }

  const criar = useMutation({
    mutationFn: async (v: { name: string; color: string }) => {
      const name = texto(v.name, 30, 'Nome da etiqueta')
      if (!/^#[0-9a-fA-F]{6}$/.test(v.color)) throw new ErroTela('Cor da etiqueta inválida')
      const { data, error } = await db.from('task_labels').insert({ board_id: boardId, name, color: v.color }).select('id, board_id, name, color').single()
      if (error) falhar(error)
      return data as EtiquetaQuadro
    },
    onSettled: depois,
  })
  const editar = useMutation({
    mutationFn: async (v: { id: string; name?: string; color?: string }) => {
      const campos: { name?: string; color?: string } = {}
      if (v.name !== undefined) campos.name = texto(v.name, 30, 'Nome da etiqueta')
      if (v.color !== undefined) {
        if (!/^#[0-9a-fA-F]{6}$/.test(v.color)) throw new ErroTela('Cor da etiqueta inválida')
        campos.color = v.color
      }
      const { error } = await db.from('task_labels').update(campos).eq('id', v.id)
      if (error) falhar(error)
    },
    onMutate: async v => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<EtiquetaQuadro[]>(chave)
      qc.setQueryData<EtiquetaQuadro[]>(chave, old => old?.map(e => (e.id === v.id ? { ...e, ...(v.name !== undefined && { name: v.name.trim() }), ...(v.color !== undefined && { color: v.color }) } : e)))
      return { antes }
    },
    onError: (_e, _v, ctx) => { if (ctx?.antes) qc.setQueryData(chave, ctx.antes) },
    onSettled: depois,
  })
  const apagar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('task_labels').delete().eq('id', id)
      if (error) falhar(error)
    },
    onMutate: async id => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<EtiquetaQuadro[]>(chave)
      qc.setQueryData<EtiquetaQuadro[]>(chave, old => old?.filter(e => e.id !== id))
      return { antes }
    },
    onError: (_e, _v, ctx) => { if (ctx?.antes) qc.setQueryData(chave, ctx.antes) },
    onSettled: depois,
  })
  return { ...consulta, criar, editar, apagar }
}

/** Liga ou desliga uma etiqueta num cartão. Otimista no resumo */
export function useAlternarEtiqueta(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    scope: { id: `cartao-${taskId}` }, // cliques seguidos no mesmo cartão entram em fila
    mutationFn: async (v: { taskId: string; etiqueta: EtiquetaQuadro; ligar: boolean }) => {
      const q = db.from('task_card_labels')
      const { error } = v.ligar
        ? await q.insert({ task_id: v.taskId, label_id: v.etiqueta.id })
        : await q.delete().eq('task_id', v.taskId).eq('label_id', v.etiqueta.id)
      if (error && !(v.ligar && error.code === '23505')) falhar(error) // 23505 = a linha já existe: o resultado é o pedido
    },
    onMutate: async v => {
      await qc.cancelQueries({ queryKey: [CHAVE_RESUMO] })
      const antes = qc.getQueriesData<Map<string, ResumoCartao>>({ queryKey: [CHAVE_RESUMO] })
      ajustarResumo(qc, v.taskId, r => ({
        ...r, etiquetas: v.ligar ? [...r.etiquetas.filter(e => e.id !== v.etiqueta.id), v.etiqueta] : r.etiquetas.filter(e => e.id !== v.etiqueta.id),
      }))
      return { antes }
    },
    onError: (_e, _v, ctx) => ctx?.antes.forEach(([k, d]) => qc.setQueryData(k, d)),
    onSettled: () => qc.invalidateQueries({ queryKey: [CHAVE_RESUMO] }),
  })
}

/**
 * Liga ou desliga UMA pessoa no cartão (um insert ou um delete), como nas etiquetas. Nunca escreve a lista inteira:
 * um resumo atrasado ou vazio não apaga ninguém. 23505 (já é membro) conta como sucesso.
 */
export function useAlternarMembro(taskId: string) {
  const qc = useQueryClient()
  return useMutation({
    scope: { id: `cartao-${taskId}` },
    mutationFn: async (v: { userId: string; ligar: boolean }) => {
      const q = db.from('task_card_members')
      const { error } = v.ligar
        ? await q.insert({ task_id: taskId, user_id: v.userId })
        : await q.delete().eq('task_id', taskId).eq('user_id', v.userId)
      if (error && !(v.ligar && error.code === '23505')) falhar(error)
    },
    onMutate: async v => {
      await qc.cancelQueries({ queryKey: [CHAVE_RESUMO] })
      const antes = qc.getQueriesData<Map<string, ResumoCartao>>({ queryKey: [CHAVE_RESUMO] })
      ajustarResumo(qc, taskId, r => ({ ...r, membros: v.ligar ? [...new Set([...r.membros, v.userId])] : r.membros.filter(u => u !== v.userId) }))
      return { antes }
    },
    onError: (_e, _v, ctx) => ctx?.antes.forEach(([k, d]) => qc.setQueryData(k, d)),
    onSettled: () => qc.invalidateQueries({ queryKey: [CHAVE_RESUMO] }),
  })
}

// ─── Detalhe do cartão (verso) ───
export interface CartaoDetalhe {
  checklists: Checklist[]
  anexos: AnexoCartao[]
  comentarios: ComentarioCartao[]
  vinculos: VinculoCartao[]
  dependencias: DependenciaCartao[]
  atividade: AtividadeCartao[]
}
const DETALHE_VAZIO: CartaoDetalhe = { checklists: [], anexos: [], comentarios: [], vinculos: [], dependencias: [], atividade: [] }
const chaveDetalhe = (taskId: string | null | undefined) => ['cartao-detalhe', taskId]

export function useCartaoDetalhe(taskId: string | null | undefined) {
  return useQuery({
    queryKey: chaveDetalhe(taskId),
    enabled: !!taskId,
    queryFn: async (): Promise<CartaoDetalhe> => {
      const [chk, anx, com, vin, dep, atv] = await Promise.all([
        db.from('task_checklists').select('*, itens:task_checklist_items(*)').eq('task_id', taskId)
          .order('position').order('position', { referencedTable: 'task_checklist_items' }),
        db.from('task_attachments').select('*').eq('task_id', taskId).order('created_at'),
        db.from('task_comments').select('*').eq('task_id', taskId).order('created_at'),
        db.from('task_links').select('*').eq('task_id', taskId),
        db.from('task_dependencies').select('task_id, depends_on, pai:producer_tasks!task_dependencies_depends_on_fkey(title, archived_at, task_columns(kind))').eq('task_id', taskId),
        db.from('task_activity').select('*').eq('task_id', taskId).order('created_at', { ascending: false }).limit(50),
      ])
      for (const r of [chk, anx, com, vin, dep, atv]) {
        if (r.error) { if (semSql(r.error)) return DETALHE_VAZIO; throw r.error }
      }
      return {
        checklists: chk.data ?? [],
        anexos: anx.data ?? [],
        comentarios: com.data ?? [],
        vinculos: vin.data ?? [],
        dependencias: ((dep.data ?? []) as unknown as { task_id: string; depends_on: string; pai: PaiDep }[]).map(d =>
          ({ task_id: d.task_id, depends_on: d.depends_on, titulo: d.pai?.title ?? '', concluida: !dependenciaAberta(d.pai) })),
        atividade: atv.data ?? [],
      }
    },
  })
}

/** Mutação do detalhe: `otimista` (opcional) ajusta o cache antes do banco responder e volta se ele recusar */
function useMutacaoDetalhe<V>(taskId: string, executar: (v: V) => PromiseLike<{ error: { message?: string; code?: string } | null }>, otimista?: (d: CartaoDetalhe, v: V) => CartaoDetalhe) {
  const qc = useQueryClient()
  const chave = chaveDetalhe(taskId)
  return useMutation({
    mutationFn: async (v: V) => { const { error } = await executar(v); if (error) falhar(error) },
    onMutate: async (v: V) => {
      if (!otimista) return {}
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<CartaoDetalhe>(chave)
      if (antes) qc.setQueryData<CartaoDetalhe>(chave, otimista(antes, v))
      return { antes }
    },
    onError: (_e, _v, ctx) => { if (ctx?.antes) qc.setQueryData(chave, ctx.antes) },
    onSettled: () => { qc.invalidateQueries({ queryKey: chave }); qc.invalidateQueries({ queryKey: [CHAVE_RESUMO] }) },
  })
}

const proxima = (posicoes: number[]) => (posicoes.length ? Math.max(...posicoes) : 0) + 1000

/** Todas as ações do verso do cartão (checklists, comentários, atalhos, dependências) */
export function useAcoesCartao(taskId: string) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const detalhe = () => qc.getQueryData<CartaoDetalhe>(chaveDetalhe(taskId)) ?? DETALHE_VAZIO
  const trocaItem = (d: CartaoDetalhe, fn: (i: ItemChecklist) => ItemChecklist | null): CartaoDetalhe =>
    ({ ...d, checklists: d.checklists.map(c => ({ ...c, itens: c.itens.flatMap(i => fn(i) ?? []) })) })

  const criarChecklist = useMutacaoDetalhe(taskId, (title: string) =>
    db.from('task_checklists').insert({ task_id: taskId, title: texto(title, 80, 'Título da lista'), position: proxima(detalhe().checklists.map(c => c.position)) }))
  const renomearChecklist = useMutacaoDetalhe(taskId, (v: { id: string; title: string }) =>
    db.from('task_checklists').update({ title: texto(v.title, 80, 'Título da lista') }).eq('id', v.id),
  (d, v) => ({ ...d, checklists: d.checklists.map(c => (c.id === v.id ? { ...c, title: v.title.trim() } : c)) }))
  const apagarChecklist = useMutacaoDetalhe(taskId, (id: string) => db.from('task_checklists').delete().eq('id', id),
    (d, id) => ({ ...d, checklists: d.checklists.filter(c => c.id !== id) }))
  const adicionarItem = useMutacaoDetalhe(taskId, (v: { checklistId: string; text: string }) =>
    db.from('task_checklist_items').insert({
      checklist_id: v.checklistId, text: texto(v.text, 200, 'Item'), done: false,
      position: proxima(detalhe().checklists.find(c => c.id === v.checklistId)?.itens.map(i => i.position) ?? []),
    }))
  const alternarItem = useMutacaoDetalhe(taskId, (v: { id: string; done: boolean }) =>
    db.from('task_checklist_items').update({ done: v.done }).eq('id', v.id),
  (d, v) => trocaItem(d, i => (i.id === v.id ? { ...i, done: v.done } : i)))
  const apagarItem = useMutacaoDetalhe(taskId, (id: string) => db.from('task_checklist_items').delete().eq('id', id),
    (d, id) => trocaItem(d, i => (i.id === id ? null : i)))
  const comentar = useMutacaoDetalhe(taskId, (v: { body: string; mentions?: string[] }) =>
    db.from('task_comments').insert({ task_id: taskId, user_id: user?.id, body: texto(v.body, 4000, 'Comentário'), mentions: [...new Set(v.mentions ?? [])] }))
  const apagarComentario = useMutacaoDetalhe(taskId, (id: string) => db.from('task_comments').delete().eq('id', id),
    (d, id) => ({ ...d, comentarios: d.comentarios.filter(c => c.id !== id) }))
  const adicionarVinculo = useMutacaoDetalhe(taskId, (v: { kind: KindVinculo; ref?: string | null }) => {
    if (!KINDS_VINCULO.includes(v.kind)) throw new ErroTela('Tipo de atalho inválido')
    if (v.ref && !/^[A-Za-z0-9_-]{1,200}$/.test(v.ref)) throw new ErroTela('Referência do atalho inválida')
    return db.from('task_links').insert({ task_id: taskId, kind: v.kind, ref: v.ref || null })
  })
  const removerVinculo = useMutacaoDetalhe(taskId, (id: string) => db.from('task_links').delete().eq('id', id),
    (d, id) => ({ ...d, vinculos: d.vinculos.filter(v => v.id !== id) }))
  const adicionarDependencia = useMutacaoDetalhe(taskId, (dependsOn: string) =>
    db.from('task_dependencies').insert({ task_id: taskId, depends_on: dependsOn }))
  const removerDependencia = useMutacaoDetalhe(taskId, (dependsOn: string) =>
    db.from('task_dependencies').delete().eq('task_id', taskId).eq('depends_on', dependsOn),
  (d, dependsOn) => ({ ...d, dependencias: d.dependencias.filter(x => x.depends_on !== dependsOn) }))

  return { criarChecklist, renomearChecklist, apagarChecklist, adicionarItem, alternarItem, apagarItem, comentar, apagarComentario,
    adicionarVinculo, removerVinculo, adicionarDependencia, removerDependencia }
}

// ─── Campos do próprio cartão ───
export type CamposCartao = Partial<Pick<DbTask, 'title' | 'description' | 'due_date' | 'start_date' | 'cover' | 'location' | 'fields' | 'archived_at' | 'recur_days' | 'ck_move'>>

/** Atualiza descrição, prazo, início, capa, local, campos extras ou arquivamento. Mesmo controle de conflito de useMoverTarefa */
export function useAtualizarCartao() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const chave = ['producer-tasks', user?.id]
  return useMutation({
    scope: { id: 'mover-tarefa' }, // na mesma fila do mover: o seguinte usa o updated_at que o anterior gravou
    mutationFn: async ({ tarefa, campos }: { tarefa: DbTask; campos: CamposCartao }) => {
      if (campos.cover && !/^#[0-9a-fA-F]{6}$/.test(campos.cover)) throw new ErroTela('Cor da capa inválida')
      if (campos.title !== undefined) campos = { ...campos, title: texto(campos.title, 200, 'Título') }
      const lido = qc.getQueryData<DbTask[]>(chave)?.find(t => t.id === tarefa.id)?.updated_at ?? tarefa.updated_at
      let q = db.from('producer_tasks').update(campos).eq('id', tarefa.id).eq('producer_id', tarefa.producer_id)
      if (lido) q = q.eq('updated_at', lido) // 0 linhas = alguém mexeu desde que a tela leu
      const { data, error } = await q.select('*')
      if (error) falhar(error)
      if (!data?.length) throw new ConflitoCartao('Outra pessoa mexeu neste cartão')
      const gravado = (data[0] as { updated_at?: string }).updated_at
      if (gravado) qc.setQueryData<DbTask[]>(chave, old => old?.map(t => (t.id === tarefa.id ? { ...t, updated_at: gravado } : t)))
    },
    onMutate: async ({ tarefa, campos }) => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<DbTask[]>(chave)
      qc.setQueryData<DbTask[]>(chave, old => old?.map(t => (t.id === tarefa.id ? { ...t, ...campos } : t)))
      return { antes }
    },
    onError: (_e, _v, ctx) => { if (ctx?.antes) qc.setQueryData(chave, ctx.antes) },
    onSettled: () => qc.invalidateQueries({ queryKey: chave }),
  })
}

// ─── Anexos ───
const BUCKET = 'task-attachments'

/**
 * Nome do arquivo no Storage: só [A-Za-z0-9_.-], sem ".." (o banco recusa). O trecho final do caminho
 * (`<uuid>-<nome>`) tem de caber em 120 caracteres pela regra do SQL: com o uuid (36) e o hífen sobram 83 para o nome.
 * Corta pelo FIM para manter a extensão.
 */
export function nomeSeguro(nome: string, max = 83) {
  const limpo = nome.replace(/[^A-Za-z0-9_.-]/g, '_').replace(/\.{2,}/g, '.').slice(-max)
  return limpo || 'arquivo'
}
const EXT_DO_MIME: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' }
/**
 * Caminho `<produtor>/<cartão>/<uuid>-<nome>.<ext>` que passa na regra do banco: nome de até 83 caracteres, começando por
 * letra, dígito, _ ou -, terminando em .png/.jpg/.jpeg/.webp/.pdf (minúscula). Sem extensão válida, usa a do mime.
 */
export function caminhoAnexo(producerId: string, taskId: string, nome: string, mime = '') {
  const limpo = nomeSeguro(nome)
  const m = /\.(png|jpe?g|webp|pdf)$/i.exec(limpo)
  const ext = m ? m[1].toLowerCase() : EXT_DO_MIME[mime] ?? 'png'
  const base = (m ? limpo.slice(0, -m[0].length) : limpo).replace(/^\.+|\.+$/g, '').slice(0, 83 - 1 - ext.length).replace(/\.+$/, '')
  return `${producerId}/${taskId}/${crypto.randomUUID()}-${base || 'arquivo'}.${ext}`
}

const EXTENSOES: Record<string, string[]> = { 'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'], 'image/webp': ['webp'], 'application/pdf': ['pdf'] }

/** Confere tipo, extensão (se o nome vier) e tamanho antes de subir; devolve a mensagem em português ou null se está tudo certo */
export function erroDoArquivo(arquivo: { type: string; size: number; name?: string }): string | null {
  if (!(MIMES_ANEXO as readonly string[]).includes(arquivo.type)) return 'Só são aceitos arquivos PNG, JPEG, WebP ou PDF.'
  if (arquivo.name !== undefined && !EXTENSOES[arquivo.type].includes(arquivo.name.split('.').pop()?.toLowerCase() ?? '')) return 'A extensão do arquivo não combina com o tipo dele.'
  if (arquivo.size <= 0) return 'O arquivo está vazio.'
  if (arquivo.size > MAX_BYTES_ANEXO) return 'O arquivo passa de 10 MB.'
  return null
}

/** Os primeiros bytes têm de ser os do formato dito pelo tipo (PNG, JPEG, WebP "RIFF....WEBP" ou PDF "%PDF") */
export function erroDosBytes(mime: string, b: Uint8Array): string | null {
  const ate = (...v: number[]) => v.every((x, i) => b[i] === x)
  const ok = mime === 'image/png' ? ate(0x89, 0x50, 0x4e, 0x47)
    : mime === 'image/jpeg' ? ate(0xff, 0xd8, 0xff)
    : mime === 'image/webp' ? ate(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    : ate(0x25, 0x50, 0x44, 0x46)
  return ok ? null : 'O conteúdo do arquivo não é do tipo informado.'
}
const lerInicio = (f: Blob) => new Promise<Uint8Array>((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(new Uint8Array(r.result as ArrayBuffer))
  r.onerror = () => rej(r.error)
  r.readAsArrayBuffer(f.slice(0, 12))
})

export function useEnviarAnexo() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ producerId, taskId, arquivo }: { producerId: string; taskId: string; arquivo: File }) => {
      const invalido = erroDoArquivo(arquivo)
      if (invalido) throw new ErroTela(invalido)
      const bytes = erroDosBytes(arquivo.type, await lerInicio(arquivo))
      if (bytes) throw new ErroTela(bytes)
      const path = caminhoAnexo(producerId, taskId, arquivo.name, arquivo.type)
      const up = await db.storage.from(BUCKET).upload(path, arquivo, { contentType: arquivo.type, upsert: false })
      if (up.error) falhar(up.error)
      const { error } = await db.from('task_attachments').insert({
        task_id: taskId, storage_path: path, name: arquivo.name.slice(0, 200) || 'arquivo', mime: arquivo.type, size_bytes: arquivo.size, created_by: user?.id,
      })
      if (error) {
        await db.storage.from(BUCKET).remove([path]) // não deixa arquivo órfão no bucket
        falhar(error)
      }
    },
    onSettled: (_d, _e, v) => { qc.invalidateQueries({ queryKey: chaveDetalhe(v.taskId) }); qc.invalidateQueries({ queryKey: [CHAVE_RESUMO] }) },
  })
}

/** Apaga a linha e depois o arquivo (se a linha for recusada, o arquivo fica) */
export function useRemoverAnexo(taskId: string) {
  return useMutacaoDetalhe(taskId, async (anexo: AnexoCartao) => {
    const r = await db.from('task_attachments').delete().eq('id', anexo.id)
    // ponytail: se o arquivo não sair do bucket, fica órfão (quem tem 'ver' no cartão ainda o lê se souber o caminho, enquanto o cartão existir); limpeza por rotina se incomodar
    if (!r.error) await db.storage.from(BUCKET).remove([anexo.storage_path])
    return r
  }, (d, anexo) => ({ ...d, anexos: d.anexos.filter(a => a.id !== anexo.id) }))
}

/** Link de download que vale 60 s (o bucket é privado) */
export async function urlAssinadaAnexo(storagePath: string): Promise<string> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(storagePath, 60)
  if (error || !data) falhar(error ?? { message: 'Não foi possível abrir o anexo' })
  return data.signedUrl
}
