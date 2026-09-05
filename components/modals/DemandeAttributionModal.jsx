'use client'
import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useActifsStore } from '@/store/actifsStore'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDate, genId } from '@/lib/helpers'
import { STATUS_ACTIF } from '@/lib/actifs'

// Mirrors js/app.js renderModalDemAttribution() / submitDemAttribution()
export default function DemandeAttributionModal({ demande, produit, dept }) {
  const supabase = createClient()
  const color = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'
  const { closeModal, showToast } = useUiStore()
  const profile = useAuthStore(s => s.profile)

  const actifs = useActifsStore(s => s.actifs.filter(a => a.produit_id === produit.id && a.statut === STATUS_ACTIF.EN_SERVICE))
  const loadActifs = useActifsStore(s => s.loadActifs)
  const attribuerDemandeManuelle = useActifsStore(s => s.attribuerDemandeManuelle)
  const syncStockDepuisActifs = useActifsStore(s => s.syncStockDepuisActifs)
  const validDemAction = useDataStore(s => s.validDem)
  const loadDemandes = useDataStore(s => s.loadDemandes)
  const loadMouvements = useDataStore(s => s.loadMouvements)
  const loadProduits = useDataStore(s => s.loadProduits)

  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadActifs(supabase).then(() => setReady(true))
  }, []) // eslint-disable-line

  const toggle = (id) => {
    setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id])
  }

  const dispo = actifs
  const insuffisant = ready && dispo.length < demande.qty

  const handleSubmit = async () => {
    if (selected.length !== demande.qty) {
      return showToast(`Sélectionnez exactement ${demande.qty} matériel(s) (${selected.length} sélectionné(s))`, 'error')
    }
    setLoading(true)
    const { error } = await attribuerDemandeManuelle(
      supabase,
      { demande, produit, dept, dest: demande.dest, actifIds: selected },
      profile
    )
    setLoading(false)
    if (error) return showToast('Erreur : ' + error.message, 'error')

    // rpc_attribuer_demande met déjà à jour le statut de la demande côté SQL ;
    // on synchronise le reste du state client comme après toute mutation.
    showToast(`Demande validée — ${selected.length} matériel(s) attribué(s)`)
    await Promise.all([
      loadDemandes(supabase, dept),
      loadMouvements(supabase, dept),
    ])
    await syncStockDepuisActifs(supabase, produit.id)
    await loadProduits(supabase, dept)
    closeModal()
  }

  if (ready && insuffisant) {
    return (
      <Modal title={`Attribution — ${demande.produit}`} size="lg" onClose={closeModal} footer={
        <Button variant="outline" onClick={closeModal}>Fermer</Button>
      }>
        <div className="login-alert error">
          <strong>{dispo.length}</strong> matériel(s) « En service » disponible(s), mais{' '}
          <strong>{demande.qty}</strong> demandé(s). Complétez le stock (entrée) ou ajustez la demande
          avant de valider.
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title={`📋 Attribution de matériel — ${demande.produit}`}
      size="lg"
      onClose={closeModal}
      footer={
        <>
          <Button variant="outline" onClick={closeModal}>Annuler</Button>
          <Button loading={loading} style={{ background: color, borderColor: color }} onClick={handleSubmit}>
            ✓ Attribuer et valider
          </Button>
        </>
      }
    >
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
        Demande de <strong>{demande.demandeur}</strong> · {demande.produit} · quantité demandée : <strong>{demande.qty}</strong>
      </div>

      <div className="form-group">
        <label className="form-label">Matériels à attribuer <span className="req">*</span></label>
        <div style={{ maxHeight: 260, overflowY: 'auto', overflowX: 'auto', border: '1.5px solid var(--border)', borderRadius: 8 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>N° CNTO / Série</th><th>Emplacement</th><th>Valeur achat</th><th>Date entrée</th>
              </tr>
            </thead>
            <tbody>
              {dispo.map(a => (
                <tr key={a.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(a.id)}
                      onChange={() => toggle(a.id)}
                    />
                  </td>
                  <td className="cell-mono">{a.id}</td>
                  <td className="text-muted">{a.emplacement || '—'}</td>
                  <td className="text-muted">{fmt(a.valeur_achat)} MGA</td>
                  <td className="text-muted">{fmtDate(a.date_entree)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="form-hint">
          <strong>{selected.length}</strong> / {demande.qty} matériel(s) sélectionné(s)
        </div>
      </div>
    </Modal>
  )
}