import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { clsx } from 'clsx'

interface ThemeToggleProps {
  className?: string
  collapsed?: boolean
}

export default function ThemeToggle({ className, collapsed = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()

  if (collapsed) {
    return (
      <button
        onClick={toggleTheme}
        className={clsx(
          'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300',
          theme === 'dark' 
            ? 'bg-slate-900/80 text-amber-400 border border-amber-500/20 hover:bg-slate-800' 
            : 'bg-white text-indigo-500 border border-slate-200 hover:bg-slate-50 shadow-sm',
          className
        )}
        title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
      >
        {theme === 'dark' ? (
          <Sun className="w-4 h-4 animate-pulse" />
        ) : (
          <Moon className="w-4 h-4" />
        )}
      </button>
    )
  }

  return (
    <div
      className={clsx(
        'flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-300',
        theme === 'dark' ? 'bg-slate-950/60 border border-white/[0.04]' : 'bg-slate-100 border border-slate-200/60',
        className
      )}
    >
      <span className={clsx(
        'text-xs font-semibold select-none',
        theme === 'dark' ? 'text-white/60' : 'text-slate-600'
      )}>
        Tema Visual
      </span>
      <button
        onClick={toggleTheme}
        className={clsx(
          'relative w-12 h-6.5 rounded-full p-0.5 transition-all duration-300 focus:outline-none flex items-center',
          theme === 'dark' ? 'bg-slate-800 border border-white/5' : 'bg-slate-200 border border-slate-300'
        )}
        title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
      >
        {/* Sol */}
        <Sun className={clsx(
          'w-3 h-3 absolute left-2 transition-opacity duration-300',
          theme === 'light' ? 'opacity-100 text-amber-500 font-bold' : 'opacity-30 text-white'
        )} />
        
        {/* Lua */}
        <Moon className={clsx(
          'w-3 h-3 absolute right-2 transition-opacity duration-300',
          theme === 'dark' ? 'opacity-100 text-indigo-400 font-bold' : 'opacity-30 text-slate-800'
        )} />

        {/* Knob deslizante */}
        <div
          className={clsx(
            'w-5 h-5 rounded-full transition-transform duration-300 shadow-md flex items-center justify-center',
            theme === 'dark' 
              ? 'translate-x-5 bg-indigo-500 text-white' 
              : 'translate-x-0.5 bg-white text-amber-500'
          )}
        />
      </button>
    </div>
  )
}
