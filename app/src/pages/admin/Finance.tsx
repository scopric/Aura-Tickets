import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import gsap from 'gsap'
import * as I from '@/components/icones/evokaa16'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState, PageHeader, SectionTitle, Stat, chipAviso, chipErro, chipInfo, chipNeutro, chipOk, selectNativo } from '@/components/producer/ui'
import { Tabela, alertaAviso, alertaErro, painel, segmentoOn, segmentoOff, th, trilho } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { supabase } from '../../lib/supabase'
import { useAdminFinance } from '../../hooks/useAdminFinance'
import { TAXA_PERCENTUAL, TAXA_MINIMA } from '../../lib/taxa'
import { downloadCsv, toCsv, csvFilename, fetchAllRows } from '../../lib/exportCsv'

// Mapa de apresentação: a coluna `type` do banco (income/expense/withdrawal/refund/fee) para
// os três pesos que a tela soma (entrada, saída, comissão).
const typeSinal: Record<string, { sinal: '+' | '-' | ''; label: string; cls: string }> = {
  income: { sinal: '+', label: 'Venda', cls: 'text-[var(--ev-success)]' },
  withdrawal: { sinal: '-', label: 'Repasse', cls: 'text-destructive' },
  fee: { sinal: '', label: 'Comissão', cls: 'text-primary' },
  refund: { sinal: '-', label: 'Reembolso', cls: 'text-destructive' },
  expense: { sinal: '-', label: 'Despesa', cls: 'text-destructive' },
}

const withdrawStatus: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: chipAviso },
  processing: { label: 'Em processamento', cls: chipInfo },
  completed: { label: 'Pago', cls: chipOk },
  failed: { label: 'Falhou', cls: chipErro },
}

const brl = (n: number) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const quando = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const nomeProdutor = (p: { full_name: string | null; email: string | null } | null) =>
  p?.full_name || p?.email || 'Produtor sem perfil'

export default function AdminFinance() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { data, isLoading, isError, error } = useAdminFinance()

  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'withdraws' | 'tools'>('overview')

  // Filters
  const [txSearch, setTxSearch] = useState('')
  const [txFilterType, setTxFilterType] = useState<string>('all')


  const pronto = !isLoading && !isError // com erro não se mostra zero como se fosse número
  const orders = data?.orders ?? []
  const transactions = data?.transactions ?? []
  const withdrawals = data?.withdrawals ?? []

  const handleExportCSV = async (tabela: 'orders' | 'transactions' | 'withdrawals') => {
    const colunas: Record<string, string[]> = {
      orders: ['id', 'created_at', 'status', 'payment_method', 'total', 'customer_name', 'customer_email'],
      transactions: ['id', 'created_at', 'type', 'status', 'amount', 'description'],
      withdrawals: ['id', 'created_at', 'status', 'amount', 'pix_key', 'processed_at'],
    }
    try {
      const linhas = await fetchAllRows<Record<string, unknown>>((from, to) =>
        supabase.from(tabela).select(colunas[tabela].join(', ')).order('id').range(from, to)
      )
      if (linhas.length === 0) {
        toast.info('Não há registros para exportar nesta tabela.')
        return
      }
      downloadCsv(csvFilename(tabela), toCsv(linhas, colunas[tabela]))
      toast.success(`${linhas.length} linha(s) exportada(s).`)
    } catch (e: unknown) {
      toast.error('Falha ao exportar: ' + ((e as { message?: string } | null)?.message || 'erro desconhecido'))
    }
  }

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.fin-anim',
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: 'power2.out' }
      )
    }, containerRef)
    return () => ctx.revert()
  }, [activeTab])

  // Calculations — só o que está gravado no banco
  const pedidosPagos = orders.filter(o => o.status === 'paid')
  const grossSalesVolume = pedidosPagos.reduce((s, o) => s + Number(o.total || 0), 0)
  const totalPayouts = withdrawals.filter(w => w.status === 'completed').reduce((s, w) => s + Number(w.amount || 0), 0)
  const platformRevenue = transactions.filter(t => t.type === 'fee').reduce((s, t) => s + Number(t.amount || 0), 0)
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending')
  const comissoes = transactions.filter(t => t.type === 'fee')

  // Métodos de pagamento: contagem real dos pedidos pagos
  const metodos = ['pix', 'credit_card', 'boleto'].map(m => ({
    key: m,
    label: m === 'pix' ? 'PIX' : m === 'credit_card' ? 'Cartão de Crédito' : 'Boleto / Outros',
    count: pedidosPagos.filter(o => o.payment_method === m).length,
  }))
  const totalMetodos = pedidosPagos.length

  // Filter Transaction Extrato
  const filteredTransactions = transactions
    .filter(t => !txSearch
      || (t.description || '').toLowerCase().includes(txSearch.toLowerCase())
      || nomeProdutor(t.profiles).toLowerCase().includes(txSearch.toLowerCase()))
    .filter(t => txFilterType === 'all' || t.type === txFilterType)

  const aviso = (
    <div className={cn(alertaAviso, 'fin-anim mb-6 gap-3.5 p-4')}>
      <I.Alerta size={20} className="text-[var(--ev-warning)]" aria-hidden="true" />
      <div>
        <h4 className="text-xs font-semibold">Cobrança e repasses desativados até a Fase 4</h4>
        <p className="mt-0.5 text-xs leading-normal text-muted-foreground">
          A Evokaa ainda não tem gateway de pagamento. Saques, reembolsos e comissão não podem ser executados
          por aqui: aprovar um saque aqui só mudaria o texto na tela, sem mover dinheiro. Estes números são
          <strong> reais</strong> — o que estiver zerado é porque ainda não houve venda confirmada.
        </p>
      </div>
    </div>
  )

  const abas = [
    { id: 'overview', icon: I.Carteira, label: 'Visão Geral' },
    { id: 'transactions', icon: I.Relatorio, label: 'Extrato Comercial' },
    { id: 'withdraws', icon: I.Horario, label: `Repasses / Saques (${pendingWithdrawals.length})` },
    { id: 'tools', icon: I.Configuracoes, label: 'Taxas' },
  ] as const

  return (
    <div ref={containerRef} className="p-6 lg:p-10 max-w-7xl">
      <PageHeader title="Financeiro" description="Visão geral do volume financeiro, comissões coletadas e moderação de repasses." />

      <div className={cn(trilho, 'mb-6 w-fit')} role="group" aria-label="Seções do financeiro">
        {abas.map(a => (
          <button key={a.id} type="button" onClick={() => setActiveTab(a.id)} aria-pressed={activeTab === a.id} className={activeTab === a.id ? segmentoOn : segmentoOff}>
            <a.icon aria-hidden="true" /> {a.label}
          </button>
        ))}
      </div>

      {isError && (
        <div role="alert" className={cn('fin-anim mb-6', alertaErro)}>
          Não foi possível carregar os dados financeiros: {(error as Error)?.message || 'erro desconhecido'}
        </div>
      )}

      {!isError && aviso}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner className="size-8 text-primary" />
        </div>
      )}

      {/* Financial KPIs */}
      {pronto && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Volume Geral de Vendas (GMV)', value: brl(grossSalesVolume), change: `${pedidosPagos.length} pedido(s) pago(s)` },
          { label: 'Receita Líquida (Plataforma)', value: brl(platformRevenue), change: 'Comissões lançadas' },
          { label: 'Repasses Efetuados (Saques)', value: brl(totalPayouts), change: 'Saques concluídos' },
          { label: 'Repasses Pendentes', value: brl(pendingWithdrawals.reduce((s, w) => s + Number(w.amount || 0), 0)), change: `${pendingWithdrawals.length} pedido(s)` },
        ].map(k => (
          <div key={k.label} className="fin-anim">
            <Stat label={k.label} value={k.value} hint={k.change} />
          </div>
        ))}
      </div>
      )}

      {activeTab === 'overview' && pronto && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pedidos pagos — a curva só existe depois que o gateway confirmar venda */}
          <div className="lg:col-span-2 space-y-6">
            <div className={cn('fin-anim p-6', painel)}>
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <SectionTitle>Pedidos pagos</SectionTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">Pedidos com status <span className="font-mono">paid</span> no banco.</p>
                </div>
                <Badge variant="secondary" className={chipInfo}>
                  {pedidosPagos.length} no total
                </Badge>
              </div>

              {pedidosPagos.length === 0 ? (
                <EmptyState
                  title="Nenhum pedido pago até agora."
                  description={<>Enquanto o gateway não estiver publicado, todo pedido nasce <span className="font-mono">pending</span> e nenhum valor entra aqui.</>}
                />
              ) : (
                <Tabela label="Pedidos pagos">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={th}>Pedido</th>
                      <th className={cn(th, 'hidden sm:table-cell')}>Evento</th>
                      <th className={th}>Comprador</th>
                      <th className={cn(th, 'text-right')}>Valor</th>
                      <th className={cn(th, 'text-right')}>Quando</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pedidosPagos.map(o => (
                      <tr key={o.id} className="transition-colors hover:bg-secondary/60">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{o.events?.title || '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{o.customer_name || o.customer_email || '—'}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums text-foreground">{brl(o.total)}</td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">{quando(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              )}
            </div>

            {/* Withdraw review warning */}
            {pendingWithdrawals.length > 0 && (
              <div className={cn(alertaAviso, 'fin-anim gap-3.5 p-4')}>
                <I.Alerta size={20} className="text-[var(--ev-warning)]" aria-hidden="true" />
                <div>
                  <h4 className="text-xs font-semibold">{pendingWithdrawals.length} Solicitação(ões) de Repasse Pendente(s)</h4>
                  <p className="mt-0.5 text-xs leading-normal text-muted-foreground">
                    Produtores pediram resgate de {brl(pendingWithdrawals.reduce((s, w) => s + Number(w.amount || 0), 0))}.
                    A liberação bancária está desligada até a Fase 4; a aba Repasses mostra a fila para conference.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('withdraws')}
                    className="mt-2 flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Ir para Repasses <I.SetaDireita size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Payment Methods & Categories (Right Col) */}
          <div className="space-y-6">
            {/* Payment Method share */}
            <div className={cn('fin-anim p-6', painel)}>
              <h3 className="mb-5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Meios de Pagamento Utilizados</h3>

              <div className="space-y-4">
                {metodos.map(m => {
                  const share = totalMetodos > 0 ? Math.round((m.count / totalMetodos) * 100) : 0
                  const cor = m.key === 'pix' ? 'bg-[var(--ev-success)]' : m.key === 'credit_card' ? 'bg-primary' : 'bg-[var(--ev-warning)]'
                  return (
                    <div key={m.key} className="flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <span className={`size-2 rounded-full ${cor}`} />
                          {m.label}
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div className={`h-full rounded-full ${cor}`} style={{ width: `${share}%` }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold tabular-nums text-foreground">{share}%</span>
                      </div>
                    </div>
                  )
                })}
                {totalMetodos === 0 && (
                  <p className="pt-2 text-xs italic leading-relaxed text-muted-foreground">
                    Sem pedidos pagos ainda, não há distribuição por meio de pagamento. A leitura vem de
                    <span className="font-mono"> orders.status = 'paid'</span>.
                  </p>
                )}
              </div>
            </div>

            {/* Commissions policy info */}
            <div className={cn('fin-anim space-y-3 p-5', painel)}>
              <h3 className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"><I.Atualizar size={14} aria-hidden="true" /> Política de Taxação</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                A taxa está fixa no sistema (veja a aba <strong>Taxas</strong>). A comissão passa a ser lançada em <span className="font-mono">transactions</span>
                quando o gateway confirmar o pagamento, na Fase 4.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && pronto && (
        <div className={cn('fin-anim overflow-hidden', painel)}>
          {/* Filters Bar */}
          <div className="flex flex-col items-center justify-between gap-4 border-b border-border bg-secondary/50 p-4 md:flex-row">
            <div className="relative w-full md:max-w-xs">
              <I.Buscar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Buscar por descrição ou produtor..."
                aria-label="Buscar por descrição ou produtor"
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
              <select
                value={txFilterType}
                onChange={e => setTxFilterType(e.target.value)}
                aria-label="Filtrar por tipo de operação"
                className={cn(selectNativo, 'w-auto')}
              >
                <option value="all">Todas Operações</option>
                {Object.entries(typeSinal).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Transactions List */}
          <Tabela label="Extrato comercial">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className={th}>Código</th>
                <th className={th}>Operação</th>
                <th className={cn(th, 'hidden sm:table-cell')}>Produtor</th>
                <th className={cn(th, 'hidden md:table-cell')}>Situação</th>
                <th className={th}>Data/Hora</th>
                <th className={cn(th, 'text-right')}>Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <EmptyState
                      title={transactions.length === 0
                        ? 'Nenhum lançamento em transactions. A comissão e os repasses passam a ser gravados aqui quando o gateway for publicado (Fase 4).'
                        : 'Nenhum lançamento encontrado para os filtros selecionados.'}
                    />
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => {
                  const cfg = typeSinal[tx.type] || { sinal: '', label: tx.type, cls: 'text-muted-foreground' }
                  const Icon = tx.type === 'income' ? I.SetaDiagonalCima : tx.type === 'fee' ? I.Cartao : I.SetaDiagonalBaixo
                  return (
                    <tr key={tx.id} className="transition-colors hover:bg-secondary/60">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{tx.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary ${cfg.cls}`}>
                            <Icon size={14} aria-hidden="true" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-foreground">{tx.description || cfg.label}</span>
                            <div className="text-xs text-muted-foreground">{cfg.label}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{nomeProdutor(tx.profiles)}</td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <Badge variant="secondary" className={cn(chipNeutro, 'uppercase')}>{tx.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">{quando(tx.created_at)}</td>
                      <td className={`px-4 py-3 text-right text-xs font-semibold tabular-nums ${cfg.cls}`}>
                        {cfg.sinal}{brl(tx.amount)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Tabela>
        </div>
      )}

      {activeTab === 'withdraws' && pronto && (
        <div className={cn('fin-anim overflow-hidden', painel)}>
          <div className="border-b border-border bg-secondary/50 p-4">
            <SectionTitle>Solicitações Bancárias de Repasses</SectionTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Fila real de saques pedidos pelos produtores. A liberação Pix fica desligada até a Fase 4.</p>
          </div>

          <Tabela label="Solicitações de repasse">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Produtor / Contato</th>
                <th className={th}>Chave Pix</th>
                <th className={th}>Data da Solicitação</th>
                <th className={th}>Status</th>
                <th className={cn(th, 'text-right')}>Valor</th>
                <th className={th}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <EmptyState title="Nenhuma solicitação de saque registrada na plataforma." />
                  </td>
                </tr>
              ) : (
                withdrawals.map(w => {
                  const sc = withdrawStatus[w.status] || { label: w.status, cls: chipNeutro }
                  const banco = (w.bank_account?.bank_name || w.bank_account?.bankName) as string | undefined
                  return (
                    <tr key={w.id} className="transition-colors hover:bg-secondary/60">
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-foreground">{nomeProdutor(w.profiles)}</div>
                        <div className="text-xs text-muted-foreground">{w.profiles?.email || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                          <I.Empresa size={14} className="text-muted-foreground" aria-hidden="true" /> {w.pix_key || 'Chave não informada'}
                        </div>
                        {banco && <div className="text-xs text-muted-foreground">{banco}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">{quando(w.created_at)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={sc.cls}>{sc.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-foreground">{brl(w.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled
                          title="Aprovação e rejeição de saque só serão liberadas com o gateway de pagamento (Fase 4)"
                        >
                          Liberação manual desligada
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Tabela>
        </div>
      )}

      {activeTab === 'tools' && pronto && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 fin-anim animate-fadeIn">
          {/* Painel de Configuração de Comissões e Taxas */}
          <div className="lg:col-span-2 space-y-6">
            <div className={cn('space-y-6 p-6', painel)}>
              <div>
                <SectionTitle>Taxa de serviço</SectionTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Taxa de serviço cobrada do comprador; ingresso gratuito não paga taxa.</p>
              </div>

              <p className="text-sm text-foreground">
                Taxa de serviço: {TAXA_PERCENTUAL}% do preço do ingresso, mínimo {brl(TAXA_MINIMA)}, paga pelo comprador. Prazos de repasse: ainda não definidos (dependem do gateway).
              </p>
            </div>

            {/* Comissões: só o que está lançado no banco */}
            <div className={cn('space-y-4 p-6', painel)}>
              <div>
                <SectionTitle>Demonstrativo de Comissões Coletadas</SectionTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Lançamentos de tipo <span className="font-mono">fee</span> em <span className="font-mono">transactions</span>.</p>
              </div>

              <Tabela label="Comissões coletadas">
                <thead>
                  <tr className="border-b border-border">
                    <th className={th}>Comissão</th>
                    <th className={cn(th, 'hidden sm:table-cell')}>Produtor</th>
                    <th className={th}>Lançamento</th>
                    <th className={cn(th, 'text-right')}>Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {comissoes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4">
                        <EmptyState title="Nenhuma comissão lançada. Elas passam a existir quando o gateway confirmar um pagamento." />
                      </td>
                    </tr>
                  ) : (
                    comissoes.map(c => (
                      <tr key={c.id} className="transition-colors hover:bg-secondary/60">
                        <td className="px-4 py-3 font-mono font-semibold text-foreground">{c.id.slice(0, 8)}</td>
                        <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{nomeProdutor(c.profiles)}</td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{quando(c.created_at)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">{brl(c.amount)}</td>
                      </tr>
                    ))
                  )}
                  <tr className="border-t border-border bg-secondary font-semibold">
                    <td className="px-4 py-3 text-foreground" colSpan={3}>Total em comissões</td>
                    <td className="px-4 py-3 text-right tabular-nums text-primary">{brl(platformRevenue)}</td>
                  </tr>
                </tbody>
              </Tabela>
            </div>
          </div>

          {/* Ferramentas de Exportação e Auditoria lateral */}
          <div className="space-y-6">
            <div className={cn('space-y-4 p-6', painel)}>
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Exportar Relatórios</h3>
              <p className="text-xs leading-normal text-muted-foreground">Baixa o CSV direto do banco, com todas as linhas da tabela.</p>

              <div className="space-y-2 pt-2">
                {([
                  ['orders', 'Relatório de Pedidos (.csv)'],
                  ['transactions', 'Relatório de Transações (.csv)'],
                  ['withdrawals', 'Relatório de Saques (.csv)'],
                ] as const).map(([tabela, label]) => (
                  <Button
                    key={tabela}
                    type="button"
                    variant="outline"
                    onClick={() => handleExportCSV(tabela)}
                    className="w-full justify-between"
                  >
                    <span>{label}</span>
                    <I.Baixar size={16} className="text-muted-foreground" aria-hidden="true" />
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
