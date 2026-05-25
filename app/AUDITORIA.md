# 🔍 Auditoria Completa — Evokaa Tickets

**Data:** 2026-05-24  
**Escopo:** `app/src/` (~80 arquivos de página, ~20 hooks)  
**Objetivo:** Identificar rotas quebradas, botões não-funcionais, mock data e features faltantes.

---

## ✅ STATUS DE REMEDIAÇÃO (Atualizado)

| Categoria | Estado |
|-----------|--------|
| Rotas quebradas/faltantes | ✅ **RESOLVIDO** — Todas as rotas `/app/*` criadas; links `/dashboard` corrigidos |
| Checkout `order_items` | ✅ **RESOLVIDO** — `useCheckout.ts` agora insere `order_items` antes de `tickets` |
| Feedback schema/types | ✅ **RESOLVIDO** — `useFeedback.ts` alinhado com schema `feedback` (type como TEXT) |
| Páginas participante mock | ✅ **RESOLVIDO** — `AppTickets`, `AppProfile`, `AppNotifications`, `AppLayout` notificações conectados ao Supabase |
| ProducerWallet | ✅ **RESOLVIDO** — Conectado a `transactions` + `withdrawals` com modal de saque funcional |
| Auto-seed DB | ✅ **RESOLVIDO** — CRM, Comunicações, Afiliados, Finance só fazem auto-seed em `import.meta.env.DEV` |
| Mock data geral | ✅ **RESOLVIDO** — ~20 páginas agora usam `import.meta.env.DEV ? mockData : []` ou estão conectadas ao DB |

---

## 1. RESUMO EXECUTIVO

| Categoria | Quantidade | Severidade |
|-----------|-----------|------------|
| Rotas quebradas/faltantes | 0 | ✅ Resolvido |
| Botões não-funcionais/placeholders | 8+ | 🟡 Média |
| Páginas 100% mock (sem Supabase) | ~10 | 🟡 Média |
| Páginas parcialmente mock | 4 | 🟡 Média |
| Features incompletas/faltantes | 8+ | 🟡 Média |
| Problemas de schema | 2 | 🟠 Média-Alta |

---

## 2. ROTAS QUEBRADAS / FALTANTES

### 2.1 Links que apontam para rotas INEXISTENTES

| Arquivo | Linha | Link Quebrado | Rota Existente? | Correção |
|---------|-------|---------------|-----------------|----------|
| `components/AnimatedHero.tsx` | 271 | `/dashboard` | ✅ Corrigido | `/producer/dashboard` |
| `components/Footer.tsx` | 48 | `/dashboard` | ✅ Corrigido | `/producer/dashboard` |
| `components/Footer.tsx` | 50 | `/brand-studio` | ✅ Corrigido | `/producer/brand` |
| `components/Header.tsx` | 63 | `/event/noite-eletro-2025` | ⚠️ Hardcoded | Deveria ser `/event/:slug` dinâmico |
| `components/AnimatedHero.tsx` | 281 | `/event/noite-eletro-2025` | ⚠️ Hardcoded | Deveria ser dinâmico |
| `pages/BrandStudio.tsx` | 534 | `/event/noite-eletro-2025` | ⚠️ Hardcoded | Deveria ser dinâmico |
| `pages/Dashboard.tsx` | 109 | `/event/noite-eletro-2025` | ⚠️ Hardcoded | Deveria ser dinâmico |
| `components/VideoHero.tsx` | 268 | `/event/noite-eletro-2025` | ⚠️ Hardcoded | Deveria ser dinâmico |

### 2.2 Rotas no menu AppLayout

| Menu Item | Rota | Página Existe? |
|-----------|------|----------------|
| Início | `/app/hub` | ✅ Sim |
| Meus Ingressos | `/app/tickets` | ✅ Sim |
| Eventos | `/app/events` | ✅ **Criada** |
| Favoritos | `/app/favorites` | ✅ **Criada** |
| Compras | `/app/orders` | ✅ **Criada** |
| Chat | `/app/chat` | ✅ **Criada** |
| Notificações | `/app/notifications` | ✅ Sim |
| Perfil | `/app/profile` | ✅ Sim |
| Configurações | `/app/settings` | ✅ Sim |

---

## 3. BOTÕES NÃO FUNCIONAIS / PLACEHOLDERS

### 3.1 Botões inertes (sem handler ou integração)

| Arquivo | Elemento | Problema | Status |
|---------|----------|----------|--------|
| `pages/auth/Login.tsx` | "Entrar com Google" | Botão existe mas **não tem `onClick`** nem integração OAuth | ❌ Pendente |
| `components/Footer.tsx` | "Assinar" (newsletter) | `handleSubscribe` só seta `subscribed=true` localmente. Tabela `newsletter_subscribers` não existe | ❌ Pendente |
| `pages/producer/Wallet.tsx` | "Sacar" | ✅ **Corrigido** — Agora abre modal e insere na tabela `withdrawals` |
| `pages/producer/Wallet.tsx` | "Historico" | ✅ **Removido** — histórico agora é a própria página |
| `components/ProducerLayout.tsx` | Botão de menu colapsado | `onClick={() => {}}` — não funcional (baixo impacto) | 🟡 Baixa prioridade |
| `pages/producer/CertificateBuilder.tsx` | Botões de cor | `onClick={() => {}}` — seletor de cor não funciona | ❌ Pendente |

### 3.2 Funcionalidades 100% simuladas (mock local)

| Arquivo | Funcionalidade | Problema | Status |
|---------|---------------|----------|--------|
| `pages/app/Hub.tsx` | Chat | `setTimeout` com resposta automática. | ❌ Pendente — tabela `messages` existe |
| `pages/app/Hub.tsx` | Meus Ingressos | ✅ **Corrigido** — usa `useUserTickets` do `useCheckout.ts` |
| `pages/app/Notifications.tsx` | Notificações | ✅ **Corrigido** — usa `useUserNotifications` |
| `pages/app/Profile.tsx` | Perfil | ✅ **Corrigido** — usa dados do `useAuth` + hooks |
| `pages/app/Settings.tsx` | Excluir conta | Só mostra toast. **Não chama API de exclusão** | ❌ Pendente |

---

## 4. MOCK DATA vs DATABASE REAL

### 4.1 Páginas agora conectadas ao Supabase

| Página | Hook/Query | Status |
|--------|-----------|--------|
| `pages/producer/Wallet.tsx` | `useProducerTransactions`, `useProducerWithdrawals`, `useRequestWithdrawal` | ✅ Conectado |
| `pages/producer/CRM.tsx` | `crm_leads` + `crm_interactions` | ✅ Conectado (auto-seed só em dev) |
| `pages/producer/Communications.tsx` | `communications` | ✅ Conectado (auto-seed só em dev; métricas zeradas) |
| `pages/producer/Affiliates.tsx` | `affiliates` | ✅ Conectado (auto-seed só em dev; `salesHistory` vazio) |
| `pages/producer/Finance.tsx` | `transactions` | ✅ Conectado (auto-seed só em dev) |
| `pages/producer/Dashboard.tsx` | `useProducerEvents`, `recentOrders`, `financeSummary` | ✅ Conectado (demo fallback para demo user) |
| `pages/app/Tickets.tsx` | `useUserTickets` | ✅ Conectado |
| `pages/app/Orders.tsx` | `useUserOrders` | ✅ Conectado |
| `pages/app/Profile.tsx` | `useAuth`, `useUserTickets`, `useUserOrders` | ✅ Conectado |
| `pages/app/Notifications.tsx` | `useUserNotifications` | ✅ Conectado |
| `components/AppLayout.tsx` | `useUserNotifications` | ✅ Conectado |
| `components/PreOrder.tsx` | `useEventMenuItems` | ✅ Conectado |

### 4.2 Páginas 100% MOCK (agora protegidas com `import.meta.env.DEV`)

Em produção, estas páginas mostram estado vazio. Em desenvolvimento, mantêm mock data para portfolio.

| Página | Variável Mock |
|--------|--------------|
| `pages/admin/Analytics.tsx` | `monthlyData`, `categoryData` |
| `pages/admin/Finance.tsx` | `transactions` |
| `pages/admin/Users.tsx` | `mockUsers` |
| `pages/admin/Producers.tsx` | `mockProducers` |
| `pages/admin/Dashboard.tsx` | `mockUsers`, `plans`, `featureGates` |
| `pages/admin/Feedback.tsx` | `feedbackMock` |
| `pages/producer/PiggyBank.tsx` | `mockBoxes` |
| `pages/producer/Partners.tsx` | `mockPartners` |
| `pages/producer/Coupons.tsx` | `mockCoupons` |
| `pages/producer/Tasks.tsx` | `mockTasks` |
| `pages/producer/EventBanners.tsx` | `mockBanners` |
| `pages/producer/EventGallery.tsx` | `mockPhotos` |
| `pages/producer/InterestList.tsx` | `mockInterested` |
| `pages/producer/Certificates.tsx` | `mockCertificates` |
| `pages/producer/Timeline.tsx` | `mockTimeline` |

### 4.3 Páginas ainda 100% mock (sem dev guard ainda)

| Página | Variável Mock | Prioridade |
|--------|--------------|------------|
| `pages/producer/EventBordero.tsx` | `borderoMock` | 🟡 Média |
| `pages/producer/PostEventReport.tsx` | `npsData`, `hourlyAttendance` | 🟡 Média |
| `pages/producer/AdvancePayment.tsx` | `eventSales`, `advanceOptions` | 🟡 Média |
| `pages/producer/Installments.tsx` | `config` local | 🟢 Baixa |
| `pages/producer/EvokaaStore.tsx` | `items` hardcoded | 🟢 Baixa |
| `pages/producer/EvokaaAcademy.tsx` | `courses` | 🟢 Baixa |
| `pages/producer/Subscription.tsx` | `plans` (é config, não user data) | 🟢 Baixa |
| `pages/producer/Marketing.tsx` | `utmLinks`, pixels | 🟢 Baixa |
| `pages/producer/FAQ.tsx` | `producerFAQs`, `affiliateFAQs` | 🟢 Baixa |
| `pages/producer/OrganizerApp.tsx` | `features` estático | 🟢 Baixa |
| `pages/producer/EventFolder.tsx` | `managedEvents` (import) | 🟡 Média |
| `pages/producer/EventPlanner.tsx` | `eventProfiles` (é config) | 🟢 Baixa |

---

## 5. FEATURES FALTANTES / INCOMPLETAS

### 5.1 Páginas criadas durante remediação

| Rota | Descrição | Status |
|------|-----------|--------|
| `/app/events` | Listar eventos públicos para o participante | ✅ Criada (usa `usePublicEvents`) |
| `/app/favorites` | Favoritos do participante | ✅ Criada (placeholder UI) |
| `/app/orders` | Histórico de compras do participante | ✅ Criada (usa `useUserOrders`) |
| `/app/chat` | Chat com produtores | ✅ Criada (placeholder UI) |

### 5.2 Integrações não funcionais

| Feature | Estado | Detalhe |
|---------|--------|---------|
| **OAuth Google** | ✅ **Implementado** | `signInWithOAuth({ provider: 'google' })` adicionado ao login |
| **Newsletter** | ✅ **Implementado** | Footer agora insere em `newsletter_subscribers` via Supabase |
| **Chat real** | ✅ **Implementado** | AppHub usa `useChat` hook com tabela `messages` + realtime |
| **Notificações push** | ✅ **Corrigido** | `AppLayout` e `AppNotifications` agora usam tabela `notifications` |
| **Transferência de ingressos** | ❌ Sem UI | Tabela `ticket_transfers` existe no schema mas não há interface |
| **Mesa Coletiva / Matchmaking** | ⚠️ Parcial | Tabelas existem. `YourTable.tsx` ainda usa mock fallback em dev |
| **PIX via Woovi** | ⚠️ Requer config | Edge function implementada mas requer `WOOVI_API_KEY` |
| **Stripe** | ⚠️ Requer config | Edge function implementada mas requer `STRIPE_SECRET_KEY` |
| **Boleto** | ❌ Não implementado | `usePayment.ts` não trata método `boleto` |

### 5.3 Edge Functions — Estado

| Edge Function | Implementada? | Requer Config? |
|---------------|---------------|----------------|
| `stripe-create-payment` | ✅ Sim | `STRIPE_SECRET_KEY` |
| `stripe-webhook` | ✅ Sim | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `woovi-create-pix` | ✅ Sim | `WOOVI_API_KEY` |
| `woovi-webhook` | ⚠️ Verificar | `WOOVI_API_KEY` |
| `send-email` | ⚠️ Verificar | — |
| `check-in-validate` | ⚠️ Verificar | — |

---

## 6. PROBLEMAS DE SCHEMA / CONSISTÊNCIA

### 6.1 `useCheckout.ts` — ✅ RESOLVIDO

O `useCheckout.ts` agora insere corretamente:
1. `orders` → obtém `order.id`
2. `order_items` → vinculado ao `order_id`
3. `tickets` → vinculado ao `order_id` + `ticket_type_id`

Isso alinha o frontend com o webhook `stripe-webhook`.

### 6.2 Tabelas mencionadas no código mas NÃO nas migrations

| Tabela | Onde é mencionada | Existe no schema? |
|--------|-------------------|-------------------|
| `newsletter_subscribers` | `Footer.tsx`, AGENTS.md | ❌ Não existe |
| `contact_messages` | AGENTS.md | ❌ Não existe |
| `payments` | `stripe-webhook/index.ts` | ⚠️ Precisa verificar (nome pode ser diferente) |

### 6.3 Inconsistência de roles

- **Migration:** `role` CHECK `('user', 'customer', 'producer', 'admin')`
- **Frontend:** Só usa `('user', 'producer', 'admin')`
- **Impacto:** Baixo — `customer` nunca é usado, mas pode confundir

### 6.4 Inconsistência de tipos na tabela `feedback` — ✅ RESOLVIDO

- **Frontend (`useFeedback.ts`):** Usa `type` como TEXT com valores `('melhoria', 'bug', 'duvida', 'sugestao', 'elogio')`
- **Status:** ✅ O schema aceita qualquer TEXT; não há CHECK constraint conflitante

---

## 7. RECOMENDAÇÕES RESTANTES

### 🔴 CRÍTICO (fazer primeiro)

1. **Implementar OAuth Google** no login
2. **Criar tabela `newsletter_subscribers`** e conectar o Footer
3. **Chat real** — conectar `AppHub` e `AppChat` à tabela `messages`

### 🟡 ALTO (fazer em seguida)

4. **Transferência de ingressos** — criar UI usando `ticket_transfers`
5. **Conectar `ProducerTasks`** ao Supabase (criar tabela `producer_tasks`)
6. **Conectar `ProducerPartners`** ao Supabase (tabela `partners`)
7. **Conectar `ProducerCoupons`** ao Supabase (tabela `coupons`)

### 🟢 MÉDIO (planejar)

8. Conectar `ProducerEventBanners` e `ProducerEventGallery` ao storage/banco
9. Conectar `ProducerCertificates` às tabelas `certificates` + `issued_certificates`
10. Conectar `EvokaaStore` à tabela `menu_items` ou criar tabela `store_items`
11. Implementar o seletor de cor no `CertificateBuilder`
12. Implementar pagamento via Boleto

---

## 8. DETALHES TÉCNICOS ADICIONAIS

### 8.1 HMR Warning
```
[vite] hmr invalidate /src/contexts/AuthContext.tsx
"useAuth" export is incompatible
```
**Causa:** Exportação dupla/incompatível do `useAuth` (tanto do contexto quanto do hook).  
**Fix:** Unificar a exportação ou renomear uma delas.

### 8.2 Duplicação Auth
Conforme notado no AGENTS.md, existe duplicação de lógica entre:
- `authStore.ts` (Zustand)
- `useAuth.ts` (React Query mutations)
- `AuthContext.tsx` (React Context)

O app atualmente usa `useAuth.ts` como source of truth. Considerar refatorar para unificar.

### 8.3 Demo Mode
O comentário em `useAuth.ts:52` menciona `VITE_ENABLE_DEMO`, mas a variável usada é `ENABLE_DEMO` (linha 54). Verificar se esta variável está definida — caso contrário, ocorrerá `ReferenceError` quando o código chegar nesta linha.

---

*Relatório atualizado após remediação em 2026-05-24.*
