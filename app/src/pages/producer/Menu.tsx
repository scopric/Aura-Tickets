import { useState } from 'react'
import { Plus, X, Pencil, Trash2, Upload, Wine, UtensilsCrossed, Package, Shirt, Wrench, ToggleLeft, ToggleRight } from 'lucide-react'
import { menuItems } from '../../data/mockData'
import type { MenuItem } from '../../data/mockData'

const categories = [
  { value: 'bebida', label: 'Bebidas', icon: Wine },
  { value: 'comida', label: 'Comidas', icon: UtensilsCrossed },
  { value: 'combo', label: 'Combos', icon: Package },
  { value: 'merchandise', label: 'Merch', icon: Shirt },
  { value: 'servico', label: 'Servicos', icon: Wrench },
]

export default function ProducerMenu() {
  const [items, setItems] = useState<MenuItem[]>(menuItems)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [menuEnabled, setMenuEnabled] = useState(true)

  const [form, setForm] = useState<Partial<MenuItem>>({
    name: '', description: '', price: 0, category: 'bebida', available: true, image: '', eventId: 'noite-eletro-2025'
  })

  const filtered = activeCategory === 'all' ? items : items.filter(i => i.category === activeCategory)

  const handleSubmit = () => {
    if (editingItem) {
      setItems(items.map(i => i.id === editingItem.id ? { ...i, ...form } as MenuItem : i))
    } else {
      setItems([...items, { ...form, id: `menu-${Date.now()}`, eventId: 'noite-eletro-2025' } as MenuItem])
    }
    setShowForm(false)
    setEditingItem(null)
    setForm({ name: '', description: '', price: 0, category: 'bebida', available: true, image: '', eventId: 'noite-eletro-2025' })
  }

  const toggleAvailable = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, available: !i.available } : i))
  }

  const deleteItem = (id: string) => {
    setItems(items.filter(i => i.id !== id))
  }

  const startEdit = (item: MenuItem) => {
    setEditingItem(item)
    setForm(item)
    setShowForm(true)
  }

  const stats = {
    total: items.length,
    totalValue: items.reduce((s, i) => s + i.price, 0),
    byCategory: categories.map(c => ({
      ...c,
      count: items.filter(i => i.category === c.value).length,
      value: items.filter(i => i.category === c.value).reduce((s, i) => s + i.price, 0)
    }))
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Cardapio & Comandas</h1>
          <p className="text-sm text-espresso/50 mt-1">Cadastre bebidas, comidas, combos e servicos para seu evento</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuEnabled(!menuEnabled)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full transition-all ${
              menuEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}
          >
            {menuEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            Comandas {menuEnabled ? 'Ativas' : 'Desativadas'}
          </button>
          <button
            onClick={() => { setShowForm(true); setEditingItem(null); setForm({ name: '', description: '', price: 0, category: 'bebida', available: true, image: '', eventId: 'noite-eletro-2025' }) }}
            className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo Item
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="p-4 rounded-2xl bg-white/60 border border-white/60">
          <div className="font-serif text-2xl text-espresso">{stats.total}</div>
          <div className="text-xs text-espresso/40">Itens no cardapio</div>
        </div>
        {stats.byCategory.map(c => (
          <div key={c.value} className="p-4 rounded-2xl bg-white/60 border border-white/60">
            <c.icon className="w-4 h-4 text-plum mb-1" />
            <div className="font-serif text-xl text-espresso">{c.count}</div>
            <div className="text-xs text-espresso/40">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 text-xs font-medium rounded-full whitespace-nowrap transition-all ${activeCategory === 'all' ? 'bg-plum text-cream' : 'bg-white/40 text-espresso/50 hover:bg-white/60'}`}
        >
          Todos
        </button>
        {categories.map(c => (
          <button
            key={c.value}
            onClick={() => setActiveCategory(c.value)}
            className={`px-4 py-2 text-xs font-medium rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 ${activeCategory === c.value ? 'bg-plum text-cream' : 'bg-white/40 text-espresso/50 hover:bg-white/60'}`}
          >
            <c.icon className="w-3 h-3" />
            {c.label}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(item => {
          const cat = categories.find(c => c.value === item.category)
          return (
            <div key={item.id} className={`p-5 rounded-2xl bg-white/60 border transition-all ${item.available ? 'border-white/60' : 'border-red-200 opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  item.category === 'bebida' ? 'bg-blue-100' :
                  item.category === 'comida' ? 'bg-amber-100' :
                  item.category === 'combo' ? 'bg-purple-100' :
                  item.category === 'merchandise' ? 'bg-pink-100' :
                  'bg-green-100'
                }`}>
                  {cat && <cat.icon className="w-5 h-5 text-espresso/70" />}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleAvailable(item.id)} className={`p-1.5 rounded-lg transition-colors ${item.available ? 'text-green-600 hover:bg-green-50' : 'text-red-400 hover:bg-red-50'}`}>
                    {item.available ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg hover:bg-espresso/5 text-espresso/30 hover:text-espresso transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/30 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-sm font-medium text-espresso mb-1">{item.name}</h3>
              <p className="text-xs text-espresso/40 mb-3 line-clamp-2">{item.description}</p>
              <div className="flex items-center justify-between">
                <span className="font-serif text-xl text-plum">R$ {item.price}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  item.available ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
                }`}>
                  {item.available ? 'Ativo' : 'Pausado'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-canvas rounded-3xl p-6 max-w-md w-full shadow-elevated border border-white/60">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl text-espresso">{editingItem ? 'Editar Item' : 'Novo Item'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-espresso/5 text-espresso/40 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Nome</label>
                <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Gin Tonica" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Descricao</label>
                <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Descricao do item" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Preco (R$)</label>
                  <input type="number" value={form.price || 0} onChange={e => setForm({ ...form, price: Number(e.target.value) })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Categoria</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as MenuItem['category'] })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                    {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="border-2 border-dashed border-espresso/10 rounded-xl p-6 text-center hover:border-plum/30 transition-colors">
                <Upload className="w-5 h-5 text-espresso/30 mx-auto mb-2" />
                <p className="text-xs text-espresso/40">Arraste uma imagem ou clique para selecionar</p>
                <p className="text-[10px] text-espresso/30 mt-1">PNG, JPG ate 2MB · 800x600px recomendado</p>
              </div>
              <button onClick={handleSubmit} className="w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all">
                {editingItem ? 'Salvar Alteracoes' : 'Cadastrar Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
