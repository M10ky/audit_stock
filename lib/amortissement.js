// TODO: Phase 1 — calcVNC, amortPct, amortColor, tauxLineaire, annuiteLineaire
// ═══════════════════════════════════════════════════════
//  Connecteo Stock — Amortissement Linéaire
//  Méthode dégressive supprimée — linéaire uniquement.
// ═══════════════════════════════════════════════════════

/**
 * Taux annuel d'amortissement linéaire (%)
 * Ex: 5 ans → 20%/an
 */
export function tauxLineaire(duree) {
  if (!duree || duree <= 0) return 0
  return parseFloat((100 / duree).toFixed(4))
}

/**
 * Annuité d'amortissement linéaire (montant annuel fixe)
 */
export function annuiteLineaire(valeurAchat, duree) {
  if (!valeurAchat || !duree || duree <= 0) return 0
  return Math.round(valeurAchat / duree)
}

/**
 * Nombre d'années écoulées depuis la date d'achat
 */
export function anneesEcoulees(dateAchat, refDate = new Date()) {
  if (!dateAchat) return 0
  const achat = new Date(dateAchat)
  if (isNaN(achat)) return 0
  const ms = refDate - achat
  if (ms <= 0) return 0
  return ms / (365.25 * 24 * 3600 * 1000)
}

/**
 * Valeur Nette Comptable (VNC) à la date de référence.
 * Plancher à 0 (jamais négatif).
 */
export function calcVNC(valeurAchat, dateAchat, duree, refDate = new Date()) {
  if (!valeurAchat || !dateAchat || !duree || duree <= 0) return 0
  const annees = Math.min(anneesEcoulees(dateAchat, refDate), duree)
  const amortCumul = annees * (valeurAchat / duree)
  return Math.max(0, Math.round(valeurAchat - amortCumul))
}

/**
 * Pourcentage d'amortissement écoulé (0 → 100)
 */
export function amortPct(valeurAchat, dateAchat, duree, refDate = new Date()) {
  if (!valeurAchat || valeurAchat <= 0) return 0
  const vnc = calcVNC(valeurAchat, dateAchat, duree, refDate)
  return Math.min(100, Math.round(((valeurAchat - vnc) / valeurAchat) * 100))
}

/**
 * Statut textuel selon le pourcentage d'amortissement
 */
export function amortStatus(pct) {
  if (pct >= 100) return 'Amorti'
  if (pct >= 75)  return 'Critique'
  if (pct >= 50)  return 'Avancé'
  return 'Normal'
}

/**
 * Variable CSS couleur selon le statut
 */
export function amortColor(pct) {
  if (pct >= 100) return 'var(--red)'
  if (pct >= 75)  return 'var(--amber)'
  if (pct >= 50)  return 'var(--indigo)'
  return 'var(--green)'
}

/**
 * Tableau d'amortissement annuel complet
 * Retourne un array d'objets { annee, annuite, amortCumul, vnc }
 */
export function tableauAmort(valeurAchat, dateAchat, duree) {
  if (!valeurAchat || !dateAchat || !duree || duree <= 0) return []
  const annuite = annuiteLineaire(valeurAchat, duree)
  const rows = []
  let cumul = 0
  for (let i = 1; i <= duree; i++) {
    cumul += annuite
    rows.push({
      annee:      i,
      annuite,
      amortCumul: Math.min(cumul, valeurAchat),
      vnc:        Math.max(0, valeurAchat - cumul),
    })
  }
  return rows
}

/**
 * Calcul complet pour un produit — entrée principale des composants
 * @param {Object} produit — { valeur_achat, date_achat, duree_amortissement }
 * @param {Date}   refDate — date de référence (défaut: aujourd'hui)
 */
export function calcAmortComplet(produit, refDate = new Date()) {
  const { valeur_achat, date_achat, duree_amortissement } = produit ?? {}

  if (!valeur_achat || !date_achat || !duree_amortissement) {
    return {
      taux:    0,
      annuite: 0,
      vnc:     0,
      pct:     0,
      status:  '—',
      color:   'var(--text3)',
      amorti:  false,
      eligible: false,
    }
  }

  const pct = amortPct(valeur_achat, date_achat, duree_amortissement, refDate)
  const vnc = calcVNC(valeur_achat, date_achat, duree_amortissement, refDate)

  return {
    taux:    tauxLineaire(duree_amortissement),
    annuite: annuiteLineaire(valeur_achat, duree_amortissement),
    vnc,
    pct,
    status:  amortStatus(pct),
    color:   amortColor(pct),
    amorti:  pct >= 100,
    eligible: true,
  }
}