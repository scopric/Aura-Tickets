import { useState } from 'react'
import {
  CheckCircle2, Circle, Plus, X, Trash2,
  Calendar, Tag, User, ChevronDown, ChevronUp, MessageSquare,
  Hash, Send, Filter, Layout, Columns3, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useProducerTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  type DbTask,
} from '../../hooks/useProducerTools'

const categories = ['Pre-evento', 'Marketing', 'Logistica', 'Financeiro', 'Dia do Evento', 'Pos-evento']

const tagColors: Record<string, string> = {
  urgente: '#ef4444', dj: '#7a3b69', decoracao: '#f59e0b', som: '#3b82f6',
  iluminacao: '#8b5cf6', bar: '#22c55e', seguranca: '#dc2626', foto: '#06b6d4',
  video: '#ec4899', imprensa: '#78716c', patrocinio: '#d97706', voluntario: '#0891b2',
}

const priorityColors = {
  alta: 'text-red-500 bg-red-50 border-red-100',
  media: 'text-amber-600 bg-amber-50 border-amber-100',
  baixa: 'text-blue-600 bg-blue-50 border-blue-100',
}

export default function ProducerTasks() {
  const { data: tasks = [], isLoading } = useProducerTasks()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Pre-evento', priority: 'media' as DbTask['priority'], dueDate: '', assignee: '', eventName: '', tags: [] as string[] })
  const [filterCategory, setFilterCategory] = useState('Todos')
  const [filterTag, setFilterTag] = useState('Todos')
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [tagInput, setTagInput] = useState('')

  const allTags = [...new Set(tasks.flatMap(t => t.tags || []))]

  const filtered = tasks
    .filter(t => filterCategory === 'Todos' || t.category === filterCategory)
    .filter(t => filterTag === 'Todos' || (t.tags || []).includes(filterTag))

  const total = tasks.length
  const done = tasks.filter(t => t.status === 'concluida').length
  const overdue = tasks.filter(t => t.status !== 'concluida').length

  const addTask = async () => {
    if (!form.title) return
    try {
      await createTask.mutateAsync({
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority,
        due_date: form.dueDate || null,
        assignee: form.assignee || null,
        event_name: form.eventName || null,
        tags: form.tags,
        subtasks: [],
        comments: [],
        status: 'pendente',
      })
      setForm({ title: '', description: '', category: 'Pre-evento', priority: 'media', dueDate: '', assignee: '', eventName: '', tags: [] })
      setShowForm(false)
      toast.success('Tarefa criada!')
    } catch {
      toast.error('Erro ao criar tarefa')
    }
  }

  const toggleTask = async (task: DbTask) => {
    const newStatus = task.status === 'concluida' ? 'pendente' : task.status === 'pendente' ? 'em-andamento' : 'concluida'
    try {
      await updateTask.mutateAsync({ id: task.id, status: newStatus })
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTask.mutateAsync(id)
      toast.success('Tarefa removida!')
    } catch {
      toast.error('Erro ao remover tarefa')
    }
  }

  const addSubtask = async (task: DbTask) => {
    if (!newSubtask.trim()) return
    try {
      await updateTask.mutateAsync({
        id: task.id,
        subtasks: [...(task.subtasks || []), { id: `st${Date.now()}`, title: newSubtask, done: false }],
      })
      setNewSubtask('')
    } catch {
      toast.error('Erro ao adicionar sub-tarefa')
    }
  }

  const toggleSubtask = async (task: DbTask, subId: string) => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        subtasks: (task.subtasks || []).map((s: any) => s.id === subId ? { ...s, done: !s.done } : s),
      })
    } catch {
      toast.error('Erro ao atualizar sub-tarefa')
    }
  }

  const addComment = async (task: DbTask) => {
    if (!newComment.trim()) return
    try {
      await updateTask.mutateAsync({
        id: task.id,
        comments: [...(task.comments || []), { id: `c${Date.now()}`, author: 'Voce', text: newComment, date: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) }],
      })
      setNewComment('')
    } catch {
      toast.error('Erro ao adicionar comentario')
    }
  }

  const addTag = () => {
    if (!tagInput.trim() || form.tags.includes(tagInput.trim())) return
    setForm({ ...form, tags: [...form.tags, tagInput.trim()] })
    setTagInput('')
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando tarefas...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Tarefas</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie seu pipeline de producao</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
          <Plus className="w-4 h-4" /> Nova Tarefa
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total', value: total, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Concluidas', value: done, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Pendentes', value: overdue, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`p-4 rounded-2xl ${s.bg} border border-white/60 text-center`}>
            <div className={`font-serif text-2xl ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-espresso/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-full">
          {(['Todos', ...categories] as const).map(cat => (
            <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${filterCategory === cat ? 'bg-plum text-cream' : 'text-espresso/40 hover:text-espresso/70'}`}>{cat}</button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex items-center gap-1">
            <Hash className="w-3.5 h-3.5 text-espresso/20" />
            <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="bg-white/60 border border-white/60 rounded-full px-3 py-1.5 text-[11px] text-espresso focus:outline-none">
              <option value="Todos">Tags</option>
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg text-espresso/30 hover:text-espresso transition-colors ${viewMode === 'list' ? 'text-plum bg-plum/10' : ''}`}><Layout className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('kanban')} className={`p-2 rounded-lg text-espresso/30 hover:text-espresso transition-colors ${viewMode === 'kanban' ? 'text-plum bg-plum/10' : ''}`}><Columns3 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-canvas border border-white/60 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">Nova Tarefa</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-espresso/5 text-espresso/40"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titulo da tarefa" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descricao" rows={2} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as DbTask['priority'] })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                  <option value="baixa">Baixa</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                <input value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} placeholder="Responsavel" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              </div>
              <input value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} placeholder="Evento" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              <div className="flex items-center gap-2">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Tag" className="flex-1 px-4 py-2 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                <button onClick={addTag} className="px-3 py-2 bg-plum text-cream text-xs rounded-xl">Add</button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-[10px] rounded-full text-white" style={{ background: tagColors[tag] || '#7a3b69' }}>{tag}</span>
                  ))}
                </div>
              )}
              <button onClick={addTask} disabled={createTask.isPending} className="w-full py-3 bg-plum text-cream text-sm font-medium rounded-xl hover:shadow-glow transition-all disabled:opacity-50">
                {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task List */}
      {viewMode === 'list' ? (
        <div className="space-y-3">
          {filtered.map(task => (
            <div key={task.id} className={`p-4 rounded-2xl border backdrop-blur-sm transition-all ${task.status === 'concluida' ? 'bg-espresso/[0.02] border-espresso/5 opacity-70' : 'bg-white/60 border-white/60 hover:shadow-md'}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => toggleTask(task)} className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${task.status === 'concluida' ? 'bg-green-500 border-green-500' : 'border-espresso/20 hover:border-plum'}`}>
                  {task.status === 'concluida' && <CheckCircle2 className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-sm font-medium ${task.status === 'concluida' ? 'text-espresso/40 line-through' : 'text-espresso'}`}>{task.title}</h3>
                    <span className={`px-2 py-0.5 text-[9px] font-medium rounded-full border ${priorityColors[task.priority]}`}>{task.priority}</span>
                  </div>
                  <p className="text-xs text-espresso/40 mb-2">{task.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-espresso/30">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{task.due_date || 'Sem prazo'}</span>
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{task.assignee || 'Nao atribuido'}</span>
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{task.category}</span>
                    {(task.tags || []).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 rounded-full text-white text-[9px]" style={{ background: tagColors[tag] || '#7a3b69' }}>{tag}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded-lg text-espresso/10 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>

              {/* Expandable details */}
              <button onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)} className="flex items-center gap-1 mt-2 text-[10px] text-plum hover:underline">
                {expandedTask === task.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expandedTask === task.id ? 'Ocultar' : 'Detalhes'}
              </button>

              {expandedTask === task.id && (
                <div className="mt-3 pt-3 border-t border-espresso/5 space-y-3">
                  {/* Subtasks */}
                  {(task.subtasks || []).length > 0 && (
                    <div className="space-y-1.5">
                      {(task.subtasks || []).map((sub: any) => (
                        <div key={sub.id} className="flex items-center gap-2">
                          <button onClick={() => toggleSubtask(task, sub.id)} className={`w-4 h-4 rounded border flex items-center justify-center ${sub.done ? 'bg-green-500 border-green-500' : 'border-espresso/20'}`}>
                            {sub.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                          </button>
                          <span className={`text-xs ${sub.done ? 'text-espresso/30 line-through' : 'text-espresso'}`}>{sub.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubtask(task)} placeholder="Nova sub-tarefa" className="flex-1 px-3 py-1.5 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30" />
                    <button onClick={() => addSubtask(task)} className="p-1.5 rounded-lg bg-plum text-cream text-xs"><Plus className="w-3 h-3" /></button>
                  </div>

                  {/* Comments */}
                  {(task.comments || []).length > 0 && (
                    <div className="space-y-2">
                      {(task.comments || []).map((c: any) => (
                        <div key={c.id} className="p-2 rounded-xl bg-canvas">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-medium text-espresso">{c.author}</span>
                            <span className="text-[9px] text-espresso/20">{c.date}</span>
                          </div>
                          <p className="text-xs text-espresso/60">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-espresso/20" />
                    <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment(task)} placeholder="Comentario..." className="flex-1 px-3 py-1.5 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso focus:outline-none focus:border-plum/30" />
                    <button onClick={() => addComment(task)} className="p-1.5 rounded-lg bg-plum text-cream"><Send className="w-3 h-3" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Kanban */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(['pendente', 'em-andamento', 'concluida'] as const).map(col => {
            const colTasks = filtered.filter(t => t.status === col)
            const colLabels = { pendente: 'Pendente', 'em-andamento': 'Em Andamento', concluida: 'Concluida' }
            const colColors = { pendente: 'bg-amber-50 text-amber-600', 'em-andamento': 'bg-blue-50 text-blue-600', concluida: 'bg-green-50 text-green-600' }
            return (
              <div key={col} className="flex-shrink-0 w-72">
                <div className={`p-2 rounded-xl ${colColors[col]} text-xs font-medium mb-3 text-center`}>{colLabels[col]} ({colTasks.length})</div>
                <div className="space-y-2">
                  {colTasks.map(task => (
                    <div key={task.id} className="p-3 rounded-xl bg-white/60 border border-white/60 hover:shadow-md transition-all cursor-pointer" onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}>
                      <h4 className="text-xs font-medium text-espresso">{task.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-espresso/30">
                        <span className={`px-1.5 py-0.5 rounded-full border ${priorityColors[task.priority]}`}>{task.priority}</span>
                        <span>{task.due_date || 'Sem prazo'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
