// 'use client'
// // TODO: Phase 5 — DemandeModal
// export default function DemandeModal() { return null }

'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase/client'

export default function DemandeModal({ dept }) {
  const supabase = createClient()
  const { closeModal, showToast, isSubmitting, withSubmitLock } = useUiStore()
  const { submitDem, loadDemandes, params } = useDataStore()
  const profile = useAuthStore(s => s.profile)
  const produits = useDataStore(s => s.produits.filter(p => p.dept === dept))
  const destinations = params.destinations || []
  const color = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  const [produit, setProduit] = useState('')
  const [qty, setQty]         = useState(1)
  const [urgence, setUrgence] = useState('Normale')
  const [dest, setDest]       = useState('')
  const [motif, setMotif]     = useState('')
  const [loading, setLoading] = useState(false)
  // FIX régression : le footer référençait `busy` sans qu'il soit jamais
  // déclaré → ReferenceError au rendu, modale inutilisable. Mirrors
  // MouvementModal.jsx / PretModal.jsx : combine l'état local du bouton
  // et le verrou global anti-double-clic.
  const busy = loading || isSubmitting

  // FIX Étape H bis : withSubmitLock était importé mais jamais appliqué —
  // le verrou global annoncé dans la fiche de passation pour cette modale
  // n'était donc pas réellement câblé. Enveloppe maintenant tout le corps
  // de soumission, comme sur MouvementModal/PretModal/PretsTable.
  const handleSubmit = async () => withSubmitLock(async () => {
    if (!produit.trim()) return showToast('Produit requis', 'error')
    if (!dest)           return showToast('Veuillez sélectionner une destination', 'error')
    if (!motif.trim())   return showToast('Le motif est requis', 'error')

    setLoading(true)
    const tsNow = new Date().toISOString()
    const { error } = await submitDem(supabase, {
      date: tsNow.split('T')[0],
      created_at: tsNow,
      demandeur: profile?.name || '',
      demandeur_id: profile?.id,
      produit: produit.trim(),
      qty: Number(qty) || 1,
      dest,
      motif: motif.trim(),
      dept,
      statut: 'En attente',
      urgence,
    })
    setLoading(false)
    if (error) return showToast('Erreur: ' + error.message, 'error')
    showToast('Demande soumise avec succès')
    await loadDemandes(supabase, dept)
    closeModal()
  })

  return (
    <Modal title={`📋 Nouvelle Demande — ${dept}`} onClose={closeModal} footer={
      <>
        <Button variant="outline" onClick={closeModal}>Annuler</Button>
       <Button loading={busy} disabled={busy} onClick={handleSubmit}>✓ Soumettre</Button>
      </>
    }>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Département</label>
          <input className="form-input" value={dept} disabled style={{ color, fontWeight: 700 }} />
        </div>
        <div className="form-group">
          <label className="form-label">Demandeur</label>
          <input className="form-input" value={profile?.name || ''} disabled />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Produit demandé <span className="req">*</span></label>
        <input
          className="form-input" value={produit} onChange={e => setProduit(e.target.value)}
          placeholder={`Nom du produit ${dept}`} list={`prod-datalist-${dept}`}
        />
        <datalist id={`prod-datalist-${dept}`}>
          {produits.map(p => <option key={p.id} value={p.nom}>{p.nom} (stock: {p.stock})</option>)}
        </datalist>
      </div>

      <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="form-group">
          <label className="form-label">Quantité</label>
          <input className="form-input" type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Urgence</label>
          <select className="form-select" value={urgence} onChange={e => setUrgence(e.target.value)}>
            <option value="Normale">Normale</option>
            <option value="Urgente">Urgente</option>
            <option value="Critique">Critique</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Destination <span className="req">*</span></label>
          <select className="form-select" value={dest} onChange={e => setDest(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {destinations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Motif / Justification <span className="req">*</span></label>
        <textarea className="form-textarea" rows={3} value={motif} onChange={e => setMotif(e.target.value)} placeholder="Raison précise de la demande…" />
      </div>
    </Modal>
  )
}