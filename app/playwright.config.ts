import { defineConfig, devices } from '@playwright/test'

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
    trace: 'on-first-retry',
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
    url: process.env.PW_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
