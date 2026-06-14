// 'use client'
// // TODO: Phase 4 — MouvementsTable
// export default function MouvementsTable() { return null }

'use client'
import { useEffect } from 'react'
import { IconArrowsExchange, IconArrowDownCircle, IconArrowUpCircle } from '@tabler/icons-react'
import { useDataStore } from '@/store/dataStore'
import { useUiStore } from '@/store/uiStore'
import { useDateFilter } from '@/hooks/useDateFilter'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDTSplit } from '@/lib/helpers'
import Button from '@/components/ui/Button'
import TypeBadge from '@/components/ui/badges/TypeBadge'

export default function MouvementsTable({ dept }) {
  const supabase = createClient()
  const mouvements = useDataStore(s => s.mouvements.filter(m => m.dept === dept))
  const loadMouvements = useDataStore(s => s.loadMouvements)
  const { openModal } = useUiStore()
  const { filterByDate, hasFilter } = useDateFilter()
  const color = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  useEffect(() => { loadMouvements(supabase, dept) }, [dept]) // eslint-disable-line

  const filtered = mouvements.filter(m => filterByDate(m.created_at || m.date))
  const totE = filtered.filter(m => m.type === 'Entrée').reduce((s, m) => s + m.qty, 0)
  const totS = filtered.filter(m => m.type === 'Sortie').reduce((s, m) => s + m.qty, 0)

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-title">
          <IconArrowsExchange size={16} />
          {filtered.length} mouvement{filtered.length > 1 ? 's' : ''} · ↓ {totE} en entrée · ↑ {totS} en sortie
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" icon={IconArrowDownCircle} onClick={() => openModal('entree', { dept })}>Entrée</Button>
          <Button variant="danger" icon={IconArrowUpCircle} onClick={() => openModal('sortie', { dept })}>Sortie</Button>
        </div>
      </div>
      <div className="table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th><th>Date & Heure</th><th>Type</th><th>Produit</th><th>Qté</th><th>Valeur</th>
              <th>Emplacement</th><th>Destination</th><th>Fournisseur</th><th>Réf. Doc.</th><th>Agent</th><th>Observation</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="empty-state">Aucun mouvement {hasFilter ? 'sur la période' : ''}</td></tr>
            )}
            {filtered.map(m => {
              const { date, time } = fmtDTSplit(m.created_at || m.date)
              return (
                <tr key={m.id}>
                  <td className="cell-mono">{m.id}</td>
                  <td className="col-date"><div className="dt-date">{date}</div><div className="dt-time">{time}</div></td>
                  <td><TypeBadge type={m.type} /></td>
                  <td className="cell-name">{m.produit_nom}</td>
                  <td style={{ fontWeight: 700 }}>{m.qty}</td>
                  <td>{fmt(m.valeur)} MGA</td>
                  <td className="text-muted">{m.emplacement || '—'}</td>
                  <td className="text-muted">{m.destination || '—'}</td>
                  <td className="text-muted">{m.fournisseur || '—'}</td>
                  <td className="text-muted">{m.ref_document || '—'}</td>
                  <td className="text-muted">{m.user_name}</td>
                  <td className="text-muted" style={{ maxWidth: 140 }}>{m.observation || ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}