'use client'
import { useEffect } from 'react'
import { IconClipboardList, IconPlus, IconCheck, IconX, IconClock } from '@tabler/icons-react'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { usePermissions } from '@/hooks/usePermissions'
import { createClient } from '@/lib/supabase/client'
import { fmtDTSplit } from '@/lib/helpers'
import Button from '@/components/ui/Button'
import UrgBadge from '@/components/ui/badges/UrgBadge'
import StatBadge from '@/components/ui/badges/StatBadge'

export default function DemandesTable({ dept }) {
  const supabase = createClient()
  const demandes = useDataStore(s => s.demandes.filter(d => d.dept === dept))
  const loadDemandes   = useDataStore(s => s.loadDemandes)
  const loadProduits   = useDataStore(s => s.loadProduits)
  const loadMouvements = useDataStore(s => s.loadMouvements)
  const validDemAction = useDataStore(s => s.validDem)
  const submitMvt      = useDataStore(s => s.submitMvt)
  const profile = useAuthStore(s => s.profile)
  const { openModal, showToast } = useUiStore()
  const perm = usePermissions()

  const canVal = dept === 'IT' ? perm.canValidIT : perm.canValidFin
  const color  = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  useEffect(() => { loadDemandes(supabase, dept) }, [dept]) // eslint-disable-line

  const enAttente = demandes.filter(d => d.statut === 'En attente').length

  const handleValid = async (d, action) => {
    // ── Validation : décrémenter le stock + créer le mouvement de sortie ──
    if (action === 'Validé') {
      // recharger l'état le plus frais possible avant de vérifier le stock
      await loadProduits(supabase, dept)
      const fresh = useDataStore.getState().produits
      const prod = fresh.find(p =>
        p.dept === dept &&
        p.nom.trim().toLowerCase() === d.produit.trim().toLowerCase()
      )

      if (!prod) {
        return showToast(`Produit "${d.produit}" introuvable dans l'inventaire ${dept}`, 'error')
      }
      if (prod.stock < d.qty) {
        return showToast(`Stock insuffisant : ${prod.stock} disponible, ${d.qty} demandé`, 'error')
      }

      const tsNow = new Date().toISOString()

      const { error: sErr } = await supabase
        .from('produits')
        .update({ stock: prod.stock - d.qty, updated_at: tsNow })
        .eq('id', prod.id)
      if (sErr) return showToast('Erreur: ' + sErr.message, 'error')

      const { error: mErr } = await submitMvt(supabase, {
        date: tsNow.split('T')[0],
        created_at: tsNow,
        type: 'Sortie',
        produit_id: prod.id,
        produit_nom: prod.nom,
        qty: d.qty,
        valeur: d.qty * prod.prix,
        dept,
        user_name: profile?.name || 'Système',
        user_id: profile?.id,
        destination: d.dest || '',
        observation: `Validation demande ${d.id} — ${d.demandeur}`,
      })
      if (mErr) return showToast('Erreur: ' + mErr.message, 'error')
    }

    // ── Mise à jour du statut de la demande (Validé ou Refusé) ──
    const { error } = await validDemAction(supabase, d.id, {
      statut: action,
      valideur: profile?.name || '',
      valideur_id: profile?.id,
      updated_at: new Date().toISOString(),
    })
    if (error) return showToast('Erreur: ' + error.message, 'error')

    showToast(action === 'Validé' ? 'Demande validée — stock mis à jour' : 'Demande refusée')
    await Promise.all([
      loadDemandes(supabase, dept),
      loadProduits(supabase, dept),
      loadMouvements(supabase, dept),
    ])
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-title">
          <IconClipboardList size={16} /> {enAttente} en attente · {demandes.length} total
        </div>
        <Button icon={IconPlus} style={{ background: color, borderColor: color }} onClick={() => openModal('demande', { dept })}>
          Nouvelle demande
        </Button>
      </div>
      <div className="table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th><th>Date & Heure</th><th>Demandeur</th><th>Produit</th><th>Qté</th>
              <th>Urgence</th><th>Destination</th><th>Motif</th><th>Statut</th>
              <th>Mis à jour</th><th>Validé par</th>
              {canVal && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {demandes.length === 0 && (
              <tr><td colSpan={12} className="empty-state">Aucune demande</td></tr>
            )}
            {demandes.map(d => {
              const created = fmtDTSplit(d.created_at || d.date)
              const updated = fmtDTSplit(d.updated_at)
              return (
                <tr key={d.id}>
                  <td className="cell-mono">{d.id}</td>
                  <td className="col-date"><div className="dt-date">{created.date}</div><div className="dt-time">{created.time}</div></td>
                  <td className="cell-name">{d.demandeur}</td>
                  <td style={{ fontWeight: 500 }}>{d.produit}</td>
                  <td style={{ fontWeight: 700 }}>{d.qty}</td>
                  <td><UrgBadge urgence={d.urgence} /></td>
                  <td className="text-muted">{d.dest || '—'}</td>
                  <td className="text-muted" style={{ maxWidth: 160 }}>{d.motif || ''}</td>
                  <td><StatBadge statut={d.statut} /></td>
                  <td className="col-date"><div className="dt-date">{updated.date}</div><div className="dt-time">{updated.time}</div></td>
                  <td className="text-muted" style={{ fontSize: 11 }}>{d.valideur || '—'}</td>
                  {canVal && (
                    <td>
                      {d.statut === 'En attente' ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Button size="sm" variant="primary" icon={IconCheck} onClick={() => handleValid(d, 'Validé')}>Valider</Button>
                          <Button size="icon" variant="outline" onClick={() => handleValid(d, 'Refusé')}><IconX size={14} /></Button>
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <IconClock size={12} /> {d.statut}
                        </span>
                      )}
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