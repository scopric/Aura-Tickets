import { describe, it, expect, vi } from 'vitest'
vi.mock('../lib/supabase', () => ({ supabase: {} }))
import { prepararLogo } from '../lib/logoProdutor'

describe('prepararLogo: recusas antes de tocar na imagem', () => {
  it('só PNG, JPG e WebP', async () => {
    await expect(prepararLogo(new File(['<svg/>'], 'l.svg', { type: 'image/svg+xml' }))).rejects.toThrow('PNG, JPG ou WebP')
  })
  it('mais de 5 MB', async () => {
    await expect(prepararLogo(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'l.png', { type: 'image/png' }))).rejects.toThrow('no máximo 5 MB')
  })
})
