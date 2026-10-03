import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CHAVE_TEMA, lerTema, rotaForcadaEscuro, temaPadrao, type Tema } from '../lib/tema'

interface ThemeContextType {
  tema: Tema                          // o que vale como escolha (a salva ou o padrão da área)
  temaResolvido: 'light' | 'dark'     // o que está valendo na tela
  setTema: (tema: Tema) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const consultaEscuro = () => window.matchMedia?.('(prefers-color-scheme: dark)')

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [salvo, setSalvo] = useState<Tema | null>(lerTema)
  const [aparelhoEscuro, setAparelhoEscuro] = useState(() => consultaEscuro()?.matches ?? false)
  const { pathname } = useLocation()
  const tema = salvo ?? temaPadrao(pathname) // sem escolha salva, recalcula a cada troca de rota
  const forcadoEscuro = rotaForcadaEscuro(pathname)

  // Em 'auto', acompanha a troca de tema do aparelho na hora
  useEffect(() => {
    if (tema !== 'auto') return
    const mq = consultaEscuro()
    if (!mq) return
    const mudou = () => setAparelhoEscuro(mq.matches)
    mudou()
    mq.addEventListener('change', mudou)
    return () => mq.removeEventListener('change', mudou)
  }, [tema])

  const temaResolvido = forcadoEscuro || tema === 'dark' || (tema === 'auto' && aparelhoEscuro) ? 'dark' : 'light'

  // useLayoutEffect: a classe troca antes da pintura da rota nova (sem um quadro com o tema anterior)
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', temaResolvido === 'dark')
    root.classList.toggle('light', temaResolvido === 'light')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', temaResolvido === 'dark' ? '#0b0d12' : '#ffffff')
  }, [temaResolvido])

  const setTema = (novo: Tema) => {
    setSalvo(novo)
    try {
      localStorage.setItem(CHAVE_TEMA, novo)
    } catch {
      // sem armazenamento (navegação privada): vale só nesta aba
    }
  }

  return (
    <ThemeContext.Provider value={{ tema, temaResolvido, setTema }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  return context
}
