'use client'
import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useDataStore } from '@/store/dataStore'
import { useActifsStore } from '@/store/actifsStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { usePermissions } from '@/hooks/usePermissions'
import { canEditMvt } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import { fmtDT } from '@/lib/helpers'

export default function MouvementEditModal({ mv }) {
  const supabase = createClient()
  const { closeModal, showToast, isSubmitting, withSubmitLock } = useUiStore()
  const perm = usePermissions()
  const user = useAuthStore(s => s.user)
  const profile = useAuthStore(s => s.profile)
  const {
    produits, params,
    updateMouvementPartial, loadProduits, loadMouvements, loadMouvementsEntrees,
  } = useDataStore()
  const { updateValeurAchatActif, loadActifs } = useActifsStore()

  const destinations = params.destinations || []
  const emplacements = params.emplacements?.length ? params.emplacements : ['Stock Principal']
  const fournisseurs = params.fournisseurs || []
  const [produit, setProduit] = useState(() => produits.find(p => p.id === mv?.produit_id))

  // Le store peut être chargé avec un filtre dept : on résout le produit par id.
  useEffect(() => {
    const found = produits.find(p => p.id === mv?.produit_id)
    if (found) { setProduit(found); return }
    if (!mv?.produit_id) return
    let cancelled = false
    supabase.from('produits').select('*').eq('id', mv.produit_id).maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setProduit(data) })
    return () => { cancelled = true }
  }, [mv?.produit_id, produits]) // eslint-disable-line react-hooks/exhaustive-deps
  const prixInitial = (mv?.qty && mv?.valeur != null)
    ? Math.round((mv.valeur || 0) / mv.qty)
    : (mv?.valeur || 0)

  const [prixUnit, setPrixUnit] = useState(prixInitial)
  const [dest, setDest] = useState(mv?.destination || '')
  const [empl, setEmpl] = useState(mv?.emplacement || '')
  const [four, setFour] = useState(mv?.fournisseur || '')
  const [refd, setRefd] = useState(mv?.ref_document || '')
  const [obs, setObs] = useState(mv?.observation || '')
  const [loading, setLoading] = useState(false)
  const busy = loading || isSubmitting

  const doSubmit = () => withSubmitLock(async () => {
    if (!canEditMvt(mv, user, profile, perm)) {
      showToast('Action non autorisée', 'error')
      return
    }
    // Règle métier (js/stock.js submitEditMvt) : visibilité du dept revérifiée
    // avant correction, en plus du droit de gestion.
    if (mv.dept === 'IT' && !perm.canSeeIT && !perm.isAdmin) {
      showToast('Action non autorisée', 'error')
      return
    }
    if (mv.dept === 'Finance' && !perm.canSeeFin && !perm.isAdmin) {
      showToast('Action non autorisée', 'error')
      return
    }
    if (mv.dept === 'IT' && !perm.canManIT && !perm.isAdmin) {
      showToast('Action non autorisée', 'error')
      return
    }
    if (mv.dept === 'Finance' && !perm.canManFin && !perm.isAdmin) {
      showToast('Action non autorisée', 'error')
      return
    }
    setLoading(true)
    try {
      const prix = parseFloat(prixUnit)
      const prixFinal = isNaN(prix) || prix < 0 ? 0 : prix
      const qty = mv.qty || 0
      const nouvelleValeur = Math.round(prixFinal * qty)

      // Règle vanilla : prix 0 interdit pour une entrée non amortissable.
      if (nouvelleValeur === 0 && mv.type === 'Entrée' && produit && produit.is_amortissable !== true) {
        showToast('Le prix unitaire doit être supérieur à 0 pour une entrée non amortissable', 'error')
        return
      }

      const { error } = await updateMouvementPartial(supabase, mv.id, {
        valeur: nouvelleValeur,
        destination: dest,
        emplacement: empl,
        fournisseur: four,
        ref_document: refd,
        observation: obs,
      })
      if (error) throw error

      // Non bloquant, comme dans stock.js : l'actif suit la nouvelle valeur.
      if (mv.type === 'Entrée' && mv.actif_id) {
        try {
          await updateValeurAchatActif(supabase, mv.actif_id, nouvelleValeur)
        } catch { /* correction du mouvement conservée */ }
      }

      closeModal()
      showToast('Mouvement corrigé')
      await Promise.all([
        loadProduits(supabase),
        loadMouvements(supabase),
        loadMouvementsEntrees(supabase),
        loadActifs(supabase),
      ])
    } catch (err) {
      showToast('Erreur : ' + (err?.message || err), 'error')
    } finally {
      setLoading(false)
    }
  })

  const handleSubmit = () => {
    if (!canEditMvt(mv, user, profile, perm)) {
      showToast('Action non autorisée', 'error')
      return
    }
    if (mv.dept === 'IT' && !perm.canManIT && !perm.isAdmin) {
      showToast('Action non autorisée', 'error')
      return
    }
    if (mv.dept === 'Finance' && !perm.canManFin && !perm.isAdmin) {
      showToast('Action non autorisée', 'error')
      return
    }
    doSubmit()
  }

  if (!mv) return null

  const color = mv.dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  return (
    <Modal title="✏ Corriger le mouvement" onClose={closeModal} footer={
      <>
        <Button variant="outline" onClick={closeModal}>Annuler</Button>
        <Button
          loading={busy}
          disabled={busy}
          style={{ background: color, borderColor: color }}
          onClick={handleSubmit}
        >
          ✓ Enregistrer
        </Button>
      </>
    }>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Type</label>
          <input className="form-input" value={mv.type || ''} disabled />
        </div>
        <div className="form-group">
          <label className="form-label">Département</label>
          <input className="form-input" value={mv.dept || ''} disabled style={{ color, fontWeight: 700 }} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Produit</label>
          <input className="form-input" value={mv.produit_nom || produit?.nom || ''} disabled />
        </div>
        <div className="form-group">
          <label className="form-label">Quantité</label>
          <input className="form-input" value={mv.qty || 0} disabled />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Date & heure</label>
          <input className="form-input" value={fmtDT(mv.created_at || mv.date)} disabled />
        </div>
        <div className="form-group">
          <label className="form-label">Agent</label>
          <input className="form-input" value={mv.user_name || ''} disabled />
        </div>
      </div>

      {mv.actif_id && (
        <div className="form-group">
          <label className="form-label">N° Actif</label>
          <input className="form-input cell-mono" value={mv.actif_id} disabled />
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Prix unitaire (MGA) <span className="req">*</span></label>
        <input className="form-input" type="number" min={0} value={prixUnit} onChange={e => setPrixUnit(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Destination</label>
        <select className="form-select" value={dest} onChange={e => setDest(e.target.value)}>
          <option value="">—</option>
          {destinations.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Emplacement</label>
          <select className="form-select" value={empl} onChange={e => setEmpl(e.target.value)}>
            <option value="">—</option>
            {emplacements.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Fournisseur</label>
          <select className="form-select" value={four} onChange={e => setFour(e.target.value)}>
            <option value="">—</option>
            {fournisseurs.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Réf. / N° document</label>
        <input className="form-input" value={refd} onChange={e => setRefd(e.target.value)} placeholder="BL-..." />
      </div>
      <div className="form-group">
        <label className="form-label">Observation</label>
        <input className="form-input" value={obs} onChange={e => setObs(e.target.value)} placeholder="Précisions..." />
      </div>
    </Modal>
  )
}
