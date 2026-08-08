'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase/client'
import { getCUMPProduit, genId } from '@/lib/helpers'
import { useActifsStore } from '@/store/actifsStore'

export default function MouvementModal({ mvtType, dept, prodId: initialProdId }) {
  const supabase = createClient()
  const isEntree = mvtType === 'entree'
  const color = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  const produits          = useDataStore(s => s.produits.filter(p => p.dept === dept))
  const params            = useDataStore(s => s.params)
  const mouvementsEntrees = useDataStore(s => s.mouvementsEntrees)
  const allProfiles = useAuthStore(s => s.allProfiles)
  const profile     = useAuthStore(s => s.profile)
  const { closeModal, showToast } = useUiStore()
  const { submitMvt, loadProduits, loadMouvements, loadMouvementsEntrees } = useDataStore()
  const createActifUnits      = useActifsStore(s => s.createActifUnits)
  const syncStockDepuisActifs = useActifsStore(s => s.syncStockDepuisActifs)

  const [prodId, setProdId]   = useState(initialProdId || '')
  const [qty, setQty]         = useState(1)
  const [prixUnit, setPrixUnit] = useState('')
  const [prixEdited, setPrixEdited] = useState(false)
  const [userName, setUserName] = useState(profile?.name || '')
  const [dest, setDest]       = useState('')
  const [empl, setEmpl]       = useState('')
  const [obs, setObs]         = useState('')
  const [refDoc, setRefDoc]   = useState('')
  const [fournisseur, setFournisseur] = useState('')
  const [loading, setLoading] = useState(false)

  const destinations  = params.destinations || []
  const emplacements  = params.emplacements?.length ? params.emplacements : ['Stock Principal']
  const prod = produits.find(p => p.id === prodId)
  const cump = prod ? getCUMPProduit(prod.id, mouvementsEntrees) : 0

  // Suggestion de prix pour une Entrée : CUMP courant si connu — simple
  // suggestion, modifiable librement par l'utilisateur (cf. prixEdited).
  if (prod && isEntree && !prixEdited && cump > 0 && prixUnit === '') {
    setPrixUnit(String(Math.round(cump)))
  }

  const usersOptions = allProfiles.length
    ? allProfiles.filter(u => u.dept === dept || u.dept === 'both' || u.role === 'Administrateur')
    : (profile ? [profile] : [])

  const handleSubmit = async () => {
    if (!prodId) return showToast('Sélectionnez un produit', 'error')
    if (!qty || qty <= 0) return showToast('Quantité invalide', 'error')
    if (!prod) return showToast('Produit introuvable', 'error')
    if (isEntree && (!prixUnit || Number(prixUnit) <= 0)) return showToast('Le prix unitaire est obligatoire pour une entrée', 'error')
    if (mvtType === 'sortie' && prod.is_amortissable) {
      return showToast(
        "Ce produit est à suivi individuel — la sortie se fait en attribuant une demande depuis la page Demandes, pas ici.",
        'error'
      )
    }
    if (mvtType === 'sortie' && prod.stock < qty) return showToast(`Stock insuffisant (${prod.stock} disponible)`, 'error')
    if (mvtType === 'sortie' && !dest) return showToast('Veuillez indiquer la destination', 'error')

    setLoading(true)
    const tsNow = new Date().toISOString()
    const mvtId = genId(dept === 'IT' ? 'MVT-IT' : 'MVT-FIN')
    const isAmortEntree = isEntree && prod.is_amortissable

    // Pour une entrée sur produit amortissable : les actifs sont créés
    // AVANT toute écriture sur mouvements/produits. Si ça échoue, rien
    // d'autre n'a été touché — pas de mouvement orphelin.
    if (isAmortEntree) {
      const { ok, message } = await createActifUnits(supabase, {
        prod, qty: Number(qty), mvtId, emplacement: empl, prixUnit: Number(prixUnit),
      })
      if (!ok) { setLoading(false); return showToast('Erreur (actifs) : ' + message, 'error') }
    }

    // Le stock d'un produit amortissable n'est jamais modifié à la main —
    // il est recalculé juste après depuis le nombre réel d'actifs "En
    // service" (syncStockDepuisActifs), seule source de vérité.
    const updateData = { updated_at: tsNow }
    if (!prod.is_amortissable) {
      updateData.stock = isEntree ? prod.stock + Number(qty) : prod.stock - Number(qty)
    }
    if (isEntree && empl) updateData.emplacement = empl

    const { error: sErr } = await supabase.from('produits').update(updateData).eq('id', prodId)
    if (sErr) { showToast('Erreur: ' + sErr.message, 'error'); setLoading(false); return }

    // Valorisation : Entrée → prix unitaire saisi ; Sortie → CUMP réel des
    // entrées (jamais un champ "prix" catalogue manuel et déconnecté).
    const valeurUnitaire = isEntree ? Number(prixUnit) : cump

    const { error: mErr } = await submitMvt(supabase, {
      id: mvtId,
      date: tsNow.split('T')[0],
      created_at: tsNow,
      type: isEntree ? 'Entrée' : 'Sortie',
      produit_id: prodId,
      produit_nom: prod.nom,
      qty: Number(qty),
      valeur: Number(qty) * valeurUnitaire,
      dept,
      user_name: userName || profile?.name || 'Système',
      user_id: profile?.id,
      destination: dest,
      emplacement: empl,
      ref_document: refDoc,
      fournisseur,
      observation: obs,
    })
    if (mErr) { setLoading(false); return showToast('Erreur: ' + mErr.message, 'error') }

    if (isAmortEntree) {
      await syncStockDepuisActifs(supabase, prodId)
    }

    setLoading(false)
    showToast(`${isEntree ? 'Entrée' : 'Sortie'} enregistrée — ${qty}× ${prod.nom}`)
    await Promise.all([
      loadProduits(supabase, dept),
      loadMouvements(supabase, dept),
      loadMouvementsEntrees(supabase),
    ])
    closeModal()
  }
  return (
    <Modal
      title={isEntree ? '↓ Enregistrer une Entrée' : '↑ Enregistrer une Sortie'}
      onClose={closeModal}
      footer={
        <>
          <Button variant="outline" onClick={closeModal}>Annuler</Button>
          <Button variant={isEntree ? 'primary' : 'danger'} loading={loading} onClick={handleSubmit}>
            {isEntree ? '✓ Valider Entrée' : '✓ Valider Sortie'}
          </Button>
        </>
      }
    >
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Département</label>
          <input className="form-input" value={dept} disabled style={{ color, fontWeight: 700 }} />
        </div>
        <div className="form-group">
          <label className="form-label">Type d&apos;opération</label>
          <input className="form-input" value={isEntree ? 'Entrée' : 'Sortie'} disabled
            style={{ color: isEntree ? 'var(--green)' : 'var(--red)', fontWeight: 700 }} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Produit <span className="req">*</span></label>
        <select className="form-select" value={prodId} onChange={e => setProdId(e.target.value)}>
          <option value="">— Sélectionner un produit {dept} —</option>
          {produits.map(p => (
            <option key={p.id} value={p.id}>
              {p.nom} (stock: {p.stock}{p.emplacement ? ` — ${p.emplacement}` : ''})
            </option>
          ))}
        </select>
      </div>

      {isEntree ? (
        <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="form-group">
            <label className="form-label">Quantité <span className="req">*</span></label>
            <input className="form-input" type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Prix unit. (MGA) <span className="req">*</span></label>
            <input
              className="form-input" type="number" min={0} value={prixUnit}
              onChange={e => { setPrixUnit(e.target.value); setPrixEdited(true) }}
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Agent <span className="req">*</span></label>
            <select className="form-select" value={userName} onChange={e => setUserName(e.target.value)}>
              {usersOptions.map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Quantité <span className="req">*</span></label>
            <input className="form-input" type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Agent <span className="req">*</span></label>
            <select className="form-select" value={userName} onChange={e => setUserName(e.target.value)}>
              {usersOptions.map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}
            </select>
          </div>
        </div>
      )}

      {isEntree ? (
        <>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fournisseur</label>
              <input className="form-input" value={fournisseur} onChange={e => setFournisseur(e.target.value)} placeholder="Nom du fournisseur…" />
            </div>
            <div className="form-group">
              <label className="form-label">Réf. document / bon de livraison</label>
              <input className="form-input" value={refDoc} onChange={e => setRefDoc(e.target.value)} placeholder="BL-2026-XXXX…" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Emplacement de stockage</label>
            <select className="form-select" value={empl} onChange={e => setEmpl(e.target.value)}>
              <option value="">— Conserver l&apos;emplacement actuel —</option>
              {emplacements.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </>
      ) : (
        <div className="form-group">
          <label className="form-label">Destination / Plateau <span className="req">*</span></label>
          <select className="form-select" value={dest} onChange={e => setDest(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {destinations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Observation / Motif</label>
        <input className="form-input" value={obs} onChange={e => setObs(e.target.value)} placeholder="Précisions sur l'opération…" />
      </div>
    </Modal>
  )
}