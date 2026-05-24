import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, Play, Clock, Award, Users, Star,
  Lock, CheckCircle2, Search, TrendingUp, Zap
} from 'lucide-react'
import { toast } from 'sonner'

interface Course {
  id: string
  title: string
  description: string
  instructor: string
  duration: string
  lessons: number
  level: 'iniciante' | 'intermediario' | 'avancado'
  category: string
  students: number
  rating: number
  completed: boolean
  progress: number
  thumbnail: string
  locked: boolean
}

const courses: Course[] = [
  {
    id: '1', title: 'Como Criar seu Primeiro Evento', description: 'Do zero ao primeiro ingresso vendido. Aprenda a criar, configurar e publicar um evento completo na Evokaa.',
    instructor: 'Mariana Costa', duration: '2h 30min', lessons: 12, level: 'iniciante', category: 'Producao',
    students: 2340, rating: 4.9, completed: true, progress: 100, thumbnail: '', locked: false,
  },
  {
    id: '2', title: 'Marketing de Eventos que Vende', description: 'Estrategias praticas para vender mais ingressos usando redes sociais, email marketing e parcerias.',
    instructor: 'Pedro Lima', duration: '3h 15min', lessons: 18, level: 'intermediario', category: 'Marketing',
    students: 1890, rating: 4.8, completed: false, progress: 65, thumbnail: '', locked: false,
  },
  {
    id: '3', title: 'Precificacao Inteligente', description: 'Como definir o preco ideal do ingresso. Analise de custos, concorrencia e elasticidade de demanda.',
    instructor: 'Ana Beatriz', duration: '1h 45min', lessons: 8, level: 'intermediario', category: 'Financeiro',
    students: 1560, rating: 4.7, completed: false, progress: 30, thumbnail: '', locked: false,
  },
  {
    id: '4', title: 'Gestao de Fornecedores', description: 'Encontre, negocie e gerencie fornecedores para seu evento. Contratos, briefings e controle de qualidade.',
    instructor: 'Carlos Mendes', duration: '2h 00min', lessons: 10, level: 'intermediario', category: 'Producao',
    students: 980, rating: 4.6, completed: false, progress: 0, thumbnail: '', locked: false,
  },
  {
    id: '5', title: 'Check-in e Operacao na Porta', description: 'Tudo sobre credenciamento, controle de acesso, filas e experiencia do participante na entrada.',
    instructor: 'Julia Ramos', duration: '1h 30min', lessons: 7, level: 'iniciante', category: 'Operacao',
    students: 1200, rating: 4.8, completed: false, progress: 0, thumbnail: '', locked: false,
  },
  {
    id: '6', title: 'Afiliados e Promoters', description: 'Monte uma rede de vendedores, configure comissoes e acompanhe resultados em tempo real.',
    instructor: 'Lucas Oliveira', duration: '2h 45min', lessons: 14, level: 'avancado', category: 'Vendas',
    students: 750, rating: 4.9, completed: false, progress: 0, thumbnail: '', locked: true,
  },
  {
    id: '7', title: 'Prevenção de Assedio em Eventos', description: 'Protocolos, treinamento de equipe e criacao de ambientes seguros para todos os participantes.',
    instructor: 'Fernanda Silva', duration: '1h 15min', lessons: 6, level: 'iniciante', category: 'Seguranca',
    students: 2100, rating: 4.9, completed: false, progress: 0, thumbnail: '', locked: false,
  },
  {
    id: '8', title: 'Analytics e Tomada de Decisao', description: 'Leia dados, identifique tendencias e tome decisoes baseadas em numeros para seu evento.',
    instructor: 'Ricardo Souza', duration: '2h 00min', lessons: 11, level: 'avancado', category: 'Analytics',
    students: 640, rating: 4.7, completed: false, progress: 0, thumbnail: '', locked: true,
  },
]

const levelColors: Record<string, string> = {
  iniciante: '#22c55e',
  intermediario: '#f59e0b',
  avancado: '#ef4444',
}

const levelLabels: Record<string, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediario',
  avancado: 'Avancado',
}

export default function EvokaaAcademy() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [myCourses, setMyCourses] = useState(courses)

  const categories = ['all', ...new Set(courses.map(c => c.category))]

  const filtered = myCourses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const completedCount = myCourses.filter(c => c.completed).length
  const totalStudents = myCourses.reduce((s, c) => s + c.students, 0)
  const inProgress = myCourses.filter(c => c.progress > 0 && !c.completed).length

  const handleEnroll = (id: string) => {
    setMyCourses(myCourses.map(c => c.id === id ? { ...c, locked: false, progress: c.progress || 5 } : c))
    toast.success('Matricula realizada!')
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/dashboard" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">Evokaa Academy</h1>
          <p className="text-sm text-espresso/50 mt-1">Cursos gratuitos para se tornar um produtor de eventos de sucesso</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Cursos', value: myCourses.length.toString(), icon: BookOpen },
          { label: 'Completados', value: completedCount.toString(), icon: CheckCircle2 },
          { label: 'Em Progresso', value: inProgress.toString(), icon: TrendingUp },
          { label: 'Alunos', value: `${(totalStudents / 1000).toFixed(1)}K`, icon: Users },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 text-plum mb-3" />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cursos..." className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${categoryFilter === cat ? 'bg-plum text-cream' : 'bg-white/60 border border-white/60 text-espresso/40 hover:text-espresso'}`}>
              {cat === 'all' ? 'Todos' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(course => (
          <div key={course.id} className={`p-5 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-lg ${course.locked ? 'bg-white/30 border-white/40 opacity-70' : 'bg-white/60 border-white/60'}`}>
            <div className="flex items-start gap-4">
              {/* Thumbnail placeholder */}
              <div className="w-20 h-20 rounded-xl bg-plum/10 flex-shrink-0 flex items-center justify-center">
                <Play className={`w-8 h-8 ${course.locked ? 'text-espresso/20' : 'text-plum'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-espresso truncate">{course.title}</h3>
                  {course.locked && <Lock className="w-3.5 h-3.5 text-espresso/30 flex-shrink-0" />}
                </div>
                <p className="text-xs text-espresso/40 mb-2 line-clamp-2">{course.description}</p>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white" style={{ background: levelColors[course.level] }}>{levelLabels[course.level]}</span>
                  <span className="text-[10px] text-espresso/30">{course.category}</span>
                  <span className="text-[10px] text-espresso/30 flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-400" />{course.rating}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-espresso/30 mb-2">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{course.students.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.duration}</span>
                  <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{course.lessons} aulas</span>
                </div>
                {/* Progress */}
                {!course.locked && course.progress > 0 && (
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-espresso/30">{course.completed ? 'Concluido' : 'Progresso'}</span>
                      <span className="text-plum">{course.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden">
                      <div className="h-full bg-plum rounded-full transition-all" style={{ width: `${course.progress}%` }} />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {course.locked ? (
                    <button onClick={() => handleEnroll(course.id)} className="px-4 py-1.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Desbloquear
                    </button>
                  ) : course.completed ? (
                    <span className="px-3 py-1.5 bg-green-50 text-green-600 text-xs rounded-full flex items-center gap-1">
                      <Award className="w-3 h-3" /> Concluido
                    </span>
                  ) : course.progress > 0 ? (
                    <button className="px-4 py-1.5 bg-plum/10 text-plum text-xs rounded-full hover:bg-plum hover:text-cream transition-all flex items-center gap-1">
                      <Play className="w-3 h-3" /> Continuar
                    </button>
                  ) : (
                    <button className="px-4 py-1.5 bg-plum/10 text-plum text-xs rounded-full hover:bg-plum hover:text-cream transition-all flex items-center gap-1">
                      <Play className="w-3 h-3" /> Iniciar
                    </button>
                  )}
                  <span className="text-[10px] text-espresso/20">por {course.instructor}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-espresso/10 mx-auto mb-4" />
          <p className="text-espresso/30 text-sm">Nenhum curso encontrado</p>
        </div>
      )}
    </div>
  )
}
