# AURA - Plataforma de Eventos
## Especificação Completa para Reconstrução

---

## 1. STACK TECNOLÓGICA

- React 19 + TypeScript + Vite
- Tailwind CSS v3 + shadcn/ui
- React Router v7 (BrowserRouter, Routes, Route, Outlet)
- GSAP + ScrollTrigger
- Lucide React (ícones)
- clsx + tailwind-merge

## 2. DESIGN SYSTEM

### Cores
```
canvas:     #f7f5f0  (background principal)
void:       #1a0e14  (hero, sections escuras)
espresso:   #1a0e14  (texto principal)
cream:      #f7f5f0  (texto sobre fundo escuro)
plum:       #7a3b69  (cor primária/destaque)
```

### Fontes
```
Serif:  Instrument Serif, Georgia, serif (títulos, headings)
Sans:   Inter, system-ui, sans-serif (corpo, UI)
```

### Utilitários Tailwind
```css
.glass { @apply bg-white/60 backdrop-blur-xl backdrop-saturate-150; }
.perspective-1000 { perspective: 1000px; }
.preserve-3d { transform-style: preserve-3d; }
.shadow-glow: 0px 0px 30px rgba(122, 59, 105, 0.3)
.shadow-elevated: 0px 20px 40px rgba(26, 14, 20, 0.15)
```

## 3. CONFIGURAÇÃO tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: "#f7f5f0",
        void: "#1a0e14",
        plum: "#7a3b69",
        espresso: "#1a0e14",
        cream: "#f7f5f0",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      fontFamily: {
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: "calc(var(--radius) + 4px)", lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      boxShadow: { elevated: "0px 20px 40px rgba(26, 14, 20, 0.15)", glow: "0px 0px 30px rgba(122, 59, 105, 0.3)" },
      keyframes: {
        "float": { "0%, 100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-10px)" } },
        "pulse-glow": { "0%, 100%": { boxShadow: "0 0 20px rgba(122, 59, 105, 0.2)" }, "50%": { boxShadow: "0 0 40px rgba(122, 59, 105, 0.5)" } },
      },
      animation: {
        "float": "float 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

## 4. index.css GLOBAL

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 40 23% 95%;
    --foreground: 330 33% 8%;
    --card: 0 0% 100%;
    --card-foreground: 330 33% 8%;
    --popover: 0 0% 100%;
    --popover-foreground: 330 33% 8%;
    --primary: 320 35% 35%;
    --primary-foreground: 40 23% 95%;
    --secondary: 40 20% 92%;
    --secondary-foreground: 330 33% 8%;
    --muted: 40 15% 90%;
    --muted-foreground: 330 10% 45%;
    --accent: 320 35% 35%;
    --accent-foreground: 40 23% 95%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 40 15% 85%;
    --input: 40 15% 85%;
    --ring: 320 35% 35%;
    --radius: 0.625rem;
  }
  html { scroll-behavior: smooth; }
  body { @apply bg-canvas text-espresso font-sans antialiased; }
  h1, h2, h3, h4, h5, h6 { @apply font-serif; }
}

@layer utilities {
  .glass { @apply bg-white/60 backdrop-blur-xl backdrop-saturate-150; }
  .text-balance { text-wrap: balance; }
  .transform-style-3d { transform-style: preserve-3d; }
  .perspective-1000 { perspective: 1000px; }
  .perspective-2000 { perspective: 2000px; }
  .preserve-3d { transform-style: preserve-3d; }
}
::selection { background-color: rgba(122, 59, 105, 0.3); color: #1a0e14; }
```

## 5. ESTRUTURA DE ROTAS (App.tsx)

```tsx
import { Routes, Route, useLocation } from 'react-router'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import EventPage from './pages/EventPage'
import BrandStudio from './pages/BrandStudio'
import ProducerLayout from './components/ProducerLayout'
import ProducerDashboard from './pages/producer/Dashboard'
import ProducerEvents from './pages/producer/Events'
import ProducerNewEvent from './pages/producer/NewEvent'
import ProducerCRM from './pages/producer/CRM'
import ProducerFinance from './pages/producer/Finance'
import ProducerWallet from './pages/producer/Wallet'
import ProducerMenu from './pages/producer/Menu'
import TableCalculator from './pages/producer/TableCalculator'
import AdminLayout from './components/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import Checkout from './pages/checkout/Checkout'
import CheckoutPayment from './pages/checkout/Payment'
import CheckoutSuccess from './pages/checkout/Success'
import AuthLogin from './pages/auth/Login'
import AuthRegister from './pages/auth/Register'
import AppHub from './pages/app/Hub'
import AppDownload from './pages/app/Download'

function Layout() {
  const location = useLocation()
  const hideLayout = location.pathname.startsWith('/producer') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/auth') ||
    location.pathname.startsWith('/checkout')

  return (
    <div className="min-h-screen bg-canvas">
      {!hideLayout && <Header />}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/event/:eventId" element={<EventPage />} />
          <Route path="/auth/login" element={<AuthLogin />} />
          <Route path="/auth/register" element={<AuthRegister />} />
          <Route path="/app/hub" element={<AppHub />} />
          <Route path="/app/download" element={<AppDownload />} />
          <Route element={<ProducerLayout />}>
            <Route path="/producer" element={<ProducerDashboard />} />
            <Route path="/producer/dashboard" element={<ProducerDashboard />} />
            <Route path="/producer/events" element={<ProducerEvents />} />
            <Route path="/producer/events/new" element={<ProducerNewEvent />} />
            <Route path="/producer/brand" element={<BrandStudio />} />
            <Route path="/producer/crm" element={<ProducerCRM />} />
            <Route path="/producer/finance" element={<ProducerFinance />} />
            <Route path="/producer/wallet" element={<ProducerWallet />} />
            <Route path="/producer/tables" element={<TableCalculator />} />
            <Route path="/producer/menu" element={<ProducerMenu />} />
          </Route>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout/payment" element={<CheckoutPayment />} />
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
        </Routes>
      </main>
      {!hideLayout && <Footer />}
    </div>
  )
}

export default function App() { return <Layout /> }
```

## 6. DADOS MOCKADOS (src/data/mockData.ts)

Exportar: events (Event[]), interestedUsers (InterestedUser[]), tableStatus (TableStatus[]), mesasColetivas (MesaColetiva[]), profileQuestions, menuItems (MenuItem[]), crmLeads (CRMLead[]), pipelineStages (PipelineStage[]).

Dados completos:

**Events:** Array com 3 eventos (noite-eletro-2025, jazz-sunset, feira-arte-contemporanea). Cada evento tem: id, title, subtitle, description, date, time, location, address, image, gallery, tags, status, tickets[]. Cada ticket tem: id, name, description, price, capacity, sold, perks[], type ('individual'|'coletiva'|'vip'|'mesa').

**interestedUsers:** 6 usuários com id, name, avatar (pravatar.cc), action, time.

**tableStatus:** 5 mesas (Mesa Premium 1-2, Mesa Gold 1-2, Mesa Silver 1) com capacity/filled/status.

**mesasColetivas:** 2 mesas (Aurora, Nebula) com 6 membros cada, incluindo tema, compatibility %, e membros com vibe/role/interests.

**profileQuestions:** 4 perguntas (temperament, intent, music, energy) com 3 opções cada.

**menuItems:** 8 itens (bebidas, comidas, combos, merchandise, servicos).

**crmLeads:** 8 leads completos com nome, email, telefone, avatar, source, status (novo, qualificado, proposta, negociacao, fechado, perdido), score 0-100, tags, valor, eventInterest, notes, interactions[], tasks[].

**pipelineStages:** 6 estágios (novo=#3b82f6, qualificado=#8b5cf6, proposta=#f59e0b, negociacao=#ec4899, fechado=#22c55e, perdido=#ef4444).

## 7. COMPONENTES COMPARTILHADOS

### Header.tsx
- Fixo no topo, z-50
- Esconde em /producer/*, /admin/*, /auth/*, /checkout/*
- Quando scrolled > 50px: glass border-b shadow
- Quando no topo: bg-transparent
- Logo: /images/logo-aura.png (sem filtro)
- Nav links: Início (/), Eventos (/event/noite-eletro-2025), App (/app/download)
- Botoes: Entrar (/auth/login) - outline, Criar Conta (/auth/register) - bg-plum
- Menu mobile com transição suave

### Footer.tsx
- 4 colunas: Logo/desc, Links (Eventos, Sobre, Contato, FAQ), Legal, Social
- Bottom bar com copyright

### ProducerLayout.tsx
- Sidebar fixa esquerda, bg-[#1a1118], borda white/10
- Itens: Dashboard, Eventos, Mesas, Cardápio, Marca, CRM, Financeiro, Carteira
- Texto inativo: text-white/70, hover: text-white hover:bg-white/[0.06]
- Texto ativo: bg-plum/20 text-plum
- Collapse toggle redondo com bg-plum
- Badge "Produtor" no header

### AdminLayout.tsx
- Mesmo padrão do ProducerLayout mas com bg-rose-500 para destaque
- Badge "Aura" no header

## 8. PÁGINAS COMPLETAS

### Home.tsx (Landing Page)
**Seção 1 - VideoHero:** Full-screen hero com bg-[#1a0e14]. Badge "Plataforma de Experiências" com pulso. Título 3 linhas: "Crie" / "Eventos" / "Extraordinários" (italic plum). Subtítulo em cream/50. Dois CTAs: "Começar Agora" (link /auth/register) e "Ver Demo" (link /event/noite-eletro-2025). Stats: 10K+ Eventos, 500K+ Ingressos, 98% Satisfação. Ticket VIP 3D flutuante com animações CSS (float, tilt, glow, shine, particles). Canvas de partículas conectadas com interação do mouse. Seta "Rolar" animada no bottom.

**Seção 2 - Stats:** 4 stats (10K+ Eventos, 500K+ Ingressos, 98% Satisfação, 50+ Países) com animação GSAP stagger.

**Seção 3 - Features:** Grid 3x3 cards glass. Ícones com bg-plum/10 hover:bg-plum. Títulos: Crie em Minutos, Gestão de Ingressos, Brand Studio, Comprovação Social, Analytics em Tempo Real, Segurança Total.

**Seção 4 - Como Funciona:** bg-void text-cream. 3 passos (01/02/03) com números grandes em plum/20.

**Seção 5 - CTA:** "Pronto para Criar Algo Extraordinário?" Criar Meu Evento → /auth/register, Brand Studio → /producer/brand.

### AuthLogin.tsx
- Fundo bg-canvas, centralizado
- Logo Aura com link para /
- Título "Bem-vindo de volta"
- 3 botões de perfil: Participante (plum), Produtor (amber), Admin (rose)
- Descrição do perfil selecionado em caixa colorida
- Inputs: email, senha (com toggle visibility)
- Checkbox "Lembrar-me", link "Esqueci a senha"
- Botão "Entrar como [Perfil]" com cor do perfil
- Divider "ou" + "Entrar com Google"
- Link "Criar conta" → /auth/register
- Dica: "Baixe o app" com link /app/download

### AuthRegister.tsx
- Mesmo layout do login
- Toggle: Produtor / Participante
- Campos: Nome, Sobrenome, Email, Senha
- Botão "Criar Conta" bg-plum
- Link "Entrar" → /auth/login

### EventPage.tsx (/:eventId)
- Hero com imagem do evento overlay gradient
- Info: título, subtítulo, data, hora, local, tags
- 3 tickets cards (Individual, VIP, Mesa Coletiva) com preço, perks, botão comprar
- Seção "Mesa Coletiva" especial com quiz interativo de matchmaking (4 perguntas, 3 opções cada)
- Social proof: avatares + "X pessoas confirmaram"
- Galeria de imagens
- Mapa (placeholder)

### ProducerDashboard.tsx
- KPI cards: Receita Total, Vendas Hoje, Ocupação, Taxa Conversão
- Gráfico de vendas (últimos 7 dias)
- Tabela de eventos recentes
- Atividade recente

### ProducerEvents.tsx
- Grid de eventos cards
- Botão "Novo Evento" → /producer/events/new
- Cards com imagem, título, data, status, vendas/capacidade

### ProducerCRM.tsx
- 4 tabs: Dashboard, Pipeline, Leads, Comunicação
- **Dashboard:** 4 KPI cards (Total Leads, Receita Potencial, Score Médio, Taxa Conversão). Funil de conversão (barras horizontais coloridas). Origem dos Leads (barras + top tags). Atividade recente com avatares e score rings.
- **Pipeline:** Grid 6 colunas (6 estágios), cards arrastáveis com lead info, tags, score ring, valor.
- **Leads:** Tabela completa com busca, filtros, sort. Drawer lateral ao clicar em lead mostra: avatar, contato, score, valor, tags, notas, histórico de interações, tarefas, matchmaking, botões WhatsApp/Ligar.
- **Comunicação:** Interface chat. Lista de leads à esquerda, conversa à direita com mensagens (in/out). Input para enviar mensagem.

### TableCalculator.tsx
- Calculadora de mesas VIP
- Inputs: número de pessoas, valor do open bar, custo do espaço, mark-up
- Cards de resultado: Valor por pessoa, Total da mesa, Lucro estimado
- Comparativo de tipos de mesas

### ProducerMenu.tsx
- Cadastro de cardápio (PreOrder)
- Tabs: Bebidas, Comida, Combos, Merch, Serviços
- Grid de cards com imagem, nome, descrição, preço, toggle disponível
- Botão "Adicionar Item"

### ProducerFinance.tsx
- Resumo financeiro
- Gráficos de receita/despesa
- Tabela de transações
- Status de pagamentos

### ProducerWallet.tsx
- Saldo disponível
- Histórico de transações
- Botão sacar
- Status das vendas por evento

### BrandStudio.tsx
- Personalização visual do evento
- Seletor de cores primária
- Upload de logo
- Preview ao vivo
- Padrões de background

### AdminDashboard.tsx
- Overview da plataforma
- Cards: Total usuários, Eventos ativos, Receita, Tickets vendidos
- Gráficos: crescimento, distribuição
- Tabela de produtores pendentes
- Eventos recentes

### AppHub.tsx (Painel do Participante)
- Header com avatar e QR code
- 4 tabs: Ingressos, Explorar, Cardápio, Chat
- **Ingressos:** Cards de ingressos comprados com QR code, status, detalhes
- **Explorar:** Feed de eventos, favoritos, filtros
- **Cardápio:** Comanda digital (PreOrder), carrinho, pedidos
- **Chat:** Conversas com produtores e participantes da mesa

### Checkout, Payment, Success
- Fluxo completo 3 passos
- Resumo do pedido
- Dados do comprador
- Simulação de pagamento
- Tela de sucesso com QR code

### AppDownload.tsx
- Página de download do app
- QR code
- Links para App Store / Play Store

## 9. ANIMAÇÕES E EFEITOS

### VideoHero Canvas
- Partículas brancas semi-transparentes se movendo lentamente
- Linhas conectando partículas próximas (< 120px)
- Mouse tracking: partículas são atraídas pelo cursor
- Radial gradient plum segue o mouse
- Partículas: count = (width * height) / 18000

### Ticket 3D CSS
```css
@keyframes ticketFloat { 0%,100% { transform: translateY(0) rotateX(5deg) rotateY(-8deg); } 50% { transform: translateY(-20px) rotateX(8deg) rotateY(-5deg); } }
@keyframes ticketGlow { 0%,100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.1); } }
@keyframes ticketShine { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes ticketParticle { 0%,100% { transform: translateY(0) scale(1); opacity: 0.5; } 50% { transform: translateY(-30px) scale(1.5); opacity: 1; } }
```

### GSAP Scroll Animations
- Features: y:60→0, opacity, stagger 0.15
- Stats: y:40→0, stagger 0.1
- CTA: y:50→0
- Todos com ScrollTrigger start: 'top 80%'

### Hero Text Animations
- 3 linhas com y:120→0, rotateX:-40→0, stagger -0.85s
- Badge scale com back.out(1.7)
- Descrição e CTAs fade in sequencial
- Ticket 3D slide in com rotateY

## 10. IMAGENS E ASSETS

As imagens usadas no projeto estão em `/public/images/` e `/public/videos/`:
- /images/logo-aura.png (logo oficial Aura)
- /images/hero-bg.jpg
- /images/concert-1.jpg, concert-2.jpg, concert-3.jpg
- /images/event-card-1.jpg, event-card-2.jpg
- /images/ticket-vip.png (ticket 3D flutuante)
- /videos/hero-bg.mp4 (vídeo de background do hero)

Avatares: usar pravatar.cc (serviço gratuito de placeholder)

## 11. REQUISITOS FUNCIONAIS

### Mesa Coletiva (Matchmaking)
1. Usuário seleciona ingresso "Mesa Coletiva"
2. Responde quiz de 4 perguntas (temperamento, intenção, música, energia)
3. Sistema calcula compatibilidade
4. Atribui à mesa com melhor match (exibe compatibility %)
5. Mostra perfis dos outros membros da mesa

### Comanda Digital (PreOrder)
1. Participante acessa cardápio do evento via app
2. Adiciona itens ao carrinho
3. Seleciona horário de retirada
4. Pagamento integrado
5. Recebe QR code para retirada
6. Produtor gerencia pedidos no painel

### CRM Pipeline
1. Leads entram automaticamente (orgânico, Instagram, etc.)
2. Score de 0-100 baseado em comportamento
3. 6 estágios do funil
4. Tarefas associadas a cada lead
5. Histórico completo de interações
6. Chat integrado
7. Matchmaking social (temperamento + intenção)

### Sistema de 3 Perfis
- **Participante:** Compra ingressos, acessa eventos, comanda digital, chat
- **Produtor:** Cria eventos, painel completo, CRM, financeiro, cardápio
- **Admin:** Gestão da plataforma, usuários, produtores, analytics

## 12. DEPENDÊNCIAS (package.json)

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "gsap": "^3.12.0",
    "lucide-react": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "class-variance-authority": "latest",
    "@radix-ui/*": "various"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^7.0.0",
    "tailwindcss": "^3.4.0",
    "tailwindcss-animate": "^1.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

---

## COMO RECONSTRUIR NO LOVABLE

1. Crie um projeto React + TypeScript + Tailwind no Lovable
2. Configure o tailwind.config.js com as cores e fontes acima
3. Adicione as dependências (gsap, lucide-react, clsx, tailwind-merge)
4. Configure as rotas no App.tsx conforme a estrutura
5. Implemente os componentes na ordem: Layout → Header/Footer → Pages
6. Use os dados mockados para testar todas as funcionalidades
7. Substitua os assets (imagens/vídeos) pelos seus
