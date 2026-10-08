import * as I from '@/components/icones/evokaa16'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useProducerEvents } from '../../hooks/useEvents'
import { useEventoDaUrl } from '../../hooks/useEventoDaUrl'
import { brl } from '../../lib/taxa'
import { toCsv, downloadCsv, fetchAllRows, slugArquivo } from '../../lib/exportCsv'
import { diaBR } from '../../lib/visaoEvento'
import { baixarBorderoXlsx, baixarPdf } from '../../lib/exportar'
import { forma, dataBR, resumoBordero, type PedidoPago, type IngressoDoTipo } from '../../lib/bordero'
import { PageHeader, Stat, EmptyState, SectionTitle, selectNativo } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const virgula = (n: number) => n.toFixed(2).replace('.', ',')

// Borderô do evento (E5): pedidos pagos e ingressos que o banco já grava, de um evento só. Colunas escolhidas uma a uma:
// nada de select('*') nem de CPF e telefone (orders e tickets guardam dado pessoal; o documento não leva).
export default function ProducerBordero() {
  const eventos = useProducerEvents()
  const lista = eventos.data ?? []
  const [eventId, trocar] = useEventoDaUrl(lista.map(e => e.id))
  const evento = lista.find(e => e.id === eventId)
  const { user } = useAuth()
  // logo e nome do produtor para o cabeçalho do PDF; falhar aqui só tira a logo (o PDF não depende dela)
  const perfil = useQuery({
    queryKey: ['bordero-perfil', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // ponytail: os tipos do banco ainda não têm logo_url; cast até regenerar types/database.ts
      const { data } = await supabase.from('producer_profiles').select('company_name, logo_url' as never).eq('id', user!.id).maybeSingle()
      return (data as unknown as { company_name: string | null; logo_url: string | null } | null) ?? null
    },
  })

  const dados = useQuery({
    queryKey: ['producer-bordero', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      // ponytail: soma no navegador, de 1.000 em 1.000 linhas; vira RPC quando a F2 gravar as taxas
      const [pedidos, ingressos] = await Promise.all([
        fetchAllRows<PedidoPago>((de, ate) =>
          supabase.from('orders')
            .select('id, total, payment_method, created_at, subtotal, discount, service_fee, processing_fee')
            .eq('event_id', eventId!).eq('status', 'paid')
            .order('created_at', { ascending: false }).order('id')
            .range(de, ate) as unknown as PromiseLike<{ data: PedidoPago[] | null; error: unknown }>),
        fetchAllRows<IngressoDoTipo>((de, ate) =>
          supabase.from('tickets')
            .select('id, ticket_type_id, status, checked_in_at, ticket_types(name)')
            .eq('event_id', eventId!).in('status', ['active', 'used'])
            .order('created_at', { ascending: false }).order('id')
            .range(de, ate) as unknown as PromiseLike<{ data: IngressoDoTipo[] | null; error: unknown }>),
      ])
      // pedido ou ingresso novo no meio da paginação desloca as páginas e repetiria uma linha: um por id
      return { pedidos: [...new Map(pedidos.map(p => [p.id, p])).values()], ingressos: [...new Map(ingressos.map(t => [t.id, t])).values()] }
    },
  })

  const r = dados.data ? resumoBordero(dados.data.pedidos, dados.data.ingressos) : null

  const [pessoais, setPessoais] = useState(false)
  const [gerando, setGerando] = useState<'xlsx' | 'pdf' | null>(null)
  const nomeBase = `evokaa-bordero-${slugArquivo(evento?.title, eventId ?? '')}-${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })}`
  const m = (v: number | null | undefined) => brl(Number(v) || 0)

  const exportar = () => downloadCsv(`${nomeBase}.csv`, toCsv(
    dados.data!.pedidos.map(p => ({
      pedido: p.id, data: dataBR(diaBR(p.created_at)), forma: forma(p.payment_method),
      ingressos: virgula(Number(p.subtotal) || 0), desconto: virgula(Number(p.discount) || 0),
      taxa_servico: virgula(Number(p.service_fee) || 0), taxa_pagamento: virgula(Number(p.processing_fee) || 0), total: virgula(Number(p.total) || 0),
    })),
    ['pedido', 'data', 'forma', 'ingressos', 'desconto', 'taxa_servico', 'taxa_pagamento', 'total'],
  ))

  const exportarXlsx = async () => {
    setGerando('xlsx')
    try { await baixarBorderoXlsx(eventId!, pessoais, `${nomeBase}${pessoais ? '-com-dados-pessoais' : ''}.xlsx`) }
    catch (e) { toast.error((e as Error).message) }
    finally { setGerando(null) }
  }

  const exportarPdf = async () => {
    if (!r || !evento) return
    setGerando('pdf')
    try {
      const perfilPdf = perfil.data !== undefined ? perfil.data : (await perfil.refetch()).data // clicou antes de a logo chegar
      await baixarPdf({
        arquivo: `${nomeBase}.pdf`, titulo: 'Borderô', evento: evento.title, produtora: perfilPdf?.company_name || undefined, logoProdutor: perfilPdf?.logo_url,
        resumo: [['Pedidos pagos', String(r.nPedidos)], ['Total pago pelos compradores', brl(r.total)], ...r.porForma.map(f => [`Forma: ${f.chave}`, brl(f.total)] as [string, string])],
        colunas: [{ titulo: 'Pedido', chave: 'pedido' }, { titulo: 'Data', chave: 'data' }, { titulo: 'Forma', chave: 'forma' }, { titulo: 'Ingressos', chave: 'ingressos', direita: true }, { titulo: 'Desconto', chave: 'desconto', direita: true }, { titulo: 'Taxa serviço', chave: 'servico', direita: true }, { titulo: 'Taxa pagto.', chave: 'pagto', direita: true }, { titulo: 'Total', chave: 'total', direita: true }],
        linhas: dados.data!.pedidos.map(p => ({ pedido: p.id.slice(0, 8).toUpperCase(), data: dataBR(diaBR(p.created_at)), forma: forma(p.payment_method), ingressos: m(p.subtotal), desconto: m(p.discount), servico: m(p.service_fee), pagto: m(p.processing_fee), total: m(p.total) })),
      })
    } catch { toast.error('Não consegui gerar o PDF. Tente de novo em instantes.') }
    finally { setGerando(null) }
  }

  const header = (
    <PageHeader
      title="Borderô"
      description={evento ? `Vendas pagas de ${evento.title}` : 'Vendas pagas de um evento'}
      actions={
        <>
          <Button variant="outline" onClick={exportarXlsx} loading={gerando === 'xlsx'} disabled={!dados.data?.pedidos.length || !!gerando}>
            <I.Baixar aria-hidden="true" />Planilha (XLSX)
          </Button>
          <Button variant="outline" onClick={exportarPdf} loading={gerando === 'pdf'} disabled={!dados.data?.pedidos.length || !!gerando}>
            <I.Imprimir aria-hidden="true" />PDF
          </Button>
          <Button variant="outline" onClick={exportar} disabled={!dados.data?.pedidos.length || !!gerando}>
            <I.Baixar aria-hidden="true" />CSV
          </Button>
        </>
      }
    />
  )

  const erro = (texto: string, tentar: () => void, buscando: boolean) => (
    <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-foreground">{texto}</p>
      <Button variant="outline" size="sm" className="print:hidden" onClick={tentar} loading={buscando}>Tentar de novo</Button>
    </div>
  )

  const seletor = (
    <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
      <label htmlFor="bordero-evento" className="text-sm text-muted-foreground">Evento</label>
      <select
        id="bordero-evento"
        value={eventId ?? ''}
        onChange={e => trocar(e.target.value)}
        className={cn(selectNativo, 'w-auto min-w-48 max-w-full')}
      >
        {!eventId && <option value="" disabled>Escolha um evento</option>}
        {lista.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
      </select>
    </div>
  )

  const aviso = (
    <div className="mb-6 rounded-[10px] border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">A planilha traz 8 abas: resumo, finanças, canais, tipos de ingresso, check-ins, vendas por dia, pedidos e ingressos.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        O total é o que o comprador pagou, com as taxas dentro. <span className="font-medium text-foreground">Em breve:</span> parcelas, repasse, reembolso por pedido, meia-entrada contra os 40%, canal (balcão, cortesia, afiliado), despesas e resultado, link de leitura e envio agendado.
      </p>
      <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={pessoais} onChange={e => setPessoais(e.target.checked)} className="size-4" />
        Incluir nome e e-mail dos compradores na planilha (dados pessoais, uso restrito)
      </label>
    </div>
  )

  let corpo
  if (eventos.isPending || (eventId && dados.isPending)) {
    corpo = (
      <div aria-busy="true">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[1, 2].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}</div>
        <Skeleton className="mt-6 h-48 rounded-[10px] bg-muted" />
      </div>
    )
  } else if (eventos.isError) {
    corpo = erro('Não foi possível carregar seus eventos.', () => eventos.refetch(), eventos.isFetching)
  } else if (lista.length === 0) {
    corpo = <EmptyState title="Você ainda não tem eventos" description="Crie um evento para ver o borderô dele aqui." />
  } else if (!eventId) {
    corpo = <EmptyState title="Escolha um evento" description="O borderô é de um evento por vez." />
  } else if (dados.isError || !r) {
    corpo = erro('Não foi possível carregar as vendas deste evento.', () => dados.refetch(), dados.isFetching)
  } else {
    corpo = (
      <>
        {r.nPedidos === 0 ? (
          <EmptyState title="Sem vendas pagas ainda" description="O borderô se preenche quando a venda for ligada." />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Stat label="Total pago pelo comprador (com taxa)" value={brl(r.total)} />
              <Stat label="Pedidos pagos" value={r.nPedidos.toLocaleString('pt-BR')} />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Lista id="bordero-forma" titulo="Por forma de pagamento" itens={r.porForma.map(f => ({ chave: f.chave, nome: f.chave, detalhe: `${f.pedidos} ${f.pedidos === 1 ? 'pedido' : 'pedidos'}`, valor: brl(f.total) }))} />
              <Lista id="bordero-dia" titulo="Vendas por dia" itens={r.porDia.map(d => ({ chave: d.chave, nome: dataBR(d.chave), detalhe: `${d.pedidos} ${d.pedidos === 1 ? 'pedido' : 'pedidos'}`, valor: brl(d.total) }))} />
            </div>
          </>
        )}
        {r.porTipo.length > 0 && (
          <div className="mt-6">
            <Lista id="bordero-tipo" titulo="Ingressos por tipo" itens={r.porTipo.map(t => ({ chave: t.id, nome: t.nome, detalhe: `${t.checkins} ${t.checkins === 1 ? 'check-in' : 'check-ins'}`, valor: `${t.validos} ${t.validos === 1 ? 'válido' : 'válidos'}` }))} />
          </div>
        )}
      </>
    )
  }

  return (
    <div>
      {header}
      {seletor}
      {aviso}
      {corpo}
    </div>
  )
}

function Lista({ id, titulo, itens }: { id: string; titulo: string; itens: { chave: string; nome: string; detalhe: string; valor: string }[] }) {
  return (
    <section aria-labelledby={id} className="rounded-[10px] border border-border bg-card">
      <div className="border-b border-border px-4 py-3"><SectionTitle id={id}>{titulo}</SectionTitle></div>
      <ul className="divide-y divide-border">
        {itens.map(i => (
          <li key={i.chave} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{i.nome}</p>
              <p className="text-xs text-muted-foreground">{i.detalhe}</p>
            </div>
            <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">{i.valor}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
