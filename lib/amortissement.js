// ═══════════════════════════════════════════════════════
//  Connecteo Stock — Amortissement Linéaire
//  IMPORTANT : duree_amortissement est stocké en MOIS (12, 24, 36…)
//  tauxLineaire(36) → 33.33 %/an   ✓
// ═══════════════════════════════════════════════════════

/**
 * Nombre de mois écoulés depuis la date d'achat.
 */
export function moisEcoules(dateAchat, refDate = new Date()) {
  if (!dateAchat) return 0
  const achat = new Date(dateAchat)
  if (isNaN(achat)) return 0
  const ref = refDate instanceof Date ? refDate : new Date(refDate)
  return Math.max(
    0,
    (ref.getFullYear() - achat.getFullYear()) * 12 +
      (ref.getMonth() - achat.getMonth())
  )
}

/**
 * Nombre d'années écoulées (wrapper).
 */
export function anneesEcoulees(dateAchat, refDate = new Date()) {
  return moisEcoules(dateAchat, refDate) / 12
}

/**
 * Taux annuel d'amortissement linéaire (%).
 * @param {number} duree – durée en mois
 * Ex : 36 mois → 100 / (36/12) = 33.33 %/an
 */
export function tauxLineaire(duree) {
  if (!duree || duree <= 0) return 0
  return parseFloat((100 / (duree / 12)).toFixed(2))
}

/**
 * Annuité d'amortissement annuelle.
 * @param {number} valeurAchat
 * @param {number} duree – en mois
 */
export function annuiteLineaire(valeurAchat, duree) {
  if (!valeurAchat || !duree || duree <= 0) return 0
  return Math.round(valeurAchat / (duree / 12))
}

/**
 * Valeur Nette Comptable (VNC) — sur PRIMITIVES catalogue uniquement.
 *  Non utilisée par aucun composant depuis l'Étape 0 (point 1.2) : la page
 * Amortissement et le registre Actifs utilisent désormais calcVNCActif()
 * (lib/actifs.js), qui opère sur l'objet actif complet et respecte sa
 * valeur_residuelle propre. Conservée ici pour compatibilité éventuelle,
 * mais ne pas la re-brancher sur un composant sans re-vérifier ce choix.
 * @param {number} valeurAchat
 * @param {string} dateAchat
 * @param {number} duree – en mois
 * @param {Date}   refDate
 */
export function calcVNC(valeurAchat, dateAchat, duree, refDate = new Date()) {
  if (!valeurAchat || !dateAchat || !duree || duree <= 0 || valeurAchat <= 0) return 0
  const mois = moisEcoules(dateAchat, refDate)
  if (mois >= duree) return 0
  return Math.max(0, Math.round(valeurAchat * (1 - mois / duree)))
}

/**
 * Pourcentage d'amortissement écoulé (0 → 100).
 */
export function amortPct(valeurAchat, dateAchat, duree, refDate = new Date()) {
  if (!valeurAchat || !dateAchat || !duree || valeurAchat <= 0) return 0
  const vnc = calcVNC(valeurAchat, dateAchat, duree, refDate)
  return Math.min(100, Math.round(((valeurAchat - vnc) / valeurAchat) * 100))
}

/**
 * Statut textuel selon le pourcentage d'amortissement.
 */
export function amortStatus(pct) {
  if (pct >= 100) return 'Amorti'
  if (pct >= 75)  return 'Critique'
  if (pct >= 50)  return 'Avancé'
  return 'Normal'
}

/**
 * Couleur CSS selon l'état d'amortissement.
 */
export function amortColor(pct) {
  if (pct >= 100) return 'var(--red)'
  if (pct >= 75)  return 'var(--amber)'
  if (pct >= 50)  return 'var(--indigo)'
  return 'var(--green)'
}

/**
 * Tableau d'amortissement annuel.
 * @param {number} valeurAchat
 * @param {string} dateAchat
 * @param {number} duree – en mois
 * @returns {{ annee, annuite, amortCumul, vnc }[]}
 */
export function tableauAmort(valeurAchat, dateAchat, duree) {
  if (!valeurAchat || !dateAchat || !duree || duree <= 0) return []
  const nbAnnees    = Math.ceil(duree / 12)
  const annuiteAnn  = annuiteLineaire(valeurAchat, duree)
  const rows        = []
  let cumul         = 0
  for (let i = 1; i <= nbAnnees; i++) {
    const ann = Math.min(annuiteAnn, valeurAchat - cumul)
    cumul += ann
    rows.push({
      annee:      i,
      annuite:    ann,
      amortCumul: Math.min(cumul, valeurAchat),
      vnc:        Math.max(0, valeurAchat - cumul),
    })
  }
  return rows
}

/**
 * Calcul complet pour un produit — entrée principale des composants.
 * @param {Object} produit – { valeur_achat, date_achat, duree_amortissement }
 * @param {Date}   refDate
 */
export function calcAmortComplet(produit, refDate = new Date()) {
  const { valeur_achat, date_achat, duree_amortissement } = produit ?? {}

  if (!valeur_achat || !date_achat || !duree_amortissement) {
    return {
      taux:     0,
      annuite:  0,
      vnc:      0,
      pct:      0,
      status:   '—',
      color:    'var(--text3)',
      amorti:   false,
      eligible: false,
    }
  }

  const pct = amortPct(valeur_achat, date_achat, duree_amortissement, refDate)
  const vnc = calcVNC(valeur_achat, date_achat, duree_amortissement, refDate)

  return {
    taux:     tauxLineaire(duree_amortissement),
    annuite:  annuiteLineaire(valeur_achat, duree_amortissement),
    vnc,
    pct,
    status:   amortStatus(pct),
    color:    amortColor(pct),
    amorti:   pct >= 100,
    eligible: true,
  }
}