import { test, expect } from '@playwright/test'

// PR 2D: no celular os avisos (toasts) aparecem no topo, para não cobrir o botão principal dos formulários;
// no computador continuam no canto inferior direito.
test('aviso do rodapé (e-mail inválido) aparece no topo no celular e embaixo no computador', async ({ page }, testInfo) => {
  await page.goto('/')
  const footer = page.getByRole('contentinfo')
  // 'a@b' passa na validação nativa do <input type="email"> (senão o envio nem acontece) e falha na regra do site (exige ponto)
  await footer.getByPlaceholder('seu@email.com').fill('a@b')
  await footer.getByRole('button', { name: 'Assinar' }).click()
  const toast = page.getByText('Por favor, insira um e-mail válido.')
  await expect(toast).toBeVisible()
  const box = await toast.boundingBox()
  const viewport = page.viewportSize()!
  expect(box).not.toBeNull()
  if (testInfo.project.name.startsWith('Mobile')) {
    expect(box!.y).toBeLessThan(viewport.height / 2)
  } else {
    expect(box!.y).toBeGreaterThan(viewport.height / 2)
  }
})
