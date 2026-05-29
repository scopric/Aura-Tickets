# Evokaa Design System v2.0

## Overview

Design system moderno inspirado em Linear, Vercel, Stripe e Apple. Paleta baseada na nova logo com gradiente azul-ciano → roxo.

## Cores

### Brand
| Nome | Hex | Tailwind | Uso |
|------|-----|----------|-----|
| Cyan | `#06b6d4` | cyan-500 | Destaques, acentos |
| Blue | `#3b82f6` | blue-500 | Primária, CTAs |
| Violet | `#8b5cf6` | violet-500 | Acento secundário |
| Indigo | `#6366f1` | indigo-500 | Gradientes |

### Gradientes
```css
--gradient-brand: linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6);
--gradient-hero: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
--gradient-card: linear-gradient(180deg, rgba(6,182,212,0.05), rgba(139,92,246,0.05));
--gradient-glow: linear-gradient(135deg, rgba(6,182,212,0.3), rgba(139,92,246,0.3));
```

### Neutros
| Nome | Hex | Tailwind |
|------|-----|----------|
| Dark | `#0f172a` | slate-900 |
| Darker | `#020617` | slate-950 |
| Light | `#f8fafc` | slate-50 |
| Card | `#ffffff` | white |
| Text Primary | `#0f172a` | slate-900 |
| Text Secondary | `#475569` | slate-600 |
| Text Muted | `#94a3b8` | slate-400 |
| Border | `#e2e8f0` | slate-200 |

## Tipografia

### Fontes
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
```

### Escala
| Token | Size | Line Height | Weight | Letter Spacing |
|-------|------|-------------|--------|----------------|
| Display | clamp(3rem, 8vw, 6rem) | 1.05 | 700 | -0.03em |
| H1 | clamp(2rem, 4vw, 3.5rem) | 1.1 | 700 | -0.02em |
| H2 | clamp(1.5rem, 3vw, 2.5rem) | 1.2 | 600 | -0.01em |
| H3 | clamp(1.125rem, 2vw, 1.5rem) | 1.3 | 600 | 0 |
| Body | 1rem (16px) | 1.6 | 400 | 0 |
| Small | 0.875rem (14px) | 1.5 | 500 | 0 |
| Caption | 0.75rem (12px) | 1.4 | 500 | 0.02em |

## Componentes

### Button Primary
```
background: linear-gradient(135deg, #3b82f6, #8b5cf6);
color: white;
padding: 14px 32px;
border-radius: 9999px;
font-size: 14px;
font-weight: 600;
box-shadow: 0 4px 20px rgba(59,130,246,0.3);
transition: all 0.3s ease;
hover: {
  transform: scale(1.02);
  box-shadow: 0 6px 30px rgba(59,130,246,0.4);
}
active: {
  transform: scale(0.98);
}
```

### Button Secondary
```
background: transparent;
border: 1.5px solid #e2e8f0;
color: #0f172a;
padding: 14px 32px;
border-radius: 9999px;
font-size: 14px;
font-weight: 600;
hover: {
  background: rgba(59,130,246,0.05);
  border-color: #3b82f6;
}
```

### Card
```
background: white;
border: 1px solid #e2e8f0;
border-radius: 20px;
padding: 24px;
box-shadow: 0 1px 3px rgba(0,0,0,0.05);
transition: all 0.3s ease;
hover: {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.08);
  border-color: rgba(59,130,246,0.2);
}
```

### Card Gradient Border
```
background: white;
border-radius: 20px;
padding: 24px;
position: relative;
::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 20px;
  padding: 2px;
  background: linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

## Animações

### Keyframes
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.3); }
  50% { box-shadow: 0 0 40px rgba(139,92,246,0.5); }
}

@keyframes gradientFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-15px) rotate(2deg); }
}
```

## Shadow Tokens
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 12px rgba(0,0,0,0.08);
--shadow-lg: 0 12px 40px rgba(0,0,0,0.12);
--shadow-glow: 0 0 40px rgba(59,130,246,0.3);
--shadow-glow-lg: 0 0 60px rgba(139,92,246,0.4);
```

## Breakpoints
```css
--bp-sm: 640px;
--bp-md: 768px;
--bp-lg: 1024px;
--bp-xl: 1280px;
--bp-2xl: 1536px;
```
