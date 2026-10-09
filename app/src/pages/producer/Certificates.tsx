import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { useAuth } from '../../hooks/useAuth'
import { useProducerEvents } from '../../hooks/useEvents'
import { useEventoDaUrl, useFiltroEvento } from '../../hooks/useEventoDaUrl'
import { useLogoProdutor } from '../../hooks/useLogoProdutor'
import { enviarCertificadoPorEmail, enviarEmLote } from '../../lib/certificadoEnviar'
import {
  useEventCertificates,
  useParticipantesCertificado,
  useCertificadosEmitidos,
  useEmitirCertificados,
  useRevogarCertificado,
  type CertificadoEmitido,
} from '../../hooks/useProducerTools'
import { faltaSegundoFator } from '../../lib/vendasPagas'
import { downloadCsv, csvFilename, slugArquivo } from '../../lib/exportCsv'
import { situacaoEvento } from '../../lib/eventoProdutor'
import { dataBR } from '../../lib/bordero'
import { LIMITES, csvEmitidos, dataLonga, imagemSegura, modeloComCor, modeloPorId, partesDoLote, sanearTemplate, type DadosCertificado } from '../../lib/certificados'
import { CabecalhoEvento, EmBreve, KpiCard } from '@/components/producer/ui-evento'
import { ImpressaoCertificados } from '@/components/producer/CertificadoDesenho'
import { EmptyState, Erro, SectionTitle, selectNativo } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import BotaoInativo from '@/components/producer/BotaoInativo'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const ABAS = ['participantes', 'emitidos'] as const
type Aba = (typeof ABAS)[number]

// Avatar com as iniciais, sem serviço externo (LGPD)
const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'
const dataDe = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

function mensagemErro(err: unknown, padrao: string) {
  const code = (err as { code?: string } | null)?.code
  if (code === '23505') return 'Certificado já emitido para esta pessoa. A lista foi atualizada.'
  // 42501: alguém da lista deixou de ter ingresso válido (a regra do banco recusa o lote todo)
  if (code === '42501') return 'A lista mudou; atualizamos os participantes. Tente de novo.'
  return padrao
}

export default function Certificates() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const eventosQ = useProducerEvents()
  const events = eventosQ.data ?? []
  const [daUrl] = useFiltroEvento()
  const [pickedEventId, setPickedEventId] = useEventoDaUrl(events.map(e => e.id))
  // ?eventId= de outro produtor (ou apagado) não lê nada: a tela diz que não achou
  const eventoInvalido = !!daUrl && !!eventosQ.data && !events.some(e => e.id === daUrl)
  // a lista chega depois do 1º render: sem escolha (URL ou último usado), vale o primeiro evento
  const selectedEventId = eventoInvalido ? null : (pickedEventId ?? events[0]?.id ?? null)
  const evento = events.find(e => e.id === selectedEventId)
  const [params, setParams] = useSearchParams()
  const abaAtual: Aba = ABAS.find(a => a === params.get('aba')) ?? 'participantes'
  // quem recebe: só quem fez check-in (ingresso usado) ou todo mundo com ingresso válido (ativo ou usado)
  const [somenteCheckin, setSomenteCheckin] = useState(true)
  const [revogando, setRevogando] = useState<{ id: string; nome: string } | null>(null)
  const [impressao, setImpressao] = useState<{ id: number; itens: DadosCertificado[] } | null>(null)
  const [enviandoEmail, setEnviandoEmail] = useState<string | 'lote' | null>(null)
  const pedidos = useRef(0) // cada clique é um pedido novo (key do contêiner): imprime de novo mesmo sem o afterprint (Safari do iPhone)
  const imprimir = (itens: DadosCertificado[]) => setImpressao({ id: ++pedidos.current, itens })

  // certificates guarda o MODELO do evento (um por evento, índice único em event_id)
  const modelosQ = useEventCertificates(selectedEventId)
  const modelo = modelosQ.data?.[0] ?? null
  const participantesQ = useParticipantesCertificado(modelo ? selectedEventId : null)
  const emitidosQ = useCertificadosEmitidos(modelo?.id ?? null)
  const emitir = useEmitirCertificados()
  const revogar = useRevogarCertificado()

  const participantes = participantesQ.data?.lista ?? []
  const emitidosTodos = emitidosQ.data ?? [] // com os revogados (a linha fica, com histórico)
  const emitidos = emitidosTodos.filter(c => !c.revoked_at) // ativos: valem no PDF, no e-mail e na contagem; quem foi revogado volta a ser elegível
  const emitidoDe = new Map(emitidos.map(c => [c.user_id, c]))
  const nomeDe = new Map(participantes.map(p => [p.user_id, p.nome]))
  const elegiveis = participantes.filter(p => !somenteCheckin || p.checkin)
  const pendentes = elegiveis.filter(p => !emitidoDe.has(p.user_id))

  // lista vazia pode ser sessão sem 2FA concluído (o banco devolve vazio, sem erro): nunca mostrar "ninguém" falso
  const semDados = !!participantesQ.data && participantes.length === 0
  const doisFatores = useQuery({ queryKey: ['producer-2fa-pendente', user?.id], enabled: semDados, queryFn: faltaSegundoFator })

  const editorUrl = `/producer/certificado-editor${selectedEventId ? `?eventId=${selectedEventId}` : ''}`
  const mudaAba = (v: string) => {
    if (v === 'modelo') { navigate(editorUrl); return }
    setParams((p: URLSearchParams) => { const n = new URLSearchParams(p); n.set('aba', v); return n }, { replace: true })
  }

  const emitirPara = async (userIds: string[], ok: string) => {
    if (!modelo) return
    try {
      await emitir.mutateAsync({ certificateId: modelo.id, userIds })
      toast.success(ok)
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível emitir o certificado.'))
    }
  }

  const emitirTodos = () => {
    const quem = somenteCheckin ? 'quem fez check-in' : 'quem tem ingresso válido'
    if (!window.confirm(`Emitir ${pendentes.length} certificado(s) para ${quem}?`)) return
    emitirPara(pendentes.map(p => p.user_id), `${pendentes.length} certificado(s) emitido(s).`)
  }

  const confirmarRevogar = async () => {
    const alvo = revogando
    setRevogando(null)
    if (!modelo || !alvo) return
    try {
      await revogar.mutateAsync({ id: alvo.id, certificateId: modelo.id })
      toast.success('Certificado revogado.')
    } catch {
      toast.error('Não foi possível revogar o certificado.')
    }
  }

  const nomeEmitido = (c: CertificadoEmitido) => nomeDe.get(c.user_id) ?? 'Nome indisponível'
  const modeloVisual = modelo ? sanearTemplate(modelo.template) : null
  // Modelo sem logo gravada (salvo antes da logo do organizador existir, ou nunca salvo com ela) usa a logo salva em Configurações:
  // o PDF sai com a mesma logo que a prévia do editor mostra. Modelo com logo (própria ou guardada) mantém a dele.
  const { logo: logoOrg } = useLogoProdutor()
  const logoDoPdf = modeloVisual ? (modeloVisual.logoUrl ?? imagemSegura(logoOrg.data ?? null)) : null
  // clicar em PDF antes de a logo chegar abriria a impressão sem ela (a espera de imagens não tem o que esperar): trava o botão até chegar
  const esperandoLogo = !!modeloVisual && !modeloVisual.logoUrl && logoOrg.isLoading

  // PDF: o contêiner só-impressão usa o mesmo desenho da prévia do editor, um certificado por folha
  const dadosDe = (c: CertificadoEmitido): DadosCertificado => ({
    nome: nomeEmitido(c), evento: evento?.title ?? '', data: dataLonga(evento?.date) || (evento?.date ? dataBR(evento.date) : ''),
    horas: modeloVisual?.horas || '___', emissao: dataDe(c.issued_at), codigo: c.code,
  })
  // sem nome na lista de participantes (ingresso cancelado depois): não entra no PDF, para não sair certificado em branco
  const comNome = emitidos.filter(c => nomeDe.has(c.user_id))
  const semNome = emitidos.length - comNome.length
  const partes = partesDoLote(comNome)

  const enviarEmail = async (c: CertificadoEmitido) => {
    setEnviandoEmail(c.id)
    try {
      const r = await enviarCertificadoPorEmail(c.id)
      if (r.ok) toast.success(`Certificado enviado por e-mail para ${nomeEmitido(c)}.`)
      else toast.error(r.erro)
    } finally { setEnviandoEmail(null) }
  }
  const enviarEmailTodos = async () => {
    if (!window.confirm(`Enviar o certificado por e-mail para ${comNome.length} pessoa(s)? Cada certificado só pode ser enviado uma vez por hora e cada produtor envia até 30 por hora.`)) return
    setEnviandoEmail('lote')
    try {
      const r = await enviarEmLote(comNome.map(c => c.id))
      if (r.naoEnviados === 0) toast.success(`${r.enviados} certificado(s) enviado(s) por e-mail.`)
      else toast.error(`${r.enviados} enviado(s) e ${r.naoEnviados} não enviado(s). ${r.motivo ?? ''}${r.parouNoLimite ? ' Os que sobraram podem ser enviados daqui a uma hora.' : ''}`.trim())
    } finally { setEnviandoEmail(null) }
  }

  const exportar = () => {
    const csv = csvEmitidos(emitidosTodos.map(c => ({ nome: nomeEmitido(c), codigo: c.code, emitidoEm: dataDe(c.issued_at), situacao: c.revoked_at ? `Revogado em ${dataDe(c.revoked_at)}` : 'Ativo' })))
    downloadCsv(csvFilename(`certificados-${slugArquivo(evento?.title, selectedEventId ?? 'evento')}`), csv)
    toast.info('O arquivo tem o nome dos participantes: dado pessoal (LGPD). Não compartilhe.')
  }

  const editorBtn = <Button asChild variant="outline" className="min-h-11"><Link to={editorUrl}><I.Paleta aria-hidden="true" />Editor de modelos</Link></Button>
  const cabecalho = evento ? (
    <>
      <CabecalhoEvento titulo={evento.title} situacao={situacaoEvento(evento)} detalhes={[evento.date && dataBR(evento.date)]} editarHref={`/producer/events/${evento.id}/edit`} extras={editorBtn} />
      <h2 className="mb-4 text-lg font-semibold text-foreground">Certificados</h2>
    </>
  ) : (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold leading-8 tracking-[-0.015em] text-foreground">Certificados</h1>
      <p className="mt-1 text-sm text-muted-foreground">Emita certificados para quem participou dos seus eventos</p>
    </header>
  )

  const carregandoLista = modelosQ.isLoading || (!!modelo && (participantesQ.isLoading || emitidosQ.isLoading))
  const erroLista = modelosQ.isError || participantesQ.isError || emitidosQ.isError

  let corpo
  if (eventosQ.isLoading) {
    corpo = (
      <div aria-busy="true" aria-label="Carregando certificados">
        <Skeleton className="h-11 w-full max-w-sm rounded-md bg-muted" />
        <Skeleton className="mt-6 h-48 rounded-[10px] bg-muted" />
      </div>
    )
  } else if (eventosQ.isError) {
    corpo = <Erro texto="Não foi possível carregar seus eventos." refetch={() => eventosQ.refetch()} carregando={eventosQ.isFetching} />
  } else if (eventoInvalido) {
    corpo = <EmptyState title="Evento não encontrado entre os seus" description="O link aponta para um evento que não é seu ou não existe mais." action={<Button variant="outline" className="min-h-11" onClick={() => setPickedEventId(events[0]?.id ?? null)}>Ver meus eventos</Button>} />
  } else if (events.length === 0) {
    corpo = (
      <EmptyState
        title="Você ainda não tem eventos"
        description="O certificado é emitido por evento, para quem tem ingresso."
        action={<Button asChild className="min-h-11"><Link to="/producer/events/new"><I.Criar aria-hidden="true" />Criar evento</Link></Button>}
      />
    )
  } else {
    let conteudo
    if (carregandoLista) {
      conteudo = <div aria-busy="true" aria-label="Carregando certificados"><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[1, 2, 3].map(n => <Skeleton key={n} className="h-[88px] rounded-[10px] bg-muted" />)}</div><Skeleton className="mt-6 h-48 rounded-[10px] bg-muted" /></div>
    } else if (erroLista) {
      conteudo = (
        <Erro
          texto="Não foi possível carregar os certificados deste evento."
          refetch={() => { modelosQ.refetch(); participantesQ.refetch(); emitidosQ.refetch() }}
          carregando={modelosQ.isFetching || participantesQ.isFetching || emitidosQ.isFetching}
        />
      )
    } else if (!modelo) {
      conteudo = (
        <EmptyState
          title="Este evento ainda não tem modelo de certificado"
          description="Monte o modelo no editor; depois você emite aqui para quem participou."
          action={<Button asChild className="min-h-11"><Link to={editorUrl}><I.Paleta aria-hidden="true" />Criar modelo</Link></Button>}
        />
      )
    } else if (semDados && doisFatores.isPending) {
      conteudo = <div aria-busy="true"><Skeleton className="h-40 rounded-[10px] bg-muted" /></div>
    } else if (semDados && doisFatores.isError) {
      conteudo = <Erro texto="Não consegui confirmar o seu acesso (2FA). Sem isso a lista pode parecer vazia." refetch={() => { void doisFatores.refetch() }} carregando={doisFatores.isFetching} />
    } else if (semDados && doisFatores.data) {
      conteudo = <EmptyState title="Confirme o 2FA para ver os participantes" description="Saia e entre de novo, informando o código do 2FA. Sem isso o banco não mostra os ingressos." />
    } else {
      conteudo = (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard rotulo={somenteCheckin ? 'Elegíveis (presentes)' : 'Elegíveis (ingresso válido)'} valor={elegiveis.length.toLocaleString('pt-BR')} comparacao={somenteCheckin ? 'ingresso com check-in feito' : 'ingresso ativo ou usado'} />
            <KpiCard rotulo="Emitidos" valor={emitidos.length.toLocaleString('pt-BR')} comparacao="certificados com código" />
            <KpiCard rotulo="Pendentes" valor={pendentes.length.toLocaleString('pt-BR')} comparacao="elegíveis sem certificado" />
          </div>

          <Tabs value={abaAtual} onValueChange={mudaAba} className="mt-6">
            <TabsList aria-label="Certificados" className="max-w-full overflow-x-auto">
              <TabsTrigger value="participantes" className="min-h-11">Participantes</TabsTrigger>
              <TabsTrigger value="emitidos" className="min-h-11">Emitidos<span className="ml-1.5 tabular-nums text-muted-foreground">{emitidos.length.toLocaleString('pt-BR')}</span></TabsTrigger>
              <TabsTrigger value="modelo" className="min-h-11">Modelo<I.AbrirExterno size={14} className="ml-1" aria-hidden="true" /><span className="sr-only"> (abre o editor)</span></TabsTrigger>
            </TabsList>
          </Tabs>

          {abaAtual === 'participantes' ? (
            <>
              <fieldset className="mt-4 rounded-[10px] border border-border bg-card p-4">
                <legend className="px-1 text-sm font-medium text-foreground">Quem recebe</legend>
                <div className="mt-1 grid gap-1 text-sm">
                  <label className="flex min-h-11 items-start gap-2 py-2">
                    <input type="radio" name="quem-recebe" className="mt-0.5 size-4 accent-primary" checked={somenteCheckin} onChange={() => setSomenteCheckin(true)} />
                    <span><span className="text-foreground">Só quem esteve presente</span><span className="block text-xs text-muted-foreground">Ingresso com check-in feito</span></span>
                  </label>
                  <label className="flex min-h-11 items-start gap-2 py-2">
                    <input type="radio" name="quem-recebe" className="mt-0.5 size-4 accent-primary" checked={!somenteCheckin} onChange={() => setSomenteCheckin(false)} />
                    <span><span className="text-foreground">Todos com ingresso válido</span><span className="block text-xs text-muted-foreground">Com ou sem check-in (ingresso ativo ou usado)</span></span>
                  </label>
                </div>
              </fieldset>

              <div className="mb-3 mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <SectionTitle>Participantes</SectionTitle>
                <BotaoInativo className="min-h-11" onClick={emitirTodos} disabled={pendentes.length === 0} motivo="Ainda não há participantes aguardando certificado." loading={emitir.isPending}>
                  Emitir para todos ({pendentes.length})
                </BotaoInativo>
              </div>

              {elegiveis.length === 0 ? (
                <EmptyState
                  title={participantes.length === 0 ? 'Ninguém com ingresso válido ainda' : 'Ninguém fez check-in ainda'}
                  description={participantes.length === 0
                    ? 'Quem comprar ingresso para este evento aparece aqui.'
                    : 'Escolha "Todos com ingresso válido" para emitir antes do check-in.'}
                />
              ) : (
                <ul aria-label="Participantes elegíveis" className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
                  {elegiveis.map(p => {
                    const cert = emitidoDe.get(p.user_id)
                    return (
                      <li key={p.user_id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground" aria-hidden="true">{iniciais(p.nome)}</span>
                          <p className="min-w-0 truncate text-sm font-medium text-foreground">{p.nome}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <Badge variant="secondary">{p.checkin ? 'Check-in feito' : 'Sem check-in'}</Badge>
                          {cert ? (
                            <Badge variant="outline"><I.Liberado size={12} aria-hidden="true" />Emitido em {dataDe(cert.issued_at)}</Badge>
                          ) : (
                            <Button variant="outline" size="sm" className="min-h-11" onClick={() => emitirPara([p.user_id], 'Certificado emitido.')} disabled={emitir.isPending}>Emitir</Button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {participantesQ.data?.cortado && (
                <p className="mt-3 text-xs text-muted-foreground">Lista parcial: este evento tem mais de 1.000 ingressos válidos.</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">A emissão fica registrada com um código. O QR do certificado e o código impresso levam a uma página pública que confirma que ele é verdadeiro (nome, evento, data, organizador e carga horária; nada de e-mail, CPF ou telefone). Você pode enviar o certificado por e-mail ao participante (aba Emitidos); ele abre a página do certificado pelo link. Para baixar o PDF, abra a aba Emitidos.</p>
              <p className="mt-2 text-xs text-muted-foreground">O nome no certificado é o informado na compra do ingresso, que nem sempre é o de quem participou. Confira a lista antes de emitir.</p>
            </>
          ) : (
            <>
              <div className="mb-3 mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <SectionTitle>Certificados emitidos</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  <BotaoInativo variant="outline" className="min-h-11" onClick={exportar} disabled={emitidosTodos.length === 0} motivo="Nenhum certificado emitido ainda para exportar."><I.Baixar aria-hidden="true" />Exportar CSV</BotaoInativo>
                  <Button variant="outline" className="min-h-11" onClick={enviarEmailTodos} disabled={comNome.length === 0 || enviandoEmail !== null} loading={enviandoEmail === 'lote'}>
                    <I.Enviar aria-hidden="true" />Enviar por e-mail a todos ({comNome.length})
                  </Button>
                  {partes.map((parte, i) => (
                    <Button key={i} className="min-h-11" onClick={() => imprimir(parte.map(dadosDe))} disabled={esperandoLogo}>
                      <I.Imprimir aria-hidden="true" />{partes.length === 1 ? `Baixar PDF de todos (${parte.length})` : `Baixar PDF: ${i * LIMITES.loteMax + 1} a ${i * LIMITES.loteMax + parte.length}`}
                    </Button>
                  ))}
                </div>
              </div>
              {semNome > 0 && <p role="status" className="mb-3 text-xs text-muted-foreground">{semNome} {semNome === 1 ? 'certificado ficou' : 'certificados ficaram'} fora do PDF porque a pessoa não está mais na lista de participantes (nome indisponível). Eles continuam na lista e no CSV.</p>}
              {partes.length > 1 && <p className="mb-3 text-xs text-muted-foreground">O PDF em lote sai em partes de até {LIMITES.loteMax} certificados ({emitidos.length - semNome} no total), para o navegador não travar.</p>}
              {emitidos.length > 0 && <p className="mb-3 text-xs text-muted-foreground">O PDF abre o &quot;salvar como PDF&quot; do navegador (A4 paisagem, um certificado por folha). Escolha &quot;Salvar como PDF&quot; como impressora.</p>}
              {emitidosTodos.length > emitidos.length && <p className="mb-3 text-xs text-muted-foreground">{emitidos.length} {emitidos.length === 1 ? 'ativo' : 'ativos'} e {emitidosTodos.length - emitidos.length} {emitidosTodos.length - emitidos.length === 1 ? 'revogado' : 'revogados'}: os revogados ficam no histórico e saem do PDF, do e-mail e da contagem.</p>}
              {emitidosTodos.length === 0 ? (
                <EmptyState title="Nenhum certificado emitido ainda" description="Emita na aba Participantes; os emitidos aparecem aqui com o código." action={<Button variant="outline" className="min-h-11" onClick={() => mudaAba('participantes')}>Ir para Participantes</Button>} />
              ) : (
                <ul aria-label="Certificados emitidos" className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
                  {emitidosTodos.map(c => (
                    <li key={c.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{nomeEmitido(c)}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">Código {c.code} · emitido em {dataDe(c.issued_at)}</p>
                      </div>
                      {c.revoked_at ? (
                        <Badge variant="outline" className="shrink-0 text-muted-foreground">Revogado em {dataDe(c.revoked_at)}</Badge>
                      ) : (
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <BotaoInativo variant="outline" size="sm" className="min-h-11" onClick={() => imprimir([dadosDe(c)])} disabled={!nomeDe.has(c.user_id) || esperandoLogo} motivo={!nomeDe.has(c.user_id) ? 'Este participante não tem nome cadastrado; sem nome não dá para gerar o PDF.' : undefined} aria-label={`Baixar PDF de ${nomeEmitido(c)}`}><I.Imprimir aria-hidden="true" />PDF</BotaoInativo>
                        <Button variant="outline" size="sm" className="min-h-11" onClick={() => enviarEmail(c)} disabled={!nomeDe.has(c.user_id) || enviandoEmail !== null} loading={enviandoEmail === c.id} aria-label={`Enviar o certificado de ${nomeEmitido(c)} por e-mail`}><I.Enviar aria-hidden="true" />E-mail</Button>
                        <Button variant="ghost" size="sm" className={`min-h-11 ${icone}`} onClick={() => setRevogando({ id: c.id, nome: nomeEmitido(c) })} disabled={revogar.isPending} aria-label={`Revogar o certificado de ${nomeEmitido(c)}`}>Revogar</Button>
                      </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <section aria-labelledby="cert-breve" className="mt-8">
            <SectionTitle id="cert-breve">Em breve</SectionTitle>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <EmBreve titulo="Enviar por WhatsApp" descricao="Mandar o certificado para o participante pelo WhatsApp. Depende de integração própria; o envio por e-mail já funciona na aba Emitidos." acao="Enviar pelo WhatsApp" />
              <EmBreve titulo="Carga horária automática" descricao="Calcular as horas a partir do evento. Hoje você digita a carga horária no editor; falta definir de onde vem o número." acao="Calcular carga horária" />
              <EmBreve titulo="Emissão automática ao fim do evento" descricao="Emitir sozinho para quem fez check-in quando o evento termina. Precisa de uma rotina agendada no banco (SQL)." acao="Ativar emissão automática" />
              <EmBreve titulo="Lista acima de 1.000 ingressos" descricao="Hoje a lista para em 1.000 ingressos válidos. Precisa de uma função paginada no banco (RPC)." acao="Carregar todos" />
            </div>
          </section>
        </>
      )
    }

    corpo = (
      <>
        <div className="mb-6 grid gap-1.5 sm:max-w-sm">
          <Label htmlFor="cert-evento">Evento</Label>
          <select id="cert-evento" value={selectedEventId ?? ''} onChange={e => setPickedEventId(e.target.value || null)} className={`${selectNativo} min-h-11`}>
            {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
        {conteudo}
      </>
    )
  }

  return (
    <div>
      {cabecalho}
      {corpo}
      <AlertDialog open={!!revogando} onOpenChange={o => { if (!o) setRevogando(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar o certificado?</AlertDialogTitle>
            <AlertDialogDescription>
              O certificado de {revogando?.nome} deixa de valer: quem abrir o link ou o QR vê que ele foi revogado. A revogação fica registrada com a data, e você pode emitir outro certificado para a pessoa depois (com código novo).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Voltar</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={confirmarRevogar}>Revogar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {impressao && modeloVisual && (
        <ImpressaoCertificados key={impressao.id} itens={impressao.itens.map(dados => ({ dados }))} modelo={modeloComCor(modeloPorId(modeloVisual.selectedTemplate), modeloVisual.accentColor)}
          campos={modeloVisual.fields} logoUrl={logoDoPdf} sigUrl={modeloVisual.sigUrl} onFim={() => setImpressao(null)} />
      )}
    </div>
  )
}
