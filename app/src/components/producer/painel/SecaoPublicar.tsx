import { Link } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { ModoPainel } from '../../../lib/painelEvento'

export type Falta = { rotulo: string; secao: string; nomeSecao: string }

// Seção "Publicar": o que falta (com "Ir para…"), o aceite do produtor (o texto de textoAceite, montado do que está na
// tela) e o botão de enviar. Evento no ar ou em análise só mostra o estado: o envio das alterações é na faixa do topo.
export default function SecaoPublicar({ modo, faltas, onIr, aceiteTexto, aceiteMarcado, aceiteTrava, onAceite, onEnviar, enviando, erroEnvio, noArDesde, hrefOrcamento }: {
  modo: ModoPainel
  faltas: Falta[]
  onIr: (secao: string) => void
  aceiteTexto: string
  aceiteMarcado: boolean
  aceiteTrava: boolean // sem classificação não há o que aceitar
  onAceite: (v: boolean) => void
  onEnviar: () => void
  enviando: boolean
  erroEnvio: string
  noArDesde?: string // data curta da aprovação (approved_at)
  hrefOrcamento: string // o mesmo link do menu "…"
}) {
  if (modo === 'publicado') return <p className="flex items-center gap-2 text-sm text-foreground"><I.Check size={16} aria-hidden="true" />{noArDesde ? `No ar desde ${noArDesde}.` : 'No ar.'} Mudanças de conteúdo passam por nova análise.</p>
  if (modo === 'analise') return <p className="flex items-center gap-2 text-sm text-foreground"><I.Horario size={16} aria-hidden="true" />Enviado para aprovação. A equipe avisa por e-mail quando aprovar ou recusar.</p>
  if (modo === 'fechado') return <p className="text-sm text-muted-foreground">Este evento não está mais à venda e não é enviado para aprovação.</p>

  const [titulo, ...linhas] = aceiteTexto.split('\n')
  const trava = faltas.length > 0
  return (
    <div className="grid gap-4">
      {faltas.length > 0 && (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-foreground">Falta para enviar</span>
          <ul className="m-0 list-none p-0">
            {faltas.map(p => (
              <li key={p.rotulo} className="flex min-h-11 items-center gap-3 border-t border-border first:border-t-0">
                <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full ring-[1.5px] ring-inset ring-[var(--ev-warning)]"><span className="size-1.5 rounded-full bg-[var(--ev-warning)]" /></span>
                <span className="flex-1 text-sm text-foreground">{p.rotulo}</span>
                {p.secao !== 'pub' && <Button type="button" variant="link" size="sm" onClick={() => onIr(p.secao)}>Ir para {p.nomeSecao}</Button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-3 rounded-[10px] bg-secondary p-4">
        <p className="text-sm font-medium text-foreground">Aceite do produtor</p>
        <div className="max-h-64 overflow-auto rounded-md bg-card p-3 text-[13px] leading-5 text-foreground" tabIndex={0} role="region" aria-label="Texto do aceite">
          <p className="font-semibold">{titulo}</p>
          {linhas.map((l, i) => <p key={i} className="mt-1.5">{l}</p>)}
        </div>
        <div className="flex items-start gap-2">
          <Checkbox id="f-aceite" checked={aceiteMarcado} disabled={aceiteTrava} onCheckedChange={v => onAceite(v === true)} aria-describedby="f-aceite-ajuda" className="mt-0.5" />
          <Label htmlFor="f-aceite" className="font-normal">Li e aceito o termo do produtor</Label>
        </div>
        <p id="f-aceite-ajuda" className="text-xs text-muted-foreground">
          {aceiteTrava ? 'Escolha a classificação em Regras e idade para liberar o aceite. ' : 'Se você mudar o nome, a classificação ou a bebida de um ingresso, o aceite desmarca e vale o texto novo. '}
          A data, a hora, o IP e o navegador ficam registrados pelo servidor.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" aria-disabled={trava || undefined} aria-describedby="a-env" loading={enviando} onClick={() => (trava ? onIr(faltas[0].secao) : onEnviar())}>
          <I.Enviar aria-hidden="true" />Enviar para aprovação
        </Button>
        <span id="a-env" className="text-xs text-muted-foreground">
          {trava ? `Falta: ${faltas.map(p => p.rotulo).join(', ')}.` : 'A equipe analisa antes de o evento ir ao ar.'}
        </span>
      </div>
      <Button asChild variant="link" className="justify-self-start px-0"><Link to={hrefOrcamento}><I.Financeiro aria-hidden="true" />Montar o orçamento</Link></Button>
      {erroEnvio && <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive"><I.Erro size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{erroEnvio}</p>}
    </div>
  )
}
