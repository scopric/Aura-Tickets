import { useState } from 'react'
import { Wine, UtensilsCrossed, Package, Shirt, Wrench, Plus, Minus, ShoppingCart, Clock, Check } from 'lucide-react'
import { menuItems } from '../data/mockData'

const categoryIcons: Record<string, typeof Wine> = {
  bebida: Wine,
  comida: UtensilsCrossed,
  combo: Package,
  merchandise: Shirt,
  servico: Wrench,
}

const categoryLabels: Record<string, string> = {
  bebida: 'Bebidas',
  comida: 'Comidas',
  combo: 'Combos',
  merchandise: 'Merch',
  servico: 'Servicos',
}

const categoryColors: Record<string, string> = {
  bebida: 'bg-blue-100 text-blue-700',
  comida: 'bg-amber-100 text-amber-700',
  combo: 'bg-purple-100 text-purple-700',
  merchandise: 'bg-pink-100 text-pink-700',
  servico: 'bg-green-100 text-green-700',
}

interface Props {
  eventId: string;
}

export default function PreOrder({ eventId }: Props) {
  const [cart, setCart] = useState<Record<string, number>>({})
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [showCart, setShowCart] = useState(false)
  const [pickupTime, setPickupTime] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const items = menuItems.filter(i => i.eventId === eventId && i.available)
  const filtered = activeCategory === 'all' ? items : items.filter(i => i.category === activeCategory)

  const addToCart = (itemId: string) => {
    setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }))
  }

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const next = { ...prev }
      if (next[itemId] > 1) next[itemId]--
      else delete next[itemId]
      return next
    })
  }

  const cartTotal = Object.entries(cart).reduce((total, [id, qty]) => {
    const item = items.find(i => i.id === id)
    return total + (item ? item.price * qty : 0)
  }, 0)

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)

  const handleConfirm = () => {
    setConfirmed(true)
    setTimeout(() => setConfirmed(false), 3000)
    setCart({})
    setShowCart(false)
  }

  const categories = [...new Set(items.map(i => i.category))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-xl text-cream mb-1">Comanda Digital</h3>
          <p className="text-xs text-cream/40">Compre antecipado e retire no evento</p>
        </div>
        {cartCount > 0 && (
          <button
            onClick={() => setShowCart(!showCart)}
            className="flex items-center gap-2 px-4 py-2 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {cartCount} itens · R$ {cartTotal}
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${activeCategory === 'all' ? 'bg-cream text-void' : 'bg-white/5 text-cream/40 hover:bg-white/10'}`}
        >
          Todos
        </button>
        {categories.map(cat => {
          const Icon = categoryIcons[cat] || Package
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 ${activeCategory === cat ? 'bg-cream text-void' : 'bg-white/5 text-cream/40 hover:bg-white/10'}`}
            >
              <Icon className="w-3 h-3" />
              {categoryLabels[cat] || cat}
            </button>
          )
        })}
      </div>

      {/* Items */}
      <div className="space-y-3">
        {filtered.map(item => {
          const qty = cart[item.id] || 0
          const Icon = categoryIcons[item.category] || Package
          return (
            <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${categoryColors[item.category]?.split(' ')[0] || 'bg-white/5'}`}>
                <Icon className="w-5 h-5 text-cream/70" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-medium text-cream">{item.name}</h4>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${categoryColors[item.category] || 'bg-white/5 text-cream/40'}`}>
                    {categoryLabels[item.category]}
                  </span>
                </div>
                <p className="text-xs text-cream/40 line-clamp-1">{item.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-serif text-lg text-cream">R$ {item.price}</div>
                {qty > 0 ? (
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => removeFromCart(item.id)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-cream hover:bg-white/20 transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-cream font-medium w-4 text-center">{qty}</span>
                    <button onClick={() => addToCart(item.id)} className="w-6 h-6 rounded-full bg-plum flex items-center justify-center text-cream hover:bg-plum/80 transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(item.id)} className="mt-1 px-3 py-1 bg-white/10 text-cream text-xs rounded-full hover:bg-plum transition-all">
                    Adicionar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Cart Summary */}
      {cartCount > 0 && !showCart && (
        <div className="p-4 rounded-2xl bg-plum/10 border border-plum/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-plum" />
            <span className="text-sm text-cream">{cartCount} itens no carrinho</span>
          </div>
          <button onClick={() => setShowCart(true)} className="px-4 py-2 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all">
            Finalizar · R$ {cartTotal}
          </button>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="p-6 rounded-2xl bg-void border border-white/10">
          <h4 className="font-serif text-lg text-cream mb-4">Resumo da Comanda</h4>
          <div className="space-y-3 mb-4">
            {Object.entries(cart).map(([id, qty]) => {
              const item = items.find(i => i.id === id)
              if (!item) return null
              return (
                <div key={id} className="flex items-center justify-between text-sm">
                  <span className="text-cream/70">{item.name} x{qty}</span>
                  <span className="text-cream font-medium">R$ {item.price * qty}</span>
                </div>
              )
            })}
            <div className="border-t border-white/10 pt-3 flex justify-between text-lg font-serif">
              <span className="text-cream">Total</span>
              <span className="text-cream">R$ {cartTotal}</span>
            </div>
          </div>

          {/* Pickup time */}
          <div className="mb-4">
            <label className="text-xs text-cream/40 mb-2 block flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Horario de retirada
            </label>
            <select
              value={pickupTime}
              onChange={e => setPickupTime(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-cream focus:outline-none focus:border-plum/30"
            >
              <option value="" className="bg-void">Selecione...</option>
              <option value="21:00" className="bg-void">21:00</option>
              <option value="22:00" className="bg-void">22:00</option>
              <option value="23:00" className="bg-void">23:00</option>
              <option value="00:00" className="bg-void">00:00</option>
              <option value="01:00" className="bg-void">01:00</option>
            </select>
          </div>

          {confirmed ? (
            <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20 text-center">
              <Check className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-green-400 font-medium">Comanda confirmada!</p>
              <p className="text-xs text-green-400/60 mt-1">Seu pedido estara pronto no horario selecionado</p>
            </div>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!pickupTime}
              className="w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirmar Comanda · R$ {cartTotal}
            </button>
          )}
          <button onClick={() => setShowCart(false)} className="w-full py-2 text-xs text-cream/30 hover:text-cream/60 transition-colors mt-2">
            Continuar comprando
          </button>
        </div>
      )}
    </div>
  )
}
