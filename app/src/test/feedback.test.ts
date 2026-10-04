import { describe, it, expect, vi } from 'vitest'
import { linhaDoFeedback, MAX_MENSAGEM } from '../hooks/useFeedback'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

// A política gf_feedback_insert do banco: nota vazia (NULL) ou de 1 a 5, mensagem de 1 a 2000 caracteres.
describe('linhaDoFeedback', () => {
  const base = { type: 'bug' as const, message: '  deu erro  ' }

  it('sem estrela (0) manda NULL, não 0', () => {
    expect(linhaDoFeedback({ ...base, rating: 0 }).rating).toBeNull()
  })

  it('com estrela manda a nota (1 a 5)', () => {
    expect(linhaDoFeedback({ ...base, rating: 1 }).rating).toBe(1)
    expect(linhaDoFeedback({ ...base, rating: 5 }).rating).toBe(5)
  })

  it('apara a mensagem e corta em 2000 caracteres', () => {
    expect(linhaDoFeedback({ ...base, rating: 0 }).message).toBe('deu erro')
    expect(linhaDoFeedback({ ...base, message: 'a'.repeat(3000), rating: 0 }).message).toHaveLength(MAX_MENSAGEM)
  })
})
