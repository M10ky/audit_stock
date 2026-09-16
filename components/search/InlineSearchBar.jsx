'use client'
import { IconSearch, IconX } from '@tabler/icons-react'

/**
 * Barre de recherche inline réutilisable pour les tables.
 *
 * Props:
 *   state     : { query, cat, statut, type, urgence, statDem, actif }
 *   onChange  : (newState) => void
 *   options   : { showCat, cats, showStatut, showType, showUrgence, showStatDem, showActif,
 *                 showUserStat, showRoles, roles }
 *   count         : nombre total d'items
 *   filteredCount : nombre après filtres
 *   placeholder   : string
 */
export default function InlineSearchBar({
  state = {},
  onChange,
  options = {},
  count = 0,
  filteredCount = 0,
  placeholder = 'Rechercher…',
}) {
  const {
    showCat = false, cats = [],
    showStatut = false,
    showType = false,
    showUrgence = false,
    showStatDem = false,
    showActif = false,
    showUserStat = false,
    showRoles = false,
    roles = [],
  } = options

  const set = (key, val) => {
    const newVal = state[key] === val ? '' : val
    onChange?.({ ...state, [key]: newVal })
  }

  const reset = () => onChange?.({ query: '', cat: '', statut: '', type: '', urgence: '', statDem: '', actif: '', role: '', statutUser: '' })

  const hasFilters = !!(state.query || state.cat || state.statut || state.type || state.urgence || state.statDem || state.actif || state.role || state.statutUser)

  const Pill = ({ label, stateKey, val, cls }) => (
    <button
      className={`ifb-pill${state[stateKey] === val ? (' on' + (cls ? '-' + cls : '')) : ''}`}
      onClick={() => set(stateKey, val)}
      type="button"
    >
      {label}
    </button>
  )

  return (
    <div className="inline-filter-bar">
      {/* Input */}
      <div className="ifb-input-wrap">
        <IconSearch size={15} style={{ color: 'var(--text3)', flexShrink: 0 }} />
        <input
          className="ifb-input"
          type="text"
          placeholder={placeholder}
          value={state.query || ''}
          onChange={e => onChange?.({ ...state, query: e.target.value })}
          onKeyDown={e => { if (e.key === 'Escape') onChange?.({ ...state, query: '' }) }}
          autoComplete="off"
        />
        {state.query && (
          <button
            onClick={() => onChange?.({ ...state, query: '' })}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '0 2px' }}
          >
            <IconX size={13} />
          </button>
        )}
      </div>

      {/* Séparateur */}
      {(showCat || showStatut || showType || showUrgence || showStatDem || showActif || showUserStat || showRoles) && (
        <div className="ifb-sep" />
      )}

      {/* Filtres catégorie */}
      {showCat && cats.length > 0 && (
        <div className="ifb-filters">
          <span className="ifb-label">Catég.</span>
          {cats.map(c => (
            <Pill key={c} label={c} stateKey="cat" val={c} />
          ))}
        </div>
      )}

      {/* Filtre statut stock */}
      {showStatut && (
        <>
          {showCat && cats.length > 0 && <div className="ifb-sep" />}
          <div className="ifb-filters">
            <span className="ifb-label">Stock</span>
            <Pill label="Dispo"    stateKey="statut" val="Disponible" />
            <Pill label="Critique" stateKey="statut" val="Critique"   cls="amber" />
            <Pill label="Rupture"  stateKey="statut" val="Rupture"    cls="red" />
          </div>
        </>
      )}

      {/* Filtre type mouvement */}
      {showType && (
        <>
          <div className="ifb-sep" />
          <div className="ifb-filters">
            <span className="ifb-label">Type</span>
            <Pill label="↓ Entrée" stateKey="type" val="Entrée" />
            <Pill label="↑ Sortie" stateKey="type" val="Sortie" cls="red" />
          </div>
        </>
      )}

      {/* Filtre urgence */}
      {showUrgence && (
        <>
          <div className="ifb-sep" />
          <div className="ifb-filters">
            <span className="ifb-label">Urgence</span>
            <Pill label="Normale"  stateKey="urgence" val="Normale" />
            <Pill label="Urgente"  stateKey="urgence" val="Urgente"  cls="amber" />
            <Pill label="Critique" stateKey="urgence" val="Critique" cls="red" />
          </div>
        </>
      )}

      {/* Filtre statut demande */}
      {showStatDem && (
        <>
          <div className="ifb-sep" />
          <div className="ifb-filters">
            <span className="ifb-label">Statut</span>
            <Pill label="En attente" stateKey="statDem" val="En attente" cls="amber" />
            <Pill label="Validé"     stateKey="statDem" val="Validé" />
            <Pill label="Refusé"     stateKey="statDem" val="Refusé" cls="red" />
          </div>
        </>
      )}

      {/* Filtre statut produit (actif/inactif) — mirrors js/stock.js showActif:
          pill 'true' = Actifs seuls, pill 'false' = Inactifs seuls (vidée au re-click). */}
      {showActif && (
        <>
          <div className="ifb-sep" />
          <div className="ifb-filters">
            <span className="ifb-label">Status</span>
            <Pill label="Actifs"   stateKey="actif" val="true" />
            <Pill label="Inactifs" stateKey="actif" val="false" cls="red" />
          </div>
        </>
      )}

      {/* Filtre statut compte (utilisateurs) — mirrors js/settings.js renderUtilisateurs() :
          pills Actifs/Inactifs gérées via la clé 'statutUser'. */}
      {showUserStat && (
        <>
          <div className="ifb-sep" />
          <div className="ifb-filters">
            <span className="ifb-label">Statut</span>
            <Pill label="● Actifs"   stateKey="statutUser" val="actif" />
            <Pill label="○ Inactifs" stateKey="statutUser" val="inactif" cls="gray" />
          </div>
        </>
      )}

      {/* Filtre rôle (utilisateurs) — mêmes pills colorées que le Vanilla :
          le rôle actif prend la couleur qui lui est propre à la sélection. */}
      {showRoles && (
        <>
          <div className="ifb-sep" />
          <div className="ifb-filters" style={{ flexWrap: 'wrap' }}>
            <span className="ifb-label">Rôle</span>
            {roles.map(r => {
              const on = state.role === r.value
              return (
                <button
                  key={r.value}
                  type="button"
                  className={`ifb-pill${on ? ' on' : ''}`}
                  style={on && r.color ? { background: r.color, borderColor: r.color, color: '#fff' } : undefined}
                  onClick={() => set('role', r.value)}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Compteur */}
      <span className="ifb-count">
        {filteredCount} / {count} résultat{filteredCount !== 1 ? 's' : ''}
      </span>

      {/* Reset */}
      {hasFilters && (
        <button className="ifb-reset" onClick={reset} type="button">
          <IconX size={11} /> Réinitialiser
        </button>
      )}
    </div>
  )
}