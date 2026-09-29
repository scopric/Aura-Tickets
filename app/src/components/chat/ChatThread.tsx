import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCheck, Download, FileText, Loader2, Lock, Paperclip, Send, WifiOff, X } from 'lucide-react'
import {
  MAX_TEXTO, TIPOS_ANEXO, depois, enviarAnexo, enviarMensagem, iniciais, mensagemDeErro, problemaNoArquivo,
  useMensagens, useUrlAnexo, type MensagemChat, type PapelMensagem,
} from '../../hooks/useConversas'

// Selo de quem escreveu: SEMPRE pelo sender_role gravado pelo servidor, nunca pelo nome (o nome
// é livre: um cliente pode se chamar "Equipe Evokaa").
const SELO: Record<PapelMensagem, string> = { customer: 'Cliente', agent: 'Equipe', producer: 'Produtor', bot: 'Assistente', system: 'Sistema' }

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:focus-visible:ring-violet-300'

function assinarConexao(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

function tamanho(bytes: number | null) {
  if (!bytes) return ''
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Anexo por URL assinada (10 min): imagem com prévia, PDF como cartão para baixar. Nunca renderiza o conteúdo. */
function Anexo({ m, minha }: { m: MensagemChat; minha: boolean }) {
  const nome = m.attachment_name || 'arquivo'
  const imagem = m.attachment_mime?.startsWith('image/')
  const { data: url, isError } = useUrlAnexo(m.attachment_path, imagem ? undefined : nome)
  if (isError) return <p className="text-xs opacity-80">Não foi possível abrir o anexo.</p>
  if (imagem) {
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className={`block overflow-hidden rounded-xl ${foco}`} aria-label={`Abrir imagem ${nome} em nova aba`}>
        <img src={url} alt={`Imagem anexada: ${nome}`} className="max-h-56 w-auto max-w-full object-cover" loading="lazy" />
      </a>
    ) : (
      <div className="h-32 w-44 animate-pulse rounded-xl bg-slate-900/10 dark:bg-white/10" aria-label="Carregando imagem" />
    )
  }
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${minha ? 'border-white/30 bg-white/10' : 'border-slate-900/10 bg-white/70 dark:border-white/10 dark:bg-white/[0.05]'}`}>
      <FileText className="h-8 w-8 shrink-0 opacity-80" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{nome}</p>
        <p className="text-xs opacity-80">PDF{m.attachment_size ? ` · ${tamanho(m.attachment_size)}` : ''}</p>
      </div>
      {url ? (
        <a href={url} download={nome} rel="noopener noreferrer" aria-label={`Baixar ${nome}`} className={`rounded-lg p-1.5 hover:bg-slate-900/10 dark:hover:bg-white/10 ${foco}`}>
          <Download className="h-4 w-4" aria-hidden="true" />
        </a>
      ) : (
        <Loader2 className="h-4 w-4 animate-spin" aria-label="Preparando download" />
      )}
    </div>
  )
}

/**
 * Conversa (bolhas) + campo de envio. Serve ao widget do cliente (souEquipe = false) e à caixa de
 * entrada do admin (souEquipe = true, com a alternância Responder / Nota interna).
 */
export default function ChatThread({
  conversaId, souEquipe, podeNota = false, podeAnexar, lidoAte, aoEnviar, rotuloCampo = 'Mensagem',
}: {
  conversaId: string
  souEquipe: boolean
  podeNota?: boolean
  /** O bucket só aceita arquivo em conversa aberta */
  podeAnexar: boolean
  /** Última leitura do outro lado, para o "Visto" */
  lidoAte?: string | null
  aoEnviar?: () => void
  rotuloCampo?: string
}) {
  const qc = useQueryClient()
  const { data: todas, isLoading, isError, refetch } = useMensagens(conversaId, !souEquipe)
  // cliente nunca vê nota interna, nem se a RLS e o filtro da consulta falharem
  const mensagens = souEquipe ? todas : todas?.filter((m) => !m.is_internal)
  const [texto, setTexto] = useState('')
  const [nota, setNota] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  // arquivo já no bucket de uma tentativa que falhou depois: não sobe de novo
  const [anexo, setAnexo] = useState<{ path: string; nome: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const online = useSyncExternalStore(assinarConexao, () => navigator.onLine)
  const fimRef = useRef<HTMLDivElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const idCampo = `chat-campo-${conversaId}`

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' })
  }, [mensagens?.length])

  const minha = (m: MensagemChat) => (souEquipe ? m.sender_role === 'agent' || m.sender_role === 'producer' : m.sender_role === 'customer')
  const ultimaMinha = [...(mensagens ?? [])].reverse().find((m) => minha(m) && !m.is_internal)

  const escolher = (f: File | undefined) => {
    if (arquivoRef.current) arquivoRef.current.value = ''
    if (!f) return
    const problema = problemaNoArquivo(f)
    setErro(problema)
    if (!problema) {
      setArquivo(f)
      setAnexo(null)
    }
  }

  const enviar = async () => {
    const t = texto.trim()
    const comAnexo = !nota && !!arquivo
    if (enviando || (!t && !comAnexo)) return
    setEnviando(true)
    setErro(null)
    try {
      let a = comAnexo ? anexo : null
      if (comAnexo && !a) {
        a = await enviarAnexo(conversaId, arquivo!)
        setAnexo(a)
      }
      await enviarMensagem(conversaId, t, { nota, anexo: a ?? undefined })
      // o que foi digitado durante o envio fica no campo
      setTexto((x) => (x.trim() === t ? '' : x))
      setArquivo(null)
      setAnexo(null)
      qc.invalidateQueries({ queryKey: ['chat-mensagens', conversaId] })
      aoEnviar?.()
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3" aria-label="Carregando mensagens">
            {[60, 40, 70].map((w, i) => (
              <div key={i} className={`h-10 animate-pulse rounded-2xl bg-slate-900/10 dark:bg-white/10 ${i === 1 ? 'ml-auto' : ''}`} style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-700 dark:text-slate-300">
            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
            Não foi possível carregar as mensagens.
            <button type="button" onClick={() => refetch()} className={`rounded-full border border-slate-900/20 px-3 py-1 text-xs font-medium hover:bg-slate-900/5 dark:border-white/20 dark:hover:bg-white/10 ${foco}`}>
              Tentar de novo
            </button>
          </div>
        ) : !mensagens?.length ? (
          <p className="py-8 text-center text-sm text-slate-700 dark:text-slate-300">Nenhuma mensagem ainda.</p>
        ) : (
          <ol role="log" aria-live="polite" aria-label="Mensagens da conversa" className="space-y-1">
            {mensagens.map((m, i) => {
              const anterior = mensagens[i - 1]
              const novoBloco = !anterior || anterior.sender_id !== m.sender_id || anterior.sender_role !== m.sender_role || anterior.is_internal !== m.is_internal
              const eu = minha(m)
              if (m.is_internal) {
                return (
                  <li key={m.id} className={novoBloco ? 'pt-3' : ''}>
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-50">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Nota interna · {m.sender_name}
                        <span className="rounded-full bg-amber-600/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide">{SELO[m.sender_role]}</span>
                      </p>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className="mt-1 text-right text-[11px] opacity-80">{hora(m.created_at)}</p>
                    </div>
                  </li>
                )
              }
              const cabecalho = novoBloco && (souEquipe || !eu)
              return (
                <li key={m.id} className={`flex gap-2 ${eu ? 'flex-row-reverse' : ''} ${novoBloco ? 'pt-3' : ''}`}>
                  <div className="w-8 shrink-0" aria-hidden="true">
                    {cabecalho && (
                      <span className={`grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold ${m.sender_role === 'agent' ? 'bg-gradient-to-br from-[#1d68c4] to-[#8f33f5] text-[#fff]' : 'bg-slate-900/10 text-slate-800 dark:bg-white/10 dark:text-slate-100'}`}>
                        {iniciais(m.sender_name)}
                      </span>
                    )}
                  </div>
                  <div className={`flex min-w-0 max-w-[80%] flex-col ${eu ? 'items-end' : 'items-start'}`}>
                    {cabecalho ? (
                      <p className="mb-1 flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-900 dark:text-white">{m.sender_name}</span>
                        <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${m.sender_role === 'agent' ? 'bg-violet-600/15 text-violet-900 dark:bg-violet-400/20 dark:text-violet-100' : 'bg-slate-900/10 text-slate-800 dark:bg-white/10 dark:text-slate-200'}`}>
                          {SELO[m.sender_role]}
                        </span>
                      </p>
                    ) : (
                      <span className="sr-only">{eu && !souEquipe ? 'Você' : `${m.sender_name} (${SELO[m.sender_role]})`}: </span>
                    )}
                    <div className={`space-y-2 break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${eu
                      ? 'rounded-tr-sm bg-gradient-to-br from-[#1d68c4] to-[#8f33f5] text-[#fff]'
                      : 'rounded-tl-sm border border-slate-900/10 bg-white/80 text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100'}`}
                    >
                      {m.attachment_path && <Anexo m={m} minha={eu} />}
                      {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-slate-700 dark:text-slate-300">
                      {hora(m.created_at)}
                      {m.id === ultimaMinha?.id && lidoAte && !depois(m.created_at, lidoAte) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <CheckCheck className="h-3.5 w-3.5 text-violet-700 dark:text-violet-300" aria-hidden="true" /> Visto
                        </>
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        <div ref={fimRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          enviar()
        }}
        className="border-t border-slate-900/10 px-4 pb-4 pt-3 dark:border-white/10"
      >
        {podeNota && (
          <div className="mb-2 flex gap-1" role="group" aria-label="Tipo de mensagem">
            {[false, true].map((n) => (
              <button
                key={String(n)}
                type="button"
                aria-pressed={nota === n}
                disabled={n && !!arquivo}
                title={n && arquivo ? 'Nota interna não leva anexo' : undefined}
                onClick={() => setNota(n)}
                className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 ${foco} ${nota === n
                  ? n ? 'bg-amber-400/30 text-amber-950 dark:bg-amber-400/20 dark:text-amber-50' : 'bg-violet-600/15 text-violet-900 dark:bg-violet-400/20 dark:text-violet-100'
                  : 'text-slate-700 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10'}`}
              >
                {n ? 'Nota interna' : 'Responder'}
              </button>
            ))}
          </div>
        )}
        {!online && (
          <p role="status" className="mb-2 flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-200">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" /> Sem conexão. O texto fica aqui até a internet voltar.
          </p>
        )}
        {erro && (
          <div role="alert" className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-red-600/30 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
            <span>{erro}</span>
            {(texto.trim() || arquivo) && (
              <button type="button" onClick={enviar} disabled={enviando} className={`shrink-0 rounded-full border border-current px-2.5 py-0.5 font-semibold ${foco}`}>
                Tentar de novo
              </button>
            )}
          </div>
        )}
        {arquivo && !nota && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-slate-900/10 bg-white/70 px-3 py-1.5 text-xs text-slate-800 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100">
            <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{arquivo.name} · {tamanho(arquivo.size)}</span>
            <button type="button" onClick={() => { setArquivo(null); setAnexo(null) }} aria-label={`Remover anexo ${arquivo.name}`} className={`rounded p-0.5 hover:bg-slate-900/10 dark:hover:bg-white/10 ${foco}`}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className={`flex items-end gap-1.5 rounded-2xl border px-2 py-1.5 focus-within:ring-2 ${nota
          ? 'border-amber-500/50 bg-amber-50/90 focus-within:ring-amber-500/40 dark:border-amber-300/30 dark:bg-amber-400/10'
          : 'border-slate-900/20 bg-white/80 focus-within:ring-violet-600/40 dark:border-white/20 dark:bg-white/[0.07] dark:focus-within:ring-violet-300/60'}`}
        >
          {podeAnexar && !nota && (
            <>
              <input ref={arquivoRef} type="file" accept={TIPOS_ANEXO.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => escolher(e.target.files?.[0])} />
              <button type="button" onClick={() => arquivoRef.current?.click()} disabled={enviando} aria-label="Anexar imagem ou PDF (até 10 MB)" title="Anexar imagem ou PDF (até 10 MB)" className={`shrink-0 rounded-lg p-2 text-slate-700 hover:bg-slate-900/5 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10 ${foco}`}>
                <Paperclip className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}
          <label htmlFor={idCampo} className="sr-only">{nota ? 'Nota interna (só a equipe vê)' : rotuloCampo}</label>
          <textarea
            id={idCampo}
            rows={1}
            maxLength={MAX_TEXTO}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                enviar()
              }
            }}
            placeholder={nota ? 'Nota interna: só a equipe vê' : 'Escreva sua mensagem…'}
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-1.5 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-white dark:placeholder:text-slate-400 [field-sizing:content]"
          />
          <button
            type="submit"
            disabled={enviando || (!texto.trim() && !(arquivo && !nota))}
            aria-label={nota ? 'Salvar nota interna' : 'Enviar mensagem'}
            className={`shrink-0 rounded-xl p-2 text-[#fff] shadow-sm disabled:opacity-40 ${foco} ${nota ? 'bg-amber-600' : 'bg-gradient-to-br from-[#1d68c4] to-[#8f33f5]'}`}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </form>
    </div>
  )
}
