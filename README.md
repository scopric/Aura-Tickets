# Aura Tickets / Evokaa

Plataforma de venda e gestão de ingressos para eventos (ticketeira), com painéis para
**produtores**, **administradores** e **participantes**. Inclui criação e publicação de
eventos, checkout, check-in por QR Code, CRM, cardápio digital, mesas coletivas
(matchmaking), certificados e mais.

> ⚠️ O **gateway de pagamento está em modo mock** por enquanto (aguardando CNPJ). O fluxo
> de checkout cria pedidos reais, mas a cobrança não é processada em produção.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind + shadcn/ui (Radix)
- **Estado/Dados:** Zustand + TanStack Query
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions em Deno)
- **Deploy:** Vercel (SPA), root directory = `app/`
- **Testes:** Vitest (unit) + Playwright (e2e)

## Estrutura do repositório

```
app/                  ← A aplicação (é a raiz do projeto no Vercel)
  src/
    pages/            ← Rotas (public, auth, app, producer, admin, checkout)
    components/       ← UI e layouts
    hooks/            ← Hooks de dados (padrão TanStack Query + Supabase)
    lib/              ← supabase client, helpers
    types/            ← database.ts (tipos do schema)
    test/             ← Vitest + Playwright
supabase/
  migrations/         ← Migrations SQL (schema + RLS)
  functions/          ← Edge Functions (stripe, woovi/pix, check-in, e-mail…)
docs/archive/         ← Documentação histórica de planejamento/análise
AGENTS.md             ← Convenções para agentes de IA neste repo
```

## Como rodar localmente

Pré-requisitos: **Node.js 20+**.

```bash
cd app
npm install
cp .env.example .env.local   # preencha as variáveis abaixo
npm run dev                  # http://localhost:3000
```

### Variáveis de ambiente (`app/.env.local`)

```
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-chave-anon>
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX   # opcional: Google Analytics 4; sem ela o GA não carrega
```

> Variáveis expostas ao client **devem** começar com `VITE_`. A chave `anon` é pública por
> design (protegida por RLS no banco). **Nunca** exponha a `service_role` no frontend.

## Scripts (em `app/`)

| Comando | Ação |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Build de produção (`vite build`, sem checagem de tipos) |
| `npx tsc -b` | Checagem de tipos (centenas de erros herdados; o CI roda sem bloquear) |
| `npm run lint` | ESLint |
| `npm run test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes e2e (Playwright) |

## Banco de dados (Supabase)

O schema vive em `supabase/migrations/`. Aplique as migrations no seu projeto Supabase
(via Supabase CLI ou colando no SQL Editor, em ordem). Os tipos TypeScript do banco ficam
em `app/src/types/database.ts` e devem ser mantidos em sincronia com o schema.

## Deploy (Vercel)

- **Root Directory:** `app`
- **Framework Preset:** Vite · **Build:** `npm run build` · **Output:** `dist`
- Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas Environment Variables.
- **Analytics:** Vercel Web Analytics (ligar em Analytics → Enable no painel; `<Analytics />` já está no `App.tsx`)
  e Google Analytics 4 (`VITE_GA_MEASUREMENT_ID` só em Production; carrega apenas após o consentimento
  de cookies analíticos, com `page_view` manual por rota — na medição aprimorada do GA4, desligue
  "alterações de página com base em eventos do histórico do navegador" para não contar em dobro).
- `app/vercel.json` já contém os rewrites de SPA. Detalhes em `app/DEPLOY.md`.
