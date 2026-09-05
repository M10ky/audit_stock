'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useActifsStore } from '@/store/actifsStore'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { usePretsStore, STATUS_PRET } from '@/store/pretsStore'
import { STATUS_ACTIF } from '@/lib/actifs'
import { createClient } from '@/lib/supabase/client'

// Mirrors js/prets.js renderModalPret()
export default function PretModal({ dept }) {
  const supabase = createClient()
  const color = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  const actifs      = useActifsStore(s => s.actifs.filter(a => a.dept === dept && a.statut === STATUS_ACTIF.EN_SERVICE))
  const produits    = useDataStore(s => s.produits)
  const params      = useDataStore(s => s.params)
  const allProfiles = useAuthStore(s => s.allProfiles)
  const profile     = useAuthStore(s => s.profile)
  const { closeModal, showToast, isSubmitting, withSubmitLock } = useUiStore()
  const { creerPret, loadPrets } = usePretsStore()
  const loadActifs = useActifsStore(s => s.loadActifs)
  const syncStockDepuisActifs = useActifsStore(s => s.syncStockDepuisActifs)
  const loadProduits = useDataStore(s => s.loadProduits)

  // Exclut les actifs dont le produit parent est désactivé
  const actifsDispos = actifs.filter(a => {
    const prodParent = produits.find(p => p.id === a.produit_id)
    return !prodParent || prodParent.actif !== false
  })

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const [actifId, setActifId] = useState('')
  const [produitNom, setProduitNom] = useState('')
  const [emprunteur, setEmprunteur] = useState('')
  const [dateRetour, setDateRetour] = useState(tomorrowStr)
  const [dest, setDest] = useState('')
  const [motif, setMotif] = useState('')
  const [loading, setLoading] = useState(false)
  const busy = loading || isSubmitting

  const destinations = params.destinations || []  
  const usersOptions = allProfiles.length
    ? allProfiles.filter(u => u.dept === dept || u.dept === 'both' || u.role === 'Administrateur')
    : (profile ? [profile] : [])

  const handleActifChange = (id) => {
    setActifId(id)
    const a = actifsDispos.find(x => x.id === id)
    setProduitNom(a?.produit_nom || '')
  }

  const handleSubmit = async () => withSubmitLock(async () => {
    if (!actifId)      return showToast('Sélectionnez un actif', 'error')
    if (!emprunteur)   return showToast("L'emprunteur est requis", 'error')
    if (!dateRetour)   return showToast('Date de retour prévue requise', 'error')
    if (!motif.trim()) return showToast('Le motif est requis', 'error')

    const emprunteurProfile = allProfiles.find(u => u.name === emprunteur)

    setLoading(true)
    const { error } = await creerPret(supabase, {
      dept, actifId,
      emprunteur,
      emprunteurId: emprunteurProfile?.id,
      dateRetourPrevue: dateRetour,
      motif: motif.trim(),
      notes: dest,
      valideur: profile?.name || '',
      valideurId: profile?.id,
    })
    setLoading(false)
    if (error) return showToast('Erreur : ' + error.message, 'error')

    showToast(`Prêt enregistré — "${actifId}" confié à ${emprunteur}`)
    await loadPrets(supabase)
    // Symétrique du retour de prêt : la création fait passer l'actif hors du
    // pool "disponible" (En service → En prêt), donc le stock recalculé.
    await syncStockDepuisActifs(supabase, produits.find(p => p.id === actifsDispos.find(a => a.id === actifId)?.produit_id)?.id)
    await loadProduits(supabase, dept)
    closeModal()
  })

  return (
    <Modal title={`📋 Nouveau prêt — ${dept}`} onClose={closeModal} footer={
      <>
        <Button variant="outline" onClick={closeModal}>Annuler</Button>
        <Button loading={busy} disabled={busy || !actifsDispos.length} style={{ background: color, borderColor: color }} onClick={handleSubmit}>
          ✓ Enregistrer le prêt
        </Button>
      </>
    }>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Département</label>
          <input className="form-input" value={dept} disabled style={{ color, fontWeight: 700 }} />
        </div>
        <div className="form-group">
          <label className="form-label">Valideur</label>
          <input className="form-input" value={profile?.name || ''} disabled />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Actif à prêter <span className="req">*</span></label>
        {actifsDispos.length ? (
          <select className="form-select" value={actifId} onChange={e => handleActifChange(e.target.value)}>
            <option value="">— Sélectionner un actif en service —</option>
            {actifsDispos.map(a => (
              <option key={a.id} value={a.id}>
                {a.id} — {a.produit_nom || '—'} ({a.emplacement || '—'})
              </option>
            ))}
          </select>
        ) : (
          <input className="form-input" value="Aucun actif disponible" disabled />
        )}
        {!actifsDispos.length && (
          <div className="form-hint">Aucun actif « En service » disponible pour le département {dept}.</div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Produit</label>
        <input className="form-input" value={produitNom} disabled placeholder="Auto-rempli à la sélection" />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Emprunteur <span className="req">*</span></label>
          {allProfiles.length ? (
            <select className="form-select" value={emprunteur} onChange={e => setEmprunteur(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {usersOptions.map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}
            </select>
          ) : (
            <input className="form-input" value={emprunteur} onChange={e => setEmprunteur(e.target.value)} placeholder="Nom de l'emprunteur…" />
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Date de retour prévue <span className="req">*</span></label>
          <input className="form-input" type="date" min={tomorrowStr} value={dateRetour} onChange={e => setDateRetour(e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Destination / Affectation</label>
        <select className="form-select" value={dest} onChange={e => setDest(e.target.value)}>
          <option value="">— Optionnel —</option>
          {destinations.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Motif <span className="req">*</span></label>
        <textarea className="form-textarea" rows={2} value={motif} onChange={e => setMotif(e.target.value)} placeholder="Contexte et raison du prêt…" />
      </div>
    </Modal>
  )
}