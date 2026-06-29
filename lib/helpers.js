// TODO: Phase 1 — fmt, fmtDT, fmtDTSplit, fmtDate, fmtTime, genId, inRange
// ═══════════════════════════════════════════════════════
//  Connecteo Stock — Helpers utilitaires
// ═══════════════════════════════════════════════════════

// ── Identifiants ─────────────────────────────────────────────

export function genId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ── Formatage dates ───────────────────────────────────────────

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

export function fmtTime(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  return dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

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

export function toInputDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  return dt.toISOString().split('T')[0]
}

// ── Formatage nombres / montants ──────────────────────────────

export function fmt(n) {
  if (n == null || n === '' || isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('fr-FR')
}

export function fmtAr(n) {
  if (n == null || n === '' || isNaN(Number(n))) return '—'
  return `${Number(n).toLocaleString('fr-FR')} Ar`
}

export function fmtPct(n) {
  if (n == null || isNaN(Number(n))) return '—'
  return `${Math.round(Number(n))}%`
}

// ── Filtres ───────────────────────────────────────────────────

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

export function matchSearch(str, query) {
  if (!query) return true
  if (!str) return false
  const normalize = (s) =>
    s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return normalize(str).includes(normalize(query))
}

// ── Divers ────────────────────────────────────────────────────

export function truncate(str, maxLen = 35) {
  if (!str) return ''
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str
}

export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function orDash(val, fallback = '—') {
  if (val == null || val === '') return fallback
  return val
}

export function cx(...args) {
  return args.filter(Boolean).join(' ')
}

// ── Valeur cumulée des entrées ────────────────────────────────

/**
 * Somme de la valeur de toutes les entrées historiques pour un produit.
 * @param {string} produitId
 * @param {Array}  mouvementsEntrees – depuis useDataStore(s => s.mouvementsEntrees)
 */
export function getValeurTotaleProduit(produitId, mouvementsEntrees) {
  return (mouvementsEntrees || [])
    .filter(m => m.produit_id === produitId)
    .reduce((s, m) => s + (m.valeur || 0), 0)
}