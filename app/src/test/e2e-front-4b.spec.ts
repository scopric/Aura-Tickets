import { test, expect } from '@playwright/test'

// PR 4B: vírgula, parênteses e aspas na busca de eventos quebravam o filtro .or() do PostgREST (erro 400).
test('busca de eventos aceita vírgula, parênteses e aspas sem erro', async ({ page }) => {
  await page.goto('/events')
  const resposta = page.waitForResponse(r => r.url().includes('/rest/v1/events') && decodeURIComponent(r.url()).includes('rock'))
  await page.getByPlaceholder('Buscar por nome, atração ou cidade...').fill('rock, (ao "vivo")')
  expect((await resposta).status()).toBe(200)
})
