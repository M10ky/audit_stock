'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useDataStore } from '@/store/dataStore'
import { useUiStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase/client'
import { tauxLineaire } from '@/lib/amortissement'

const DUREES = [12, 24, 36, 48, 60, 84]

export default function ProduitAddModal({ dept }) {
  const supabase = createClient()
  const { closeModal, showToast } = useUiStore()
  const { submitAdd, loadProduits, params } = useDataStore()
  const color = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'
  const categories   = dept === 'IT' ? params.categoriesIT : params.categoriesFin
  const emplacements = params.emplacements?.length ? params.emplacements : ['Stock Principal']

  const [form, setForm] = useState({
    nom: '', categorie: categories?.[0] || '', stock: 0, seuil: 5, prix: 0,
    emplacement: emplacements[0], valeur_achat: 0, date_achat: '', duree_amortissement: 36,
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.nom.trim() || !form.categorie) return showToast('Nom et catégorie requis', 'error')
    setLoading(true)
    const { error } = await submitAdd(supabase, {
      nom: form.nom.trim(),
      categorie: form.categorie,
      dept,
      stock: Number(form.stock) || 0,
      seuil: Number(form.seuil) || 5,
      prix: Number(form.prix) || 0,
      emplacement: form.emplacement,
      valeur_achat: Number(form.valeur_achat) || 0,
      date_achat: form.date_achat || null,
      duree_amortissement: Number(form.duree_amortissement) || 36,
    })
    setLoading(false)
    if (error) return showToast('Erreur: ' + error.message, 'error')
    showToast(`"${form.nom}" ajouté avec succès`)
    await loadProduits(supabase, dept)
    closeModal()
  }

  return (
    <Modal title="+ Nouveau Produit" onClose={closeModal} footer={
      <>
        <Button variant="outline" onClick={closeModal}>Annuler</Button>
        <Button loading={loading} onClick={handleSubmit}>✓ Créer</Button>
      </>
    }>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Département</label>
          <input className="form-input" value={dept} disabled style={{ color, fontWeight: 700 }} />
        </div>
        <div className="form-group">
          <label className="form-label">Catégorie <span className="req">*</span></label>
          <select className="form-select" value={form.categorie} onChange={e => set('categorie', e.target.value)}>
            {(categories || []).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Nom du produit <span className="req">*</span></label>
        <input className="form-input" value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Ex: Laptop Dell XPS 15…" />
      </div>

      <div className="form-group">
        <label className="form-label">Emplacement</label>
        <select className="form-select" value={form.emplacement} onChange={e => set('emplacement', e.target.value)}>
          {emplacements.map(e => <option key={e}>{e}</option>)}
        </select>
      </div>

      <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="form-group">
          <label className="form-label">Stock initial</label>
          <input className="form-input" type="number" min={0} value={form.stock} onChange={e => set('stock', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Seuil critique</label>
          <input className="form-input" type="number" min={0} value={form.seuil} onChange={e => set('seuil', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Prix unitaire (MGA)</label>
          <input className="form-input" type="number" min={0} value={form.prix} onChange={e => set('prix', e.target.value)} />
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0', paddingTop: 12, fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>
        💰 Amortissement linéaire (optionnel)
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