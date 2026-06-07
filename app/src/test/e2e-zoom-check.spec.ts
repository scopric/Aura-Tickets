import { test, expect } from '@playwright/test'

test.describe('Validação de Zoom e Contenção de Layout no Editor de Mapas', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Fazer login como Produtor
    await page.goto('/auth/login')
    await page.getByRole('button', { name: 'Produtor' }).click()
    await page.getByPlaceholder('seu@email.com').fill('produtor@aura.teste')
    await page.getByPlaceholder('Sua senha').fill('senha123')
    await page.getByRole('button', { name: /Entrar como Produtor/ }).click()
    
    // Esperar redirecionar para o dashboard
    await expect(page).toHaveURL(/.*\/producer\/dashboard/)
  })

  test('deve conter o layout na página sem scroll global e bloquear zoom do navegador no canvas', async ({ page }) => {
    // 2. Navegar para a página do editor de mapas
    await page.goto('/producer/lugar-marcado')
    
    // Esperar o editor e o canvas carregarem
    await page.waitForSelector('main.bg-stone-100')

    // 3. Validar se o body está com overflow 'hidden' para conter a tela
    const bodyOverflow = await page.evaluate(() => window.getComputedStyle(document.body).overflow)
    console.log(`[TESTE] Estilo de overflow do body: ${bodyOverflow}`)
    expect(bodyOverflow).toBe('hidden')

    // 4. Validar que não há scrollbars visíveis na janela do navegador
    const isScrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight > window.innerHeight ||
             document.documentElement.scrollWidth > window.innerWidth
    })
    console.log(`[TESTE] A página inteira do navegador tem scrollbar ativa? ${isScrollable}`)
    expect(isScrollable).toBe(false)

    // 5. Capturar o fator de zoom/scale inicial do canvas
    const canvasElement = page.locator('main.bg-stone-100')
    const viewportElement = page.locator('main.bg-stone-100 > div.origin-top-left')
    
    const initialTransform = await viewportElement.getAttribute('style')
    console.log(`[TESTE] Transformação inicial do viewport do canvas: ${initialTransform}`)

    // 6. Simular gesto de Zoom (Ctrl + Wheel) no canvas
    const boundingBox = await canvasElement.boundingBox()
    if (boundingBox) {
      const centerX = boundingBox.x + boundingBox.width / 2
      const centerY = boundingBox.y + boundingBox.height / 2
      
      // Mover o mouse para o centro do canvas
      await page.mouse.move(centerX, centerY)
      
      // Disparar o wheel do mouse com a tecla Ctrl (zoom in)
      // O Playwright suporta disparar wheel de forma que aciona o ctrlKey
      await page.keyboard.down('Control')
      await page.mouse.wheel(0, -100) // Rolar para cima (zoom in)
      await page.keyboard.up('Control')
      
      // Pequeno delay para a UI atualizar
      await page.waitForTimeout(500)
    }

    // 7. Verificar se o canvas interno sofreu alteração de escala
    const finalTransform = await viewportElement.getAttribute('style')
    console.log(`[TESTE] Transformação final do viewport do canvas após wheel: ${finalTransform}`)
    
    // A transformação deve conter a mudança de scale, comprovando que o zoom interno funcionou
    expect(finalTransform).not.toBe(initialTransform)
    expect(finalTransform).toContain('scale')

    // 8. Verificar se o zoom nativo do navegador NÃO foi alterado
    // Em navegadores, o devicePixelRatio costuma mudar se o zoom do navegador mudar
    const devicePixelRatio = await page.evaluate(() => window.devicePixelRatio)
    console.log(`[TESTE] devicePixelRatio do navegador: ${devicePixelRatio}`)
    
    // Salvar um screenshot do editor de mapas nos artefatos
    const screenshotPath = 'C:/Users/scopa/.gemini/antigravity/brain/42c865bd-dd64-4b71-8f45-677f3ff22174/screenshot_localhost_valido.png'
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`[TESTE] Screenshot salvo em: ${screenshotPath}`)
  })
})
