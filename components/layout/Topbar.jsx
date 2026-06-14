'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { IconSearch, IconMenu2, IconX } from '@tabler/icons-react'
import { useUiStore } from '@/store/uiStore'

// Mapping route → titre
const TITLES = {
  '/dashboard':      'Tableau de bord',
  '/stock/it':       'Stock — Informatique',
  '/stock/fin':      'Stock — Finance',
  '/mouvements/it':  'Mouvements — Informatique',
  '/mouvements/fin': 'Mouvements — Finance',
  '/demandes/it':    'Demandes — Informatique',
  '/demandes/fin':   'Demandes — Finance',
  '/alertes/it':     'Alertes stock — IT',
  '/alertes/fin':    'Alertes stock — Finance',
  '/historique':     'Historique des mouvements',
  '/rapports':       'Rapports & statistiques',
  '/amortissement':  'Amortissement linéaire',
  '/utilisateurs':   'Gestion des utilisateurs',
  '/params':         'Paramètres système',
}

// Pages qui ont un filtre date utile
const DATE_FILTER_PAGES = [
  '/mouvements/it', '/mouvements/fin',
  '/demandes/it',   '/demandes/fin',
  '/historique',    '/rapports',
]

export default function Topbar() {
  const pathname = usePathname()
  const {
    openSearch, toggleSidebar,
    dateFrom, dateTo,
    setDateFrom, setDateTo, clearDateFilter,
  } = useUiStore()

  const title      = TITLES[pathname] || 'Connecteo Stock'
  const showFilter = DATE_FILTER_PAGES.includes(pathname)
  const hasFilter  = dateFrom || dateTo

  // Ctrl+K → ouvrir recherche
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openSearch])

  return (
    <header className="topbar">
      {/* Burger mobile */}
      <button className="btn btn-ghost btn-icon" onClick={toggleSidebar} title="Menu">
        <IconMenu2 size={20} />
      </button>

      <h1 className="topbar-title">{title}</h1>

      <div className="topbar-actions">
        {/* Filtre date */}
        {showFilter && (
          <div className="date-filter">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              title="Date de début"
            />
            <span className="date-filter-sep">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              title="Date de fin"
            />
            {hasFilter && (
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={clearDateFilter}
                title="Effacer le filtre"
              >
                <IconX size={14} />
              </button>
            )}
          </div>
        )}

        {/* Bouton recherche globale */}
        <button className="topbar-search-btn" onClick={openSearch}>
          <IconSearch size={14} />
          <span>Rechercher</span>
          <span className="kbd">Ctrl K</span>
        </button>
      </div>
    </header>
  )
}