// 'use client'
// export default function AlertesTable() { return null }

'use client'
import { IconBellRinging, IconPackage, IconDownload } from '@tabler/icons-react'
import { useDataStore } from '@/store/dataStore'
import { useUiStore } from '@/store/uiStore'
import { fmtDate } from '@/lib/helpers'
import { exportToCSV, todayFileDate } from '@/lib/csv'
import Button from '@/components/ui/Button'
import StatusTag, { getStockStatus } from '@/components/ui/badges/StatusTag'

export default function AlertesTable({ dept }) {
  // Mirrors js/utils.js alertsIT()/alertsFin() : seuls les produits ACTIFS
  // génèrent des alertes de seuil (un produit désactivé sort du périmètre).
  const produits = useDataStore(s => s.produits.filter(p => p.dept === dept && p.actif !== false && p.stock <= p.seuil))
  const { openModal } = useUiStore()
  const color = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  const sorted = [...produits].sort((a, b) => a.stock - b.stock)

  // Règle métier (js/export.js exportAlertesCSV) : export des produits sous
  // le seuil critique, triés par stock croissant (aucun filtre inline — la
  // page Alertes n'a pas de barre de recherche). « Dernière MAJ » = date seule.
  const handleExport = () => {
    const headers = ['Produit', 'Catégorie', 'Emplacement', 'Stock actuel', 'Seuil', 'Statut', 'Dernière MAJ']
    const rows = sorted.map(p => [
      p.nom, p.categorie, p.emplacement || '',
      p.stock, p.seuil, getStockStatus(p.stock, p.seuil), fmtDate(p.updated_at),
    ])
    exportToCSV(rows, headers, `alertes_${dept.toLowerCase()}_${todayFileDate()}.csv`)
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button variant="outline" icon={IconDownload} onClick={handleExport}>CSV</Button>
      </div>

      {sorted.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <p style={{ fontWeight: 700, color: 'var(--text)' }}>Aucune alerte active</p>
            <p>Tous les stocks sont au-dessus de leurs seuils critiques</p>
          </div>
        </div>
      ) : (
        <div className="card">
      <div className="card-header">
        <div className="card-header-title">
          <IconBellRinging size={16} /> {sorted.length} produit(s) nécessitant un réapprovisionnement urgent
        </div>
      </div>
      <div className="table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Priorité</th><th>Produit</th><th>Catégorie</th><th>Emplacement</th>
              <th>Stock actuel</th><th>Seuil</th><th>Statut</th><th>Dernière MAJ</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <tr key={p.id}>
                <td style={{ fontSize: 18 }}>{p.stock === 0 ? '🔴' : '🟠'}</td>
                <td className="cell-name">{p.nom}</td>
                <td><span className="badge" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>{p.categorie}</span></td>
                <td>{p.emplacement
                  ? <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>{p.emplacement}</span>
                  : <span className="text-muted">—</span>}</td>
                <td><span className="stock-val" style={{ color: p.stock === 0 ? 'var(--red)' : 'var(--amber)' }}>{p.stock}</span></td>
                <td className="text-muted">{p.seuil}</td>
                <td><StatusTag stock={p.stock} seuil={p.seuil} /></td>
                <td className="text-muted">{fmtDate(p.updated_at)}</td>
                <td>
                  <Button icon={IconPackage} style={{ background: color, borderColor: color }}
                    onClick={() => openModal('entree', { dept, prodId: p.id })}>
                    Réapprovisionner
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </div>
      )}
    </>
  )
}