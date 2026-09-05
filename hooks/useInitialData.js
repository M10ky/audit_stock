'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import { useDataStore } from '@/store/dataStore'
import { useActifsStore } from '@/store/actifsStore'
import { usePretsStore } from '@/store/pretsStore'

/**
 * Charge toutes les données initiales une fois le profil disponible.
 * À monter dans AppLayout.
 */
export function useInitialData() {
  const supabase = createClient()
  const profile  = useAuthStore(s => s.profile)
  const done     = useRef(false)

  const loadProduits           = useDataStore(s => s.loadProduits)
  const loadMouvements         = useDataStore(s => s.loadMouvements)
  const loadDemandes           = useDataStore(s => s.loadDemandes)
  const loadParams             = useDataStore(s => s.loadParams)
  const loadMouvementsEntrees  = useDataStore(s => s.loadMouvementsEntrees)
  const loadAllProfiles        = useAuthStore(s => s.loadAllProfiles)
  const loadActifs             = useActifsStore(s => s.loadActifs)
  const loadPrets               = usePretsStore(s => s.loadPrets)

  useEffect(() => {
    if (!profile || done.current) return
    done.current = true

    const dept = profile.dept // 'IT' | 'Finance' | 'both'

    Promise.all([
      loadProduits(supabase, dept),
      loadMouvements(supabase, dept),
      loadDemandes(supabase, dept),
      loadParams(supabase),
      loadMouvementsEntrees(supabase),
      loadActifs(supabase),
      loadPrets(supabase),
      profile.role === 'Administrateur' ? loadAllProfiles(supabase) : Promise.resolve(),
    ])
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps
}