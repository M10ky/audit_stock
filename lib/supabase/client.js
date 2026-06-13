// TODO: Phase 1 — Supabase Browser Client (@supabase/ssr)
import { createBrowserClient } from '@supabase/ssr'

/**
 * Client Supabase côté navigateur.
 * À utiliser dans tous les composants 'use client'.
 * Singleton via useMemo dans les hooks si besoin.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}