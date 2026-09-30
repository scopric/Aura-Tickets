import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BookOpen, Bot, BookPlus, Languages, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

// Base de conhecimento do atendimento (etapa 3, PR 3a; docs/sql/20261003_chat_bot.sql). O assistente do
// chat responde com os artigos PUBLICADOS do público de quem pergunta; rascunho não sai. Dicionário:
// siglas e gírias trocadas antes da busca ("vc" → "você"). Perguntas sem resposta: o que o assistente
// não entendeu, para virar artigo ou entrada do dicionário. Tudo com manage_support (RLS); as tabelas não
// estão nos tipos gerados do banco: por isso os `as never`.

type Aba = 'artigos' | 'dicionario' | 'perguntas'
type Publico = 'all' | 'participant' | 'producer' | 'site'
type Situacao = 'todos' | 'published' | 'draft' | 'ia'

interface Artigo {
  id: string
  slug: string | null
  title: string
  body: string
  keywords: string
  audience: Publico
  department_id: string | null
  status: 'draft' | 'published'
  origin: 'seed' | 'manual' | 'atendente' | 'ia'
  review_note: string | null
  updated_at: string
}
interface Termo { id: string; forma: string; normal: string }
interface Pergunta { id: string; texto: string; audience: string; vezes: number; ultima_em: string }

const PUBLICO: Record<Publico, string> = { all: 'Todos', participant: 'Participantes', producer: 'Produtores', site: 'Visitantes do site' }
const ORIGEM: Record<Artigo['origin'], string> = { seed: 'Levantamento', manual: 'Admin', atendente: 'Resposta de atendente', ia: 'Sugestão da IA' }
const PUBLICO_PERGUNTA: Record<string, string> = { participant: 'Participante', producer: 'Produtor', site: 'Site' }

const inputCls = 'w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary'
const erroDe = (e: unknown) => (e as { message?: string } | null)?.message || 'erro desconhecido'
const dataBr = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
/** forma do dicionário como o banco guarda: minúscula, sem acento, só letras e números */
const normalizarForma = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')

const artigoVazio = {
  id: null as string | null,
  title: '',
  body: '',
  keywords: '',
  audience: 'all' as Publico,
  department_id: '',
  publicado: false,
  review_note: null as string | null,
  origin: 'manual' as 'manual' | 'atendente',
  source_conversation_id: null as string | null,
  pergunta_id: null as string | null,
}
type FormArtigo = typeof artigoVazio
type FormTermo = { id: string | null; forma: string; normal: string; pergunta_id: string | null }
type Exclusao = { tipo: 'artigo' | 'termo' | 'pergunta'; id: string; nome: string }

function validarArtigo(f: FormArtigo): string | null {
  if (f.title.trim().length < 5 || f.title.trim().length > 160) return 'Título: de 5 a 160 caracteres.'
  if (f.body.trim().length < 10 || f.body.trim().length > 3500) return 'Texto: de 10 a 3.500 caracteres.'
  if (f.keywords.length > 500) return 'Palavras-chave: até 500 caracteres.'
  return null
}

/** Confirmação na própria página: window.confirm pode ser bloqueado pelo navegador e devolver falso sem mostrar nada. */
function ConfirmarExclusao({ alvo, ocupado, aoConfirmar, aoFechar }: { alvo: Exclusao; ocupado: boolean; aoConfirmar: () => void; aoFechar: () => void }) {
  const texto = {
    artigo: 'O assistente deixa de usar este artigo. Artigo do levantamento excluído não volta, mesmo se a carga inicial rodar de novo.',
    termo: 'O assistente deixa de trocar esta forma no texto das perguntas.',
    pergunta: 'A pergunta sai da lista. Se alguém perguntar de novo, ela volta.',
  }[alvo.tipo]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="excluir-titulo" onKeyDown={e => { if (e.key === 'Escape') aoFechar() }}>
      <div className="absolute inset-0 glass-backdrop" onClick={aoFechar} />
      <div className="glass-panel relative w-full max-w-sm p-6">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-red-500" aria-hidden="true" /></div>
        <h2 id="excluir-titulo" className="font-serif text-xl text-foreground text-center mb-2">Excluir</h2>
        <p className="text-sm text-foreground text-center mb-1 break-words">“{alvo.nome}”</p>
        <p className="text-xs text-muted-foreground text-center mb-4">{texto} Não dá para desfazer.</p>
        <div className="space-y-2">
          <button type="button" autoFocus disabled={ocupado} onClick={aoConfirmar} className="w-full py-2.5 bg-red-600 text-white text-sm font-medium rounded-full hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {ocupado && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Confirmar exclusão
          </button>
          <button type="button" onClick={aoFechar} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground">Voltar</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminConhecimento() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState<Aba>('artigos')
  const [situacao, setSituacao] = useState<Situacao>('todos')
  const [publico, setPublico] = useState<'' | Publico>('')
  const [setor, setSetor] = useState('')
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState<FormArtigo | null>(null)
  const [termo, setTermo] = useState<FormTermo | null>(null)
  const [exclusao, setExclusao] = useState<Exclusao | null>(null)
  const set = <K extends keyof FormArtigo>(k: K, v: FormArtigo[K]) => setForm(f => (f ? { ...f, [k]: v } : f))

  const artigos = useQuery<Artigo[]>({
    queryKey: ['kb-artigos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kb_articles' as never)
        .select('id, slug, title, body, keywords, audience, department_id, status, origin, review_note, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      return (data ?? []) as unknown as Artigo[]
    },
  })
  const setores = useQuery({
    queryKey: ['chat-setores'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('chat_departments' as never).select('id, name').order('position')
      if (error) throw error
      return (data ?? []) as unknown as { id: string; name: string }[]
    },
  })
  const ligado = useQuery({
    queryKey: ['kb-assistente'],
    queryFn: async () => {
      const { data, error } = await supabase.from('chat_settings' as never).select('bot_enabled').eq('id', 1).maybeSingle()
      if (error) throw error
      return (data as { bot_enabled?: boolean } | null)?.bot_enabled ?? null
    },
  })
  const termos = useQuery<Termo[]>({
    queryKey: ['kb-termos'],
    enabled: aba === 'dicionario',
    queryFn: async () => {
      const { data, error } = await supabase.from('kb_termos' as never).select('id, forma, normal').order('forma').limit(2000)
      if (error) throw error
      return (data ?? []) as unknown as Termo[]
    },
  })
  const perguntas = useQuery<Pergunta[]>({
    queryKey: ['kb-perguntas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kb_perguntas_sem_resposta' as never)
        .select('id, texto, audience, vezes, ultima_em')
        .order('vezes', { ascending: false })
        .order('ultima_em', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as Pergunta[]
    },
  })

  // "Virar artigo" no Atendimento: ?mensagem=<id> abre o editor com a resposta do atendente
  const mensagemId = params.get('mensagem')
  useEffect(() => {
    if (!mensagemId) return
    let vivo = true
    supabase
      .from('conversation_messages' as never)
      .select('id, conversation_id, body, sender_role, is_internal')
      .eq('id', mensagemId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return
        setParams({}, { replace: true })
        const m = data as { conversation_id: string; body: string; sender_role: string; is_internal: boolean } | null
        if (error || !m || m.sender_role !== 'agent' || m.is_internal) {
          toast.error('Não foi possível abrir a mensagem para virar artigo.')
          return
        }
        setAba('artigos')
        setForm({ ...artigoVazio, body: m.body.slice(0, 3500), origin: 'atendente', source_conversation_id: m.conversation_id })
      })
    return () => { vivo = false }
  }, [mensagemId, setParams])

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['kb-artigos'] })
    qc.invalidateQueries({ queryKey: ['kb-termos'] })
    qc.invalidateQueries({ queryKey: ['kb-perguntas'] })
  }

  // Pergunta que virou artigo ou termo sai da lista (se falhar, o que foi salvo fica; só avisa)
  const tirarPergunta = async (id: string | null) => {
    if (!id) return
    const { data, error } = await supabase.from('kb_perguntas_sem_resposta' as never).delete().eq('id', id).select('id')
    if (error || !(data as unknown[] | null)?.length) toast.error('Salvo, mas a pergunta não saiu da lista. Descarte à mão.')
  }

  const salvar = useMutation({
    mutationFn: async (f: FormArtigo) => {
      const payload = {
        title: f.title.trim(),
        body: f.body.trim(),
        keywords: f.keywords.trim(),
        audience: f.audience,
        department_id: f.department_id || null,
        status: f.publicado ? 'published' : 'draft',
      }
      // `.select('id')`: sem ele, uma gravação barrada pelo RLS volta "sucesso" com zero linhas
      const q = f.id
        ? supabase.from('kb_articles' as never).update({ ...payload, updated_at: new Date().toISOString() } as never).eq('id', f.id).select('id')
        : supabase.from('kb_articles' as never).insert({ ...payload, origin: f.origin, source_conversation_id: f.source_conversation_id, created_by: user?.id ?? null } as never).select('id')
      const { data, error } = await q
      if (error) {
        if (error.code === '23514') throw new Error('O banco recusou: confira os tamanhos do título, do texto e das palavras-chave.')
        throw error
      }
      if (!(data as unknown[] | null)?.length) throw new Error('Nada foi gravado (sem permissão ou artigo inexistente).')
      await tirarPergunta(f.pergunta_id)
    },
    onSuccess: (_, f) => {
      toast.success(f.id ? 'Artigo atualizado.' : 'Artigo criado.')
      setForm(null)
      invalidar()
    },
    onError: e => toast.error('Não foi possível salvar: ' + erroDe(e)),
  })

  const salvarTermo = useMutation({
    mutationFn: async (t: FormTermo) => {
      const payload = { forma: normalizarForma(t.forma), normal: t.normal.trim() }
      const q = t.id
        ? supabase.from('kb_termos' as never).update(payload as never).eq('id', t.id).select('id')
        : supabase.from('kb_termos' as never).insert(payload as never).select('id')
      const { data, error } = await q
      if (error) {
        if (error.code === '23505') throw new Error(`"${payload.forma}" já está no dicionário.`)
        throw error
      }
      if (!(data as unknown[] | null)?.length) throw new Error('Nada foi gravado (sem permissão).')
      await tirarPergunta(t.pergunta_id)
    },
    onSuccess: () => {
      toast.success('Dicionário atualizado.')
      setTermo(null)
      invalidar()
    },
    onError: e => toast.error('Não foi possível salvar: ' + erroDe(e)),
  })

  const excluir = useMutation({
    mutationFn: async (x: Exclusao) => {
      const tabela = { artigo: 'kb_articles', termo: 'kb_termos', pergunta: 'kb_perguntas_sem_resposta' }[x.tipo]
      const { data, error } = await supabase.from(tabela as never).delete().eq('id', x.id).select('id')
      if (error) throw error
      if (!(data as unknown[] | null)?.length) throw new Error('Nada foi excluído (sem permissão ou já excluído).')
    },
    onSuccess: () => {
      toast.success('Excluído.')
      setExclusao(null)
      invalidar()
    },
    onError: e => toast.error('Não foi possível excluir: ' + erroDe(e)),
  })

  const alternar = useMutation({
    mutationFn: async (valor: boolean) => {
      const { data, error } = await supabase.rpc('chat_bot_ligar' as never, { p_ligado: valor } as never)
      if (error) throw error
      if ((data as { ok?: boolean } | null)?.ok !== true) throw new Error('Nada foi alterado.')
    },
    onSuccess: (_, valor) => {
      toast.success(valor ? 'Assistente ligado.' : 'Assistente desligado: as conversas novas vão direto para a equipe.')
      qc.invalidateQueries({ queryKey: ['kb-assistente'] })
    },
    onError: e => toast.error('Não foi possível alterar: ' + erroDe(e)),
  })

  const enviarArtigo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const msg = validarArtigo(form)
    if (msg) { toast.error(msg); return }
    salvar.mutate(form)
  }
  const enviarTermo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!termo) return
    const forma = normalizarForma(termo.forma)
    if (!forma || forma.length > 30) { toast.error('Forma: de 1 a 30 letras ou números (sem espaço).'); return }
    if (!termo.normal.trim() || termo.normal.trim().length > 60) { toast.error('Quer dizer: de 1 a 60 caracteres.'); return }
    salvarTermo.mutate(termo)
  }

  const nomeSetor = (id: string | null) => setores.data?.find(s => s.id === id)?.name
  const q = busca.trim().toLowerCase()
  const lista = (artigos.data ?? []).filter(a =>
    (situacao === 'todos' || (situacao === 'ia' ? a.origin === 'ia' && a.status === 'draft' : a.status === situacao && !(situacao === 'draft' && a.origin === 'ia')))
    && (!publico || a.audience === publico)
    && (!setor || a.department_id === setor)
    && (!q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q) || a.keywords.toLowerCase().includes(q)))
  const publicados = (artigos.data ?? []).filter(a => a.status === 'published').length

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-foreground flex items-center gap-2"><BookOpen className="w-7 h-7 text-primary" aria-hidden="true" /> Conhecimento</h1>
          <p className="text-sm text-muted-foreground mt-1">O assistente do chat responde com os artigos publicados, no público de quem pergunta. Rascunho não aparece para ninguém.</p>
        </div>
        {aba === 'artigos' && (
          <button type="button" onClick={() => setForm({ ...artigoVazio })} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" aria-hidden="true" /> Novo artigo
          </button>
        )}
        {aba === 'dicionario' && (
          <button type="button" onClick={() => setTermo({ id: null, forma: '', normal: '', pergunta_id: null })} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" aria-hidden="true" /> Nova forma
          </button>
        )}
      </div>

      <div className="mb-6 p-4 rounded-2xl border border-border bg-card flex flex-wrap items-center gap-3">
        <Bot className="w-5 h-5 text-primary" aria-hidden="true" />
        <div className="flex-1 min-w-[12rem]">
          <p className="text-sm font-semibold text-foreground">
            Assistente no atendimento: {ligado.data == null ? '…' : ligado.data ? 'ligado' : 'desligado'}
          </p>
          <p className="text-xs text-muted-foreground">Ligado, ele responde primeiro nas conversas novas e passa para a equipe quando não souber. Desligado, tudo vai direto para a equipe.</p>
        </div>
        {ligado.data != null && (
          <button type="button" disabled={alternar.isPending} onClick={() => alternar.mutate(!ligado.data)} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50">
            {ligado.data ? 'Desligar' : 'Ligar'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap bg-card p-1 border border-border rounded-xl gap-1 w-fit mb-4" role="tablist" aria-label="Seções da base">
        {([
          ['artigos', `Artigos (${publicados} publicados)`],
          ['dicionario', 'Dicionário'],
          ['perguntas', `Perguntas sem resposta (${perguntas.data?.length ?? 0})`],
        ] as const).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={aba === v} onClick={() => setAba(v)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${aba === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
      </div>

      {aba === 'artigos' && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[14rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar no título, texto ou palavras-chave" aria-label="Buscar artigos" className={`${inputCls} pl-9`} />
            </div>
            <select aria-label="Situação" value={situacao} onChange={e => setSituacao(e.target.value as Situacao)} className={`${inputCls} w-auto`}>
              <option value="todos">Todas as situações</option>
              <option value="published">Publicados</option>
              <option value="draft">Rascunhos</option>
              <option value="ia">Sugestões da IA</option>
            </select>
            <select aria-label="Público" value={publico} onChange={e => setPublico(e.target.value as '' | Publico)} className={`${inputCls} w-auto`}>
              <option value="">Todos os públicos</option>
              {(Object.keys(PUBLICO) as Publico[]).map(p => <option key={p} value={p}>{PUBLICO[p]}</option>)}
            </select>
            <select aria-label="Setor" value={setor} onChange={e => setSetor(e.target.value)} className={`${inputCls} w-auto`}>
              <option value="">Todos os setores</option>
              {(setores.data ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {artigos.isError ? (
            <div role="alert" className="p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
              Não foi possível carregar os artigos: {erroDe(artigos.error)}. Se citar uma tabela inexistente, falta aplicar <span className="font-mono">docs/sql/20261003_chat_bot.sql</span>.
            </div>
          ) : artigos.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" aria-label="Carregando" /></div>
          ) : lista.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">Nenhum artigo neste filtro.</div>
          ) : (
            <ul className="divide-y divide-border border border-border rounded-2xl bg-card">
              {lista.map(a => (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{a.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                      <span className={`px-1.5 py-px rounded-full font-semibold ${a.status === 'published' ? 'bg-green-500/10 text-green-700 dark:text-green-300' : 'bg-amber-500/15 text-amber-800 dark:text-amber-200'}`}>
                        {a.status === 'published' ? 'Publicado' : a.origin === 'ia' ? 'Sugestão' : 'Rascunho'}
                      </span>
                      <span className="px-1.5 py-px rounded-full bg-muted text-muted-foreground">{PUBLICO[a.audience]}</span>
                      {nomeSetor(a.department_id) && <span className="px-1.5 py-px rounded-full bg-muted text-muted-foreground">{nomeSetor(a.department_id)}</span>}
                      <span className="px-1.5 py-px rounded-full border border-border text-muted-foreground">{ORIGEM[a.origin]}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" aria-label={`Editar artigo ${a.title}`} onClick={() => setForm({
                      ...artigoVazio, id: a.id, title: a.title, body: a.body, keywords: a.keywords, audience: a.audience,
                      department_id: a.department_id ?? '', publicado: a.status === 'published', review_note: a.review_note,
                    })} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button type="button" aria-label={`Excluir artigo ${a.title}`} onClick={() => setExclusao({ tipo: 'artigo', id: a.id, nome: a.title })} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600">
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {aba === 'dicionario' && (
        <>
          <p className="mb-4 text-xs text-muted-foreground">Antes de buscar, o assistente troca cada palavra da pergunta pela forma normal (sem diferenciar maiúscula nem acento). Ex.: “vc” → “você”, “ingr” → “ingresso”.</p>
          {termos.isError ? (
            <div role="alert" className="p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">Não foi possível carregar o dicionário: {erroDe(termos.error)}</div>
          ) : termos.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" aria-label="Carregando" /></div>
          ) : !termos.data?.length ? (
            <div className="text-center py-16 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">Dicionário vazio.</div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {termos.data.map(t => (
                <li key={t.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                  <span className="font-mono font-semibold text-foreground">{t.forma}</span>
                  <span aria-hidden="true" className="text-muted-foreground">→</span>
                  <span className="sr-only">quer dizer</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{t.normal}</span>
                  <button type="button" aria-label={`Editar ${t.forma}`} onClick={() => setTermo({ ...t, pergunta_id: null })} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" aria-hidden="true" /></button>
                  <button type="button" aria-label={`Excluir ${t.forma}`} onClick={() => setExclusao({ tipo: 'termo', id: t.id, nome: `${t.forma} → ${t.normal}` })} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {aba === 'perguntas' && (
        <>
          <p className="mb-4 text-xs text-muted-foreground">O que o assistente não soube responder e passou para a equipe, as mais repetidas primeiro. O texto é guardado sem acento, com siglas já trocadas e sem números de documento, telefone ou e-mail.</p>
          {perguntas.isError ? (
            <div role="alert" className="p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">Não foi possível carregar as perguntas: {erroDe(perguntas.error)}</div>
          ) : perguntas.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" aria-label="Carregando" /></div>
          ) : !perguntas.data?.length ? (
            <div className="text-center py-16 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">Nenhuma pergunta sem resposta.</div>
          ) : (
            <ul className="divide-y divide-border border border-border rounded-2xl bg-card">
              {perguntas.data.map(p => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground break-words">{p.texto}</p>
                    <p className="text-[11px] text-muted-foreground">{PUBLICO_PERGUNTA[p.audience] ?? p.audience} · {p.vezes} {p.vezes === 1 ? 'vez' : 'vezes'} · última em {dataBr(p.ultima_em)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <button type="button" onClick={() => setForm({ ...artigoVazio, keywords: p.texto.slice(0, 500), audience: p.audience === 'participant' || p.audience === 'producer' ? p.audience : 'all', pergunta_id: p.id })}
                      className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1" aria-label={`Criar artigo para: ${p.texto}`}>
                      <BookPlus className="w-3.5 h-3.5" aria-hidden="true" /> Criar artigo
                    </button>
                    <button type="button" onClick={() => setTermo({ id: null, forma: p.texto.split(' ')[0] ?? '', normal: '', pergunta_id: p.id })}
                      className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-muted flex items-center gap-1" aria-label={`Acrescentar ao dicionário: ${p.texto}`}>
                      <Languages className="w-3.5 h-3.5" aria-hidden="true" /> Acrescentar ao dicionário
                    </button>
                    <button type="button" onClick={() => setExclusao({ tipo: 'pergunta', id: p.id, nome: p.texto })}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" aria-label={`Descartar pergunta: ${p.texto}`}>
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 glass-backdrop" role="dialog" aria-modal="true" aria-labelledby="artigo-titulo" onKeyDown={e => { if (e.key === 'Escape') setForm(null) }}>
          <form onSubmit={enviarArtigo} className="glass-panel w-full max-w-2xl my-8 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="artigo-titulo" className="font-serif text-xl text-foreground">
                {form.id ? 'Editar artigo' : form.origin === 'atendente' ? 'Artigo a partir da resposta do atendente' : 'Novo artigo'}
              </h2>
              <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Fechar"><X className="w-4 h-4" aria-hidden="true" /></button>
            </div>
            {form.review_note && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                <strong>Motivo do rascunho:</strong> {form.review_note}
              </div>
            )}
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground">Título (a pergunta, como a pessoa faria) *</span>
              <input autoFocus className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} maxLength={160} required />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground">Resposta *</span>
              <textarea className={`${inputCls} min-h-[10rem]`} value={form.body} onChange={e => set('body', e.target.value)} maxLength={3500} required aria-describedby="artigo-contador" />
              <span id="artigo-contador" className="block text-right text-[11px] text-muted-foreground">{form.body.length} / 3.500</span>
            </label>
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground">Palavras-chave (separadas por vírgula; jeitos diferentes de perguntar)</span>
              <input className={inputCls} value={form.keywords} onChange={e => set('keywords', e.target.value)} maxLength={500} />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Público</span>
                <select className={inputCls} value={form.audience} onChange={e => set('audience', e.target.value as Publico)}>
                  {(Object.keys(PUBLICO) as Publico[]).map(p => <option key={p} value={p}>{PUBLICO[p]}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Setor</span>
                <select className={inputCls} value={form.department_id} onChange={e => set('department_id', e.target.value)}>
                  <option value="">Sem setor</option>
                  {(setores.data ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.publicado} onChange={e => set('publicado', e.target.checked)} />
              Publicado (o assistente passa a usar)
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground">Cancelar</button>
              <button type="submit" disabled={salvar.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                {salvar.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {form.id ? 'Salvar alterações' : 'Criar artigo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {termo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-backdrop" role="dialog" aria-modal="true" aria-labelledby="termo-titulo" onKeyDown={e => { if (e.key === 'Escape') setTermo(null) }}>
          <form onSubmit={enviarTermo} className="glass-panel w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="termo-titulo" className="font-serif text-xl text-foreground">{termo.id ? 'Editar forma' : 'Nova forma no dicionário'}</h2>
              <button type="button" onClick={() => setTermo(null)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Fechar"><X className="w-4 h-4" aria-hidden="true" /></button>
            </div>
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground">Forma (sigla, abreviação ou gíria; uma palavra) *</span>
              <input autoFocus className={`${inputCls} font-mono`} value={termo.forma} onChange={e => setTermo({ ...termo, forma: e.target.value })} maxLength={40} required aria-describedby="termo-forma-dica" />
              <span id="termo-forma-dica" className="block text-[11px] text-muted-foreground">Guardada como “{normalizarForma(termo.forma)}”: minúscula, sem acento e sem espaço.</span>
            </label>
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground">Quer dizer *</span>
              <input className={inputCls} value={termo.normal} onChange={e => setTermo({ ...termo, normal: e.target.value })} maxLength={60} required />
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button type="button" onClick={() => setTermo(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground">Cancelar</button>
              <button type="submit" disabled={salvarTermo.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                {salvarTermo.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {exclusao && (
        <ConfirmarExclusao alvo={exclusao} ocupado={excluir.isPending} aoConfirmar={() => excluir.mutate(exclusao)} aoFechar={() => setExclusao(null)} />
      )}
    </div>
  )
}
