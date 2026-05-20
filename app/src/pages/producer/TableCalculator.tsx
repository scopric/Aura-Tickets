import { useState } from 'react'
import { Plus, X, Users, Calculator, Save, Copy } from 'lucide-react'

interface TableConfig {
  id: string
  name: string
  capacity: number
  pricePerSeat: number
  filled: number
}

export default function TableCalculator() {
  const [tables, setTables] = useState<TableConfig[]>([
    { id: '1', name: 'Mesa Premium 1', capacity: 8, pricePerSeat: 200, filled: 8 },
    { id: '2', name: 'Mesa Premium 2', capacity: 8, pricePerSeat: 200, filled: 6 },
    { id: '3', name: 'Mesa Gold 1', capacity: 6, pricePerSeat: 150, filled: 4 },
    { id: '4', name: 'Mesa Gold 2', capacity: 6, pricePerSeat: 150, filled: 6 },
    { id: '5', name: 'Mesa Silver 1', capacity: 4, pricePerSeat: 100, filled: 2 },
  ])

  const addTable = () => {
    const num = tables.length + 1
    setTables([...tables, {
      id: Date.now().toString(),
      name: `Mesa ${num}`,
      capacity: 6,
      pricePerSeat: 100,
      filled: 0,
    }])
  }

  const removeTable = (id: string) => {
    setTables(tables.filter(t => t.id !== id))
  }

  const updateTable = (id: string, field: keyof TableConfig, value: string | number) => {
    setTables(tables.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const totalSeats = tables.reduce((s, t) => s + t.capacity, 0)
  const totalFilled = tables.reduce((s, t) => s + t.filled, 0)
  const totalRevenue = tables.reduce((s, t) => s + t.filled * t.pricePerSeat, 0)
  const maxRevenue = tables.reduce((s, t) => s + t.capacity * t.pricePerSeat, 0)
  const occupancyRate = totalSeats > 0 ? Math.round((totalFilled / totalSeats) * 100) : 0

  const duplicateTable = (table: TableConfig) => {
    setTables([...tables, { ...table, id: Date.now().toString(), name: `${table.name} (copia)` }])
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Calculadora de Mesas</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie mesas, assentos e precificacao</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={addTable}
            className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            Nova Mesa
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 border border-espresso/15 text-espresso text-sm font-medium rounded-full hover:bg-espresso/5 transition-all">
            <Save className="w-4 h-4" />
            Salvar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-plum" />
            <span className="text-xs text-espresso/40 uppercase tracking-wider">Mesas</span>
          </div>
          <div className="font-serif text-3xl text-espresso">{tables.length}</div>
        </div>
        <div className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-plum" />
            <span className="text-xs text-espresso/40 uppercase tracking-wider">Lugares</span>
          </div>
          <div className="font-serif text-3xl text-espresso">{totalFilled}/{totalSeats}</div>
        </div>
        <div className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-4 h-4 text-plum" />
            <span className="text-xs text-espresso/40 uppercase tracking-wider">Ocupacao</span>
          </div>
          <div className="font-serif text-3xl text-espresso">{occupancyRate}%</div>
          <div className="w-full h-2 bg-espresso/5 rounded-full mt-2">
            <div className="h-full bg-plum rounded-full transition-all" style={{ width: `${occupancyRate}%` }} />
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-espresso/40 uppercase tracking-wider">Receita</span>
          </div>
          <div className="font-serif text-3xl text-plum">R$ {totalRevenue.toLocaleString()}</div>
          <div className="text-xs text-espresso/40 mt-1">de R$ {maxRevenue.toLocaleString()} max.</div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {tables.map((table) => {
          const fillPercent = table.capacity > 0 ? Math.round((table.filled / table.capacity) * 100) : 0
          const tableRevenue = table.filled * table.pricePerSeat

          return (
            <div key={table.id} className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm hover:border-plum/20 transition-all">
              <div className="flex items-center justify-between mb-4">
                <input
                  type="text"
                  value={table.name}
                  onChange={e => updateTable(table.id, 'name', e.target.value)}
                  className="text-sm font-medium text-espresso bg-transparent focus:outline-none border-b border-transparent focus:border-plum/30 transition-colors flex-1 mr-2"
                />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => duplicateTable(table)}
                    className="p-1.5 rounded-lg hover:bg-espresso/5 text-espresso/30 hover:text-espresso transition-colors"
                    title="Duplicar"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeTable(table.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/30 hover:text-red-500 transition-colors"
                    title="Remover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-espresso/40 uppercase tracking-wider mb-1 block">Capacidade</label>
                  <input
                    type="number"
                    value={table.capacity}
                    onChange={e => updateTable(table.id, 'capacity', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-espresso/40 uppercase tracking-wider mb-1 block">Preco por Lugar (R$)</label>
                  <input
                    type="number"
                    value={table.pricePerSeat}
                    onChange={e => updateTable(table.id, 'pricePerSeat', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-espresso/40 uppercase tracking-wider mb-1 block">Preenchidos</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={table.capacity}
                      value={table.filled}
                      onChange={e => updateTable(table.id, 'filled', parseInt(e.target.value))}
                      className="flex-1 accent-plum"
                    />
                    <input
                      type="number"
                      min={0}
                      max={table.capacity}
                      value={table.filled}
                      onChange={e => updateTable(table.id, 'filled', parseInt(e.target.value) || 0)}
                      className="w-14 px-2 py-1.5 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30 text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-espresso/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-espresso/40">Ocupacao</span>
                  <span className="text-xs font-medium text-espresso">{fillPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-espresso/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      fillPercent === 100 ? 'bg-green-500' : fillPercent >= 70 ? 'bg-amber-400' : 'bg-plum'
                    }`}
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-espresso/40">Receita</span>
                  <span className="font-serif text-lg text-plum">R$ {tableRevenue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add button */}
      <button
        onClick={addTable}
        className="w-full py-4 border-2 border-dashed border-espresso/10 rounded-2xl text-sm text-espresso/40 hover:text-plum hover:border-plum/30 transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Adicionar Mesa
      </button>
    </div>
  )
}
