// TODO: Phase 1 — fmt, fmtDT, fmtDTSplit, fmtDate, fmtTime, genId, inRange
// ═══════════════════════════════════════════════════════
//  Connecteo Stock — Helpers utilitaires
// ═══════════════════════════════════════════════════════

// ── Identifiants ─────────────────────────────────────────────

// FIX (parité vanilla) : genId() générait un UUID v4 générique, sans préfixe
// département. Or generateNomenclature() côté module Actifs (Étape E) construit
// CNTO-{produit_id}-{YY}-{SEQ} directement à partir du produit_id — un UUID à la
// place d'un ID préfixé (IT-…/FIN-…) casse silencieusement la nomenclature.
// Repris à l'identique du vanilla (js/utils.js) : compteur incrémental interne +
// suffixe aléatoire pour garantir l'unicité même en cas d'appels synchrones
// multiples dans la même milliseconde (ex: sortie multi-actifs en boucle .map()).
// Comportement de collision par milliseconde intentionnellement préservé
// (cf. mémoire "Millisecond collision in genId" — non un bug à corriger).
let _genIdSeq = 0
export function genId(prefix = 'ID') {
  _genIdSeq = (_genIdSeq + 1) % 1296 // wrap sur 2 caractères base36
  const seq  = _genIdSeq.toString(36).toUpperCase().padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${seq}${rand}`
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

// ── CUMP (Coût Unitaire Moyen Pondéré) ────────────────────────
/**
 * CUMP = valeur cumulée des entrées / quantité cumulée des entrées.
 * Base de valorisation des sorties et du stock pour les produits NON
 * amortissables — remplace tout usage du champ catalogue "prix", devenu
 * un vestige jamais mis à jour par les mouvements réels.
 */
export function getCUMPProduit(produitId, mouvementsEntrees) {
  const entrees  = (mouvementsEntrees || []).filter(m => m.produit_id === produitId)
  const totalQty = entrees.reduce((s, m) => s + (m.qty || 0), 0)
  const totalVal = entrees.reduce((s, m) => s + (m.valeur || 0), 0)
  if (totalQty <= 0) return 0
  return totalVal / totalQty
}

/**
 * Valeur du stock actuel = stock présent × CUMP — uniquement pour les
 * produits NON amortissables. Un produit amortissable renvoie 0 ici : sa
 * valorisation (VNC) vit exclusivement dans le module Actifs individuels
 * (Étape E), jamais mélangée à la valeur de stock catalogue.
 */
export function getValeurStockActuel(produit, mouvementsEntrees) {
  if (!produit || produit.is_amortissable) return 0
  return (produit.stock || 0) * getCUMPProduit(produit.id, mouvementsEntrees)
}