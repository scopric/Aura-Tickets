# Guia de Deploy — Aura Tickets / Evokaa

**Projeto Vercel:** `aura-platform`  
**Project ID:** `prj_azWxjoISRIyF42ftSdiHmFFyvFMV`  
**Org ID:** `team_Nox6jNrYUnDET3MIXC3tEj2p`  
**Domínio alvo:** `https://www.evokaa.com.br/`  
**Data:** 25 de maio de 2026

---

## ⚠️ Status Atual do Deploy

| Item | Status |
|------|--------|
| Build local | ✅ Funcionando (`app/dist/` gerado) |
| Projeto linkado ao Vercel | ✅ Sim (`aura-platform`) |
| Domínio customizado | ❌ **NÃO CONFIGURADO** |
| Variáveis de ambiente no Vercel | ❌ **NÃO CONFIGURADAS** |
| DNS apontando para Vercel | ❌ **NÃO CONFIGURADO** |

**Resultado:** `https://www.evokaa.com.br/` não está servindo conteúdo.

---

## 📋 Pré-requisitos

Antes de começar, você precisa:
1. Acesso ao [Vercel Dashboard](https://vercel.com/dashboard) (conta com acesso ao projeto `aura-platform`)
2. Acesso ao painel do registrador de domínio (onde comprou `evokaa.com.br`)
3. Ter o Vercel CLI logado localmente (`npx vercel login`)

---

## 🔧 Passo 1 — Configurar Variáveis de Ambiente no Vercel

As variáveis existem apenas em `app/.env.local`. É **obrigatório** adicioná-las no dashboard da Vercel.

### 1.1 Acesse o dashboard
1. Vá para [vercel.com/dashboard](https://vercel.com/dashboard)
2. Clique no projeto **aura-platform**
3. No menu superior, clique em **Settings**
4. No menu lateral esquerdo, clique em **Environment Variables**

### 1.2 Adicione as duas variáveis

Clique em **Add** e preencha:

| Nome | Valor |
|------|-------|
| `VITE_SUPABASE_URL` | `https://rwaezeqyuhxrssntcxdv.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_d6yhWhXNJnKHbALR-rdD2w_utpG-Kip` |

> ⚠️ **IMPORTANTE:** Selecione os ambientes **Production**, **Preview** e **Development** (todos os checkboxes).

### 1.3 Salve
Clique em **Save**. As variáveis serão aplicadas automaticamente no próximo deploy.

---

## 🌐 Passo 2 — Configurar Domínio Customizado no Vercel

### 2.1 Acesse as configurações de domínio
1. No projeto **aura-platform**, vá em **Settings**
2. No menu lateral, clique em **Domains**
3. No campo "Add Domain", digite: `www.evokaa.com.br`
4. Clique em **Add**

### 2.2 O que a Vercel vai pedir
A Vercel vai mostrar instruções de DNS. Geralmente são estas:

**Opção A — CNAME (recomendada):**
```
Tipo: CNAME
Nome: www
Valor: cname.vercel-dns.com
TTL: Automático
```

**Opção B — A Record (para apex/root domain):**
Se quiser configurar `evokaa.com.br` (sem www) também:
```
Tipo: A
Nome: @
Valor: 76.76.21.21
TTL: Automático
```

> 💡 **Dica:** Use `www.evokaa.com.br` como primário e redirecione `evokaa.com.br` (sem www) para `www.evokaa.com.br`. Isso evita problemas de SSL com apex domains.

### 2.3 Aguarde a propagação do DNS
Pode levar de **5 minutos a 48 horas** para o DNS propagar globalmente. A Vercel mostrará o status:
- 🟡 "Validating Configuration" — aguardando DNS
- 🟢 "Valid" — domínio configurado corretamente

---

## 🌍 Passo 3 — Configurar DNS no Registrador do Domínio

### 3.1 Acesse o painel do seu registrador
Exemplos de registradores comuns no Brasil:
- Registro.br
- Hostgator
- GoDaddy
- Namecheap
- Cloudflare

### 3.2 Adicione o registro DNS

Para `www.evokaa.com.br`:
```
Tipo:  CNAME
Host:  www
Valor: cname.vercel-dns.com
TTL:   3600 (ou Automático)
```

Se quiser redirecionar o domínio raiz (evokaa.com.br → www.evokaa.com.br):
```
Tipo:  URL Redirect (ou Forwarding)
Host:  @
Valor: https://www.evokaa.com.br/
```

Ou, se o registrador suportir ANAME/ALIAS:
```
Tipo:  A
Host:  @
Valor: 76.76.21.21
```

### 3.3 Salve e aguarde
Salve as alterações e volte ao dashboard da Vercel para verificar se o domínio foi validado.

---

## 🚀 Passo 4 — Fazer Deploy

Após configurar env vars e domínio, faça o deploy:

### Opção A — Script automático (PowerShell)
```powershell
cd "C:\Users\scopa\OneDrive\Documentos\Gemini\Antigravity\Aura Tickets"
.\deploy.ps1
```

### Opção B — Manual
```bash
cd app
npm install
npm run build
npx vercel --prod
```

### Opção C — Deploy via Git (Git Integration)
Se o repositório GitHub estiver conectado ao projeto Vercel, basta fazer push para a branch `main`:
```bash
git add .
git commit -m "deploy: configurações de produção"
git push origin main
```
A Vercel fará deploy automático.

---

## ✅ Passo 5 — Verificar se Funcionou

Após o deploy, verifique:

1. **Domínio responde:**
   ```
   https://www.evokaa.com.br/
   ```
   Deve carregar a landing page com o `VideoHero`.

2. **Login funciona:**
   ```
   https://www.evokaa.com.br/auth/login
   ```
   Tente logar com `produtor@aura.teste` / `senha123`.

3. **Supabase conectado:**
   - Abra o console do navegador (F12)
   - Não deve haver erros de `VITE_SUPABASE_URL` não definida

4. **SSL/HTTPS:**
   - O navegador deve mostrar o cadeado verde (HTTPS ativo)
   - A Vercel provisiona SSL automaticamente

---

## 🆘 Solução de Problemas

### "This domain is already in use"
Significa que `www.evokaa.com.br` está vinculado a outro projeto Vercel. Você precisa:
1. Acessar o outro projeto e remover o domínio, OU
2. Verificar se é o projeto correto (`aura-platform`)

### "Invalid Configuration" no domínio
O DNS ainda não propagou. Aguarde mais ou verifique se o CNAME/A record foi digitado corretamente.

### "As variáveis de ambiente do Supabase não estão definidas"
As env vars não foram configuradas no dashboard Vercel. Volte ao Passo 1.

### Build falha no Vercel mas funciona localmente
Verifique se o `vite.config.ts` tem algum plugin que só funciona em dev. Atualmente o `kimi-plugin-inspect-react` já está condicional.

### "404 Not Found" em rotas como `/producer/dashboard`
O `vercel.json` deve ter o rewrite SPA configurado. Verifique se está em `app/vercel.json` e se o deploy foi feito a partir da pasta `app/`.

---

## 📞 Informações do Projeto

| Dado | Valor |
|------|-------|
| Projeto Vercel | `aura-platform` |
| Project ID | `prj_azWxjoISRIyF42ftSdiHmFFyvFMV` |
| Org ID | `team_Nox6jNrYUnDET3MIXC3tEj2p` |
| Supabase URL | `https://rwaezeqyuhxrssntcxdv.supabase.co` |
| Supabase Anon Key | `sb_publishable_d6yhWhXNJnKHbALR-rdD2w_utpG-Kip` |
| Diretório de deploy | `app/` (não a raiz!) |
| Build command | `vite build` |
| Output directory | `dist` |

---

*Guia gerado em 25 de maio de 2026. Atualize conforme necessário.*
