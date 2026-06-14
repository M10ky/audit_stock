'use client'
import { useEffect } from 'react'
import {
  IconPlus, IconMinus, IconEdit, IconTrash,
  IconArrowDownCircle, IconArrowUpCircle, IconPackage,
} from '@tabler/icons-react'
import { useDataStore } from '@/store/dataStore'
import { useUiStore } from '@/store/uiStore'
import { usePermissions } from '@/hooks/usePermissions'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/helpers'
import { calcVNC, amortPct } from '@/lib/amortissement'
import Button from '@/components/ui/Button'
import StatusTag from '@/components/ui/badges/StatusTag'
import AmortBar from '@/components/ui/badges/AmortBar'

export default function ProduitsTable({ dept }) {
  const supabase = createClient()
  const produits = useDataStore(s => s.produits.filter(p => p.dept === dept))
  const loadProduits   = useDataStore(s => s.loadProduits)
  const deleteProduit  = useDataStore(s => s.deleteProduit)
  const { openModal, openConfirm, showToast } = useUiStore()
  const perm = usePermissions()

  const canMan   = dept === 'IT' ? perm.canManIT : perm.canManFin
  const showPrix = perm.canSeePrix
  const color    = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  useEffect(() => { loadProduits(supabase, dept) }, [dept]) // eslint-disable-line

  const total = produits.reduce((s, p) => s + p.stock * p.prix, 0)

  const handleDelete = (p) => {
    openConfirm({
      title: `Supprimer "${p.nom}" ?`,
      message: "Cette action est irréversible. Les mouvements existants seront conservés mais le produit sera retiré de l'inventaire.",
      danger: true,
      onConfirm: async () => {
        const { error } = await deleteProduit(supabase, p.id)
        if (error) showToast('Erreur: ' + error.message, 'error')
        else { showToast(`"${p.nom}" supprimé`); await loadProduits(supabase, dept) }
      },
    })
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-title">
          <IconPackage size={16} />
          {produits.length} référence{produits.length > 1 ? 's' : ''}
          {showPrix && ` · Valeur totale : ${fmt(total)} MGA`}
        </div>
        {canMan && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="outline" icon={IconArrowDownCircle} onClick={() => openModal('entree', { dept })}>Entrée</Button>
            <Button variant="danger" icon={IconArrowUpCircle} onClick={() => openModal('sortie', { dept })}>Sortie</Button>
            <Button icon={IconPlus} onClick={() => openModal('add-produit', { dept })}>Produit</Button>
          </div>
        )}
      </div>
      <div className="table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th><th>Produit</th><th>Catégorie</th><th>Emplacement</th>
              <th>Stock</th><th>Seuil</th>
              {showPrix && <><th>Prix unit.</th><th>Valeur stock</th><th>VNC</th></>}
              <th>Statut</th>
              {canMan && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {produits.length === 0 && (
              <tr><td colSpan={20}><div className="empty-state"><p>Aucun produit dans ce département</p></div></td></tr>
            )}
            {produits.map(p => {
              const vnc = calcVNC(p.valeur_achat, p.date_achat, p.duree_amortissement)
              const pct = amortPct(p.valeur_achat, p.date_achat, p.duree_amortissement)
              const status = p.stock === 0 ? 'Rupture' : p.stock <= p.seuil ? 'Critique' : 'Disponible'
              const stockColor = status === 'Rupture' ? 'var(--red)' : status === 'Critique' ? 'var(--amber)' : 'var(--text)'
              const configured = p.valeur_achat && p.date_achat && p.duree_amortissement

              return (
                <tr key={p.id}>
                  <td className="cell-mono">{p.id}</td>
                  <td className="cell-name">{p.nom}</td>
                  <td><span className="badge" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>{p.categorie}</span></td>
                  <td>{p.emplacement
                    ? <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>{p.emplacement}</span>
                    : <span className="text-muted">—</span>}</td>
                  <td><span className="stock-val" style={{ color: stockColor }}>{p.stock}</span></td>
                  <td className="text-muted">{p.seuil}</td>
                  {showPrix && (
                    <>
                      <td>{fmt(p.prix)} MGA</td>
                      <td style={{ fontWeight: 700 }}>{fmt(p.stock * p.prix)} MGA</td>
                      <td>
                        {configured
                          ? <div><div style={{ fontWeight: 700, fontSize: 12 }}>{fmt(vnc)} MGA</div><AmortBar pct={pct} /></div>
                          : <span className="text-muted" style={{ fontSize: 11 }}>Non configuré</span>}
                      </td>
                    </>
                  )}
                  <td><StatusTag stock={p.stock} seuil={p.seuil} /></td>
                  {canMan && (
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <Button size="icon" variant="outline" onClick={() => openModal('entree', { dept, prodId: p.id })} title="Entrée"><IconPlus size={14} /></Button>
                        <Button size="icon" variant="danger" onClick={() => openModal('sortie', { dept, prodId: p.id })} title="Sortie"><IconMinus size={14} /></Button>
                        <Button size="icon" variant="outline" onClick={() => openModal('edit-produit', { dept, prod: p })} title="Modifier"><IconEdit size={14} /></Button>
                        {perm.isAdmin && (
                          <Button size="icon" variant="outline" onClick={() => handleDelete(p)} title="Supprimer"><IconTrash size={14} /></Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}