import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Bot, CheckCircle2, ChevronRight, Headset, Loader2, LogIn, Mail, MessageCircle, Send, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  MAX_TEXTO, avaliarConversa, depois, falarComAtendente, iniciais, iniciarConversa, marcarLida, mensagemDeErro, publicoDoPapel, quando,
  useAssuntos, useChatConfig, useMeuContato, useMinhasConversas, validarTelefoneBR,
  type Assunto, type Conversa, type Publico,
} from '../hooks/useConversas'
import PhoneInput from './ui/PhoneInput'
import ChatThread, { BotaoSom } from './chat/ChatThread'

// Widget do cliente (etapa 1a do chat estilo Intercom): balão do site (export default, assuntos do
// site) e aba "Falar com a Evokaa" da janela do Evo (SupportChatPanel, assuntos do papel da conta).
// Início → assunto → formulário → conversa → resolvida (avaliação; responder reabre).

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:focus-visible:ring-violet-300'
const campo = 'w-full rounded-xl border border-slate-900/20 bg-white/80 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-violet-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/40 dark:border-white/20 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-violet-300'
const primario = `inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] px-5 py-2.5 text-sm font-semibold text-[#fff] shadow-[0_4px_20px_rgba(59,130,246,0.3)] transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] disabled:opacity-50 ${foco}`
const rotulo = 'mb-1 block text-xs font-semibold text-slate-800 dark:text-slate-200'
const suave = 'text-slate-700 dark:text-slate-300'

type Tela = { t: 'inicio' } | { t: 'assuntos' } | { t: 'form'; assunto: Assunto } | { t: 'conversa'; id: string }

function Voltar({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-2">
      <button type="button" onClick={onClick} aria-label="Voltar" className={`rounded-lg p-1.5 text-slate-700 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10 ${foco}`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function SemLogin() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#1d68c4] to-[#8f33f5] text-[#fff] shadow-lg">
        <MessageCircle className="h-7 w-7" aria-hidden="true" />
      </span>
      <div>
        <h3 data-foco tabIndex={-1} className="text-base font-semibold focus:outline-none">Fale com a equipe Evokaa</h3>
        <p className={`mt-1 text-sm ${suave}`}>Entre na sua conta para conversar pelo chat, ou use o formulário de contato.</p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Link to="/auth/login" className={primario}><LogIn className="h-4 w-4" aria-hidden="true" /> Entrar</Link>
        <Link to="/contato" className={`inline-flex items-center justify-center gap-2 rounded-full border border-slate-900/20 px-5 py-2.5 text-sm font-semibold hover:bg-slate-900/5 dark:border-white/20 dark:hover:bg-white/10 ${foco}`}>
          <Mail className="h-4 w-4" aria-hidden="true" /> Formulário de contato
        </Link>
      </div>
    </div>
  )
}

function ItemConversa({ c, onClick }: { c: Conversa; onClick: () => void }) {
  const naoLida = depois(c.last_reply_at, c.customer_last_read_at)
  return (
    <li>
      <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-slate-900/5 dark:hover:bg-white/[0.06] ${foco}`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-600/10 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`truncate text-sm ${naoLida ? 'font-semibold' : 'font-medium'}`}>{c.chat_topics?.label ?? 'Conversa'}</span>
            {c.status === 'resolved' && <span className="shrink-0 rounded-full bg-emerald-600/10 px-1.5 py-px text-[10px] font-semibold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">{c.bot_resolveu ? 'Resolvida pelo assistente' : 'Resolvida'}</span>}
          </span>
          <span className={`block truncate text-xs ${suave}`}>{c.last_message_preview ?? ''}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`text-[11px] ${suave}`}>{quando(c.last_message_at)}</span>
          {naoLida && <span className="h-2.5 w-2.5 rounded-full bg-plum"><span className="sr-only">Resposta não lida</span></span>}
        </span>
      </button>
    </li>
  )
}

function Inicio({ ir }: { ir: (t: Tela) => void }) {
  const { user } = useAuth()
  const config = useChatConfig()
  const { data: conversas, isLoading, isError, refetch } = useMinhasConversas()
  const [todas, setTodas] = useState(false)
  const primeiro = user?.full_name?.trim().split(/\s+/)[0]
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-5">
      <div className="rounded-3xl bg-gradient-to-br from-[#1d68c4] via-[#4a60e3] to-[#8f33f5] px-5 py-5 text-[#fff] shadow-[0_8px_30px_rgba(74,96,227,0.35)]">
        <h3 data-foco tabIndex={-1} className="text-xl font-semibold leading-tight focus:outline-none">Olá{primeiro ? `, ${primeiro}` : ''}! 👋</h3>
        <p className="mt-1 text-base">Como podemos ajudar?</p>
      </div>

      <button
        type="button"
        onClick={() => ir({ t: 'assuntos' })}
        className={`flex w-full items-center gap-3 rounded-2xl border border-slate-900/10 bg-white/80 px-4 py-3.5 text-left shadow-sm transition-colors hover:border-violet-600/40 dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-violet-300/40 ${foco}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Enviar mensagem</span>
          <span className={`mt-0.5 flex items-center gap-1.5 text-xs ${suave}`}>
            {config.data ? (
              <>
                <span className={`h-2 w-2 shrink-0 rounded-full ${config.data.aberto_agora ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />
                {config.data.aberto_agora ? 'Estamos online agora' : 'Fora do horário'} · {config.data.prazo}
              </>
            ) : config.isError ? 'A equipe responde por aqui e avisa por e-mail.' : 'Carregando…'}
          </span>
        </span>
        <Send className="h-4 w-4 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden="true" />
      </button>

      <section aria-labelledby="suporte-recentes">
        <h3 id="suporte-recentes" className={`mb-1 px-1 text-xs font-semibold uppercase tracking-wide ${suave}`}>Conversas recentes</h3>
        {isLoading ? (
          <div className="space-y-2" aria-label="Carregando conversas">
            {[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-900/10 dark:bg-white/10" />)}
          </div>
        ) : isError ? (
          <p role="alert" className={`px-1 text-sm ${suave}`}>
            Não foi possível carregar suas conversas.{' '}
            <button type="button" onClick={() => refetch()} className={`font-semibold underline ${foco}`}>Tentar de novo</button>
          </p>
        ) : !conversas?.length ? (
          <p className={`px-1 text-sm ${suave}`}>Você ainda não tem conversas. Mande a primeira mensagem!</p>
        ) : (
          <>
            <ul className="-mx-1">
              {(todas ? conversas : conversas.slice(0, 5)).map((c) => <ItemConversa key={c.id} c={c} onClick={() => ir({ t: 'conversa', id: c.id })} />)}
            </ul>
            {conversas.length > 5 && (
              <button type="button" onClick={() => setTodas((t) => !t)} className={`mt-1 px-1 text-xs font-semibold text-violet-800 underline dark:text-violet-200 ${foco}`}>
                {todas ? 'Ver menos' : `Ver mais (${conversas.length - 5})`}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function Assuntos({ publico, ir }: { publico: Publico; ir: (t: Tela) => void }) {
  const { data, isLoading, isError, refetch } = useAssuntos(publico)
  return (
    <>
      <Voltar onClick={() => ir({ t: 'inicio' })}>
        <h3 data-foco tabIndex={-1} className="text-sm font-semibold focus:outline-none">Sobre o que você quer falar?</h3>
      </Voltar>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        {isLoading ? (
          <div className="space-y-2" aria-label="Carregando assuntos">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-900/10 dark:bg-white/10" />)}
          </div>
        ) : isError ? (
          <p role="alert" className={`text-sm ${suave}`}>
            Não foi possível carregar os assuntos.{' '}
            <button type="button" onClick={() => refetch()} className={`font-semibold underline ${foco}`}>Tentar de novo</button>
          </p>
        ) : !data?.length ? (
          <p className={`text-sm ${suave}`}>
            Nenhum assunto disponível agora. Use o <Link to="/contato" className="font-semibold underline">formulário de contato</Link>.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => ir({ t: 'form', assunto: a })}
                  className={`flex w-full items-center gap-3 rounded-2xl border border-slate-900/10 bg-white/80 px-4 py-3 text-left transition-colors hover:border-violet-600/40 dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-violet-300/40 ${foco}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{a.label}</span>
                    {a.hint && <span className={`mt-0.5 block text-xs ${suave}`}>{a.hint}</span>}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

type Campos = { nome: string; telefone: string; novidades: boolean; texto: string }

function Formulario({ assunto, ir }: { assunto: Assunto; ir: (t: Tela) => void }) {
  const { user } = useAuth()
  const contato = useMeuContato()
  const telPerfil = validarTelefoneBR(user?.phone) ? `+${(user?.phone ?? '').replace(/\D/g, '')}` : ''
  return (
    <>
      <Voltar onClick={() => ir({ t: 'assuntos' })}>
        <p className={`text-xs ${suave}`}>Assunto</p>
        <h3 data-foco tabIndex={-1} className="truncate text-sm font-semibold focus:outline-none">{assunto.label}</h3>
      </Voltar>
      {contato.isLoading ? (
        <div className="flex flex-1 items-center justify-center" aria-label="Carregando seus dados"><Loader2 className="h-6 w-6 animate-spin text-plum" aria-hidden="true" /></div>
      ) : (
        <>
        {contato.isError && (
          <p role="status" className={`mx-4 mb-2 text-[11px] ${suave}`}>Não carregamos suas preferências salvas; confira os campos.</p>
        )}
        <CamposFormulario
          assunto={assunto}
          ir={ir}
          // 1ª vez: nome do perfil e caixa de novidades desmarcada; depois, o que a pessoa já informou
          inicial={{
            nome: contato.data?.name ?? user?.full_name ?? '',
            telefone: contato.data?.phone ? `+${contato.data.phone}` : telPerfil,
            novidades: contato.data?.marketing_opt_in ?? false,
            texto: '',
          }}
        />
        </>
      )}
    </>
  )
}

function CamposFormulario({ assunto, ir, inicial }: { assunto: Assunto; ir: (t: Tela) => void; inicial: Campos }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [f, setF] = useState(inicial)
  const [erros, setErros] = useState<Partial<Record<keyof Campos, string>>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const mudar = <K extends keyof Campos>(k: K, v: Campos[K]) => setF((x) => ({ ...x, [k]: v }))

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const nome = f.nome.trim()
    const novos: typeof erros = {}
    if (nome.length < 2 || nome.length > 120) novos.nome = 'Informe seu nome (de 2 a 120 caracteres).'
    if (!validarTelefoneBR(f.telefone)) novos.telefone = 'Informe um celular ou telefone do Brasil com DDD.'
    if (!f.texto.trim()) novos.texto = 'Escreva sua mensagem.'
    setErros(novos)
    if (Object.keys(novos).length) return
    setEnviando(true)
    setErro(null)
    try {
      const id = await iniciarConversa({ assuntoId: assunto.id, nome, telefone: f.telefone, novidades: f.novidades, texto: f.texto.trim() })
      qc.invalidateQueries({ queryKey: ['chat-minhas', user?.id] })
      qc.invalidateQueries({ queryKey: ['chat-contato', user?.id] })
      ir({ t: 'conversa', id })
    } catch (err) {
      setErro(mensagemDeErro(err))
      setEnviando(false)
    }
  }

  const ajuda = (k: keyof Campos) => erros[k] && <p id={`suporte-erro-${k}`} className="mt-1 text-xs text-red-700 dark:text-red-300">{erros[k]}</p>

  return (
    <form onSubmit={enviar} noValidate className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-5">
      <div>
        <label htmlFor="suporte-nome" className={rotulo}>Nome</label>
        <input id="suporte-nome" autoComplete="name" maxLength={120} value={f.nome} onChange={(e) => mudar('nome', e.target.value)} aria-invalid={!!erros.nome} aria-describedby={erros.nome ? 'suporte-erro-nome' : undefined} className={campo} />
        {ajuda('nome')}
      </div>
      <div>
        <label htmlFor="suporte-telefone" className={rotulo}>Telefone (WhatsApp)</label>
        {/* PhoneInput usa text-espresso/bg-white: estas regras mantêm o contraste dentro do vidro, nos dois temas */}
        <div className="[&_button]:border-slate-900/20 [&_button]:bg-white/80 [&_input]:border-slate-900/20 [&_input]:bg-white/80 [&_input]:text-slate-900 [&_span]:text-slate-900 dark:[&_button]:border-white/20 dark:[&_button]:bg-white/[0.07] dark:[&_input]:border-white/20 dark:[&_input]:bg-white/[0.07] dark:[&_input]:text-white dark:[&_span]:text-white">
          <PhoneInput id="suporte-telefone" apenasBrasil value={f.telefone} onChange={(v) => mudar('telefone', v)} />
        </div>
        {ajuda('telefone')}
      </div>
      <div>
        <label htmlFor="suporte-email" className={rotulo}>E-mail</label>
        <input id="suporte-email" type="email" value={user?.email ?? ''} readOnly aria-describedby="suporte-email-dica" className={`${campo} cursor-not-allowed opacity-80`} />
        <p id="suporte-email-dica" className={`mt-1 text-[11px] ${suave}`}>O e-mail da sua conta. Avisamos por ele quando houver resposta.</p>
      </div>
      <div>
        <label htmlFor="suporte-texto" className={rotulo}>Mensagem</label>
        <textarea id="suporte-texto" rows={4} maxLength={MAX_TEXTO} value={f.texto} onChange={(e) => mudar('texto', e.target.value)} placeholder="Conte o que aconteceu…" aria-invalid={!!erros.texto} aria-describedby={erros.texto ? 'suporte-erro-texto' : undefined} className={`${campo} resize-none`} />
        {ajuda('texto')}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={f.novidades} onChange={(e) => mudar('novidades', e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600" />
        <span>
          Quero receber novidades da Evokaa por e-mail e WhatsApp
          {inicial.novidades && f.novidades && <span className={`block text-[11px] ${suave}`}>Você já aceitou; desmarque para deixar de receber.</span>}
        </span>
      </label>
      <p className={`text-[11px] leading-snug ${suave}`}>
        Seus dados são tratados conforme a{' '}
        <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Política de Privacidade</a>.
      </p>
      {erro && (
        <p role="alert" className="flex items-start gap-1.5 rounded-xl border border-red-600/30 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {erro}
        </p>
      )}
      <button type="submit" disabled={enviando} className={`${primario} w-full`}>
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} Enviar mensagem
      </button>
    </form>
  )
}

const NOTAS = [
  { n: 1, emoji: '😞', rotulo: 'Ruim' },
  { n: 2, emoji: '😐', rotulo: 'Regular' },
  { n: 3, emoji: '😊', rotulo: 'Ótimo' },
] as const

/** Resolvida no "Sim" do assistente: sem a nota de 1 a 3 (ela fica para o atendimento humano). */
function ResolvidaPeloAssistente() {
  return (
    <div className="mx-4 mb-1 rounded-2xl border border-emerald-600/20 bg-emerald-50/80 px-4 py-3 text-center dark:border-emerald-300/20 dark:bg-emerald-400/10">
      <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Resolvida pelo assistente
      </p>
      <p className={`mt-1 text-[11px] ${suave}`}>Precisa de mais alguma coisa? Escreva abaixo e a conversa é reaberta.</p>
    </div>
  )
}

/** Botão sempre visível enquanto a conversa está com o assistente. */
function FalarComAtendente({ id, atualizar }: { id: string; atualizar: () => void }) {
  const qc = useQueryClient()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const pedir = async () => {
    setEnviando(true)
    setErro(null)
    try {
      await falarComAtendente(id)
      atualizar()
      qc.invalidateQueries({ queryKey: ['chat-mensagens', id] })
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div className="mx-4 mb-1">
      <button type="button" disabled={enviando} onClick={pedir} className={`inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-900/20 px-4 py-1.5 text-xs font-semibold hover:bg-slate-900/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10 ${foco}`}>
        {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Headset className="h-3.5 w-3.5" aria-hidden="true" />} Falar com um atendente
      </button>
      {erro && <p role="alert" className="mt-1 text-center text-xs text-red-700 dark:text-red-300">{erro}</p>}
    </div>
  )
}

function Avaliacao({ c, atualizar }: { c: Conversa; atualizar: () => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const avaliar = async (n: 1 | 2 | 3) => {
    setEnviando(true)
    setErro(null)
    try {
      await avaliarConversa(c.id, n)
      atualizar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div className="mx-4 mb-1 rounded-2xl border border-emerald-600/20 bg-emerald-50/80 px-4 py-3 text-center dark:border-emerald-300/20 dark:bg-emerald-400/10">
      <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Conversa resolvida
      </p>
      {c.rating ? (
        <p className={`mt-1 text-sm ${suave}`}>Obrigado pela avaliação! {NOTAS[c.rating - 1]?.emoji}</p>
      ) : (
        <>
          <p id={`avaliar-${c.id}`} className={`mt-1 text-sm ${suave}`}>Como foi o atendimento?</p>
          <div role="group" aria-labelledby={`avaliar-${c.id}`} className="mt-2 flex justify-center gap-2">
            {NOTAS.map((x) => (
              <button key={x.n} type="button" disabled={enviando} onClick={() => avaliar(x.n)} aria-label={x.rotulo} title={x.rotulo} className={`grid h-11 w-11 place-items-center rounded-full bg-white/80 text-2xl transition-transform motion-safe:hover:scale-110 disabled:opacity-50 dark:bg-white/10 ${foco}`}>
                <span aria-hidden="true">{x.emoji}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {erro && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">{erro}</p>}
      <p className={`mt-2 text-[11px] ${suave}`}>Precisa de mais alguma coisa? Escreva abaixo e a conversa é reaberta.</p>
    </div>
  )
}

function TelaConversa({ id, ir }: { id: string; ir: (t: Tela) => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: conversas } = useMinhasConversas()
  const c = conversas?.find((x) => x.id === id)
  const naoLida = !!c && depois(c.last_reply_at, c.customer_last_read_at)
  const comAssistente = c?.bot_state === 'bot' && c.status === 'open'
  const atualizar = () => qc.invalidateQueries({ queryKey: ['chat-minhas', user?.id] })

  // "visto" do cliente: marca ao abrir e a cada resposta nova com a conversa na tela
  useEffect(() => {
    if (!naoLida) return
    marcarLida(id).then(() => qc.invalidateQueries({ queryKey: ['chat-minhas', user?.id] }), () => {})
  }, [naoLida, id, qc, user?.id])

  return (
    <>
      <Voltar onClick={() => ir({ t: 'inicio' })}>
        {/* com o assistente: "Assistente Evokaa"; depois, quem assumiu aparece com o nome (assignee_name,
            gravado pelo servidor); sem dono, "Equipe Evokaa" */}
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1d68c4] to-[#8f33f5] text-xs font-bold text-[#fff]">
            {comAssistente ? <Bot className="h-4 w-4" /> : c?.assignee_name ? iniciais(c.assignee_name) : <MessageCircle className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <h3 data-foco tabIndex={-1} className="truncate text-sm font-semibold focus:outline-none">
              {comAssistente ? 'Assistente Evokaa' : c?.assignee_name ? `${c.assignee_name} está te atendendo` : 'Equipe Evokaa'}
            </h3>
            <p className={`truncate text-xs ${suave}`}>
              {comAssistente && <span>assistente virtual</span>}
              {!comAssistente && c?.assignee_name && <span>Equipe Evokaa</span>}
              {(comAssistente || c?.assignee_name) && <span aria-hidden="true"> · </span>}
              <span>{c?.chat_topics?.label ?? 'Conversa'}{c?.status === 'resolved' ? ' · resolvida' : ''}</span>
            </p>
          </div>
        </div>
      </Voltar>
      {comAssistente && <FalarComAtendente id={id} atualizar={atualizar} />}
      {/* do assistente: selo só no "Sim"; fechada pelo cron ou pela equipe, sem selo e sem nota de 1 a 3 */}
      {c?.status === 'resolved' && (c.bot_state === 'bot' ? c.bot_resolveu && <ResolvidaPeloAssistente /> : <Avaliacao c={c} atualizar={atualizar} />)}
      <ChatThread
        key={id}
        conversaId={id}
        souEquipe={false}
        podeAnexar={c?.status === 'open'}
        lidoAte={c?.agent_last_read_at}
        aoEnviar={atualizar}
        rotuloCampo={comAssistente ? 'Mensagem para o assistente Evokaa' : 'Mensagem para a equipe Evokaa'}
        assistente={comAssistente}
      />
    </>
  )
}

function Suporte({ publico, focarAoAbrir = false }: { publico: Publico; focarAoAbrir?: boolean }) {
  const { user } = useAuth()
  const [tela, setTela] = useState<Tela>({ t: 'inicio' })
  const raiz = useRef<HTMLDivElement>(null)
  const anterior = useRef(tela)
  // A cada troca de tela o foco vai para o título (leitor de tela e teclado); ao abrir o balão, também
  useEffect(() => {
    if (anterior.current !== tela || focarAoAbrir) raiz.current?.querySelector<HTMLElement>('[data-foco]')?.focus()
    anterior.current = tela
  }, [tela, focarAoAbrir])
  return (
    <div ref={raiz} className="flex min-h-0 flex-1 flex-col pt-3">
      {!user && <SemLogin />}
      {user && tela.t === 'inicio' && <Inicio ir={setTela} />}
      {user && tela.t === 'assuntos' && <Assuntos publico={publico} ir={setTela} />}
      {user && tela.t === 'form' && <Formulario assunto={tela.assunto} ir={setTela} />}
      {user && tela.t === 'conversa' && <TelaConversa id={tela.id} ir={setTela} />}
    </div>
  )
}

/** Aba "Falar com a Evokaa" da janela do Evo: assuntos do papel da conta. O canal fica no EvoHub. */
export function SupportChatPanel() {
  const { user } = useAuth()
  return <Suporte key={user?.id ?? 'anon'} publico={publicoDoPapel(user?.role)} />
}

/**
 * Janela flutuante NÃO modal (estilo Intercom): sem véu, a página segue rolável e clicável; clique
 * fora não fecha; Esc fecha (quem abriu devolve o foco). Usada pelo balão do site e, para o
 * participante, pelo mascote do Evo. `posicao` traz bottom/right/altura de cada uso.
 */
export function JanelaSuporte({ publico, aoFechar, posicao }: { publico: Publico; aoFechar: () => void; posicao: string }) {
  const { user } = useAuth()
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="suporte-titulo"
      onKeyDown={(e) => e.key === 'Escape' && aoFechar()}
      className={`glass-panel fixed right-6 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden max-sm:inset-x-2 max-sm:w-auto max-sm:max-w-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 ${posicao}`}
      style={{ borderRadius: 28 }}
    >
      <div className="flex items-center justify-between px-5 pb-1 pt-4">
        <h2 id="suporte-titulo" className="text-base font-semibold">Falar com a Evokaa</h2>
        <BotaoSom className="ml-auto mr-1 text-slate-700 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10" />
        <button type="button" onClick={aoFechar} aria-label="Fechar chat com a Evokaa" className={`rounded-lg p-1.5 text-slate-700 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10 ${foco}`}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <Suporte key={user?.id ?? 'anon'} publico={publico} focarAoAbrir />
    </div>
  )
}

/** Balão do site (fora dos painéis do app): assuntos do site. */
export default function SupportChatWidget() {
  const [aberto, setAberto] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const { naoLidas } = useMinhasConversas(true)
  const fechar = () => {
    setAberto(false)
    botao.current?.focus()
  }
  const rotuloBotao = aberto ? 'Fechar chat com a Evokaa' : naoLidas > 0 ? `Falar com a Evokaa (${naoLidas} ${naoLidas === 1 ? 'resposta nova' : 'respostas novas'})` : 'Falar com a Evokaa'

  return (
    <>
      {aberto && <JanelaSuporte publico="site" aoFechar={fechar} posicao="bottom-24 max-sm:bottom-20 h-[min(620px,calc(100dvh-8rem))]" />}
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-label={rotuloBotao}
        aria-expanded={aberto}
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#1d68c4] to-[#8f33f5] text-[#fff] shadow-[0_6px_30px_rgba(74,96,227,0.45)] transition-transform motion-safe:hover:scale-105 motion-safe:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 dark:focus-visible:ring-violet-300"
      >
        {aberto ? <X className="h-6 w-6" aria-hidden="true" /> : <MessageCircle className="h-6 w-6" aria-hidden="true" />}
        {naoLidas > 0 && !aberto && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-[#fff] ring-2 ring-[#f8fafc] dark:ring-[#07080c]">
            {naoLidas}
          </span>
        )}
      </button>
    </>
  )
}
