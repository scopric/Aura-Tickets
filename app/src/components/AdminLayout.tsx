import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ErrorBoundary } from './error-boundary'
import * as I from '@/components/icones/evokaa16'
import { cn } from '@/lib/utils'
import { useAuth } from '../hooks/useAuth'
import ThemeToggle from './ThemeToggle'
import NotificationsTopButton from './NotificationsTopButton'
import FeedbackTopButton from './FeedbackTopButton'
import { uploadAvatar } from '../lib/avatarUpload'
import { supabase } from '../lib/supabase'
import { bipe } from '../hooks/useConversas'

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const toque = '[@media(pointer:coarse)]:min-h-11'
const botaoTopo = `rounded-full p-2 text-foreground hover:bg-foreground/5 ${foco}`
// mesmo item da lateral do produtor: 32 px, 13/500; ativo em tint + texto cheio (ícone azul)
const itemBase = cn('relative flex h-8 w-full items-center gap-2.5 rounded-ev-md px-2 text-left text-[13px] font-medium transition-colors duration-rapido motion-reduce:transition-none', foco, toque)
const itemCor = (ativo: boolean) => ativo
  ? 'bg-[var(--ev-tint-ativo)] font-semibold text-foreground'
  : 'text-muted-foreground hover:bg-[var(--ev-tint-hover)] hover:text-foreground'

const navItems = [
  { to: '/admin/dashboard', icon: I.Painel, label: 'Dashboard' },
  { to: '/admin/users', icon: I.Pessoas, label: 'Usuários', permission: 'manage_users' },
  { to: '/admin/producers', icon: I.Empresa, label: 'Produtores', permission: 'manage_users' },
  { to: '/admin/affiliates', icon: I.Afiliado, label: 'Afiliados Evokaa', permission: 'manage_affiliates' },
  { to: '/admin/events', icon: I.Eventos, label: 'Eventos', permission: 'manage_events' },
  { to: '/admin/finance', icon: I.Financeiro, label: 'Financeiro', permission: 'manage_finance' },
  { to: '/admin/analytics', icon: I.Relatorio, label: 'Analytics', permission: 'view_analytics' },
  { to: '/admin/tickets', icon: I.Ingressos, label: 'Ingressos', permission: 'manage_tickets' },
  { to: '/admin/newsletter', icon: I.Email, label: 'Newsletter', permission: 'manage_newsletter' },
  { to: '/admin/coupons', icon: I.Cupom, label: 'Cupons', permission: 'manage_coupons' },
  { to: '/admin/team', icon: I.Equipe, label: 'Equipe', permission: 'manage_team' },
  { to: '/admin/feedback', icon: I.Ideia, label: 'Feedback', permission: 'manage_feedback' },
  { to: '/admin/atendimento', icon: I.Atendimento, label: 'Atendimento', permission: 'manage_support' },
  { to: '/admin/match-de-mesa', icon: I.Mesa, label: 'Match de Mesa', permission: 'moderate_mesa' },
  { to: '/admin/conhecimento', icon: I.Livro, label: 'Conhecimento', permission: 'manage_support' },
  { to: '/admin/ia', icon: I.Bot, label: 'IA / Evo', permission: 'manage_settings' },
  { to: '/admin/settings', icon: I.Configuracoes, label: 'Configurações', permission: 'manage_settings' },
  { to: '/admin/meu-cadastro', icon: I.Cadastro, label: 'Meu cadastro' },
]

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  // Celular e tablet (abaixo de lg): a barra lateral vira gaveta, fechada por padrão
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const location = useLocation()
  const { user, logout } = useAuth()
  const isActive = (path: string) => location.pathname === path

  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && user?.id) {
      await uploadAvatar(file, user.id)
    }
  }

  const triggerUpload = () => {
    fileInputRef.current?.click()
  }

  const handleLogout = () => {
    toast.info('Voce saiu da sua conta')
    logout()
    // Nao chamar navigate('/') aqui — o logout ja faz window.location.href = '/'
  }

  // Contador de conversas abertas COM A EQUIPE ao lado de "Atendimento" (as do assistente ficam de fora):
  // o canal abaixo atualiza na hora; o polling de 60 s é reserva
  const podeAtender = !!user?.admin_permissions?.some((p) => p === 'manage_support' || p === 'super_admin')
  const { data: abertas } = useQuery({
    queryKey: ['chat-abertas'],
    enabled: podeAtender,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase.from('conversations' as never).select('id', { count: 'exact', head: true }).eq('status', 'open').eq('bot_state', 'humano')
      if (error) throw error
      return count ?? 0
    },
  })

  // Som de mensagem em qualquer página do alpha (não só no Atendimento): um canal só, INSERT de mensagens
  // de conversa COM A EQUIPE (bot_state da mensagem = estado da conversa quando ela chegou; a RLS limita
  // ao que a pessoa atende): mensagem do cliente e o aviso de passagem do assistente ("system").
  // Mensagem do cliente enquanto o assistente atende não toca. Atualiza o contador na hora.
  const qc = useQueryClient()
  const uid = user?.id
  useEffect(() => {
    if (!podeAtender) return
    const canal = supabase
      .channel(`admin-chat-som-${crypto.randomUUID()}`)
      .on<{ sender_role: string; is_internal: boolean; sender_id: string | null; bot_state: string | null }>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: 'bot_state=eq.humano' },
        ({ new: m }) => {
          if ((m.sender_role !== 'customer' && m.sender_role !== 'system') || m.bot_state !== 'humano' || m.is_internal || m.sender_id === uid) return
          bipe([659.25, 987.77])
          qc.invalidateQueries({ queryKey: ['chat-abertas'] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [podeAtender, uid, qc])

  // Gaveta aberta: foco no 1º item; Esc fecha e devolve o foco ao botão de menu
  useEffect(() => {
    if (!mobileOpen) return
    navRef.current?.querySelector('a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMobileOpen(false)
      menuBtnRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const filteredNavItems = navItems.filter((item) => {
    if (!item.permission) return true
    return (
      user?.admin_permissions?.includes(item.permission) ||
      user?.admin_permissions?.includes('super_admin')
    )
  })

  const avatar = user?.avatar_url || user?.avatar || '/images/logo-evokaa-sm.png'

  return (
    <div className="flex min-h-screen glass-canvas bg-background bg-none">
      {mobileOpen && (
        <div
          className="fixed inset-0 glass-backdrop z-40 lg:hidden"
          onClick={() => {
            setMobileOpen(false)
            menuBtnRef.current?.focus()
          }}
        />
      )}

      {/* No celular a gaveta fecha fora da tela e fica invisível (sai da ordem do Tab); no computador, fixa (248 px ou trilho de 56 px).
          Só tokens (V12a): fundo --ev-sidebar, fio border, item ativo em tint; nada de vidro nem de roxo fixo. */}
      <aside
        id="admin-menu"
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 lg:z-40 flex w-[248px] flex-col border-r border-border bg-[var(--ev-sidebar)] pl-[env(safe-area-inset-left)] transition-[width,transform] duration-base ease-move motion-reduce:transition-none',
          'lg:translate-x-0',
          // ao abrir, a visibilidade muda na hora (sem transição), para o foco poder entrar na gaveta
          mobileOpen ? 'translate-x-0 max-lg:[transition-property:transform]' : '-translate-x-full max-lg:invisible',
          collapsed && 'lg:w-14'
        )}
      >
        {/* Logo */}
        <div className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4', collapsed && 'lg:justify-center lg:px-2')}>
          <img
            src="/images/logo-evokaa-sm.png"
            alt="Evokaa"
            className={cn('w-auto shrink-0', collapsed ? 'h-7' : 'h-8')}
          />
          {!collapsed && (
            <span className="text-sm font-semibold text-foreground">Admin</span>
          )}
        </div>

        {/* no celular, a visibilidade dos links não passa por transição (herdam a da gaveta), senão o foco ao abrir falha */}
        <nav ref={navRef} aria-label="Menu do admin" className="max-lg:[&_a]:[transition-property:color,background-color,border-color,box-shadow] min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2 sidebar-dark-scroll">
          {filteredNavItems.map((item) => {
            const ativo = isActive(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                aria-current={ativo ? 'page' : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={cn(itemBase, itemCor(ativo), collapsed && 'lg:justify-center lg:px-0')}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={16} ativo={ativo} className={cn('shrink-0', ativo && 'text-primary')} aria-hidden="true" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && item.to === '/admin/atendimento' && !!abertas && (
                  <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-4 text-primary-foreground">
                    {abertas}<span className="sr-only"> conversas abertas</span>
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-border p-2">
          {/* User */}
          {user && (
            <div className={cn('flex items-center gap-2.5 px-1 pb-1', collapsed && 'lg:justify-center')}>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
              <button
                type="button"
                onClick={triggerUpload}
                aria-label="Alterar foto de perfil"
                title="Alterar foto de perfil"
                className={cn('group relative shrink-0 rounded-full', foco)}
              >
                <img src={avatar} alt="" className="size-8 rounded-full object-cover ring-1 ring-border" />
                <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <I.Camera size={14} className="text-primary-foreground" />
                </span>
              </button>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">{user.name || user.full_name || 'Usuário'}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{user.email}</div>
                </div>
              )}
            </div>
          )}

          <div className={cn(collapsed && 'flex justify-center')}><ThemeToggle collapsed={collapsed} /></div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label={collapsed ? 'Sair' : undefined}
            title={collapsed ? 'Sair' : undefined}
            className={cn(itemBase, 'text-muted-foreground hover:bg-[var(--ev-tint-hover)] hover:text-destructive', collapsed && 'lg:justify-center lg:px-0')}
          >
            <I.Sair size={16} className="shrink-0" aria-hidden="true" />
            {!collapsed && <span>Sair</span>}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!collapsed}
            aria-controls="admin-menu"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={cn(itemBase, itemCor(false), 'max-lg:hidden', collapsed && 'justify-center px-0')}
          >
            <I.Lateral size={16} className="shrink-0" aria-hidden="true" />
            {!collapsed && <span>Recolher menu</span>}
          </button>
        </div>
      </aside>

      {/* laterais: com viewport-fit=cover o conteúdo não pode ir para baixo do entalhe (iPhone deitado) */}
      <div className={cn('min-w-0 flex-1 min-h-screen pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] transition-[margin] duration-base ease-move motion-reduce:transition-none', collapsed ? 'lg:ml-14' : 'lg:ml-[248px]')}>
        {/* Barra do topo fixa ao rolar, sólida (como a do produtor). Celular: 56 px com menu, logo, sino e feedback.
            Computador: faixa invisível de 40 px só com os ícones à direita (não cobre o cabeçalho das páginas). */}
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background px-4 lg:pointer-events-none lg:h-10 lg:justify-end lg:border-0 lg:bg-transparent">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => {
                setCollapsed(false) // a gaveta abre sempre com os nomes (no celular não há seta para expandir)
                setMobileOpen((o) => !o)
              }}
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileOpen}
              aria-controls="admin-menu"
              className={cn('rounded-md p-2 text-foreground hover:bg-foreground/5', foco)}
            >
              <I.Menu size={20} aria-hidden="true" />
            </button>
            <img src="/images/logo-evokaa-sm.png" alt="Evokaa" className="h-7 w-auto" />
          </div>
          <div className="pointer-events-auto flex items-center gap-1 lg:rounded-full lg:border lg:border-border lg:bg-card lg:p-0.5">
            <NotificationsTopButton className={botaoTopo} />
            <FeedbackTopButton className={botaoTopo} />
          </div>
        </div>
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  )
}
