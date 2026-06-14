# Diagnóstico — Conexão com o Supabase

**Data:** 2026-06-14
**Sintoma:** "o Supabase não funciona" (MCP não conecta, não é possível aplicar/verificar migrations
a partir do ambiente Claude Code na web).

## Causa raiz (confirmada)

O **ambiente de execução remoto do Claude Code** tem uma **política de rede (egress) restritiva**
que bloqueia a saída para os domínios do Supabase. Teste feito a partir do contêiner:

```
GET https://rwaezeqyuhxrssntcxdv.supabase.co/auth/v1/health
→ HTTP 403 — "Host not in allowlist: rwaezeqyuhxrssntcxdv.supabase.co.
   Add this host to your network egress settings to allow access."
```

É um **allowlist seletivo**: `registry.npmjs.org` é permitido, mas `registry.npmmirror.com` e
`*.supabase.co` são bloqueados.

### O que isso explica
- O **Supabase MCP** nunca apareceu na sessão: não há config de MCP no repo **e** o egress
  bloquearia a conexão de qualquer forma.
- O `npm install` falhava no início (o lockfile apontava para `npmmirror.com`, bloqueado).
  Corrigido regenerando o lockfile contra `registry.npmjs.org`.

### O que NÃO é o problema
- O código do cliente Supabase (`app/src/lib/supabase.ts`) está correto.
- O app **em produção (Vercel) não é afetado** — a Vercel alcança o Supabase normalmente.
  Este bloqueio é apenas do ambiente de execução do Claude.
- A organização onde o projeto está no Supabase (org **scopric**) é irrelevante para o bloqueio.

## Como corrigir (na configuração do ambiente, não no código)

1. Na configuração do **environment** do Claude Code na web (network policy), use uma política de
   rede ampla **ou** adicione ao allowlist de egress:
   - `rwaezeqyuhxrssntcxdv.supabase.co`
   - `*.supabase.co` e `*.supabase.in` (auth, realtime, storage usam subdomínios)
2. (Opcional, para operar o banco direto pelo Claude) Configure o **Supabase MCP** para o ambiente
   remoto — hoje não existe nenhuma config de MCP no repositório.
3. Abra uma **sessão nova** para as mudanças entrarem em vigor.

Doc oficial: https://code.claude.com/docs/en/claude-code-on-the-web

## Verificações adicionais recomendadas
- **Projeto pausado?** Projetos free do Supabase pausam após ~1 semana de inatividade. Confirme no
  dashboard que o projeto `rwaezeqyuhxrssntcxdv` está **ativo**.
- **Variáveis na Vercel:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas no projeto.
- **RLS:** após aplicar `supabase/migrations/20260614120000_gapfix_missing_tables.sql`, rodar
  `supabase/verify_gapfix.sql` para confirmar tabelas + policies.

## Quando o egress estiver liberado
Com `*.supabase.co` no allowlist (e o MCP configurado), é possível, a partir do Claude:
aplicar as migrations, verificar RLS e testar persistência ponta-a-ponta das telas convertidas.
