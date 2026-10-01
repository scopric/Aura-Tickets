import { useState } from 'react'
import { Loader2, Users, Flag } from 'lucide-react'
import { toast } from 'sonner'
import {
  useMesasDoEvento, useFormarMesas, useRemoverMembro, useMesaDenuncias, erroMesaAdmin,
  MOTIVO_REMOCAO, type MotivoRemocao,
} from '../../hooks/useMesaAdmin'
import { MOTIVO_DENUNCIA } from '../../hooks/useMatchmaking'

// Match de Mesa no evento do produtor: formar as mesas, ver quem senta onde (nome completo e
// ingresso), remover da mesa quem tem denúncia liberada ao produtor (o banco trava a pessoa no evento) e ver as denúncias que a
// moderação liberou (só denunciado, motivo e mesa). Quem monta decide quando aparece: só para o dono
// do evento e só em evento com ingresso "coletiva".

const botao = 'px-3 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-50'

export default function MatchDeMesaPanel({ eventId }: { eventId: string }) {
  const mesas = useMesasDoEvento(eventId)
  const denuncias = useMesaDenuncias('produtor', eventId)
  const formar = useFormarMesas(eventId)
  const remover = useRemoverMembro(eventId)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [motivo, setMotivo] = useState<MotivoRemocao | ''>('')
  const [detalhe, setDetalhe] = useState('')
  const [confirmarFormar, setConfirmarFormar] = useState(false)

  // O banco aceita detalhe de 3 a 500 caracteres e o exige em "outro"
  const d = detalhe.trim()
  const detalheOk = motivo === 'outro' ? d.length >= 3 && d.length <= 500 : d.length === 0 || (d.length >= 3 && d.length <= 500)

  const abrir = (ingresso: string) => { setRemovendo(ingresso); setMotivo(''); setDetalhe('') }

  const confirmarRemocao = () => {
    if (!removendo || !motivo || !detalheOk) return
    remover.mutate({ ingresso: removendo, motivo, detalhe }, {
      onSuccess: () => { setRemovendo(null); toast.success('Pessoa removida da mesa.') },
      onError: e => toast.error(erroMesaAdmin(e)),
    })
  }

  return (
    <section aria-labelledby="mdm-titulo" className="mt-10 bg-white/60 border border-white/60 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 id="mdm-titulo" className="font-serif text-xl text-espresso">Match de Mesa</h2>
          <p className="text-xs text-espresso/70 mt-1 max-w-md">
            As mesas se formam sozinhas 24 h antes do evento. Formar agora: quem já escolheu a mesa fica nela, e os demais completam as mesas com vaga.
          </p>
        </div>
        {confirmarFormar ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-espresso/70">Quem ainda não tem mesa entra agora. Confirma?</span>
            <button
              onClick={() => formar.mutate(undefined, {
                onSuccess: n => { setConfirmarFormar(false); toast.success(n === 1 ? '1 pessoa entrou nas mesas.' : `${n} pessoas entraram nas mesas.`) },
                onError: e => toast.error(erroMesaAdmin(e)),
              })}
              disabled={formar.isPending}
              className={`${botao} flex items-center gap-1.5 bg-plum text-cream`}
            >
              {formar.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirmar formação
            </button>
            <button onClick={() => setConfirmarFormar(false)} className={`${botao} border border-espresso/15 text-espresso`}>Cancelar</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmarFormar(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
          >
            <Users className="w-4 h-4" /> Formar mesas agora
          </button>
        )}
      </div>

      {mesas.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-plum animate-spin" /></div>
      ) : mesas.isError ? (
        <p role="alert" className="text-sm text-red-500">{erroMesaAdmin(mesas.error)}</p>
      ) : !mesas.data?.length ? (
        <p className="py-6 text-center text-xs text-espresso/70 italic">Nenhuma mesa formada ainda.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {mesas.data.map(m => (
            <div key={m.numero} className="p-4 rounded-xl bg-white/40 border border-white/60">
              <h3 className="text-sm font-bold text-espresso mb-2">{m.nome} <span className="font-normal text-espresso/70">· {m.membros.length}/{m.capacidade} lugares</span></h3>
              {m.membros.length === 0 && <p className="text-xs text-espresso/70 italic">Mesa vazia.</p>}
              <ul className="space-y-2">
                {m.membros.map(p => (
                  <li key={p.ingresso} className="text-xs text-espresso">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {p.nome}
                        <span className="text-espresso/70 font-mono ml-2" title={p.ingresso}>ingresso {p.ingresso.slice(0, 8)}</span>
                      </span>
                      {removendo !== p.ingresso && (p.pode_remover ? (
                        <button onClick={() => abrir(p.ingresso)} className={`${botao} border border-red-200 text-red-500 hover:bg-red-50`}>Remover da mesa</button>
                      ) : (
                        <span className="text-[11px] text-espresso/70 italic">Sem denúncia liberada</span>
                      ))}
                    </div>
                    {removendo === p.ingresso && (
                      <div className="mt-2 p-3 rounded-xl bg-white/60 border border-red-200 space-y-2">
                        <label className="block">
                          <span className="text-[11px] text-espresso/70">Motivo</span>
                          <select value={motivo} onChange={e => setMotivo(e.target.value as MotivoRemocao)}
                            className="mt-1 w-full px-3 py-1.5 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso focus:outline-none">
                            <option value="">Escolha o motivo</option>
                            {(Object.keys(MOTIVO_REMOCAO) as MotivoRemocao[]).map(k => <option key={k} value={k}>{MOTIVO_REMOCAO[k]}</option>)}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-[11px] text-espresso/70">Detalhe {motivo === 'outro' ? '(obrigatório, de 3 a 500 caracteres)' : '(opcional, de 3 a 500 caracteres)'}</span>
                          <textarea value={detalhe} onChange={e => setDetalhe(e.target.value)} maxLength={500} rows={2}
                            className="mt-1 w-full px-3 py-1.5 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso focus:outline-none" />
                        </label>
                        <p className="text-[11px] text-amber-700">Não escreva dados de saúde ou de terceiros. A pessoa sai da mesa e não pode escolher outra neste evento.</p>
                        <div className="flex gap-2">
                          <button onClick={confirmarRemocao} disabled={!motivo || !detalheOk || remover.isPending} className={`${botao} bg-red-500 text-white`}>Confirmar remoção</button>
                          <button onClick={() => setRemovendo(null)} className={`${botao} border border-espresso/15 text-espresso`}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-medium text-espresso mt-8 mb-3 flex items-center gap-2"><Flag className="w-4 h-4 text-plum" /> Denúncias liberadas pela moderação</h3>
      {denuncias.isError ? (
        <p role="alert" className="text-sm text-red-500">{erroMesaAdmin(denuncias.error)}</p>
      ) : !denuncias.data?.length ? (
        <p className="text-xs text-espresso/70 italic">{denuncias.isLoading ? 'Carregando…' : 'Nenhuma denúncia liberada.'}</p>
      ) : (
        <ul className="space-y-2">
          {denuncias.data.map((x, i) => (
            <li key={i} className="text-xs text-espresso p-3 rounded-xl bg-white/40 border border-white/60">
              <span className="font-bold">{x.denunciado || 'Conta excluída'}</span> · {MOTIVO_DENUNCIA[x.motivo] ?? x.motivo}{x.mesa ? ` · ${x.mesa}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
