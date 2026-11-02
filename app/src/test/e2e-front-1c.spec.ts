import { test, expect } from '@playwright/test'

// PR 1C (Decisão 25): visitante não vê eventos de exemplo; vitrine vazia mostra convite.
test('visitante: evento de exemplo do código não abre e a vitrine vazia mostra convite', async ({ page }) => {
  await page.goto('/event/evt-001') // id dos eventos de exemplo do código (MOCK_EVENTS); só conta demo em desenvolvimento os vê
  await expect(page.getByText(/Evento Não Encontrado/i)).toBeVisible({ timeout: 15000 }) // a consulta ao banco pode demorar
  await page.goto('/events')
  await expect(page.getByRole('heading', { level: 1, name: 'Explorar' })).toBeVisible()
  await expect(page.getByText('Festival de Verão 2026')).toHaveCount(0) // evento de exemplo do código
})

test('visitante: Home sem evento aprovado mostra o convite em vez do carrossel de exemplo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Festival de Verão 2026')).toHaveCount(0) // evento de exemplo do código
  // useFeaturedEvents completa a vitrine com qualquer evento aprovado e futuro: com evento no banco aparece a lista
  // real (Home v3, Fase 4), sem evento aparece o convite; os dois valem, o que não vale é o exemplo do código
  await expect(page.getByTestId('vitrine-vazia').or(page.locator('a[href^="/event/"]').first())).toBeVisible({ timeout: 15000 })
})
