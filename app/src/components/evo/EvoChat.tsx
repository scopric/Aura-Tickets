import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { GENEROS } from '../../lib/generos'
import { conversaParaMarkdown, nomeArquivoConversa } from '../../lib/evoConversa'
import { FORM_PLANEJAR_VAZIO, FormPlanejar, PropostaCard, type CamposPlanejar, type EdicaoProposta, type EventProposal, type MudancaProposta, type PlanejarForm } from './EvoPlanejar'

export interface Mensagem {
  id: string
  role: 'user' | 'model'
  text: string
  /** Recusa, erro ou pergunta sem resposta: aparece na tela mas não vai no histórico enviado ao Evo */
  aviso?: boolean
  proposal?: EventProposal
  usageId?: string
  criadoId?: string
  /** O evento foi criado mas os lotes falharam: o card não deixa criar de novo */
  semLotes?: boolean
  /** Edições do cartão da proposta e insert em andamento: sobrevivem ao fechar o painel */
  edicao?: EdicaoProposta
  criando?: boolean
}

type Saldo = { habilitado: boolean; plano: string; cota: number; concedido: number; usado: number; restante: number; periodo: 'total' | 'mes' }
type Resposta =
  | { ok: true; reply_md: string; proposal?: EventProposal; usage_id: string; restante: number }
  | { ok: false; motivo: string; message?: string; custo?: number; restante?: number }

const MAX = 2000

const RECUSAS: Record<string, string> = {
  desligado: 'O Evo ainda não está disponível.',
  sem_credito: 'Seus créditos do Evo acabaram este mês.',
  limite_hora: 'Você fez muitas perguntas na última hora. Espere um pouco e tente de novo.',
  teto_diario: 'O Evo atingiu o limite de uso de hoje. Tente de novo amanhã.',
  sem_chave: 'O Evo está em manutenção. Tente de novo mais tarde.',
  nao_autorizado: 'Sua conta não tem acesso ao Evo.',
  sessao: 'Sua sessão expirou. Entre de novo na sua conta para usar o Evo.',
  erro_ia: 'O Evo teve um problema para responder. Tente de novo em instantes.',
  rede: 'Não consegui falar com o Evo. Confira sua conexão e tente de novo.',
  indisponivel: 'O Evo ainda não está disponível. Tente mais tarde.',
  instabilidade: 'O Evo está com instabilidade. Tente de novo em instantes.',
}

const ATALHOS = [
  { rotulo: 'Quanto de bebida para minha festa?', pergunta: 'Quanto de bebida para minha festa?' },
  { rotulo: 'Quais as regras de saída e brigada?', pergunta: 'Quais as regras de saída e brigada?' },
  { rotulo: 'Meus eventos', pergunta: 'Quais são os meus eventos?' },
]

async function chamarEvo(body: object): Promise<Resposta> {
  const { data, error } = await supabase.functions.invoke('agent', { body })
  if (!error) return data as Resposta
  // Erro HTTP ou do relay traz a resposta em `context`
  const ctx = (error as { context?: unknown }).context
  if (ctx instanceof Response) {
    if (ctx.status === 401) return { ok: false, motivo: 'sessao' }
    if (ctx.status === 404) return { ok: false, motivo: 'indisponivel' }
    const corpo = await ctx.json().catch(() => null)
    if (corpo?.motivo) return corpo
    return { ok: false, motivo: ctx.status >= 500 || error.name === 'FunctionsRelayError' ? 'instabilidade' : 'erro_ia' }
  }
  // Sem Response (FunctionsFetchError). Função não publicada também cai aqui: o gateway responde
  // 404 ao preflight OPTIONS e o navegador acusa erro de CORS. Só culpa a conexão se estiver offline.
  return { ok: false, motivo: navigator.onLine === false ? 'rede' : 'instabilidade' }
}

// PGRST202 (PostgREST) / 42883 (Postgres): ai_balance ainda não existe no banco
const funcaoInexistente = (e: unknown) => ['PGRST202', '42883'].includes((e as { code?: string } | null)?.code ?? '')

// ponytail: renderizador mínimo; trocar por react-markdown se precisar de tabela/link
function negrito(linha: string): ReactNode[] {
  return linha.split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 ? <strong key={i} className="font-semibold">{parte}</strong> : parte))
}

/** Markdown mínimo e seguro (só texto do React, nada de HTML cru): parágrafos, títulos, listas e **negrito**. */
export function EvoMarkdown({ texto }: { texto: string }) {
  const blocos: ReactNode[] = []
  let paragrafo: string[] = []
  let lista: { ordenada: boolean; itens: string[] } | null = null
  const fechar = () => {
    if (paragrafo.length) {
      blocos.push(<p key={blocos.length}>{paragrafo.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{negrito(l)}</Fragment>)}</p>)
      paragrafo = []
    }
    if (lista) {
      const Tag = lista.ordenada ? 'ol' : 'ul'
      blocos.push(
        <Tag key={blocos.length} className={`${lista.ordenada ? 'list-decimal' : 'list-disc'} space-y-1 pl-5`}>
          {lista.itens.map((it, i) => <li key={i}>{negrito(it)}</li>)}
        </Tag>
      )
      lista = null
    }
  }
  for (const bruta of texto.split('\n')) {
    const linha = bruta.trim()
    const titulo = /^#{1,6}\s+(.+)$/.exec(linha)
    const item = /^[-*]\s+(.+)$/.exec(linha) ?? /^\d+[.)]\s+(.+)$/.exec(linha)
    if (!linha) fechar()
    else if (titulo) {
      fechar()
      blocos.push(<h4 key={blocos.length} className="font-semibold">{negrito(titulo[1])}</h4>)
    } else if (item) {
      const ordenada = /^\d/.test(linha)
      if (paragrafo.length || (lista && lista.ordenada !== ordenada)) fechar()
      lista ??= { ordenada, itens: [] }
      lista.itens.push(item[1])
    } else {
      if (lista) fechar()
      paragrafo.push(linha)
    }
  }
  fechar()
  return <div className="space-y-2">{blocos}</div>
}

function baixarConversa(mensagens: Mensagem[]) {
  const agora = new Date()
  const url = URL.createObjectURL(new Blob([conversaParaMarkdown(mensagens, agora)], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivoConversa(agora)
  a.click()
  // revogar na hora pode cancelar o download em alguns navegadores
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const creditos = (n: number) => (n === 1 ? '1 crédito' : `${n} créditos`)

/**
 * Aba Evo: saldo, atalhos, conversa e o formulário de planejamento. Mensagens, texto digitado e
 * "pensando" vêm do EvoHub: fechar e reabrir o painel não perde o texto nem permite envio duplo.
 */
export default function EvoChat({ mensagens, setMensagens, texto, setTexto, pensando, setPensando, formPlanejar, setFormPlanejar, onResposta }: {
  mensagens: Mensagem[]
  setMensagens: React.Dispatch<React.SetStateAction<Mensagem[]>>
  texto: string
  setTexto: (t: string) => void
  pensando: boolean
  setPensando: (p: boolean) => void
  /** Campos do "Planejar"; null = formulário fechado */
  formPlanejar: CamposPlanejar | null
  setFormPlanejar: (f: CamposPlanejar | null) => void
  /** Avisa o EvoHub que a resposta (ou recusa, aviso = true) chegou; ele decide se mostra o selo */
  onResposta?: (aviso: boolean) => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const planejando = formPlanejar !== null
  const fimRef = useRef<HTMLDivElement>(null)
  const chaveSaldo = ['ai-balance', user?.id]

  const { data: saldo, error: erroSaldo } = useQuery({
    queryKey: chaveSaldo,
    enabled: !!user?.id,
    // sem isto, com a função fora do ar, o cabeçalho fica vários segundos em "Carregando…"
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ai_balance' as never)
      if (error) throw error
      return data as unknown as Saldo
    },
  })
  const desligado = saldo?.habilitado === false
  const bloqueado = pensando || desligado

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' })
  }, [mensagens.length, pensando])

  const pedir = async (body: object, idPergunta: string) => {
    setPensando(true)
    let r: Resposta
    try {
      r = await chamarEvo(body)
    } catch {
      r = { ok: false, motivo: 'rede' }
    }
    if (r.ok) {
      const { reply_md, proposal, usage_id, restante } = r
      setMensagens((m) => [...m, { id: crypto.randomUUID(), role: 'model', text: reply_md, proposal, usageId: usage_id }])
      queryClient.setQueryData<Saldo>(chaveSaldo, (s) => s && { ...s, restante })
    } else {
      const aviso = r.motivo === 'sem_credito' && typeof r.custo === 'number' && typeof r.restante === 'number'
        ? `Este pedido custa ${creditos(r.custo)} e você tem ${r.restante}.`
        : r.motivo === 'sem_credito' && saldo?.periodo === 'total'
          ? 'Seus créditos de amostra do Evo acabaram.'
          : RECUSAS[r.motivo] ?? r.message ?? RECUSAS.erro_ia
      setMensagens((m) => [
        ...m.map((x) => (x.id === idPergunta ? { ...x, aviso: true } : x)),
        { id: crypto.randomUUID(), role: 'model', text: aviso, aviso: true },
      ])
    }
    setPensando(false)
    onResposta?.(!r.ok)
  }

  const enviar = (bruto: string) => {
    const message = bruto.trim().slice(0, MAX)
    if (!message || bloqueado) return
    const history = mensagens.filter((m) => !m.aviso).slice(-10).map(({ role, text }) => ({ role, text }))
    const id = crypto.randomUUID()
    setMensagens((m) => [...m, { id, role: 'user', text: message }])
    setTexto('')
    pedir({ mode: 'chat', message, history }, id)
  }

  const planejar = (form: PlanejarForm) => {
    const genero = GENEROS.find((g) => g.valor === form.genero)?.rotulo ?? form.genero
    const data = form.data ? `, em ${form.data.split('-').reverse().join('/')}` : ''
    const id = crypto.randomUUID()
    setMensagens((m) => [...m, { id, role: 'user', text: `Planejar evento: ${genero}, ${form.publico} pessoas em ${form.cidade}/${form.uf}${data}.` }])
    voltarAoChat()
    pedir({ mode: 'planejar', form }, id)
  }

  // O formulário some da tela: o foco volta para o campo do chat em vez de cair no body
  const voltarAoChat = () => {
    setFormPlanejar(null)
    requestAnimationFrame(() => document.getElementById('evo-mensagem')?.focus())
  }

  const mudarProposta = (idMsg: string) => (mudanca: MudancaProposta) =>
    setMensagens((m) => m.map((x) => (x.id === idMsg ? { ...x, ...mudanca } : x)))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-5 pb-3">
        <img src="/evo/evo-corpo-acenando.webp" alt="" width={50} height={90} className="h-[90px] w-auto shrink-0 motion-safe:animate-[evo-flutuar_3s_ease-in-out_infinite]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">Oi, eu sou o Evo 👋 o assistente de IA da Evokaa</p>
          <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
            {erroSaldo ? (funcaoInexistente(erroSaldo) ? RECUSAS.indisponivel : 'Não consegui ver seus créditos agora.')
              : !saldo ? 'Carregando seus créditos…'
              : desligado ? RECUSAS.desligado
              : saldo.periodo === 'total' ? `${creditos(saldo.restante)} de amostra`
              : `${creditos(saldo.restante)} ${saldo.restante === 1 ? 'restante' : 'restantes'} este mês`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => baixarConversa(mensagens)}
          disabled={mensagens.length === 0}
          aria-label="Baixar conversa (.md)"
          title="Baixar conversa (.md)"
          className="shrink-0 rounded-lg p-2 text-slate-700 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:focus-visible:ring-violet-300"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-900/10 px-5 py-4 dark:border-white/10">
        {planejando ? (
          <FormPlanejar f={formPlanejar} setF={setFormPlanejar} onEnviar={planejar} onCancelar={voltarAoChat} desabilitado={bloqueado} />
        ) : (
          <div role="log" aria-live="polite" aria-label="Conversa com o Evo" className="space-y-4">
            {mensagens.length === 0 && (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Pergunte sobre o seu evento ou escolha um atalho abaixo. Eu sugiro; quem decide e confirma é você.
              </p>
            )}
            {mensagens.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  {/* text-[#fff] e não text-white: o index.css escurece .text-white no modo claro */}
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-plum px-3.5 py-2 text-sm text-[#fff]">
                    <span className="sr-only">Você: </span>{m.text}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2">
                  <img src="/evo/evo-cabeca.webp" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
                  <div className="min-w-0 max-w-[88%] flex-1">
                    <div className={`break-words rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm leading-relaxed ${m.aviso ? 'border border-amber-600/40 bg-amber-50/90 text-amber-900 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-50' : 'border border-slate-900/10 bg-white/80 text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100'}`}>
                      {m.aviso ? m.text : <EvoMarkdown texto={m.text} />}
                    </div>
                    {m.proposal && (
                      <PropostaCard proposta={m.proposal} usageId={m.usageId} edicao={m.edicao} criando={m.criando} criadoId={m.criadoId} semLotes={m.semLotes} onMudar={mudarProposta(m.id)} />
                    )}
                  </div>
                </div>
              )
            )}
            {pensando && (
              <div role="status" className="flex items-center gap-3">
                <img src="/evo/evo-corpo-dj.webp" alt="" width={48} height={64} className="h-16 w-auto motion-safe:animate-pulse" />
                <span className="text-sm text-slate-700 dark:text-slate-200">O Evo está pensando…</span>
              </div>
            )}
            <div ref={fimRef} />
          </div>
        )}
      </div>

      {!planejando && (
        <div className="border-t border-slate-900/10 px-5 pb-4 pt-3 dark:border-white/10">
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Atalhos">
            <button type="button" onClick={() => setFormPlanejar(FORM_PLANEJAR_VAZIO)} disabled={bloqueado} className="rounded-full border border-violet-600/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-500/20 dark:border-violet-300/40 dark:bg-violet-400/15 dark:text-violet-100 dark:hover:bg-violet-400/25 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:focus-visible:ring-violet-300">
              Planejar meu primeiro evento
            </button>
            {ATALHOS.map((a) => (
              <button key={a.rotulo} type="button" onClick={() => enviar(a.pergunta)} disabled={bloqueado} className="rounded-full border border-slate-900/20 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-900/5 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:focus-visible:ring-violet-300">
                {a.rotulo}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); enviar(texto) }}>
            <label htmlFor="evo-mensagem" className="sr-only">Mensagem para o Evo</label>
            <p id="evo-aviso" className="mb-2 text-[11px] leading-snug text-slate-700 dark:text-slate-300">
              Não cole dados de compradores (CPF, e-mail, telefone). As conversas são processadas pelo Google Gemini.
            </p>
            <textarea
              id="evo-mensagem"
              rows={2}
              maxLength={MAX}
              value={texto}
              disabled={desligado}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  enviar(texto)
                }
              }}
              placeholder={desligado ? 'O Evo ainda não está disponível.' : 'Pergunte ao Evo…'}
              aria-describedby="evo-aviso evo-dica"
              className="w-full resize-none rounded-xl border border-slate-900/20 bg-white/80 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-violet-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/40 dark:border-white/20 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-violet-300 dark:focus-visible:ring-violet-300/60 disabled:opacity-60"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span id="evo-dica" className="text-[11px] text-slate-700 dark:text-slate-300">
                {texto.length}/{MAX} · Enter envia, Shift+Enter quebra linha
              </span>
              <button
                type="submit"
                disabled={bloqueado || !texto.trim()}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] px-4 py-1.5 text-sm font-semibold text-[#fff] shadow-[0_4px_20px_rgba(59,130,246,0.3)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-violet-300 dark:focus-visible:ring-offset-[#12142d]"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" /> Enviar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
