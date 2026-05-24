import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface Task {
  id: string
  event_id: string
  title: string
  description: string | null
  assignee_id: string | null
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  created_at: string
  updated_at: string
}

const DEMO_TASKS: Task[] = [
  { id: 't1', event_id: 'evt-001', title: 'Confirmar som e iluminação', description: 'Ligar para a empresa de som', assignee_id: null, status: 'in_progress', priority: 'high', due_date: '2025-12-15T18:00:00Z', created_at: '2025-11-01T10:00:00Z', updated_at: '2025-11-05T14:00:00Z' },
  { id: 't2', event_id: 'evt-001', title: 'Imprimir pulseiras de acesso', description: 'Enviar arte para gráfica', assignee_id: null, status: 'todo', priority: 'medium', due_date: '2025-12-18T12:00:00Z', created_at: '2025-11-02T10:00:00Z', updated_at: '2025-11-02T10:00:00Z' },
  { id: 't3', event_id: 'evt-002', title: 'Confirmar palestrantes', description: 'Enviar e-mail de confirmação', assignee_id: null, status: 'done', priority: 'high', due_date: '2025-11-01T10:00:00Z', created_at: '2025-10-15T09:00:00Z', updated_at: '2025-10-20T16:00:00Z' },
]

export function useTasks(eventId?: string) {
  const { user } = useAuth()

  return useQuery<Task[]>({
    queryKey: ['tasks', eventId, user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      if (user.id === 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4') {
        return eventId ? DEMO_TASKS.filter(t => t.event_id === eventId) : DEMO_TASKS
      }

      let query = supabase.from('tasks').select('*')
      if (eventId) query = query.eq('event_id', eventId)

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) {
        console.warn('Erro ao buscar tasks:', error)
        return eventId ? DEMO_TASKS.filter(t => t.event_id === eventId) : DEMO_TASKS
      }
      return (data || []) as Task[]
    },
    enabled: !!user?.id,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (task: Partial<Task>) => {
      const { data, error } = await supabase.from('tasks').insert(task).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
