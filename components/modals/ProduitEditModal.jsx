'use client'
import { useState } from 'react'
import { IconAlertTriangle, IconLock } from '@tabler/icons-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useDataStore } from '@/store/dataStore'
import { useUiStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase/client'
import { tauxLineaire } from '@/lib/amortissement'
import { getCUMPProduit } from '@/lib/helpers'

const DUREES = [12, 24, 36, 48, 60, 84]

export default function ProduitEditModal({ dept, produit }) {
  const supabase = createClient()
  const { closeModal, showToast, openConfirm } = useUiStore()
  const { submitEdit, createAjustementMouvement, loadProduits, loadMouvements, loadMouvementsEntrees, params, mouvementsEntrees } = useDataStore()
  const emplacements = params.emplacements?.length ? params.emplacements : ['Stock Principal']

  const [form, setForm] = useState({
    seuil: produit.seuil || 5,
    emplacement: produit.emplacement || emplacements[0],
    valeur_achat: produit.valeur_achat || 0,
    date_achat: produit.date_achat || '',
    duree_amortissement: produit.duree_amortissement || 36,
    isAmortissable: !!produit.is_amortissable,
    stock: produit.stock || 0,
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const taux = tauxLineaire(form.duree_amortissement)
  const cump = getCUMPProduit(produit.id, mouvementsEntrees)

  // Mirrors js/stock.js updateEditStockHint() : aperçu EN DIRECT de l'écart de
  // stock (non-amortissable uniquement) — pur visuel, la validation réelle
  // recalcule le même écart au submit et demande une confirmation si important.
  const stockParsed  = parseInt(form.stock, 10)
  const diffStock    = isNaN(stockParsed) ? 0 : stockParsed - produit.stock
  const hintReady    = !form.isAmortissable && !isNaN(stockParsed) && stockParsed >= 0 && diffStock !== 0
  const hintPct      = produit.stock > 0 ? Math.abs(diffStock) / produit.stock * 100 : 100
  const hintImportant = Math.abs(diffStock) > 10 || hintPct > 20

  const handleSubmit = async () => {
    // Mirrors js/stock.js submitEdit() : le stock n'est lisible que pour les
    // produits NON amortissables (le champ n'existe même pas sinon). Pour un
    // amortissable, le stock reste piloté à 100% par syncStockDepuisActifs().
    const prodStock    = Number(produit.stock) || 0
    let nouveauStock   = prodStock
    let diffStock      = 0
    if (!form.isAmortissable) {
      const stockParsed = parseInt(form.stock, 10)
      if (isNaN(stockParsed) || stockParsed < 0) { showToast('Stock invalide', 'error'); return }
      nouveauStock = stockParsed
      diffStock = nouveauStock - prodStock
    }

    const doSubmit = async () => {
      setLoading(true)
      // Le champ catalogue "prix" n'est plus édité ici : la valorisation du
      // stock (produits non amortissables) est dérivée automatiquement du CUMP.
      const payload = {
        seuil: Number(form.seuil) || produit.seuil,
        emplacement: form.emplacement,
        valeur_achat: Number(form.valeur_achat) || 0,
        date_achat: form.date_achat || null,
        duree_amortissement: Number(form.duree_amortissement) || 36,
        is_amortissable: form.isAmortissable,
        updated_at: new Date().toISOString(),
      }
      // Le stock n'est envoyé QUE s'il a réellement changé — jamais pour un
      // amortissable (garde-fou explicite, en plus du champ absent du formulaire).
      if (!form.isAmortissable && diffStock !== 0) payload.stock = nouveauStock

      const { error } = await submitEdit(supabase, produit.id, payload)
      if (error) { setLoading(false); return showToast('Erreur: ' + error.message, 'error') }

      // Traçabilité : un ajustement manuel de stock est un mouvement comme un
      // autre dans l'historique — jamais une écriture silencieuse. Créé APRÈS
      // l'update produit réussi ; en cas d'échec, le stock reste modifié mais
      // l'erreur remonte (cohérent avec stock.js, pas de RPC atomique ici).
      if (!form.isAmortissable && diffStock !== 0) {
        const { error: mErr } = await createAjustementMouvement(supabase, produit, diffStock)
        if (mErr) { setLoading(false); return showToast('Erreur: ' + mErr.message, 'error') }
      }

      setLoading(false)
      showToast(diffStock !== 0
        ? `Produit mis à jour — stock ajusté de ${diffStock > 0 ? '+' : ''}${diffStock} (${prodStock} → ${nouveauStock})`
        : 'Produit mis à jour')
      await Promise.all([
        loadProduits(supabase, dept),
        loadMouvements(supabase, dept),
        loadMouvementsEntrees(supabase),
      ])
      closeModal()
    }

    // Mirrors js/stock.js submitEdit() : confirmation si écart important
    // (> 20% du stock actuel OU > 10 unités), sinon soumission directe.
    if (diffStock !== 0) {
      const pct = prodStock > 0 ? Math.abs(diffStock) / prodStock * 100 : 100
      const ecartImportant = Math.abs(diffStock) > 10 || pct > 20
      if (ecartImportant) {
        openConfirm({
          title: "Confirmer l'ajustement de stock ?",
          message: `${produit.nom} : le stock passera de ${prodStock} à ${nouveauStock} (${diffStock > 0 ? '+' : ''}${diffStock}).\n\nCet écart est important — vérifiez la saisie avant de confirmer.`,
          onConfirm: doSubmit,
        })
        return
      }
    }
    doSubmit()
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

      {/* Mirrors js/stock.js stockBlock : amortissable = stock en LECTURE SEULE
          (recalculé par syncStockDepuisActifs depuis les actifs « En service ») ;
          non-amortissable = champ éditable avec aperçu d'écart en direct. */}
      {form.isAmortissable ? (
        <div className="form-group">
          <label className="form-label">Stock actuel</label>
          <input className="form-input" value={produit.stock} disabled style={{ fontWeight: 700 }} />
          <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text3)' }}>
            <IconLock size={11} style={{ verticalAlign: '-1px' }} /> Produit à suivi individuel amortissable : le stock
            est calculé automatiquement à partir du nombre d&apos;actifs « En service » (module Actifs). Non modifiable ici.
          </div>
        </div>
      ) : (
        <div className="form-group">
          <label className="form-label">Stock actuel <span className="req">*</span></label>
          <input className="form-input" type="number" min={0} value={form.stock} onChange={e => set('stock', e.target.value)} />
          {hintReady && (
            <div style={{ marginTop: 5, fontSize: 11, minHeight: 14 }}>
              <span style={{ color: diffStock > 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                {diffStock > 0 ? '+' : ''}{diffStock}
              </span>
              <span style={{ color: 'var(--text3)' }}>
                {' '}({diffStock > 0 ? 'Entrée' : 'Sortie'} d&apos;ajustement à l&apos;enregistrement)
              </span>
              {hintImportant && (
                <div style={{ color: '#b45309', marginTop: 2 }}>
                  <IconAlertTriangle size={11} style={{ verticalAlign: '-1px' }} /> écart important — une confirmation
                  sera demandée
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Seuil critique</label>
          <input className="form-input" type="number" min={0} value={form.seuil} onChange={e => set('seuil', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Emplacement</label>
          <select className="form-select" value={form.emplacement} onChange={e => set('emplacement', e.target.value)}>
            {emplacements.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {!form.isAmortissable && (
        <div style={{
          background: 'var(--teal-xl)', border: '1px solid var(--teal-l)', borderRadius: 'var(--r-sm)',
          padding: '10px 14px', marginBottom: 14, fontSize: 11.5, color: 'var(--teal-d)',
        }}>
          Valeur du stock (CUMP) : <strong>{cump ? Math.round(cump).toLocaleString('fr-FR') : 0} MGA / unité</strong>
          {' '}— calculée automatiquement depuis les entrées enregistrées, non modifiable manuellement.
        </div>
      )}

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

      <div style={{
        marginTop: 6, padding: '11px 14px', background: 'var(--green-l)',
        border: '1.5px solid #bbf7d0', borderRadius: 'var(--r-sm)',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
          <input
            type="checkbox" checked={form.isAmortissable}
            onChange={e => set('isAmortissable', e.target.checked)}
            style={{ width: 'auto', accentColor: 'var(--teal)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>Suivi individuel amortissable</span>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>— génère une fiche numérotée CNTO-… par unité à chaque entrée</span>
        </label>
      </div>
    </Modal>
  )
}