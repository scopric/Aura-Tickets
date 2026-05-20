import { Routes, Route, useLocation, Navigate } from 'react-router'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Toaster } from './components/ui/sonner'
import FeedbackButton from './components/FeedbackButton'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import EventPage from './pages/EventPage'
import NotFound from './pages/NotFound'
import BrandStudio from './pages/BrandStudio'
import ProducerLayout from './components/ProducerLayout'
import ProducerDashboard from './pages/producer/Dashboard'
import ProducerEvents from './pages/producer/Events'
import ProducerNewEvent from './pages/producer/NewEvent'
import EventManager from './pages/producer/EventManager'
import EventFolder from './pages/producer/EventFolder'
import EventPlanner from './pages/producer/EventPlanner'
import ProducerCRM from './pages/producer/CRM'
import ProducerFinance from './pages/producer/Finance'
import ProducerWallet from './pages/producer/Wallet'
import ProducerMenu from './pages/producer/Menu'
import TableCalculator from './pages/producer/TableCalculator'
import ProducerCalculator from './pages/producer/Calculator'
import ProducerFAQ from './pages/producer/FAQ'
import ProducerPiggyBank from './pages/producer/PiggyBank'
import ProducerSubscription from './pages/producer/Subscription'
import ProducerEventBanners from './pages/producer/EventBanners'
import ProducerEventGallery from './pages/producer/EventGallery'
import ProducerAffiliates from './pages/producer/Affiliates'
import ProducerCheckIn from './pages/producer/CheckIn'
import ProducerCommunications from './pages/producer/Communications'
import ProducerTasks from './pages/producer/Tasks'
import ProducerCoupons from './pages/producer/Coupons'
import ProducerPartners from './pages/producer/Partners'
import ProducerTimeline from './pages/producer/Timeline'
import AdminFeedback from './pages/admin/Feedback'
import AdminLayout from './components/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminProducers from './pages/admin/Producers'
import AdminEvents from './pages/admin/Events'
import AdminFinance from './pages/admin/Finance'
import AdminAnalytics from './pages/admin/Analytics'
import AdminTickets from './pages/admin/Tickets'
import AdminSettingsPage from './pages/admin/AdminSettings'
import ProducerSettings from './pages/producer/ProducerSettings'
import TeamManager from './pages/producer/TeamManager'
import EventTicketConfig from './pages/producer/EventTicketConfig'
import AuraStore from './pages/producer/AuraStore'
import EventBordero from './pages/producer/EventBordero'
import InterestList from './pages/producer/InterestList'
import Certificates from './pages/producer/Certificates'
import CertificateBuilder from './pages/producer/CertificateBuilder'
import Marketing from './pages/producer/Marketing'
import AuraAcademy from './pages/producer/AuraAcademy'
import SeatingMap from './pages/producer/SeatingMap'
import OrganizerApp from './pages/producer/OrganizerApp'
import AdvancePayment from './pages/producer/AdvancePayment'
import Installments from './pages/producer/Installments'
import PostEventReport from './pages/producer/PostEventReport'
import AppLayout from './components/AppLayout'
import AppTickets from './pages/app/Tickets'
import AppNotifications from './pages/app/Notifications'
import AppProfile from './pages/app/Profile'
import AppSettings from './pages/app/Settings'
import Checkout from './pages/checkout/Checkout'
import CheckoutPayment from './pages/checkout/Payment'
import CheckoutSuccess from './pages/checkout/Success'
import ContactPage from './pages/Contact'
import AuthLogin from './pages/auth/Login'
import AuthRegister from './pages/auth/Register'
import AppHub from './pages/app/Hub'
import AppDownload from './pages/app/Download'

type AllowedRole = 'user' | 'producer' | 'admin'

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: AllowedRole[] }) {
  const { isAuthenticated, role } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />
  }

  if (role && !allowedRoles.includes(role)) {
    if (role === 'admin') return <Navigate to="/admin/dashboard" replace />
    if (role === 'producer') return <Navigate to="/producer/dashboard" replace />
    return <Navigate to="/app/hub" replace />
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
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/event/:eventId" element={<EventPage />} />
          <Route path="/app/download" element={<AppDownload />} />
          <Route path="/contato" element={<ContactPage />} />
          <Route path="/auth/login" element={<AuthLogin />} />
          <Route path="/auth/register" element={<AuthRegister />} />

          {/* Producer - protected */}
          <Route element={<ProtectedRoute allowedRoles={['producer']}><ProducerLayout /></ProtectedRoute>}>
            <Route path="/producer" element={<ProducerDashboard />} />
            <Route path="/producer/dashboard" element={<ProducerDashboard />} />
            <Route path="/producer/events" element={<ProducerEvents />} />
            <Route path="/producer/events/new" element={<ProducerNewEvent />} />
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
            <Route path="/producer/aura-store" element={<AuraStore />} />
            <Route path="/producer/bordero" element={<EventBordero />} />
            <Route path="/producer/lista-interesse" element={<InterestList />} />
            <Route path="/producer/certificados" element={<Certificates />} />
            <Route path="/producer/certificado-editor" element={<CertificateBuilder />} />
            <Route path="/producer/marketing" element={<Marketing />} />
            <Route path="/producer/academy" element={<AuraAcademy />} />
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
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/producers" element={<AdminProducers />} />
            <Route path="/admin/events" element={<AdminEvents />} />
            <Route path="/admin/finance" element={<AdminFinance />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/tickets" element={<AdminTickets />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/feedback" element={<AdminFeedback />} />
          </Route>

          {/* Participant - protected with AppLayout */}
          <Route element={<ProtectedRoute allowedRoles={['user']}><AppLayout /></ProtectedRoute>}>
            <Route path="/app/hub" element={<AppHub />} />
            <Route path="/app/tickets" element={<AppTickets />} />
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
      </main>
      {!hideLayout && <Footer />}
      <Toaster />
      <FeedbackButton />
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
