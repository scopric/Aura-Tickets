import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// ============================================
// Password Reset Request
// ============================================
export function useResetPasswordRequest() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      })
      if (error) throw error
      return true
    },
  })
}

// ============================================
// Update Password
// ============================================
export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      return true
    },
  })
}

// ============================================
// Sign Out
// ============================================
export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      return true
    },
  })
}

// ============================================
// Password Recovery Validation
// ============================================
export function usePasswordRecoveryValidation() {
  const [valid, setValid] = useState(false)
  const [validating, setValidating] = useState(true)

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const check = async () => {
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(async (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setValid(true)
          setValidating(false)
        } else if (event === 'SIGNED_IN' && window.location.hash.includes('type=recovery')) {
          setValid(true)
          setValidating(false)
        }
      })
      subscription = sub

      const { data: { session } } = await supabase.auth.getSession()
      if (window.location.hash.includes('access_token')) {
        setValid(true)
        setValidating(false)
      } else if (!session) {
        setValid(false)
        setValidating(false)
      } else {
        setValid(true)
        setValidating(false)
      }
    }

    check()
    return () => subscription?.unsubscribe()
  }, [])

  return { valid, validating }
}
