'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useDataStore } from '@/store/dataStore'
import { useUiStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase/client'
import { tauxLineaire } from '@/lib/amortissement'

const DUREES = [12, 24, 36, 48, 60, 84]

export default function ProduitEditModal({ dept, produit }) {
  const supabase = createClient()
  const { closeModal, showToast } = useUiStore()
  const { submitEdit, loadProduits, params } = useDataStore()
  const emplacements = params.emplacements?.length ? params.emplacements : ['Stock Principal']

  const [form, setForm] = useState({
    seuil: produit.seuil || 5,
    prix: produit.prix || 0,
    emplacement: produit.emplacement || emplacements[0],
    valeur_achat: produit.valeur_achat || 0,
    date_achat: produit.date_achat || '',
    duree_amortissement: produit.duree_amortissement || 36,
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const taux = tauxLineaire(form.duree_amortissement)

  const handleSubmit = async () => {
    setLoading(true)
    const { error } = await submitEdit(supabase, produit.id, {
      seuil: Number(form.seuil) || produit.seuil,
      prix: Number(form.prix) || produit.prix,
      emplacement: form.emplacement,
      valeur_achat: Number(form.valeur_achat) || 0,
      date_achat: form.date_achat || null,
      duree_amortissement: Number(form.duree_amortissement) || 36,
      updated_at: new Date().toISOString(),
    })
    setLoading(false)
    if (error) return showToast('Erreur: ' + error.message, 'error')
    showToast('Produit mis à jour')
    await loadProduits(supabase, dept)
    closeModal()
  }

  return (
    <Modal title={`✏️ Modifier — ${produit.nom}`} onClose={closeModal} footer={
      <>
        <Button variant="outline" onClick={closeModal}>Annuler</Button>
        <Button loading={loading} onClick={handleSubmit}>✓ Enregistrer</Button>
      </>
    }>
      <div className="form-group">
        <label className="form-label">Produit</label>
        <input className="form-input" value={produit.nom} disabled style={{ fontWeight: 700 }} />
      </div>

      <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="form-group">
          <label className="form-label">Seuil critique</label>
          <input className="form-input" type="number" min={0} value={form.seuil} onChange={e => set('seuil', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Prix unitaire (MGA)</label>
          <input className="form-input" type="number" min={0} value={form.prix} onChange={e => set('prix', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Emplacement</label>
          <select className="form-select" value={form.emplacement} onChange={e => set('emplacement', e.target.value)}>
            {emplacements.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0', paddingTop: 12, fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>
        💰 Amortissement linéaire{taux ? ` — Taux : ${taux}%/an` : ''}
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

      <div className="form-group">
        <label className="form-label">Durée d&apos;amortissement</label>
        <select className="form-select" value={form.duree_amortissement} onChange={e => set('duree_amortissement', e.target.value)}>
          {DUREES.map(m => <option key={m} value={m}>{m} mois — taux: {tauxLineaire(m)}%/an</option>)}
        </select>
      </div>
    </Modal>
  )
}