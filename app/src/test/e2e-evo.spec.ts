import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Evo 3D no laboratório /dev/evo (Fase 3 do Modo Refero). A rota só existe em desenvolvimento ou com VITE_LAB=1.
// Com PW_CSP=1 a política de segurança de conteúdo do vercel.json é aplicada ao HTML, como a Vercel faz em produção;
// isso só funciona contra o build (`VITE_LAB=1 npm run build && npx vite preview`), porque o servidor de
// desenvolvimento usa scripts inline que a CSP barra. Ex.:
//   PW_CSP=1 PW_BASE_URL=http://localhost:4173 PW_CHANNEL=chrome npx playwright test e2e-evo --project=chromium
const vercel = JSON.parse(readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../vercel.json'), 'utf8')) as {
  headers: { source: string; has?: unknown; headers: { key: string; value: string }[] }[]
}
const csp = vercel.headers.filter(h => !h.has).flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy')!.value

async function comCsp(page: Page) {
  if (process.env.PW_CSP !== '1') return
  await page.route('**/*', async route => {
    if (route.request().resourceType() !== 'document') return route.continue()
    const r = await route.fetch()
    await route.fulfill({ response: r, headers: { ...r.headers(), 'content-security-policy': csp } })
  })
}

const canvas = (page: Page) => page.locator('[data-testid="evo3d"] canvas')
const pronta = (page: Page) => canvas(page).and(page.locator('.pronta'))
// `toBeVisible` aceita opacity 0: o poster "voltou" só quando a opacidade computada é 1
const posterOpaco = (page: Page) => page.getByTestId('evo3d').locator('picture').evaluate(el => getComputedStyle(el).opacity)
// Navegação interna pelo roteador (sem recarregar): só assim o desmonte do componente é o que libera o contexto
const irPara = (page: Page, caminho: string) => page.evaluate(c => { history.pushState({}, '', c); dispatchEvent(new PopStateEvent('popstate')) }, caminho)
const PRONTA_MS = 20000 // com page.route o cache desliga e cada volta baixa o glb de 1,4 MB de novo

test.describe('Evo 3D', () => {
  test('com movimento reduzido fica no poster e não cria canvas', async ({ page }) => {
    await comCsp(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/dev/evo')
    await expect(page.getByTestId('evo3d').locator('img')).toBeVisible()
    await page.waitForTimeout(3000)
    await expect(canvas(page)).toHaveCount(0)
    expect(await posterOpaco(page)).toBe('1')
  })

  test('no ambiente comum a cena fica pronta em até 20 s, sem erro de CSP', async ({ page }) => {
    const erros: string[] = []
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') erros.push(m.text()) })
    await comCsp(page)
    await page.goto('/dev/evo')
    await expect(pronta(page)).toHaveCount(1, { timeout: PRONTA_MS })
    await expect.poll(() => posterOpaco(page)).toBe('0')
    expect(erros.filter(e => /Content Security Policy|Evo:/.test(e))).toEqual([])
  })

  test('perda de contexto WebGL volta ao poster', async ({ page }) => {
    await comCsp(page)
    await page.goto('/dev/evo')
    await expect(pronta(page)).toHaveCount(1, { timeout: PRONTA_MS })
    await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('[data-testid="evo3d"] canvas')!
      c.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext()
    })
    await expect(pronta(page)).toHaveCount(0)
    await expect.poll(() => posterOpaco(page)).toBe('1')
  })

  test('dez idas e voltas pelo roteador entre /termos e /dev/evo deixam zero contextos WebGL vivos', async ({ page }) => {
    // /termos é a rota sem cena: a Home ganhou o Evo na Fase 4 e não serve mais de "lado sem canvas"
    // Conta contextos criados e perdidos pela própria página (instrumenta getContext antes de qualquer script)
    await page.addInitScript(() => {
      const w = window as unknown as { __gl: { criados: number; vivos: number } }
      w.__gl = { criados: 0, vivos: 0 }
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, tipo: string, ...resto: unknown[]) {
        const ctx = (original as (this: HTMLCanvasElement, t: string, ...r: unknown[]) => RenderingContext | null).call(this, tipo, ...resto)
        if (tipo === 'webgl2' && ctx && !this.dataset.contado) {
          this.dataset.contado = '1'; w.__gl.criados++; w.__gl.vivos++
          this.addEventListener('webglcontextlost', () => { w.__gl.vivos-- })
        }
        return ctx
      }
    })
    await comCsp(page)
    await page.goto('/termos')
    for (let i = 0; i < 10; i++) {
      await irPara(page, '/dev/evo')
      await expect(pronta(page)).toHaveCount(1, { timeout: PRONTA_MS })
      await irPara(page, '/termos')
      await expect(canvas(page)).toHaveCount(0)
    }
    const gl = () => page.evaluate(() => (window as unknown as { __gl: { criados: number; vivos: number } }).__gl)
    expect((await gl()).criados).toBeGreaterThanOrEqual(10)
    // No StrictMode (dev) a 2ª montagem ainda pode estar baixando o glb na última volta: o contexto dela só é perdido quando
    // a carga termina e o desmonte a destrói; a perda forçada também dispara o evento de forma assíncrona. Daí a espera longa.
    await expect.poll(async () => (await gl()).vivos, { timeout: PRONTA_MS }).toBe(0)
  })

  test('o chunk do three só é pedido onde há cena: /termos não pede, a Home pede', async ({ page }) => {
    // Fase 4: a Home é a única página pública com o Evo; o pacote de entrada e as outras páginas não podem baixar o three
    const pedidos: string[] = []
    page.on('request', r => { if (/\/assets\/cena-[^/]+\.js$|\/evo3d\/cena\.ts/.test(r.url())) pedidos.push(r.url()) })
    await comCsp(page)
    await page.goto('/termos')
    await expect(page.getByRole('heading').first()).toBeVisible()
    expect(pedidos).toEqual([])
    await page.goto('/')
    await expect(page.getByTestId('evo3d').locator('img')).toBeVisible()
    await expect.poll(() => pedidos.length, { timeout: PRONTA_MS }).toBeGreaterThan(0)
  })
})
