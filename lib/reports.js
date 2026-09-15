// ═══════════════════════════════════════════════════════
//  Connecteo Stock — Rapports & Statistiques : helpers
//  Miroir de js/reports.js (SPA vanilla), adapté pour recevoir
//  les données en paramètres plutôt que lire ST global.
//
//  NOTE ARCHITECTURE : dans le vanilla, ST.mouvements est borné par
//  ST.dateFrom/ST.dateTo (filtre topbar, par défaut le mois en cours) —
//  evolutionValeurStock()/produitsSansMouvement90j() héritent donc
//  silencieusement de cette limite dans le vanilla. Dans le Next.js,
//  dataStore.mouvements charge TOUT l'historique sans filtre de date
//  (cf. dataStore.js: loadMouvements), et le filtrage par période se
//  fait côté page via useDateFilter().filterByDate() — convention déjà
//  établie par DashboardPage. Ces deux helpers reçoivent donc ici
//  l'historique complet, ce qui est plus correct que le comportement
//  vanilla par défaut plutôt qu'une divergence introduite par cette étape.
// ═══════════════════════════════════════════════════════

import { getValeurStockActuel } from '@/lib/helpers'

// ── Visibilité produits ────────────────────────────────────────
export function getProduitsNonAmort(produits) {
  return (produits || []).filter(p => !p.is_amortissable)
}

export function getProduitsVisibles(produits, perm) {
  return (produits || []).filter(p =>
    (perm?.canSeeIT && p.dept === 'IT') || (perm?.canSeeFin && p.dept === 'Finance')
  )
}

// ── Taux de validation des demandes ─────────────────────────────
// "En attente" exclu du calcul — Validé / (Validé + Refusé).
export function tauxValidationGlobal(demandes) {
  const valide = (demandes || []).filter(d => d.statut === 'Validé').length
  const refuse = (demandes || []).filter(d => d.statut === 'Refusé').length
  const total = valide + refuse
  return total ? Math.round((valide / total) * 100) : 0
}

// ── Top produits distribués (quantité + valeur sortie, période) ─
export function topProduitsDistribues(mvtSortie, n = 10) {
  const map = {}
  ;(mvtSortie || []).forEach(m => {
    if (!map[m.produit_id]) map[m.produit_id] = { id: m.produit_id, nom: m.produit_nom, qty: 0, valeur: 0 }
    map[m.produit_id].qty += (m.qty || 0)
    map[m.produit_id].valeur += (m.valeur || 0)
  })
  return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, n)
}

// ── Top produits les plus coûteux ────────────────────────────────
// Non-amortissables : CUMP × stock. Amortissables : somme valeur_achat
// des actifs "vivants" (En service / En prêt).
export function topProduitsCouteux(produits, actifs, mouvementsEntrees, perm, n = 10) {
  const visibles = getProduitsVisibles(produits, perm)
  return visibles
    .map(p => {
      const valeur = p.is_amortissable
        ? (actifs || [])
            .filter(a => a.produit_id === p.id && (a.statut === 'En service' || a.statut === 'En prêt'))
            .reduce((s, a) => s + (a.valeur_achat || 0), 0)
        : getValeurStockActuel(p, mouvementsEntrees)
      return { nom: p.nom, dept: p.dept, valeur, amort: !!p.is_amortissable }
    })
    .filter(x => x.valeur > 0)
    .sort((a, b) => b.valeur - a.valeur)
    .slice(0, n)
}

// ── Répartition des actifs individuels par statut ────────────────
// Mirrors vanilla : gate par canManIT/canManFin (pas canSeeIT/canSeeFin) —
// actifsStore.loadActifs() charge tous départements sans filtre dept, donc
// ce filtrage de visibilité doit être fait ici explicitement.
export function repartitionActifsStatut(actifs, perm) {
  const statuts = ['En service', 'En prêt', 'Hors service', 'Sorti', 'Réformé']
  const visibles = (actifs || []).filter(a =>
    (perm?.canManIT && a.dept === 'IT') || (perm?.canManFin && a.dept === 'Finance')
  )
  return statuts.map(s => ({ statut: s, n: visibles.filter(a => a.statut === s).length }))
}

// ── Évolution de la valeur du stock (non-amortissables), N mois ──
// Reconstruite depuis l'historique des mouvements : Entrée:+valeur,
// Sortie:-valeur, valeur plancher à 0.
export function evolutionValeurStock(produits, mouvements, perm, nbMois = 6) {
  const nonAmortIds = new Set(
    getProduitsNonAmort(produits)
      .filter(p => (perm?.canSeeIT && p.dept === 'IT') || (perm?.canSeeFin && p.dept === 'Finance'))
      .map(p => p.id)
  )
  const mvt = (mouvements || [])
    .filter(m => nonAmortIds.has(m.produit_id))
    .sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date))

  const today = new Date()
  const months = []
  for (let i = nbMois - 1; i >= 0; i--) months.push(new Date(today.getFullYear(), today.getMonth() - i, 1))

  return months.map(mDate => {
    const nextMonth = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 1)
    const val = mvt
      .filter(m => new Date(m.created_at || m.date) < nextMonth)
      .reduce((s, m) => s + (m.type === 'Entrée' ? (m.valeur || 0) : -(m.valeur || 0)), 0)
    return {
      label: mDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      val: Math.max(0, val),
    }
  })
}

// ── Produits sans mouvement depuis plus de 90 jours ──────────────
export function produitsSansMouvement90j(produits, mouvements, perm) {
  const seuil = new Date()
  seuil.setDate(seuil.getDate() - 90)
  return getProduitsVisibles(produits, perm).filter(p => {
    const mvts = (mouvements || []).filter(m => m.produit_id === p.id)
    if (!mvts.length) return true
    const derniere = mvts.reduce((max, m) => {
      const d = new Date(m.created_at || m.date)
      return d > max ? d : max
    }, new Date(0))
    return derniere < seuil
  })
}

// ── Coût moyen des sorties (période) ─────────────────────────────
export function coutMoyenSorties(mvtSortie) {
  const totalQty = (mvtSortie || []).reduce((s, m) => s + (m.qty || 0), 0)
  const totalVal = (mvtSortie || []).reduce((s, m) => s + (m.valeur || 0), 0)
  return totalQty ? totalVal / totalQty : 0
}

// ── Valeur moyenne par catégorie (non-amortissables) ─────────────
export function valeurMoyenneParCategorie(produits, mouvementsEntrees, perm) {
  const cats = {}
  getProduitsNonAmort(produits)
    .filter(p => (perm?.canSeeIT && p.dept === 'IT') || (perm?.canSeeFin && p.dept === 'Finance'))
    .forEach(p => {
      const cat = p.categorie || '—'
      if (!cats[cat]) cats[cat] = { total: 0, n: 0 }
      cats[cat].total += getValeurStockActuel(p, mouvementsEntrees)
      cats[cat].n += 1
    })
  return Object.entries(cats)
    .map(([cat, { total, n }]) => ({ cat, total, n, moyenne: n ? total / n : 0 }))
    .sort((a, b) => b.total - a.total)
}