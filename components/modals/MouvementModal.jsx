'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { createClient } from '@/lib/supabase/client'
import { getCUMPProduit, genId, isActif, fmt, fmtDate } from '@/lib/helpers'
import { STATUS_ACTIF } from '@/lib/actifs'
import { useActifsStore } from '@/store/actifsStore'

export default function MouvementModal({ mvtType, dept, prodId: initialProdId }) {
  const supabase = createClient()
  const isEntree = mvtType === 'entree'
  const color = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  // Mirrors js/stock.js : le sélecteur n'expose que les produits ACTIFS
  // (les inactifs restent dans le stock mais ne sont plus concernés par les
  // mouvements — réactivation possible via le toggle de l'inventaire).
  const produits          = useDataStore(s => s.produits.filter(p => p.dept === dept && isActif(p)))
  const params            = useDataStore(s => s.params)
  const mouvementsEntrees = useDataStore(s => s.mouvementsEntrees)
  const allProfiles = useAuthStore(s => s.allProfiles)
  const profile     = useAuthStore(s => s.profile)
  const { closeModal, showToast, isSubmitting, withSubmitLock } = useUiStore()
  const { submitMvt, loadProduits, loadMouvements, loadMouvementsEntrees } = useDataStore()
  const createActifUnits      = useActifsStore(s => s.createActifUnits)
  const syncStockDepuisActifs = useActifsStore(s => s.syncStockDepuisActifs)
  const actifs                = useActifsStore(s => s.actifs)
  const loadActifs            = useActifsStore(s => s.loadActifs)

  const [prodId, setProdId]   = useState(initialProdId || '')
  const [qty, setQty]         = useState(1)
  const [prixUnit, setPrixUnit] = useState('')
  const [prixEdited, setPrixEdited] = useState(false)
  const [userName, setUserName] = useState(profile?.name || '')
  const [dest, setDest]       = useState('')
  const [empl, setEmpl]       = useState('')
  const [obs, setObs]         = useState('')
  const [refDoc, setRefDoc]   = useState('')
  // Numéros de série manuels (optionnel) — un numéro par ligne, dans l'ordre
  // de saisie. Validé strictement au submit (miroir du Vanilla stock.js) :
  // si des lignes sont saisies, elles doivent être exactement au nombre de
  // la quantité et sans doublon — sinon génération automatique CNTO-… .
  const [manualSerialsText, setManualSerialsText] = useState('')
  const [fournisseur, setFournisseur] = useState('')
  // Sortie amortissable : liste des actifs cochés (statut EN_SERVICE) à sortir.
  const [selectedActifIds, setSelectedActifIds] = useState([])
  const [loading, setLoading] = useState(false)
  const busy = loading || isSubmitting

  const destinations  = params.destinations || []
  const emplacements  = params.emplacements?.length ? params.emplacements : ['Stock Principal']
  const prod = produits.find(p => p.id === prodId)
  const cump = prod ? getCUMPProduit(prod.id, mouvementsEntrees) : 0

  // Mirrors js/stock.js renderActifSortieSelector() : seuls les actifs "En
  // service" sont proposés à la sortie — déjà sortis, en prêt, réformés ou
  // hors service sont exclus explicitement (et documentés dans le compteur).
  const prodActifs    = prodId ? actifs.filter(a => a.produit_id === prodId) : []
  const actifsDispo   = prodActifs.filter(a => a.statut === STATUS_ACTIF.EN_SERVICE)
  const actifsIndispo = prodActifs.filter(a => a.statut !== STATUS_ACTIF.EN_SERVICE)
  const actifSortieSel = mvtType === 'sortie' && prod?.is_amortissable

  const handleProdChange = (val) => { setProdId(val); setSelectedActifIds([]) }

  const toggleActifSortie = (id) =>
    setSelectedActifIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

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
    if (!prod) return showToast('Produit introuvable', 'error')
    // Mirrors js/stock.js submitMvt() : garde produit désactivé au submit,
    // même si un ID inactif aurait été injecté dans le sélecteur.
    if (!isActif(prod)) return showToast('Ce produit est inactif — réactivez-le avant de saisir un mouvement', 'error')

    // Mirrors js/stock.js submitMvt() : validations par type — une sortie
    // amortissable part des actifs cochés (jamais de quantité manuelle).
    if (actifSortieSel) {
      if (!selectedActifIds.length) {
        return showToast('Vous devez sélectionner au moins un matériel à sortir', 'error')
      }
      // Vérification de disponibilité en temps réel (bloque les actifs déjà
      // sortis/en prêt/etc.) — relecture fraîche depuis Supabase, comme le
      // Vanilla (loadActifs() puis contrôle sur ST.actifs).
      await loadActifs(supabase)
      const frais = useActifsStore.getState().actifs
      for (const id of selectedActifIds) {
        const a = frais.find(x => x.id === id)
        if (!a || a.statut !== STATUS_ACTIF.EN_SERVICE) {
          return showToast(`Le matériel ${id} n'est plus disponible (statut : ${a?.statut || 'inconnu'})`, 'error')
        }
      }
    } else if (mvtType === 'sortie' && !prod.is_amortissable) {
      if (!qty || qty <= 0) return showToast('Quantité invalide', 'error')
      if (prod.stock < Number(qty)) return showToast(`Stock insuffisant (${prod.stock} disponible)`, 'error')
    } else if (isEntree) {
      if (!qty || qty <= 0) return showToast('Quantité invalide', 'error')
      if (!prixUnit || Number(prixUnit) <= 0) return showToast('Le prix unitaire est obligatoire pour une entrée', 'error')
    }
    if (mvtType === 'sortie' && !dest) return showToast('Veuillez indiquer la destination', 'error')

    setLoading(true)
    const tsNow = new Date().toISOString()
    const mvtId = genId(dept === 'IT' ? 'MVT-IT' : 'MVT-FIN')
    const isAmortEntree = isEntree && prod.is_amortissable

    // Pour une entrée sur produit amortissable : les actifs sont créés
    // AVANT toute écriture sur mouvements/produits. Si ça échoue, rien
    // d'autre n'a été touché — pas de mouvement orphelin.
    if (isAmortEntree) {
      // Mirrors js/stock.js (validation N° série) : si des numéros sont
      // saisis, ils doivent être EXACTEMENT au nombre de la quantité et sans
      // doublon — un champ vide déclenche la génération automatique CNTO-… .
      const manualSerials = manualSerialsText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
      if (manualSerials.length > 0 && manualSerials.length !== Number(qty)) {
        setLoading(false)
        return showToast(`${qty} numéro(s) de série requis — ${manualSerials.length} saisi(s)`, 'error')
      }
      if (new Set(manualSerials).size !== manualSerials.length) {
        setLoading(false)
        return showToast('Numéros de série en double détectés', 'error')
      }
      const { ok, message } = await createActifUnits(supabase, {
        prod, qty: Number(qty), mvtId, emplacement: empl, prixUnit: Number(prixUnit),
        manualSerials,
      })
      if (!ok) { setLoading(false); return showToast('Erreur (actifs) : ' + message, 'error') }
    }

    // Mirrors js/stock.js submitMvt() : la quantité effective d'une sortie
    // amortissable équivaut au nombre d'actifs cochés (le champ Quantité est
    // masqué dans ce cas).
    const effectiveQty = selectedActifIds.length > 0 ? selectedActifIds.length : Number(qty)

    // Le stock d'un produit amortissable n'est jamais modifié à la main —
    // il est recalculé juste après depuis le nombre réel d'actifs "En
    // service" (syncStockDepuisActifs), seule source de vérité.
    const updateData = { updated_at: tsNow }
    if (!prod.is_amortissable) {
      updateData.stock = isEntree ? prod.stock + effectiveQty : prod.stock - effectiveQty
    }
    if (isEntree && empl) updateData.emplacement = empl

    const { error: sErr } = await supabase.from('produits').update(updateData).eq('id', prodId)
    if (sErr) { showToast('Erreur: ' + sErr.message, 'error'); setLoading(false); return }

    // Mirrors js/stock.js submitMvt() : une sortie amortissable ne crée PAS
    // de mouvement global — un mouvement PAR actif (actif_id renseigné), et
    // le statut des actifs passe à 'Sorti' AVANT l'insertion (si la
    // contrainte CHECK rejette la mise à jour, aucun mouvement orphelin).
    if (mvtType === 'sortie' && selectedActifIds.length > 0) {
      const { error: aErr } = await supabase
        .from('actifs_individuels')
        .update({ statut: STATUS_ACTIF.SORTI })
        .in('id', selectedActifIds)
      if (aErr) { showToast('Erreur: ' + aErr.message, 'error'); setLoading(false); return }

      const actifsMap = Object.fromEntries(useActifsStore.getState().actifs.map(a => [a.id, a]))
      const mvtRows = selectedActifIds.map(actifId => {
        const actif = actifsMap[actifId]
        return {
          id: genId(dept === 'IT' ? 'MVT-IT' : 'MVT-FIN'),
          date: tsNow.split('T')[0],
          created_at: tsNow,
          type: 'Sortie',
          produit_id: prodId,
          produit_nom: prod.nom,
          actif_id: actifId,
          qty: 1,
          valeur: actif?.valeur_achat || 0,
          dept,
          user_name: userName || profile?.name || 'Système',
          user_id: profile?.id,
          destination: dest,
          emplacement: empl,
          ref_document: refDoc,
          fournisseur,
          observation: obs || `Sortie individuelle — ${actifId}`,
        }
      })
      const { error: mBatchErr } = await supabase.from('mouvements').insert(mvtRows)
      if (mBatchErr) { showToast('Erreur: ' + mBatchErr.message, 'error'); setLoading(false); return }
    } else {
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
        qty: effectiveQty,
        valeur: effectiveQty * valeurUnitaire,
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
    }

    // Mirrors js/stock.js submitMvt() : le stock d'un produit amortissable est
    // recalculé depuis les actifs réels après CHAQUE opération (entrée ET sortie).
    if (prod.is_amortissable) {
      await syncStockDepuisActifs(supabase, prodId)
    }

    setLoading(false)

    // Mirrors js/stock.js submitMvt() : toasts spécifiques selon le type —
    // entrée amortissable (actifs créés), sortie amortissable (liste des
    // actifs sortis), sinon message générique avec la quantité effective.
    if (isAmortEntree) {
      showToast(`Entrée enregistrée + ${qty} actif(s) créé(s)`)
    } else if (mvtType === 'sortie' && selectedActifIds.length > 0) {
      const list = selectedActifIds.length <= 3
        ? selectedActifIds.join(', ')
        : `${selectedActifIds.slice(0, 3).join(', ')} +${selectedActifIds.length - 3}`
      showToast(`Sortie de ${selectedActifIds.length} actif(s) enregistrée : ${list}`)
    } else {
      showToast(`${isEntree ? 'Entrée' : 'Sortie'} enregistrée — ${effectiveQty}× ${prod.nom}`)
    }

    await Promise.all([
      loadProduits(supabase, dept),
      loadMouvements(supabase, dept),
      loadMouvementsEntrees(supabase),
      loadActifs(supabase),
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
          <Button variant={isEntree ? 'primary' : 'danger'} loading={busy} disabled={busy} onClick={handleSubmit}>
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
        <select className="form-select" value={prodId} onChange={e => handleProdChange(e.target.value)}>
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
        <>
          {actifSortieSel ? (
            <div className="form-group">
              <label className="form-label">Matériels à sortir <span className="req">*</span></label>
              {actifsDispo.length ? (
                <>
                  <div style={{ maxHeight: 220, overflowY: 'auto', overflowX: 'auto', border: '1.5px solid var(--border)', borderRadius: 8 }}>
                    <table style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ width: 30 }} />
                          <th>N° CNTO / Série</th>
                          <th>Emplacement</th>
                          <th>Valeur achat</th>
                          <th>Date entrée</th>
                          <th>État</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actifsDispo.map(a => (
                          <tr key={a.id}>
                            <td>
                              <input
                                type="checkbox"
                                className="f-actif-sortie-chk"
                                checked={selectedActifIds.includes(a.id)}
                                onChange={() => toggleActifSortie(a.id)}
                              />
                            </td>
                            <td><code>{a.id}</code></td>
                            <td style={{ fontSize: 11 }}>{a.emplacement || '—'}</td>
                            <td style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{fmt(a.valeur_achat)} MGA</td>
                            <td style={{ fontSize: 11 }}>{fmtDate(a.date_entree)}</td>
                            <td>{a.statut}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="form-hint" style={{ marginTop: 6 }}>
                    <strong>{selectedActifIds.length}</strong> matériel(s) sélectionné(s)
                    {actifsIndispo.length > 0 && ` · ${actifsIndispo.length} non disponible(s) (déjà sorti/en prêt/hors service)`}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 12 }}>
                  <span style={{ fontSize: 14 }}>⚠</span>
                  <span>
                    Aucun matériel « En service » disponible pour ce produit
                    {actifsIndispo.length > 0 && ` (${actifsIndispo.length} déjà sorti / en prêt / hors service)`}.
                  </span>
                </div>
              )}
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
          {actifSortieSel && (
            <div className="form-group">
              <label className="form-label">Agent <span className="req">*</span></label>
              <select className="form-select" value={userName} onChange={e => setUserName(e.target.value)}>
                {usersOptions.map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          )}
        </>
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

      {isEntree && prod?.is_amortissable && (
        <div className="form-group">
          <label className="form-label">Numéros de série / N° Inventaire (optionnel)</label>
          <textarea
            className="form-textarea"
            rows={Math.min(Math.max(Number(qty) || 1, 2), 6)}
            value={manualSerialsText}
            onChange={e => setManualSerialsText(e.target.value)}
            placeholder={`Un numéro par ligne (${qty || 1} attendu(s))…\nLaissez vide pour générer automatiquement CNTO-…`}
          />
          <div className="form-hint">
            {manualSerialsText.trim()
              ? `${manualSerialsText.split('\n').map(s => s.trim()).filter(Boolean).length} numéro(s) saisi(s) sur ${qty || 1} unité(s) — les unités restantes seront numérotées automatiquement.`
              : 'Laissez vide pour numéroter automatiquement toutes les unités (CNTO-…).'}
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Observation / Motif</label>
        <input className="form-input" value={obs} onChange={e => setObs(e.target.value)} placeholder="Précisions sur l'opération…" />
      </div>
    </Modal>
  )
}