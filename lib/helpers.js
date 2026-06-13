// TODO: Phase 1 — fmt, fmtDT, fmtDTSplit, fmtDate, fmtTime, genId, inRange
// ═══════════════════════════════════════════════════════
//  Connecteo Stock — Helpers utilitaires
// ═══════════════════════════════════════════════════════

// ── Identifiants ─────────────────────────────────────────────

/**
 * Génère un UUIDv4 (utilisé pour les IDs de lignes Supabase)
 */
export function genId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ── Formatage dates ───────────────────────────────────────────

/**
 * "DD/MM/YYYY"
 */
export function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt)) return '—'
  return dt.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * "HH:MM"
 */
export function fmtTime(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  return dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * "DD/MM/YYYY HH:MM"
 */
export function fmtDT(d) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt)) return '—'
  return dt.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Retourne { date: "DD/MM/YYYY", time: "HH:MM:SS" }
 * Pour affichage sur 2 lignes dans les tableaux (avec secondes)
 */
export function fmtDTSplit(d) {
  if (!d) return { date: '—', time: '' }
  const dt = new Date(d)
  if (isNaN(dt)) return { date: '—', time: '' }
  return {
    date: dt.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    time: dt.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  }
}

/**
 * Date au format input type="date" → "YYYY-MM-DD"
 */
export function toInputDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  return dt.toISOString().split('T')[0]
}

// ── Formatage nombres / montants ──────────────────────────────

/**
 * Nombre avec séparateur milliers français → "1 234"
 */
export function fmt(n) {
  if (n == null || n === '' || isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('fr-FR')
}

/**
 * Montant en Ariary → "1 234 Ar"
 */
export function fmtAr(n) {
  if (n == null || n === '' || isNaN(Number(n))) return '—'
  return `${Number(n).toLocaleString('fr-FR')} Ar`
}

/**
 * Pourcentage → "42%"
 */
export function fmtPct(n) {
  if (n == null || isNaN(Number(n))) return '—'
  return `${Math.round(Number(n))}%`
}

// ── Filtres ───────────────────────────────────────────────────

/**
 * Vérifie si une date est dans l'intervalle [from, to].
 * Si from/to absent → pas de filtre de ce côté.
 */
export function inRange(dateStr, from, to) {
  if (!dateStr) return true
  const d = new Date(dateStr)
  if (isNaN(d)) return true
  if (from) {
    const f = new Date(from)
    if (d < f) return false
  }
  if (to) {
    const t = new Date(to)
    t.setHours(23, 59, 59, 999)
    if (d > t) return false
  }
  return true
}

/**
 * Filtre texte insensible à la casse et aux accents
 */
export function matchSearch(str, query) {
  if (!query) return true
  if (!str) return false
  const normalize = (s) =>
    s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return normalize(str).includes(normalize(query))
}

// ── Divers ────────────────────────────────────────────────────

/**
 * Tronque un texte à maxLen caractères
 */
export function truncate(str, maxLen = 35) {
  if (!str) return ''
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str
}

/**
 * Capitalise la première lettre d'une chaîne
 */
export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Retourne 'text' (string vide ou null) → valeur par défaut
 */
export function orDash(val, fallback = '—') {
  if (val == null || val === '') return fallback
  return val
}

/**
 * Classe CSS conditionnelle (utilitaire simple sans clsx)
 */
export function cx(...args) {
  return args.filter(Boolean).join(' ')
}