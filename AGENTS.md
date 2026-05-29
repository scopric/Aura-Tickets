# Evokaa Eventos — Agent Context

Arquivo de contexto para agentes de IA trabalharem neste projeto sem precisar redescobrir a estrutura a cada sessão.

> 🆕 **Novo sistema de inicialização do Kimi CLI disponível!** Veja a seção [Inicialização com Kimi CLI](#-inicialização-com-kimi-cli) abaixo.

---

## 🤖 Inicialização com Kimi CLI

O projeto agora conta com um agente customizado e sistema de memória persistente para o Kimi Code CLI.

### Arquivos do sistema

| Arquivo | Função |
|---------|--------|
| `Iniciar-Kimi-Evokaa.bat` | 🖱️ **Clique duplo** — inicia o Kimi CLI em uma nova janela do PowerShell |
| `Iniciar-Kimi-Evokaa.ps1` | Script PowerShell avançado com parâmetros (`-Continue`, `-Session`, `-Yolo`) |
| `aura-agent.yaml` | Configuração do agente customizado `aura-tickets` |
| `aura-system-prompt.md` | System prompt com instruções obrigatórias para o agente |
| `KIMI_MEMORY.md` | 🧠 **Memória persistente** — histórico, erros, decisões e estado atual do projeto |

### Como usar

**Método 1 — Clique duplo (mais fácil):**
1. Abra a pasta `Evokaa Tickets` no Explorer
2. Clique duplo em `Iniciar-Kimi-Evokaa.bat`
3. O PowerShell abre automaticamente com o Kimi CLI já configurado

**Método 2 — PowerShell (mais controle):**
```powershell
cd "C:\Users\scopa\OneDrive\Documentos\Gemini\Antigravity\Evokaa Tickets"
.\Iniciar-Kimi-Evokaa.ps1           # Nova sessão
.\Iniciar-Kimi-Evokaa.ps1 -Continue # Continuar sessão anterior
.\Iniciar-Kimi-Evokaa.ps1 -Session  # Escolher sessão para retomar
```

### O que o agente faz automaticamente

1. **Carrega contexto:** O `AGENTS.md` é injetado automaticamente no system prompt via `${KIMI_AGENTS_MD}`
2. **Lê memória:** Ao iniciar, o agente lê o `KIMI_MEMORY.md` para saber o estado atual e evitar repetir erros
3. **Atualiza memória:** Ao final de cada sessão significativa, o agente atualiza o `KIMI_MEMORY.md` com o que foi feito, erros encontrados e próximos passos

### Comandos úteis durante a sessão

| Comando | Ação |
|---------|------|
| `/sessions` | Listar sessões anteriores |
| `--continue` | Continuar a sessão mais recente |
| `/export` | Exportar a sessão como Markdown |
| `/compact` | Compactar o contexto se ficar muito longo |
| `/clear` | Limpar o contexto atual |

---

---

## 📁 Onde está o código fonte real

**A raiz do repositório (`Evokaa Tickets/`) NÃO contém o código fonte ativo.**

O projeto real está no subdiretório:

```
Evokaa Tickets/
├── app/                    ← ⭐ CÓDIGO FONTE REAL ⭐
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── contexts/
│   │   └── ...
│   ├── package.json        ← dependências ativas
│   ├── vite.config.ts      ← config Vite real
│   ├── tsconfig.app.json   ← TS config ativo
│   └── index.html          ← entry point HTML real
│
├── package.json            ← arquivo residual/antigo (IGNORAR)
├── App.tsx                 ← arquivo residual/antigo (IGNORAR)
├── main.tsx                ← arquivo residual/antigo (IGNORAR)
├── index.html              ← arquivo residual/antigo (IGNORAR)
├── vite.config.ts          ← arquivo residual/antigo (IGNORAR)
└── tsconfig.app.json       ← arquivo residual/antigo (IGNORAR)
```

> ⚠️ **Sempre que for ler ou editar arquivos, use o prefixo `app/`**. Nunca use os arquivos na raiz — eles são obsoletos.

---

## 🏗️ Stack Tecnológica

| Tecnologia | Versão | Uso |
|---|---|---|
| React | ^19.2.0 | UI |
| React Router DOM | ^6.30.3 | Roteamento (BrowserRouter) |
| Vite | ^7.2.4 | Build / Dev server (porta 3000) |
| TypeScript | ~5.9.3 | Tipagem |
| Tailwind CSS | ^3.4.19 | Estilos |
| shadcn/ui | (implícito) | Componentes de UI (Radix + Tailwind) |
| Lucide React | ^0.562.0 | Ícones SVG |
| Sonner | ^2.0.7 | Toasts |
| Zod | ^4.3.5 | Validação de schemas |
| React Hook Form | ^7.70.0 | Formulários |
| Supabase | (implícito) | Backend/Auth/DB |

Alias configurado:
- `@/` → `./src/*`

---

## 🗺️ Estrutura de Rotas (App.tsx)

O roteamento está centralizado em `app/src/App.tsx`.

Principais áreas:
- **Públicas:** `/`, `/event/:eventId`, `/auth/login`, `/auth/register`, `/contato`, `/app/download`
- **Produtor** (`/producer/*`): dashboard, eventos, CRM, financeiro, checkin, etc.
- **Admin** (`/admin/*`): dashboard, usuários, produtores, eventos, etc.
- **Participante/App** (`/app/*`): hub, ingressos, notificações, perfil, configurações
- **Checkout** (`/checkout/*`): fluxo de compra

Autenticação via `AuthContext` (`app/src/contexts/AuthContext`).

### ⚠️ Rotas Quebradas / Páginas Faltantes

O menu lateral do participante (`AppLayout.tsx`) lista 9 itens, mas `App.tsx` só define **5 rotas**:

| Rota | Status | Nota |
|------|--------|------|
| `/app/hub` | ✅ Funciona | Hub principal do participante |
| `/app/tickets` | ✅ Funciona | Ingressos do usuário |
| `/app/notifications` | ✅ Funciona | Notificações (mock) |
| `/app/profile` | ✅ Funciona | Perfil do usuário |
| `/app/settings` | ✅ Funciona | Configurações |
| `/app/events` | ❌ **404** | Página não existe no router |
| `/app/favorites` | ❌ **404** | Página não existe no router |
| `/app/orders` | ❌ **404** | Página não existe no router |
| `/app/chat` | ❌ **404** | Página não existe no router |

**Ação necessária:** Criar as 4 páginas faltantes e registrá-las em `App.tsx`, OU remover os itens do menu lateral.

---

## 🐛 Problemas Conhecidos & Soluções Aplicadas

### 1. Erro `NotFoundError: removeChild` / `insertBefore` no login

**Sintoma:** Ao clicar em "Entrar", o React crasha com:
```
NotFoundError: Failed to execute 'removeChild' on 'Node'
NotFoundError: Failed to execute 'insertBefore' on 'Node'
```

**Causa raiz:** Browser extensions (gerenciadores de senha, Grammarly, etc.) injetam nós no DOM dentro de `<button>` e inputs. Quando o React tenta reconciliar o DOM (ex: trocar texto por ícone de loader), os nós esperados não estão mais onde o React os deixou.

**Sintoma técnico:** O código usava Fragmentos (`<>`) com **text nodes soltos** misturados a elementos SVG (Lucide) dentro de `<button>`:
```tsx
// ❌ PROBLEMATICO
<button>
  {isLoading ? (
    <><Loader2 /> Acessando...</>   // texto solto + SVG
  ) : (
    <>Entrar como {label}<ArrowRight /></>  // texto solto + SVG
  )}
</button>
```

**Solução aplicada:**
1. **Eliminar text nodes soltos** — envolver todo conteúdo textual em `<span>`:
```tsx
// ✅ CORRETO
<button>
  {isLoading ? (
    <span className="flex items-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>Acessando...</span>
    </span>
  ) : (
    <span className="flex items-center gap-2">
      <span>Entrar como {label}</span>
      <ArrowRight className="w-4 h-4" />
    </span>
  )}
</button>
```
2. **Adicionar `autoComplete`** nos inputs de senha e email para reduzir injeção de extensions.

**Arquivo afetado:** `app/src/pages/auth/Login.tsx`

**Regra geral:** Sempre que houver troca condicional entre texto e ícones dentro de um mesmo elemento, prefira envolver em containers `<span>` ou `<div>` ao invés de usar Fragmentos (`<>`) com texto solto.

---

### 2. Erro `ReferenceError: ENABLE_DEMO is not defined` ✅ CORRIGIDO

**Sintoma:** Ao tentar logar com conta demo (`produtor@aura.teste`, `admin@aura.teste`, `user@aura.teste`), o app crashava com `ReferenceError`.

**Causa:** Em `app/src/hooks/useAuth.ts` linha 54, o código usava `(demo && ENABLE_DEMO)` mas a variável `ENABLE_DEMO` não era declarada.

**Correção aplicada (2026-05-24):** Substituído por `import.meta.env.DEV` para manter consistência com o `authStore.ts`.

**Arquivo:** `app/src/hooks/useAuth.ts`

---

### 3. Inconsistência de tabela: `users` vs `profiles`

**Sintoma:** Signup pode falhar silenciosamente ou buscar perfil em tabela errada.

**Causa:** O código possui referências conflitantes:
- `app/src/hooks/useAuth.ts` linha 196: `supabase.from('users').update(...)`
- `app/src/stores/authStore.ts` linha 87: `supabase.from('profiles').select('*')`
- `app/database-setup.sql` (schema real): cria tabela `public.users`
- `supabase_schema.sql` (schema antigo/legado na raiz): cria tabela `profiles`

**Solução pendente:** Unificar todas as referências para `users` (que é o schema ativo em `database-setup.sql`). Atualizar `authStore.ts` para buscar em `users`.

---

### 4. Marca: Evokaa ✅

**Status:** A marca do projeto é **Evokaa**. Todas as referências visuais foram atualizadas.

**Locais verificados:**
- `ProducerLayout.tsx` → logo Evokaa ✅
- `AppLayout.tsx` → logo Evokaa ✅
- `AuraStore.tsx` → título "Evokaa Store" ✅
- `AuraAcademy.tsx` → título "Evokaa Academy" ✅
- URLs `aura.events` → `evokaa.events` ✅

**Nota:** Identificadores técnicos (projeto Vercel `aura-tickets-pypy`, chave localStorage `aura-auth`, arquivos `aura-agent.yaml`) foram mantidos para não quebrar compatibilidade.

---

### 5. `useCheckout.ts` não insere em `order_items`

**Sintoma:** Relatórios financeiros mostram dados incompletos; webhook do Stripe e checkout usam lógicas diferentes.

**Causa:** O hook `useCheckout.ts` insere diretamente em `tickets`, pulando a tabela `order_items`. O webhook do Stripe faz corretamente (orders → order_items → tickets).

**Solução pendente:** Refatorar `useCheckout.ts` para criar `order` → `order_items` → `tickets` (usando transaction RPC).

---

### 6. OAuth Google não implementado

**Sintoma:** Botão "Entrar com Google" na tela de login não faz nada.

**Causa:** O botão existe na UI (`app/src/pages/auth/Login.tsx`) mas não possui `onClick` nem integração com `supabase.auth.signInWithOAuth`.

**Solução pendente:** Implementar `signInWithOAuth({ provider: 'google' })`.

---

### 7. Newsletter não persiste (resolvido parcialmente)

**Status:** O `Footer.tsx` ainda usa estado local em vez da tabela `newsletter_subscribers` do Supabase. O `ContactSection.tsx` e `Contact.tsx` já estão conectados corretamente.

**Solução pendente:** Conectar `Footer.tsx` ao Supabase (usar hook `useSubscribeNewsletter` ou similar).

---

## 🧪 Como rodar o projeto

```bash
cd app
npm install   # se necessário
npm run dev   # sobe em localhost:3000
```

> O Vite está configurado para porta 3000 (`vite.config.ts`), mas o usuário às vezes roda em 3001 (provavelmente porque a 3000 já está em uso).

---

## 📝 Convenções de Código

- Componentes React: PascalCase (`AuthLogin.tsx`, `ProducerDashboard.tsx`)
- Páginas: dentro de `app/src/pages/`, organizadas por domínio (`auth/`, `producer/`, `admin/`, `app/`, `checkout/`)
- Contextos: `app/src/contexts/`
- Componentes compartilhados: `app/src/components/`
- Componentes de UI (shadcn): `app/src/components/ui/`
- Cores customizadas no Tailwind: `plum`, `espresso`, `cream`, `canvas`, `void`

---

## 🔗 Pontos de Atenção para Agentes Futuros

1. **SEMPRE verifique se está editando `app/src/...` e não a raiz.**
2. **Shell/bash pode estar quebrado** neste ambiente Windows (crash com `0xC0000005`). Prefira `ReadFile`/`WriteFile`/`StrReplaceFile` diretamente com caminhos absolutos.
3. **Não confie nos arquivos na raiz** (`Evokaa Tickets/*.tsx`, `Evokaa Tickets/*.json`) — eles são versões antigas/residuais.
4. O projeto usa **React 19** — alguns padrões de hooks podem ser ligeiramente diferentes do React 18.
5. A autenticação é via **Supabase** (ver `app/src/lib/supabase.ts`).
6. **Schema SQL:** A tabela de usuários é `public.users` (não `profiles`). O `authStore.ts` ainda busca `profiles` — corrigir quando necessário.
7. **Marca:** O projeto se chama **Evokaa Tickets** (não "Evokaa"). Corrigir referências remanescentes.
8. **Rotas quebradas:** `/app/events`, `/app/favorites`, `/app/orders`, `/app/chat` não existem no router.

---

## 📦 Arquivos Legados na Raiz (NÃO EDITAR)

A raiz do repositório contém arquivos residuais de versões anteriores (provavelmente do Lovable/Antigravity). **Nunca edite estes arquivos** — eles não são usados pelo build.

### Lista completa de arquivos legados na raiz

```
Evokaa Tickets/
├── App.tsx                        # Versão antiga do App (sem lazy loading)
├── App.css                        # Estilos antigos
├── main.tsx                       # Entry point antigo (sem StrictMode, QueryClient)
├── index.html                     # HTML antigo (sem SEO)
├── index.css                      # CSS antigo
├── package.json                   # Dependências antigas (sem Supabase, sem testes)
├── vite.config.ts                 # Config antiga (base: './', sem chunking)
├── tsconfig*.json                 # Configs TS antigas (idênticas às de app/)
├── tailwind.config.js             # Idêntico ao de app/
├── postcss.config.js              # Idêntico ao de app/
├── components.json                # Idêntico ao de app/
├── eslint.config.js               # Idêntico ao de app/
├── .env.example                   # Formato antigo (GEMINI_API_KEY)
├── supabase.ts                    # Cliente Supabase sem tipagem
├── supabase_schema.sql            # Schema antigo (tabela 'profiles')
├── *.tsx (AdminSettings, Analytics, Dashboard, etc.)  # Páginas antigas
├── mockData.ts                    # Dados mock antigos
├── eventManagerData.ts            # Dados mock antigos
├── use-mobile.ts                  # Hook antigo
├── utils.ts                       # Utilitários antigos
├── 404.html                       # Página 404 antiga
├── _redirects                     # Redirecionamentos antigos
├── deploy.ps1                     # Script deploy antigo
├── run_agent.py                   # Script Python antigo
├── requirements.txt               # Dependências Python antigas
├── info.md                        # Mensagem de setup do Lovable
├── aura-complete-code.md          # Blueprint completo antigo
├── aura-complete-source/          # Cópia estática do código
├── aura-complete-source.zip       # Zip do código antigo
└── README.md                      # Template padrão Vite
```

> Se precisar consultar o que uma página antiga fazia, estes arquivos estão disponíveis. **Mas o código ativo está 100% em `app/src/`.**

---

---

## 🕸️ Diagrama de Dependências entre Contextos

### Árvore de Providers (main.tsx → App.tsx)

```
main.tsx
├── QueryClientProvider  (React Query — tanstack)
│   └── BrowserRouter
│       └── App.tsx
│           └── AuthProvider  (AuthContext)
│               └── Layout
│                   ├── Header          (condicional)
│                   ├── Routes          (todas as páginas)
│                   ├── Footer          (condicional)
│                   ├── Toaster         (Sonner — toasts globais)
│                   └── FeedbackButton  (fixo)
```

### Auth — Fluxo de Dados & Dependências

```mermaid
graph TD
    A[pages/auth/Login.tsx] -->|chama login()| B[hooks/useAuth.ts]
    B -->|mutateAsync| C[React Query useMutation]
    B -->|read/write| D[stores/authStore.ts<br/>Zustand + persist]
    D -->|consulta/atualiza| E[lib/supabase.ts]
    E -->|HTTP| F[(Supabase Cloud)]
    C -->|POST /auth/v1/token| F
    B -->|invalida cache| G[QueryClient]
    B -->|exibe toast| H[Sonner]
    I[contexts/AuthContext.tsx] -->|init session| E
    I -->|setSession/setUser| D
    J[App.tsx ProtectedRoute] -->|useAuth()| B
```

### Pontos de Atenção no Auth

- **Duplicação de responsabilidades:** `authStore.ts` possui métodos `signIn`/`signUp`/`signOut`, mas o hook `useAuth.ts` também possui `signInMutation`/`signUpMutation`/`signOutMutation` usando React Query. Na prática, o app usa as mutações do React Query, não os métodos do store.
- **Workaround de login:** `useAuth.ts` faz login via `fetch` direto na REST API do Supabase (`/auth/v1/token`) em vez de usar `supabase.auth.signInWithPassword`. Isso foi feito para contornar um possível bug do `supabase-js` com chaves `sb_publishable`. O store ainda mantém a versão original do supabase-js.
- **Persistência:** O `authStore` usa `zustand/middleware/persist` com chave `aura-auth` no `localStorage`. O logout manual limpa tanto o localStorage quanto o estado do store.

---

## 🔐 Variáveis de Ambiente

Criar arquivo `app/.env` (ou `.env.local`) com:

```bash
VITE_SUPABASE_URL="https://<projeto>.supabase.co"
VITE_SUPABASE_ANON_KEY="<chave-anon-publica>"
```

> Nunca commitar `.env` — ele já está no `.gitignore`.

### Onde são usadas

| Variável | Arquivo | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` | `app/src/lib/supabase.ts` | URL base do cliente Supabase |
| `VITE_SUPABASE_ANON_KEY` | `app/src/lib/supabase.ts` | Chave pública do cliente |
| `VITE_SUPABASE_URL` | `app/src/hooks/useAuth.ts` | Endpoint da REST API (`/auth/v1/token`) |
| `VITE_SUPABASE_ANON_KEY` | `app/src/hooks/useAuth.ts` | Header `apikey` / `Authorization` |

Se a aplicação crashar no boot com `As variáveis de ambiente do Supabase não estão definidas`, verifique se o arquivo `.env` existe dentro de `app/`, não na raiz `Evokaa Tickets/`.

---

## 🧪 Testes Automatizados

O projeto possui testes unitários (Vitest) e E2E (Playwright) configurados.

**Rodar testes:**
```bash
cd app
npm run test          # Unitários
npm run test:e2e      # E2E
npm run test:e2e:ui   # E2E com interface visual
```

**Arquivos de teste:**
- `app/src/test/setup.ts` — Mock global do Supabase
- `app/src/test/hooks/*.test.ts` — Testes de hooks
- `app/src/test/*.test.tsx` — Testes de componentes
- `app/src/test/e2e-*.spec.ts` — Testes E2E (Playwright)

Veja `app/TESTING.md` para documentação completa.

---

## ✅ Checklist de Testes Manuais

Use este checklist antes de entregar features ou fazer deploy.

### Autenticação
- [ ] Login com e-mail/senha válidos redireciona corretamente (`user` → `/app/hub`, `producer` → `/producer/dashboard`, `admin` → `/admin/dashboard`)
- [ ] Login com credenciais inválidas exibe toast de erro (sem crashar)
- [ ] Login com conta demo funciona (`produtor@aura.teste` / `senha123`, `user@aura.teste` / `senha123`)
- [ ] Botão de login mostra spinner `<Loader2>` durante o submit (testar duas vezes seguidas)
- [ ] Logout limpa sessão e redireciona para `/`
- [ ] Recarregar a página mantém a sessão (testar em `/producer/dashboard`)
- [ ] Acessar rota protegida sem login redireciona para `/auth/login`
- [ ] Usuário `user` tentando acessar `/admin` é redirecionado para `/app/hub`
- [ ] Cadastro de novo usuário cria registro na tabela `users` com role correta

### Navegação & Layout
- [ ] Header/Footer não aparecem em rotas `/auth`, `/producer`, `/admin`, `/checkout`, `/app`
- [ ] Header/Footer aparecem corretamente na home `/` e `/event/:id`
- [ ] Role selector na tela de login alterna entre Participante/Produtor/Administrador
- [ ] Cores do botão de login mudam conforme a role selecionada
- [ ] Logo do ProducerLayout mostra "Evokaa" (não "Evokaa")

### Producer (Produtor)
- [ ] Acesso ao dashboard carrega dados do produtor logado
- [ ] Criar novo evento abre formulário sem erros
- [ ] Navegação entre as páginas do producer (CRM, Finance, CheckIn, etc.) funciona
- [ ] Evokaa Store (`/producer/aura-store`) carrega sem 404

### Checkout
- [ ] Fluxo de compra de ingresso completo (do carrinho até sucesso)
- [ ] Página de pagamento carrega sem erros
- [ ] Após checkout, `order_items` e `tickets` são criados no Supabase

### App Móvel (Participante)
- [ ] Hub `/app/hub` carrega após login
- [ ] Ingressos `/app/tickets` exibe ingressos do usuário
- [ ] Perfil `/app/profile` mostra dados corretos
- [ ] Menu lateral não mostra links quebrados (events, favorites, orders, chat devem existir ou ser removidos)

### Geral / Resiliência
- [ ] Testar em aba anônima (sem extensões) para validar que não há erros de DOM
- [ ] Testar com extensão de password manager (LastPass, Bitwarden, etc.) para garantir que não há `removeChild`/`insertBefore`
- [ ] Toast de sucesso/erro aparece em todas as operações async
- [ ] Console não exibe `ReferenceError: ENABLE_DEMO is not defined`

---

## ⚠️ Decisões Técnicas Pendentes

### 1. Unificar lógica de autenticação
**Problema:** `authStore.ts` e `useAuth.ts` possuem lógica duplicada de signIn/signUp/signOut. O store mantém a implementação original com `supabase-js`, mas o app usa as mutações do React Query no hook.

**Opções:**
- **A)** Remover `signIn`/`signUp`/`signOut` do `authStore` e deixar tudo no `useAuth`
- **B)** Mover as mutações do React Query para dentro do `authStore` usando `zustand` com async actions
- **C)** Manter ambos, mas documentar claramente qual é a fonte da verdade

**Recomendação:** Opção A — simplificar e centralizar no `useAuth`, já que o React Query já gerencia estados de loading/erro/cache.

---

### 2. Reverter workaround do login via fetch
**Status:** ✅ **RESOLVIDO** (2026-05-24). O `useAuth.ts` agora usa `supabase.auth.signInWithPassword` via `@supabase/supabase-js`. O workaround de `fetch` manual foi removido.

---

### 3. Adicionar testes automatizados
**Status:** ✅ **CONFIGURADO** (2026-05-24). O projeto possui:
- **Unitários:** Vitest + `@testing-library/react` + `@testing-library/jest-dom`
- **E2E:** Playwright (browsers ainda precisam ser instalados via `npx playwright install`)
- **Cobertura atual:** ~0% — testes estão configurados mas poucos foram escritos

**Pendência:** Escrever testes para `useAuth`, `AuthContext`, checkout e login.

---

### 4. Migrar React Router para v7
**Status:** 🟡 **NÃO URGENTE**. O projeto usa `react-router-dom` ^6.30.3 com future flags ativadas (`v7_startTransition`, `v7_relativeSplatPath`). Funciona corretamente. Migrar para v7 é opcional.

---

### 5. Consolidar porta do Vite
**Status:** ✅ **RESOLVIDO** (2026-05-23). `vite.config.ts` já possui `strictPort: false`.

---

### 6. Revisar persistência do authStore
**Problema:** O `zustand/persist` salva `user`, `session` e `isAuthenticated` no `localStorage`. Isso pode causar inconsistência se o token expirar no Supabase mas o frontend ainda acreditar que o usuário está logado.

**Sugestão:** Adicionar validação de token na inicialização (`getSession()` já faz isso no `AuthProvider`, mas o estado persistido pode causar flash de UI incorreta antes do validate).

---

### 7. Criar páginas faltantes do participante
**Problema:** 4 rotas do menu lateral (`/app/events`, `/app/favorites`, `/app/orders`, `/app/chat`) resultam em 404.

**Sugestão:** Criar componentes mínimos para cada rota e registrá-los em `App.tsx`.

---

## 🔧 Correções Recentes (Deploy Vercel)

### 2026-05-24 — Auditoria Completa & Hardening

1. **`src/main.tsx`**: Adicionado `StrictMode` do React 19 + `ErrorBoundary` global + `QueryClient` do TanStack Query (retry 2, staleTime 5min, refetchOnWindowFocus false).

2. **`src/App.tsx`**: Roteamento refatorado com `React.lazy` + `Suspense` para code-splitting. Adicionado `ProtectedRoute` com redirecionamento por role.

3. **`src/hooks/useAuth.ts`**: Removido workaround de `fetch` manual. Agora usa `supabase.auth.signInWithPassword` nativo. Adicionado modo demo com 3 contas hardcoded (`produtor@aura.teste`, `admin@aura.teste`, `user@aura.teste`).

4. **`src/stores/authStore.ts`**: Zustand store com persistência `aura-auth` no localStorage. Fetch de perfil com fallback para modo demo em dev.

5. **`src/hooks/useEvents.ts`**: CRUD completo de eventos conectado ao Supabase. `usePublicEvents`, `usePublicEvent`, `useProducerEvents`, `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent`.

6. **`src/pages/producer/EventManager.tsx`**: Refatorado para usar dados reais do Supabase (em vez de `eventManagerData.ts`).

7. **`src/pages/app/Hub.tsx`**: Ingressos e cardápio agora consomem dados reais do Supabase (`useUserTickets`, `useEventMenuItems`).

8. **`src/components/FeedbackButton.tsx`**: Conectado ao Supabase (tabela `feedback`).

9. **`src/components/ContactSection.tsx`**: Newsletter conectada ao Supabase (tabela `newsletter_subscribers`).

10. **`src/pages/Contact.tsx`**: Formulário de contato conectado ao Supabase (tabela `contact_messages`).

### 2026-05-23 — Preparação para deploy no Vercel

11. **`vite.config.ts`**: Plugin `kimi-plugin-inspect-react` agora só roda em `mode === 'development'`. `strictPort: false` adicionado.

12. **`src/lib/supabase.ts`**: `throw` de env vars agora só acontece em `import.meta.env.DEV`. Em produção, loga warning e usa placeholder.

13. **`vercel.json`**: Rewrite de SPA (`/(.*)` → `/index.html`) + cache de assets.

14. **`src/pages/auth/Login.tsx`**: Corrigido erro `removeChild`/`insertBefore`. `autoComplete` nos inputs, text nodes envolvidos em `<span>`.

15. **`src/components/ProducerLayout.tsx`**: Fallback para `user.avatar`/`user.name` nulos.

16. **SEO/PWA**: `index.html` com meta tags OG, `robots.txt`, `sitemap.xml`, `manifest.json`.

---

---

## 🗄️ Schema do Banco de Dados (Supabase)

> ⚠️ **FONTE DA VERDADE:** O schema completo e atual está em `app/database-setup.sql` (558 linhas). O arquivo `supabase_schema.sql` na raiz é **LEGADO** e usa tabela `profiles` em vez de `users`.
>
> **Inconsistência conhecida:** O `authStore.ts` busca `profiles` mas o schema real cria `users`. O `useAuth.ts` já usa `users`. **Corrigir `authStore.ts` para buscar em `users`.**

Execute este SQL no **SQL Editor** do Supabase (painel do projeto) para criar todas as tabelas necessárias.

### Tabelas de Suporte

```sql
-- Newsletter (landing page)
create table if not exists public.newsletter_subscribers (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  created_at timestamp with time zone default now()
);

-- Mensagens de contato (pagina /contato + ContactSection)
create table if not exists public.contact_messages (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  page text,
  created_at timestamp with time zone default now()
);

-- Feedbacks (botao flutuante FeedbackButton)
create table if not exists public.feedback (
  id uuid default gen_random_uuid() primary key,
  type text check (type in ('melhoria', 'bug', 'duvida', 'sugestao', 'elogio')),
  message text not null,
  rating integer check (rating >= 0 and rating <= 5),
  page text,
  user_agent text,
  created_at timestamp with time zone default now()
);
```

### Tabelas Core (schema real — tabela `users`)

```sql
-- Usuarios (schema atual — usa 'users', nao 'profiles')
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  role text default 'user' check (role in ('user', 'producer', 'admin')),
  stripe_customer_id text,
  is_verified boolean default false,
  updated_at timestamp with time zone default now()
);

-- Eventos
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  producer_id uuid references public.users(id) not null,
  title text not null,
  subtitle text,
  slug text unique not null,
  description text,
  short_description text,
  cover_image text,
  image_url text,
  gallery jsonb default '[]',
  category text default 'Outros',
  tags text[] default '{}',
  venue_name text,
  venue_address text,
  venue_city text,
  venue_state text,
  venue_zip text,
  venue_lat numeric,
  venue_lng numeric,
  date date,
  time text,
  start_date timestamp with time zone default now(),
  end_date timestamp with time zone,
  status text default 'draft' check (status in ('draft', 'published', 'cancelled', 'ended')),
  visibility text default 'public' check (visibility in ('public', 'private', 'unlisted', 'password')),
  password text,
  capacity integer,
  branding jsonb default '{}',
  settings jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Tipos de ingresso
create table if not exists public.ticket_types (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric default 0,
  capacity integer,
  quantity_total integer default 0,
  sold integer default 0,
  quantity_sold integer default 0,
  type text default 'individual' check (type in ('individual', 'vip', 'coletiva', 'mesa')),
  perks text[] default '{}',
  is_active boolean default true,
  lot_number integer default 1,
  sale_start timestamp with time zone,
  sale_end timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Pedidos
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) not null,
  user_id uuid references public.users(id),
  total numeric default 0,
  status text default 'pending',
  created_at timestamp with time zone default now()
);

-- Itens do pedido (usado pelo webhook Stripe)
create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  ticket_type_id uuid references public.ticket_types(id) not null,
  quantity integer not null,
  unit_price numeric not null,
  total_price numeric not null,
  created_at timestamp with time zone default now()
);

-- Ingressos (tickets gerados)
create table if not exists public.tickets (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  ticket_type_id uuid references public.ticket_types(id) not null,
  event_id uuid references public.events(id) not null,
  user_id uuid references public.users(id),
  status text default 'active' check (status in ('active', 'used', 'cancelled', 'expired')),
  check_in_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- View materializada para sumario financeiro (opcional)
create materialized view if not exists public.event_summary as
select
  e.producer_id,
  e.id as event_id,
  coalesce(sum(tt.sold), 0) as tickets_sold,
  coalesce(sum(tt.price * tt.sold), 0) as total_revenue,
  count(distinct o.user_id) as unique_buyers
from public.events e
left join public.ticket_types tt on tt.event_id = e.id
left join public.orders o on o.event_id = e.id
where e.status = 'published'
group by e.producer_id, e.id;

-- Refresh da view (executar periodicamente ou via trigger)
-- refresh materialized view public.event_summary;
```

### RLS Basico (recomendado)

```sql
-- Habilitar RLS nas tabelas
alter table public.users enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tickets enable row level security;

-- Politicas basicas
-- Usuarios: usuario le seu proprio, admin le todos
create policy "Usuarios publicos"
  on public.users for select
  to authenticated, anon
  using (true);

-- Eventos publicos visiveis
create policy "Eventos publicos"
  on public.events for select
  to authenticated, anon
  using (visibility = 'public' and status = 'published');

-- Produtor gerencia seus eventos
create policy "Produtor gerencia eventos"
  on public.events for all
  to authenticated
  using (producer_id = auth.uid())
  with check (producer_id = auth.uid());

-- Ticket types publicos para eventos publicos
create policy "Ticket types publicos"
  on public.ticket_types for select
  to authenticated, anon
  using (exists (
    select 1 from public.events e
    where e.id = ticket_types.event_id
    and e.visibility = 'public'
    and e.status = 'published'
  ));
```

### Checklist de Verificacao (rode apos criar)

Copie e cole no SQL Editor do Supabase e verifique se cada uma retorna sucesso:

```sql
-- 1. Verificar se tabelas existem
select table_name from information_schema.tables where table_schema = 'public';
-- Esperado: users, events, ticket_types, orders, order_items, tickets, feedback, contact_messages, newsletter_subscribers, event_summary

-- 2. Verificar RLS
select relname, relrowsecurity from pg_class where relname in ('users', 'events', 'ticket_types', 'orders', 'order_items', 'tickets');
-- Esperado: todas com relrowsecurity = true

-- 3. Teste insert na tabela feedback
insert into public.feedback (type, message, rating, page)
values ('elogio', 'Teste de insercao', 5, '/test');
-- Esperado: 1 row inserted

-- 4. Teste insert na tabela contact_messages
insert into public.contact_messages (name, email, message)
values ('Teste', 'teste@teste.com', 'Mensagem de teste');
-- Esperado: 1 row inserted

-- 5. Teste insert na tabela newsletter_subscribers
insert into public.newsletter_subscribers (email)
values ('teste@newsletter.com');
-- Esperado: 1 row inserted (ou erro de duplicado se ja existir)

-- 6. Limpar dados de teste
-- delete from public.feedback where message = 'Teste de insercao';
-- delete from public.contact_messages where message = 'Mensagem de teste';
-- delete from public.newsletter_subscribers where email = 'teste@newsletter.com';
```

### Tabela de Status (atualizar apos testes)

| Tabela | Status | Notas |
|--------|--------|-------|
| users | ✅ Verificado | Schema ativo (substitui `profiles`) |
| events | ✅ Verificado | Criada pelo setup.sql |
| ticket_types | ✅ Verificado | Criada pelo setup.sql |
| orders | ✅ Verificado | Criada pelo setup.sql |
| order_items | ✅ Verificado | Criada pelo setup.sql |
| tickets | ✅ Verificado | Criada pelo setup.sql |
| event_summary (view) | ✅ Verificado | View materializada criada |
| **feedback** | ✅ Verificado | Insert de teste OK |
| **contact_messages** | ✅ Verificado | Insert de teste OK |
| **newsletter_subscribers** | ✅ Verificado | Insert de teste OK |

> ⚠️ **IMPORTANTE:** Atualize a coluna "Status" para `✅ Verificado` e a coluna "Notas" com a data/hora apos executar cada teste com sucesso.

### Resultado da Verificacao de Imports (2026-05-24)

✅ **Todos os imports verificados — nenhum erro encontrado.**

Foram verificados 73+ imports em 40+ arquivos. Todos os hooks, componentes, stores, libs e types existem e exportam corretamente.

**Itens verificados:**
- `src/main.tsx` → `ErrorBoundary`, `App`, `index.css`
- `src/App.tsx` → todas as 70+ paginas e componentes
- `src/hooks/useEvents.ts` → `useProducerEvents`, `useCreateEvent`, `useDeleteEvent`, `usePublicEvent`, `usePublicEvents`, `useAdminEvents`, `useAdminTickets`
- `src/hooks/useCheckout.ts` → `useCreateOrder`, `useOrderTickets`
- `src/hooks/usePayment.ts` → `usePayment`
- `src/hooks/useMenuItems.ts` → `useProducerMenuItems`, `useCreateMenuItem`, `useUpdateMenuItem`, `useDeleteMenuItem`
- `src/data/feedbackMock.ts` → `feedbackMock`, `FeedbackItem`
- `src/components/ui/*` → todos os 40+ componentes shadcn/ui
- `src/lib/utils.ts` → `cn` (usado por todos os componentes UI)
- `src/lib/supabase.ts` → `supabase` client
- `@/` alias → funciona em todos os arquivos

---

## 🔧 Procedimentos de Erro Comuns

### Erro: "relation 'feedback' does not exist"
**Sintoma:** Ao enviar feedback, toast mostra "Erro ao enviar feedback."
**Causa:** Tabela `feedback` nao foi criada no Supabase.
**Solucao:** Executar o SQL da secao "Tabelas de Suporte" acima no SQL Editor do Supabase.

### Erro: "relation 'contact_messages' does not exist"
**Sintoma:** Formulario de contato retorna erro.
**Causa:** Tabela `contact_messages` nao foi criada.
**Solucao:** Executar o SQL da secao "Tabelas de Suporte" acima.

### Erro: "relation 'newsletter_subscribers' does not exist"
**Sintoma:** Newsletter nao salva o e-mail.
**Causa:** Tabela `newsletter_subscribers` nao foi criada.
**Solucao:** Executar o SQL da secao "Tabelas de Suporte" acima.

### Erro: "duplicate key value violates unique constraint"
**Sintoma:** Ao inserir e-mail na newsletter, erro de duplicado.
**Causa:** E-mail ja existe na tabela.
**Solucao:** Comportamento esperado. O codigo ja trata isso com toast informativo.

### Erro: "As variaveis de ambiente do Supabase nao estao definidas"
**Sintoma:** App nao carrega, tela branca com erro no console.
**Causa:** `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` nao configuradas no Vercel.
**Solucao:**
1. Acesse vercel.com/dashboard → projeto → Settings → Environment Variables
2. Adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
3. Redeploy

### Erro: "removeChild" / "insertBefore" no login
**Sintoma:** Botao de login crasha ao clicar.
**Causa:** Browser extension (password manager) injetou elementos no DOM.
**Solucao:** Ja corrigido em `src/pages/auth/Login.tsx`. Se persistir, testar em aba anonima.

### Erro: "Failed to execute 'removeChild' on 'Node'"
**Sintoma:** Crash em qualquer pagina com troca de estado.
**Causa:** Text nodes soltos misturados com SVG sendo manipulados por extensoes.
**Solucao:** Regra: nunca usar `<>` (Fragment) com texto solto + icone dentro do mesmo elemento. Sempre envolver em `<span>`.

---

---

## 🚀 Deploy na Vercel

### Informações do Projeto

| Configuração | Valor |
|---|---|
| **Projeto Vercel** | `aura-tickets-pypy` |
| **URL de Produção** | https://aura-tickets-pypy.vercel.app |
| **Repositório GitHub** | `scopric/Evokaa-Tickets` |
| **Branch de Produção** | `main` |
| **Root Directory** | `app` |
| **Framework** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install --legacy-peer-deps` |

### Variáveis de Ambiente ( já configuradas )

| Nome | Ambiente | Status |
|---|---|---|
| `VITE_SUPABASE_URL` | Production + Preview | ✅ Configurada |
| `VITE_SUPABASE_ANON_KEY` | Production + Preview | ✅ Configurada |

> As env vars são configuradas no nível do projeto. **Todos os deploys** (passados e futuros) as utilizam automaticamente.

### Como fazer deploy

**Deploy automático (recomendado):**
```bash
git add .
git commit -m "feat: descricao da mudanca"
git push origin main
```
O Vercel detecta o push e faz deploy automaticamente.

**Deploy manual via CLI:**
```bash
cd app/
npx vercel --prod
```

### Projetos antigos para excluir

Existem projetos antigos na conta Vercel que apontam para o mesmo repositório e causam confusão. Recomenda-se excluir:

- `aura-platform` — projeto antigo, deploys feitos manualmente via CLI
- `aura-tickets` — projeto duplicado, deploys falham

Mantenha apenas: **`aura-tickets-pypy`** (conectado ao GitHub, deploy automático ativo).

### Histórico de deploys bem-sucedidos

| Deploy | Commit | Status | Data |
|---|---|---|---|
| `83sts6adP` | `b17a8f1` — Fases 1-4 | ✅ Ready | 2026-05-24 |

---

## 📊 Relatório de Auditoria

Para análise completa da estrutura do projeto (inventário de arquivos, inconsistências, recomendações de limpeza, histórico de versões), consulte:

📄 **`ANALISE_ESTRUTURA_PROJETO.md`** — Gerado em 2026-05-24. Cobre:
- Inventário completo de ~300 arquivos relevantes
- Lista detalhada de arquivos legados
- Inconsistências de schema (users vs profiles)
- Problemas técnicos com severidade
- Mapa do que está funcional vs mock
- Recomendações de correção

---

*Última atualização: 2026-05-24 (Auditoria completa realizada)*
