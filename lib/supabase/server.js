// TODO: Phase 1 — Supabase Server Client (@supabase/ssr)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Client Supabase côté serveur.
 * À utiliser dans Server Components, layouts, et Route Handlers.
 * Gère automatiquement les cookies de session.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll peut échouer dans un Server Component read-only.
            // Le middleware gère le refresh de session à la place.
          }
        },
      },
    }
  )
}

/**
 * Client Supabase avec service_role pour les opérations admin.
 * NE JAMAIS exposer côté client.
 * À utiliser uniquement dans les Route Handlers (/app/api/...).
 */
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  )
}