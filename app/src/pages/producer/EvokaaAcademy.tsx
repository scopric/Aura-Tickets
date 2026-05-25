import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, Play, Clock, Award, Users, Star,
  Lock, CheckCircle2, Search, TrendingUp, Zap, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useAcademyCourses,
  useMyCourseProgress,
  useEnrollCourse,
} from '../../hooks/useProducerTools'

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
  const { data: courses = [], isLoading: coursesLoading } = useAcademyCourses()
  const { data: progress = [], isLoading: progressLoading } = useMyCourseProgress()
  const enroll = useEnrollCourse()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const categories = useMemo(() => ['all', ...new Set(courses.map(c => c.category).filter(Boolean))], [courses])

  const mergedCourses = useMemo(() => {
    return courses.map(course => {
      const p = progress.find(pr => pr.course_id === course.id)
      return {
        ...course,
        userProgress: p?.progress ?? 0,
        userCompleted: p?.completed ?? false,
        enrolled: !!p,
      }
    })
  }, [courses, progress])

  const filtered = mergedCourses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) || (c.description || '').toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const completedCount = mergedCourses.filter(c => c.userCompleted).length
  const inProgress = mergedCourses.filter(c => c.userProgress > 0 && !c.userCompleted).length

  const handleEnroll = async (courseId: string) => {
    try {
      await enroll.mutateAsync(courseId)
      toast.success('Matricula realizada!')
    } catch {
      toast.error('Erro ao realizar matricula')
    }
  }

  const isLoading = coursesLoading || progressLoading

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando cursos...</p>
      </div>
    )
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
          { label: 'Cursos', value: courses.length.toString(), icon: BookOpen },
          { label: 'Completados', value: completedCount.toString(), icon: CheckCircle2 },
          { label: 'Em Progresso', value: inProgress.toString(), icon: TrendingUp },
          { label: 'Alunos', value: `${(courses.reduce((s, c) => s + (c.students || 0), 0) / 1000).toFixed(1)}K`, icon: Users },
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
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(course.students || 0).toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{course.duration}</span>
                  <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{course.lessons} aulas</span>
                </div>
                {/* Progress */}
                {course.enrolled && course.userProgress > 0 && (
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-espresso/30">{course.userCompleted ? 'Concluido' : 'Progresso'}</span>
                      <span className="text-plum">{course.userProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden">
                      <div className="h-full bg-plum rounded-full transition-all" style={{ width: `${course.userProgress}%` }} />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {course.locked ? (
                    <button onClick={() => handleEnroll(course.id)} disabled={enroll.isPending} className="px-4 py-1.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all flex items-center gap-1 disabled:opacity-50">
                      {enroll.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Zap className="w-3 h-3" /> Desbloquear</>}
                    </button>
                  ) : course.userCompleted ? (
                    <span className="px-3 py-1.5 bg-green-50 text-green-600 text-xs rounded-full flex items-center gap-1">
                      <Award className="w-3 h-3" /> Concluido
                    </span>
                  ) : course.enrolled ? (
                    <button className="px-4 py-1.5 bg-plum/10 text-plum text-xs rounded-full hover:bg-plum hover:text-cream transition-all flex items-center gap-1">
                      <Play className="w-3 h-3" /> Continuar
                    </button>
                  ) : (
                    <button onClick={() => handleEnroll(course.id)} disabled={enroll.isPending} className="px-4 py-1.5 bg-plum/10 text-plum text-xs rounded-full hover:bg-plum hover:text-cream transition-all flex items-center gap-1 disabled:opacity-50">
                      {enroll.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3" /> Iniciar</>}
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
