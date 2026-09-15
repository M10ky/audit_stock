'use client'
import { useDataStore } from '@/store/dataStore'
import { useActifsStore } from '@/store/actifsStore'
import { usePretsStore, getActifNumero } from '@/store/pretsStore'
import { usePermissions } from '@/hooks/usePermissions'

export function matchesQuery(fields, query) {
  if (!query) return true
  const q = query.toLowerCase().trim()
  return fields.some(f => f && String(f).toLowerCase().includes(q))
}

export function highlight(text, query) {
  if (!query || !text) return { __html: String(text || '') }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const html = String(text).replace(
    new RegExp(`(${escaped})`, 'gi'),
    '<mark class="hl">$1</mark>'
  )
  return { __html: html }
}

export function useSearch() {
  const produits   = useDataStore(s => s.produits)
  const mouvements = useDataStore(s => s.mouvements)
  const demandes   = useDataStore(s => s.demandes)
  const actifs     = useActifsStore(s => s.actifs)
  const prets      = usePretsStore(s => s.prets)
  const perm = usePermissions()

  const runSearch = (query, filter = 'all') => {
    const q = (query || '').trim()
    if (!q && filter === 'all') {
      return { produits: [], mouvements: [], demandes: [], actifs: [], prets: [], total: 0 }
    }

    let resProduits = [], resMouvements = [], resDemandes = [], resActifs = [], resPrets = []

    if (['all', 'produits', 'it', 'fin'].includes(filter)) {
      resProduits = produits.filter(p => {
        if (filter === 'it'  && p.dept !== 'IT')      return false
        if (filter === 'fin' && p.dept !== 'Finance')  return false
        if (!perm.canSeeIT  && p.dept === 'IT')        return false
        if (!perm.canSeeFin && p.dept === 'Finance')   return false
        return matchesQuery([p.nom, p.categorie, p.id, p.emplacement], q)
      })
    }

    if (['all', 'mouvements', 'it', 'fin'].includes(filter)) {
      resMouvements = mouvements.filter(m => {
        if (filter === 'it'  && m.dept !== 'IT')      return false
        if (filter === 'fin' && m.dept !== 'Finance')  return false
        if (!perm.canSeeIT  && m.dept === 'IT')        return false
        if (!perm.canSeeFin && m.dept === 'Finance')   return false
        return matchesQuery(
          [m.produit_nom, m.user_name, m.destination, m.fournisseur, m.ref_document, m.type, m.id],
          q
        )
      })
    }

    if (['all', 'demandes', 'it', 'fin'].includes(filter)) {
      resDemandes = demandes.filter(d => {
        if (filter === 'it'  && d.dept !== 'IT')      return false
        if (filter === 'fin' && d.dept !== 'Finance')  return false
        if (!perm.canSeeIT  && d.dept === 'IT')        return false
        if (!perm.canSeeFin && d.dept === 'Finance')   return false
        return matchesQuery([d.produit, d.demandeur, d.motif, d.dest, d.statut, d.id], q)
      })
    }

    // Mirrors js/app.js runSearch() : section Actifs individuels — gardée par
    // canManIT/canManFin (gestion du parc, pas simple visibilité), pas canSee.
    if (['all', 'actifs', 'it', 'fin'].includes(filter)) {
      resActifs = actifs.filter(a => {
        if (filter === 'it'  && a.dept !== 'IT')      return false
        if (filter === 'fin' && a.dept !== 'Finance')  return false
        if (a.dept === 'IT'      && !perm.canManIT)  return false
        if (a.dept === 'Finance' && !perm.canManFin) return false
        return matchesQuery([a.id, a.produit_nom, a.categorie, a.emplacement, a.statut], q)
      })
    }

    // Mirrors js/app.js runSearch() : section Prêts — mêmes règles de droit.
    if (['all', 'prets', 'it', 'fin'].includes(filter)) {
      resPrets = prets.filter(p => {
        if (filter === 'it'  && p.dept !== 'IT')      return false
        if (filter === 'fin' && p.dept !== 'Finance')  return false
        if (p.dept === 'IT'      && !perm.canManIT)  return false
        if (p.dept === 'Finance' && !perm.canManFin) return false
        return matchesQuery([getActifNumero(p), p.emprunteur, p.produit_nom, p.statut, p.motif, p.id], q)
      })
    }

    const total = resProduits.length + resMouvements.length + resDemandes.length + resActifs.length + resPrets.length
    return { produits: resProduits, mouvements: resMouvements, demandes: resDemandes, actifs: resActifs, prets: resPrets, total }
  }

  return { runSearch }
}