/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // text-primary e text-destructive usam a cor de TEXTO (passa AA nos dois temas); bg-, border- e ring- seguem com o preenchimento
      textColor: {
        primary: {
          DEFAULT: "hsl(var(--primary-text) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive-text) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        canvas: "rgb(var(--canvas-rgb) / <alpha-value>)",
        void: "rgb(var(--void-rgb) / <alpha-value>)",
        plum: "rgb(var(--plum-rgb) / <alpha-value>)",
        "plum-light": "var(--plum-light)", // roxo que passa nos dois temas (usado como text-plum-light)
        espresso: "rgb(var(--espresso-rgb) / <alpha-value>)",
        cream: "rgb(var(--cream-rgb) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        // Outfit só na Home (index.css, body.home-outfit); as telas antigas com font-serif ficam em Jakarta
        serif: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'Geist', 'system-ui', 'sans-serif'],
        // nome do evento e números de dado (contrato v3.4, §3); largura com font-stretch
        display: ['Archivo', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
        // contrato v3.4, §2.3: o raio cresce com a altura
        "ev-xs": "4px",
        "ev-sm": "6px",
        "ev-md": "8px",
        "ev-lg": "10px",
        "ev-xl": "12px",
        "ev-2xl": "20px",
        "ev-pill": "999px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        elevated: "0px 20px 40px rgba(12, 35, 64, 0.15)",   /* marinho: #0c2340 -> rgba(12, 35, 64, 0.15) */
        glow: "0px 0px 30px rgba(29, 104, 196, 0.3)",       /* azul royal: #1d68c4 -> rgba(29, 104, 196, 0.3) */
        // contrato v3.4, §2.4: três níveis e mais nada (valores por tema no index.css)
        "ev-0": "0 0 #0000",
        "ev-1": "var(--ev-sombra-1)",
        "ev-2": "var(--ev-sombra-2)",
        "ev-foco": "var(--ev-foco)",                     // anel de foco duplo, só em :focus-visible
      },
      // contrato v3.4, §9 (tokens no index.css; "reduzir movimento" encurta o lento)
      transitionDuration: {
        micro: "var(--mov-micro)",
        rapido: "var(--mov-rapido)",
        base: "var(--mov-base)",
        lento: "var(--mov-lento)",
      },
      transitionTimingFunction: {
        sai: "var(--curva-sai)",
        entra: "var(--curva-entra)",
        move: "var(--curva-move)",
        gaveta: "var(--curva-gaveta)",
        mola: "var(--curva-mola)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(29, 104, 196, 0.2)" },
          "50%": { boxShadow: "0 0 40px rgba(29, 104, 196, 0.5)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "float": "float 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
