# Deploy na Vercel — Aura Tickets

## Pre-requisitos

1. Node.js v20+ instalado
2. Conta na Vercel (https://vercel.com)
3. Vercel CLI instalado globalmente: `npm i -g vercel`
4. Logado na Vercel CLI: `vercel login`

## Variaveis de Ambiente (IMPORTANTE!)

No Dashboard da Vercel > Project Settings > Environment Variables, adicione:

```
VITE_SUPABASE_URL=https://rwaezeqyuhxrssntcxdv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs... (sua chave anon)
```

> **Atenção:** Variaveis Vite precisam comecar com `VITE_` para serem expostas ao client-side.

## Opcao 1: Deploy via Vercel CLI (mais rapido)

Abra o **CMD do Windows** (nao o Git Bash — ele esta quebrado no seu ambiente).

```cmd
cd "C:\Users\scopa\OneDrive\Documentos\Gemini\Antigravity\Aura Tickets\app"

REM 1. Instalar dependencias (se necessario)
npm install

REM 2. Testar build local
npm run build

REM 3. Deploy para producao
npx vercel --prod
```

Se for a primeira vez, o Vercel CLI vai perguntar:
- Link to existing project? → **N** (novo projeto)
- Project name → `aura-tickets` (ou nome que preferir)

## Opcao 2: Deploy via Git + GitHub (recomendado para CI/CD)

Abra o **CMD do Windows**:

```cmd
cd "C:\Users\scopa\OneDrive\Documentos\Gemini\Antigravity\Aura Tickets\app"

REM 1. Inicializar git
git init

REM 2. Criar .gitignore (ja existe, verifique se esta correto)
REM 3. Adicionar tudo
git add .

REM 4. Commit
git commit -m "Primeiro deploy - Aura Tickets"

REM 5. Criar repo no GitHub e push
git remote add origin https://github.com/SEU_USUARIO/aura-tickets.git
git branch -M main
git push -u origin main
```

Depois, no dashboard da Vercel:
1. **Add New Project** > Import Git Repository
2. Selecione `aura-tickets`
3. Framework Preset: **Vite**
4. Build Command: `npm run build` (ou `vite build`)
5. Output Directory: `dist`
6. Adicione as Environment Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
7. Click **Deploy**

## Configuracao do Projeto na Vercel

| Setting | Valor |
|---------|-------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

O arquivo `vercel.json` ja esta configurado com rewrites para SPA (React Router).

## Pos-Deploy

1. **Configurar Dominio** (opcional): Vercel > Project Settings > Domains
2. **Verificar Build Logs**: Se falhar, verifique os logs na Vercel
3. **Testar rotas**: Acesse `https://seu-projeto.vercel.app/producer/dashboard` e confirma que carrega (SPA rewrite funciona)
4. **Testar login**: Verifique se o Supabase conecta corretamente

## Troubleshooting

### Build falha com "Cannot find module"
Verifique se `npm install` rodou corretamente. Se nao, delete `node_modules` e `package-lock.json` e rode `npm install` novamente.

### Pagina em branco / 404 em rotas
O `vercel.json` ja tem `rewrites` para SPA. Se nao funcionar, verifique no dashboard da Vercel se `vercel.json` foi detectado.

### Supabase nao conecta
Verifique se as variaveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estao configuradas no dashboard da Vercel (nao apenas no `.env.local`).

### Chunks muito grandes
O `vite.config.ts` ja tem `manualChunks` configurado para dividir o bundle. Se ainda houver warnings, eles sao apenas warnings — o build vai funcionar.
