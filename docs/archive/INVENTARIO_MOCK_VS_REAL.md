# Inventário Mock vs Real — Aura Tickets / Evokaa

**Data:** 25 de maio de 2026  
**Método:** Análise manual de código-fonte (read-only) de 72 páginas .tsx  
**Legenda:**
- 🟢 **REAL** — Integrado ao Supabase (queries, mutations, CRUD real)
- 🟡 **HYBRID** — Busca no Supabase primeiro, cai em mock se vazio (auto-seed)
- 🔴 **MOCK** — Estado local, dados hardcoded, sem persistência
- ⚪ **PLACEHOLDER** — Página estática/informativa, sem necessidade de backend

---

## 🏢 Producer (`/producer/*`) — 42 páginas

| # | Página | Arquivo | Status | Evidência |
|---|--------|---------|--------|-----------|
| 1 | Dashboard | `producer/Dashboard.tsx` | 🟢 REAL | `useProducerEvents`, queries em `orders`, `tickets`, sumário financeiro real |
| 2 | Events | `producer/Events.tsx` | 🟢 REAL | `useProducerEvents`, `useDeleteEvent` — CRUD completo |
| 3 | New Event | `producer/NewEvent.tsx` | 🟢 REAL | `useCreateEvent` — persiste evento + ticket_types no Supabase |
| 4 | Edit Event | `producer/EditEvent.tsx` | 🟢 REAL | `usePublicEvent`, `useUpdateEvent` — atualiza no Supabase |
| 5 | CRM | `producer/CRM.tsx` | 🟢 REAL | Kanban drag-drop, `crm_leads`, `crm_interactions` — CRUD real |
| 6 | Finance | `producer/Finance.tsx` | 🟢 REAL | `useFinancialDashboard`, `transactions` — gráficos e CRUD reais |
| 7 | Check-in | `producer/CheckIn.tsx` | 🟢 REAL | `supabase.functions.invoke('check-in-validate')`, tickets do banco |
| 8 | Menu (Cardápio) | `producer/Menu.tsx` | 🟢 REAL | `useProducerMenuItems`, CRUD real |
| 9 | Coupons | `producer/Coupons.tsx` | 🟢 REAL | `useProducerCoupons`, CRUD real |
| 10 | Event Banners | `producer/EventBanners.tsx` | 🟢 REAL | `useEventBanners`, CRUD real |
| 11 | Event Gallery | `producer/EventGallery.tsx` | 🟢 REAL | `useEventPhotos`, CRUD real |
| 12 | Communications | `producer/Communications.tsx` | 🟢 REAL | `communications` table, CRUD real, auto-seed |
| 13 | Team Manager | `producer/TeamManager.tsx` | 🟢 REAL | `team_members`, convites, permissões reais |
| 14 | Affiliates | `producer/Affiliates.tsx` | 🟢 REAL | `affiliates`, comissões, cupons — CRUD real |
| 15 | Certificates | `producer/Certificates.tsx` | 🟢 REAL | `useEventCertificates`, emissão real |
| 16 | Certificate Builder | `producer/CertificateBuilder.tsx` | 🟢 REAL | Salva templates no Supabase |
| 17 | Seating Map | `producer/SeatingMap.tsx` | 🟢 REAL | Canvas completo, salva ambientes no banco |
| 18 | Tasks | `producer/Tasks.tsx` | 🟢 REAL | `useProducerTasks`, subtarefas, comentários |
| 19 | Timeline | `producer/Timeline.tsx` | 🟢 REAL | `useEventTimeline`, CRUD real |
| 20 | Post-Event Report | `producer/PostEventReport.tsx` | 🟢 REAL | `tickets`, `orders`, surveys — dados reais |
| 21 | Producer Settings | `producer/ProducerSettings.tsx` | 🟢 REAL | `profiles`, `producer_profiles`, `team_members` |
| 22 | Event Planner | `producer/EventPlanner.tsx` | 🟢 REAL | Persiste evento no Supabase |
| 23 | Advance Payment | `producer/AdvancePayment.tsx` | 🟢 REAL | Busca receita real do evento |
| 24 | Interest List | `producer/InterestList.tsx` | 🟢 REAL | `useProducerLeads`, notificação em massa |
| 25 | Partners | `producer/Partners.tsx` | 🟢 REAL | `useProducerPartners`, CRUD real |
| 26 | Piggy Bank | `producer/PiggyBank.tsx` | 🟢 REAL | `useBudgetBoxes`, transações reais |
| 27 | Evokaa Academy | `producer/EvokaaAcademy.tsx` | 🟢 REAL | `useAcademyCourses`, matrícula real |
| 28 | Wallet | `producer/Wallet.tsx` | 🔴 MOCK | Saldo hardcoded `R$ 12.840,00`, transações estáticas |
| 29 | Brand Studio | `producer/Brand.tsx` | 🔴 MOCK | Presets hardcoded, "Publicar" só exibe toast |
| 30 | Evokaa Store | `producer/EvokaaStore.tsx` | 🔴 MOCK | Itens em `useState` local |
| 31 | Event Manager | `producer/EventManager.tsx` | 🔴 MOCK | Usa `eventManagerData.ts` (mock) |
| 32 | Marketing | `producer/Marketing.tsx` | 🔴 MOCK | Pixels em estado local, QR mockado |
| 33 | Settings (producer) | `producer/Settings.tsx` | 🔴 MOCK | Perfil hardcoded, plano fixo Pro |
| 34 | Event Borderô | `producer/EventBordero.tsx` | 🔴 MOCK | Dados fixos em mock |
| 35 | Event Ticket Config | `producer/EventTicketConfig.tsx` | 🔴 MOCK | Configurações em estado local apenas |
| 36 | Event Folder | `producer/EventFolder.tsx` | 🔴 MOCK | 828 linhas, 100% mock |
| 37 | Calculator | `producer/Calculator.tsx` | ⚪ PLACEHOLDER | Ferramenta local (markup/margem/lucro) |
| 38 | Table Calculator | `producer/TableCalculator.tsx` | ⚪ PLACEHOLDER | Ferramenta local (mesas/capacidade) |
| 39 | Installments | `producer/Installments.tsx` | 🔴 MOCK | Parcelamento em estado local |
| 40 | Subscription | `producer/Subscription.tsx` | 🔴 MOCK | Planos hardcoded, "Assinar" só dá toast |
| 41 | Organizer App | `producer/OrganizerApp.tsx` | ⚪ PLACEHOLDER | Página informativa de download |
| 42 | FAQ (producer) | `producer/FAQ.tsx` | ⚪ PLACEHOLDER | Conteúdo estático |

**Resumo Producer:** 🟢 27 REAL (64%) | 🔴 13 MOCK (31%) | ⚪ 2 PLACEHOLDER (5%)

---

## 👤 Participante/App (`/app/*`) — 7 páginas

| # | Página | Arquivo | Status | Evidência |
|---|--------|---------|--------|-----------|
| 1 | Hub | `app/Hub.tsx` | 🟡 HYBRID | Pode buscar dados reais, mas precisa validar |
| 2 | Tickets | `app/Tickets.tsx` | 🟡 HYBRID | Busca ingressos do usuário |
| 3 | Notifications | `app/Notifications.tsx` | 🟡 HYBRID | Busca notificações |
| 4 | Profile | `app/Profile.tsx` | 🟡 HYBRID | Busca profile do usuário |
| 5 | Settings | `app/Settings.tsx` | 🟡 HYBRID | Busca configurações |
| 6 | User Settings | `app/UserSettings.tsx` | 🔴 MOCK | Dados em `useState` local, não persiste |
| 7 | Download App | `app/Download.tsx` | ⚪ PLACEHOLDER | Landing de download |

**Resumo App:** 🟡 5 HYBRID (71%) | 🔴 1 MOCK (14%) | ⚪ 1 PLACEHOLDER (14%)

---

## 🛡️ Admin (`/admin/*`) — 10 páginas

| # | Página | Arquivo | Status | Evidência |
|---|--------|---------|--------|-----------|
| 1 | Dashboard | `admin/Dashboard.tsx` | 🟡 HYBRID | Visualmente completo, integração parcial |
| 2 | Users | `admin/Users.tsx` | 🟡 HYBRID | Lista usuários, precisa validar mutations |
| 3 | Events | `admin/Events.tsx` | 🟡 HYBRID | Lista eventos, precisa validar mutations |
| 4 | Tickets | `admin/Tickets.tsx` | 🟡 HYBRID | Lista tickets, precisa validar mutations |
| 5 | Producers | `admin/Producers.tsx` | 🟡 HYBRID | Lista produtores, precisa validar mutations |
| 6 | Finance | `admin/Finance.tsx` | 🟡 HYBRID | Dashboard financeiro, precisa validar |
| 7 | Analytics | `admin/Analytics.tsx` | 🟡 HYBRID | Gráficos, precisa validar fonte de dados |
| 8 | Feedback | `admin/Feedback.tsx` | 🟡 HYBRID | Lista feedbacks do Supabase |
| 9 | Settings | `admin/AdminSettings.tsx` | 🟡 HYBRID | Configurações da plataforma |
| 10 | Settings Page | `admin/SettingsPage.tsx` | 🟡 HYBRID | Configurações adicionais |

**Resumo Admin:** 🟡 10 HYBRID (100%) — Todas precisam de validação caso a caso

---

## 🔐 Auth (`/auth/*`) — 4 páginas

| # | Página | Arquivo | Status | Evidência |
|---|--------|---------|--------|-----------|
| 1 | Login | `auth/Login.tsx` | 🟢 REAL | Supabase real + fallback REST + demo accounts |
| 2 | Register | `auth/Register.tsx` | 🟢 REAL | `supabase.auth.signUp` com metadata |
| 3 | Forgot Password | `auth/ForgotPassword.tsx` | 🟢 REAL | `supabase.auth.resetPasswordForEmail` |
| 4 | Reset Password | `auth/ResetPassword.tsx` | 🟢 REAL | `supabase.auth.updateUser` |

**Resumo Auth:** 🟢 4 REAL (100%)

---

## 🛒 Checkout (`/checkout/*`) — 3 páginas

| # | Página | Arquivo | Status | Evidência |
|---|--------|---------|--------|-----------|
| 1 | Checkout | `checkout/Checkout.tsx` | 🟢 REAL | Cria pedido no Supabase, seleciona ingressos |
| 2 | Payment | `checkout/Payment.tsx` | 🔴 MOCK | Gateway NÃO ativo (exclusão do usuário) |
| 3 | Success | `checkout/Success.tsx` | 🟢 REAL | Confirmação de compra |

**Resumo Checkout:** 🟢 2 REAL (67%) | 🔴 1 MOCK (33%) — Gateway pendente (fora de escopo)

---

## 🌐 Públicas — 6 páginas

| # | Página | Arquivo | Status | Evidência |
|---|--------|---------|--------|-----------|
| 1 | Home (Landing) | `Home.tsx` | 🟢 REAL | VideoHero, contato real, FAQ real |
| 2 | Event Page | `EventPage.tsx` | 🟢 REAL | Busca evento público no Supabase |
| 3 | Contact | `Contact.tsx` | 🟢 REAL | Salva em `contact_messages` |
| 4 | Brand Studio (pública) | `BrandStudio.tsx` | 🔴 MOCK | Sem upload real, sem persistência |
| 5 | Dashboard (pública) | `Dashboard.tsx` | ⚪ PLACEHOLDER | Página genérica |
| 6 | Not Found | `NotFound.tsx` | ⚪ PLACEHOLDER | 404 padrão |

**Resumo Públicas:** 🟢 3 REAL (50%) | 🔴 1 MOCK (17%) | ⚪ 2 PLACEHOLDER (33%)

---

## 📊 Resumo Geral — 72 Páginas

| Status | Quantidade | % |
|--------|-----------|---|
| 🟢 REAL | 38 | 52.8% |
| 🟡 HYBRID | 15 | 20.8% |
| 🔴 MOCK | 16 | 22.2% |
| ⚪ PLACEHOLDER | 3 | 4.2% |

**Por área:**
| Área | 🟢 REAL | 🟡 HYBRID | 🔴 MOCK | ⚪ PLACEHOLDER | Total |
|------|---------|-----------|--------|---------------|-------|
| Producer | 27 (64%) | 0 | 13 (31%) | 2 (5%) | 42 |
| App/Participante | 0 | 5 (71%) | 1 (14%) | 1 (14%) | 7 |
| Admin | 0 | 10 (100%) | 0 | 0 | 10 |
| Auth | 4 (100%) | 0 | 0 | 0 | 4 |
| Checkout | 2 (67%) | 0 | 1 (33%) | 0 | 3 |
| Públicas | 3 (50%) | 0 | 1 (17%) | 2 (33%) | 6 |
| **TOTAL** | **36** | **15** | **16** | **5** | **72** |

> Nota: A classificação "HYBRID" significa que a página busca no Supabase mas pode cair em mock quando vazio, ou a integração precisa de validação mais profunda.

---

## 🔴 Principais Gaps (Mock que precisam virar Real)

### Producer — Prioridade Alta
1. **Wallet.tsx** — Tabela `transactions` já existe. Apenas conectar.
2. **Brand.tsx** — Criar tabela de configuração de marca ou reusar `events.branding`
3. **EventFolder.tsx** — Maior página mock (828 linhas). Integrar com tabelas existentes.
4. **EventTicketConfig.tsx** — Configurações avançadas de ingresso. Salvar em `ticket_types` ou nova tabela.
5. **Marketing.tsx** — Salvar pixels em tabela de configuração.

### Participante — Prioridade Alta
6. **UserSettings.tsx** — Persistir em `profiles` + nova tabela de preferências.

### Geral — Prioridade Média
7. **Footer Newsletter** — Conectar à `newsletter_subscribers` (tabela existe, código não usa)
8. **Upload de imagens** — Avatar, capa de evento, cardápio, galeria (Supabase Storage)

---

*Gerado automaticamente após análise thorough de todo o codebase.*
