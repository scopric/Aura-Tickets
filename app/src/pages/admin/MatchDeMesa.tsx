import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState, PageHeader, selectNativo } from '@/components/producer/ui'
import { alertaAviso, alertaErro, chipAviso, chipInfo, painel } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
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
const cartao = `${painel} p-4`
// campo de texto das caixas de resolução (mesmo desenho do Input, 14 px)
const campoTexto = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)] dark:bg-input/30'
const carregando = <div className="flex justify-center py-16"><Spinner className="size-6 text-primary" /></div>
// só a foto que o app grava vira <img> e pode ser aprovada; outra coisa só pode ser recusada
const jpeg = (foto: string) => foto.startsWith('data:image/jpeg;base64,')

type Mfa = ReturnType<typeof useTwoFactor>

// Sessão sem 2FA: o banco recusa toda a moderação (42501 "Ative o 2FA para moderar")
function Erro({ err, mfa, onRetry }: { err: unknown; mfa: Mfa; onRetry: () => void }) {
  return (
    <div role="alert" className={cn(alertaErro, 'mb-4')}>
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

  const abas: { id: Aba; label: string; icon: I.IconeEvokaa }[] = [
    { id: 'fotos', label: 'Fotos', icon: I.Camera },
    { id: 'denuncias', label: 'Denúncias', icon: I.Bandeira },
    { id: 'remocoes', label: 'Remoções', icon: I.PessoaRemover },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <PageHeader title="Match de Mesa" description="Fotos de perfil, denúncias e remoções. Exige 2FA." />

      <nav className="mb-6 flex gap-1 overflow-x-auto" role="tablist">
        {abas.map(a => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className={cn(
              'flex h-9 items-center gap-2 whitespace-nowrap rounded-ev-md px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              aba === a.id ? 'bg-[var(--ev-tint-ativo)] font-semibold text-foreground' : 'text-muted-foreground hover:bg-[var(--ev-tint-hover)] hover:text-foreground',
            )}>
            <a.icon size={16} ativo={aba === a.id} className={aba === a.id ? 'text-primary' : undefined} aria-hidden="true" />{a.label}
          </button>
        ))}
      </nav>

      {aba !== 'fotos' && (
        // ponytail: denúncia só por evento escolhido; falta no SQL uma fila geral das abertas (todos os
        // eventos) para o moderador não precisar procurar evento a evento. Pendência.
        <label className="mb-6 block max-w-md">
          <span className="mb-1.5 block text-[13px] font-medium text-muted-foreground">Evento</span>
          <select value={eventId} onChange={e => setEventId(e.target.value)} className={selectNativo}>
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

  if (fila.isLoading) return carregando
  if (fila.isError) return <Erro err={fila.error} mfa={mfa} onRetry={() => fila.refetch()} />
  const itens = fila.data ?? []

  return (
    <div className="space-y-3">
      {aviso && (
        <div role="alert" className={cn(alertaAviso, 'items-center justify-between gap-3')}>
          <span className="flex items-center gap-2"><I.Alerta size={16} className="text-[var(--ev-warning)]" aria-hidden="true" />{aviso}</span>
          <button onClick={() => { setAviso(''); fila.refetch() }} className="flex items-center gap-1 font-medium underline"><I.Atualizar size={12} aria-hidden="true" /> Atualizar lista</button>
        </div>
      )}
      {itens.length === 0 && <EmptyState title="Nenhuma foto esperando revisão." />}
      {itens.map(f => (
        <div key={f.id} className={`${cartao} flex flex-wrap items-center gap-4`}>
          {/* só a foto que o app grava (base64 JPEG); qualquer outra coisa não vira <img> */}
          {jpeg(f.foto)
            ? <img src={f.foto} alt={`Foto de ${f.nome ?? 'perfil'}`} className="size-20 rounded-xl object-cover" />
            : <div className="flex size-20 items-center justify-center rounded-xl bg-secondary text-center text-[11px] text-muted-foreground">formato não aceito</div>}
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{f.nome || 'Sem nome'}</div>
            <span className={`${chipAviso} mt-1`}>
              {f.situacao === 'revisar' ? (f.contestada ? 'Revisar' : 'Revisar (dúvida da IA)') : 'Pendente'}
            </span>
            {f.contestada && (
              <span className={`${chipInfo} mt-1 ml-1`}>
                Contestada pela pessoa
              </span>
            )}
            {f.ia && (
              <div className="mt-1 text-xs text-muted-foreground">
                {DECISAO_IA[f.ia.decisao] ?? f.ia.decisao}
                {f.ia.motivos.length > 0 && `: ${f.ia.motivos.map(m => MOTIVO_IA[m] ?? m).join(', ')}`}
                {' · '}{dataBr(f.ia.em)}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decide(f.id, f.hash, true)} disabled={decidir.isPending || !jpeg(f.foto)}>Aprovar</Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => decide(f.id, f.hash, false)} disabled={decidir.isPending}>Recusar</Button>
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
  const travas = useMesaTravas(eventId)
  const destravar = useMesaDestravar(eventId)
  const [confirmar, setConfirmar] = useState<string | null>(null)
  // denúncia que acabou de ser resolvida como improcedente: se ela tirou alguém da mesa, pergunta se desfaz
  const [improcedente, setImprocedente] = useState<string | null>(null)
  // "Resolvida" só vai ao banco com o resultado e a explicação
  const [resolvendo, setResolvendo] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoDenuncia | ''>('')
  const [explicacao, setExplicacao] = useState('')
  const explicacaoOk = explicacaoValida(explicacao)
  const primeiraOpcao = useRef<HTMLInputElement>(null)
  // ao abrir o formulário, o foco vai para a primeira opção
  useEffect(() => { if (resolvendo) primeiraOpcao.current?.focus() }, [resolvendo])
  const falta = !resultado ? 'Falta escolher o resultado.' : !explicacaoOk ? `Falta a explicação (de ${EXPLICACAO_MIN} a ${EXPLICACAO_MAX} caracteres, com letra ou número).` : ''

  if (lista.isLoading) return carregando
  if (lista.isError) return <Erro err={lista.error} mfa={mfa} onRetry={() => lista.refetch()} />
  const itens = lista.data ?? []

  return (
    <div className="space-y-3">
      {itens.length === 0 && <EmptyState title="Nenhuma denúncia neste evento." />}
      {itens.map(d => (
        <div key={d.id} className={cartao}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5 text-xs text-foreground">
              <div><span className="font-semibold">{d.denunciado || 'Conta excluída'}</span> · {MOTIVO_DENUNCIA[d.motivo] ?? d.motivo}{d.mesa ? ` · ${d.mesa}` : ''}</div>
              <div className="text-muted-foreground">Denunciado por {d.denunciante || 'conta excluída'} em {dataBr(d.criado_em)}</div>
              <div className="text-muted-foreground">
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
                setImprocedente(null)
                mudarStatus.mutate({ id: d.id, status }, {
                  onSuccess: () => toast.success('Status atualizado.'),
                  onError: err => toast.error(erroMesaAdmin(err)),
                })
              }}
              className={cn(selectNativo, 'sm:w-auto')}>
              {(Object.keys(STATUS_DENUNCIA) as StatusDenuncia[]).map(s => <option key={s} value={s}>{STATUS_DENUNCIA[s]}</option>)}
            </select>
          </div>
          {resolvendo === d.id && d.status !== 'resolvida' && (
            <div className="mt-3 space-y-2 rounded-[10px] bg-secondary p-3">
              <fieldset className="space-y-1">
                <legend className="text-xs text-muted-foreground">Resultado (obrigatório)</legend>
                {(Object.keys(RESULTADO_DENUNCIA) as ResultadoDenuncia[]).map((r, i) => (
                  <label key={r} className="flex items-center gap-2 text-[13px] text-foreground">
                    <input ref={i === 0 ? primeiraOpcao : undefined} type="radio" className="accent-primary" name={`resultado-${d.id}`} checked={resultado === r} onChange={() => setResultado(r)} /> {RESULTADO_DENUNCIA[r]}
                  </label>
                ))}
              </fieldset>
              <label className="block">
                <span className="text-xs text-muted-foreground">Explique por que está resolvida (obrigatório, de {EXPLICACAO_MIN} a {EXPLICACAO_MAX} caracteres)</span>
                <textarea value={explicacao} onChange={e => setExplicacao(e.target.value)} maxLength={EXPLICACAO_MAX} rows={3}
                  className={`${campoTexto} mt-1`} />
              </label>
              <p id={`resolver-falta-${d.id}`} aria-live="polite" className="text-xs text-[var(--ev-warning)]">{falta}</p>
              <div className="flex gap-2">
                <Button size="sm" disabled={!resultado || !explicacaoOk || mudarStatus.isPending} aria-describedby={`resolver-falta-${d.id}`}
                  onClick={() => resultado && mudarStatus.mutate({ id: d.id, status: 'resolvida', resultado, explicacao }, {
                    onSuccess: () => { setResolvendo(null); setImprocedente(resultado === 'improcedente' ? d.id : null); toast.success('Status atualizado.') },
                    onError: err => toast.error(erroMesaAdmin(err)),
                  })}>Confirmar resolução</Button>
                <Button size="sm" variant="outline" onClick={() => setResolvendo(null)}>Cancelar</Button>
              </div>
            </div>
          )}
          {improcedente === d.id && (travas.data ?? []).filter(t => t.denuncia_id === d.id && !t.destravada_em).map(t => (
            <div key={t.id} role="status" className={cn(alertaAviso, 'mt-3 flex-wrap items-center')}>
              <I.Alerta size={16} className="text-[var(--ev-warning)]" aria-hidden="true" />
              <span>Esta denúncia tirou alguém da mesa. Desfazer a remoção?</span>
              <Button size="sm" disabled={destravar.isPending} aria-label={`Desfazer remoção de ${t.pessoa || 'conta excluída'}`}
                onClick={() => destravar.mutate(t.id, {
                  onSuccess: () => toast.success('Remoção desfeita.'),
                  onError: err => toast.error(erroMesaAdmin(err)),
                })}>Desfazer remoção</Button>
            </div>
          ))}
          {d.status === 'resolvida' && d.resultado && (
            <p className="mt-2 whitespace-pre-line break-words text-xs text-foreground">
              <span className="font-semibold">{d.resultado === 'procedente' ? 'Procedente' : 'Improcedente'}</span>
              {d.resultado_explicacao ? ` · ${d.resultado_explicacao}` : ''}
            </p>
          )}
          {/* texto livre de quem denunciou: sempre texto puro */}
          {d.detalhe && <p className="mt-2 whitespace-pre-line break-words text-xs leading-relaxed text-muted-foreground">{d.detalhe}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {d.liberada_produtor_em ? (
              <span className="text-xs text-[var(--ev-success)]">Liberada para a organização em {dataBr(d.liberada_produtor_em)}</span>
            ) : confirmar === d.id ? (
              <>
                <span className="text-xs text-muted-foreground">A organização verá o denunciado, o motivo e a mesa. Não dá para desfazer.</span>
                <Button size="sm" disabled={liberar.isPending}
                  onClick={() => liberar.mutate(d.id, {
                    onSuccess: () => { setConfirmar(null); toast.success('Denúncia liberada para a organização.') },
                    onError: err => toast.error(erroMesaAdmin(err)),
                  })}>Confirmar liberação</Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmar(null)}>Cancelar</Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirmar(d.id)}>Liberar para a organização</Button>
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

  if (lista.isLoading) return carregando
  if (lista.isError) return <Erro err={lista.error} mfa={mfa} onRetry={() => lista.refetch()} />
  const itens = lista.data ?? []

  return (
    <div className="space-y-3">
      {itens.length === 0 && <EmptyState title="Ninguém foi removido de mesa neste evento." />}
      {itens.map(t => (
        <div key={t.id} className={cartao}>
          <div className="space-y-0.5 text-xs text-foreground">
            <div><span className="font-semibold">{t.pessoa || 'Conta excluída'}</span> · {MOTIVO_REMOCAO[t.motivo] ?? t.motivo}</div>
            <div className="text-muted-foreground">Removida por {t.por || 'conta excluída'} em {dataBr(t.em)}</div>
          </div>
          {t.detalhe && <p className="mt-2 whitespace-pre-line break-words text-xs text-muted-foreground">{t.detalhe}</p>}
          {t.denuncia_resultado && (
            t.denuncia_resultado === 'improcedente' && !t.destravada_em ? (
              <div className="mt-1 text-xs font-medium text-[var(--ev-warning)]">Denúncia improcedente — a remoção ainda vale</div>
            ) : (
              <div className="mt-1 text-xs text-muted-foreground">Denúncia {t.denuncia_resultado === 'procedente' ? 'procedente' : 'improcedente'}</div>
            )
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {t.destravada_em ? (
              <span className="text-xs text-[var(--ev-success)]">Desfeita em {dataBr(t.destravada_em)}{t.destravada_por ? ` por ${t.destravada_por}` : ''}</span>
            ) : confirmar === t.id ? (
              <>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><I.EscudoAlerta size={14} aria-hidden="true" /> A pessoa volta a poder escolher mesa e a ser alocada.</span>
                <Button size="sm" disabled={destravar.isPending}
                  onClick={() => destravar.mutate(t.id, {
                    onSuccess: () => { setConfirmar(null); toast.success('Remoção desfeita.') },
                    onError: err => toast.error(erroMesaAdmin(err)),
                  })}>Confirmar</Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmar(null)}>Cancelar</Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirmar(t.id)}>Desfazer</Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
