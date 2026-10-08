import * as I from '@/components/icones/evokaa16'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { useInteressados, useRemoverInteressado } from '../../hooks/useInteresse'
import { useProducerEvents } from '../../hooks/useEvents'
import { useFiltroEvento } from '../../hooks/useEventoDaUrl'
import { useAuth } from '../../hooks/useAuth'
import { ABAS_DIVULGACAO, copiarTexto, csvInteressados, linkComUtm, linkDoEvento, temLinkPublico } from '../../lib/divulgacao'
import { csvFilename, downloadCsv, slugArquivo } from '../../lib/exportCsv'
import { faltaSegundoFator } from '../../lib/vendasPagas'
import FiltroEvento from '@/components/producer/FiltroEvento'
import QrDivulgacao from '@/components/producer/QrDivulgacao'
import { AbasDeArea, EmBreve, KpiCard } from '@/components/producer/ui-evento'
import { PageHeader, EmptyState, Erro, SectionTitle } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'

export default function ProducerInterestList() {
  const { user } = useAuth()
  const { data: lista = [], isLoading, isError, refetch, isFetching } = useInteressados()
  const remover = useRemoverInteressado()
  const eventos = useProducerEvents()
  const [eventId, trocarEvento] = useFiltroEvento()
  const evento = eventId ? eventos.data?.find(e => e.id === eventId) : undefined
  // só os eventos do produtor valem; ?eventId= de outro evento não mostra nada
  const eventoInvalido = !!eventId && !!eventos.data && !evento
  const filtrada = eventId ? lista.filter(i => i.event_id === eventId) : lista
  // lista vazia pode ser sessão sem 2FA concluído (o banco devolve vazio, sem erro)
  const semDados = !isLoading && !isError && lista.length === 0
  const doisFatores = useQuery({ queryKey: ['producer-2fa-pendente', user?.id], enabled: semDados, queryFn: faltaSegundoFator })
  const link = evento && temLinkPublico(evento) ? linkDoEvento(evento) : null
  const linkQr = link ? linkComUtm(link, 'cartaz', 'avise-me') : null
  const avisados = filtrada.filter(i => i.notified).length
  const emails = [...new Set(filtrada.map(i => i.email?.trim()).filter(Boolean))] as string[]

  const copiarEmails = async () => {
    if (await copiarTexto(emails.join(', '))) { toast.success(`${emails.length} e-mails copiados.`); toast.info('Os e-mails são dado pessoal (LGPD). Use só para avisar sobre o evento e não compartilhe.') }
    else toast.error('Não foi possível copiar. Tente de novo.')
  }

  const copiarLink = async () => {
    if (link && await copiarTexto(link)) toast.success('Link copiado.')
    else toast.error('Não foi possível copiar. Tente de novo.')
  }

  const baixarCsv = () => {
    downloadCsv(csvFilename(`lista-de-interesse-${slugArquivo(evento?.title, eventId ?? 'todos')}`), csvInteressados(filtrada))
    toast.info('O arquivo tem nome, e-mail e cidade de quem se inscreveu: dado pessoal (LGPD). Não compartilhe.')
  }

  // tira só da lista: o lead que a inscrição criou no CRM continua lá
  const handleRemove = async (id: string, nome: string) => {
    if (!window.confirm(`Remover ${nome} da lista? O lead continua no CRM.`)) return
    try {
      await remover.mutateAsync(id)
      toast.success('Removido da lista. O lead continua no CRM.')
    } catch {
      toast.error('Não foi possível remover. Tente de novo.')
    }
  }

  const header = (
    <PageHeader
      title="Lista de interesse"
      description="Pessoas que pediram para ser avisadas quando as vendas abrirem"
      actions={
        <>
          {emails.length > 0 && <Button variant="outline" onClick={() => void copiarEmails()}><I.Copiar aria-hidden="true" />Copiar e-mails</Button>}
          {filtrada.length > 0 && <Button variant="outline" onClick={baixarCsv}><I.Baixar aria-hidden="true" />Exportar CSV</Button>}
        </>
      }
    />
  )

  let corpo
  if (eventoInvalido) {
    corpo = <EmptyState title="Evento não encontrado entre os seus" description="O link aponta para um evento que não é seu ou não existe mais." action={<Button variant="outline" className="min-h-11" onClick={() => trocarEvento(null)}>Ver todos os eventos</Button>} />
  } else if (isLoading || eventos.isPending || (semDados && doisFatores.isPending)) {
    corpo = (
      <div aria-busy="true" aria-label="Carregando a lista de interesse">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-[88px] rounded-[10px] bg-muted" />)}
        </div>
        <Skeleton className="mt-6 h-48 rounded-[10px] bg-muted" />
      </div>
    )
  } else if (eventos.isError) {
    corpo = <Erro texto="Não foi possível carregar os seus eventos." refetch={() => { void eventos.refetch() }} carregando={eventos.isFetching} />
  } else if (isError) {
    corpo = <Erro texto="Não foi possível carregar a lista de interesse." refetch={() => { void refetch() }} carregando={isFetching} />
  } else if (semDados && doisFatores.isError) {
    corpo = <Erro texto="Não consegui confirmar o seu acesso (2FA). Sem isso a lista pode parecer vazia." refetch={() => { void doisFatores.refetch() }} carregando={doisFatores.isFetching} />
  } else if (semDados && doisFatores.data) {
    corpo = <EmptyState title="Confirme o 2FA para ver a lista" description="Saia e entre de novo, informando o código do 2FA. Sem isso o banco não mostra as inscrições." />
  } else {
    corpo = (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard rotulo="Inscritos" valor={filtrada.length.toLocaleString('pt-BR')} />
          <KpiCard rotulo="Avisados" valor={avisados.toLocaleString('pt-BR')} />
          <KpiCard rotulo="Pendentes" valor={(filtrada.length - avisados).toLocaleString('pt-BR')} comparacao="aguardando a venda abrir" className="col-span-2 lg:col-span-1" />
        </div>

        <section aria-labelledby="int-link" className="mt-6 rounded-[10px] border border-border bg-card p-4">
          <SectionTitle id="int-link">Link e QR do “Avise-me”</SectionTitle>
          {link && linkQr ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">O botão “Avise-me quando abrir” fica na página do evento enquanto a venda não começou. O link copiado é o da página, sem UTM; o QR leva UTM de cartaz (campanha avise-me), para você ver no Google Analytics quem veio pelo cartaz.</p>
                <p className="break-all font-mono text-xs text-foreground">{link}</p>
                <Button className="min-h-11" onClick={() => void copiarLink()}><I.Copiar aria-hidden="true" />Copiar link da página</Button>
              </div>
              <QrDivulgacao url={linkQr} nomeArquivo={`qr-avise-me-${slugArquivo(evento?.title, evento?.id ?? 'evento')}`} titulo={`QR Code da página de ${evento?.title}`} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {evento ? 'Este evento ainda não está no ar: só evento publicado e aprovado tem página pública para divulgar.' : 'Escolha um evento acima para copiar o link da página dele e gerar o QR.'}
            </p>
          )}
        </section>

      <div className="mt-4">
        {filtrada.length === 0 ? (
          <EmptyState
            title={eventId ? 'Ninguém na lista deste evento ainda' : 'Ninguém na lista ainda'}
            description="O botão “Avise-me quando abrir” aparece na página do evento enquanto a venda não começou."
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
            {filtrada.map(item => {
              const nome = item.full_name || 'Inscrição sem consentimento registrado'
              return (
                <li key={item.id} className="flex items-start gap-3 p-3 sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{nome}</span>
                      {item.notified && <Badge variant="secondary">Avisado</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{item.email || 'Sem e-mail (sem consentimento)'}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[item.event_title, item.city, new Date(item.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleRemove(item.id, nome)} aria-label={`Remover ${nome} da lista`}>
                    <I.Lixeira aria-hidden="true" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

        <div className="mt-8">
          <SectionTitle>Em breve</SectionTitle>
          <div className="mt-3 max-w-xl">
            <EmBreve titulo="Página própria da lista de interesse" descricao="Um endereço só para a inscrição, para divulgar antes de o evento ir ao ar. Hoje o “Avise-me” só existe na página do evento." acao="Criar página" />
          </div>
        </div>
      </>
    )
  }

  return (
    <div>
      {header}
      <AbasDeArea abas={ABAS_DIVULGACAO} rotulo="Divulgação" />

      <p className="mb-6 rounded-[10px] border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Quando a venda abre, cada pessoa é avisada sozinha, no aplicativo e por e-mail. Quem se inscreve também entra no seu CRM. Nome, e-mail e cidade só aparecem de quem deu o consentimento.
      </p>

      <FiltroEvento />
      {corpo}
    </div>
  )
}
