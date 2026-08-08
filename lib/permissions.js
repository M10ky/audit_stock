// TODO: Phase 1 — isAdmin, isSupportIT, canSeeIT, canManIT, canSeePrix…
// ═══════════════════════════════════════════════════════
//  Connecteo Stock — RBAC Permissions
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

// ── Rôles de base ─────────────────────────────────────────────

export function isAdmin(profile) {
  return profile?.role === ROLES.ADMIN
}

export function isSupportIT(profile) {
  return profile?.role === ROLES.SUP_IT
}

export function isResFin(profile) {
  return profile?.role === ROLES.RES_FIN
}

export function isUserIT(profile) {
  return profile?.role === ROLES.USER_IT
}

export function isUserFin(profile) {
  return profile?.role === ROLES.USER_FIN
}

export function isLecteur(profile) {
  return profile?.role === ROLES.LECTEUR
}

/**
 * Manager = Admin | Support IT | Responsable Finance
 * Mirrors la fonction SQL is_manager()
 */
export function isManager(profile) {
  return [ROLES.ADMIN, ROLES.SUP_IT, ROLES.RES_FIN].includes(profile?.role)
}

// ── Visibilité département ────────────────────────────────────

export function canSeeIT(profile) {
  return profile?.dept === 'IT' || profile?.dept === 'both' || isLecteur(profile)
}

export function canSeeFin(profile) {
  return profile?.dept === 'Finance' || profile?.dept === 'both' || isLecteur(profile)
}

// ── Gestion (écriture stock / mouvements) ─────────────────────
// Mirrors can_write_dept() SQL

export function canManIT(profile) {
  return isAdmin(profile) || isSupportIT(profile)
}

export function canManFin(profile) {
  return isAdmin(profile) || isResFin(profile)
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
  }
}