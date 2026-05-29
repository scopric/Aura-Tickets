# KIMI_MEMORY — Evokaa Tickets

Arquivo de memória persistente do projeto Evokaa Tickets (antigo Aura Tickets).
**ATENÇÃO:** Este arquivo deve ser atualizado pelo agente ao final de cada sessão significativa. Mantenha-o organizado e conciso.

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

# KIMI_MEMORY — Evokaa Tickets

Arquivo de memória persistente do projeto Evokaa Tickets (antigo Aura Tickets).
**ATENÇÃO:** Este arquivo deve ser atualizado pelo agente ao final de cada sessão significativa. Mantenha-o organizado e conciso.

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
| Auth via Supabase JS oficial | 2026-05-24 | Ativo | Removido workaround REST API |
| Porta Vite: 3000 | 2026-05-23 | Ativo | `strictPort: false` |
| Marca Evokaa | 2026-05-23 | Parcial | Migração de textos em andamento |

---

## ✅ Histórico de Alterações

### 2026-05-29 (Sessão 2) — Rebranding Visual e Tipográfico Fiel ao Logotipo
- **Ajuste de Cores do Design System**: Redefinida a paleta de cores inteira para sincronizar exatamente com a logo da Evokaa: Azul Royal (`#1D68C4`), Roxo/Violeta (`#8F33F5`), Azul-Marinho (`#0C2340`) e degradê correspondente. Atualizados em `index.css`, `tailwind.config.js` e `DESIGN-SYSTEM.md`.
- **Modernização Tipográfica**: Importadas e mapeadas as fontes sans-serif geométricas modernas **Outfit** (títulos, display, extra-bold) e **Plus Jakarta Sans** (corpo de texto) para alinhar visualmente a plataforma à sofisticação da logo. Mapeados em `tailwind.config.js` e `index.css`.
- **Correções do Build**: Corrigido bug de compilação em `FAQ.tsx`, `Header.tsx` e `PricingSection.tsx`. Build finalizado com absoluto sucesso.
- **Merge Concluído**: Finalizado commit do merge da branch `recuperacao-landing-v2` e removidos conflitos git em `Hub.tsx`.

### 2026-05-29 (Sessão 1) — Integração de Login Social e Consolidação
- **Login Social Completo**: Implementados botões e handlers para Google, Apple e Microsoft via `supabase.auth.signInWithOAuth`.
- **UI Premium**: Layout responsivo de provedores sociais.
- **Merge de Memória**: Consolidado o histórico e refinado o guia de desenvolvimento após a integração do módulo de matchmaking.

### 2026-05-24 — Automação Kimi + Refatorações Core + Matchmaking
- **Matchmaking**: Sistema completo com algoritmo de compatibilidade, `ProfileQuiz` animado e `YourTable` cinematográfico.
- **Core**: Unificada lógica de auth, migração para React Router v7, remoção de redundâncias de código.
- **Realtime**: Chat funcional usando Supabase Realtime.

---

## ⏳ Próximos Passos (Priorizados)

### 🔴 P0 — Correções Imediatas (Deploy)
- [ ] Configurar domínio `www.evokaa.com.br` no dashboard Vercel.
- [ ] Configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no Vercel.
- [ ] Atualizar DNS.

### 🔥 P1 — Mock → Real
- [ ] Finalizar persistência de `Wallet`, `Brand` e `EventTicketConfig`.
- [ ] Persistência de `UserSettings` do participante no Supabase.

---

## 🧪 Testes Realizados
- Login social e fluxos de autenticação validados.
- Algoritmo de matchmaking testado unitariamente (`matchmaking.test.ts`).
- Build de produção (npm run build) pós-ajuste de cores validado com 100% de sucesso.
- Servidor local do Vite rodando na porta 3002 (`http://localhost:3002/`) e verificado via smoke check de conexão HTTP.

---

## ⚠️ Notas Gerais & Dicas para o Agente

- **SEMPRE usar `app/src/...`** — arquivos na raiz são obsoletos.
- **Shell/bash pode estar quebrado** no Windows; prefira manipular arquivos diretamente.
- **Regra de DOM**: Evite fragmentos com texto solto. Use `<span>` ou `<div>`.
- **Variáveis de ambiente**: Devem estar em `app/.env` (nunca commitar).
- **Cores customizadas Tailwind**: `plum` (azul royal da logo), `void` (marinho profundo), `espresso`, `cream`, `canvas`.
- **Gateway de pagamento**: Não trabalhar no gateway, foco na plataforma interna.

*Última atualização: 2026-05-29*
*Próxima sessão: configurar variáveis de ambiente no dashboard da Vercel e efetuar o deploy de produção.*
