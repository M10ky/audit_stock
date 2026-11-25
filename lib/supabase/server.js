import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { canManUsers } from '@/lib/permissions'

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

/**
 * Garde d'autorisation serveur pour les Route Handlers admin.
 * Le middleware ne vérifie qu'une session existante, PAS le rôle : sans ce
 * contrôle, n'importe quel utilisateur authentifié pourrait appeler les routes
 * service_role avec l'URL directement.
 * Retourne { profile } si autorisé, sinon { error: NextResponse } (401/403).
 * À appeler AVANT createAdminClient().
 */
export async function requireManUsers() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!canManUsers(profile)) {
    return { error: NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 }) }
  }
  return { profile }
}