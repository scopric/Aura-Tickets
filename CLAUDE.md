# Evokaa — instruções do Claude Code neste repositório

Plataforma de venda de ingressos e gestão de eventos (site institucional, área de participantes e produtores, painel de administração). Um único app React 19 + TypeScript + Vite em `app/`, com Supabase (login, Postgres, Realtime, Edge Functions) e publicação na Vercel a cada merge no `main`. Pagamento ainda em modo de teste.

## Onde estão as coisas

- Código ativo: `app/src/` (`pages/`: páginas públicas soltas na raiz e subpastas `auth`, `app`, `producer`, `admin`, `checkout`; `components/`; `hooks/` com TanStack Query + Supabase; `lib/`; `types/database.ts`). Os arquivos da raiz do repositório não fazem parte do build.
- Testes: `app/src/test/` (Vitest) e Playwright (`npm run test:e2e`). Comandos em `app/package.json`; visão geral no [`README.md`](README.md).
- Banco: migrations antigas arquivadas em `docs/archive/migrations-antigas/` (não aplicar) e SQL novo em `docs/sql/`. Tipos em `app/src/types/database.ts`.
- Contexto para qualquer agente, histórico e o ruleset do Ponytail: [`AGENTS.md`](AGENTS.md).

## Regras que só quem mantém o projeto sabe

- Ramo por tarefa a partir do `main` atualizado, com pull request; o mantenedor mescla e aplica SQL em produção. Nunca `push` direto no `main`.
- Repositório público: nenhuma chave, senha ou token em arquivo versionado. Variáveis públicas do front começam com `VITE_`; a `service_role` do Supabase nunca vai ao front.
- Não crie arquivos em `supabase/migrations/` (a integração com o GitHub os aplicaria em produção). SQL vai para `docs/sql/`.
- O código se adapta ao banco, não o contrário: antes de usar uma coluna, confirme que ela existe no schema.
- Modo de trabalho: Ponytail (código enxuto), ativo por plugin em toda sessão; o texto está em `AGENTS.md`. Não simplifica validação de entrada, tratamento de erro que evita perda de dado, segurança nem acessibilidade.
- Todo código novo ou alterado passa por revisão antes de virar PR; antes de publicar, revisão de segurança.

## Como rodar

```bash
cd app && npm install && npm run dev    # http://localhost:3000
npm run test -- --run                   # Vitest (sem --run fica em modo de observação)
npm run test:e2e                        # Playwright
```
