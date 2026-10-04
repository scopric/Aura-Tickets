import { test, expect, type Page } from '@playwright/test'

// Fase 3, bloco A: Antecipação e Borderô (dados de exemplo) viram "Em construção"; a tela de sucesso do checkout
// não mostra mais o Pix falso nem botões que só davam toast.
async function entrar(page: Page, aba: string, email: string, botao: RegExp) {
  await page.goto('/auth/login')
  await page.getByRole('button', { name: aba, exact: true }).first().click()
  await page.getByPlaceholder('seu@email.com').fill(email)
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: botao }).first().click()
  await page.waitForURL(u => !u.toString().includes('/auth/login'))
}

test('produtor: Antecipação mostra "Em construção" e o Borderô mostra a tela real, sem o borderô de exemplo', async ({ page }) => {
  await entrar(page, 'Produtor', 'produtor@aura.teste', /Entrar como Produtor/)
  await page.goto('/producer/antecipacao')
  await expect(page.getByRole('heading', { name: 'Em construção' })).toBeVisible()
  await page.goto('/producer/bordero')
  await expect(page.getByRole('heading', { name: 'Borderô', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Em construção' })).toHaveCount(0)
  await expect(page.getByText(/147\.600|Noite Eletro/)).toHaveCount(0)
})

test('/checkout/success de um pedido Pix: sem "Pague com Pix" falso; "Ver meus ingressos" no lugar do download', async ({ page }) => {
  await page.goto('/')
  // o estado do react-router (history.state.usr) só chega pela navegação: empilha a tela com estado e volta a ela
  await page.evaluate(() => {
    history.pushState({ usr: { orderId: '00000000-0000-0000-0000-000000000000', paymentMethod: 'pix' }, key: 'e2e3a', idx: 1 }, '', '/checkout/success')
    history.pushState({ usr: null, key: 'e2e3b', idx: 2 }, '', '/')
    history.back()
  })
  await expect(page).toHaveURL(/\/checkout\/success$/)
  await expect(page.getByRole('link', { name: 'Ver meus ingressos' })).toHaveAttribute('href', '/app/tickets')
  await expect(page.getByText(/Pague com Pix|Copiar Código Pix|Enviar por E-mail|Baixar Ingresso/)).toHaveCount(0)
  // pedido sem ingresso ativo (Decisão 57: nasce pendente) → "Pedido registrado!"; nada de "Pedido Reservado" nem "Realize o pagamento"
  await expect(page.getByRole('heading', { name: 'Pedido registrado!', level: 1 })).toBeVisible()
  await expect(page.getByText(/Pedido Reservado|Realize o pagamento|Enviamos os detalhes/)).toHaveCount(0)
})
