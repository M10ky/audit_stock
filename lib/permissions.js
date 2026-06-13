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

/**
 * Manager = Admin | Support IT | Responsable Finance
 * Mirrors la fonction SQL is_manager()
 */
export function isManager(profile) {
  return [ROLES.ADMIN, ROLES.SUP_IT, ROLES.RES_FIN].includes(profile?.role)
}

// ── Visibilité département ────────────────────────────────────

export function canSeeIT(profile) {
  return profile?.dept === 'IT' || profile?.dept === 'both'
}

export function canSeeFin(profile) {
  return profile?.dept === 'Finance' || profile?.dept === 'both'
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
  return canSeeIT(profile)
}

export function canDemFin(profile) {
  return canSeeFin(profile)
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
  return isManager(profile)
}

// ── Historique & rapports ──────────────────────────────────────

export function canSeeHist(profile) {
  return isManager(profile)
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
  }
}