import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import {
  useAcademyCourses,
  useMyCourseProgress,
  useEnrollCourse,
} from '../../hooks/useProducerTools'
import { PageHeader, Stat, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const levelLabels: Record<string, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

// academy_courses não tem aula nem vídeo (só título, descrição e contagens): não há para onde "Continuar"
const SEM_AULAS = 'As aulas ainda não estão disponíveis na plataforma. A matrícula fica guardada para quando forem publicadas.'

export default function EvokaaAcademy() {
  const { data: courses = [], isLoading: coursesLoading, isError, refetch, isFetching } = useAcademyCourses()
  const { data: progress = [], isLoading: progressLoading } = useMyCourseProgress()
  const enroll = useEnrollCourse()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const categories = useMemo(() => ['all', ...new Set(courses.map(c => c.category).filter((c): c is string => !!c))], [courses])

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
  const enrolledCount = mergedCourses.filter(c => c.enrolled).length

  const handleEnroll = async (courseId: string) => {
    try {
      await enroll.mutateAsync(courseId)
      toast.success('Matrícula feita.')
    } catch {
      toast.error('Não foi possível fazer a matrícula.')
    }
  }

  const header = <PageHeader title="Academy" description="Cursos gratuitos para produtores de eventos" />

  if (coursesLoading || progressLoading) {
    return (
      <div aria-busy="true">
        {header}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
        <Skeleton className="mt-6 h-48 rounded-[10px] bg-muted" />
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        {header}
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar os cursos.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching}>
            Tentar de novo
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Cursos" value={courses.length} />
        <Stat label="Matrículas" value={enrolledCount} />
        <Stat label="Concluídos" value={completedCount} />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{SEM_AULAS}</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <I.Buscar aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cursos" aria-label="Buscar cursos" className="pl-9" />
        </div>
        {categories.length > 1 && (
          <div role="group" aria-label="Filtrar por categoria" className="flex flex-wrap gap-1">
            {categories.map(cat => (
              <Button key={cat} size="sm" variant={categoryFilter === cat ? 'secondary' : 'ghost'} aria-pressed={categoryFilter === cat}
                onClick={() => setCategoryFilter(cat)} className={categoryFilter === cat ? '' : 'text-muted-foreground hover:text-foreground'}>
                {cat === 'all' ? 'Todos' : cat}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        {filtered.length === 0 ? (
          <EmptyState title={courses.length === 0 ? 'Nenhum curso publicado ainda' : 'Nenhum curso com esse filtro'} />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered.map(course => (
              <div key={course.id} className="rounded-[10px] border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 text-sm font-medium text-foreground">{course.title}</h2>
                  {levelLabels[course.level] && <Badge variant="secondary" className="shrink-0">{levelLabels[course.level]}</Badge>}
                </div>
                {course.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {[course.category, course.duration, course.lessons ? `${course.lessons} ${course.lessons === 1 ? 'aula' : 'aulas'}` : null, course.instructor ? `por ${course.instructor}` : null]
                    .filter(Boolean).join(' · ')}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {course.locked ? (
                    <Badge variant="outline">Bloqueado</Badge>
                  ) : course.userCompleted ? (
                    <Badge variant="secondary">Concluído</Badge>
                  ) : course.enrolled ? (
                    <>
                      <Button size="sm" variant="outline" disabled aria-describedby={`curso-${course.id}-aviso`}>Continuar</Button>
                      <span id={`curso-${course.id}-aviso`} className="text-xs text-muted-foreground">Matriculado. As aulas ainda não estão publicadas.</span>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleEnroll(course.id)} loading={enroll.isPending}>
                      Fazer matrícula
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
