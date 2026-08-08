// TODO: Étape E — Zustand store: actifs individuels
import { create } from 'zustand'
import { genId } from '@/lib/helpers'
import { getCatAbbr, generateNomenclature, buildActifNote } from '@/lib/actifs'

export const useActifsStore = create((set, get) => ({

  // ── State ───────────────────────────────────────────────────
  actifs:        [],
  loadingActifs: false,

  // ══════════════════════════════════════════════════════════
  //  LOADER
  // ══════════════════════════════════════════════════════════
  loadActifs: async (supabase) => {
    set({ loadingActifs: true })
    const { data, error } = await supabase
      .from('actifs_individuels')
      .select('*')
      .order('date_entree', { ascending: false })
    if (!error && data) set({ actifs: data })
    set({ loadingActifs: false })
    return { data, error }
  },

  // ══════════════════════════════════════════════════════════
  //  CRÉATION AUTOMATIQUE D'ACTIFS À L'ENTRÉE DE STOCK
  //  Appelée AVANT toute écriture sur mouvements/produits (cf.
  //  MouvementModal) : si ça échoue ici, rien d'autre n'est écrit.
  // ══════════════════════════════════════════════════════════
  createActifUnits: async (supabase, { prod, qty, mvtId, emplacement, manualSerials = [], prixUnit = null }) => {
    try {
      const deptCode  = prod.dept === 'IT' ? 'IT' : 'FIN'
      const catAbbr   = getCatAbbr(prod.categorie)
      const nomPrefix = `CNTO-${deptCode}-${catAbbr}`

      let lastSeq = 0
      const { data: seqRow, error: seqRErr } = await supabase
        .from('serial_sequences')
        .select('current_seq')
        .eq('produit_id', prod.id)
        .maybeSingle()
      if (seqRErr) throw seqRErr
      if (seqRow) lastSeq = seqRow.current_seq || 0

      const year = new Date().getFullYear()
      const now  = new Date().toISOString()
      const actifs = []

      for (let i = 0; i < qty; i++) {
        const seq = lastSeq + i + 1
        const actifId = (manualSerials[i] && manualSerials[i].trim())
          ? manualSerials[i].trim()
          : generateNomenclature(prod.id, year, seq)

        actifs.push({
          id:                  actifId,
          produit_id:          prod.id,
          produit_nom:         prod.nom,
          categorie:           prod.categorie || '',
          dept:                prod.dept,
          emplacement:         emplacement || prod.emplacement || '',
          date_entree:         now,
          // Toujours le prix de CETTE entrée précise — jamais un repli sur
          // produits.valeur_achat (champ catalogue rarement configuré).
          valeur_achat:        (prixUnit !== null && prixUnit > 0) ? prixUnit : 0,
          date_achat:          now.slice(0, 10),
          duree_amortissement: prod.duree_amortissement || 36,
          statut:              'En service',
          mouvement_entree_id: mvtId,
          observation:         '',
          // created_at / updated_at omis volontairement : gérés par les
          // DEFAULT now() de la table, on ne prend pas parti sur leur
          // présence réelle dans le schéma.
        })
      }

      const { error: insErr } = await supabase.from('actifs_individuels').insert(actifs)
      if (insErr) throw insErr

      const { error: seqWErr } = await supabase.from('serial_sequences').upsert(
        { produit_id: prod.id, current_seq: lastSeq + qty, prefix: nomPrefix, updated_at: now },
        { onConflict: 'produit_id' }
      )
      if (seqWErr) throw seqWErr

      await get().loadActifs(supabase)
      return { ok: true, first: actifs[0].id, last: actifs[actifs.length - 1].id }
    } catch (err) {
      console.error('[createActifUnits]', err)
      return { ok: false, message: err?.message || err?.error_description || String(err) }
    }
  },

  // ══════════════════════════════════════════════════════════
  //  SYNCHRONISATION INVENTAIRE ↔ ACTIFS
  //  Relit le produit EN DIRECT depuis la DB (pas un objet passé par
  //  l'appelant, potentiellement périmé) pour décider s'il est
  //  amortissable, puis recalcule son stock depuis le nombre réel
  //  d'actifs "En service". Ne recharge pas dataStore.produits —
  //  c'est à l'appelant de le faire après (découplage des stores).
  // ══════════════════════════════════════════════════════════
  syncStockDepuisActifs: async (supabase, produitId) => {
    if (!produitId) return { skipped: true }
    try {
      const { data: produit, error: pErr } = await supabase
        .from('produits')
        .select('id, stock, is_amortissable')
        .eq('id', produitId)
        .single()
      if (pErr || !produit || !produit.is_amortissable) return { skipped: true }

      await get().loadActifs(supabase)
      const nbDisponible = get().actifs.filter(
        a => a.produit_id === produitId && a.statut === 'En service'
      ).length

      if (nbDisponible === produit.stock) return { skipped: true }

      const { error } = await supabase
        .from('produits')
        .update({ stock: nbDisponible, updated_at: new Date().toISOString() })
        .eq('id', produitId)
      if (error) throw error

      return { updated: true, nbDisponible }
    } catch (err) {
      console.error('[syncStockDepuisActifs]', err)
      return { error: err }
    }
  },

  // ══════════════════════════════════════════════════════════
  //  ATTRIBUTION D'UNE DEMANDE SUR UN PRODUIT AMORTISSABLE
  //  Sélectionne les `qty` actifs "En service" les plus anciens (FIFO
  //  par date_entree), puis délègue à la RPC atomique dédiée. Centralisé
  //  ici — pas dans DemandesTable — pour qu'un futur flux de Sortie
  //  manuelle réutilise la même règle sans la dupliquer.
  // ══════════════════════════════════════════════════════════
  attribuerDemandeAmortissable: async (supabase, { demande, produit, dept, dest }, profile) => {
    await get().loadActifs(supabase)
    const disponibles = get().actifs
      .filter(a => a.produit_id === produit.id && a.statut === 'En service')
      .sort((a, b) => new Date(a.date_entree) - new Date(b.date_entree))

    if (disponibles.length < demande.qty) {
      return {
        error: {
          message: `Stock insuffisant : ${disponibles.length} unité(s) disponible(s), ${demande.qty} demandée(s)`,
        },
      }
    }

    const selected  = disponibles.slice(0, demande.qty)
    const actifIds  = selected.map(a => a.id)
    const mvtPrefix = dept === 'IT' ? 'MVT-IT' : 'MVT-FIN'
    const mvtIds    = actifIds.map(() => genId(mvtPrefix))

    const { error } = await supabase.rpc('rpc_attribuer_demande', {
      p_dem_id:     demande.id,
      p_produit_id: produit.id,
      p_actif_ids:  actifIds,
      p_dept:       dept,
      p_dest:       dest || null,
      p_mvt_ids:    mvtIds,
      p_user_name:  profile?.name || 'Système',
      p_user_id:    profile?.id || null,
    })
    if (error) return { error }

    await get().loadActifs(supabase)
    return { ok: true, actifIds }
  },

  // ══════════════════════════════════════════════════════════
  //  ACTIONS SUR LE CYCLE DE VIE D'UN ACTIF
  //  La note d'audit est construite ici (buildActifNote), jamais par
  //  le composant appelant — un seul format, un seul endroit à changer.
  // ══════════════════════════════════════════════════════════

  horsServiceActif: async (supabase, actif, profile) => {
    const note = buildActifNote(actif, 'Mis hors service', profile?.name)
    const { error } = await supabase
      .from('actifs_individuels')
      .update({ statut: 'Hors service', observation: note })
      .eq('id', actif.id)
    return { error }
  },

  // Remise en service directe. Si l'actif est "En prêt", le retour DOIT
  // passer par le module Prêts (Étape F) — sinon l'actif redevient
  // "En service" pendant que son prêt reste affiché "En cours", deux
  // vérités contradictoires pour la même ligne. Bloqué explicitement
  // plutôt que mal implémenté tant que le module n'existe pas.
  reactiverActif: async (supabase, actif, profile) => {
    if (actif.statut === 'En prêt') {
      return {
        error: {
          message: "Cet actif est en prêt — le retour doit passer par le module Prêts (à venir, Étape F).",
        },
      }
    }
    const note = buildActifNote(actif, 'Remise en service', profile?.name)
    const { error } = await supabase
      .from('actifs_individuels')
      .update({ statut: 'En service', observation: note })
      .eq('id', actif.id)
    return { error }
  },

  reformerActif: async (supabase, actif, profile) => {
    const note = buildActifNote(actif, 'Réformé', profile?.name)
    const { error } = await supabase
      .from('actifs_individuels')
      .update({ statut: 'Réformé', observation: note })
      .eq('id', actif.id)
    return { error }
  },

  changerEmplacementActif: async (supabase, actifId, nouvelEmplacement, note) => {
    const { error } = await supabase
      .from('actifs_individuels')
      .update({ emplacement: nouvelEmplacement, observation: note })
      .eq('id', actifId)
    return { error }
  },

  submitEditActif: async (supabase, actifId, payload) => {
    const { error } = await supabase
      .from('actifs_individuels')
      .update(payload)
      .eq('id', actifId)
    return { error }
  },

  // Réintégration d'un actif "Sorti" — DOIT réincrémenter le stock du
  // produit, d'où la RPC atomique dédiée plutôt qu'un simple update.
  reintegrerActif: async (supabase, actifId, profile) => {
    const { error } = await supabase.rpc('rpc_reintegrer_actif', {
      p_actif_id:  actifId,
      p_user_name: profile?.name || 'Système',
      p_user_id:   profile?.id || null,
      p_obs:       '',
    })
    return { error }
  },

  // ══════════════════════════════════════════════════════════
  //  REALTIME — mise à jour locale
  // ══════════════════════════════════════════════════════════
  onRealtimeActif: (payload) => {
    const { eventType, new: row, old } = payload
    set((s) => {
      if (eventType === 'INSERT') return { actifs: [row, ...s.actifs] }
      if (eventType === 'UPDATE')
        return { actifs: s.actifs.map((a) => (a.id === row.id ? row : a)) }
      if (eventType === 'DELETE')
        return { actifs: s.actifs.filter((a) => a.id !== old.id) }
      return s
    })
  },

  resetActifs: () => set({ actifs: [] }),
}))