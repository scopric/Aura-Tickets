import { Link } from 'react-router-dom'
import { LogOut, LayoutDashboard } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { appUrl } from '../lib/appHost'
import { registerUrl } from '../lib/affiliateRef'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Folha do menu no celular (o Vaul só baixa na primeira vez que a pessoa abre)
export default function HeaderFolha({ aberta, aoMudar, links, ativo, autenticado, painelDoUsuario, logout }: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  links: { href: string; label: string }[]
  ativo: (path: string) => boolean
  autenticado: boolean
  painelDoUsuario: string
  logout: () => void
}) {
  return (
      <Drawer open={aberta} onOpenChange={aoMudar}>
        <DrawerContent className="mx-auto max-w-xl md:hidden">
          <DrawerTitle className="sr-only">Menu</DrawerTitle>
          <DrawerDescription className="sr-only">Navegação do site</DrawerDescription>
          <div className="space-y-1 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
            {links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => aoMudar(false)}
                className={cn(
                  'alvo-44 flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-ev-foco',
                  ativo(link.href)
                    ? 'bg-accent text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
              {autenticado ? (
                <>
                  <Link
                    to={painelDoUsuario}
                    onClick={() => aoMudar(false)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-foreground border border-border rounded-full hover:bg-accent transition-all"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Meu Painel
                  </Link>
                  <button
                    onClick={() => { aoMudar(false); logout() }}
                    className="flex-1 flex items-center justify-center py-3 text-sm font-medium text-destructive border border-destructive/40 rounded-full hover:bg-destructive/10 transition-all"
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to={appUrl('/auth/login')}
                    onClick={() => aoMudar(false)}
                    className="flex-1 flex items-center justify-center py-3 text-sm font-medium text-foreground border border-border rounded-full hover:bg-accent transition-all"
                  >
                    Entrar
                  </Link>
                  <Link
                    to={registerUrl(appUrl)}
                    onClick={() => aoMudar(false)}
                    className="flex-1 flex items-center justify-center py-3 text-sm font-semibold text-primary-foreground rounded-full bg-primary shadow-ev-primary transition-all hover:bg-primary/90"
                  >
                    Criar Conta
                  </Link>
                </>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
  )
}
