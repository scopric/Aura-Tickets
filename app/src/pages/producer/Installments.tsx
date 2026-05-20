import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft, CreditCard, ToggleLeft, ToggleRight,
  DollarSign, Info, CheckCircle2, Users, TrendingUp
} from 'lucide-react'
import { toast } from 'sonner'

interface InstallmentConfig {
  enabled: boolean
  maxInstallments: number
  minValue: number
  feeAbsorbed: boolean
  feePercentage: number
  interestFree: boolean
  availableMethods: string[]
}

export default function Installments() {
  const [config, setConfig] = useState<InstallmentConfig>({
    enabled: true,
    maxInstallments: 12,
    minValue: 50,
    feeAbsorbed: false,
    feePercentage: 4.49,
    interestFree: true,
    availableMethods: ['credit_card'],
  })

  const [previewPrice, setPreviewPrice] = useState(150)

  const monthlyFee = config.interestFree
    ? config.feePercentage
    : config.feePercentage + (config.maxInstallments <= 3 ? 0 : config.maxInstallments <= 6 ? 1.5 : 3)

  const getInstallmentValue = (installments: number) => {
    const totalWithFee = previewPrice * (1 + monthlyFee / 100)
    return (totalWithFee / installments).toFixed(2)
  }

  const handleSave = () => {
    toast.success('Configuracao de parcelamento salva!')
  }

  const installmentOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(n => n <= config.maxInstallments)

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/dashboard" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-espresso">Parcelamento</h1>
          <p className="text-sm text-espresso/50 mt-1">Ofereca parcelamento sem juros para seus compradores</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Conversao', value: '+40%', icon: TrendingUp, color: '#22c55e', desc: 'com parcelamento' },
          { label: 'Ticket Medio', value: '+65%', icon: DollarSign, color: '#3b82f6', desc: 'com parcelamento' },
          { label: 'Compradores', value: '72%', icon: Users, color: '#f59e0b', desc: 'preferem parcelar' },
          { label: 'Max Parcelas', value: `${config.maxInstallments}x`, icon: CreditCard, color: '#7a3b69', desc: 'configurado' },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 mb-2" style={{ color: k.color }} />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
            <div className="text-[9px] text-espresso/25 mt-0.5">{k.desc}</div>
          </div>
        ))}
      </div>

      {/* Main Toggle */}
      <div className="p-6 bg-white/60 border border-white/60 rounded-2xl mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-plum" />
            <div>
              <h2 className="text-sm font-medium text-espresso">Parcelamento sem Juros</h2>
              <p className="text-xs text-espresso/40">O comprador parcela, voce recebe a vista</p>
            </div>
          </div>
          <button onClick={() => setConfig({ ...config, enabled: !config.enabled })} className="transition-all">
            {config.enabled ? <ToggleRight className="w-8 h-8 text-plum" /> : <ToggleLeft className="w-8 h-8 text-espresso/30" />}
          </button>
        </div>
      </div>

      {config.enabled && (
        <>
          {/* Config */}
          <div className="p-6 bg-white/60 border border-white/60 rounded-2xl mb-6">
            <h2 className="text-sm font-medium text-espresso mb-4">Configuracoes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-espresso/50 mb-1 block">Maximo de Parcelas</label>
                <select value={config.maxInstallments}
                  onChange={e => setConfig({ ...config, maxInstallments: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <option key={n} value={n}>{n}x {n === 1 ? 'a vista' : 'sem juros'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-espresso/50 mb-1 block">Valor Minimo para Parcelar (R$)</label>
                <input type="number" value={config.minValue}
                  onChange={e => setConfig({ ...config, minValue: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
              </div>
              <div>
                <label className="text-xs text-espresso/50 mb-1 block">Taxa do Parcelamento (%)</label>
                <input type="number" step="0.01" value={config.feePercentage}
                  onChange={e => setConfig({ ...config, feePercentage: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
              </div>
              <div>
                <label className="text-xs text-espresso/50 mb-1 block">Quem paga a taxa?</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setConfig({ ...config, feeAbsorbed: true })}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${config.feeAbsorbed ? 'bg-plum text-cream' : 'bg-white/40 text-espresso/40'}`}>
                    Eu (produtor)
                  </button>
                  <button onClick={() => setConfig({ ...config, feeAbsorbed: false })}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${!config.feeAbsorbed ? 'bg-plum text-cream' : 'bg-white/40 text-espresso/40'}`}>
                    Comprador
                  </button>
                </div>
              </div>
            </div>

            {/* Interest free toggle */}
            <div className="flex items-center gap-3 mt-4 p-3 bg-green-50/50 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-espresso">Sem Juros para o Comprador</div>
                <div className="text-xs text-espresso/40">O comprador ve apenas o valor parcelado, sem juros adicionais</div>
              </div>
              <button onClick={() => setConfig({ ...config, interestFree: !config.interestFree })} className="transition-all">
                {config.interestFree ? <ToggleRight className="w-6 h-6 text-green-600" /> : <ToggleLeft className="w-6 h-6 text-espresso/30" />}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="p-6 bg-white/60 border border-white/60 rounded-2xl mb-6">
            <h2 className="text-sm font-medium text-espresso mb-4">Simulacao para o Comprador</h2>
            <div className="mb-4">
              <label className="text-xs text-espresso/50 mb-1 block">Valor do ingresso para simular (R$)</label>
              <input type="number" value={previewPrice}
                onChange={e => setPreviewPrice(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {installmentOptions.map(n => (
                <div key={n} className={`p-3 rounded-xl text-center ${n === 1 ? 'bg-plum/5 border border-plum/15' : 'bg-white/40 border border-white/60'}`}>
                  <div className="text-xs text-espresso/30">{n}x de</div>
                  <div className="text-sm font-medium text-espresso">R$ {getInstallmentValue(n)}</div>
                  {n === 1 && <div className="text-[9px] text-plum">a vista</div>}
                  {n > 1 && config.interestFree && <div className="text-[9px] text-green-600">sem juros</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="p-4 bg-white/60 border border-white/60 rounded-2xl mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-plum mt-0.5 flex-shrink-0" />
              <div className="text-xs text-espresso/50 leading-relaxed">
                <strong>Como funciona:</strong> O comprador escolhe parcelar em ate {config.maxInstallments}x sem juros. 
                Voce recebe o valor integral do ingresso (descontada a taxa de {monthlyFee}%) em ate 30 dias. 
                O risco de inadimplencia e da operadora de cartao, nao seu.
              </div>
            </div>
          </div>
        </>
      )}

      <button onClick={handleSave}
        className="w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2">
        <CreditCard className="w-4 h-4" /> Salvar Configuracao
      </button>
    </div>
  )
}
