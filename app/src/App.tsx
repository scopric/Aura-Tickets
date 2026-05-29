import { Suspense, lazy } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import { Toaster } from './components/ui/sonner'
import FeedbackButton from './components/FeedbackButton'
import Header from './components/Header'
import Footer from './components/Footer'
import PageLoading from './components/PageLoading'
import CookieBanner from './components/CookieBanner'

// Layouts (pequenos, carregados estaticamente)
import ProducerLayout from './components/ProducerLayout'
import AdminLayout from './components/AdminLayout'
import AppLayout from './components/AppLayout'

// Public pages (lazy loaded)
const Home = lazy(() => import('./pages/Home'))
const EventPage = lazy(() => import('./pages/EventPage'))
const NotFound = lazy(() => import('./pages/NotFound'))
const BrandStudio = lazy(() => import('./pages/BrandStudio'))
const ContactPage = lazy(() => import('./pages/Contact'))
const TermsPage = lazy(() => import('./pages/Terms'))
const PrivacyPage = lazy(() => import('./pages/Privacy'))
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
const AdminEvents = lazy(() => import('./pages/admin/Events'))
const AdminFinance = lazy(() => import('./pages/admin/Finance'))
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics'))
const AdminTickets = lazy(() => import('./pages/admin/Tickets'))
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettings'))
const AdminFeedback = lazy(() => import('./pages/admin/Feedback'))
const AdminNewsletter = lazy(() => import('./pages/admin/Newsletter'))
const AdminTeam = lazy(() => import('./pages/admin/TeamManager'))
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

type AllowedRole = 'user' | 'producer' | 'admin'

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

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />
  }

  if (role && !allowedRoles.includes(role)) {
    if (role === 'admin') return <Navigate to="/admin/dashboard" replace />
    if (role === 'producer') return <Navigate to="/producer/dashboard" replace />
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

function Layout() {
  const location = useLocation()
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
            <Route path="/" element={<Home />} />
            <Route path="/events" element={<EventsBrowse />} />
            <Route path="/event/:eventId" element={<EventPage />} />
            <Route path="/app/download" element={<AppDownload />} />
            <Route path="/contato" element={<ContactPage />} />
            <Route path="/termos" element={<TermsPage />} />
            <Route path="/privacidade" element={<PrivacyPage />} />
            <Route path="/auth/login" element={<AuthLogin />} />
            <Route path="/auth/register" element={<AuthRegister />} />
            <Route path="/auth/forgot" element={<AuthForgot />} />
            <Route path="/auth/reset" element={<AuthReset />} />

            {/* Producer - protected */}
            <Route element={<ProtectedRoute allowedRoles={['producer']}><ProducerLayout /></ProtectedRoute>}>
              <Route path="/producer" element={<ProducerDashboard />} />
              <Route path="/producer/dashboard" element={<ProducerDashboard />} />
              <Route path="/producer/events" element={<ProducerEvents />} />
              <Route path="/producer/events/new" element={<ProducerNewEvent />} />
              <Route path="/producer/events/:eventId/edit" element={<ProducerEditEvent />} />
              <Route path="/producer/event-manager" element={<EventManager />} />
              <Route path="/producer/event/:eventId" element={<EventFolder />} />
              <Route path="/producer/planner" element={<EventPlanner />} />
              <Route path="/producer/brand" element={<BrandStudio />} />
              <Route path="/producer/crm" element={<ProducerCRM />} />
              <Route path="/producer/finance" element={<ProducerFinance />} />
              <Route path="/producer/wallet" element={<ProducerWallet />} />
              <Route path="/producer/tables" element={<TableCalculator />} />
              <Route path="/producer/calculator" element={<ProducerCalculator />} />
              <Route path="/producer/menu" element={<ProducerMenu />} />
              <Route path="/producer/caixinha" element={<ProducerPiggyBank />} />
              <Route path="/producer/banners" element={<ProducerEventBanners />} />
              <Route path="/producer/galeria" element={<ProducerEventGallery />} />
              <Route path="/producer/afiliados" element={<ProducerAffiliates />} />
              <Route path="/producer/checkin" element={<ProducerCheckIn />} />
              <Route path="/producer/comunicacao" element={<ProducerCommunications />} />
              <Route path="/producer/tarefas" element={<ProducerTasks />} />
              <Route path="/producer/cupons" element={<ProducerCoupons />} />
              <Route path="/producer/parceiros" element={<ProducerPartners />} />
              <Route path="/producer/timeline" element={<ProducerTimeline />} />
              <Route path="/producer/faq" element={<ProducerFAQ />} />
              <Route path="/producer/settings" element={<ProducerSettings />} />
              <Route path="/producer/assinatura" element={<ProducerSubscription />} />
              <Route path="/producer/team" element={<TeamManager />} />
              <Route path="/producer/ingressos-avancados" element={<EventTicketConfig />} />
              <Route path="/producer/evokaa-store" element={<EvokaaStore />} />
              <Route path="/producer/bordero" element={<EventBordero />} />
              <Route path="/producer/lista-interesse" element={<InterestList />} />
              <Route path="/producer/certificados" element={<Certificates />} />
              <Route path="/producer/certificado-editor" element={<CertificateBuilder />} />
              <Route path="/producer/marketing" element={<Marketing />} />
              <Route path="/producer/academy" element={<EvokaaAcademy />} />
              <Route path="/producer/lugar-marcado" element={<SeatingMap />} />
              <Route path="/producer/app" element={<OrganizerApp />} />
              <Route path="/producer/antecipacao" element={<AdvancePayment />} />
              <Route path="/producer/parcelamento" element={<Installments />} />
              <Route path="/producer/pos-evento" element={<PostEventReport />} />
            </Route>

            {/* Admin - protected */}
            <Route element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_users"><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/producers" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_users"><AdminProducers /></ProtectedRoute>} />
              <Route path="/admin/events" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_events"><AdminEvents /></ProtectedRoute>} />
              <Route path="/admin/finance" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_finance"><AdminFinance /></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="view_analytics"><AdminAnalytics /></ProtectedRoute>} />
              <Route path="/admin/tickets" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_tickets"><AdminTickets /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_settings"><AdminSettingsPage /></ProtectedRoute>} />
              <Route path="/admin/feedback" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_feedback"><AdminFeedback /></ProtectedRoute>} />
              <Route path="/admin/newsletter" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_newsletter"><AdminNewsletter /></ProtectedRoute>} />
              <Route path="/admin/team" element={<ProtectedRoute allowedRoles={['admin']} requiredPermission="manage_team"><AdminTeam /></ProtectedRoute>} />
            </Route>

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
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  )
}
