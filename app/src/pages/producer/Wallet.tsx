import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'

// Saldo, repasse e saque dependem do gateway: transactions e withdrawals seguem sem acesso do produtor
// (Decisão 113). Nada aqui lê nem grava essas tabelas; a tela diz o que ainda não existe.
export default function ProducerWallet() {
  return (
    <div>
      <PageHeader title="Carteira" description="Saldo para saque e repasses da Evokaa" />

      <div className="rounded-[10px] border border-border bg-card p-4 sm:p-6">
        <p className="text-[13px] text-muted-foreground">Saldo disponível</p>
        <p className="mt-1 text-[28px] font-semibold leading-tight tabular-nums text-muted-foreground"><span aria-hidden="true">—</span><span className="sr-only">Ainda indisponível</span></p>
        <p className="mt-3 text-sm text-foreground">Os valores do repasse aparecem quando o pagamento estiver ligado.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button disabled aria-describedby="carteira-saque">Sacar</Button>
          <p id="carteira-saque" className="text-sm text-muted-foreground">
            O saque fica disponível junto com o pagamento. Nenhum pedido de saque é registrado por enquanto.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-[10px] border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">Vendas dos seus eventos</h2>
          <p className="mt-1 text-sm text-muted-foreground">O valor bruto dos pedidos pagos já aparece no Financeiro.</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/producer/finance">Abrir o Financeiro</Link>
          </Button>
        </div>
        <div className="rounded-[10px] border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">Dados para receber</h2>
          <p className="mt-1 text-sm text-muted-foreground">Banco e chave Pix ficam em Configurações, na aba Pagamento.</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/producer/settings">Abrir as Configurações</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
