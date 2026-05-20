import { Link } from 'react-router'
import { ArrowLeft, CreditCard, Lock, Shield } from 'lucide-react'

export default function CheckoutPayment() {
  return (
    <div className="min-h-screen bg-canvas pt-24 pb-16">
      <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/checkout" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-serif text-3xl text-espresso">Pagamento</h1>
        </div>

        <div className="space-y-4">
          {/* Card Form */}
          <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-plum/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-plum" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-espresso">Cartao de Credito</h2>
                <p className="text-xs text-espresso/40">Pagamento seguro com criptografia SSL</p>
              </div>
              <Lock className="w-4 h-4 text-green-600 ml-auto" />
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-espresso/50 mb-1 block">Numero do Cartao</label>
                <input type="text" placeholder="0000 0000 0000 0000" className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
              <div>
                <label className="text-xs text-espresso/50 mb-1 block">Nome no Cartao</label>
                <input type="text" placeholder="Nome completo" className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-espresso/50 mb-1 block">Validade</label>
                  <input type="text" placeholder="MM/AA" className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs text-espresso/50 mb-1 block">CVV</label>
                  <input type="text" placeholder="123" className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                </div>
              </div>
            </div>
          </div>

          {/* Pix Option */}
          <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <span className="text-sm font-bold text-green-600">Pix</span>
              </div>
              <div>
                <h2 className="text-sm font-medium text-espresso">Pagar com Pix</h2>
                <p className="text-xs text-espresso/40">Aprovacao em segundos</p>
              </div>
              <input type="radio" name="payment" className="ml-auto accent-plum" />
            </div>
          </div>

          {/* Summary */}
          <div className="p-6 rounded-2xl bg-void text-cream">
            <div className="flex justify-between items-center mb-4">
              <span className="text-cream/50">Total a pagar</span>
              <span className="font-serif text-2xl">R$ 252,00</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-cream/30 mb-4">
              <Shield className="w-3 h-3" />
              Pagamento seguro e criptografado
            </div>
            <Link
              to="/checkout/success"
              className="w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Pagar Agora
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
