import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    base: '/',
    plugins: [react()],
    optimizeDeps: { include: ['vaul'] }, // sem isto o dev recarrega a página ao achar o vaul ("new dependencies optimized")
    server: {
      port: 3000,
      strictPort: false,
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
