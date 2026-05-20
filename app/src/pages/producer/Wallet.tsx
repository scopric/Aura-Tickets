import { useState } from 'react'
import { Wallet, ArrowUpRight, ArrowDownLeft, Landmark, Plus, QrCode, Copy, Check } from 'lucide-react'

export default function ProducerWallet() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const transactions = [
    { id: '1', desc: 'Venda - Noite Eletro 2025', amount: 2840, date: '14 Mai', type: 'in' },
    { id: '2', desc: 'Saque para conta bancaria', amount: -5000, date: '13 Mai', type: 'out' },
    { id: '3', desc: 'Venda - Jazz Sunset', amount: 960, date: '13 Mai', type: 'in' },
    { id: '4', desc: 'Taxa de plataforma', amount: -380, date: '12 Mai', type: 'out' },
    { id: '5', desc: 'Venda - Feira de Arte', amount: 540, date: '11 Mai', type: 'in' },
  ]

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
          <div className="font-serif text-5xl text-cream mb-4">R$ 12.840,00</div>
          <div className="flex items-center gap-4">
            <button className="px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
              Sacar
            </button>
            <button className="px-5 py-2.5 bg-white/10 text-cream text-sm font-medium rounded-full hover:bg-white/20 transition-all">
              Historico
            </button>
          </div>
        </div>
      </div>

      {/* Bank Accounts */}
      <div className="mb-8">
        <h2 className="font-serif text-xl text-espresso mb-4">Contas Bancarias</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-xl bg-plum/10 flex items-center justify-center">
              <Landmark className="w-5 h-5 text-plum" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-espresso">Banco do Brasil</div>
              <div className="text-xs text-espresso/40">Ag 1234 · CC 56789-0</div>
            </div>
            <span className="px-3 py-1 text-xs bg-green-100 text-green-600 rounded-full font-medium">Principal</span>
          </div>
          <button className="flex items-center gap-3 p-4 w-full border border-dashed border-espresso/15 rounded-2xl text-sm text-espresso/40 hover:text-plum hover:border-plum/30 transition-all">
            <Plus className="w-4 h-4" />
            Adicionar conta
          </button>
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
            <div className="text-sm text-espresso font-mono truncate">contato@aura-eventos.com.br</div>
            <div className="text-xs text-espresso/40">Chave de e-mail</div>
          </div>
          <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-espresso/5 text-espresso/30 hover:text-plum transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-espresso/5">
          <h2 className="font-serif text-xl text-espresso">Movimentacoes</h2>
        </div>
        <div className="divide-y divide-espresso/5">
          {transactions.map(t => (
            <div key={t.id} className="flex items-center gap-4 p-4 px-6 hover:bg-white/40 transition-colors">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${t.type === 'in' ? 'bg-green-100' : 'bg-red-100'}`}>
                {t.type === 'in' ? <ArrowDownLeft className="w-4 h-4 text-green-600" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-espresso font-medium truncate">{t.desc}</div>
                <div className="text-xs text-espresso/40">{t.date}</div>
              </div>
              <div className={`text-sm font-medium ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {t.amount > 0 ? '+' : ''}R$ {Math.abs(t.amount).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
