import { useEffect, useRef, useState } from 'react'
import { Loader2, Camera, Flag, UserX, ShieldAlert, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminEvents } from '../../hooks/useEvents'
import { useTwoFactor } from '../../hooks/useTwoFactor'
import {
  useFotosParaRevisar, useFotoDecidir, useMesaDenuncias, useDenunciaStatus, useDenunciaLiberar,
  useMesaTravas, useMesaDestravar, erroMesaAdmin, precisa2fa,
  STATUS_DENUNCIA, MOTIVO_REMOCAO, DECISAO_IA, MOTIVO_IA, RESULTADO_DENUNCIA, EXPLICACAO_MIN, EXPLICACAO_MAX, explicacaoValida,
  type StatusDenuncia, type ResultadoDenuncia,
} from '../../hooks/useMesaAdmin'
import { MOTIVO_DENUNCIA } from '../../hooks/useMatchmaking'

// Moderação do Match de Mesa (permissão moderate_mesa; o banco exige também a sessão com 2FA).
type Aba = 'fotos' | 'denuncias' | 'remocoes'

const dataBr = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const cartao = 'p-4 rounded-xl bg-white/40 border border-white/60'
// só a foto que o app grava vira <img> e pode ser aprovada; outra coisa só pode ser recusada
const jpeg = (foto: string) => foto.startsWith('data:image/jpeg;base64,')
const botao = 'px-3 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-50'

type Mfa = ReturnType<typeof useTwoFactor>

// Sessão sem 2FA: o banco recusa toda a moderação (42501 "Ative o 2FA para moderar")
function Erro({ err, mfa, onRetry }: { err: unknown; mfa: Mfa; onRetry: () => void }) {
  return (
    <div role="alert" className="mb-4 p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300">
      {precisa2fa(err) ? (
        <>
          Ative o 2FA para moderar.{' '}
          {mfa.enabled ? (
            // depois de ativar pelo modal a sessão já é aal2: basta pedir a lista de novo
            <>
              <button onClick={onRetry} className="underline font-medium">Tentar de novo</button>
              {' '}(se continuar, saia e entre de novo digitando o código).
            </>
          ) : (
            <button onClick={mfa.toggle} disabled={mfa.loading} className="underline font-medium">Ativar o 2FA agora</button>
          )}
        </>
      ) : erroMesaAdmin(err)}
    </div>
  )
}

export default function AdminMatchDeMesa() {
  const [aba, setAba] = useState<Aba>('fotos')
  const [eventId, setEventId] = useState('')
  const mfa = useTwoFactor()
  const { data: eventos = [] } = useAdminEvents()
  const comMesa = eventos.filter(e => e.ticket_types?.some(t => t.type === 'coletiva'))

  const abas: { id: Aba; label: string; icon: typeof Camera }[] = [
    { id: 'fotos', label: 'Fotos', icon: Camera },
    { id: 'denuncias', label: 'Denúncias', icon: Flag },
    { id: 'remocoes', label: 'Remoções', icon: UserX },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Match de Mesa</h1>
        <p className="text-sm text-espresso/70 mt-1">Fotos de perfil, denúncias e remoções. Exige 2FA.</p>
      </div>

      <nav className="flex gap-1 mb-6 overflow-x-auto" role="tablist">
        {abas.map(a => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all whitespace-nowrap ${aba === a.id ? 'bg-rose-500/10 text-rose-500 font-medium' : 'text-espresso/70 hover:text-espresso hover:bg-white/40'}`}>
            <a.icon className="w-4 h-4" />{a.label}
          </button>
        ))}
      </nav>

      {aba !== 'fotos' && (
        // ponytail: denúncia só por evento escolhido; falta no SQL uma fila geral das abertas (todos os
        // eventos) para o moderador não precisar procurar evento a evento. Pendência.
        <label className="block mb-6 max-w-md">
          <span className="text-xs font-medium text-espresso/70 mb-1.5 block">Evento</span>
          <select value={eventId} onChange={e => setEventId(e.target.value)}
            className="w-full px-3 py-2 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none">
            <option value="">Escolha um evento com Match de Mesa</option>
            {comMesa.map(e => <option key={e.id} value={e.id}>{e.title}{e.date ? ` · ${new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</option>)}
          </select>
        </label>
      )}

      {aba === 'fotos' && <Fotos mfa={mfa} />}
      {aba === 'denuncias' && (eventId ? <Denuncias eventId={eventId} mfa={mfa} /> : null)}
      {aba === 'remocoes' && (eventId ? <Remocoes eventId={eventId} mfa={mfa} /> : null)}

      {mfa.modal}
    </div>
  )
}


function Fotos({ mfa }: { mfa: Mfa }) {
  const fila = useFotosParaRevisar()
  const decidir = useFotoDecidir()
  const [aviso, setAviso] = useState('')

  const decide = (user: string, hash: string, aprovada: boolean) => {
    setAviso('')
    decidir.mutate({ user, hash, aprovada }, {
      onSuccess: ok => ok ? toast.success(aprovada ? 'Foto aprovada.' : 'Foto recusada.') : setAviso('A pessoa trocou a foto; atualize a lista.'),
      onError: e => toast.error(erroMesaAdmin(e)),
    })
  }

  if (fila.isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-plum animate-spin" /></div>
  if (fila.isError) return <Erro err={fila.error} mfa={mfa} onRetry={() => fila.refetch()} />
  const itens = fila.data ?? []

  return (
    <div className="space-y-3">
      {aviso && (
        <div role="alert" className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-700 flex items-center justify-between gap-3">
          {aviso}
          <button onClick={() => { setAviso(''); fila.refetch() }} className="flex items-center gap-1 underline"><RefreshCw className="w-3 h-3" /> Atualizar lista</button>
        </div>
      )}
      {itens.length === 0 && <p className="py-12 text-center text-xs text-espresso/70 italic">Nenhuma foto esperando revisão.</p>}
      {itens.map(f => (
        <div key={f.id} className={`${cartao} flex items-center gap-4`}>
          {/* só a foto que o app grava (base64 JPEG); qualquer outra coisa não vira <img> */}
          {jpeg(f.foto)
            ? <img src={f.foto} alt={`Foto de ${f.nome ?? 'perfil'}`} className="w-20 h-20 rounded-xl object-cover" />
            : <div className="w-20 h-20 rounded-xl bg-espresso/5 flex items-center justify-center text-[10px] text-espresso/70 text-center">formato não aceito</div>}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-espresso truncate">{f.nome || 'Sem nome'}</div>
            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium rounded-full border border-amber-100 bg-amber-50 text-amber-600">
              {f.situacao === 'revisar' ? (f.contestada ? 'Revisar' : 'Revisar (dúvida da IA)') : 'Pendente'}
            </span>
            {f.contestada && (
              <span className="inline-block mt-1 ml-1 px-2 py-0.5 text-[10px] font-medium rounded-full border border-plum/20 bg-plum/10 text-plum">
                Contestada pela pessoa
              </span>
            )}
            {f.ia && (
              <div className="mt-1 text-xs text-espresso/70">
                {DECISAO_IA[f.ia.decisao] ?? f.ia.decisao}
                {f.ia.motivos.length > 0 && `: ${f.ia.motivos.map(m => MOTIVO_IA[m] ?? m).join(', ')}`}
                {' · '}{dataBr(f.ia.em)}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => decide(f.id, f.hash, true)} disabled={decidir.isPending || !jpeg(f.foto)} className={`${botao} bg-plum text-cream hover:shadow-glow`}>Aprovar</button>
            <button onClick={() => decide(f.id, f.hash, false)} disabled={decidir.isPending} className={`${botao} border border-red-200 text-red-500 hover:bg-red-50`}>Recusar</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function Denuncias({ eventId, mfa }: { eventId: string; mfa: Mfa }) {
  const lista = useMesaDenuncias('moderador', eventId)
  const mudarStatus = useDenunciaStatus()
  const liberar = useDenunciaLiberar()
  const [confirmar, setConfirmar] = useState<string | null>(null)
  // "Resolvida" só vai ao banco com o resultado e a explicação
  const [resolvendo, setResolvendo] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoDenuncia | ''>('')
  const [explicacao, setExplicacao] = useState('')
  const explicacaoOk = explicacaoValida(explicacao)
  const primeiraOpcao = useRef<HTMLInputElement>(null)
  // ao abrir o formulário, o foco vai para a primeira opção
  useEffect(() => { if (resolvendo) primeiraOpcao.current?.focus() }, [resolvendo])
  const falta = !resultado ? 'Falta escolher o resultado.' : !explicacaoOk ? `Falta a explicação (de ${EXPLICACAO_MIN} a ${EXPLICACAO_MAX} caracteres, com letra ou número).` : ''

  if (lista.isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-plum animate-spin" /></div>
  if (lista.isError) return <Erro err={lista.error} mfa={mfa} onRetry={() => lista.refetch()} />
  const itens = lista.data ?? []

  return (
    <div className="space-y-3">
      {itens.length === 0 && <p className="py-12 text-center text-xs text-espresso/70 italic">Nenhuma denúncia neste evento.</p>}
      {itens.map(d => (
        <div key={d.id} className={cartao}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="text-xs text-espresso space-y-0.5">
              <div><span className="font-bold">{d.denunciado || 'Conta excluída'}</span> · {MOTIVO_DENUNCIA[d.motivo] ?? d.motivo}{d.mesa ? ` · ${d.mesa}` : ''}</div>
              <div className="text-espresso/70">Denunciado por {d.denunciante || 'conta excluída'} em {dataBr(d.criado_em)}</div>
              <div className="text-espresso/70">
                {d.mesma_mesa && d.sobreposicao_inicio && d.sobreposicao_fim
                  ? `Estiveram na mesma mesa de ${dataBr(d.sobreposicao_inicio)} a ${dataBr(d.sobreposicao_fim)}`
                  : 'Não estiveram na mesma mesa ao mesmo tempo'}
              </div>
            </div>
            <select aria-label={`Status da denúncia contra ${d.denunciado ?? 'conta excluída'}`} value={d.status} disabled={mudarStatus.isPending}
              onChange={e => {
                const status = e.target.value as StatusDenuncia
                if (status === 'resolvida') { setResolvendo(d.id); setResultado(''); setExplicacao(''); return }
                setResolvendo(null)
                const eraImprocedente = d.status === 'resolvida' && d.resultado === 'improcedente'
                mudarStatus.mutate({ id: d.id, status }, {
                  onSuccess: () => {
                    toast.success('Status atualizado.')
                    // o banco já desfez a remoção quando ela virou improcedente; reabrir não a restaura
                    if (eraImprocedente) toast.warning('A remoção desfeita não volta sozinha; se for o caso, remova de novo pelo painel.', { duration: 15000 })
                  },
                  onError: err => toast.error(erroMesaAdmin(err)),
                })
              }}
              className="px-3 py-1.5 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso focus:outline-none">
              {(Object.keys(STATUS_DENUNCIA) as StatusDenuncia[]).map(s => <option key={s} value={s}>{STATUS_DENUNCIA[s]}</option>)}
            </select>
          </div>
          {resolvendo === d.id && d.status !== 'resolvida' && (
            <div className="mt-3 p-3 rounded-xl bg-white/60 border border-plum/20 space-y-2">
              <fieldset className="space-y-1">
                <legend className="text-[11px] text-espresso/70">Resultado (obrigatório)</legend>
                {(Object.keys(RESULTADO_DENUNCIA) as ResultadoDenuncia[]).map((r, i) => (
                  <label key={r} className="flex items-center gap-2 text-xs text-espresso">
                    <input ref={i === 0 ? primeiraOpcao : undefined} type="radio" name={`resultado-${d.id}`} checked={resultado === r} onChange={() => setResultado(r)} /> {RESULTADO_DENUNCIA[r]}
                  </label>
                ))}
              </fieldset>
              <label className="block">
                <span className="text-[11px] text-espresso/70">Explique por que está resolvida (obrigatório, de {EXPLICACAO_MIN} a {EXPLICACAO_MAX} caracteres)</span>
                <textarea value={explicacao} onChange={e => setExplicacao(e.target.value)} maxLength={EXPLICACAO_MAX} rows={3}
                  className="mt-1 w-full px-3 py-1.5 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso focus:outline-none" />
              </label>
              <p id={`resolver-falta-${d.id}`} aria-live="polite" className="text-[11px] text-amber-700">{falta}</p>
              <div className="flex gap-2">
                <button disabled={!resultado || !explicacaoOk || mudarStatus.isPending} aria-describedby={`resolver-falta-${d.id}`} className={`${botao} bg-plum text-cream`}
                  onClick={() => resultado && mudarStatus.mutate({ id: d.id, status: 'resolvida', resultado, explicacao }, {
                    onSuccess: () => { setResolvendo(null); toast.success('Status atualizado.') },
                    onError: err => toast.error(erroMesaAdmin(err)),
                  })}>Confirmar resolução</button>
                <button onClick={() => setResolvendo(null)} className={`${botao} border border-espresso/15 text-espresso`}>Cancelar</button>
              </div>
            </div>
          )}
          {d.status === 'resolvida' && d.resultado && (
            <p className="mt-2 text-xs text-espresso whitespace-pre-line break-words">
              <span className="font-bold">{d.resultado === 'procedente' ? 'Procedente' : 'Improcedente'}</span>
              {d.resultado_explicacao ? ` · ${d.resultado_explicacao}` : ''}
            </p>
          )}
          {/* texto livre de quem denunciou: sempre texto puro */}
          {d.detalhe && <p className="mt-2 text-xs text-espresso/70 leading-relaxed whitespace-pre-line break-words">{d.detalhe}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {d.liberada_produtor_em ? (
              <span className="text-[11px] text-green-600">Liberada para a organização em {dataBr(d.liberada_produtor_em)}</span>
            ) : confirmar === d.id ? (
              <>
                <span className="text-[11px] text-espresso/70">A organização verá o denunciado, o motivo e a mesa. Não dá para desfazer.</span>
                <button disabled={liberar.isPending} className={`${botao} bg-plum text-cream`}
                  onClick={() => liberar.mutate(d.id, {
                    onSuccess: () => { setConfirmar(null); toast.success('Denúncia liberada para a organização.') },
                    onError: err => toast.error(erroMesaAdmin(err)),
                  })}>Confirmar liberação</button>
                <button onClick={() => setConfirmar(null)} className={`${botao} border border-espresso/15 text-espresso`}>Cancelar</button>
              </>
            ) : (
              <button onClick={() => setConfirmar(d.id)} className={`${botao} border border-plum/30 text-plum hover:bg-plum/5`}>Liberar para a organização</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function Remocoes({ eventId, mfa }: { eventId: string; mfa: Mfa }) {
  const lista = useMesaTravas(eventId)
  const destravar = useMesaDestravar(eventId)
  const [confirmar, setConfirmar] = useState<string | null>(null)

  if (lista.isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-plum animate-spin" /></div>
  if (lista.isError) return <Erro err={lista.error} mfa={mfa} onRetry={() => lista.refetch()} />
  const itens = lista.data ?? []

  return (
    <div className="space-y-3">
      {itens.length === 0 && <p className="py-12 text-center text-xs text-espresso/70 italic">Ninguém foi removido de mesa neste evento.</p>}
      {itens.map(t => (
        <div key={t.id} className={cartao}>
          <div className="text-xs text-espresso space-y-0.5">
            <div><span className="font-bold">{t.pessoa || 'Conta excluída'}</span> · {MOTIVO_REMOCAO[t.motivo] ?? t.motivo}</div>
            <div className="text-espresso/70">Removida por {t.por || 'conta excluída'} em {dataBr(t.em)}</div>
          </div>
          {t.detalhe && <p className="mt-2 text-xs text-espresso/70 whitespace-pre-line break-words">{t.detalhe}</p>}
          {t.denuncia_resultado && (
            <div className="mt-1 text-xs text-espresso/70">
              Denúncia {t.denuncia_resultado === 'procedente' ? 'procedente' : 'improcedente'}
              {t.denuncia_resultado === 'improcedente' && t.destravada_em ? ' — remoção desfeita' : ''}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {t.destravada_em ? (
              <span className="text-[11px] text-green-600">Desfeita em {dataBr(t.destravada_em)}{t.destravada_por ? ` por ${t.destravada_por}` : ''}</span>
            ) : confirmar === t.id ? (
              <>
                <span className="text-[11px] text-espresso/70 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> A pessoa volta a poder escolher mesa e a ser alocada.</span>
                <button disabled={destravar.isPending} className={`${botao} bg-plum text-cream`}
                  onClick={() => destravar.mutate(t.id, {
                    onSuccess: () => { setConfirmar(null); toast.success('Remoção desfeita.') },
                    onError: err => toast.error(erroMesaAdmin(err)),
                  })}>Confirmar</button>
                <button onClick={() => setConfirmar(null)} className={`${botao} border border-espresso/15 text-espresso`}>Cancelar</button>
              </>
            ) : (
              <button onClick={() => setConfirmar(t.id)} className={`${botao} border border-plum/30 text-plum hover:bg-plum/5`}>Desfazer</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
