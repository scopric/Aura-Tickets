# KIMI_MEMORY — Evokaa Tickets

Arquivo de memória persistente do projeto Evokaa Tickets.
**ATENÇÃO:** Este arquivo deve ser atualizado pelo agente ao final de cada sessão significativa. Mantenha-o organizado e conciso.

---

## 📋 Estado Atual do Projeto

- **Branch:** main
- **Deploy:** Vercel (configurado, aguardando env vars se necessário)
- **Banco de dados:** Supabase (tabelas principais criadas e verificadas em 2026-05-23)
- **Build:** Funcionando (última verificação 2026-05-23)
- **Porta de desenvolvimento:** 3000 (Vite), às vezes 3001 se houver conflito

---

## 🏗️ Decisões Técnicas Ativas

| Decisão | Data | Status | Detalhes |
|---------|------|--------|----------|
| Auth via fetch direto na REST API do Supabase | 2026-05-23 | Ativo | Workaround para bug do supabase-js com chaves `sb_publishable`. Verificar em atualizações futuras se pode reverter para `supabase.auth.signInWithPassword`. |
| Porta Vite: 3000 | 2026-05-23 | Pendente | Às vezes conflita, usuário roda em 3001. Sugestão: adicionar `strictPort: false` no `vite.config.ts`. |
| Persistência authStore no localStorage | 2026-05-23 | Ativo | Pode causar inconsistência se token expirar no Supabase mas o frontend ainda acreditar que o usuário está logado. Validar na inicialização. |

---

## 🐛 Erros Conhecidos & Soluções Aplicadas

| Erro | Onde | Solução Aplicada | Data |
|------|------|------------------|------|
| `removeChild`/`insertBefore` no login | `app/src/pages/auth/Login.tsx` | Texto solto envolvido em `<span>`, `autoComplete="off"` nos inputs | 2026-05-23 |
| Crash quando `user.avatar` ou `user.name` é null | `ProducerLayout.tsx` | Fallback para logo padrão (`/images/logo-aura.png`) e nome genérico (`Usuário`) | 2026-05-23 |
| Env vars não definidas no Vercel | Deploy | Adicionar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no dashboard Vercel | 2026-05-23 |
| Shell/bash instável no Windows | Ambiente | Usar ReadFile/WriteFile/StrReplaceFile em vez de Shell quando possível | 2026-05-23 |

---

## ✅ Histórico de Alterações (cronológico inverso)

### 2026-05-24 — Automação Kimi CLI + Refatorações Core + Event Manager Real
- Criado sistema de inicialização do Kimi CLI (`Iniciar-Kimi-Evokaa.bat`, `Iniciar-Kimi-Evokaa.ps1`)
- Criado agente customizado `aura-agent.yaml` com system prompt dedicado
- Criado `KIMI_MEMORY.md` para memória persistente entre sessões
- **T2:** Adicionado `strictPort: false` em `vite.config.ts` (porta 3000/3001 resolvida)
- **T3:** Unificada lógica de autenticação — removidos métodos duplicados `signIn`/`signUp`/`signOut` do `authStore.ts`
- **T4:** Removido workaround de login via `fetch` manual — agora usa exclusivamente `supabase.auth.signInWithPassword` (API oficial)
- **T5:** Adicionados testes unitários para `useAuth` (`useAuth.test.tsx`) e `authStore` (`authStore.test.ts`)
- **T6:** Adicionadas future flags do React Router v6 (`v7_startTransition`, `v7_relativeSplatPath`) em `main.tsx`
- Criado `VERCEL_DEPLOY_GUIDE.md` com passo a passo para configurar env vars no Vercel
- **Event Manager real:** `pages/producer/EventManager.tsx` refatorado para usar `useProducerEvents()` (dados reais do Supabase). Ações de duplicar, arquivar e excluir agora funcionam no banco. Status, receita e vendas calculados a partir de `ticket_types`.
- **Hub do participante real:** `pages/app/Hub.tsx` atualizado:
  - Corrigidos IDs dos mocks em `useUserTickets` e `useUserOrders` para bater com o usuário demo do auth
  - Cardápio agora usa `useEventMenuItems()` (dados reais do Supabase) vinculado ao evento do ingresso ativo do usuário
  - Nome do usuário no header agora vem do `useAuth()` em vez de hardcoded
  - Adicionados loading states e empty states para ingressos e cardápio
- **Chat real:** Criado hook `useChat.ts` com Supabase Realtime para mensagens instantâneas. Tabela `messages` criada com RLS. Chat no Hub substituído de mock para dados reais do banco.
- **Mesa Coletiva (Matchmaking):** ENTREGUE COMO DIFERENCIAL DA PLATAFORMA:
  - Schema SQL completo: `user_profiles_ext`, `collective_tables`, `table_members`, trigger `trg_collective_ticket`, view `collective_table_summary`
  - Hook `useMatchmaking.ts` com: `useMatchmakingProfile`, `useMyTable`, `useTableMembers`, `useCollectiveTables`, `useRunMatchmaking`, `useGenerateIcebreaker`
  - **Algoritmo de matchmaking no cliente:** calcula compatibilidade por temperamento (30%), intenção (20%), música (20%), energia (20%), gênero (10%). Agrupa em clusters, gera nomes temáticos dinâmicos ("Mesa Aurora", "Mesa Nexus", etc.)
  - `ProfileQuiz.tsx` REFATORADO com design premium: fundo aurora/plasma animado, transições GSAP, partículas na tela de análise, persistência no Supabase
  - `YourTable.tsx` REFATORADO com design cinematográfico: layout circular dos membros, score animado, aurora no fundo, contador regressivo, quebra-gelo, missão da mesa
  - `Success.tsx` integrado com YourTable real (recebe eventId)
  - Testes unitários do algoritmo em `matchmaking.test.ts`

### 2026-05-23 — Preparação para Deploy e Hardening
- `vite.config.ts`: Plugin `kimi-plugin-inspect-react` agora só roda em `mode === 'development'`
- `src/lib/supabase.ts`: `throw` de env vars só em `import.meta.env.DEV`
- `vercel.json`: SPA rewrite + cache de assets
- `src/pages/auth/Login.tsx`: Fix `removeChild`/`insertBefore` (browser extensions)
- `src/main.tsx`: StrictMode + ErrorBoundary global + QueryClient config (2 retries, staleTime 5min)
- `src/components/ErrorBoundary.tsx`: Componente global criado com UI amigável
- `src/components/ProducerLayout.tsx`: Null-safety para avatar/name
- `src/components/FeedbackButton.tsx`: Conectado à tabela `feedback` do Supabase
- `src/components/ContactSection.tsx`: Newsletter conectada à tabela `newsletter_subscribers`
- `src/pages/Contact.tsx`: Form de contato conectado à tabela `contact_messages`
- `index.html`: Meta tags SEO, Open Graph, manifest, favicon
- `public/robots.txt` e `public/sitemap.xml` criados
- `public/manifest.json` para PWA criado

---

## 🧪 Testes Realizados

| Teste | Data | Resultado | Notas |
|-------|------|-----------|-------|
| Login com produtor@aura.teste | 2026-05-23 | ✅ OK | Redirecionamento correto para `/producer/dashboard` |
| Verificação de imports | 2026-05-23 | ✅ OK | 73+ imports em 40+ arquivos, nenhum erro encontrado |
| Tabelas do Supabase | 2026-05-23 | ✅ OK | `feedback`, `contact_messages`, `newsletter_subscribers` — inserts de teste OK |
| Build de produção | 2026-05-23 | ✅ OK | Passou sem erros após hardening |

---

## ⏳ Próximos Passos / Pendências

### ✅ Concluídos em 2026-05-24
- [x] **Unificar lógica de autenticação** (`authStore.ts` vs `useAuth.ts`) — removidos métodos duplicados do store
- [x] **Reverter workaround do login via fetch** — removido fallback, agora usa `supabase.auth.signInWithPassword`
- [x] **Adicionar testes automatizados** — base criada (vitest + testing-library + playwright configs já existiam)
- [x] **Migrar React Router para v7** — future flags ativadas (`v7_startTransition`, `v7_relativeSplatPath`)
- [x] **Consolidar porta do Vite** — `strictPort: false` adicionado

### ⏳ Ainda pendentes
- [ ] **Configurar env vars no Vercel** — guia criado em `VERCEL_DEPLOY_GUIDE.md`, aguardar execução manual no dashboard
- [ ] **Revisar persistência do authStore** — validar token na inicialização para evitar flash de UI incorreta quando token expirar
- [ ] **Expandir cobertura de testes** — adicionar testes E2E para checkout e criação de evento
- [ ] **Testar login real do Supabase** — verificar se `supabase.auth.signInWithPassword` funciona 100% sem o fallback
- [x] **Ingressos reais no Hub do participante** — `useUserTickets` já buscava do banco, mas mock tinha ID errado. Cardápio agora usa `useEventMenuItems` real. Loading e empty states adicionados.
- [x] **Chat real participante ↔ produtor** — hook `useChat.ts` criado com Supabase Realtime. Tabela `messages` com RLS. Chat no Hub funcional.
- [x] **Mesa Coletiva (matchmaking)** — ENTREGUE: schema, algoritmo, ProfileQuiz premium, YourTable cinematográfico, integração completa
- [ ] **Comunicações reais** — não integra com provedor de envio (SendGrid/Twilio)
- [ ] **Relatório pós-evento real** — PostEventReport é hardcoded
- [ ] **Mapa de lugares integrado com ingressos** — SeatingMap não vincula com ticket_types

---

## 📝 Notas Gerais & Dicas para o Agente

- **Shell/bash pode estar quebrado** neste ambiente Windows (crash com `0xC0000005` / fork errors). Sempre que possível, prefira `ReadFile`, `WriteFile`, `StrReplaceFile` com caminhos absolutos.
- **Regra de DOM:** Sempre que houver troca condicional entre texto e ícones dentro do mesmo elemento, usar `<span>` ou `<div>`, nunca Fragment (`<>`) com texto solto.
- **React 19:** Alguns padrões de hooks podem ser ligeiramente diferentes do React 18. Verificar compatibilidade.
- **Supabase:** O `useAuth.ts` faz login via `fetch` direto na REST API. Se precisar debugar auth, verifique os headers `apikey` e `Authorization`.
- **Variáveis de ambiente:** Devem estar em `app/.env` (não na raiz). Nunca commitar `.env`.
- **Cores customizadas Tailwind:** `plum`, `espresso`, `cream`, `canvas`, `void`.

---

*Última atualização: 2026-05-24*
*Próxima sessão: testar build, configurar env vars no Vercel, revisar persistência do authStore, próxima funcionalidade a escolher*
