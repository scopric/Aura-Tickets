# Evokaa Platform — Setup do Backend (Sem Pagamentos)

## ✅ O que foi implementado

1. **Schema SQL completo** (`schema.sql`) — 19 tabelas (P0 + P1), RLS, triggers, views
2. **Seed de dados** (`seed.sql`) — Eventos, ingressos, pedidos, CRM, afiliados
3. **Edge Functions** (`supabase-functions-*.ts`) — Email, check-in, certificados
4. **Hooks P1** — CRM, Tasks, Affiliates, Communications
5. **SEO** — Adicionado nas páginas Home, Evento, Dashboard
6. **Skeleton Loading + Error Boundary** — Componentes reutilizáveis
7. **Auth robusto** — Demo bypass + Supabase real + fallback REST

---

## 🚀 Passo a passo para ativar o backend

### 1. Aplicar o Schema SQL no Supabase

1. Acesse: https://supabase.com/dashboard/project/rwaezeqyuhxrssntcxdv
2. Vá em **SQL Editor** → **New Query**
3. Cole TODO o conteúdo do arquivo `schema.sql`
4. Clique em **Run**
5. Verifique se não houve erros (pode ignorar warnings de "policy already exists")

### 2. Criar usuários de teste no Auth

1. No painel Supabase, vá em **Authentication → Users**
2. Clique em **Add User → Create new user**
3. Crie os 3 usuários de teste:

| Email | Senha | Role | ID (se possível definir) |
|-------|-------|------|--------------------------|
| `produtor@aura.teste` | `senha123` | producer | `d3f6ab7a-b847-4aa4-af6c-033a738c2ce4` |
| `admin@aura.teste` | `senha123` | admin | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `user@aura.teste` | `senha123` | customer | `b2c3d4e5-f6a7-8901-bcde-f23456789012` |

> **Nota:** O Supabase Auth não permite definir UUID manualmente pela UI. Se os IDs forem diferentes, o modo demo ainda funciona (ele cria mock local), mas o seed.sql precisará ser ajustado com os IDs reais.

4. Após criar cada usuário, o trigger `handle_new_user` criará automaticamente o perfil na tabela `public.users`

### 3. Rodar o Seed de dados

1. No **SQL Editor**, crie uma **New Query**
2. Cole o conteúdo de `seed.sql`
3. **IMPORTANTE:** Substitua os UUIDs no início do arquivo pelos IDs reais dos usuários criados no passo 2
4. Clique em **Run**

### 4. Criar Storage Buckets

1. Vá em **Storage → New bucket**
2. Crie os seguintes buckets (públicos ou privados conforme indicado):

| Bucket | Público | Política de escrita |
|--------|---------|---------------------|
| `event-images` | Sim | Usuários autenticados (próprio) |
| `avatars` | Sim | Usuários autenticados (próprio) |
| `producer-logos` | Sim | Usuários autenticados (produtor) |
| `certificates` | Não | Service role |
| `event-documents` | Não | Usuários autenticados (evento) |
| `banners` | Sim | Admin |

3. Para cada bucket, configure as **Policies** no painel:
   - **event-images**: SELECT para `anon`, INSERT para `authenticated`
   - **avatars**: SELECT para `anon`, INSERT para `authenticated`
   - **producer-logos**: SELECT para `anon`, INSERT para `authenticated`

### 5. Configurar Edge Functions

1. Instale a CLI do Supabase (se ainda não tiver):
```powershell
cd "OneDrive\Documentos\Gemini\Antigravity\Evokaa Tickets\app"
npx supabase login
```

2. Inicialize o projeto local:
```powershell
npx supabase init
```

3. Crie as pastas e copie os arquivos:
```powershell
mkdir -p supabase\functions\send-email
mkdir -p supabase\functions\check-in-validate
mkdir -p supabase\functions\generate-certificate

copy supabase-functions-send-email-index.ts supabase\functions\send-email\index.ts
copy supabase-functions-check-in-validate-index.ts supabase\functions\check-in-validate\index.ts
copy supabase-functions-generate-certificate-index.ts supabase\functions\generate-certificate\index.ts
```

4. Deploy das functions:
```powershell
npx supabase functions deploy send-email
npx supabase functions deploy check-in-validate
npx supabase functions deploy generate-certificate
```

5. Configure as secrets (opcional — modo demo funciona sem):
```powershell
npx supabase secrets set RESEND_API_KEY=sua_chave_aqui --project-ref rwaezeqyuhxrssntcxdv
```

### 6. Deploy do Frontend

Execute o script de deploy:
```powershell
cd "OneDrive\Documentos\Gemini\Antigravity\Evokaa Tickets\app"
npm run build
npx vercel --prod
```

Ou use o arquivo batch:
```
DEPLOY-AGORA.bat
```

---

## 🔧 Variáveis de ambiente

O arquivo `.env.local` já deve conter:
```
VITE_SUPABASE_URL=https://rwaezeqyuhxrssntcxdv.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

---

## 🧪 Testando

1. Acesse o site deployado
2. Faça login com `produtor@aura.teste` / `senha123`
3. Navegue pelo Dashboard, Eventos, CRM, Finance, etc.
4. Todos os dados são mock se o Supabase não estiver configurado, ou reais se estiver.

---

## ⚠️ Limitações conhecidas (sem pagamento)

- Checkout processa pedidos como "paid" automaticamente (sem Stripe/Woovi)
- Não há saque real para produtores
- E-mails são simulados no console (a menos que configure Resend)
- Certificados são gerados como dados JSON (sem PDF real)
