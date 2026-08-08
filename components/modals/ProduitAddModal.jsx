'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useDataStore } from '@/store/dataStore'
import { useUiStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase/client'

export default function ProduitAddModal({ dept }) {
  const supabase = createClient()
  const { closeModal, showToast } = useUiStore()
  const { submitAdd, loadProduits, params } = useDataStore()
  const color = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'
  const categories   = dept === 'IT' ? params.categoriesIT : params.categoriesFin
  const emplacements = params.emplacements?.length ? params.emplacements : ['Stock Principal']

  const [form, setForm] = useState({
    nom: '', categorie: categories?.[0] || '', seuil: 5,
    emplacement: emplacements[0], isAmortissable: false,
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.nom.trim() || !form.categorie) return showToast('Nom et catégorie requis', 'error')
    setLoading(true)
    // Stock initialisé à 0 — alimenté via les entrées de stock (cf. MouvementModal).
    // Prix retiré : la valorisation est dérivée du CUMP calculé depuis les mouvements réels.
    const { error } = await submitAdd(supabase, {
      nom: form.nom.trim(),
      categorie: form.categorie,
      dept,
      stock: 0,
      seuil: Number(form.seuil) || 5,
      prix: 0,
      emplacement: form.emplacement,
      valeur_achat: 0,
      date_achat: null,
      duree_amortissement: 36,
      is_amortissable: form.isAmortissable,
      actif: true,
    })
    setLoading(false)
    if (error) return showToast('Erreur: ' + error.message, 'error')
    showToast(`"${form.nom}" créé${form.isAmortissable ? ' (suivi individuel activé)' : ''}`)
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

      <div className="form-group">
        <label className="form-label">Seuil d&apos;alerte critique</label>
        <input className="form-input" type="number" min={0} value={form.seuil} onChange={e => set('seuil', e.target.value)} />
      </div>

      <div style={{
        marginTop: 14, padding: '11px 14px', background: 'var(--green-l)',
        border: '1.5px solid #bbf7d0', borderRadius: 'var(--r-sm)',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
          <input
            type="checkbox" checked={form.isAmortissable}
            onChange={e => set('isAmortissable', e.target.checked)}
            style={{ width: 'auto', accentColor: 'var(--teal)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>Suivi individuel amortissable</span>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>— génère une fiche CNTO-… à chaque entrée</span>
        </label>
      </div>

      <div style={{
        marginTop: 12, padding: '10px 14px', background: 'var(--teal-xl)',
        border: '1px solid var(--teal-l)', borderRadius: 'var(--r-sm)',
        fontSize: 11.5, color: 'var(--teal-d)',
      }}>
        <strong>Stock initialisé à 0.</strong> Le prix et la valeur sont définis lors des entrées de stock.
        Les paramètres financiers (valeur d&apos;achat, durée d&apos;amortissement) se configurent ensuite via ✏ dans l&apos;inventaire.
      </div>
    </Modal>
  )
}