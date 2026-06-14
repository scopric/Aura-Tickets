# AURA - Código Completo
## Copie cada seção para o arquivo correspondente no Lovable

---

## ARQUIVO: src/App.tsx

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

export default function App
```

---

## ARQUIVO: src/main.tsx

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

---

## ARQUIVO: src/index.css

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
  .text-pretty { text-wrap: pretty; }
  .transform-style-3d { transform-style: preserve-3d; }
  .perspective-1000 { perspective: 1000px; }
  .perspective-2000 { perspective: 2000px; }
  .preserve-3d { transform-style: preserve-3d; }
}

::selection {
  background-color: rgba(122, 59, 105, 0.3);
  color: #1a0e14;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #f7f5f0; }
::-webkit-scrollbar-thumb { background: rgba(122, 59, 105, 0.3); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(122, 59, 105, 0.5); }
```

---

## ARQUIVO: src/components/Header.tsx

```tsx
import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { Menu, X, Sparkles, CalendarDays, Smartphone, LogIn, UserPlus } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const isProducerRoute = location.pathname.startsWith('/producer')

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { href: '/', label: 'Inicio', icon: Sparkles },
    { href: '/event/noite-eletro-2025', label: 'Eventos', icon: CalendarDays },
    { href: '/app/download', label: 'App', icon: Smartphone },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <header className={cn('fixed top-0 left-0 right-0 z-50 transition-all duration-500', isProducerRoute && 'hidden', isScrolled ? 'glass border-b border-white/20 shadow-elevated' : 'bg-transparent')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/images/logo-aura.png" alt="Aura" className="h-8 w-auto transition-transform duration-300 group-hover:scale-105" />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} to={link.href} className={cn('relative px-4 py-2 text-sm font-medium transition-colors duration-300 rounded-full', isActive(link.href) ? 'text-plum' : 'text-espresso/60 hover:text-espresso')}>
                {isActive(link.href) && <span className="absolute inset-0 bg-plum/10 rounded-full" />}
                <span className="relative flex items-center gap-2"><link.icon className="w-4 h-4" />{link.label}</span>
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth/login" className="px-4 py-2.5 text-sm font-medium text-espresso/70 hover:text-espresso border border-espresso/15 hover:border-espresso/30 rounded-full transition-all duration-300 flex items-center gap-2">
              <LogIn className="w-4 h-4" />Entrar
            </Link>
            <Link to="/auth/register" className="px-4 py-2.5 text-sm font-medium text-cream bg-plum rounded-full transition-all duration-300 hover:shadow-glow hover:scale-105 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />Criar Conta
            </Link>
          </div>

          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 text-espresso">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div className={cn('md:hidden overflow-hidden transition-all duration-500', isMobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0')}>
        <div className="glass border-t border-white/20 px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <Link key={link.href} to={link.href} onClick={() => setIsMobileMenuOpen(false)} className={cn('flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors', isActive(link.href) ? 'bg-plum/10 text-plum' : 'text-espresso/60 hover:bg-white/50')}>
              <link.icon className="w-5 h-5" />{link.label}
            </Link>
          ))}
          <div className="flex gap-2 mt-2">
            <Link to="/auth/login" onClick={() => setIsMobileMenuOpen(false)} className="flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium text-espresso border border-espresso/15 rounded-xl">Entrar</Link>
            <Link to="/auth/register" onClick={() => setIsMobileMenuOpen(false)} className="flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium text-cream bg-plum rounded-xl">Criar Conta</Link>
          </div>
        </div>
      </div>
    </header>
  )
}
```

---

## ARQUIVO: src/components/Footer.tsx

```tsx
import { Link } from 'react-router'
import { Sparkles } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-void text-cream/60 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src="/images/logo-aura.png" alt="Aura" className="h-8 w-auto" />
            </Link>
            <p className="text-sm text-cream/40 leading-relaxed">A plataforma definitiva para criadores de experiencias. Crie, gerencie e venda ingressos para eventos extraordinarios.</p>
          </div>
          <div>
            <h4 className="font-serif text-lg text-cream mb-4">Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-plum transition-colors">Inicio</Link></li>
              <li><Link to="/event/noite-eletro-2025" className="hover:text-plum transition-colors">Eventos</Link></li>
              <li><Link to="/app/download" className="hover:text-plum transition-colors">App</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif text-lg text-cream mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><span className="hover:text-plum transition-colors cursor-pointer">Termos de Uso</span></li>
              <li><span className="hover:text-plum transition-colors cursor-pointer">Privacidade</span></li>
              <li><span className="hover:text-plum transition-colors cursor-pointer">Cookies</span></li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif text-lg text-cream mb-4">Redes</h4>
            <ul className="space-y-2 text-sm">
              <li><span className="hover:text-plum transition-colors cursor-pointer">Instagram</span></li>
              <li><span className="hover:text-plum transition-colors cursor-pointer">TikTok</span></li>
              <li><span className="hover:text-plum transition-colors cursor-pointer">LinkedIn</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cream/30">2025 Aura. Todos os direitos reservados.</p>
          <p className="text-xs text-cream/30 flex items-center gap-1">Feito com <Sparkles className="w-3 h-3 text-plum" /> no Brasil</p>
        </div>
      </div>
    </footer>
  )
}
```

---

## ARQUIVO: src/components/ProducerLayout.tsx

```tsx
import { Outlet, Link, useLocation } from 'react-router'
import { useState } from 'react'
import { LayoutDashboard, Calendar, Palette, Users, Wallet, BarChart3, ChevronLeft, ChevronRight, Settings, LogOut, Calculator, Wine } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

const navItems = [
  { to: '/producer/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/producer/events', icon: Calendar, label: 'Eventos' },
  { to: '/producer/tables', icon: Calculator, label: 'Mesas' },
  { to: '/producer/menu', icon: Wine, label: 'Cardapio' },
  { to: '/producer/brand', icon: Palette, label: 'Marca' },
  { to: '/producer/crm', icon: Users, label: 'CRM' },
  { to: '/producer/finance', icon: BarChart3, label: 'Financeiro' },
  { to: '/producer/wallet', icon: Wallet, label: 'Carteira' },
]

export default function ProducerLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

  return (
    <div className="flex min-h-screen bg-canvas pt-16">
      <aside className={cn('fixed left-0 top-0 bottom-0 z-40 bg-[#1a1118] border-r border-white/10 transition-all duration-300 flex flex-col', collapsed ? 'w-16' : 'w-60')}>
        <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-white/10', collapsed && 'justify-center px-2')}>
          <img src="/images/logo-aura.png" alt="Aura" className="h-7 w-auto flex-shrink-0" />
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white tracking-wide">Painel</span>
              <span className="text-[10px] text-plum font-semibold uppercase tracking-wider bg-plum/20 px-2 py-0.5 rounded-full border border-plum/30">Produtor</span>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 font-medium', collapsed ? 'justify-center' : '', isActive(item.to) ? 'bg-plum/20 text-plum shadow-[inset_0_0_0_1px_rgba(122,59,105,0.3)]' : 'text-white/70 hover:text-white hover:bg-white/[0.06]')} title={collapsed ? item.label : undefined}>
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-2 border-t border-white/10 space-y-1">
          <button className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-white/50 hover:text-white/90 hover:bg-white/[0.06] transition-all w-full font-medium', collapsed && 'justify-center')}>
            <Settings className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Configuracoes</span>}
          </button>
          <button className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-white/50 hover:text-red-400 hover:bg-red-500/[0.08] transition-all w-full font-medium', collapsed && 'justify-center')}>
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        <button onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-plum text-cream flex items-center justify-center shadow-glow hover:scale-110 transition-transform z-50">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      <div className={cn('flex-1 transition-all duration-300 min-h-screen', collapsed ? 'ml-16' : 'ml-60')}>
        <Outlet />
      </div>
    </div>
  )
}
```

---

## ARQUIVO: src/components/AdminLayout.tsx

```tsx
import { Outlet, Link, useLocation } from 'react-router'
import { useState } from 'react'
import { LayoutDashboard, Users, Calendar, DollarSign, Settings, ChevronLeft, ChevronRight, Shield, LogOut, BarChart3, Ticket } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Usuarios' },
  { to: '/admin/producers', icon: Shield, label: 'Produtores' },
  { to: '/admin/events', icon: Calendar, label: 'Eventos' },
  { to: '/admin/finance', icon: DollarSign, label: 'Financeiro' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/admin/tickets', icon: Ticket, label: 'Ingressos' },
  { to: '/admin/settings', icon: Settings, label: 'Configuracoes' },
]

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

  return (
    <div className="flex min-h-screen bg-canvas pt-16">
      <aside className={cn('fixed left-0 top-0 bottom-0 z-40 bg-[#1a1118] border-r border-white/10 transition-all duration-300 flex flex-col', collapsed ? 'w-16' : 'w-60')}>
        <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-white/10', collapsed && 'justify-center px-2')}>
          <img src="/images/logo-aura.png" alt="Aura" className="h-7 w-auto flex-shrink-0" />
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white tracking-wide">Admin</span>
              <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">Aura</span>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 font-medium', collapsed ? 'justify-center' : '', isActive(item.to) ? 'bg-rose-500/20 text-rose-400 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.3)]' : 'text-white/70 hover:text-white hover:bg-white/[0.06]')} title={collapsed ? item.label : undefined}>
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-2 border-t border-white/10 space-y-1">
          <button className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-white/50 hover:text-white/90 hover:bg-white/[0.06] transition-all w-full font-medium', collapsed && 'justify-center')}>
            <Settings className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Config</span>}
          </button>
          <button className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-white/50 hover:text-red-400 hover:bg-red-500/[0.08] transition-all w-full font-medium', collapsed && 'justify-center')}>
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>

        <button onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-rose-500 text-cream flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      <div className={cn('flex-1 transition-all duration-300 min-h-screen', collapsed ? 'ml-16' : 'ml-60')}>
        <Outlet />
      </div>
    </div>
  )
}
```

---

## ARQUIVO: src/pages/Home.tsx

```tsx
import { Link } from 'react-router'
import { ArrowRight, Zap, Users, BarChart3, Palette, Ticket, Shield } from 'lucide-react'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import VideoHero from '../components/VideoHero'

gsap.registerPlugin(ScrollTrigger)

export default function Home() {
  const featuresRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.feature-card', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'power3.out', scrollTrigger: { trigger: featuresRef.current, start: 'top 80%', toggleActions: 'play none none none' } })
      gsap.fromTo('.stat-item', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: statsRef.current, start: 'top 85%', toggleActions: 'play none none none' } })
      gsap.fromTo('.cta-content', { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: ctaRef.current, start: 'top 80%', toggleActions: 'play none none none' } })
    })
    return () => ctx.revert()
  }, [])

  const features = [
    { icon: Zap, title: 'Crie em Minutos', description: 'Configure seu evento com poucos cliques. Nossa interface intuitiva torna o processo simples e rapido.' },
    { icon: Ticket, title: 'Gestao de Ingressos', description: 'Multiplos tipos de ingressos, controle de capacidade e vendas em tempo real integrados.' },
    { icon: Palette, title: 'Brand Studio', description: 'Personalize a pagina do seu evento com cores, fontes e estilos que combinam com sua marca.' },
    { icon: Users, title: 'Comprovacao Social', description: 'Mostre quem esta interessado e comprou ingressos. Crie urgencia e desejo naturalmente.' },
    { icon: BarChart3, title: 'Analytics em Tempo Real', description: 'Acompanhe vendas, engajamento e metricas importantes em um dashboard elegante.' },
    { icon: Shield, title: 'Seguranca Total', description: 'Pagamentos seguros, validacao de ingressos e protecao contra fraudes integrados.' }
  ]

  const stats = [
    { value: '10K+', label: 'Eventos Criados' },
    { value: '500K+', label: 'Ingressos Vendidos' },
    { value: '98%', label: 'Satisfacao' },
    { value: '50+', label: 'Paises' }
  ]

  return (
    <div className="bg-canvas">
      <VideoHero />

      <section ref={statsRef} className="py-20 lg:py-32 border-y border-espresso/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {stats.map((stat) => (
              <div key={stat.label} className="stat-item text-center">
                <div className="font-serif text-4xl lg:text-5xl text-plum mb-2">{stat.value}</div>
                <div className="text-sm text-espresso/50 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={featuresRef} className="py-24 lg:py-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 lg:mb-24">
            <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-espresso mb-6">Tudo que Voce <span className="italic text-plum">Precisa</span></h2>
            <p className="text-espresso/60 text-lg max-w-2xl mx-auto">Ferramentas poderosas para criar experiencias memoraveis, do inicio ao fim.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="feature-card group p-8 rounded-3xl bg-white/50 border border-white/60 backdrop-blur-sm transition-all duration-500 hover:shadow-elevated hover:-translate-y-1">
                <div className="w-12 h-12 rounded-2xl bg-plum/10 flex items-center justify-center mb-6 transition-all duration-300 group-hover:bg-plum group-hover:shadow-glow">
                  <feature.icon className="w-5 h-5 text-plum transition-colors group-hover:text-cream" />
                </div>
                <h3 className="font-serif text-xl text-espresso mb-3">{feature.title}</h3>
                <p className="text-sm text-espresso/60 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 lg:py-40 bg-void text-cream relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-void via-void to-plum/20" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 lg:mb-24">
            <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl mb-6">Como <span className="italic text-plum">Funciona</span></h2>
            <p className="text-cream/60 text-lg max-w-2xl mx-auto">Tres passos simples para transformar sua visao em realidade.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {[
              { step: '01', title: 'Crie Seu Evento', desc: 'Configure nome, data, local e descricao em minutos com nossa interface intuitiva.' },
              { step: '02', title: 'Personalize', desc: 'Use o Brand Studio para criar uma pagina unica que reflita sua identidade visual.' },
              { step: '03', title: 'Publique & Venda', desc: 'Compartilhe o link e comece a vender ingressos imediatamente. Acompanhe tudo em tempo real.' }
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="font-serif text-7xl text-plum/20 mb-4">{item.step}</div>
                <h3 className="font-serif text-2xl mb-4">{item.title}</h3>
                <p className="text-cream/50 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={ctaRef} className="py-24 lg:py-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="cta-content">
            <h2 className="font-serif text-4xl sm:text-5xl lg:text-7xl text-espresso mb-8 leading-tight">Pronto para Criar<br /><span className="italic text-plum">Algo Extraordinario?</span></h2>
            <p className="text-espresso/60 text-lg mb-12 max-w-xl mx-auto">Junte-se a milhares de criadores que ja transformam experiencias com a Aura.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth/register" className="group px-8 py-4 bg-plum text-cream font-medium rounded-full transition-all duration-300 hover:shadow-glow hover:scale-105 flex items-center gap-2">
                Criar Meu Evento <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/producer/brand" className="px-8 py-4 border border-espresso/20 text-espresso font-medium rounded-full transition-all duration-300 hover:bg-espresso/5">
                Explorar Brand Studio
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
```

---

## ARQUIVO: src/components/VideoHero.tsx

O VideoHero é um componente grande e complexo. Ele inclui:
1. Canvas com partículas conectadas e mouse tracking
2. Background de vídeo MP4 com fallback gradient
3. Overlays escuros para legibilidade
4. Badge animado "Plataforma de Experiencias"
5. Título 3 linhas com animação GSAP (rotateX, translateY)
6. Subtítulo e CTAs (Comecar Agora → /auth/register, Ver Demo → /event/noite-eletro-2025)
7. Stats rápidas (10K+ Eventos, 500K+ Ingressos, 98% Satisfacao)
8. Ticket VIP 3D flutuante com 5 animações CSS simultâneas (float, tilt, glow, shine, particles)
9. Indicador de scroll animado
10. Keyframes CSS inline para ticket 3D

Use o código que está no projeto ou peça ao Lovable: "Create a hero section with dark background, animated particle canvas with mouse interaction, 3 lines of text with GSAP 3D entrance animation, a floating 3D VIP ticket with CSS animations (float, tilt, glow, shine), and quick stats."

---

## ARQUIVOS RESTANTES

Os seguintes arquivos também precisam ser criados. Como o Lovable aceita até 10 arquivos, aqui está a estratégia:

### Arquivos essenciais (prioridade):
1. `src/App.tsx` - Rotas
2. `src/main.tsx` - Entry point  
3. `src/index.css` - Estilos globais
4. `src/components/Header.tsx` - Header
5. `src/components/Footer.tsx` - Footer
6. `src/components/ProducerLayout.tsx` - Sidebar Produtor
7. `src/pages/Home.tsx` - Landing
8. `src/components/VideoHero.tsx` - Hero
9. `src/pages/auth/Login.tsx` - Login
10. `src/pages/producer/CRM.tsx` - CRM

### Para os demais, use prompts no Lovable:

**AuthRegister.tsx:** "Tela de cadastro com toggle entre Produtor/Participante, campos: Nome, Sobrenome, Email, Senha. Fundo bg-canvas, estilo glass."

**EventPage.tsx:** "Pagina de evento com hero imagem, info (data, local, tags), grid de 3-4 tipos de ingresso (card com preço, perks, botao comprar), secao Mesa Coletiva com quiz de 4 perguntas para matchmaking, social proof, galeria."

**ProducerDashboard.tsx:** "Dashboard com 4 KPI cards (Receita, Vendas, Ocupacao, Conversao), grafico de vendas 7 dias, tabela eventos recentes, atividade. Tema claro bg-canvas."

**ProducerEvents.tsx:** "Grid de eventos com imagem, titulo, data, status, progresso vendas/capacidade. Botao Novo Evento."

**BrandStudio.tsx:** "Pagina de personalizacao: seletor de cor primaria, upload logo, preview ao vivo, opcoes de pattern."

**TableCalculator.tsx:** "Calculadora de mesas VIP: inputs pessoas, valor open bar, custo espaco, mark-up. Cards resultado: valor/pessoa, total, lucro."

**ProducerMenu.tsx:** "Cardapio digital com tabs (Bebidas, Comida, Combos, Merch, Servicos), cards com toggle disponivel."

**ProducerFinance.tsx:** "Resumo financeiro: graficos receita/despesa, tabela transacoes, status pagamentos."

**ProducerWallet.tsx:** "Carteira: saldo, historico transacoes, botao sacar."

**AdminDashboard.tsx:** "Overview plataforma: cards (usuarios, eventos, receita, tickets), graficos, tabela produtores pendentes."

**AppHub.tsx:** "Painel participante com 4 tabs: Ingressos (cards com QR), Explorar (feed eventos), Cardapio (comanda digital), Chat."

**Checkout/Payment/Success.tsx:** "Fluxo 3 passos: resumo pedido, dados comprador, simulacao pagamento, sucesso com QR."

**AppDownload.tsx:** "Pagina download com QR code e links App Store/Play Store."

---

## DADOS MOCKADOS: src/data/mockData.ts

Use o arquivo que está no projeto. Os dados principais são:
- 3 eventos com tickets variados
- 6 usuários interessados
- 8 leads CRM com interações e tarefas
- 8 itens de cardápio
- 2 mesas coletivas com 6 membros cada
- 4 perguntas de matchmaking
- 6 estágios de pipeline

---

## INSTALAÇÃO DE DEPENDÊNCIAS

```bash
npm install gsap lucide-react clsx tailwind-merge class-variance-authority @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-accordion @radix-ui/react-avatar @radix-ui/react-label @radix-ui/react-separator @radix-ui/react-switch @radix-ui/react-tooltip
```
