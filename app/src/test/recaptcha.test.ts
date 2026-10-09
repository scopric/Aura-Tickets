import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('recaptcha.tokenRecaptcha', () => {
  beforeEach(() => { vi.resetModules(); document.head.innerHTML = '' })
  afterEach(() => { vi.unstubAllEnvs(); delete (window as unknown as { grecaptcha?: unknown }).grecaptcha })

  it('sem chave lança "Pagamento indisponível"', async () => {
    vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', '')
    const { tokenRecaptcha } = await import('../lib/recaptcha')
    await expect(tokenRecaptcha()).rejects.toThrow('Pagamento indisponível')
    expect(document.querySelector('script')).toBeNull()
  })

  it('carrega o script uma vez e executa com a ação pagbank_checkout', async () => {
    vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', 'chave-publica')
    const execute = vi.fn(async () => 'tok')
    ;(window as unknown as { grecaptcha: unknown }).grecaptcha = { ready: (cb: () => void) => cb(), execute }
    const { tokenRecaptcha } = await import('../lib/recaptcha')
    const p1 = tokenRecaptcha(); const p2 = tokenRecaptcha()
    const scripts = document.querySelectorAll('script')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://www.google.com/recaptcha/api.js?render=chave-publica')
    scripts[0].onload!(new Event('load'))
    expect(await Promise.all([p1, p2])).toEqual(['tok', 'tok'])
    expect(execute).toHaveBeenCalledWith('chave-publica', { action: 'pagbank_checkout' })
    await tokenRecaptcha()
    expect(document.querySelectorAll('script')).toHaveLength(1)
  })
})
