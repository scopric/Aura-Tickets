import { useState } from 'react'
import { Wallet, ArrowUpRight, ArrowDownLeft, Landmark, Plus, QrCode, Copy, Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  useProducerTransactions,
  useProducerWithdrawals,
  useRequestWithdrawal,
} from '../../hooks/useProducerWallet'
import { useAuth } from '../../hooks/useAuth'

export default function ProducerWallet() {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawPixKey, setWithdrawPixKey] = useState('')

  const { data: transactions = [], isLoading: isLoadingTx } = useProducerTransactions()
  const { data: withdrawals = [], isLoading: isLoadingWd } = useProducerWithdrawals()
  const requestWithdrawal = useRequestWithdrawal()

  // Calcular saldo: income - expense - withdrawal - refund - fee
  const balance = transactions.reduce((sum, t) => {
    if (t.type === 'income') return sum + t.amount
    if (['expense', 'withdrawal', 'refund', 'fee'].includes(t.type)) return sum - t.amount
    return sum
  }, 0)

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount)
    if (!amount || amount <= 0) {
      toast.error('Informe um valor valido')
      return
    }
    if (amount > balance) {
      toast.error('Saldo insuficiente')
      return
    }
    if (!withdrawPixKey.trim()) {
      toast.error('Informe uma chave PIX')
      return
    }

    try {
      await requestWithdrawal.mutateAsync({ amount, pixKey: withdrawPixKey.trim() })
      toast.success('Solicitacao de saque enviada!')
      setShowWithdrawModal(false)
      setWithdrawAmount('')
      setWithdrawPixKey('')
    } catch {
      toast.error('Erro ao solicitar saque')
    }
  }

  const isLoading = isLoadingTx || isLoadingWd

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
    })
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Carteira</h1>
        <p className="text-sm text-espresso/50 mt-1">Gerencie seus fundos e saques</p>
      </div>

      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-void text-cream p-8 mb-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-plum/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-cream/50" />
            <span className="text-sm text-cream/50">Saldo disponivel</span>
          </div>
          <div className="font-serif text-5xl text-cream mb-4">
            {isLoading ? (
              <Loader2 className="w-10 h-10 animate-spin" />
            ) : (
              `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all disabled:opacity-50"
              disabled={isLoading || balance <= 0}
            >
              Sacar
            </button>
          </div>
        </div>
      </div>

      {/* Pix Key */}
      <div className="mb-8 p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
        <h2 className="font-serif text-xl text-espresso mb-4">Chave Pix</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-plum/10 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-plum" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-espresso font-mono truncate">
              {user?.email || 'contato@evokaa.com.br'}
            </div>
            <div className="text-xs text-espresso/40">Chave de e-mail</div>
          </div>
          <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-espresso/5 text-espresso/30 hover:text-plum transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Withdrawals */}
      {withdrawals.length > 0 && (
        <div className="mb-8 bg-white/60 border border-white/60 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-espresso/5">
            <h2 className="font-serif text-xl text-espresso">Saques</h2>
          </div>
          <div className="divide-y divide-espresso/5">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center gap-4 p-4 px-6 hover:bg-white/40 transition-colors">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-espresso font-medium truncate">
                    Saque {w.status === 'pending' ? '- Pendente' : w.status === 'completed' ? '- Concluido' : '- ' + w.status}
                  </div>
                  <div className="text-xs text-espresso/40">{formatDate(w.created_at)}</div>
                </div>
                <div className="text-sm font-medium text-amber-600">
                  -R$ {w.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-espresso/5">
          <h2 className="font-serif text-xl text-espresso">Movimentacoes</h2>
        </div>
        {isLoading ? (
          <div className="p-10 text-center">
            <Loader2 className="w-8 h-8 text-plum animate-spin mx-auto mb-3" />
            <p className="text-sm text-espresso/40">Carregando movimentacoes...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-espresso/40">Nenhuma movimentacao ainda.</p>
          </div>
        ) : (
          <div className="divide-y divide-espresso/5">
            {transactions.map((t) => {
              const isIn = t.type === 'income'
              return (
                <div key={t.id} className="flex items-center gap-4 p-4 px-6 hover:bg-white/40 transition-colors">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isIn ? 'bg-green-100' : 'bg-red-100'}`}>
                    {isIn ? <ArrowDownLeft className="w-4 h-4 text-green-600" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-espresso font-medium truncate">
                      {t.description || (t.events?.title || 'Transacao')}
                    </div>
                    <div className="text-xs text-espresso/40">{formatDate(t.created_at)}</div>
                  </div>
                  <div className={`text-sm font-medium ${isIn ? 'text-green-600' : 'text-red-500'}`}>
                    {isIn ? '+' : '-'}R$ {Math.abs(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-canvas rounded-2xl border border-white/60 shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl text-espresso">Solicitar Saque</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="p-1 rounded-lg hover:bg-espresso/5 text-espresso/40">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-espresso/50 mb-1 block">Valor (R$)</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30"
                />
              </div>
              <div>
                <label className="text-xs text-espresso/50 mb-1 block">Chave PIX</label>
                <input
                  type="text"
                  value={withdrawPixKey}
                  onChange={(e) => setWithdrawPixKey(e.target.value)}
                  placeholder="Email, CPF, celular ou chave aleatoria"
                  className="w-full px-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30"
                />
              </div>
              <button
                onClick={handleWithdraw}
                disabled={requestWithdrawal.isPending}
                className="w-full py-3 bg-plum text-cream text-sm font-medium rounded-xl hover:shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {requestWithdrawal.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirmar Saque
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
