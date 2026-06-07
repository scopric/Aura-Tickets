import { createContext, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('evokaa-theme')
    return (saved as Theme) || 'dark'
  })

  const location = useLocation()

  // Determina se a rota atual pertence a landing page
  const isLandingPage = !['/producer', '/admin', '/app', '/checkout', '/auth'].some(path => 
    location.pathname.startsWith(path)
  )

  useEffect(() => {
    const root = window.document.documentElement
    
    if (isLandingPage) {
      // Landing page sempre fica no modo escuro
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      // Plataforma aplica o tema configurado
      if (theme === 'dark') {
        root.classList.add('dark')
        root.classList.remove('light')
      } else {
        root.classList.remove('dark')
        root.classList.add('light')
      }
    }
  }, [theme, isLandingPage])

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('evokaa-theme', next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  return context
}
