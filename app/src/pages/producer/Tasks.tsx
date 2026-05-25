import { useState } from 'react'
import {
  CheckCircle2, Circle, Plus, X, Trash2,
  Calendar, Tag, User, ChevronDown, ChevronUp, MessageSquare,
  Hash, Send, Filter, Layout, Columns3
} from 'lucide-react'
import { toast } from 'sonner'

interface Comment {
  id: string
  author: string
  text: string
  date: string
}

interface SubTask {
  id: string
  title: string
  done: boolean
}

interface Task {
  id: string
  title: string
  description: string
  category: string
  priority: 'alta' | 'media' | 'baixa'
  status: 'pendente' | 'em-andamento' | 'concluida'
  dueDate: string
  assignee: string
  eventName: string
  tags: string[]
  subtasks: SubTask[]
  comments: Comment[]
}

const categories = ['Pre-evento', 'Marketing', 'Logistica', 'Financeiro', 'Dia do Evento', 'Pos-evento']

const tagColors: Record<string, string> = {
  urgente: '#ef4444', dj: '#7a3b69', decoracao: '#f59e0b', som: '#3b82f6',
  iluminacao: '#8b5cf6', bar: '#22c55e', seguranca: '#dc2626', foto: '#06b6d4',
  video: '#ec4899', imprensa: '#78716c', patrocinio: '#d97706', voluntario: '#0891b2',
}

const mockTasks: Task[] = [
  { id: 't1', title: 'Reservar local do evento', description: 'Confirmar contrato e pagamento de sinal', category: 'Pre-evento', priority: 'alta', status: 'concluida', dueDate: '10 Mai', assignee: 'Joao', eventName: 'Noite Eletro 2025', tags: ['urgente'], subtasks: [{ id: 's1', title: 'Visitar local', done: true }, { id: 's2', title: 'Assinar contrato', done: true }, { id: 's3', title: 'Pagar sinal', done: true }], comments: [] },
  { id: 't2', title: 'Contratar DJ principal', description: 'Assinar contrato com DJ selecionado', category: 'Pre-evento', priority: 'alta', status: 'concluida', dueDate: '12 Mai', assignee: 'Maria', eventName: 'Noite Eletro 2025', tags: ['dj', 'urgente'], subtasks: [{ id: 's4', title: 'Contatar DJ', done: true }, { id: 's5', title: 'Negociar valor', done: true }], comments: [{ id: 'c1', author: 'Maria', text: 'DJ confirmou! Precisa de 2 mesas.', date: '11 Mai' }] },
  { id: 't3', title: 'Lancar campanha no Instagram', description: 'Criar posts e stories para 2 semanas', category: 'Marketing', priority: 'alta', status: 'em-andamento', dueDate: '15 Mai', assignee: 'Carlos', eventName: 'Noite Eletro 2025', tags: ['imprensa'], subtasks: [{ id: 's6', title: 'Criar artes', done: true }, { id: 's7', title: 'Agendar posts', done: false }], comments: [] },
  { id: 't4', title: 'Comprar decoracao de luz', description: 'Fazer orcamento e comprar iluminacao', category: 'Logistica', priority: 'media', status: 'pendente', dueDate: '18 Mai', assignee: 'Fernanda', eventName: 'Noite Eletro 2025', tags: ['decoracao', 'iluminacao'], subtasks: [{ id: 's8', title: 'Pesquisar fornecedores', done: false }], comments: [] },
  { id: 't5', title: 'Testar sistema de som', description: 'Soundcheck 2 horas antes do evento', category: 'Dia do Evento', priority: 'alta', status: 'pendente', dueDate: '20 Mai', assignee: 'Rafael', eventName: 'Noite Eletro 2025', tags: ['som', 'urgente'], subtasks: [], comments: [] },
  { id: 't6', title: 'Preparar welcome kit VIP', description: 'Montar kits para mesa coletiva', category: 'Dia do Evento', priority: 'media', status: 'pendente', dueDate: '20 Mai', assignee: 'Ana', eventName: 'Noite Eletro 2025', tags: ['decoracao'], subtasks: [], comments: [{ id: 'c2', author: 'Ana', text: 'Preciso da lista de confirmados para saber quantos kits fazer.', date: '18 Mai' }] },
  { id: 't7', title: 'Enviar pesquisa de satisfacao', description: 'Pos-evento: coletar feedback', category: 'Pos-evento', priority: 'baixa', status: 'pendente', dueDate: '25 Mai', assignee: 'Maria', eventName: 'Noite Eletro 2025', tags: ['imprensa'], subtasks: [], comments: [] },
]

const priorityColors = {
  alta: 'text-red-500 bg-red-50 border-red-100',
  media: 'text-amber-600 bg-amber-50 border-amber-100',
  baixa: 'text-blue-600 bg-blue-50 border-blue-100',
}

export default function ProducerTasks() {
  const [tasks, setTasks] = useState<Task[]>(import.meta.env.DEV ? mockTasks : [])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Pre-evento', priority: 'media' as Task['priority'], dueDate: '', assignee: '', eventName: '', tags: [] as string[] })
  const [filterCategory, setFilterCategory] = useState('Todos')
  const [filterTag, setFilterTag] = useState('Todos')
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [tagInput, setTagInput] = useState('')

  const allTags = [...new Set(tasks.flatMap(t => t.tags))]

  const filtered = tasks
    .filter(t => filterCategory === 'Todos' || t.category === filterCategory)
    .filter(t => filterTag === 'Todos' || t.tags.includes(filterTag))

  const total = tasks.length
  const done = tasks.filter(t => t.status === 'concluida').length
  const overdue = tasks.filter(t => t.status !== 'concluida').length

  const addTask = () => {
    if (!form.title) return
    const newTask: Task = {
      id: `t${Date.now()}`, title: form.title, description: form.description,
      category: form.category, priority: form.priority, status: 'pendente',
      dueDate: form.dueDate || 'Sem data', assignee: form.assignee || 'Nao atribuido',
      eventName: form.eventName || 'Geral', tags: form.tags,
      subtasks: [], comments: [],
    }
    setTasks([...tasks, newTask])
    setForm({ title: '', description: '', category: 'Pre-evento', priority: 'media', dueDate: '', assignee: '', eventName: '', tags: [] })
    setShowForm(false)
    toast.success('Tarefa criada!')
  }

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id !== id) return t
      const newStatus = t.status === 'concluida' ? 'pendente' : t.status === 'pendente' ? 'em-andamento' : 'concluida'
      return { ...t, status: newStatus }
    }))
  }

  const deleteTask = (id: string) => { setTasks(tasks.filter(t => t.id !== id)); toast.success('Tarefa removida!') }

  const toggleSubtask = (taskId: string, subId: string) => {
    setTasks(tasks.map(t => t.id !== taskId ? t : {
      ...t,
      subtasks: t.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s)
    }))
  }

  const addSubtask = (taskId: string) => {
    if (!newSubtask.trim()) return
    setTasks(tasks.map(t => t.id !== taskId ? t : {
      ...t, subtasks: [...t.subtasks, { id: `st${Date.now()}`, title: newSubtask, done: false }]
    }))
    setNewSubtask('')
    toast.success('Subtarefa adicionada!')
  }

  const addComment = (taskId: string) => {
    if (!newComment.trim()) return
    setTasks(tasks.map(t => t.id !== taskId ? t : {
      ...t, comments: [...t.comments, { id: `cm${Date.now()}`, author: 'Voce', text: newComment, date: 'Agora' }]
    }))
    setNewComment('')
    toast.success('Comentario adicionado!')
  }

  const addTagToForm = () => {
    if (!tagInput.trim() || form.tags.includes(tagInput.trim())) return
    setForm({ ...form, tags: [...form.tags, tagInput.trim()] })
    setTagInput('')
  }

  const removeTagFromForm = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter(t => t !== tag) })
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Tarefas da Equipe</h1>
          <p className="text-sm text-espresso/50 mt-1">{done}/{total} concluidas · {overdue} pendentes</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/60 rounded-full p-0.5 border border-white/60">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-full text-xs transition-all ${viewMode === 'list' ? 'bg-plum text-cream' : 'text-espresso/40'}`}>
              <Layout className="w-3.5 h-3.5 inline mr-1" />Lista
            </button>
            <button onClick={() => setViewMode('kanban')} className={`px-3 py-1.5 rounded-full text-xs transition-all ${viewMode === 'kanban' ? 'bg-plum text-cream' : 'text-espresso/40'}`}>
              <Columns3 className="w-3.5 h-3.5 inline mr-1" />Kanban
            </button>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="px-5 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pendentes', value: tasks.filter(t => t.status === 'pendente').length, color: '#ef4444' },
          { label: 'Em andamento', value: tasks.filter(t => t.status === 'em-andamento').length, color: '#f59e0b' },
          { label: 'Concluidas', value: done, color: '#22c55e' },
        ].map(k => (
          <div key={k.label} className="p-4 rounded-2xl bg-white/60 border border-white/60 text-center">
            <div className="font-serif text-2xl" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] text-espresso/40 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-espresso/30" />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2 bg-white/60 border border-white/60 rounded-full text-xs text-espresso focus:outline-none focus:border-plum/30">
          <option>Todos</option>{categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
          className="px-3 py-2 bg-white/60 border border-white/60 rounded-full text-xs text-espresso focus:outline-none focus:border-plum/30">
          <option value="Todos">Todas tags</option>{allTags.map(t => <option key={t}>{t}</option>)}
        </select>
        {filterCategory !== 'Todos' && (
          <button onClick={() => setFilterCategory('Todos')} className="px-3 py-1 rounded-full bg-plum/10 text-plum text-[10px]">{filterCategory} <X className="w-3 h-3 inline" /></button>
        )}
        {filterTag !== 'Todos' && (
          <button onClick={() => setFilterTag('Todos')} className="px-3 py-1 rounded-full bg-plum/10 text-plum text-[10px]">{filterTag} <X className="w-3 h-3 inline" /></button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="p-5 rounded-2xl bg-white/60 border border-white/60 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titulo" className="px-3 py-2 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="px-3 py-2 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Task['priority'] })} className="px-3 py-2 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
              <option value="alta">Alta</option><option value="media">Media</option><option value="baixa">Baixa</option>
            </select>
          </div>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descricao" rows={2} className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 resize-none mb-3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <input value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} placeholder="Data limite" className="px-3 py-2 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <input value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} placeholder="Responsavel" className="px-3 py-2 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            <input value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} placeholder="Evento" className="px-3 py-2 bg-white/50 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
          {/* Tags */}
          <div className="flex items-center gap-2 mb-3">
            <Hash className="w-4 h-4 text-espresso/30" />
            <div className="flex flex-wrap gap-1.5">
              {form.tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[10px] text-white flex items-center gap-1" style={{ background: tagColors[t] || '#7a3b69' }}>
                  {t} <button onClick={() => removeTagFromForm(t)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTagToForm()}
              placeholder="+ tag" className="w-20 px-2 py-1 bg-white/50 border border-white/60 rounded-lg text-[10px] text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>
          <div className="flex gap-2">
            <button onClick={addTask} className="px-6 py-2 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">Criar</button>
            <button onClick={() => setShowForm(false)} className="px-6 py-2 text-sm text-espresso/50 hover:text-espresso transition-all">Cancelar</button>
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filtered.map(task => {
            const isExpanded = expandedTask === task.id
            const subDone = task.subtasks.filter(s => s.done).length
            return (
              <div key={task.id} className={`rounded-2xl bg-white/60 border transition-all ${isExpanded ? 'border-plum/20' : 'border-white/60'}`}>
                {/* Header */}
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => toggleTask(task.id)} className="flex-shrink-0 transition-all">
                    {task.status === 'concluida' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-espresso/20" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${task.status === 'concluida' ? 'text-espresso/30 line-through' : 'text-espresso'}`}>{task.title}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border ${priorityColors[task.priority]}`}>{task.priority}</span>
                      {task.subtasks.length > 0 && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{subDone}/{task.subtasks.length}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-espresso/30 flex items-center gap-1"><Calendar className="w-3 h-3" />{task.dueDate}</span>
                      <span className="text-[10px] text-espresso/30 flex items-center gap-1"><User className="w-3 h-3" />{task.assignee}</span>
                      <span className="text-[10px] text-espresso/30 flex items-center gap-1"><Tag className="w-3 h-3" />{task.category}</span>
                      {task.tags.map(t => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full text-white" style={{ background: tagColors[t] || '#7a3b69' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  {task.comments.length > 0 && (
                    <span className="text-[10px] text-espresso/30 flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />{task.comments.length}</span>
                  )}
                  <button onClick={() => setExpandedTask(isExpanded ? null : task.id)} className="p-1 rounded-lg hover:bg-white/60 transition-all">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-espresso/30" /> : <ChevronDown className="w-4 h-4 text-espresso/30" />}
                  </button>
                  <button onClick={() => deleteTask(task.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/20 hover:text-red-500 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/60">
                    {/* Description */}
                    {task.description && (
                      <p className="text-xs text-espresso/50 py-3">{task.description}</p>
                    )}

                    {/* Subtasks */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-espresso/30">Subtarefas</span>
                        <span className="text-[10px] text-espresso/20">{subDone}/{task.subtasks.length}</span>
                      </div>
                      {task.subtasks.map(st => (
                        <div key={st.id} className="flex items-center gap-2 py-1">
                          <button onClick={() => toggleSubtask(task.id, st.id)}>
                            {st.done ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-espresso/20" />}
                          </button>
                          <span className={`text-xs ${st.done ? 'line-through text-espresso/30' : 'text-espresso/60'}`}>{st.title}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 mt-1">
                        <Plus className="w-3.5 h-3.5 text-espresso/20" />
                        <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubtask(task.id)}
                          placeholder="Nova subtarefa..." className="flex-1 px-2 py-1 bg-transparent text-xs text-espresso placeholder:text-espresso/20 focus:outline-none border-b border-transparent focus:border-plum/30" />
                      </div>
                    </div>

                    {/* Comments */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-espresso/30">Comentarios</span>
                        <span className="text-[10px] text-espresso/20">{task.comments.length}</span>
                      </div>
                      {task.comments.map(c => (
                        <div key={c.id} className="flex items-start gap-2 py-1.5">
                          <div className="w-6 h-6 rounded-full bg-plum/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] text-plum font-medium">{c.author[0]}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-espresso">{c.author}</span>
                              <span className="text-[9px] text-espresso/20">{c.date}</span>
                            </div>
                            <p className="text-xs text-espresso/50">{c.text}</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 mt-2">
                        <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment(task.id)}
                          placeholder="Adicionar comentario..." className="flex-1 px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                        <button onClick={() => addComment(task.id)} className="p-2 bg-plum text-cream rounded-lg hover:shadow-glow transition-all">
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* KANBAN VIEW */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-3 gap-4">
          {(['pendente', 'em-andamento', 'concluida'] as const).map(status => (
            <div key={status} className="rounded-2xl bg-white/30 border border-white/60 p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-espresso">
                  {status === 'pendente' ? 'Pendente' : status === 'em-andamento' ? 'Em andamento' : 'Concluida'}
                </span>
                <span className="text-[10px] text-espresso/30">{filtered.filter(t => t.status === status).length}</span>
              </div>
              <div className="space-y-2">
                {filtered.filter(t => t.status === status).map(task => (
                  <div key={task.id} className="p-3 bg-white/60 rounded-xl cursor-pointer hover:shadow-md transition-all" onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}>
                    <div className="text-xs font-medium text-espresso mb-1">{task.title}</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${priorityColors[task.priority]}`}>{task.priority}</span>
                      <span className="text-[9px] text-espresso/30 flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{task.dueDate}</span>
                    </div>
                    {task.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {task.tags.map(t => <span key={t} className="text-[8px] px-1 py-0.5 rounded text-white" style={{ background: tagColors[t] || '#7a3b69' }}>{t}</span>)}
                      </div>
                    )}
                    {task.subtasks.length > 0 && (
                      <div className="mt-1.5 w-full h-1 bg-canvas rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: `${(task.subtasks.filter(s => s.done).length / task.subtasks.length) * 100}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
