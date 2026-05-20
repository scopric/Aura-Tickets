import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { toast } from 'sonner'

export type Role = 'user' | 'producer' | 'admin'

export interface UserProfile {
  id: string
  role: Role
  full_name: string | null
  avatar_url: string | null
  plan?: string
}

interface AuthContextType {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  role: Role | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  register: (name: string, email: string, password: string, role: Role) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  role: null,
  login: async () => false,
  logout: async () => {},
  register: async () => false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session)
    })

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSession = async (session: Session | null) => {
    if (!session?.user) {
      setUser(null)
      setIsLoading(false)
      return
    }

    // Fetch profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
    }

    if (profile) {
      setUser({
        id: profile.id,
        role: profile.role as Role,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      })
    }
    setIsLoading(false)
  }

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      toast.error(error.message)
      setIsLoading(false)
      return false
    }
    return true
  }

  const register = async (name: string, email: string, password: string, role: Role) => {
    setIsLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: role,
        }
      }
    })
    
    if (error) {
      toast.error(error.message)
      setIsLoading(false)
      return false
    }

    // Workaround: if the trigger didn't set the role, we force update it here.
    if (data.user) {
      await supabase.from('profiles').update({ role }).eq('id', data.user.id)
    }

    return true
  }

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, role: user?.role ?? null, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
