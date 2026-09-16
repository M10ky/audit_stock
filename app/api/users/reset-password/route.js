import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Réinitialisation du mot de passe (admin).
 *
 * Mirrors js/settings.js resetUserPassword() : envoie un e-mail de
 * réinitialisation à l'utilisateur (authentification sécurisée par lien de
 * récupération — jamais d'écriture directe d'un mot de passe provisoire).
 * `redirectTo` cible la page courante pour que le flux de récupération Supabase
 * ramène l'utilisateur dans l'application une fois le nouveau mot de passe saisi.
 */
export async function POST(request) {
  const body = await request.json().catch(() => null)
  const email = body?.email
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof body?.redirectTo === 'string' ? body.redirectTo : undefined,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}