import { test, expect } from '@playwright/test'

// Fase 2, bloco A: rodapé com links reais, sem "em breve" nem domínio inexistente; Microsoft escondido; /checkout vazio avisa.
test.describe('Front 2A — navegação e rótulos', () => {
  test('rodapé: Dashboard vai ao app, Eventos e Contato abrem as páginas; nada de Brand Studio/Sobre/Carreiras', async ({ page }) => {
    await page.goto('/')
    const footer = page.getByRole('contentinfo')
    // em produção e em localhost o href é absoluto (app.*); num preview da Vercel, appUrl devolve o caminho relativo
    await expect(footer.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', /^(https?:\/\/app\.[^/]+)?\/producer\/dashboard$/)
    for (const label of ['Brand Studio', 'Sobre', 'Carreiras']) {
      await expect(footer.getByText(label, { exact: true })).toHaveCount(0)
    }
    await footer.getByRole('link', { name: 'Contato' }).click()
    await expect(page).toHaveURL(/\/contato$/)
    await page.goto('/')
    await footer.getByRole('link', { name: 'Eventos' }).click()
    await expect(page).toHaveURL(/\/events$/)
  })

  test('nenhum link para evokaa.events ou aura.events na Home, no catálogo e no contato', async ({ page }) => {
    for (const path of ['/', '/events', '/contato']) {
      await page.goto(path)
      const hrefs = await page.locator('a[href]').evaluateAll(as => as.map(a => a.getAttribute('href') || ''))
      expect(hrefs.filter(h => /evokaa\.events|aura\.events/.test(h))).toEqual([])
    }
  })

  test('login: Google e Apple aparecem, Microsoft não (Decisão 23)', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar com Apple' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Microsoft/ })).toHaveCount(0)
  })

  test('/checkout sem carrinho mostra "Seu carrinho está vazio" e leva ao catálogo', async ({ page }) => {
    await page.goto('/checkout')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
    await page.getByRole('link', { name: 'Ver eventos' }).click()
    await expect(page).toHaveURL(/\/events$/)
  })
})
