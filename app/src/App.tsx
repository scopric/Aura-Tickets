import { comTempo, lerIngressos } from './lib/ingressosOffline'
import { AuthRetryableFetchError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import { Fragment, Suspense, lazy, useState, useEffect, useCallback, type ReactNode } from 'react'
import { Routes, Route, useLocation, useParams, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { useAuth } from './hooks/useAuth'
import { Toaster } from './components/ui/sonner'
import FeedbackButton from './components/FeedbackButton'
import Header from './components/Header'
import Footer from './components/Footer'
import PageLoading from './components/PageLoading'
import CookieBanner from './components/CookieBanner'
import SupportChatWidget from './components/SupportChatWidget'
import AvisoPolitica from './components/AvisoPolitica'
import { supabase } from './lib/supabase'
import { useAuthStore, isMockSession } from './stores/authStore'
import { Loader2 } from 'lucide-react'
import { Analytics } from '@vercel/analytics/react'

import FeatureGuard from './components/FeatureGuard'
import { ComingSoonRoute } from './components/ComingSoon'
import { trackPageView, trackEvent, semHash } from './lib/tracking'
import { captureAffiliateRef } from './lib/affiliateRef'
import { getAppMode } from './lib/appHost'
import { useTwoFactor } from './hooks/useTwoFactor'

// O host não muda durante a sessão do SPA
const appMode = getAppMode()

// Layouts sob demanda: o que eles importam (menu, Evo, tour) fica fora da entrada; as rotas já estão dentro de <Suspense>
const ProducerLayout = lazy(() => import('./components/ProducerLayout'))
const AdminLayout = lazy(() => import('./components/AdminLayout'))
const AppLayout = lazy(() => import('./components/AppLayout'))

// Public pages (lazy loaded)
const Home = lazy(() => import('./pages/Home'))
const EventPage = lazy(() => import('./pages/EventPage'))
const NotFound = lazy(() => import('./pages/NotFound'))
const BrandStudio = lazy(() => import('./pages/BrandStudio'))
const ContactPage = lazy(() => import('./pages/Contact'))
const TermsPage = lazy(() => import('./pages/Terms'))
const PrivacyPage = lazy(() => import('./pages/Privacy'))
const NewsletterUnsubscribe = lazy(() => import('./pages/NewsletterUnsubscribe'))
const AffiliateArea = lazy(() => import('./pages/AffiliateArea'))
const AffiliateLanding = lazy(() => import('./pages/AffiliateLanding'))
const AuthLogin = lazy(() => import('./pages/auth/Login'))
const AuthRegister = lazy(() => import('./pages/auth/Register'))
const AuthForgot = lazy(() => import('./pages/auth/ForgotPassword'))
const AuthReset = lazy(() => import('./pages/auth/ResetPassword'))
const Convite = lazy(() => import('./pages/auth/Convite'))
const AppDownload = lazy(() => import('./pages/app/Download'))

// Producer pages (lazy loaded)
const ProducerDashboard = lazy(() => import('./pages/producer/Dashboard'))
const ProducerEvents = lazy(() => import('./pages/producer/Events'))
const ComecoRapido = lazy(() => import('./pages/producer/ComecoRapido'))
const PainelEvento = lazy(() => import('./pages/producer/PainelEvento'))
const EventOverview = lazy(() => import('./pages/producer/EventOverview'))
const ProducerCRM = lazy(() => import('./pages/producer/CRM'))
const ProducerFinance = lazy(() => import('./pages/producer/Finance'))
const ProducerBordero = lazy(() => import('./pages/producer/Bordero'))
const ProducerWallet = lazy(() => import('./pages/producer/Wallet'))
const ProducerMenu = lazy(() => import('./pages/producer/Menu'))
const TableCalculator = lazy(() => import('./pages/producer/TableCalculator'))
const ProducerCalculator = lazy(() => import('./pages/producer/Calculator'))
const ProducerFAQ = lazy(() => import('./pages/producer/FAQ'))
const ProducerPiggyBank = lazy(() => import('./pages/producer/PiggyBank'))
const ProducerSubscription = lazy(() => import('./pages/producer/Subscription'))
const ProducerEventBanners = lazy(() => import('./pages/producer/EventBanners'))
const ProducerEventGallery = lazy(() => import('./pages/producer/EventGallery'))
const ProducerAffiliates = lazy(() => import('./pages/producer/Affiliates'))
const ProducerCheckIn = lazy(() => import('./pages/producer/CheckIn'))
const ProducerCommunications = lazy(() => import('./pages/producer/Communications'))
const ProducerTasks = lazy(() => import('./pages/producer/Tasks'))
const ProducerCoupons = lazy(() => import('./pages/producer/Coupons'))
const ProducerPartners = lazy(() => import('./pages/producer/Partners'))
const ProducerTimeline = lazy(() => import('./pages/producer/Timeline'))
const ProducerSettings = lazy(() => import('./pages/producer/ProducerSettings'))
const TeamManager = lazy(() => import('./pages/producer/TeamManager'))
const EvokaaStore = lazy(() => import('./pages/producer/EvokaaStore'))
const InterestList = lazy(() => import('./pages/producer/InterestList'))
const Certificates = lazy(() => import('./pages/producer/Certificates'))
const CertificateBuilder = lazy(() => import('./pages/producer/CertificateBuilder'))
const Marketing = lazy(() => import('./pages/producer/Marketing'))
const EvokaaAcademy = lazy(() => import('./pages/producer/EvokaaAcademy'))
const SeatingMap = lazy(() => import('./pages/producer/SeatingMap'))
const EditorKonva = lazy(() => import('./pages/producer/mapa/EditorKonva'))
const OrganizerApp = lazy(() => import('./pages/producer/OrganizerApp'))
const AdvancePayment = lazy(() => import('./pages/producer/AdvancePayment'))
const Installments = lazy(() => import('./pages/producer/Installments'))
const PostEventReport = lazy(() => import('./pages/producer/PostEventReport'))

// Admin pages (lazy loaded)
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const AdminProducers = lazy(() => import('./pages/admin/Producers'))
const AdminPlatformAffiliates = lazy(() => import('./pages/admin/PlatformAffiliates'))
const AdminEvents = lazy(() => import('./pages/admin/Events'))
const AdminFinance = lazy(() => import('./pages/admin/Finance'))
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics'))
const AdminTickets = lazy(() => import('./pages/admin/Tickets'))
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettings'))
const AdminFeedback = lazy(() => import('./pages/admin/Feedback'))
const AdminNewsletter = lazy(() => import('./pages/admin/Newsletter'))
const AdminCoupons = lazy(() => import('./pages/admin/Coupons'))
const AdminTeam = lazy(() => import('./pages/admin/TeamManager'))
const AdminAiSettings = lazy(() => import('./pages/admin/AiSettings'))
const AdminAtendimento = lazy(() => import('./pages/admin/Atendimento'))
const AdminMatchDeMesa = lazy(() => import('./pages/admin/MatchDeMesa'))
const AdminConhecimento = lazy(() => import('./pages/admin/Conhecimento'))
const AdminMeuCadastro = lazy(() => import('./pages/admin/MeuCadastro'))
const EventsBrowse = lazy(() => import('./pages/EventsBrowse'))

// App pages (lazy loaded)
const AppHub = lazy(() => import('./pages/app/Hub'))
const AppTickets = lazy(() => import('./pages/app/Tickets'))
const AppOrders = lazy(() => import('./pages/app/Orders'))
const AppChat = lazy(() => import('./pages/app/Chat'))
const AppNotifications = lazy(() => import('./pages/app/Notifications'))
const AppProfile = lazy(() => import('./pages/app/Profile'))
const AppSettings = lazy(() => import('./pages/app/Settings'))

// Checkout pages (lazy loaded)
const Checkout = lazy(() => import('./pages/checkout/Checkout'))
const CheckoutPayment = lazy(() => import('./pages/checkout/Payment'))
const CheckoutSuccess = lazy(() => import('./pages/checkout/Success'))

// Trocar de evento pela lateral só muda o :eventId e o React reaproveitaria a tela com o estado do evento anterior
// (a edição gravaria os ingressos de um evento no outro). A chave remonta a tela a cada evento.
function ComChaveDoEvento({ children }: { children: ReactNode }) {
  const { eventId } = useParams()
  return <Fragment key={eventId}>{children}</Fragment>
}

type AllowedRole = 'user' | 'producer' | 'admin' | 'editor' | 'customer'

// Decisão 99: admin sem 2FA não usa o painel (o banco já nega tudo de admin). Cadastra aqui, com o mesmo
// fluxo do Perfil; o código confirmado deixa a sessão em aal2 e a rota confere de novo.
function AdminTwoFactorSetup({ onDone }: { onDone: () => void }) {
  const { enabled, loading, toggle, modal } = useTwoFactor()
  const { logout } = useAuth()
  useEffect(() => { if (enabled) onDone() }, [enabled, onDone])
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-espresso">Para usar o painel de administração, ative a verificação em duas etapas.</p>
      <button onClick={toggle} disabled={loading} className="px-5 py-2 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all disabled:opacity-50">
        Ativar verificação em duas etapas
      </button>
      <button onClick={logout} className="text-sm text-espresso underline">
        Sair
      </button>
      {modal}
    </div>
  )
}

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  requiredPermission
}: { 
  children: React.ReactNode; 
  allowedRoles: AllowedRole[];
  requiredPermission?: string;
}) {
  const { isAuthenticated, isLoading, role, user } = useAuth()
  const location = useLocation()
  // Fecha em erro: sem confirmar o nível do 2FA a rota não abre.
  const [mfaEstado, setMfa] = useState<'checking' | 'ok' | 'required' | 'enroll' | 'error' | 'offline'>('checking')
  const [mfaAttempt, setMfaAttempt] = useState(0)
  // Papel da última conferência: o papel provisório ('user') vira 'admin' depois do perfil; até conferir de novo, espera
  const [mfaRole, setMfaRole] = useState(role)

  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    // Sessão demo (só DEV) não existe no Supabase: sem isto os testes e2e com as contas demo parariam aqui.
    if (isMockSession(useAuthStore.getState().session)) { setMfa('ok'); setMfaRole(role); return }
    let cancelled = false
    const nivel = supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    ;(location.pathname === '/app/tickets' ? comTempo(nivel, 6000, () => ({ data: null, error: new AuthRetryableFetchError('timeout', 0) })) : nivel)
      .then(async ({ data, error }) => {
        if (error || !data?.currentLevel) throw error ?? new Error('Nível de autenticação indisponível')
        if (data.nextLevel === 'aal2' && data.currentLevel === 'aal1') return 'required' as const
        // aal2 já implica fator confirmado (o banco confere o resto): só admin em aal1 lista os fatores
        if (role !== 'admin' || data.currentLevel === 'aal2') return 'ok' as const
        // Admin precisa de 2FA cadastrado (Decisão 99)
        const { data: fatores, error: fatoresError } = await supabase.auth.mfa.listFactors()
        if (fatoresError) throw fatoresError
        return fatores.totp.some((f) => f.status === 'verified') ? 'ok' as const : 'enroll' as const
      })
      .then((estado) => { if (!cancelled) { setMfa(estado); setMfaRole(role) } })
      .catch((err) => {
        // Sem rede o nível do 2FA não se confere. 'offline' não libera nada por si: o render só abre "Ingressos" com cópia guardada
        if (isAuthRetryableFetchError(err)) { if (!cancelled) { setMfa('offline'); setMfaRole(role) } return }
        console.error('[ProtectedRoute] Erro ao verificar MFA:', err)
        if (!cancelled) { setMfa('error'); setMfaRole(role) }
      })
    return () => { cancelled = true }
  }, [isLoading, isAuthenticated, role, mfaAttempt, location.pathname])

  const retryMfa = useCallback(() => { setMfa('checking'); setMfaAttempt((n) => n + 1) }, [])

  const spinner = (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-plum" />
    </div>
  )

  // 'offline' (falha de rede no 2FA) só vale em /app/tickets e com cópia dos ingressos desta conta; nas outras rotas é erro
  const mfa = mfaEstado === 'offline' ? (location.pathname === '/app/tickets' && user?.id && lerIngressos(user.id) ? 'ok' : 'error') : mfaEstado

  if (isLoading) return spinner

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />
  }

  if (mfa === 'checking' || mfaRole !== role) return spinner

  // Sem redirecionar: mandar para o login aqui já causou loop.
  if (mfa === 'error') {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-espresso">Não foi possível confirmar sua sessão.</p>
        <button onClick={retryMfa} className="px-5 py-2 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">
          Tentar de novo
        </button>
      </div>
    )
  }

  if (mfa === 'required') {
    return <Navigate to="/auth/login" state={{ from: location.pathname, mfaRequired: true }} replace />
  }

  if (mfa === 'enroll') return <AdminTwoFactorSetup onDone={retryMfa} />

  // Papel nulo nega. Vai para o login (que não age sem papel), e não para o /app/hub: com papel nulo o
  // /app/hub negaria de novo e redirecionaria para si mesmo (loop).
  if (!role) return <Navigate to="/auth/login" replace />

  if (!allowedRoles.includes(role)) {
    // No alpha não existem painéis de outros papéis: redirecionar para eles cairia no catch-all e voltaria aqui (loop).
    // O login recusa a sessão com "Acesso restrito."
    if (appMode === 'admin') return <Navigate to="/auth/login" replace />
    if (role === 'admin') return <Navigate to="/admin/dashboard" replace />
    if (role === 'producer' || role === 'editor') return <Navigate to="/producer/dashboard" replace />
    return <Navigate to="/app/hub" replace />
  }

  // RBAC de Equipe Administrativa
  if (role === 'admin' && requiredPermission) {
    const hasPermission = user?.admin_permissions?.includes(requiredPermission) || 
                          user?.admin_permissions?.includes('super_admin');
    if (!hasPermission) {
      console.warn(`[ProtectedRoute] Acesso negado para a permissao: ${requiredPermission}`);
      return <Navigate to="/admin/dashboard" replace />
    }
  }

  return <>{children}</>
}

// app.* e alpha.* não têm landing: sem sessão vai direto ao login; com sessão, ao painel do papel.
// No alpha qualquer sessão vai a /admin/dashboard e o ProtectedRoute recusa quem não é admin.
function RootRedirect() {
  const { isAuthenticated, role } = useAuth()
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />
  if (appMode === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (role === 'producer' || role === 'editor') return <Navigate to="/producer/dashboard" replace />
  if (role === 'user') return <Navigate to="/app/hub" replace />
  return <Navigate to="/auth/login" replace />
}

function Layout() {
  const location = useLocation()

  // Alpha (painel admin) sem rastreio (Decisão 46 do cofre); a trava de raiz está em lib/tracking.ts
  useEffect(() => {
    // Registra o inicio de sessao na primeira carga da plataforma
    trackEvent('session_start')
  }, [])

  useEffect(() => {
    // Registra a visualizacao da pagina em cada mudanca de rota
    trackPageView(location.pathname)
  }, [location.pathname])

  // Link do Afiliado Evokaa (?ref=CODIGO) em qualquer página do site/app
  useEffect(() => {
    if (appMode !== 'admin') captureAffiliateRef(location.search)
  }, [location.search])

  // alpha.*: só o login administrativo e o painel /admin/* (sem site institucional)
  if (appMode === 'admin') {
    return (
      <div className="min-h-screen bg-canvas">
        <main>
          <Suspense fallback={<div className="min-h-screen"><PageLoading /></div>}>
            <Routes>
              <Route path="/auth/login" element={<AuthLogin />} />
              <Route path="/auth/forgot" element={<AuthForgot />} />
              <Route path="/auth/reset" element={<AuthReset />} />
              {/* Convite de colaborador: público (o token do link é a prova); o banco decide tudo */}
              <Route path="/convite" element={<Convite />} />

              {/* Admin - protected */}
              <Route element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/meu-cadastro" element={<AdminMeuCadastro />} />
                <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_users"><AdminUsers /></ProtectedRoute>} />
                <Route path="/admin/producers" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_users"><AdminProducers /></ProtectedRoute>} />
                <Route path="/admin/affiliates" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_affiliates"><AdminPlatformAffiliates /></ProtectedRoute>} />
                <Route path="/admin/events" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_events"><AdminEvents /></ProtectedRoute>} />
                <Route path="/admin/finance" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_finance"><AdminFinance /></ProtectedRoute>} />
                <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="view_analytics"><AdminAnalytics /></ProtectedRoute>} />
                <Route path="/admin/tickets" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_tickets"><AdminTickets /></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_settings"><AdminSettingsPage /></ProtectedRoute>} />
                <Route path="/admin/feedback" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_feedback"><AdminFeedback /></ProtectedRoute>} />
                <Route path="/admin/atendimento" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_support"><AdminAtendimento /></ProtectedRoute>} />
                <Route path="/admin/conhecimento" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_support"><AdminConhecimento /></ProtectedRoute>} />
                <Route path="/admin/support" element={<Navigate to="/admin/atendimento" replace />} />
                <Route path="/admin/newsletter" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_newsletter"><AdminNewsletter /></ProtectedRoute>} />
                <Route path="/admin/coupons" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_coupons"><AdminCoupons /></ProtectedRoute>} />
                <Route path="/admin/team" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_team"><AdminTeam /></ProtectedRoute>} />
                <Route path="/admin/ia" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_settings"><AdminAiSettings /></ProtectedRoute>} />
                <Route path="/admin/match-de-mesa" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="moderate_mesa"><AdminMatchDeMesa /></ProtectedRoute>} />
              </Route>

              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </Suspense>
        </main>
        <Toaster />
      </div>
    )
  }

  // A página do evento tem a barra de topo e a de compra próprias (V11a): sem Header, chat de suporte nem feedback; o Footer fica (termos, privacidade, empresa)
  const naPaginaDoEvento = location.pathname.startsWith('/event/')

  const hideLayout =
    naPaginaDoEvento ||
    location.pathname.startsWith('/producer') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/auth') ||
    location.pathname.startsWith('/checkout') ||
    location.pathname.startsWith('/app')

  // Onde há ProducerLayout/AppLayout o Evo ocupa o canto inferior e o feedback fica no ícone do topo.
  // Estas rotas ficam sob os mesmos prefixos mas fora desses layouts: mantêm o botão flutuante.
  const rota = location.pathname.replace(/\/+$/, '')
  const temEvo =
    (rota.startsWith('/producer') || rota.startsWith('/app')) &&
    !['/app/download', '/producer/lugar-marcado', '/producer/lugar-marcado-v2'].includes(rota)

  // Dados e pagamento têm o botão principal fixo embaixo; o feedback flutuante o cobria em 360/390 px (a página de sucesso mantém)
  const naCompra = rota === '/checkout' || rota === '/checkout/payment'

  return (
    <div className="min-h-screen bg-canvas">
      {!hideLayout && <Header />}
      <main>
        <Suspense fallback={<div className="min-h-screen"><PageLoading /></div>}>
          <Routes>
            {/* Public */}
            <Route path="/" element={appMode === 'app' ? <RootRedirect /> : <Home />} />
            <Route path="/events/:quando?" element={<EventsBrowse />} />
            <Route path="/event/:eventId" element={<EventPage />} />
            <Route path="/app/download" element={<AppDownload />} />
            <Route path="/contato" element={<ContactPage />} />
            <Route path="/termos" element={<TermsPage />} />
            <Route path="/privacidade" element={<PrivacyPage />} />
            <Route path="/newsletter/sair" element={<NewsletterUnsubscribe />} />
            <Route path="/p/:code/:link?" element={<AffiliateLanding />} />
            <Route path="/afiliado" element={<ProtectedRoute allowedRoles={['user', 'customer', 'producer', 'editor', 'admin']}><AffiliateArea /></ProtectedRoute>} />
            <Route path="/auth/login" element={<AuthLogin />} />
            <Route path="/auth/register" element={<AuthRegister />} />
            <Route path="/auth/forgot" element={<AuthForgot />} />
            <Route path="/auth/reset" element={<AuthReset />} />

            {/* Producer - protected */}
            <Route element={<ProtectedRoute allowedRoles={['producer', 'editor']}><ProducerLayout /></ProtectedRoute>}>
              <Route path="/producer" element={<ProducerDashboard />} />
              <Route path="/producer/dashboard" element={<ProducerDashboard />} />
              <Route path="/producer/events" element={<ProducerEvents />} />
              <Route path="/producer/events/new" element={<ComecoRapido />} />
              <Route path="/producer/events/:eventId/edit" element={<ComChaveDoEvento><PainelEvento /></ComChaveDoEvento>} />
              <Route path="/producer/event-manager" element={<Navigate to="/producer/events" replace />} />
              <Route path="/producer/event/:eventId" element={<ComChaveDoEvento><EventOverview /></ComChaveDoEvento>} />
              <Route path="/producer/planner" element={<Navigate to="/producer/events/new" replace />} />
              <Route path="/producer/brand" element={<ComingSoonRoute title="O Brand Studio"><BrandStudio /></ComingSoonRoute>} />
              <Route path="/producer/crm" element={<FeatureGuard featureKey="crm"><ProducerCRM /></FeatureGuard>} />
              <Route path="/producer/finance" element={<ProducerFinance />} />
              <Route path="/producer/wallet" element={<ProducerWallet />} />
              <Route path="/producer/tables" element={<TableCalculator />} />
              <Route path="/producer/calculator" element={<ProducerCalculator />} />
              <Route path="/producer/menu" element={<ProducerMenu />} />
              <Route path="/producer/caixinha" element={<ProducerPiggyBank />} />
              <Route path="/producer/banners" element={<FeatureGuard featureKey="banners"><ProducerEventBanners /></FeatureGuard>} />
              <Route path="/producer/galeria" element={<ProducerEventGallery />} />
              <Route path="/producer/afiliados" element={<FeatureGuard featureKey="affiliates"><ProducerAffiliates /></FeatureGuard>} />
              <Route path="/producer/checkin" element={<FeatureGuard featureKey="checkin"><ProducerCheckIn /></FeatureGuard>} />
              <Route path="/producer/comunicacao" element={<ComingSoonRoute title="A Comunicação com participantes"><FeatureGuard featureKey="communications"><ProducerCommunications /></FeatureGuard></ComingSoonRoute>} />
              <Route path="/producer/tarefas" element={<ProducerTasks />} />
              <Route path="/producer/cupons" element={<ProducerCoupons />} />
              <Route path="/producer/parceiros" element={<ProducerPartners />} />
              <Route path="/producer/timeline" element={<ProducerTimeline />} />
              <Route path="/producer/faq" element={<ProducerFAQ />} />
              <Route path="/producer/settings" element={<ProducerSettings />} />
              <Route path="/producer/assinatura" element={<ComingSoonRoute title="A Assinatura"><ProducerSubscription /></ComingSoonRoute>} />
              <Route path="/producer/team" element={<TeamManager />} />
              <Route path="/producer/ingressos-avancados" element={<Navigate to="/producer/events/new" replace />} />
              <Route path="/producer/evokaa-store" element={<ComingSoonRoute title="A Evokaa Store"><EvokaaStore /></ComingSoonRoute>} />
              <Route path="/producer/bordero" element={<ProducerBordero />} />
              <Route path="/producer/lista-interesse" element={<InterestList />} />
              <Route path="/producer/certificados" element={<Certificates />} />
              <Route path="/producer/certificado-editor" element={<CertificateBuilder />} />
              <Route path="/producer/marketing" element={<ComingSoonRoute title="O Marketing"><Marketing /></ComingSoonRoute>} />
              <Route path="/producer/academy" element={<EvokaaAcademy />} />
              <Route path="/producer/app" element={<OrganizerApp />} />
              <Route path="/producer/antecipacao" element={<ComingSoonRoute title="A Antecipação de recebíveis"><AdvancePayment /></ComingSoonRoute>} />
              <Route path="/producer/parcelamento" element={<ComingSoonRoute title="O Parcelamento"><Installments /></ComingSoonRoute>} />
              <Route path="/producer/pos-evento" element={<PostEventReport />} />
            </Route>

            {/* Rota do Editor de Assentos independente (tela cheia, sem o layout do painel geral) */}
             <Route 
              path="/producer/lugar-marcado" 
              element={
                <ProtectedRoute allowedRoles={['producer', 'editor']}>
                  <FeatureGuard featureKey="seating_map">
                    <SeatingMap />
                  </FeatureGuard>
                </ProtectedRoute>
              } 
            />

            {/* Editor novo (Konva), em paralelo ao antigo; sem entrada no menu até o QA */}
            <Route
              path="/producer/lugar-marcado-v2"
              element={
                <ProtectedRoute allowedRoles={['producer', 'editor']}>
                  <FeatureGuard featureKey="seating_map">
                    <EditorKonva />
                  </FeatureGuard>
                </ProtectedRoute>
              }
            />

            {/* Admin só existe no alpha.* */}
            <Route path="/admin/*" element={<Navigate to="/" replace />} />

            {/* Participant - protected with AppLayout */}
            <Route element={<ProtectedRoute allowedRoles={['user']}><AppLayout /></ProtectedRoute>}>
              <Route path="/app/hub" element={<AppHub />} />
              <Route path="/app/tickets" element={<AppTickets />} />
              <Route path="/app/events/:quando?" element={<EventsBrowse />} />
              <Route path="/app/salvos" element={<EventsBrowse aba="salvos" />} />
              <Route path="/app/orders" element={<AppOrders />} />
              <Route path="/app/chat" element={<AppChat />} />
              <Route path="/app/notifications" element={<AppNotifications />} />
              <Route path="/app/profile" element={<AppProfile />} />
              <Route path="/app/settings" element={<AppSettings />} />
            </Route>

            {/* Checkout */}
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/payment" element={<CheckoutPayment />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />

            {/* 404 - catch all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {(!hideLayout || naPaginaDoEvento) && (
        // na página do evento a barra de compra fixa cobre o pé: folga igual à altura dela
        <div className={naPaginaDoEvento ? 'bg-slate-950 pb-[calc(env(safe-area-inset-bottom)+5rem)]' : undefined}><Footer /></div>
      )}
      <Toaster />
      {!temEvo && !naPaginaDoEvento && !naCompra && <FeedbackButton />}
      {temEvo && <AvisoPolitica />}
      <CookieBanner />
      {!hideLayout && <SupportChatWidget />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Layout />
        {/* Vercel Web Analytics: sem cookies e sem identificar o visitante (Decisão 26 do cofre); não no alpha (Decisão 46) */}
        {appMode !== 'admin' && <Analytics beforeSend={semHash} />}
      </ThemeProvider>
    </AuthProvider>
  )
}
