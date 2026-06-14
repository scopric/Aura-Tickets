# Guia de Deploy no Vercel — Evokaa Tickets

Este guia explica passo a passo como configurar as variáveis de ambiente no Vercel para o deploy funcionar corretamente.

---

## ✅ Pré-requisitos

- [ ] Projeto já importado no Vercel (via GitHub/GitLab ou CLI)
- [ ] Acesso ao dashboard do Vercel: https://vercel.com/dashboard
- [ ] Arquivo `app/.env.local` com as credenciais do Supabase (já existe no seu ambiente local)

---

## 🔧 Passo a Passo

### 1. Acesse o Dashboard do Vercel

1. Vá para https://vercel.com/dashboard
2. Clique no projeto **Evokaa Tickets** (ou "aura-platform-brown-alpha" se for esse o nome)
3. No menu superior, clique em **"Settings"**

### 2. Navegue até Environment Variables

1. No menu lateral esquerdo, clique em **"Environment Variables"**
2. Você verá um formulário para adicionar novas variáveis

### 3. Adicione as Variáveis do Supabase

#### Variável 1: `VITE_SUPABASE_URL`

| Campo | Valor |
|-------|-------|
| **Name** | `VITE_SUPABASE_URL` |
| **Value** | `https://rwaezeqyuhxrssntcxdv.supabase.co` |
| **Environment** | ✅ Production, ✅ Preview, ✅ Development |

> 💡 Dica: O valor acima é a URL do seu projeto Supabase. Se estiver diferente no seu `.env.local`, use o valor do seu arquivo local.

#### Variável 2: `VITE_SUPABASE_ANON_KEY`

| Campo | Valor |
|-------|-------|
| **Name** | `VITE_SUPABASE_ANON_KEY` |
| **Value** | Cole aqui a chave anônima do seu Supabase (começa com `eyJhbGciOiJIUzI1NiIs...`) |
| **Environment** | ✅ Production, ✅ Preview, ✅ Development |

> ⚠️ **IMPORTANTE:** O valor da `VITE_SUPABASE_ANON_KEY` está no seu arquivo `app/.env` ou `app/.env.local`. **Nunca compartilhe este valor publicamente.**

### 4. Salve as Variáveis

1. Clique em **"Save"** para cada variável
2. Verifique se ambas aparecem na lista de variáveis configuradas

### 5. Faça um Redeploy

As variáveis só são aplicadas em builds novos. Você precisa fazer um novo deploy:

**Opção A — via Dashboard:**
1. Vá para a aba **"Deployments"**
2. Encontre o deploy mais recente
3. Clique nos **três pontinhos** (⋮) à direita
4. Selecione **"Redeploy"**

**Opção B — via Git (recomendado):**
1. Faça um commit qualquer e push para a branch `main`
2. O Vercel detecta automaticamente e faz o deploy

```bash
cd app
git add .
git commit -m "chore: configura env vars para deploy"
git push origin main
```

**Opção C — via CLI do Vercel:**
```bash
cd app
npx vercel --prod
```

---

## 🧪 Verificação Após Deploy

Acesse a URL do deploy e verifique:

1. [ ] A página carrega sem tela branca
2. [ ] O console do navegador não mostra erro de env vars
3. [ ] O login funciona (teste com `produtor@aura.teste` / `senha123`)
4. [ ] O dashboard do produtor carrega corretamente

---

## 🐛 Problemas Comuns

### "As variáveis de ambiente do Supabase não estão definidas"

**Causa:** As env vars não foram configuradas no Vercel ou o deploy foi feito antes de configurar.  
**Solução:** Siga os passos 3-5 acima.

### "Invalid API key"

**Causa:** A `VITE_SUPABASE_ANON_KEY` está incorreta ou é a chave de service role (errada).  
**Solução:** Verifique se você copiou a chave **anônima** (pública), não a `service_role`. A chave anônima está em: Supabase Dashboard → Project Settings → API → `anon public`.

### "Failed to fetch" ou CORS

**Causa:** URL do Supabase incorreta ou projeto do Supabase pausado/inacessível.  
**Solução:** Verifique a `VITE_SUPABASE_URL` e confirme que o projeto Supabase está ativo.

---

## 📋 Checklist Final

- [ ] `VITE_SUPABASE_URL` adicionada no Vercel
- [ ] `VITE_SUPABASE_ANON_KEY` adicionada no Vercel
- [ ] Ambas marcadas para Production, Preview e Development
- [ ] Redeploy realizado
- [ ] Site carrega sem erros
- [ ] Login testado com sucesso

---

*Última atualização: 2026-05-24*
