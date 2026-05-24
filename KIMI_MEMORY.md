# KIMI_MEMORY — Aura Tickets

Arquivo de memória persistente do projeto Aura Tickets.
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

- [ ] **Unificar lógica de autenticação** (`authStore.ts` vs `useAuth.ts`) — recomendação: Opção A (centralizar no `useAuth`)
- [ ] **Reverter workaround do login via fetch** (se versão mais recente do `@supabase/supabase-js` corrigir o bug)
- [ ] **Adicionar testes automatizados** — sugestão: `vitest` + `@testing-library/react` + `playwright` para E2E
- [ ] **Migrar React Router para v7** — pendente de necessidade (atual é ^6.30.3)
- [ ] **Consolidar porta do Vite** — adicionar `strictPort: false` no `vite.config.ts`
- [ ] **Revisar persistência do authStore** — validar token na inicialização para evitar flash de UI incorreta
- [ ] **Configurar env vars no Vercel** — se ainda não estiverem configuradas no dashboard

---

## 📝 Notas Gerais & Dicas para o Agente

- **Shell/bash pode estar quebrado** neste ambiente Windows (crash com `0xC0000005` / fork errors). Sempre que possível, prefira `ReadFile`, `WriteFile`, `StrReplaceFile` com caminhos absolutos.
- **Regra de DOM:** Sempre que houver troca condicional entre texto e ícones dentro do mesmo elemento, usar `<span>` ou `<div>`, nunca Fragment (`<>`) com texto solto.
- **React 19:** Alguns padrões de hooks podem ser ligeiramente diferentes do React 18. Verificar compatibilidade.
- **Supabase:** O `useAuth.ts` faz login via `fetch` direto na REST API. Se precisar debugar auth, verifique os headers `apikey` e `Authorization`.
- **Variáveis de ambiente:** Devem estar em `app/.env` (não na raiz). Nunca commitar `.env`.
- **Cores customizadas Tailwind:** `plum`, `espresso`, `cream`, `canvas`, `void`.

---

*Última atualização: 2026-05-23*
*Próxima sessão: verificar pendências acima e evoluir features do produtor*
