// ═══════════════════════════════════════════════════════
//  ARGOS — Contrôles de cohérence des mouvements
// ═══════════════════════════════════════════════════════

/**
 * Règle métier : une sortie datée ne doit pas rendre le solde négatif à un
 * instant T, ni casser une sortie postérieure déjà saisie.
 *
 * Contrôle réservé aux SORTIES saisies en mode manuel (date rétroactive) —
 * les entrées ne créent jamais de déficit, et les sorties en mode normal
 * sont déjà couvertes par le contrôle de stock du formulaire.
 *
 * @param {object}  supabase   client Supabase
 * @param {object}  prod       produit concerné (id, stock, is_amortissable)
 * @param {string[]} actifIds  actifs sélectionnés à la sortie (amortissable)
 * @param {number}  qty        quantité de la sortie
 * @param {string}  tsMvt      horodatage ISO de la transaction saisie
 * @param {Array}   actifs     actifs_individuels fraîchement rechargés
 * @returns {Promise<{ok:true}|{ok:false,message:string}>}
 */
export async function verifierCoherenceSortie(supabase, prod, actifIds, qty, tsMvt, actifs) {
  const t = new Date(tsMvt).getTime()

  if (prod.is_amortissable) {
    for (const id of actifIds) {
      const a = (actifs || []).find(x => x.id === id)
      if (a?.date_entree && new Date(a.date_entree).getTime() > t) {
        return { ok: false, message: `Sortie impossible : ${id} est entré après la date saisie` }
      }
    }
    return { ok: true }
  }

  // Lecture paginée : PostgREST plafonne à 1000 lignes par requête
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('mouvements')
      .select('type, qty, created_at').eq('produit_id', prod.id)
      .order('created_at', { ascending: true }).range(from, from + 999)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }

  const sign = m => (m.type === 'Entrée' ? (m.qty || 0) : -(m.qty || 0))
  // Solde initial = stock actuel − net des mouvements connus (absorbe les produits legacy)
  let solde = prod.stock - rows.reduce((s, m) => s + sign(m), 0)

  const ev = rows.map(m => ({ t: new Date(m.created_at).getTime(), d: sign(m), hyp: false }))
  ev.push({ t, d: -qty, hyp: true })
  ev.sort((a, b) => a.t - b.t || b.d - a.d) // à égalité, les entrées d'abord
  const hypIdx = ev.findIndex(e => e.hyp)

  for (let i = 0; i < ev.length; i++) {
    solde += ev[i].d
    // On ne bloque que les violations CAUSÉES par la nouvelle ligne
    if (i >= hypIdx && solde < 0 && solde + qty >= 0) {
      return { ok: false, message: `Stock insuffisant à cette date : le solde passerait à ${solde} le ${new Date(ev[i].t).toLocaleString('fr-FR')}. Saisissez d'abord les entrées antérieures.` }
    }
  }
  return { ok: true }
}
