import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { PRIVACY_VERSION } from '../lib/legal'

// Aviso da mudança da Política de Privacidade (a própria política, seção 9, promete avisar).
// Some ao fechar e volta sozinho quando PRIVACY_VERSION mudar.
// ponytail: o texto fala da mudança de 04/10/2026 (favoritos); trocar junto com a próxima versão.
const CHAVE = `aviso-politica-${PRIVACY_VERSION}`
const DATA = new Date(`${PRIVACY_VERSION}T12:00:00`).toLocaleDateString('pt-BR')

function jaFechado() {
  try {
    return localStorage.getItem(CHAVE) === '1'
  } catch {
    return false
  }
}

export default function AvisoPolitica() {
  const [aberto, setAberto] = useState(() => !jaFechado())
  // no painel do produtor, celular e tablet: abaixo da barra de 56 px do topo (menu, sino e feedback)
  const produtor = useLocation().pathname.startsWith('/producer')
  if (!aberto) return null

  const fechar = () => {
    try {
      localStorage.setItem(CHAVE, '1')
    } catch {
      // sem armazenamento no navegador: o aviso some só nesta visita
    }
    setAberto(false)
  }

  return (
    <div
      role="status"
      className={`glass-panel fixed inset-x-3 top-3 z-50 mx-auto${produtor ? ' max-lg:top-[64px]' : ''} flex max-w-xl items-start gap-3 !rounded-2xl px-4 py-3 text-sm shadow-lg`}
    >
      <p className="flex-1 leading-relaxed">
        Atualizamos a nossa{' '}
        <Link to="/privacidade" className="font-semibold underline underline-offset-2">
          Política de Privacidade
        </Link>{' '}
        em {DATA}: ela agora descreve os eventos que você salva (favoritos).
      </p>
      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar aviso da Política de Privacidade"
        className="rounded-lg p-1 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:hover:bg-white/10 dark:focus-visible:ring-violet-300"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
