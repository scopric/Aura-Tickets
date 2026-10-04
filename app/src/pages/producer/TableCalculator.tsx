import { useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { brl } from '../../lib/taxa'
import { totaisMesas } from '../../lib/calculadoras'
import { PageHeader, Stat, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TableConfig {
  id: string
  name: string
  capacity: number
  pricePerSeat: number
  filled: number
  qty: number
}

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'

export default function TableCalculator() {
  const [tables, setTables] = useState<TableConfig[]>([])

  const addTable = () => {
    const num = tables.length + 1
    setTables([...tables, {
      id: Date.now().toString(),
      name: `Mesa ${num}`,
      capacity: 6,
      pricePerSeat: 100,
      filled: 0,
      qty: 1,
    }])
  }

  const removeTable = (id: string) => {
    setTables(tables.filter(t => t.id !== id))
  }

  const updateTable = (id: string, field: keyof TableConfig, value: string | number) => {
    setTables(tables.map(t => {
      if (t.id !== id) return t
      const n = { ...t, [field]: value }
      return { ...n, filled: Math.min(n.filled, n.capacity) }
    }))
  }

  const { mesas: totalMesas, lugares: totalSeats, ocupados: totalFilled, receita: totalRevenue, maximo: maxRevenue, ocupacao: occupancyRate } = totaisMesas(tables)

  const duplicateTable = (table: TableConfig) => {
    setTables([...tables, { ...table, id: Date.now().toString(), name: `${table.name} (cópia)` }])
  }

  return (
    <div>
      <PageHeader
        title="Calculadora de mesas"
        description="Simule mesas, lugares e receita (os valores ficam só nesta tela)"
        actions={
          <>
            <Button onClick={addTable}><I.Criar aria-hidden="true" />Nova mesa</Button>
            <Button variant="outline" disabled><I.Guardar aria-hidden="true" />Salvar (em breve)</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Mesas" value={totalMesas} />
        <Stat label="Lugares ocupados" value={`${totalFilled}/${totalSeats}`} />
        <Stat label="Ocupação" value={`${occupancyRate}%`} />
        <Stat label="Receita" value={brl(totalRevenue)} hint={`de ${brl(maxRevenue)} no máximo`} />
      </div>

      <div className="mt-6">
        {tables.length === 0 ? (
          <EmptyState
            title="Nenhuma mesa ainda"
            description="Clique em Nova mesa para simular capacidade e preço por lugar."
            action={<Button onClick={addTable}><I.Criar aria-hidden="true" />Nova mesa</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => {
              const fillPercent = table.capacity > 0 ? Math.round((table.filled / table.capacity) * 100) : 0
              const tableRevenue = Math.round(table.filled * table.pricePerSeat * 100) / 100
              const id = `mesa-${table.id}`

              return (
                <div key={table.id} className="rounded-[10px] border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      aria-label="Nome da mesa"
                      value={table.name}
                      onChange={e => updateTable(table.id, 'name', e.target.value)}
                      className="h-8 flex-1 font-medium"
                    />
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon-sm" className={icone} onClick={() => duplicateTable(table)} aria-label={`Duplicar ${table.name}`}>
                        <I.Copiar aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className={icone} onClick={() => removeTable(table.id)} aria-label={`Remover ${table.name}`}>
                        <I.Fechar aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${id}-cap`}>Lugares</Label>
                      <Input id={`${id}-cap`} type="number" inputMode="numeric" min={0} value={table.capacity}
                        onChange={e => updateTable(table.id, 'capacity', Math.max(parseInt(e.target.value) || 0, 0))} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${id}-preco`}>Preço por lugar (R$)</Label>
                      <Input id={`${id}-preco`} type="number" inputMode="decimal" min={0} value={table.pricePerSeat}
                        onChange={e => updateTable(table.id, 'pricePerSeat', Math.max(parseFloat(e.target.value) || 0, 0))} />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-1.5">
                    <Label htmlFor={`${id}-qtd`}>Quantidade de mesas iguais</Label>
                    <Input id={`${id}-qtd`} type="number" inputMode="numeric" min={1} step={1} value={table.qty}
                      onChange={e => updateTable(table.id, 'qty', Math.min(Math.max(parseInt(e.target.value) || 1, 1), 999))} />
                  </div>

                  <div className="mt-3 grid gap-1.5">
                    <Label htmlFor={`${id}-ocupados`}>Ocupados (em cada mesa)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        aria-label={`Lugares ocupados em ${table.name}`}
                        min={0}
                        max={table.capacity}
                        value={table.filled}
                        onChange={e => updateTable(table.id, 'filled', parseInt(e.target.value))}
                        className="min-w-0 flex-1 accent-primary"
                      />
                      <Input id={`${id}-ocupados`} type="number" inputMode="numeric" min={0} max={table.capacity} value={table.filled}
                        onChange={e => updateTable(table.id, 'filled', Math.min(Math.max(parseInt(e.target.value) || 0, 0), table.capacity))}
                        className="w-16 text-center" />
                    </div>
                  </div>

                  <div className="mt-4 border-t border-border pt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Ocupação</span>
                      <span className="tabular-nums text-foreground">{fillPercent}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.min(fillPercent, 100)}%` }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Receita{table.qty > 1 ? ` (${table.qty} mesas)` : ''}</span>
                      <span className="font-medium tabular-nums text-foreground">{brl(tableRevenue * table.qty)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {tables.length > 0 && (
        <Button variant="outline" className="mt-4 w-full border border-dashed border-input shadow-none" onClick={addTable}>
          <I.Criar aria-hidden="true" />Adicionar mesa
        </Button>
      )}
    </div>
  )
}
