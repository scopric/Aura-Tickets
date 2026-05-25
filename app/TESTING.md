# Evokaa Tickets — Testes Automatizados

Este documento descreve como executar os testes unitários e E2E do projeto.

---

## 🧪 Stack de Testes

| Tipo | Ferramenta | Uso |
|------|-----------|-----|
| Unitário | Vitest + jsdom | Hooks, componentes, utilitários |
| Componente | Testing Library React | Renderização e interação de UI |
| E2E | Playwright | Fluxos completos do usuário |
| Cobertura | V8 (built-in Vitest) | Relatório de cobertura de código |

---

## 📦 Instalação

As dependências de teste já estão no `package.json`. Instale com:

```bash
cd app
npm install
```

Para instalar os browsers do Playwright:

```bash
npx playwright install
```

---

## 🧪 Testes Unitários (Vitest)

### Executar todos os testes unitários

```bash
npm run test
```

### Executar com UI interativa

```bash
npm run test:ui
```

### Executar com cobertura

```bash
npx vitest run --coverage
```

### Estrutura dos testes unitários

```
src/test/
├── setup.ts                    # Configuração global (mocks, matchers)
├── hooks/
│   ├── useAuth.test.ts         # Testes do hook de autenticação
│   ├── usePayment.test.ts      # Testes do hook de pagamento
│   └── useCheckout.test.ts     # Testes do hook de checkout
├── components/
│   └── Login.test.tsx          # Testes do componente de login
└── e2e-*.spec.ts               # Testes E2E (Playwright)
```

---

## 🎭 Testes E2E (Playwright)

### Executar todos os testes E2E

```bash
npm run test:e2e
```

### Executar com UI interativa (modo debug)

```bash
npm run test:e2e:ui
```

### Executar em modo debug (passo a passo)

```bash
npm run test:e2e:debug
```

### Executar testes específicos

```bash
npx playwright test src/test/e2e-auth.spec.ts
```

### Browsers suportados

- Chromium (Desktop)
- Firefox (Desktop)
- WebKit (Desktop)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

### Fluxos cobertos (E2E)

1. **Autenticação** (`e2e-auth.spec.ts`)
   - Login como produtor → dashboard
   - Login como participante → hub
   - Login com credenciais inválidas
   - Recuperação de senha

2. **Checkout** (`e2e-checkout.spec.ts`)
   - Navegação evento → checkout
   - Cálculo de total
   - Validação de carrinho vazio

3. **Produtor** (`e2e-producer.spec.ts`)
   - Listagem de eventos
   - Edição de evento
   - Configurações do produtor

---

## 📝 Convenções

- Nomeie arquivos de teste com sufixo `.test.ts` (unitário) ou `.spec.ts` (E2E)
- Use `describe` para agrupar testes relacionados
- Use `beforeEach` para configurar estado inicial
- Mocks globais do Supabase estão em `src/test/setup.ts`

---

## 🎯 Checklist de Cobertura Mínima

| Módulo | Status |
|--------|--------|
| Auth (useAuth) | ✅ Testado |
| Pagamento (usePayment) | ✅ Testado |
| Checkout (useCheckout) | ✅ Testado |
| Login (componente) | ✅ Testado |
| Fluxo E2E de login | ✅ Testado |
| Fluxo E2E de checkout | ✅ Testado |
| Fluxo E2E do produtor | ✅ Testado |

---

## 🔧 Configuração dos Arquivos

- `vitest.config.ts` — Configuração do Vitest (jsdom, alias `@/`, setup)
- `playwright.config.ts` — Configuração do Playwright (browsers, baseURL, webServer)

---

## 💡 Dicas

- Para testar componentes que usam `sonner` (toasts), envolva com `<Toaster />` no wrapper
- O mock global do Supabase permite testar hooks sem chamadas reais à API
- Para E2E, o Playwright inicia automaticamente o dev server (`npm run dev`) na porta 3000
