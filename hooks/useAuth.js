'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { useDataStore } from '@/store/dataStore'
import { useActifsStore } from '@/store/actifsStore'
import { getPermissions } from '@/lib/permissions'

/**
 * Hook principal d'authentification.
 * Initialise la session, charge le profil, écoute onAuthStateChange.
 * À monter une seule fois dans AppLayout.
 */
export function useAuth() {
  const router   = useRouter()
  const supabase = createClient()

  const {
    user, profile, setUser,
    loadProfile, setLoading, reset,
  } = useAuthStore()

  const { resetData } = useDataStore()
  const resetActifs = useActifsStore((s) => s.resetActifs)

  useEffect(() => {
    const loadSessionProfile = async (sessionUser) => {
      if (!sessionUser) return false
      setUser(sessionUser)
      const { error } = await loadProfile(supabase, sessionUser.id)
      if (!error) return true
      await supabase.auth.signOut()
      reset()
      resetData()
      resetActifs()
      router.push('/login')
      return false
    }

    // Récupération de la session initiale
    const init = async () => {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user && !(await loadSessionProfile(session.user))) {
        setLoading(false)
        return
      }
      setLoading(false)
    }

    init()

    // Écoute des changements d'état auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
          await loadSessionProfile(session.user)
        }
        if (event === 'SIGNED_OUT') {
          reset()
          resetData()
          resetActifs()
          router.push('/login')
        }
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => {
    await supabase.auth.signOut()
    // onAuthStateChange SIGNED_OUT gère le reste
  }

  const permissions = getPermissions(profile)

  return {
    user,
    profile,
    permissions,
    logout,
    supabase,
    isLoaded: !useAuthStore.getState().loading,
  }
}