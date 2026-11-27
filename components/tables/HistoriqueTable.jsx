'use client'
import { IconHistory, IconDownload, IconPencil } from '@tabler/icons-react'
import { useDataStore }    from '@/store/dataStore'
import { useUiStore }      from '@/store/uiStore'
import { useAuthStore }    from '@/store/authStore'
import { usePermissions }  from '@/hooks/usePermissions'
import { useDateFilter }   from '@/hooks/useDateFilter'
import { useInlineFilter } from '@/hooks/useInlineFilter'
import { fmtDTSplit, fmtDT } from '@/lib/helpers'
import { canEditMvt }      from '@/lib/permissions'
import { exportToCSV, todayFileDate } from '@/lib/csv'
import { highlight }       from '@/hooks/useSearch'
import Button              from '@/components/ui/Button'
import DeptTag   from '@/components/ui/badges/DeptTag'
import TypeBadge from '@/components/ui/badges/TypeBadge'
import StatBadge from '@/components/ui/badges/StatBadge'
import InlineSearchBar from '@/components/search/InlineSearchBar'

export default function HistoriqueTable() {
  const mouvements = useDataStore(s => s.mouvements)
  const demandes   = useDataStore(s => s.demandes)
  const perm = usePermissions()
  const user = useAuthStore(s => s.user)
  const profile = useAuthStore(s => s.profile)
  const { openModal } = useUiStore()
  const { filterByDate, hasFilter } = useDateFilter()
  const { filterState, setFilterState, applyFilters } = useInlineFilter('historique')

  const allItems = [
    ...mouvements.map(m => ({
      id: m.id, dept: m.dept, src: 'Mouvement', label: m.type, mvt: m,
      produit: m.produit_nom, actifId: m.actif_id || null, qty: m.qty,
      lieu: m.emplacement || m.destination, dest: m.destination,
      actor: m.user_name, detail: m.observation,
      created_at: m.created_at || m.date,
    })),
    ...demandes.map(d => ({
      id: d.id, dept: d.dept, src: 'Demande', label: d.statut,
      produit: d.produit, qty: d.qty,
      lieu: d.dest, dest: d.dest,
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

  // Règle métier (js/export.js exportHistoriqueCSV) : export de la liste
  // consolidée affichée — mouvements + demandes filtrés (dépts visibles RBAC,
  // période de dates, query inline) et triés par date décroissante. La cellule
  // « Emplacement / Destination » rejoint lieu = emplacement || destination.
  const handleExport = () => {
    const headers = [
      'Date & Heure', 'Département', 'Catégorie', 'Type / Statut',
      'Produit', 'Quantité', 'Emplacement / Destination', 'Acteur', 'Détail',
    ]
    const rows = filtered.map(h => [
      fmtDT(h.created_at),
      h.dept,
      h.src,
      h.label,
      h.produit || '',
      h.qty || '',
      h.lieu || '',
      h.actor,
      h.detail || '',
    ])
    exportToCSV(rows, headers, `historique_${todayFileDate()}.csv`)
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button variant="outline" icon={IconDownload} onClick={handleExport}>CSV</Button>
      </div>

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
                <th>Produit</th><th>Qté</th><th>Empl./Dest.</th><th>Acteur</th><th>Détail</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10}>
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
                      {h.actifId && (
                        <code className="actif-id" style={{ marginTop: 2, display: 'inline-block' }}>
                          <span dangerouslySetInnerHTML={highlight(h.actifId, q)} />
                        </code>
                      )}
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
                    <td style={{ textAlign: 'right' }}>
                      {h.src === 'Mouvement' && canEditMvt(h.mvt, user, profile, perm) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Corriger le mouvement"
                          aria-label="Corriger le mouvement"
                          onClick={() => openModal('edit-mvt', { mv: h.mvt })}
                        >
                          <IconPencil size={14} />
                        </Button>
                      )}
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