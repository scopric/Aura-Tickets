import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Credenciais dos e2e com conta real (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD) vêm de app/.env.local, nunca do código.
const envLocal = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env.local')
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2') // aceita CHAVE="valor"
  }
}

export default defineConfig({
  testDir: './src/test',
  testMatch: '**/e2e-*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:3000', // PW_BASE_URL para testar outro servidor já de pé (ex.: worktree na 3001)
    // o trace grava o POST de login (com a senha) em test-results/: só no CI
    trace: process.env.CI ? 'on-first-retry' : 'off',
    screenshot: 'only-on-failure',
    // vídeo exige o ffmpeg do Playwright (não baixado neste Mac); só no CI
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      // PW_CHANNEL=chrome usa o Google Chrome instalado (o Chromium do Playwright não está baixado neste Mac)
      use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'], channel: process.env.PW_CHANNEL },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    env: { VITE_RECAPTCHA_SITE_KEY: process.env.VITE_RECAPTCHA_SITE_KEY || 'teste' }, // o e2e do Pix troca o script do Google; sem chave a tela diz "Pagamento indisponível"
    url: process.env.PW_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
