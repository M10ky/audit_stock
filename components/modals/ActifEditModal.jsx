'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useActifsStore } from '@/store/actifsStore'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase/client'
import { tauxLineaire } from '@/lib/amortissement'
import { buildActifNote } from '@/lib/actifs'

const DUREES = [12, 24, 36, 48, 60, 84]

export default function ActifEditModal({ actif }) {
  const supabase = createClient()
  const { closeModal, showToast, openConfirm } = useUiStore()
  const submitEditActif = useActifsStore(s => s.submitEditActif)
  const renommerActif   = useActifsStore(s => s.renommerActif)
  const loadActifs      = useActifsStore(s => s.loadActifs)
  const profile = useAuthStore(s => s.profile)
  const params = useDataStore(s => s.params)
  const fournisseurs = params.fournisseurs || []

  const [form, setForm] = useState({
    valeur_achat: actif.valeur_achat || 0,
    date_achat: actif.date_achat || '',
    fournisseur: actif.fournisseur || '',
    duree_amortissement: actif.duree_amortissement || 36,
    valeur_residuelle: actif.valeur_residuelle || 0,
  })
  const [serial, setSerial] = useState(actif.id)
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const taux = tauxLineaire(form.duree_amortissement)

  const doRename = async (newSerial) => {
    setLoading(true)
    const note = buildActifNote(actif, `Numéro de série modifié de ${actif.id} vers ${newSerial}`, profile?.name)
    const { error } = await renommerActif(supabase, actif.id, newSerial, note)
    setLoading(false)
    if (error) return showToast('Erreur : ' + error.message, 'error')
    showToast(`Numéro de série modifié : ${actif.id} → ${newSerial}`)
    await loadActifs(supabase)
    closeModal()
  }

  const handleSubmit = async () => {
    const newSerial = serial.trim()
    if (!newSerial) return showToast('Le numéro de série / N° Inventaire est obligatoire', 'error')

    const valAch     = Number(form.valeur_achat) || 0
    const residuelle = Number(form.valeur_residuelle) || 0
    if (residuelle > valAch) {
      return showToast("La valeur résiduelle ne peut pas dépasser la valeur d'achat", 'error')
    }

    // Renommage = opération sensible (impacte mouvements + prêts liés) —
    // confirmation dédiée avant d'appeler la RPC, mirrors showConfirm() vanilla.
    if (newSerial !== actif.id) {
      openConfirm({
        title: 'Modifier le numéro de série ?',
        message: `Vous allez changer "${actif.id}" en "${newSerial}". Cette opération met à jour les mouvements et prêts liés. Les sorties et prêts déjà effectués restent intacts.`,
        onConfirm: () => doRename(newSerial),
      })
      return
    }

    setLoading(true)
    const { error } = await submitEditActif(supabase, actif.id, {
      valeur_achat: valAch,
      date_achat: form.date_achat || null,
      fournisseur: form.fournisseur || null,
      duree_amortissement: Number(form.duree_amortissement) || 36,
      valeur_residuelle: residuelle,
    })
    setLoading(false)
    if (error) return showToast('Erreur : ' + error.message, 'error')
    showToast(`Actif "${actif.id}" mis à jour`)
    await loadActifs(supabase)
    closeModal()
  }
  return (
    <Modal
      title={<>✏️ Modifier l&apos;actif — <code className="cell-mono">{actif.id}</code></>}
      onClose={closeModal}
      footer={
        <>
          <Button variant="outline" onClick={closeModal}>Annuler</Button>
          <Button loading={loading} onClick={handleSubmit}>✓ Enregistrer</Button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Produit</label>
        <input className="form-input" value={actif.produit_nom} disabled style={{ fontWeight: 700 }} />
      </div>

      <div className="form-group">
        <label className="form-label">Numéro de série / N° Inventaire</label>
        <input
          className="form-input" value={serial} onChange={e => setSerial(e.target.value)}
          style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}
        />
        <div className="form-hint" style={{ color: '#b45309' }}>
          Modification sensible : met à jour aussi les mouvements et prêts liés. Une confirmation sera demandée.
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Valeur d&apos;achat (MGA)</label>
          <input className="form-input" type="number" min={0} value={form.valeur_achat} onChange={e => set('valeur_achat', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Date d&apos;achat</label>
          <input className="form-input" type="date" value={form.date_achat} onChange={e => set('date_achat', e.target.value)} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Fournisseur</label>
          <select className="form-select" value={form.fournisseur} onChange={e => set('fournisseur', e.target.value)}>
            <option value="">— Non renseigné —</option>
            {fournisseurs.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Durée d&apos;amortissement</label>
          <select className="form-select" value={form.duree_amortissement} onChange={e => set('duree_amortissement', e.target.value)}>
            {DUREES.map(m => <option key={m} value={m}>{m} mois — {tauxLineaire(m)}%/an</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Valeur résiduelle (MGA)</label>
        <input className="form-input" type="number" min={0} value={form.valeur_residuelle} onChange={e => set('valeur_residuelle', e.target.value)} />
        <div className="form-hint">Valeur plancher — la VNC de cet actif ne descendra jamais sous ce montant.</div>
      </div>

      <div className="info-banner" style={{ marginTop: 4 }}>
        Ces valeurs sont propres à <strong>cet actif uniquement</strong> — les autres unités du même produit ne sont pas affectées.
      </div>
    </Modal>
  )
}