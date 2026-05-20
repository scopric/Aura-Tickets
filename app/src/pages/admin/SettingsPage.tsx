import { useState } from 'react'
import { CreditCard, Bell, Shield, Globe, Save } from 'lucide-react'

export default function AdminSettings() {
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-espresso">Configuracoes</h1>
        <p className="text-sm text-espresso/50 mt-1">Gerencie configuracoes da plataforma</p>
      </div>

      <div className="space-y-6">
        {/* Platform */}
        <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><Globe className="w-4 h-4 text-plum" /> Plataforma</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-espresso/50 mb-1.5 block">Taxa de Servico (%)</label>
              <input type="number" defaultValue="10" className="w-full max-w-xs px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
            <div>
              <label className="text-xs text-espresso/50 mb-1.5 block">Taxa de Processamento (%)</label>
              <input type="number" defaultValue="2.9" className="w-full max-w-xs px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
            <div>
              <label className="text-xs text-espresso/50 mb-1.5 block">Valor Minimo de Saque (R$)</label>
              <input type="number" defaultValue="50" className="w-full max-w-xs px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
          </div>
        </div>

        {/* Payments */}
        <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-plum" /> Pagamentos</h3>
          <div className="space-y-3">
            {['Pix', 'Cartao de Credito', 'Boleto', 'Cartao de Debito'].map(method => (
              <div key={method} className="flex items-center justify-between p-3 rounded-xl bg-white/40 border border-white/60">
                <span className="text-sm text-espresso">{method}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-10 h-5 bg-espresso/10 rounded-full peer peer-checked:bg-plum transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-plum" /> Notificacoes</h3>
          <div className="space-y-3">
            {[
              'Notificar novo cadastro de produtor',
              'Notificar venda de ingresso',
              'Alerta de mesa quase lotada',
              'Relatorio diario de vendas',
            ].map(item => (
              <label key={item} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-plum w-4 h-4" />
                <span className="text-sm text-espresso/70">{item}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-plum" /> Seguranca</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-espresso">Verificacao em duas etapas</div>
                <div className="text-[10px] text-espresso/30">Obrigatorio para admins</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-10 h-5 bg-espresso/10 rounded-full peer peer-checked:bg-plum transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
            <div>
              <label className="text-xs text-espresso/50 mb-1.5 block">Tempo de sessao (minutos)</label>
              <input type="number" defaultValue="60" className="w-full max-w-xs px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-4">
          {saved && <span className="text-sm text-green-600">Salvo com sucesso!</span>}
          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all">
            <Save className="w-4 h-4" /> Salvar Alteracoes
          </button>
        </div>
      </div>
    </div>
  )
}
