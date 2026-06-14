# KIMI_MEMORY — Evokaa Tickets

Arquivo de memória persistente do projeto Evokaa Tickets (antigo Aura Tickets).
**ATENÇÃO:** Este arquivo deve ser atualizado pelo agente ao final de cada sessão significativa. Mantenha-o organizado e conciso.

---

## 🏛️ Estado Atual do Projeto

- **Branch:** main
- **Marca:** Evokaa (rebranding de Aura Tickets concluído no frontend — `index.html`, manifest, SEO usam "Evokaa")
- **Deploy:** Vercel (`aura-platform`, projectId: prj_azWxjoISRIyF42ftSdiHmFFyvFMV)
- **Domínio pretendido:** `https://www.evokaa.com.br/` — ✅ **ATIVO E FUNCIONAL**
- **Banco de dados:** Supabase (`rwaezeqyuhxrssntcxdv.supabase.co`)
- **Build:** Funcionando e otimizado com Tema Claro/Escuro
- **Porta de desenvolvimento:** 3000 (Vite)
- **Variáveis de ambiente:** Existem em `app/.env.local` e ✅ cadastradas na Vercel

---

## 📊 Inventário Real do Código

| Categoria | Quantidade | Notas |
|-----------|-----------|-------|
| Páginas .tsx | 72 | 42 producer + 10 admin + 7 app + 4 auth + 3 checkout + 6 públicas |
| Componentes .tsx | 80 | 55 shadcn/ui + 25 custom (incluindo PhoneInput.tsx) |
| Hooks .ts | 17 | 6 principais + 11 especializados |
| Contextos | 1 | AuthContext |
| Stores | 1 | authStore (Zustand) |
| Edge Functions | 6 | check-in, email, Stripe create/webhook, Woovi create/webhook |
| Migrações SQL | 10 | Adicionada a migração de Geografia do Brasil |
| Tabelas Supabase | 45+ | Sincronizadas com novas tabelas geográficas e de sistema |
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
| ProducerSettings | Persistência real (profiles, producer_profiles, team_members), com CNPJ, CEP e PhoneInput integrados |
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
- Todas implementadas visualmente. Integração parcial. `AdminSettings.tsx` possui persistência real na tabela `system_settings` para as abas Geral, SMTP, Moderação e APIs de busca postal.

### App/Participante (7 páginas)
- Hub, Tickets, Notifications, Profile, Settings, Download
- `Profile.tsx` persistido no Supabase, contendo preenchimento automático de CEP, autocomplete geográfico de Cidade/Estado do banco e `PhoneInput` internacional.
- `UserSettings.tsx` é **MOCK** — não persiste no Supabase.

### Checkout
- Seleção de ingressos + cálculo de taxas
- `/checkout/payment` integrado com `formatCurrency` dinâmico exibindo a moeda global e bandeiras do país correspondente.
- `/checkout/success` existe.

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

---

## 🔧 Decisões Técnicas Ativas

| Decisão | Data | Status | Detalhes |
|---------|------|--------|----------|
| Auth via Supabase JS oficial | 2026-05-24 | Ativo | Removido workaround REST API |
| Porta Vite: 3000 | 2026-05-23 | Ativo | `strictPort: false` |
| Marca Evokaa | 2026-05-23 | Parcial | Migração de textos em andamento |

---

## ✅ Histórico de Alterações

### 2026-06-07 (Sessão v2.5) — Padronização, Internacionalização Cadastral e Moedas Dinâmicas
- **Geografia BR**: Criada a migration `00000000000010_brazilian_geography.sql` com estados e principais cidades brasileiras com RLS de leitura pública para o preenchimento de endereço cadastral.
- **Utilitário de Formatação**: Criado `formatters.ts` com funções nativas de formatação de telefones, CPF, CNPJ, CEP/Aircode e `formatCurrency` exibindo bandeiras dinâmicas de acordo com o país.
- **Componente de Telefone Internacional**: Criado `PhoneInput.tsx` contendo dropdown de DDI/bandeiras e máscaras reativas dinâmicas.
- **Busca Postal de CEP**: Criado `cepService.ts` integrando ViaCEP (BR), APIs Geoapify/Google (usando chaves do painel admin) e fallback internacional Nominatim OSM.
- **Integração de Telas**: Atualizados os formulários de Perfil do Participante (`Profile.tsx`), Configurações do Produtor (`ProducerSettings.tsx`), Painel Admin (`AdminSettings.tsx`) e a tela de pagamento do Checkout (`Payment.tsx`) com os formatadores e inputs internacionais.
- **Deploy de Produção**: Alterações commitadas e enviadas para a branch `main` no GitHub, disparando a pipeline de deploy na Vercel oficial.

### 2026-06-05 (Sessão v2.4) — Correções de Responsividade Flexbox no SeatingMap e Diagnóstico Supabase
- **Correções de Layout no SeatingMap**: Resolvido de forma robusta o estouro horizontal que cortava a barra lateral direita de propriedades do editor de mapa. Adicionados delimitadores de largura e contêineres flexbox flexíveis (`min-w-0` e `w-full max-w-full`) no layout raiz, header e rodapé de [SeatingMap.tsx](file:///c:/Users/scopa/OneDrive/Documentos/Gemini/Antigravity/Aura%20Tickets/app/src/pages/producer/SeatingMap.tsx).
- **Diagnóstico de Banco de Dados**: Identificada a ausência da tabela `seating_maps` no Supabase ativo do projeto. Criada a query SQL necessária de criação de tabela, trigger e RLS para o checkout.
- **Deploy e Build**: Verificados os tipos com `npm run build` localmente e realizado o deploy na Vercel com alias atualizado para o domínio oficial `www.evokaa.com.br` com absoluto sucesso.

### 2026-06-04 (Sessão v2.2 - v2.3) — Tema Claro/Escuro nos Painéis e Correções de Produção
- **Correções de Produção (v2.2)**: Configuração correta das credenciais de produção do Supabase (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) no painel da Vercel. Correção dos loadings infinitos e dos erros de requisição à API Supabase.
- **Contraste de Parcelamento**: Redesenhada a página de parcelamento do produtor (`Installments.tsx`) com Bento Glassmorphism e contraste correto de textos e inputs para melhor legibilidade no modo escuro.
- **Implementação do Tema Claro/Escuro nos Painéis (v2.3)**: Criação de um sistema global de temas via `ThemeContext.tsx` e `ThemeToggle.tsx`. O tema é persistido e aplicado nos layouts do Produtor, Admin e Participante.

---

## ⏳ Próximos Passos (Priorizados)

### 🔴 P0 — Integração Real de Componentes Mocks
- [ ] Implementar persistência dos dados de `UserSettings` do participante no Supabase.
- [ ] Conectar as configurações de `Brand.tsx` do produtor e `Wallet.tsx` com ações de saques reais no banco de dados.

### 🔥 P1 — Cobertura de Testes Automatizados
- [ ] Desenvolver testes unitários para a lógica de autenticação (`useAuth`) e checkout.
- [ ] Concluir testes E2E básicos usando o Playwright para garantir que o fluxo de checkout não quebre após alterações visuais.

---

## 🧪 Testes Realizados
- Validada compilação estática (`npm run build`) com 100% de sucesso.
- Formatação reativa de telefone, CPF, CNPJ e CEP verificados.
- Integração de moedas com bandeiras (BRL, USD, EUR, GBP) no checkout testada.

---

## ⚠️ Notas Gerais & Dicas para o Agente

- **SEMPRE usar `app/src/...`** — arquivos na raiz são obsoletos.
- **Shell/bash pode estar quebrado** no Windows; prefira manipular arquivos diretamente.
- **Regra de DOM**: Evite fragmentos com texto solto. Use `<span>` ou `<div>`.
- **Variáveis de ambiente**: Devem estar em `app/.env` (nunca commitar).
- **Cores customizadas Tailwind**: `plum` (azul royal da logo), `void` (marinho profundo), `espresso`, `cream`, `canvas`.

*Última atualização: 2026-06-07*
