// SÓ DESENVOLVIMENTO (rota /__quadro-demo, ativa com import.meta.env.DEV): Quadro com dados fixos, sem Supabase nem login.
// Commit separado, para descartar antes do merge.
import { useEffect, useState } from 'react'
import Quadro from '@/components/producer/quadro/Quadro'
import { Button } from '@/components/ui/button'
import type { ColunaQuadro, DbTask } from '@/hooks/useProducerTools'
import { diaBR } from '@/lib/visaoEvento'

const colunas: ColunaQuadro[] = [
  { id: 'fazer', name: 'A fazer', kind: 'todo' },
  { id: 'andamento', name: 'Em andamento', kind: 'doing' },
  { id: 'revisao', name: 'Em revisão', kind: 'doing' },
  { id: 'feito', name: 'Feito', kind: 'done' },
]
const em = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${diaBR(d)}T12:00:00-03:00` }
const t = (n: number, title: string, column_id: string, prazo: number | null, assigned_to: string | null): DbTask => ({
  id: `a${n}b${n}c${n}d${n}`, producer_id: 'p', event_id: null, assigned_to, title, description: null, due_date: prazo === null ? null : em(prazo),
  status: 'todo', priority: 'medium', created_at: `2026-10-0${n}T00:00:00Z`, column_id, position: n * 1000,
})
const inicial: DbTask[] = [
  t(1, 'Contratar som e luz do palco principal', 'fazer', 9, 'ana'),
  t(2, 'Fechar a lista de convidados da imprensa', 'fazer', -2, 'bia'),
  t(3, 'Contratos e notas dos fornecedores', 'fazer', null, null),
  t(4, 'Mapa da pista e dos camarotes', 'andamento', 2, 'caio'),
  t(5, 'Gravar o teaser do lote 2', 'andamento', 6, 'bia'),
  t(6, 'Revisar o texto da meia-entrada no checkout', 'revisao', 1, 'duda'),
  t(7, 'Abrir a venda do lote 1', 'feito', -6, 'ana'),
  t(8, 'Definir o line-up e a ordem das atrações', 'feito', -12, 'caio'),
]
const CHECK: Record<string, [number, number]> = { a1b1c1d1: [0, 5], a2b2c2d2: [1, 4], a4b4c4d4: [3, 7], a5b5c5d5: [2, 3], a6b6c6d6: [4, 4], a7b7c7d7: [5, 5], a8b8c8d8: [6, 6] }
const NOMES: Record<string, string> = { ana: 'Ana', bia: 'Bia', caio: 'Caio', duda: 'Duda' }

export default function QuadroDemo() {
  const [tarefas, setTarefas] = useState(inicial)
  // A rota é forçada no escuro pelo tema do app; aqui a troca é só nas classes da raiz (nada é salvo)
  const [escuro, setEscuro] = useState(true)
  const trocar = () => { setEscuro(!escuro); document.documentElement.classList.toggle('dark', !escuro); document.documentElement.classList.toggle('light', escuro) }
  useEffect(() => { document.body.classList.add('cor-produtor'); return () => document.body.classList.remove('cor-produtor') }, [])
  return (
    <div className="painel-produtor fixed inset-0 z-[300] overflow-auto bg-background p-6 text-foreground">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold">Demonstração do Quadro (só desenvolvimento)</h1>
        <Button variant="outline" onClick={trocar}>Tema: {escuro ? 'escuro' : 'claro'}</Button>
      </div>
      <Quadro
        tarefas={tarefas} colunas={colunas} colunaDe={x => x.column_id ?? ''} ordenavel
        onMover={(x, c, p) => setTarefas(l => l.map(y => (y.id === x.id ? { ...y, column_id: c, position: p ?? y.position } : y)))}
        furos={x => CHECK[x.id]}
        nomeDe={x => NOMES[x.assigned_to ?? '']}
        extras={x => x.id.startsWith('a4') ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Caio editando</span> : null}
      />
    </div>
  )
}
