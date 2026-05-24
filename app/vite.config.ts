import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {
    base: '/',
    plugins: [mode === 'development' && inspectAttr(), react()].filter(Boolean),
    server: {
      port: 3000,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-avatar',
              '@radix-ui/react-select',
              '@radix-ui/react-popover',
              '@radix-ui/react-slider',
              '@radix-ui/react-switch',
              'lucide-react',
              'class-variance-authority',
              'clsx',
              'tailwind-merge',
            ],
            'data-vendor': ['@tanstack/react-query', 'zustand'],
            'charts': ['recharts'],
            'animation': ['gsap', '@gsap/react'],
            'supabase': ['@supabase/supabase-js'],
          },
        },
      },
    },
  }
});
