import { Suspense, lazy, useState, useEffect } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
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
import { supabase } from './lib/supabase'
import { Loader2 } from 'lucide-react'
import { Analytics, type BeforeSend } from '@vercel/analytics/react'

// Layouts (pequenos, carregados estaticamente)
import ProducerLayout from './components/ProducerLayout'
import AdminLayout from './components/AdminLayout'
import AppLayout from './components/AppLayout'
import FeatureGuard from './components/FeatureGuard'
import { ComingSoonRoute } from './components/ComingSoon'
import { trackPageView, trackEvent } from './lib/tracking'
import { captureAffiliateRef } from './lib/affiliateRef'
import { getAppMode } from './lib/appHost'

// O host não muda durante a sessão do SPA
const appMode = getAppMode()

// Vercel Web Analytics envia a URL inteira; o Supabase devolve o token no #hash
// (login social e redefinição de senha), então o hash nunca sai daqui. Fora do componente
// para não re-registrar o script a cada render.
const semHash: BeforeSend = (event) => ({ ...event, url: event.url.split('#')[0] })

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
const AppDownload = lazy(() => import('./pages/app/Download'))

// Producer pages (lazy loaded)
const ProducerDashboard = lazy(() => import('./pages/producer/Dashboard'))
const ProducerEvents = lazy(() => import('./pages/producer/Events'))
const ProducerNewEvent = lazy(() => import('./pages/producer/NewEvent'))
const ProducerEditEvent = lazy(() => import('./pages/producer/EditEvent'))
const EventManager = lazy(() => import('./pages/producer/EventManager'))
const EventFolder = lazy(() => import('./pages/producer/EventFolder'))
const EventPlanner = lazy(() => import('./pages/producer/EventPlanner'))
const ProducerCRM = lazy(() => import('./pages/producer/CRM'))
const ProducerFinance = lazy(() => import('./pages/producer/Finance'))
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
const EventTicketConfig = lazy(() => import('./pages/producer/EventTicketConfig'))
const EvokaaStore = lazy(() => import('./pages/producer/EvokaaStore'))
const EventBordero = lazy(() => import('./pages/producer/EventBordero'))
const InterestList = lazy(() => import('./pages/producer/InterestList'))
const Certificates = lazy(() => import('./pages/producer/Certificates'))
const CertificateBuilder = lazy(() => import('./pages/producer/CertificateBuilder'))
const Marketing = lazy(() => import('./pages/producer/Marketing'))
const EvokaaAcademy = lazy(() => import('./pages/producer/EvokaaAcademy'))
const SeatingMap = lazy(() => import('./pages/producer/SeatingMap'))
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
const SupportChatAdmin = lazy(() => import('./pages/admin/SupportChat'))
const EventsBrowse = lazy(() => import('./pages/EventsBrowse'))

// App pages (lazy loaded)
const AppHub = lazy(() => import('./pages/app/Hub'))
const AppTickets = lazy(() => import('./pages/app/Tickets'))
const AppEvents = lazy(() => import('./pages/app/Events'))
const AppOrders = lazy(() => import('./pages/app/Orders'))
const AppFavorites = lazy(() => import('./pages/app/Favorites'))
const AppChat = lazy(() => import('./pages/app/Chat'))
const AppNotifications = lazy(() => import('./pages/app/Notifications'))
const AppProfile = lazy(() => import('./pages/app/Profile'))
const AppSettings = lazy(() => import('./pages/app/Settings'))

// Checkout pages (lazy loaded)
const Checkout = lazy(() => import('./pages/checkout/Checkout'))
const CheckoutPayment = lazy(() => import('./pages/checkout/Payment'))
const CheckoutSuccess = lazy(() => import('./pages/checkout/Success'))

type AllowedRole = 'user' | 'producer' | 'admin' | 'editor' | 'customer'

function ProtectedRoute({ 
  children, 
  allowedRoles,
  requiredPermission
}: { 
  children: React.ReactNode; 
  allowedRoles: AllowedRole[];
  requiredPermission?: string;
}) {
  const { isAuthenticated, role, user } = useAuth()
  const location = useLocation()
  const [checkingMfa, setCheckingMfa] = useState(true)
  const [mfaRequired, setMfaRequired] = useState(false)

  useEffect(() => {
    async function checkMfa() {
      if (isAuthenticated) {
        try {
          const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
          if (!error && data) {
            if (data.nextLevel === 'aal2' && data.currentLevel === 'aal1') {
              setMfaRequired(true)
            }
          }
        } catch (err) {
          console.error('[ProtectedRoute] Erro ao verificar MFA:', err)
        }
      }
      setCheckingMfa(false)
    }
    checkMfa()
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />
  }

  if (checkingMfa) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-plum" />
      </div>
    )
  }

  if (mfaRequired) {
    return <Navigate to="/auth/login" state={{ from: location.pathname, mfaRequired: true }} replace />
  }

  if (role && !allowedRoles.includes(role)) {
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
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/auth/login" element={<AuthLogin />} />
              <Route path="/auth/forgot" element={<AuthForgot />} />
              <Route path="/auth/reset" element={<AuthReset />} />

              {/* Admin - protected */}
              <Route element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_users"><AdminUsers /></ProtectedRoute>} />
                <Route path="/admin/producers" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_users"><AdminProducers /></ProtectedRoute>} />
                <Route path="/admin/affiliates" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_affiliates"><AdminPlatformAffiliates /></ProtectedRoute>} />
                <Route path="/admin/events" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_events"><AdminEvents /></ProtectedRoute>} />
                <Route path="/admin/finance" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_finance"><AdminFinance /></ProtectedRoute>} />
                <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="view_analytics"><AdminAnalytics /></ProtectedRoute>} />
                <Route path="/admin/tickets" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_tickets"><AdminTickets /></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_settings"><AdminSettingsPage /></ProtectedRoute>} />
                <Route path="/admin/feedback" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_feedback"><AdminFeedback /></ProtectedRoute>} />
                <Route path="/admin/support" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_feedback"><SupportChatAdmin /></ProtectedRoute>} />
                <Route path="/admin/newsletter" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_newsletter"><AdminNewsletter /></ProtectedRoute>} />
                <Route path="/admin/coupons" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_coupons"><AdminCoupons /></ProtectedRoute>} />
                <Route path="/admin/team" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_team"><AdminTeam /></ProtectedRoute>} />
              </Route>

              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </Suspense>
        </main>
        <Toaster />
      </div>
    )
  }

  const hideLayout =
    location.pathname.startsWith('/producer') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/auth') ||
    location.pathname.startsWith('/checkout') ||
    location.pathname.startsWith('/app')

  return (
    <div className="min-h-screen bg-canvas">
      {!hideLayout && <Header />}
      <main>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={appMode === 'app' ? <RootRedirect /> : <Home />} />
            <Route path="/events" element={<EventsBrowse />} />
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
              <Route path="/producer/events/new" element={<ProducerNewEvent />} />
              <Route path="/producer/events/:eventId/edit" element={<ProducerEditEvent />} />
              <Route path="/producer/event-manager" element={<EventManager />} />
              <Route path="/producer/event/:eventId" element={<ComingSoonRoute title="A Pasta do Evento"><EventFolder /></ComingSoonRoute>} />
              <Route path="/producer/planner" element={<EventPlanner />} />
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
              <Route path="/producer/comunicacao" element={<FeatureGuard featureKey="communications"><ProducerCommunications /></FeatureGuard>} />
              <Route path="/producer/tarefas" element={<ProducerTasks />} />
              <Route path="/producer/cupons" element={<ProducerCoupons />} />
              <Route path="/producer/parceiros" element={<ProducerPartners />} />
              <Route path="/producer/timeline" element={<ProducerTimeline />} />
              <Route path="/producer/faq" element={<ProducerFAQ />} />
              <Route path="/producer/settings" element={<ProducerSettings />} />
              <Route path="/producer/assinatura" element={<ComingSoonRoute title="A área de Assinatura"><ProducerSubscription /></ComingSoonRoute>} />
              <Route path="/producer/team" element={<TeamManager />} />
              <Route path="/producer/ingressos-avancados" element={<ComingSoonRoute title="A configuração avançada de ingressos"><EventTicketConfig /></ComingSoonRoute>} />
              <Route path="/producer/evokaa-store" element={<ComingSoonRoute title="A Evokaa Store"><EvokaaStore /></ComingSoonRoute>} />
              <Route path="/producer/bordero" element={<ComingSoonRoute title="O Borderô"><EventBordero /></ComingSoonRoute>} />
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

            {/* Admin só existe no alpha.* */}
            <Route path="/admin/*" element={<Navigate to="/" replace />} />

            {/* Participant - protected with AppLayout */}
            <Route element={<ProtectedRoute allowedRoles={['user']}><AppLayout /></ProtectedRoute>}>
              <Route path="/app/hub" element={<AppHub />} />
              <Route path="/app/tickets" element={<AppTickets />} />
              <Route path="/app/events" element={<AppEvents />} />
              <Route path="/app/orders" element={<AppOrders />} />
              <Route path="/app/favorites" element={<AppFavorites />} />
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
      {!hideLayout && <Footer />}
      <Toaster />
      <FeedbackButton />
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
