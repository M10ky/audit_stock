'use client'
import { useState, useEffect } from 'react'
import { useUiStore } from '@/store/uiStore'
import { matchesQuery } from '@/hooks/useSearch'
import { getActifNumero } from '@/store/pretsStore'

function getStockStatut(p) {
  if (p.stock === 0)      return 'Rupture'
  if (p.stock <= p.seuil) return 'Critique'
  return 'Disponible'
}

const EMPTY = { query: '', cat: '', statut: '', type: '', urgence: '', statDem: '' }

export function useInlineFilter(pageKey) {
  const inlineQuery    = useUiStore(s => s.inlineSearch[pageKey] ?? '')
  const clearInlineQuery = useUiStore(s => s.clearInlineQuery)

  const [filterState, setFilterState] = useState({ ...EMPTY })

  // Reçoit une query depuis SearchOverlay (navigation Ctrl+K → page)
  useEffect(() => {
    if (inlineQuery) {
      setFilterState(s => ({ ...s, query: inlineQuery }))
      clearInlineQuery(pageKey)
    }
  }, [inlineQuery]) // eslint-disable-line

  const applyFilters = (items, type = 'produit') => {
    const { query, cat, statut, type: mvtType, urgence, statDem } = filterState
    const q = (query || '').trim()

    return items.filter(item => {
      switch (type) {
        case 'produit':
          if (q && !matchesQuery([item.nom, item.categorie, item.id, item.emplacement], q))
            return false
          if (cat    && item.categorie !== cat)              return false
          if (statut && getStockStatut(item) !== statut)     return false
          break
        case 'mouvement':
          if (q && !matchesQuery([
            item.produit_nom, item.user_name, item.destination,
            item.fournisseur, item.ref_document, item.emplacement, item.id,
          ], q)) return false
          if (mvtType && item.type !== mvtType) return false
          break
        case 'demande':
          if (q && !matchesQuery([item.produit, item.demandeur, item.motif, item.dest, item.id], q))
            return false
          if (urgence && item.urgence !== urgence)   return false
          if (statDem && item.statut  !== statDem)   return false
          break
        case 'historique':
          if (q && !matchesQuery([item.produit, item.actor, item.detail, item.lieu, item.id], q))
            return false
          break
        case 'actif':
          // Mirrors ActifsTable : mêmes champs que le filtre local d'origine.
          if (q && !matchesQuery([item.id, item.produit_nom, item.categorie, item.emplacement, item.statut, item.mouvement_entree_id], q))
            return false
          break
        case 'pret':
          // Mirrors PretsTable : mêmes champs que le filtre local d'origine.
          if (q && !matchesQuery([getActifNumero(item), item.emprunteur, item.produit_nom, item.motif, item.notes, item.statut, item.id], q))
            return false
          break
        default:
          break
      }
      return true
    })
  }

  const hasFilters = Object.values(filterState).some(Boolean)

  return { filterState, setFilterState, applyFilters, hasFilters }
}