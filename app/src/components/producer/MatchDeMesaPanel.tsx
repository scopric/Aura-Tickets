import { useState } from 'react'
import { Flag, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  useMesasDoEvento, useFormarMesas, useRemoverMembro, useMesaDenuncias, erroMesaAdmin,
  MOTIVO_REMOCAO, type MotivoRemocao,
} from '../../hooks/useMesaAdmin'
import { MOTIVO_DENUNCIA } from '../../hooks/useMatchmaking'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

// Match de Mesa no evento do produtor: formar as mesas, ver quem senta onde (nome completo e
// ingresso), remover da mesa quem tem denúncia liberada ao produtor (o banco trava a pessoa no evento) e ver as denúncias que a
// moderação liberou (só denunciado, motivo e mesa). Quem monta decide quando aparece: só para o dono
// do evento e só em evento com ingresso "coletiva".

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
      // fecha o formulário: a lista é recarregada e o botão só volta para quem o banco aceita
      onError: e => { setRemovendo(null); toast.error(erroMesaAdmin(e)) },
    })
  }

  return (
    <Card className="mt-10 gap-0 rounded-[10px] p-6 shadow-none">
      <section aria-labelledby="mdm-titulo">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="mdm-titulo" className="text-lg font-semibold leading-6 text-foreground">Match de Mesa</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              As mesas se formam sozinhas 24 h antes do evento. Formar agora: quem já escolheu a mesa fica nela, e os demais completam as mesas com vaga.
            </p>
          </div>
          {confirmarFormar ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Quem ainda não tem mesa entra agora. Confirma?</span>
              <Button
                size="sm"
                disabled={formar.isPending}
                onClick={() => formar.mutate(undefined, {
                  onSuccess: n => { setConfirmarFormar(false); toast.success(n === 1 ? '1 pessoa entrou nas mesas.' : `${n} pessoas entraram nas mesas.`) },
                  onError: e => toast.error(erroMesaAdmin(e)),
                })}
              >
                {formar.isPending && <Spinner />} Confirmar formação
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmarFormar(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button onClick={() => setConfirmarFormar(true)}>
              <Users aria-hidden="true" /> Formar mesas agora
            </Button>
          )}
        </div>

        {mesas.isLoading ? (
          <div className="flex justify-center py-8"><Spinner className="size-6" /></div>
        ) : mesas.isError ? (
          <p role="alert" className="text-sm text-destructive">{erroMesaAdmin(mesas.error)}</p>
        ) : !mesas.data?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma mesa formada ainda.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {mesas.data.map(m => (
              <div key={m.numero} className="rounded-[10px] border p-4">
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  {m.nome} <span className="font-normal text-muted-foreground">· {m.membros.length}/{m.capacidade} lugares</span>
                </h3>
                {m.membros.length === 0 && <p className="text-xs text-muted-foreground">Mesa vazia.</p>}
                <ul className="space-y-2">
                  {m.membros.map(p => (
                    <li key={p.ingresso} className="text-xs text-foreground">
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {p.nome}
                          <span className="ml-2 font-mono text-muted-foreground" title={p.ingresso}>ingresso {p.ingresso.slice(0, 8)}</span>
                        </span>
                        {removendo !== p.ingresso && (p.pode_remover ? (
                          <Button size="xs" variant="outline" className="text-destructive" onClick={() => abrir(p.ingresso)}>Remover da mesa</Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Sem denúncia que você possa usar</span>
                        ))}
                      </div>
                      {removendo === p.ingresso && p.pode_remover && (
                        <div className="mt-2 space-y-3 rounded-[10px] border border-destructive/30 p-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="mdm-motivo" className="text-xs text-muted-foreground">Motivo</Label>
                            <Select value={motivo} onValueChange={v => setMotivo(v as MotivoRemocao)}>
                              <SelectTrigger id="mdm-motivo" className="w-full"><SelectValue placeholder="Escolha o motivo" /></SelectTrigger>
                              <SelectContent>
                                {/* sem denúncia ninguém é removido; quem quer sair usa "sair da mesa" */}
                                {(Object.keys(MOTIVO_REMOCAO) as MotivoRemocao[]).filter(k => k !== 'pedido_da_pessoa').map(k => <SelectItem key={k} value={k}>{MOTIVO_REMOCAO[k]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="mdm-detalhe" className="text-xs text-muted-foreground">
                              Detalhe {motivo === 'outro' ? '(obrigatório, de 3 a 500 caracteres)' : '(opcional, de 3 a 500 caracteres)'}
                            </Label>
                            <Textarea id="mdm-detalhe" value={detalhe} onChange={e => setDetalhe(e.target.value)} maxLength={500} rows={2} />
                          </div>
                          <p className="text-[11px] text-muted-foreground">Não escreva dados de saúde ou de terceiros. A pessoa sai da mesa e não pode escolher outra neste evento.</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="destructive" onClick={confirmarRemocao} disabled={!motivo || !detalheOk || remover.isPending}>Confirmar remoção</Button>
                            <Button size="sm" variant="outline" onClick={() => setRemovendo(null)}>Cancelar</Button>
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

        <h3 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-foreground"><Flag aria-hidden="true" className="size-4" /> Denúncias liberadas pela moderação</h3>
        {denuncias.isError ? (
          <p role="alert" className="text-sm text-destructive">{erroMesaAdmin(denuncias.error)}</p>
        ) : !denuncias.data?.length ? (
          <p className="text-xs text-muted-foreground">{denuncias.isLoading ? 'Carregando…' : 'Nenhuma denúncia liberada.'}</p>
        ) : (
          <ul className="space-y-2">
            {denuncias.data.map((x, i) => (
              <li key={i} className="rounded-[10px] border p-3 text-xs text-foreground">
                <span className="font-semibold">{x.denunciado || 'Conta excluída'}</span> · {MOTIVO_DENUNCIA[x.motivo] ?? x.motivo}{x.mesa ? ` · ${x.mesa}` : ''}{x.resultado ? ` · ${x.resultado === 'procedente' ? 'Procedente' : 'Improcedente'}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  )
}
