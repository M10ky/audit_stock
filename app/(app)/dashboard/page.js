'use client'
import {
  IconDeviceLaptop, IconCash, IconBellRinging, IconClipboardList, IconActivity,
} from '@tabler/icons-react'
import { useDataStore } from '@/store/dataStore'
import { usePermissions } from '@/hooks/usePermissions'
import { useDateFilter } from '@/hooks/useDateFilter'
import { fmt, fmtDTSplit } from '@/lib/helpers'
import KpiCard from '@/components/ui/KpiCard'
import TypeBadge from '@/components/ui/badges/TypeBadge'
import DeptTag from '@/components/ui/badges/DeptTag'

export default function DashboardPage() {
  const perm = usePermissions()
  const { filterByDate, hasFilter } = useDateFilter()

  const produits   = useDataStore(s => s.produits)
  const mouvements = useDataStore(s => s.mouvements)
  const demandes   = useDataStore(s => s.demandes)

  const prodIT  = produits.filter(p => p.dept === 'IT')
  const prodFin = produits.filter(p => p.dept === 'Finance')
  const valIT   = prodIT.reduce((s, p) => s + p.stock * p.prix, 0)
  const valFin  = prodFin.reduce((s, p) => s + p.stock * p.prix, 0)
  const alIT    = prodIT.filter(p => p.stock <= p.seuil).length
  const alFin   = prodFin.filter(p => p.stock <= p.seuil).length
  const attIT   = demandes.filter(d => d.dept === 'IT' && d.statut === 'En attente').length
  const attFin  = demandes.filter(d => d.dept === 'Finance' && d.statut === 'En attente').length

  const kpis = []
  if (perm.canSeeIT) kpis.push(perm.canSeePrix
    ? { icon: IconDeviceLaptop, color: 'indigo', value: `${fmt(valIT)} MGA`, label: 'Valeur Stock IT', sub: `${prodIT.length} réf.` }
    : { icon: IconDeviceLaptop, color: 'indigo', value: prodIT.length, label: 'Produits IT', sub: 'références' })
  if (perm.canSeeFin) kpis.push(perm.canSeePrix
    ? { icon: IconCash, color: 'green', value: `${fmt(valFin)} MGA`, label: 'Valeur Stock Finance', sub: `${prodFin.length} réf.` }
    : { icon: IconCash, color: 'green', value: prodFin.length, label: 'Produits Finance', sub: 'références' })
  if (perm.canManIT)  kpis.push({ icon: IconBellRinging, color: alIT  > 0 ? 'red' : 'green', value: alIT,  label: 'Alertes IT',      sub: alIT  > 0 ? 'à traiter' : 'Niveaux OK' })
  if (perm.canManFin) kpis.push({ icon: IconBellRinging, color: alFin > 0 ? 'red' : 'green', value: alFin, label: 'Alertes Finance', sub: alFin > 0 ? 'à traiter' : 'Niveaux OK' })
  if (perm.canManIT)  kpis.push({ icon: IconClipboardList, color: 'amber', value: attIT,  label: 'Demandes IT en attente',      sub: 'à traiter' })
  if (perm.canManFin) kpis.push({ icon: IconClipboardList, color: 'amber', value: attFin, label: 'Demandes Finance en attente', sub: 'à traiter' })

  const recent = [...mouvements]
    .filter(m => filterByDate(m.created_at || m.date))
    .filter(m => (m.dept === 'IT' ? perm.canSeeIT : perm.canSeeFin))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {perm.canSeeHist && (
        <div className="card">
          <div className="card-header">
            <div className="card-header-title"><IconActivity size={16} /> Activités récentes</div>
          </div>
          <div className="table-wrap" style={{ boxShadow: 'none', border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th><th>Dépt</th><th>Type</th><th>Produit</th>
                  <th>Qté</th><th>Emplacement</th><th>Destination</th><th>Agent</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr><td colSpan={8} className="empty-state">Aucun mouvement {hasFilter ? 'sur la période' : ''}</td></tr>
                )}
                {recent.map(m => {
                  const { date, time } = fmtDTSplit(m.created_at || m.date)
                  return (
                    <tr key={m.id}>
                      <td className="col-date"><div className="dt-date">{date}</div><div className="dt-time">{time}</div></td>
                      <td><DeptTag dept={m.dept} /></td>
                      <td><TypeBadge type={m.type} /></td>
                      <td className="cell-name">{m.produit_nom}</td>
                      <td style={{ fontWeight: 700 }}>{m.qty}</td>
                      <td className="text-muted">{m.emplacement || '—'}</td>
                      <td className="text-muted">{m.destination || '—'}</td>
                      <td className="text-muted">{m.user_name}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}