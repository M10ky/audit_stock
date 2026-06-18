'use client'
import { IconHistory } from '@tabler/icons-react'
import { useDataStore }    from '@/store/dataStore'
import { usePermissions }  from '@/hooks/usePermissions'
import { useDateFilter }   from '@/hooks/useDateFilter'
import { useInlineFilter } from '@/hooks/useInlineFilter'
import { fmtDTSplit }      from '@/lib/helpers'
import { highlight }       from '@/hooks/useSearch'
import DeptTag   from '@/components/ui/badges/DeptTag'
import TypeBadge from '@/components/ui/badges/TypeBadge'
import StatBadge from '@/components/ui/badges/StatBadge'
import InlineSearchBar from '@/components/search/InlineSearchBar'

export default function HistoriqueTable() {
  const mouvements = useDataStore(s => s.mouvements)
  const demandes   = useDataStore(s => s.demandes)
  const perm = usePermissions()
  const { filterByDate, hasFilter } = useDateFilter()
  const { filterState, setFilterState, applyFilters } = useInlineFilter('historique')

  const allItems = [
    ...mouvements.map(m => ({
      id: m.id, dept: m.dept, src: 'Mouvement', label: m.type,
      produit: m.produit_nom, qty: m.qty,
      lieu: m.emplacement || m.destination,
      actor: m.user_name, detail: m.observation,
      created_at: m.created_at || m.date,
    })),
    ...demandes.map(d => ({
      id: d.id, dept: d.dept, src: 'Demande', label: d.statut,
      produit: d.produit, qty: d.qty,
      lieu: d.dest,
      actor: d.demandeur, detail: d.motif,
      created_at: d.created_at || d.date,
    })),
  ]
    .filter(h => perm.canSeeIT  || h.dept !== 'IT')
    .filter(h => perm.canSeeFin || h.dept !== 'Finance')
    .filter(h => filterByDate(h.created_at))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const filtered = applyFilters(allItems, 'historique')
  const q        = filterState.query

  return (
    <>
      <InlineSearchBar
        state={filterState}
        onChange={setFilterState}
        options={{}}
        count={allItems.length}
        filteredCount={filtered.length}
        placeholder="Rechercher dans l'historique (produit, acteur, détail, destination…)"
      />

      <div className="card">
        <div className="card-header">
          <div className="card-header-title">
            <IconHistory size={16} />
            {filtered.length} / {allItems.length} opération{filtered.length > 1 ? 's' : ''}
            {hasFilter && (
              <span className="text-muted" style={{ fontSize: 11, marginLeft: 6 }}>
                (période filtrée)
              </span>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date & Heure</th><th>Dépt</th><th>Catégorie</th><th>Type/Statut</th>
                <th>Produit</th><th>Qté</th><th>Empl./Dest.</th><th>Acteur</th><th>Détail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <p>Aucune opération{hasFilter ? ' sur la période' : ''} ne correspond</p>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((h, i) => {
                const { date, time } = fmtDTSplit(h.created_at)
                return (
                  <tr key={`${h.src}-${h.id}-${i}`}>
                    <td className="col-date">
                      <div className="dt-date">{date}</div>
                      <div className="dt-time">{time}</div>
                    </td>
                    <td><DeptTag dept={h.dept} /></td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: h.src === 'Mouvement' ? 'var(--indigo-l)' : '#ede9fe',
                          color:      h.src === 'Mouvement' ? 'var(--indigo)'   : '#7c3aed',
                        }}
                      >
                        {h.src}
                      </span>
                    </td>
                    <td>
                      {h.src === 'Mouvement'
                        ? <TypeBadge type={h.label} />
                        : <StatBadge statut={h.label} />}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      <span dangerouslySetInnerHTML={highlight(h.produit || '', q)} />
                    </td>
                    <td style={{ fontWeight: 700 }}>{h.qty}</td>
                    <td className="text-muted">
                      <span dangerouslySetInnerHTML={highlight(h.lieu || '—', q)} />
                    </td>
                    <td className="text-muted">
                      <span dangerouslySetInnerHTML={highlight(h.actor, q)} />
                    </td>
                    <td className="text-muted" style={{ maxWidth: 140, fontSize: 12 }}>
                      <span dangerouslySetInnerHTML={highlight((h.detail || '').slice(0, 60), q)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}