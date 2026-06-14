// 'use client'
// // TODO: Phase 4 — AlertesTable
// export default function AlertesTable() { return null }

'use client'
import { IconBellRinging, IconPackage } from '@tabler/icons-react'
import { useDataStore } from '@/store/dataStore'
import { useUiStore } from '@/store/uiStore'
import { fmtDate } from '@/lib/helpers'
import Button from '@/components/ui/Button'
import StatusTag from '@/components/ui/badges/StatusTag'

export default function AlertesTable({ dept }) {
  const produits = useDataStore(s => s.produits.filter(p => p.dept === dept && p.stock <= p.seuil))
  const { openModal } = useUiStore()
  const color = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  const sorted = [...produits].sort((a, b) => a.stock - b.stock)

  if (sorted.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <p style={{ fontWeight: 700, color: 'var(--text)' }}>Aucune alerte active</p>
          <p>Tous les stocks sont au-dessus de leurs seuils critiques</p>
        </div>
      </div>
    )
  }

  return (
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
  )
}