'use client'
import { useEffect } from 'react'
import { IconArrowsExchange, IconArrowDownCircle, IconArrowUpCircle } from '@tabler/icons-react'
import { useDataStore }    from '@/store/dataStore'
import { useUiStore }      from '@/store/uiStore'
import { useDateFilter }   from '@/hooks/useDateFilter'
import { useInlineFilter } from '@/hooks/useInlineFilter'
import { createClient }    from '@/lib/supabase/client'
import { fmt, fmtDTSplit } from '@/lib/helpers'
import { highlight }       from '@/hooks/useSearch'
import Button              from '@/components/ui/Button'
import TypeBadge           from '@/components/ui/badges/TypeBadge'
import InlineSearchBar     from '@/components/search/InlineSearchBar'

export default function MouvementsTable({ dept }) {
  const supabase = createClient()

  const mouvements     = useDataStore(s => s.mouvements.filter(m => m.dept === dept))
  const loadMouvements = useDataStore(s => s.loadMouvements)
  const { openModal }  = useUiStore()
  const { filterByDate, hasFilter } = useDateFilter()

  const pageKey = `mvt-${dept === 'IT' ? 'it' : 'fin'}`
  const { filterState, setFilterState, applyFilters } = useInlineFilter(pageKey)

  useEffect(() => { loadMouvements(supabase, dept) }, [dept]) // eslint-disable-line

  const dateFiltered = mouvements.filter(m => filterByDate(m.created_at || m.date))
  const filtered     = applyFilters(dateFiltered, 'mouvement')
  const totE         = filtered.filter(m => m.type === 'Entrée').reduce((s, m) => s + m.qty, 0)
  const totS         = filtered.filter(m => m.type === 'Sortie').reduce((s, m) => s + m.qty, 0)
  const q            = filterState.query

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button variant="outline" icon={IconArrowDownCircle} onClick={() => openModal('entree', { dept })}>
          Entrée
        </Button>
        <Button variant="danger" icon={IconArrowUpCircle} onClick={() => openModal('sortie', { dept })}>
          Sortie
        </Button>
      </div>

      <InlineSearchBar
        state={filterState}
        onChange={setFilterState}
        options={{ showType: true }}
        count={dateFiltered.length}
        filteredCount={filtered.length}
        placeholder={`Rechercher dans les mouvements ${dept} (produit, agent, destination, fournisseur, réf.)…`}
      />

      <div className="card">
        <div className="card-header">
          <div className="card-header-title">
            <IconArrowsExchange size={16} />
            {filtered.length} mouvement{filtered.length > 1 ? 's' : ''}
            {filtered.length > 0 && ` · ↓ ${totE} entrée · ↑ ${totS} sortie`}
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
                <th>ID</th><th>Date & Heure</th><th>Type</th><th>Produit</th>
                <th>Qté</th><th>Valeur</th><th>Emplacement</th><th>Destination</th>
                <th>Fournisseur</th><th>Réf. Doc.</th><th>Agent</th><th>Observation</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12}>
                    <div className="empty-state">
                      <p>Aucun mouvement{hasFilter ? ' sur la période' : ''} ne correspond</p>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map(m => {
                const { date, time } = fmtDTSplit(m.created_at || m.date)
                return (
                  <tr key={m.id}>
                    <td className="cell-mono" style={{ fontSize: 11 }}>{m.id}</td>
                    <td className="col-date">
                      <div className="dt-date">{date}</div>
                      <div className="dt-time">{time}</div>
                    </td>
                    <td><TypeBadge type={m.type} /></td>
                    <td className="cell-name">
                      <span dangerouslySetInnerHTML={highlight(m.produit_nom, q)} />
                    </td>
                    <td style={{ fontWeight: 700 }}>{m.qty}</td>
                    <td className="text-muted">{fmt(m.valeur)} MGA</td>
                    <td className="text-muted">
                      <span dangerouslySetInnerHTML={highlight(m.emplacement || '—', q)} />
                    </td>
                    <td className="text-muted">
                      <span dangerouslySetInnerHTML={highlight(m.destination || '—', q)} />
                    </td>
                    <td className="text-muted">
                      <span dangerouslySetInnerHTML={highlight(m.fournisseur || '—', q)} />
                    </td>
                    <td className="text-muted">
                      <span dangerouslySetInnerHTML={highlight(m.ref_document || '—', q)} />
                    </td>
                    <td className="text-muted">
                      <span dangerouslySetInnerHTML={highlight(m.user_name, q)} />
                    </td>
                    <td className="text-muted" style={{ maxWidth: 140, fontSize: 12 }}>
                      {m.observation || ''}
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