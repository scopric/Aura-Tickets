import { test, expect } from '@playwright/test'

// PR 4B: vírgula, parênteses e aspas na busca de eventos quebravam o filtro .or() do PostgREST (erro 400).
// V11b: o Explorar filtra no navegador (sem .or() no banco); a busca com esses caracteres continua sem erro.
test('busca de eventos aceita vírgula, parênteses e aspas sem erro', async ({ page }) => {
  const erros: string[] = []
  page.on('pageerror', e => erros.push(e.message))
  await page.goto('/events')
  await page.getByPlaceholder('Evento, local ou cidade').fill('rock, (ao "vivo")')
  await expect(page.getByText('Nada para “rock, (ao "vivo")”.')).toBeVisible()
  await page.getByRole('button', { name: 'Limpar busca' }).first().click()
  await expect(page.getByPlaceholder('Evento, local ou cidade')).toHaveValue('')
  expect(erros).toEqual([])
})
