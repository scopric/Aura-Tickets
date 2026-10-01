import { test, expect, type Page } from '@playwright/test'
import { PRIVACY_VERSION } from '../lib/legal'

// PR 4A: restos da Fase 3 — sem números e promessas que o sistema não cumpre. Conta de demonstração (só em desenvolvimento).
async function entrarProdutor(page: Page) {
  // o aviso da Política de Privacidade, fixo no topo, cobre o "Convidar" no celular: entra como já fechado
  await page.addInitScript(v => localStorage.setItem(`aviso-politica-${v}`, '1'), PRIVACY_VERSION)
  await page.goto('/auth/login')
  await page.getByRole('button', { name: 'Produtor', exact: true }).first().click()
  await page.getByPlaceholder('seu@email.com').fill('produtor@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar como Produtor/ }).first().click()
  await page.waitForURL(u => !u.toString().includes('/auth/login'))
}

test('Equipe do produtor sem contagem de tarefas (não há tarefas) e com "Adicionar membro"', async ({ page }) => {
  await entrarProdutor(page)
  await page.goto('/producer/team')
  await expect(page.getByText('Total Membros')).toBeVisible()
  await expect(page.getByText(/Tarefas Ativas|Tarefas Concluídas|Atribuídas/)).toHaveCount(0)
  await page.getByRole('button', { name: /Convidar/ }).first().click()
  await expect(page.getByRole('button', { name: /Adicionar membro/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Enviar Convite/ })).toHaveCount(0)
})
