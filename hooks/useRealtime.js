// TODO: Phase correspondante — useRealtime
'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import { useActifsStore } from '@/store/actifsStore'

/**
 * Hook Realtime — s'abonne aux 4 tables via postgres_changes.
 * À monter une seule fois dans AppLayout.
 * Filtre par dept si le profil n'est pas 'both'.
 */
export function useRealtime() {
  const supabase   = createClient()
  const profile    = useAuthStore((s) => s.profile)
  const channelRef = useRef(null)

  const {
    onRealtimeProduit,
    onRealtimeMouvement,
    onRealtimeDemande,
    loadParams,
  } = useDataStore()

  const onRealtimeActif = useActifsStore((s) => s.onRealtimeActif)

  useEffect(() => {
    if (!profile) return

    const dept = profile.dept  // 'IT' | 'Finance' | 'both'

    // Filtre dept pour les tables avec colonne dept
    const deptFilter = dept !== 'both'
      ? `dept=eq.${dept}`
      : undefined

    // Nettoyage de l'ancien channel si re-render
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel('connecteo-realtime')

      // ── Produits ─────────────────────────────────────────
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'produits',
        ...(deptFilter ? { filter: deptFilter } : {}),
      }, onRealtimeProduit)

      // ── Mouvements ───────────────────────────────────────
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'mouvements',
        ...(deptFilter ? { filter: deptFilter } : {}),
      }, onRealtimeMouvement)

      // ── Demandes ─────────────────────────────────────────
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'demandes',
        ...(deptFilter ? { filter: deptFilter } : {}),
      }, onRealtimeDemande)

      // ── Paramètres ───────────────────────────────────────
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'parametres',
      }, () => loadParams(supabase))

      // ── Actifs individuels ──────────────────────────────
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'actifs_individuels',
        ...(deptFilter ? { filter: deptFilter } : {}),
      }, onRealtimeActif)

      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps
}