# Aura Tickets — Deploy Final + Setup Supabase

## ✅ O que foi implementado nesta rodada

### 1. Performance (Code Splitting)
- ✅ Todas as 60+ páginas agora usam `React.lazy()` + `Suspense`
- ✅ Chunk inicial reduzido (carrega só o necessário)
- ✅ Vite config com `manualChunks`: react-vendor, ui-vendor, data-vendor, charts, animation, supabase, forms
- ✅ Componente `PageLoading` como fallback de carregamento

### 2. Mais Mock Data
- ✅ App/Hub: ingressos, chat, cardápio, eventos
- ✅ App/Tickets: 6 ingressos com QR codes
- ✅ App/Notifications: 9 notificações variadas
- ✅ App/Profile: dados completos do participante
- ✅ Checkout/Success: confirmação com PIX, QR code, ingressos
- ✅ Admin: Users, Producers, Finance, Analytics (todos com dados)
- ✅ Producer: CRM, Finance, Affiliates, Check-in, Communications, Coupons, Tasks (todos com dados)

### 3. Schema SQL Pronto
- ✅ `database-setup.sql` — 19 tabelas, triggers, RLS, views, índices

---

## 🚀 DEPLOY AGORA

### Opção A: Duplo clique (mais fácil)
1. Vá na pasta `Aura Tickets\app`
2. Dê **duplo clique** em `DEPLOY-VERCEL.bat`
3. Aguarde o build e deploy

### Opção B: PowerShell (se o .bat falhar)
```powershell
cd "C:\Users\scopa\OneDrive\Documentos\Gemini\Antigravity\Aura Tickets\app"
npm run build
npx vercel --prod
```

---

## 🗄️ CONFIGURAR SUPABASE (para dados reais)

### Passo 1: Aplicar Schema
1. Acesse: https://supabase.com/dashboard/project/rwaezeqyuhxrssntcxdv
2. SQL Editor → New Query
3. Abra o arquivo `database-setup.sql` na pasta do app
4. Copie TODO o conteúdo e cole no SQL Editor
5. Clique **Run**

### Passo 2: Criar usuários de teste
1. Authentication → Users → Add User
2. Crie estes 3 usuários:
   - `produtor@aura.teste` / senha: `senha123`
   - `admin@aura.teste` / senha: `senha123`
   - `user@aura.teste` / senha: `senha123`
3. O trigger `handle_new_user` cria o perfil automaticamente na tabela `users`

### Passo 3: Storage (imagens)
1. Storage → New bucket
2. Crie estes buckets e marque como **Public**:
   - `event-images`
   - `avatars`
   - `producer-logos`

---

## 🔑 Login de demonstração

| Email | Senha | Acesso |
|-------|-------|--------|
| `produtor@aura.teste` | `senha123` | Dashboard do Produtor |
| `admin@aura.teste` | `senha123` | Painel Admin |
| `user@aura.teste` | `senha123` | Área do Participante |

---

## 🔗 URL do site
https://aura-platform-fodcshzgh-scoprics-projects.vercel.app
