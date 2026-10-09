import { useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { armarAudio, bipar } from '../lib/quadroBipe'
import { tipoAparelho } from '../lib/quadroMapa'
import { useAuth } from './useAuth'
import { falhar } from './useCartao'
import type { DbNotification } from './useNotifications'
import { SEM_SQL_DO_QUADRO } from './useProducerTools'

// Notificações, confirmação de leitura e "Visto por" do quadro (docs/sql da Fatia 2B).
// Antes do SQL as tabelas e funções não existem: tudo devolve "indisponível" e a tela fica como era (modo antigo).
// ponytail: cliente sem tipos (`any` do supabase-js), como em useCartao: os tipos gerados do banco estão desatualizados.
const db = supabase as unknown as SupabaseClient

/** Códigos de "isto ainda não existe no banco"; 42703 = coluna nova (show_receipts) ainda não criada */
const semSql = (e: { code?: string }) => !!e.code && [...SEM_SQL_DO_QUADRO, '42703'].includes(e.code)
const objeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

// ─── Tipos de aviso e preferências ───
export const TIPOS_AVISO = [
  { chave: 'atribuicao', titulo: 'Atribuíram um cartão a mim', dica: 'Quando alguém me marca como responsável.' },
  { chave: 'mencao', titulo: 'Me mencionaram (@)', dica: 'Quando alguém escreve @ com o meu nome.' },
  { chave: 'mensagem', titulo: 'Mensagem em cartão que participo', dica: 'Comentários nos cartões em que sou membro ou observo.' },
  { chave: 'prazo', titulo: 'Prazo chegando ou vencido', dica: 'Aviso 24 h antes e quando atrasa.' },
  { chave: 'movido', titulo: 'Cartão que observo mudou de coluna', dica: 'Quando alguém move um cartão que observo.' },
  { chave: 'automacao', titulo: 'Uma automação agiu em cartão meu', dica: 'Regras que criam ou alteram cartões meus.' },
] as const
export type TipoAviso = (typeof TIPOS_AVISO)[number]['chave']
export interface PrefsAviso { general: boolean; sound: boolean; types: Record<TipoAviso, { app: boolean; email: boolean }> }
export const PREFS_PADRAO: PrefsAviso = {
  general: true, sound: true,
  types: Object.fromEntries(TIPOS_AVISO.map(t => [t.chave, { app: true, email: false }])) as PrefsAviso['types'],
}

/** Linha do banco (ou nada) → preferências completas; o que faltar ou vier estranho cai no padrão */
export function prefsDaLinha(linha: unknown): PrefsAviso {
  if (!objeto(linha)) return PREFS_PADRAO
  const tipos = objeto(linha.types) ? linha.types : {}
  return {
    general: typeof linha.general === 'boolean' ? linha.general : true,
    sound: typeof linha.sound === 'boolean' ? linha.sound : true,
    types: Object.fromEntries(TIPOS_AVISO.map(({ chave }) => {
      const t = tipos[chave]
      const padrao = PREFS_PADRAO.types[chave]
      return [chave, objeto(t) ? { app: typeof t.app === 'boolean' ? t.app : padrao.app, email: typeof t.email === 'boolean' ? t.email : padrao.email } : padrao]
    })) as PrefsAviso['types'],
  }
}

const chavePrefs = (uid?: string) => ['quadro-prefs', uid]

/** Preferências da própria pessoa. `disponivel` false = banco sem o SQL da 2B (nada de sino, bipe nem recibos) */
export function usePrefsAvisos() {
  const { user } = useAuth()
  const q = useQuery({
    queryKey: chavePrefs(user?.id),
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<{ prefs: PrefsAviso; disponivel: boolean }> => {
      const { data, error } = await db.from('task_notification_prefs').select('general, sound, types').eq('user_id', user!.id).maybeSingle()
      if (error) { if (semSql(error)) return { prefs: PREFS_PADRAO, disponivel: false }; throw error }
      return { prefs: prefsDaLinha(data), disponivel: true }
    },
  })
  return { prefs: q.data?.prefs ?? PREFS_PADRAO, disponivel: q.data?.disponivel ?? false, isPending: q.isPending, isError: q.isError }
}

/**
 * Grava a linha inteira da própria pessoa; otimista. Sem upsert: o banco só deixa atualizar general, sound e types,
 * e o ON CONFLICT DO UPDATE do upsert também mexeria em user_id. Então: update por user_id e, se não havia linha, insert.
 * 23505 no insert = outra aba criou a linha agora: tenta o update de novo.
 */
export function useSalvarPrefs() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const chave = chavePrefs(user?.id)
  return useMutation({
    mutationFn: async (p: PrefsAviso) => {
      const campos = { general: p.general, sound: p.sound, types: p.types }
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const up = await db.from('task_notification_prefs').update(campos).eq('user_id', user!.id).select('user_id')
        if (up.error) falhar(up.error)
        if (up.data?.length) return
        const ins = await db.from('task_notification_prefs').insert({ user_id: user!.id, ...campos })
        if (!ins.error) return
        if (ins.error.code !== '23505') falhar(ins.error)
      }
      falhar({ code: '42501' })
    },
    onMutate: async p => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData(chave)
      qc.setQueryData(chave, { prefs: p, disponivel: true })
      return { antes }
    },
    onError: (_e, _p, ctx) => { qc.setQueryData(chave, ctx?.antes) },
    onSettled: () => qc.invalidateQueries({ queryKey: chave }),
  })
}

// ─── Avisos ───
export const INTERVALO_AVISOS_MS = 30_000
export const ehAvisoDoQuadro = (n: Pick<DbNotification, 'metadata'>) => n.metadata?.kind === 'quadro'
export const tipoDoAviso = (n: Pick<DbNotification, 'metadata'>): TipoAviso | null => {
  const t = n.metadata?.tipo
  return TIPOS_AVISO.some(x => x.chave === t) ? (t as TipoAviso) : null
}
export const cartaoDoAviso = (n: Pick<DbNotification, 'metadata'>): string | null => {
  const id = n.metadata?.task_id
  return typeof id === 'string' ? id : null
}

/**
 * Avisos do quadro: consulta própria (os 50 mais recentes SÓ do quadro, filtrados no banco), para avisos de outras áreas
 * não empurrarem os do quadro para fora da lista. Consulta de novo a cada 30 s enquanto `ativo` (a tabela não está no Realtime).
 * Começa com ['user-notifications', uid], então marcar lido pelos hooks existentes também a atualiza.
 */
export function useAvisosQuadro(ativo: boolean) {
  const { user } = useAuth()
  const q = useQuery<DbNotification[]>({
    queryKey: ['user-notifications', user?.id, 'quadro'],
    enabled: ativo && !!user?.id,
    refetchInterval: INTERVALO_AVISOS_MS,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await db.from('notifications').select('id, user_id, title, body, type, is_read, metadata, created_at')
        .eq('user_id', user!.id).contains('metadata', { kind: 'quadro' }).order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      return ((data ?? []) as DbNotification[]).filter(ehAvisoDoQuadro)
    },
  })
  const avisos = useMemo(() => (ativo ? q.data ?? [] : []), [q.data, ativo])
  return { avisos, naoLidos: avisos.filter(a => !a.is_read).length, carregado: ativo && q.isSuccess, isError: q.isError, refetch: q.refetch }
}

/** Marca vários avisos (só os da pessoa) como lidos. Lista vazia não chama o banco */
export function useMarcarAvisos() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return
      const { error } = await db.from('notifications').update({ is_read: true }).in('id', ids).eq('user_id', user!.id)
      if (error) falhar(error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-notifications', user?.id] }),
  })
}

/**
 * Bipe só para aviso NOVO: o que já estava na primeira carga não toca. Só com "receber" e "bipe" ligados,
 * um toque por rodada (nunca em laço) e mudo com a aba oculta (bipar() confere).
 */
export function useBipeAvisos(avisos: DbNotification[], carregado: boolean, prefs: PrefsAviso) {
  const vistos = useRef<Set<string> | null>(null)
  useEffect(() => { armarAudio() }, [])
  useEffect(() => {
    if (!carregado) return
    if (!vistos.current) { vistos.current = new Set(avisos.map(a => a.id)); return }
    const novos = avisos.filter(a => !a.is_read && !vistos.current!.has(a.id))
    avisos.forEach(a => vistos.current!.add(a.id))
    if (!novos.length || !prefs.general || !prefs.sound) return
    const alvo = novos.find(a => { const t = tipoDoAviso(a); return !t || prefs.types[t].app })
    if (alvo) bipar(tipoDoAviso(alvo) ?? 'mensagem')
  }, [avisos, carregado, prefs])
}

// ─── Confirmação de leitura ───
export interface ConfigRecibos { disponivel: boolean; ligado: boolean; dono: boolean }

/** show_receipts do quadro. Banco sem a coluna: indisponível e desligado (nada de recibos, nenhuma RPC) */
export function useConfigRecibos(boardId: string | null | undefined) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const chave = ['quadro-recibos-cfg', boardId, user?.id]
  const q = useQuery({
    queryKey: chave,
    enabled: !!boardId && !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<ConfigRecibos> => {
      const { data, error } = await db.from('task_boards').select('show_receipts, producer_id').eq('id', boardId).maybeSingle()
      if (error) { if (semSql(error)) return { disponivel: false, ligado: false, dono: false }; throw error }
      if (!objeto(data) || typeof data.show_receipts !== 'boolean') return { disponivel: false, ligado: false, dono: false }
      return { disponivel: true, ligado: data.show_receipts, dono: data.producer_id === user!.id }
    },
  })
  const alterar = useMutation({
    mutationFn: async (ligado: boolean) => {
      const { data, error } = await db.from('task_boards').update({ show_receipts: ligado }).eq('id', boardId).select('id')
      if (error) falhar(error)
      if (!data?.length) falhar({ code: '42501' }) // a RLS esconde sem erro: 0 linhas = não gravou
    },
    onMutate: async ligado => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<ConfigRecibos>(chave)
      if (antes) qc.setQueryData<ConfigRecibos>(chave, { ...antes, ligado })
      return { antes }
    },
    onError: (_e, _v, ctx) => { if (ctx?.antes) qc.setQueryData(chave, ctx.antes) },
    onSettled: () => qc.invalidateQueries({ queryKey: chave }),
  })
  const config: ConfigRecibos = q.data ?? { disponivel: false, ligado: false, dono: false }
  return { config, alterar }
}

/** Avisa o banco que estes cartões chegaram a esta pessoa (até 200, uma vez por conjunto). Sem recibos ligados: não chama nada */
export function useMarcarEntregue(ids: string[], ligado: boolean) {
  const { user } = useAuth()
  const ultimo = useRef('')
  const lista = ids.slice(0, 200)
  const chave = [...lista].sort().join(',')
  useEffect(() => {
    if (!ligado) { ultimo.current = ''; return } // ao religar, reenvia
    if (!user?.id || !chave || chave === ultimo.current) return
    ultimo.current = chave
    // erro (inclusive banco sem a função) é ignorado: a entrega é um detalhe, nunca derruba a tela
    Promise.resolve(db.rpc('quadro_marcar_entregue', { p_tasks: lista, p_device: tipoAparelho() })).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligado, user?.id, chave])
}

export interface ReciboComentario { comment_id: string; user_id: string; delivered_at: string | null; read_at: string | null; device: string | null }
export interface VistaCartao { task_id: string; user_id: string; last_seen_at: string; device: string | null }
export interface RecibosCartao { recibos: ReciboComentario[]; vistas: VistaCartao[]; observadores: string[] }
const SEM_RECIBOS: RecibosCartao = { recibos: [], vistas: [], observadores: [] }

/** Recibos dos comentários, quem viu o cartão e quem o observa (leitura; a escrita é só pelas funções do banco) */
export function useRecibosCartao(taskId: string, comentarioIds: string[], ativo: boolean) {
  const ids = [...comentarioIds].sort()
  return useQuery({
    queryKey: ['quadro-recibos', taskId, ids.join(',')],
    enabled: ativo,
    queryFn: async (): Promise<RecibosCartao> => {
      const [rec, vis, obs] = await Promise.all([
        ids.length ? db.from('task_comment_receipts').select('comment_id, user_id, delivered_at, read_at, device').in('comment_id', ids) : Promise.resolve({ data: [], error: null }),
        db.from('task_card_views').select('task_id, user_id, last_seen_at, device').eq('task_id', taskId),
        db.from('task_watchers').select('user_id').eq('task_id', taskId),
      ])
      for (const r of [rec, vis, obs]) if (r.error) { if (semSql(r.error)) return SEM_RECIBOS; throw r.error }
      return {
        recibos: (rec.data ?? []) as ReciboComentario[],
        vistas: (vis.data ?? []) as VistaCartao[],
        observadores: ((obs.data ?? []) as { user_id: string }[]).map(o => o.user_id),
      }
    },
  })
}

const MAX_MARCAS_POR_ABERTURA = 20
/**
 * Ao abrir o verso: registra que a pessoa viu o cartão e leu as mensagens, e de novo quando chega mensagem nova com o verso aberto.
 * `comentarios` = quantas mensagens o cartão tem (null = ainda carregando: não chama). No máximo 20 chamadas por abertura.
 */
export function useMarcarLido(taskId: string, ligado: boolean, comentarios: number | null) {
  const qc = useQueryClient()
  const feitas = useRef(0)
  useEffect(() => {
    if (!ligado || comentarios === null || feitas.current >= MAX_MARCAS_POR_ABERTURA) return
    feitas.current++
    let vivo = true
    Promise.resolve(db.rpc('quadro_marcar_lido', { p_task: taskId, p_device: tipoAparelho() }))
      .then(r => { if (vivo && !r.error) qc.invalidateQueries({ queryKey: ['quadro-recibos', taskId] }) })
      .catch(() => undefined)
    return () => { vivo = false }
  }, [taskId, ligado, comentarios, qc])
}

export type EstadoTique = 'sem' | 'enviado' | 'entregue' | 'lido'
/**
 * Estado da mensagem para quem a escreveu. Destinatários = membros e observadores do cartão, menos o autor.
 * Lido: todos leram. Entregue: pelo menos uma pessoa recebeu. Enviado: o resto. Sem destinatários: sem tique.
 */
export function estadoDaMensagem(autor: string, membros: string[], observadores: string[], recibos: ReciboComentario[], comentarioId: string) {
  const destinatarios = [...new Set([...membros, ...observadores])].filter(u => u !== autor)
  const dela = recibos.filter(r => r.comment_id === comentarioId && destinatarios.includes(r.user_id))
  const lidos = destinatarios.filter(u => dela.some(r => r.user_id === u && r.read_at))
  const entregues = destinatarios.filter(u => dela.some(r => r.user_id === u && (r.delivered_at || r.read_at)))
  const estado: EstadoTique = !destinatarios.length ? 'sem' : lidos.length === destinatarios.length ? 'lido' : entregues.length ? 'entregue' : 'enviado'
  return { estado, destinatarios, lidos, entregues }
}
