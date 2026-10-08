import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { cn } from '@/lib/utils'
import { useProducerEvents } from '../../hooks/useEvents'
import { useFiltroEvento } from '../../hooks/useEventoDaUrl'
import { useAuth } from '../../hooks/useAuth'
import { slugArquivo } from '../../lib/exportCsv'
import { faltaSegundoFator } from '../../lib/vendasPagas'
import {
  ABAS_DIVULGACAO, CANAIS, canalDe, comLinkNovo, copiarTexto, gravarLinks, linkGuardadoVale, lerLinks, linkComUtm, linkDoEvento, normalizaCampanha, temLinkPublico,
  type CanalId, type LinkSalvo,
} from '../../lib/divulgacao'
import QrDivulgacao from '@/components/producer/QrDivulgacao'
import { AbasDeArea, EmBreve } from '@/components/producer/ui-evento'
import { PageHeader, EmptyState, Erro, SectionTitle, selectNativo } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProducerDivulgacao() {
  const { user } = useAuth()
  const eventos = useProducerEvents()
  const lista = eventos.data ?? []
  const [eventId, trocarEvento] = useFiltroEvento()
  const evento = eventId ? lista.find(e => e.id === eventId) : undefined
  // só os eventos do produtor entram; ?eventId= de outro evento não monta link nenhum
  const eventoInvalido = !!eventId && !!eventos.data && !evento
  const noAr = lista.filter(temLinkPublico)

  // a RLS de events exige 2FA concluído: sem ele a lista vem vazia, sem erro
  const semEventos = !!eventos.data && lista.length === 0
  const doisFatores = useQuery({ queryKey: ['producer-2fa-pendente', user?.id], enabled: semEventos, queryFn: faltaSegundoFator })

  const [canal, setCanal] = useState<CanalId>('instagram')
  const [campanha, setCampanha] = useState('')
  const [salvos, setSalvos] = useState<LinkSalvo[]>([])
  useEffect(() => { setSalvos(user?.id ? lerLinks(user.id) : []) }, [user?.id])

  const pronto = evento && temLinkPublico(evento)
  const campanhaOk = normalizaCampanha(campanha)
  const link = pronto ? linkComUtm(linkDoEvento(evento), canal, campanha) : null
  const nomeArquivo = evento ? `qr-${slugArquivo(evento.title, evento.id)}-${canal}${campanhaOk ? `-${campanhaOk}` : ''}` : 'qr'

  const copiar = async (url: string) => {
    if (await copiarTexto(url)) toast.success('Link copiado.'); else toast.error('Não foi possível copiar. Selecione o link e copie à mão.')
  }
  const salvar = () => {
    if (!link || !evento || !user?.id) return
    const novo: LinkSalvo = { id: crypto.randomUUID(), eventId: evento.id, evento: evento.title, canal, campanha: campanhaOk, url: link, criadoEm: new Date().toISOString() }
    const nova = comLinkNovo(salvos, novo)
    setSalvos(nova)
    if (gravarLinks(user.id, nova)) toast.success('Link guardado na lista.')
    else toast.error('O navegador não deixou guardar a lista. O link vale só até fechar esta página.')
  }
  const remover = (id: string) => {
    const nova = salvos.filter(l => l.id !== id)
    setSalvos(nova)
    if (user?.id) gravarLinks(user.id, nova)
  }
  // lista só com links de eventos que ainda são deste produtor; o que saiu do ar ou mudou de endereço não se copia
  const visiveis = salvos.filter(l => lista.some(e => e.id === l.eventId) && (!eventId || l.eventId === eventId))

  let corpo
  if (eventoInvalido) {
    corpo = <EmptyState title="Evento não encontrado entre os seus" description="O link aponta para um evento que não é seu ou não existe mais." action={<Button variant="outline" className="min-h-11" onClick={() => trocarEvento(null)}>Escolher outro evento</Button>} />
  } else if (eventos.isPending || (semEventos && doisFatores.isPending)) {
    corpo = <div aria-busy="true" aria-label="Carregando eventos"><Skeleton className="h-64 rounded-[10px] bg-muted" /></div>
  } else if (eventos.isError) {
    corpo = <Erro texto="Não foi possível carregar os seus eventos." refetch={() => { void eventos.refetch() }} carregando={eventos.isFetching} />
  } else if (semEventos && doisFatores.isError) {
    corpo = <Erro texto="Não consegui confirmar o seu acesso (2FA). Sem isso a lista de eventos pode parecer vazia." refetch={() => { void doisFatores.refetch() }} carregando={doisFatores.isFetching} />
  } else if (semEventos && doisFatores.data) {
    corpo = <EmptyState title="Confirme o 2FA para ver os seus eventos" description="Saia e entre de novo, informando o código do 2FA. Sem isso o banco não mostra os eventos." />
  } else if (noAr.length === 0) {
    corpo = <EmptyState title="Nenhum evento no ar ainda" description="Só evento publicado e aprovado tem página pública para divulgar. Publique um evento e volte aqui." action={<Button asChild className="min-h-11"><Link to="/producer/events">Ver meus eventos</Link></Button>} />
  } else {
    corpo = (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="div-monte" className="space-y-4">
          <SectionTitle id="div-monte">Monte o link</SectionTitle>
          <div className="grid gap-1.5">
            <label htmlFor="div-evento" className="text-sm text-muted-foreground">Evento</label>
            <select id="div-evento" value={evento?.id ?? ''} onChange={e => trocarEvento(e.target.value || null)} className={cn(selectNativo, 'min-h-11')}>
              <option value="">Escolha o evento</option>
              {evento && !temLinkPublico(evento) && <option value={evento.id}>{evento.title} (fora do ar)</option>}
              {noAr.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
          <div role="group" aria-labelledby="div-canal" className="grid gap-1.5">
            <span id="div-canal" className="text-sm text-muted-foreground">Canal</span>
            <div className="flex flex-wrap gap-2">
              {CANAIS.map(c => (
                <Button key={c.id} type="button" variant={canal === c.id ? 'secondary' : 'outline'} aria-pressed={canal === c.id} className="min-h-11" onClick={() => setCanal(c.id)}>
                  {canal === c.id && <I.Check aria-hidden="true" />}{c.rotulo}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="div-campanha" className="text-sm text-muted-foreground">Campanha (opcional)</label>
            <Input id="div-campanha" value={campanha} maxLength={60} autoComplete="off" onChange={e => setCampanha(e.target.value)} className="min-h-11" aria-describedby="div-campanha-ajuda" />
            <p id="div-campanha-ajuda" className="text-xs text-muted-foreground">
              {campanhaOk ? <>Vai no link como <span className="font-mono text-foreground">{campanhaOk}</span> (minúscula, sem acento, até 40 caracteres).</> : 'Um nome para você achar esta divulgação depois, como "lote-1" ou "story-sexta".'}
            </p>
          </div>

          {evento && !pronto && (
            <EmptyState title="Este evento ainda não está no ar" description="Só evento publicado e aprovado tem página pública. Publique o evento para gerar o link." action={<Button asChild variant="outline" className="min-h-11"><Link to={`/producer/events/${evento.id}/edit`}>Editar o evento</Link></Button>} />
          )}
          {!evento && <p className="rounded-[10px] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">Escolha um evento para ver o link e o QR.</p>}
          {link && (
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <label htmlFor="div-link" className="text-sm text-muted-foreground">Link com UTM</label>
                <Input id="div-link" readOnly value={link} onFocus={e => e.currentTarget.select()} className="min-h-11 font-mono text-xs" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11" onClick={() => void copiar(link)}><I.Copiar aria-hidden="true" />Copiar link</Button>
                <Button variant="outline" className="min-h-11" onClick={salvar}><I.Guardar aria-hidden="true" />Guardar na lista</Button>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="div-qr" className="space-y-3">
          <SectionTitle id="div-qr">QR do link</SectionTitle>
          {link ? <QrDivulgacao url={link} nomeArquivo={nomeArquivo} titulo={`QR Code do link de ${evento?.title ?? 'divulgação'}`} /> : <p className="text-sm text-muted-foreground">O QR aparece quando o link estiver pronto.</p>}
        </section>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Divulgação" description="Links com origem, QR e as ferramentas para divulgar seus eventos" />
      <AbasDeArea abas={ABAS_DIVULGACAO} rotulo="Divulgação" />

      <p className="mb-6 rounded-[10px] border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        O pedido ainda não grava de onde veio a compra: aqui você não vê vendas por canal. O endereço com UTM vai para o Google Analytics, quando ele está ligado no site e a pessoa aceita os cookies de análise; é lá que a origem das visitas aparece.
      </p>

      {corpo}

      {!eventoInvalido && !eventos.isPending && !eventos.isError && (
        <section aria-labelledby="div-lista" className="mt-8">
          <SectionTitle id="div-lista">Links guardados</SectionTitle>
          <p className="mt-1 text-xs text-muted-foreground">Ficam só neste navegador, até 30 por conta. Se limpar os dados do navegador, somem.</p>
          {visiveis.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum link guardado ainda. Monte um acima e use “Guardar na lista”.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
              {visiveis.map(l => (
                <li key={l.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{l.evento} · {canalDe(l.canal)?.rotulo}{l.campanha ? ` · ${l.campanha}` : ''}</p>
                    <p className="break-all text-xs text-muted-foreground">{l.url}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {linkGuardadoVale(l, lista)
                      ? <Button variant="outline" size="sm" className="min-h-11" onClick={() => void copiar(l.url)} aria-label={`Copiar link de ${l.evento}, ${canalDe(l.canal)?.rotulo}${l.campanha ? `, ${l.campanha}` : ''}`}><I.Copiar aria-hidden="true" />Copiar</Button>
                      : <span className="px-2 text-xs text-muted-foreground">Fora do ar</span>}
                    <Button variant="ghost" size="icon" className="size-11 text-muted-foreground hover:text-foreground" onClick={() => remover(l.id)} aria-label={`Remover da lista o link de ${l.evento}, ${canalDe(l.canal)?.rotulo}${l.campanha ? `, ${l.campanha}` : ''}`}><I.Lixeira aria-hidden="true" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="div-breve" className="mt-8">
        <SectionTitle id="div-breve">Em breve</SectionTitle>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <EmBreve titulo="Convite por e-mail" descricao="Mandar o convite ou ingresso com link para uma lista de pessoas. Precisa de um tipo de e-mail novo e de uma tabela de convites (SQL e publicação da função)." acao="Convidar por e-mail" />
          <EmBreve titulo="Ingresso privado" descricao="Ingresso que só quem tem o link consegue comprar. Precisa de uma coluna nova e de uma regra no servidor." acao="Criar ingresso privado" />
          <EmBreve titulo="Receita por link e canal" descricao="Ver quanto cada link e canal vendeu. Depende de gravar a origem no pedido (SQL novo)." acao="Ver receita por canal" />
          <EmBreve titulo="Extrato de comissão do afiliado" descricao="Cada venda de cada afiliado, com a comissão. Depende de SQL novo." acao="Ver extrato" />
          <EmBreve titulo="Agendar banner" descricao="Escolher dia e hora para o banner entrar e sair do ar. Depende de o banner aparecer no site público." acao="Agendar banner" />
          <EmBreve titulo="Pixel da Meta e WhatsApp" descricao="Ficam na central de integrações, que está em outra frente de trabalho." acao="Abrir integrações" />
        </div>
      </section>
    </div>
  )
}
