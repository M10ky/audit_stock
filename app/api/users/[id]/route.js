import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Suppression d'un utilisateur (admin).
 *
 * Mirrors js/settings.js deleteUserProfile() : l'utilisateur est retiré de la
 * table `profiles`. Amélioration documentée par rapport au Vanilla — celui-ci
 * exigeait de supprimer ensuite le compte Auth « séparément dans le dashboard »
 * (settings.js:82-84). Ici la suppression passe par un Route Handler avec le
 * rôle service_role, donc le compte Supabase Auth est supprimé avec le profil
 * en une seule opération. La garde « impossible de supprimer son propre compte »
 * vit côté client (UtilisateursTable).
 */
export async function DELETE(_request, { params }) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'ID utilisateur manquant' }, { status: 400 })

  const supabase = createAdminClient()

  // 1) Table `profiles` (volet applicatif) — même opération que le Vanilla.
  const { error: profileErr } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id)
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  // 2) Compte Supabase Auth (volet authentification) — service_role requis.
  const { error: authErr } = await supabase.auth.admin.deleteUser(id)
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}