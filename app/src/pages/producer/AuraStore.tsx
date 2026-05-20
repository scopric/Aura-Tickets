import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft, Plus, ShoppingBag, Package, Shirt, Wine, Star,
  Edit3, Trash2, ToggleLeft, ToggleRight, DollarSign, Hash, Gift
} from 'lucide-react'
import { toast } from 'sonner'

interface StoreItem {
  id: string
  name: string
  description: string
  price: number
  stock: number
  sold: number
  category: 'experience' | 'merch' | 'food' | 'service'
  image: string
  active: boolean
  limitPerOrder: number
}

const categoryLabels: Record<string, { label: string; icon: typeof Star; color: string }> = {
  experience: { label: 'Experiencia', icon: Star, color: '#f59e0b' },
  merch: { label: 'Merchandising', icon: Shirt, color: '#3b82f6' },
  food: { label: 'Alimentacao', icon: Wine, color: '#22c55e' },
  service: { label: 'Servico', icon: Gift, color: '#8b5cf6' },
}

export default function AuraStore() {
  const [items, setItems] = useState<StoreItem[]>([
    { id: '1', name: 'Meet & Greet', description: 'Encontro exclusivo com os artistas antes do show', price: 150, stock: 20, sold: 8, category: 'experience', image: '', active: true, limitPerOrder: 2 },
    { id: '2', name: 'Camiseta Oficial', description: 'Camiseta exclusiva do evento, tamanhos P ao GG', price: 80, stock: 100, sold: 34, category: 'merch', image: '', active: true, limitPerOrder: 5 },
    { id: '3', name: 'Welcome Drink VIP', description: 'Drink exclusivo no lounge VIP', price: 35, stock: 200, sold: 89, category: 'food', image: '', active: true, limitPerOrder: 10 },
    { id: '4', name: 'Foto Profissional', description: 'Sessao de fotos profissionais no evento', price: 60, stock: 50, sold: 12, category: 'service', image: '', active: false, limitPerOrder: 1 },
  ])
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null)
  const [showForm, setShowForm] = useState(false)

  const addItem = () => {
    setEditingItem({
      id: `new-${Date.now()}`, name: '', description: '', price: 0, stock: 0, sold: 0,
      category: 'merch', image: '', active: true, limitPerOrder: 1,
    })
    setShowForm(true)
  }

  const editItem = (item: StoreItem) => {
    setEditingItem({ ...item })
    setShowForm(true)
  }

  const saveItem = () => {
    if (!editingItem?.name.trim()) { toast.error('Nome obrigatorio'); return }
    if (editingItem.id.startsWith('new-')) {
      const newItem = { ...editingItem, id: `s${Date.now()}` }
      setItems([...items, newItem])
      toast.success('Item adicionado!')
    } else {
      setItems(items.map(i => i.id === editingItem.id ? editingItem : i))
      toast.success('Item atualizado!')
    }
    setShowForm(false)
    setEditingItem(null)
  }

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id))
    toast.success('Item removido!')
  }

  const toggleActive = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, active: !i.active } : i))
  }

  const totalRevenue = items.filter(i => i.active).reduce((s, i) => s + i.price * i.sold, 0)
  const totalStock = items.filter(i => i.active).reduce((s, i) => s + i.stock, 0)
  const totalSold = items.filter(i => i.active).reduce((s, i) => s + i.sold, 0)

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/event-manager" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">Aura Store</h1>
          <p className="text-sm text-espresso/50 mt-1">Venda produtos, experiencias e servicos no seu evento</p>
        </div>
        <button onClick={addItem} className="px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" /> Adicionar Item
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Itens Ativos', value: items.filter(i => i.active).length.toString(), icon: Package },
          { label: 'Vendidos', value: totalSold.toString(), icon: ShoppingBag },
          { label: 'Em Estoque', value: totalStock.toString(), icon: Hash },
          { label: 'Receita', value: `R$ ${(totalRevenue / 1000).toFixed(1)}K`, icon: DollarSign },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 text-plum mb-3" />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && editingItem && (
        <div className="mb-6 p-6 bg-white/60 border border-white/60 rounded-2xl">
          <h3 className="font-serif text-lg text-espresso mb-4">{editingItem.id.startsWith('new-') ? 'Novo Item' : 'Editar Item'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-espresso/50 mb-1 block">Nome</label>
              <input value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
            <div>
              <label className="text-xs text-espresso/50 mb-1 block">Categoria</label>
              <select value={editingItem.category} onChange={e => setEditingItem({ ...editingItem, category: e.target.value as StoreItem['category'] })}
                className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30">
                <option value="experience">Experiencia</option>
                <option value="merch">Merchandising</option>
                <option value="food">Alimentacao</option>
                <option value="service">Servico</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-espresso/50 mb-1 block">Descricao</label>
              <textarea value={editingItem.description} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                rows={2} className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
            </div>
            <div>
              <label className="text-xs text-espresso/50 mb-1 block">Preco (R$)</label>
              <input type="number" value={editingItem.price || ''} onChange={e => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
            <div>
              <label className="text-xs text-espresso/50 mb-1 block">Estoque</label>
              <input type="number" value={editingItem.stock || ''} onChange={e => setEditingItem({ ...editingItem, stock: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
            <div>
              <label className="text-xs text-espresso/50 mb-1 block">Limite por Compra</label>
              <input type="number" value={editingItem.limitPerOrder}
                onChange={e => setEditingItem({ ...editingItem, limitPerOrder: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={saveItem} className="flex-1 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
                Salvar
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-espresso/15 text-espresso text-sm rounded-full hover:bg-espresso/5 transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(item => {
          const cat = categoryLabels[item.category]
          const Icon = cat.icon
          return (
            <div key={item.id} className={`p-5 rounded-2xl border transition-all ${item.active ? 'bg-white/60 border-white/60' : 'bg-white/30 border-white/40 opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${cat.color}15` }}>
                    <Icon className="w-5 h-5" style={{ color: cat.color }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-espresso">{item.name}</div>
                    <div className="text-[10px] text-espresso/30">{cat.label} · {item.active ? 'Ativo' : 'Pausado'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => editItem(item)} className="p-1.5 rounded-lg hover:bg-white/60 text-espresso/30 hover:text-plum transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => toggleActive(item.id)} className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
                    {item.active ? <ToggleRight className="w-4 h-4 text-plum" /> : <ToggleLeft className="w-4 h-4 text-espresso/30" />}
                  </button>
                  <button onClick={() => removeItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/30 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-espresso/40 mb-3">{item.description}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-white/40 rounded-lg text-center">
                  <div className="text-xs font-medium text-espresso">R$ {item.price}</div>
                  <div className="text-[9px] text-espresso/30">Preco</div>
                </div>
                <div className="p-2 bg-white/40 rounded-lg text-center">
                  <div className="text-xs font-medium text-espresso">{item.sold}/{item.stock}</div>
                  <div className="text-[9px] text-espresso/30">Vendas</div>
                </div>
                <div className="p-2 bg-white/40 rounded-lg text-center">
                  <div className="text-xs font-medium text-green-600">R$ {(item.price * item.sold).toFixed(0)}</div>
                  <div className="text-[9px] text-espresso/30">Receita</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((item.sold / item.stock) * 100, 100)}%`, background: cat.color }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {items.length === 0 && (
        <div className="text-center py-20">
          <ShoppingBag className="w-12 h-12 text-espresso/10 mx-auto mb-4" />
          <p className="text-espresso/30 text-sm">Nenhum item na loja ainda</p>
          <button onClick={addItem} className="mt-4 px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">
            Adicionar Primeiro Item
          </button>
        </div>
      )}
    </div>
  )
}
