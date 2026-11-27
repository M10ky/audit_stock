// ═══════════════════════════════════════════════════════
//  ARGOS — RBAC Permissions
//
//  5 rôles :
//    Administrateur       → dept: both
//    Support IT           → dept: IT
//    Responsable Finance  → dept: Finance
//    Utilisateur IT       → dept: IT
//    Utilisateur Finance  → dept: Finance
//
//  Toutes les fonctions acceptent un objet `profile`
//  { role, dept, is_active } provenant de la table profiles.
// ═══════════════════════════════════════════════════════

export const ROLES = {
  ADMIN:    'Administrateur',
  SUP_IT:   'Support IT',
  RES_FIN:  'Responsable Finance',
  USER_IT:  'Utilisateur IT',
  USER_FIN: 'Utilisateur Finance',
  LECTEUR:  'Lecteur',
}

const ROLE_ALIASES = {
  Admin: ROLES.ADMIN,
  Administrateur: ROLES.ADMIN,
  'Support IT': ROLES.SUP_IT,
  'Resp Finance': ROLES.RES_FIN,
  'Responsable Finance': ROLES.RES_FIN,
  'Util IT': ROLES.USER_IT,
  'Utilisateur IT': ROLES.USER_IT,
  'Util Finance': ROLES.USER_FIN,
  'Utilisateur Finance': ROLES.USER_FIN,
  Lecteur: ROLES.LECTEUR,
}

export function normalizeRole(profile) {
  return ROLE_ALIASES[profile?.role] || profile?.role
}

export function getLandingPath(profile) {
  const role = normalizeRole(profile)
  if (role === ROLES.SUP_IT) return '/stock/IT'
  if (role === ROLES.RES_FIN) return '/stock/Finance'
  if (role === ROLES.USER_IT) return '/demandes/IT'
  if (role === ROLES.USER_FIN) return '/demandes/Finance'
  return '/dashboard'
}

// ── Rôles de base ─────────────────────────────────────────────

export function isAdmin(profile) {
  return normalizeRole(profile) === ROLES.ADMIN
}

export function isSupportIT(profile) {
  return normalizeRole(profile) === ROLES.SUP_IT
}

export function isResFin(profile) {
  return normalizeRole(profile) === ROLES.RES_FIN
}

export function isUserIT(profile) {
  return normalizeRole(profile) === ROLES.USER_IT
}

export function isUserFin(profile) {
  return normalizeRole(profile) === ROLES.USER_FIN
}

export function isLecteur(profile) {
  return normalizeRole(profile) === ROLES.LECTEUR
}

/**
 * Manager = Admin | Support IT | Responsable Finance
 * Mirrors la fonction SQL is_manager()
 */
export function isManager(profile) {
  return [ROLES.ADMIN, ROLES.SUP_IT, ROLES.RES_FIN].includes(normalizeRole(profile))
}

// ── Visibilité département ────────────────────────────────────

export function canSeeIT(profile) {
  return [ROLES.ADMIN, ROLES.SUP_IT, ROLES.USER_IT, ROLES.LECTEUR].includes(normalizeRole(profile))
}

export function canSeeFin(profile) {
  return [ROLES.ADMIN, ROLES.RES_FIN, ROLES.USER_FIN, ROLES.LECTEUR].includes(normalizeRole(profile))
}

// ── Gestion (écriture stock / mouvements) ─────────────────────
// Mirrors can_write_dept() SQL

export function canManIT(profile) {
  return isAdmin(profile) || isSupportIT(profile)
}

export function canManFin(profile) {
  return isAdmin(profile) || isResFin(profile)
}

// Règle métier v1 (js/stock.js) : correction prix/valeur par l'auteur ou Admin —
// qty/produit/type intouchables. L'auteur doit avoir le droit de gestion du dept.
export function canEditMvt(m, user, profile, perm) {
  if (!m) return false
  const p = perm || getPermissions(profile)
  if (isAdmin(profile) || p.isAdmin) return true
  const isAuthor = (!!user?.id && !!m.user_id && user.id === m.user_id)
    || (!!profile?.name && !!m.user_name && profile.name === m.user_name)
  if (!isAuthor) return false
  if (m.dept === 'IT') return !!p.canManIT
  if (m.dept === 'Finance') return !!p.canManFin
  return true
}

// ── Demandes ──────────────────────────────────────────────────

export function canDemIT(profile) {
  return !isLecteur(profile) && canSeeIT(profile)
}

export function canDemFin(profile) {
  return !isLecteur(profile) && canSeeFin(profile)
}

// ── Validation demandes ────────────────────────────────────────

export function canValidIT(profile) {
  return canManIT(profile)
}

export function canValidFin(profile) {
  return canManFin(profile)
}

// ── Données financières ────────────────────────────────────────

export function canSeePrix(profile) {
  return isManager(profile) || isLecteur(profile)
}

// ── Historique & rapports ──────────────────────────────────────

export function canSeeHist(profile) {
  return isManager(profile) || isLecteur(profile)
}

// ── Accès utilisateurs (admin uniquement) ─────────────────────

export function canManUsers(profile) {
  return isAdmin(profile)
}

// ── Accès paramètres ──────────────────────────────────────────

export function canManParams(profile) {
  return isAdmin(profile)
}

// ── Regroupement complet (pour le store / hook) ───────────────

export function getPermissions(profile) {
  return {
    // Rôles
    isAdmin:     isAdmin(profile),
    isSupportIT: isSupportIT(profile),
    isResFin:    isResFin(profile),
    isUserIT:    isUserIT(profile),
    isUserFin:   isUserFin(profile),
    isLecteur:   isLecteur(profile),
    isManager:   isManager(profile),
    // Vues
    canSeeIT:    canSeeIT(profile),
    canSeeFin:   canSeeFin(profile),
    // Écriture
    canManIT:    canManIT(profile),
    canManFin:   canManFin(profile),
    // Demandes
    canDemIT:    canDemIT(profile),
    canDemFin:   canDemFin(profile),
    canValidIT:  canValidIT(profile),
    canValidFin: canValidFin(profile),
    // Financier
    canSeePrix:  canSeePrix(profile),
    canSeeHist:  canSeeHist(profile),
    // Admin
    canManUsers:  canManUsers(profile),
    canManParams: canManParams(profile),
    // Actifs / Prêts — lecture seule incluant le Lecteur (mirrors canManX() || isLecteur() du Vanilla)
    // Préparé ici pour être consommé tel quel par les Étapes E/F (modules Actifs/Prêts).
    canSeeActifsIT:  canManIT(profile)  || isLecteur(profile),
    canSeeActifsFin: canManFin(profile) || isLecteur(profile),
    canSeePretsIT:   canManIT(profile)  || isLecteur(profile),
    canSeePretsFin:  canManFin(profile) || isLecteur(profile),
    // Miroir canSeeActifsRapports() du Vanilla : IT/Fin + gestion ou Lecteur.
    canSeeActifsRapports:
      (canSeeIT(profile) && (canManIT(profile) || isLecteur(profile))) ||
      (canSeeFin(profile) && (canManFin(profile) || isLecteur(profile))),
  }
}