import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../contexts/AuthContext'

type AllowedRole = 'user' | 'producer' | 'admin'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: AllowedRole[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, role, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-plum"></div>
      </div>
    )
  }

  // Not logged in → redirect to login with return URL
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />
  }

  // Logged in but wrong role → redirect to correct home
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (role === 'admin') return <Navigate to="/admin/dashboard" replace />
    if (role === 'producer') return <Navigate to="/producer/dashboard" replace />
    return <Navigate to="/app/hub" replace />
  }

  return <>{children}</>
}
