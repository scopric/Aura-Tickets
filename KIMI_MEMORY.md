# KIMI_MEMORY — Aura Tickets / Evokaa

Arquivo de memória persistente do projeto Aura Tickets (marca Evokaa).
**ATUALIZAÇÃO:** 25 de maio de 2026 — Análise completa de todo o codebase (210+ arquivos).

---

## 🏛️ Estado Atual do Projeto

- **Branch:** main
- **Marca:** Evokaa (rebranding de Aura Tickets em andamento — `index.html`, manifest, SEO já usam "Evokaa")
- **Deploy:** Vercel (`aura-platform`, projectId: prj_azWxjoISRIyF42ftSdiHmFFyvFMV)
- **Domínio pretendido:** `https://www.evokaa.com.br/` — ❌ **NÃO CONFIGURADO / NÃO RESPONDENDO**
- **Banco de dados:** Supabase (`rwaezeqyuhxrssntcxdv.supabase.co`)
- **Build:** Funcionando (`app/dist/` com 102 arquivos, gerado em 2026-05-23)
- **Porta de desenvolvimento:** 3000 (Vite), às vezes 3001 se houver conflito
- **Variáveis de ambiente:** Existem em `app/.env.local` mas **NÃO no Vercel**

---

## 📊 Inventário Real do Código

| Categoria | Quantidade | Notas |
|-----------|-----------|-------|
| Páginas .tsx | 72 | 42 producer + 10 admin + 7 app + 4 auth + 3 checkout + 6 públicas |
| Componentes .tsx | 79 | 55 shadcn/ui + 24 custom |
| Hooks .ts | 17 | 6 principais + 11 especializados |
| Contextos | 1 | AuthContext |
| Stores | 1 | authStore (Zustand) |
| Edge Functions | 6 | check-in, email, Stripe create/webhook, Woovi create/webhook |
| Migrações SQL | 9 | Com conflitos e duplicações (ver seção Backend) |
| Tabelas Supabase | 43+ | Muitas com schemas divergentes entre migrações |
| Testes | 8 | 3 E2E (Playwright) + 3 hooks + 1 componente + 1 setup |

---

## ✅ O que REALMENTE Funciona (Integrado ao Supabase)

### Autenticação
- Login real via Supabase JS + fallback REST API (`/auth/v1/token`)
- Demo accounts hardcoded: `produtor@aura.teste`, `admin@aura.teste`, `user@aura.teste`
- SignUp real com criação de profile
- Logout completo (localStorage, sessionStorage, queryClient clear)

### Landing Page (/)
- `VideoHero.tsx` com vídeo autoplay + partículas canvas + GSAP
- Stats, Features, Como Funciona, Pricing, FAQ, ContactSection
- ContactSection conectado à tabela `contact_messages`
- FeedbackButton conectado à tabela `feedback`

### Producer — Real (27/42 páginas = 64%)
| Página | Integração |
|--------|-----------|
| Dashboard | Orders, tickets, sumário financeiro real |
| Events | CRUD completo (useEvents.ts) |
| NewEvent / EditEvent | Cria/Edita no Supabase |
| CRM | Kanban real com drag-drop, leads/interações no banco |
| Finance | Gráficos reais, CRUD de transações |
| CheckIn | Scanner QR + Edge Function |
| Menu | CRUD real de itens do cardápio |
| Coupons | CRUD real |
| EventGallery / EventBanners | CRUD real |
| Communications | CRUD real de campanhas |
| TeamManager | Convites, permissões reais |
| Affiliates | CRUD real |
| Certificates / CertificateBuilder | CRUD real |
| SeatingMap | Canvas completo, salva ambientes no banco |
| Tasks | CRUD real com subtarefas |
| Timeline | CRUD real |
| PostEventReport | Dados reais de surveys |
| ProducerSettings | Persistência real (profiles, producer_profiles, team_members) |
| EventPlanner | Persiste evento no Supabase |
| AdvancePayment | Busca receita real do evento |
| InterestList | CRUD real com notificação em massa |
| Partners | CRUD real |
| PiggyBank | Caixinhas com transações reais |
| EvokaaAcademy | Cursos reais com matrícula |

### Producer — Mock/Placeholder (15/42 páginas = 36%)
| Página | Problema |
|--------|----------|
| Wallet.tsx | Saldo hardcoded `R$ 12.840,00`, sem ação de saque |
| Brand.tsx | Presets hardcoded, "Publicar" só exibe toast |
| EvokaaStore.tsx | Itens em useState local |
| EventManager.tsx | Usa `eventManagerData.ts` (mock) |
| Marketing.tsx | Pixels em estado local, QR mockado |
| Settings.tsx (producer) | Perfil hardcoded, plano fixo Pro |
| EventBordero.tsx | Dados fixos em mock |
| EventTicketConfig.tsx | Configurações em estado local apenas |
| EventFolder.tsx | 828 linhas, 100% mock |
| Calculator.tsx | Ferramenta local, sem banco |
| TableCalculator.tsx | Ferramenta local, sem banco |
| Installments.tsx | Parcelamento em estado local |
| Subscription.tsx | Planos hardcoded, "Assinar" só dá toast |
| OrganizerApp.tsx | Página estática/informativa |
| FAQ.tsx | Conteúdo estático |

### Admin (10 páginas)
- Todas implementadas visualmente. Integração parcial — precisa de validação caso a caso.

### App/Participante (7 páginas)
- Hub, Tickets, Notifications, Profile, Settings, Download
- `UserSettings.tsx` é **MOCK** — não persiste no Supabase
- Wallet participante não existe (usa a área do producer)

### Checkout
- Seleção de ingressos + cálculo de taxas
- `/checkout/payment` existe mas gateway NÃO está ativo
- `/checkout/success` existe

---

## 🔴 Erros e Problemas Conhecidos

### Frontend — UI/UX
| Erro | Onde | Status | Nota |
|------|------|--------|------|
| Link `/dashboard` não existe | Footer.tsx | ✅ **CORRIGIDO** | Alterado para `/producer/dashboard` |
| Link `/brand-studio` não existe | Footer.tsx | ✅ **CORRIGIDO** | Alterado para `/producer/brand` |
| Header/Footer duplicados em `/contato` | Contact.tsx | ✅ **CORRIGIDO** | Removidos imports e renderizações internas |
| Newsletter no Footer é mock | Footer.tsx | ✅ **CORRIGIDO** | Conectada à `newsletter_subscribers` com validação de duplicados |
| `og-image.jpg` não existe | Home.tsx | ✅ **CORRIGIDO** | Alterado para `/images/logo-evokaa.png` |
| `AnimatedHero.tsx` é código morto | components/ | ⏳ **PENDENTE** | Shell quebrado — não foi possível remover fisicamente |
| `ProtectedRoute.tsx` orfão | components/ | ⏳ **PENDENTE** | Shell quebrado — não foi possível remover fisicamente |
| `404.html` com marca antiga | public/404.html | ✅ **CORRIGIDO** | Atualizado para "Evokaa Eventos" |

### Backend — Schema SQL (CRÍTICO)
| Problema | Severidade | Detalhe |
|----------|-----------|---------|
| 9 arquivos de migration conflitantes | 🔴 Alta | `init_schema`, `02_seating_and_auditing`, `03_onboarding_and_lgpd`, `05a`, `05b`, `05_full`, `setup.sql`, etc. |
| `producer_tasks` — 3 schemas diferentes | 🔴 Alta | init_schema vs setup.sql vs 05_full |
| `partners` — 2 schemas | 🔴 Alta | init_schema vs setup.sql |
| `feedback` — 2 schemas | 🟡 Média | init_schema (com `status`) vs setup.sql (sem `status`, com `rating`) |
| `certificates` — 3 entidades | 🟡 Média | template (init) vs emitido (setup) vs pdf (05_full) |
| `coupons` — 3 schemas | 🟡 Média | discount_type/uses vs type/value/used_count vs percentage/fixed |
| `orders.subtotal` não tipado | 🟡 Média | Existe no SQL, ausente em `database.ts` |
| `profiles.role` diverge | 🟡 Média | init aceita `customer`, 05_full não aceita |
| RLS conflitante | 🔴 Alta | init = público, 05_full = privado |
| `database.ts` omite ~25 tabelas | 🔴 Alta | `user_consents`, `audit_logs`, `customers`, `producer_balances`, etc. |
| `handle_new_user` cria producer_profile para todos | 🔴 Alta | Em 05_full_schema.sql — indesejado |

### Deploy
| Problema | Severidade | Detalhe |
|----------|-----------|---------|
| Domínio não responde | 🔴 Crítico | `www.evokaa.com.br` não está servindo conteúdo |
| Env vars não no Vercel | 🔴 Crítico | Apenas em `.env.local` local |
| DNS não configurado | 🔴 Crítico | Nenhuma evidência de CNAME ou configuração |

---

## 🔧 Decisões Técnicas Ativas

| Decisão | Data | Status | Detalhes |
|---------|------|--------|----------|
| Auth via fetch direto na REST API do Supabase | 2026-05-23 | Ativo | Workaround para bug do supabase-js |
| Porta Vite: 3000 | 2026-05-23 | Pendente | Conflita às vezes. Adicionar `strictPort: false` |
| Persistência authStore no localStorage | 2026-05-23 | Ativo | Pode causar inconsistência se token expirar |
| Marca Evokaa | 2026-05-23 | Parcial | HTML/meta usam Evokaa, mas alguns textos ainda dizem "Aura" |

---

## ✅ Histórico de Alterações (cronológico inverso)

### 2026-05-29 — Integração de Login Social (Google, Apple e Microsoft)
- **Login Social Completo:** Implementados botões e handlers reais para login social com Google, Apple e Microsoft (Azure) no componente [Login.tsx](file:///c:/Users/scopa/OneDrive/Documentos/Gemini/Antigravity/Aura%20Tickets/app/src/pages/auth/Login.tsx), conectados diretamente ao `supabase.auth.signInWithOAuth`.
- **UI Responsiva e Premium:** Organizado o layout dos provedores sociais em formato de pilha vertical (`space-y-2.5`) para compatibilidade perfeita em celulares (375px), tablets (768px) e desktops (1366px+).
- **Servidor de Desenvolvimento:** Iniciado o Vite local na porta `3001` (devido à porta 3000 ocupada).
- **Validação de Build:** Validada a compilação do projeto com sucesso por meio do comando `npm run build` na pasta `app/`.

### 2026-05-25 — Correções Críticas P0 (Deploy + Frontend)
- `Footer.tsx`: Links quebrados corrigidos (`/dashboard` → `/producer/dashboard`, `/brand-studio` → `/producer/brand`, eventos → `/producer/events`)
- `Footer.tsx`: Newsletter conectada à tabela `newsletter_subscribers` com validação de e-mail e duplicados
- `Contact.tsx`: Removidos `<Header />` e `<Footer />` duplicados (App.tsx já renderiza layout global)
- `Home.tsx`: `og-image` corrigido para `/images/logo-evokaa.png` (arquivo existente)
- `public/404.html`: Marca atualizada de "Aura Eventos" para "Evokaa Eventos"

### 2026-05-25 — Análise Completa do Codebase
- Inventariadas 72 páginas, 79 componentes, 17 hooks, 6 Edge Functions
- Classificadas 42 páginas do producer: 27 real (64%) vs 15 mock (36%)
- Identificadas 9 migrações SQL com schemas conflitantes
- Verificado que domínio `www.evokaa.com.br` não está respondendo
- Documentadas inconsistências de RLS, tipagem, e triggers

### 2026-05-23 — Preparação para Deploy e Hardening
- `vite.config.ts`: Plugin `kimi-plugin-inspect-react` só em development
- `src/lib/supabase.ts`: `throw` de env vars só em DEV
- `vercel.json`: SPA rewrite + cache de assets
- `src/pages/auth/Login.tsx`: Fix `removeChild`/`insertBefore`
- `src/main.tsx`: StrictMode + ErrorBoundary + QueryClient config
- `src/components/ErrorBoundary.tsx`: Componente global criado
- `src/components/ProducerLayout.tsx`: Null-safety para avatar/name
- `src/components/FeedbackButton.tsx`: Conectado à tabela `feedback`
- `src/components/ContactSection.tsx`: Newsletter conectada
- `src/pages/Contact.tsx`: Form de contato conectado
- `index.html`: Meta tags SEO, Open Graph, manifest, favicon
- `public/robots.txt`, `public/sitemap.xml`, `public/manifest.json` criados

---

## ⏳ Próximos Passos / Pendências (Priorizados)

### 🔴 P0 — Correções Imediatas (Deploy)
- [x] **Criar guia de deploy detalhado** (`DEPLOY_GUIDE.md` criado com passo a passo)
- [x] **Atualizar script de deploy** (`deploy.ps1` agora alerta sobre env vars e domínio)
- [x] **Corrigir build que falhava na Vercel** — `ResetPassword.tsx` tinha `useNavigate` importado mas não usado. Com `noUnusedLocals: true` no tsconfig, isso quebrava o build de produção.
- [ ] Configurar domínio `www.evokaa.com.br` no dashboard Vercel (requer acesso manual)
- [ ] Adicionar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no Vercel (requer acesso manual)
- [ ] Atualizar DNS no registrador para apontar à Vercel (requer acesso manual)
- [ ] Fazer novo deploy (`cd app && vercel --prod`)

### 🔴 P0 — Correções Imediatas (Frontend)
- [ ] Corrigir links quebrados (`/dashboard`, `/brand-studio`) no Footer
- [ ] Remover Header/Footer duplicados de `Contact.tsx`
- [ ] Adicionar `og-image.jpg` em `public/images/`
- [ ] Atualizar `404.html` para marca Evokaa
- [ ] Conectar newsletter do Footer à `newsletter_subscribers`

### 🔥 P1 — Mock → Real (Producer)
- [ ] Wallet.tsx: conectar à tabela `transactions`
- [ ] Brand.tsx: salvar configuração no Supabase
- [ ] EventFolder.tsx: integrar com tabelas reais
- [ ] Marketing.tsx: salvar pixels no Supabase
- [ ] EventTicketConfig.tsx: persistir configurações avançadas

### 🔥 P1 — Mock → Real (Participante)
- [ ] UserSettings.tsx: persistir no Supabase
- [ ] Upload de avatar/imagem via Supabase Storage

### ⚡ P2 — Consolidação Técnica
- [ ] Unificar migrations SQL (escolher schema de verdade)
- [ ] Atualizar `database.ts` com `supabase gen types`
- [ ] Consolidar `authStore.ts` vs `useAuth.ts`
- [ ] Corrigir RLS de `profiles` (público vs privado)
- [ ] Revisar `handle_new_user()` (não criar producer_profile para todos)

### 🟢 P3 — Polimento
- [ ] Remover código morto (`AnimatedHero.tsx`, `ProtectedRoute.tsx` orfão)
- [ ] Adicionar `strictPort: false` no `vite.config.ts`
- [ ] Consolidar texto residual "Aura" → "Evokaa"

---

## 🧪 Testes Realizados

| Teste | Data | Resultado | Notas |
|-------|------|-----------|-------|
| Login com produtor@aura.teste | 2026-05-23 | ✅ OK | Redirecionamento correto para `/producer/dashboard` |
| Verificação de imports | 2026-05-23 | ✅ OK | 73+ imports em 40+ arquivos, nenhum erro |
| Tabelas do Supabase | 2026-05-23 | ✅ OK | feedback, contact_messages, newsletter_subscribers |
| Build de produção | 2026-05-23 | ✅ OK | Passou sem erros |
| Análise completa codebase | 2026-05-25 | ✅ OK | 210+ arquivos analisados |

---

## ⚠️ Notas Gerais & Dicas para o Agente

- **SEMPRE usar `app/src/...`** — arquivos na raiz são obsoletos
- **Shell/bash pode estar quebrado** no Windows (crash `0xC0000005`). Prefira ReadFile/WriteFile/StrReplaceFile
- **Regra de DOM:** Nunca usar Fragment (`<>`) com texto solto + ícone. Sempre envolver em `<span>`
- **React 19:** Verificar compatibilidade de hooks
- **Supabase:** `useAuth.ts` faz login via `fetch` direto na REST API
- **Variáveis de ambiente:** Devem estar em `app/.env` (não na raiz)
- **Cores Tailwind:** `plum`, `espresso`, `cream`, `canvas`, `void`
- **Gateway de pagamento:** EXCLUSÃO explícita do usuário — não trabalhar nisso

---

*Última atualização: 2026-05-25*
*Próxima sessão: corrigir problemas críticos de deploy e frontend (links quebrados, layout duplicado, etc.)*
