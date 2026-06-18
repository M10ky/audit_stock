'use client'
import { useDataStore } from '@/store/dataStore'
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
  const perm = usePermissions()

  const runSearch = (query, filter = 'all') => {
    const q = (query || '').trim()
    if (!q && filter === 'all') {
      return { produits: [], mouvements: [], demandes: [], total: 0 }
    }

    let resProduits = [], resMouvements = [], resDemandes = []

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

    const total = resProduits.length + resMouvements.length + resDemandes.length
    return { produits: resProduits, mouvements: resMouvements, demandes: resDemandes, total }
  }

  return { runSearch }
}