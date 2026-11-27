import { create } from 'zustand'
import { genId, getCUMPProduit } from '@/lib/helpers'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { isAdmin, isLecteur, canManIT, canManFin, canDemIT, canDemFin } from '@/lib/permissions'

function dayBoundsISO() {
  const { dateFrom, dateTo } = useUiStore.getState()
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : null
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : null
  return { from, to }
}

export const useDataStore = create((set, get) => ({

  // ── State ───────────────────────────────────────────────────
  produits:                [],
  mouvements:              [],
  demandes:                [],
  mouvementsEntrees:       [],   // ← Étape D+ : entrées sans filtre date (valeur cumulée)
  params:                  {},
  paramsRaw:               [],

  loadingProduits:         false,
  loadingMouvements:       false,
  loadingDemandes:         false,
  loadingParams:           false,
  loadingMouvementsEntrees:false,

  // ══════════════════════════════════════════════════════════
  //  LOADERS
  // ══════════════════════════════════════════════════════════

  loadProduits: async (supabase, dept) => {
    set({ loadingProduits: true })
    let q = supabase.from('produits').select('*').order('nom')
    if (dept && dept !== 'both') q = q.eq('dept', dept)
    const { data, error } = await q
    if (!error && data) set({ produits: data })
    set({ loadingProduits: false })
    return { data, error }
  },

  loadMouvements: async (supabase, dept) => {
    set({ loadingMouvements: true })
    const { from, to } = dayBoundsISO()
    let q = supabase
      .from('mouvements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (dept && dept !== 'both') q = q.eq('dept', dept)
    if (from) q = q.gte('created_at', from)
    if (to) q = q.lte('created_at', to)
    const { data, error } = await q
    if (!error && data) set({ mouvements: data })
    set({ loadingMouvements: false })
    return { data, error }
  },

  loadDemandes: async (supabase, dept) => {
    set({ loadingDemandes: true })
    const { from, to } = dayBoundsISO()
    let q = supabase
      .from('demandes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    if (dept && dept !== 'both') q = q.eq('dept', dept)
    if (from) q = q.gte('created_at', from)
    if (to) q = q.lte('created_at', to)
    const { data, error } = await q
    if (!error && data) set({ demandes: data })
    set({ loadingDemandes: false })
    return { data, error }
  },

  loadParams: async (supabase) => {
    set({ loadingParams: true })
    const { data, error } = await supabase
      .from('parametres')
      .select('*')
      .order('valeur')

    if (!error && data) {
      set({
        params: {
          destinations:  data.filter(r => r.cle === 'destinations').map(r => r.valeur),
          categoriesIT:  data.filter(r => r.cle === 'categoriesIT').map(r => r.valeur),
          categoriesFin: data.filter(r => r.cle === 'categoriesFin').map(r => r.valeur),
          emplacements:  data.filter(r => r.cle === 'emplacements').map(r => r.valeur),
          fournisseurs:  data.filter(r => r.cle === 'fournisseurs').map(r => r.valeur),
        },
        paramsRaw: data,
      })
    }
    set({ loadingParams: false })
    return { data, error }
  },

  /**
   * Charge TOUTES les entrées (sans filtre de date) pour calculer
   * la valeur cumulée par produit (getValeurTotaleProduit).
   * Sélection minimale : produit_id + valeur.
   * Règle métier : `created_at` alimente le CUMP daté (getCUMPProduit avec
   * asOfISO) pour valoriser une sortie saisie rétroactivement.
   */
  loadMouvementsEntrees: async (supabase) => {
    set({ loadingMouvementsEntrees: true })
    const { data, error } = await supabase
      .from('mouvements')
      .select('produit_id, qty, valeur, created_at')
      .eq('type', 'Entrée')
    if (!error && data) set({ mouvementsEntrees: data })
    set({ loadingMouvementsEntrees: false })
    return { data, error }
  },

  // ══════════════════════════════════════════════════════════
  //  PRODUITS — MUTATIONS
  // ══════════════════════════════════════════════════════════

  submitAdd: async (supabase, payload) => {
    const profile = useAuthStore.getState().profile
    const canWrite = payload?.dept === 'IT' ? canManIT(profile) : canManFin(profile)
    if (!canWrite) return { ok: false, error: { message: 'Accès refusé : gestion de stock non autorisée' }, message: 'Accès refusé : gestion de stock non autorisée' }
    // Préfixe dérivé du département, miroir exact de js/stock.js:
    // genId(dept === 'IT' ? 'IT' : 'FIN'). Sans ce préfixe, generateNomenclature()
    // (Étape E) produirait des numéros CNTO-… incohérents pour ce produit.
    const prefix = payload.dept === 'IT' ? 'IT' : 'FIN'
    const { error } = await supabase
      .from('produits')
      .insert([{ id: genId(prefix), ...payload }])
    return { ok: !error, error }
  },

  submitEdit: async (supabase, id, payload) => {
    const profile = useAuthStore.getState().profile
    const existing = get().produits.find(p => p.id === id)
    const dept = payload?.dept || existing?.dept
    const canWrite = dept === 'IT' ? canManIT(profile) : canManFin(profile)
    if (!canWrite) return { ok: false, error: { message: 'Accès refusé : gestion de stock non autorisée' }, message: 'Accès refusé : gestion de stock non autorisée' }
    const { error } = await supabase
      .from('produits')
      .update(payload)
      .eq('id', id)
    return { ok: !error, error }
  },

  // Mirrors js/stock.js createAjustementMouvement() : un ajustement manuel de
  // stock (modale ✏ Édition) n'écrit JAMAIS produits.stock en silence — il
  // génère un mouvement Entrée/Sortie visible dans l'historique, exactement
  // comme une réception ou une sortie normale. Valorisé au CUMP courant du
  // produit (jamais un champ "prix" catalogue). Réservé aux produits non
  // amortissables — appelant unique : ProduitEditModal.
  createAjustementMouvement: async (supabase, prod, diff) => {
    const typeMvt = diff > 0 ? 'Entrée' : 'Sortie'
    const qty     = Math.abs(diff)
    const cump    = getCUMPProduit(prod.id, get().mouvementsEntrees)
    const mvtId   = genId(prod.dept === 'IT' ? 'MVT-IT' : 'MVT-FIN')
    const profile = useAuthStore.getState().profile
    const { error } = await supabase.from('mouvements').insert({
      id: mvtId,
      date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      type: typeMvt,
      produit_id: prod.id,
      produit_nom: prod.nom,
      qty,
      valeur: Math.round(qty * cump),
      dept: prod.dept,
      user_name: profile?.name || 'Système',
      user_id: profile?.id || null,
      destination: '',
      emplacement: prod.emplacement || '',
      ref_document: '',
      fournisseur: '',
      observation: `Ajustement manuel de stock (${prod.stock} → ${prod.stock + diff}) via modale Édition`,
    })
    return { error }
  },

  deleteProduit: async (supabase, id) => {
    const profile = useAuthStore.getState().profile
    const existing = get().produits.find(p => p.id === id)
    const canWrite = existing?.dept === 'IT' ? canManIT(profile) : canManFin(profile)
    if (!canWrite) return { ok: false, error: { message: 'Accès refusé : gestion de stock non autorisée' }, message: 'Accès refusé : gestion de stock non autorisée' }
    const { error } = await supabase
      .from('produits')
      .delete()
      .eq('id', id)
    return { ok: !error, error }
  },

  // Mirrors js/stock.js toggleProductActif() : bascule actif/inactif d'un produit.
  // updated_at horodaté (nowISO() du Vanilla) pour alimenter la colonne « Dernière MAJ».
  toggleProductActif: async (supabase, id, actif) => {
    const profile = useAuthStore.getState().profile
    const existing = get().produits.find(p => p.id === id)
    const canWrite = existing?.dept === 'IT' ? canManIT(profile) : canManFin(profile)
    if (!canWrite) return { ok: false, error: { message: 'Accès refusé : gestion de stock non autorisée' }, message: 'Accès refusé : gestion de stock non autorisée' }
    const { error } = await supabase
      .from('produits')
      .update({ actif, updated_at: new Date().toISOString() })
      .eq('id', id)
    return { ok: !error, error }
  },

  // ══════════════════════════════════════════════════════════
  //  MOUVEMENTS — MUTATIONS
  // ══════════════════════════════════════════════════════════

  submitMvt: async (supabase, payload) => {
    // Mirrors js/stock.js: genId(dept === 'IT' ? 'MVT-IT' : 'MVT-FIN').
    // Accepte désormais un id explicite (payload.id) — nécessaire quand
    // l'appelant doit connaître l'id AVANT l'insertion (ex: MouvementModal
    // lie mouvement_entree_id sur des actifs créés avant ce mouvement).
    // Repli sur genId(prefix) si absent — comportement inchangé pour tous
    // les appelants existants.
    const prefix = payload.dept === 'IT' ? 'MVT-IT' : 'MVT-FIN'
    const { id: explicitId, ...rest } = payload
    const id = explicitId || genId(prefix)
    const { error } = await supabase
      .from('mouvements')
      .insert([{ id, ...rest }])
    return { error, id }
  },

  // Mirrors js/stock.js submitEditMvt() : correction PARTIELLE d'un mouvement.
  // Seuls les champs autorisés sont envoyés — qty / produit_id / type /
  // user_id / created_at restent intouchables. Pas de RPC.
  updateMouvementPartial: async (supabase, id, payload) => {
    const { error } = await supabase
      .from('mouvements')
      .update(payload)
      .eq('id', id)
    return { error }
  },

  // ══════════════════════════════════════════════════════════
  //  DEMANDES — MUTATIONS
  // ══════════════════════════════════════════════════════════

  submitDem: async (supabase, payload) => {
    const profile = useAuthStore.getState().profile
    if (isLecteur(profile)) return { ok: false, error: { message: 'Lecture seule : création de demande refusée' }, message: 'Lecture seule : création de demande refusée' }
    const canDem = payload?.dept === 'IT' ? canDemIT(profile) : canDemFin(profile)
    if (!canDem) return { ok: false, error: { message: 'Accès refusé : création de demande non autorisée' }, message: 'Accès refusé : création de demande non autorisée' }
    // Mirrors js/stock.js: genId(dept === 'IT' ? 'DEM-IT' : 'DEM-FIN')
    const prefix = payload.dept === 'IT' ? 'DEM-IT' : 'DEM-FIN'
    const { error } = await supabase
      .from('demandes')
      .insert([{ id: genId(prefix), ...payload }])
    return { ok: !error, error }
  },

  validDem: async (supabase, id, updates) => {
    const { error } = await supabase
      .from('demandes')
      .update(updates)
      .eq('id', id)
    return { error }
  },

  // ══════════════════════════════════════════════════════════
  //  PARAMETRES — MUTATIONS
  // ══════════════════════════════════════════════════════════

  addParam: async (supabase, cle, valeur) => {
    const profile = useAuthStore.getState().profile
    if (!isAdmin(profile)) return { ok: false, error: { message: 'Accès refusé : paramètres réservés aux administrateurs' }, message: 'Accès refusé : paramètres réservés aux administrateurs' }
    const { error } = await supabase.from('parametres').insert({ cle, valeur })
    if (!error) await get().loadParams(supabase)
    return { ok: !error, error }
  },

  removeParam: async (supabase, cle, valeur) => {
    const profile = useAuthStore.getState().profile
    if (!isAdmin(profile)) return { ok: false, error: { message: 'Accès refusé : paramètres réservés aux administrateurs' }, message: 'Accès refusé : paramètres réservés aux administrateurs' }
    const { error } = await supabase
      .from('parametres')
      .delete()
      .eq('cle', cle)
      .eq('valeur', valeur)
    if (!error) await get().loadParams(supabase)
    return { ok: !error, error }
  },

  // ══════════════════════════════════════════════════════════
  //  REALTIME — mise à jour locale
  // ══════════════════════════════════════════════════════════

  onRealtimeProduit: (payload) => {
    const { eventType, new: row, old } = payload
    set((s) => {
      if (eventType === 'INSERT') return { produits: [row, ...s.produits] }
      if (eventType === 'UPDATE')
        return { produits: s.produits.map((p) => (p.id === row.id ? row : p)) }
      if (eventType === 'DELETE')
        return { produits: s.produits.filter((p) => p.id !== old.id) }
      return s
    })
  },

  onRealtimeMouvement: (payload) => {
    const { eventType, new: row } = payload
    set((s) => {
      if (eventType === 'INSERT') return { mouvements: [row, ...s.mouvements] }
      return s
    })
  },

  onRealtimeDemande: (payload) => {
    const { eventType, new: row, old } = payload
    set((s) => {
      if (eventType === 'INSERT') return { demandes: [row, ...s.demandes] }
      if (eventType === 'UPDATE')
        return { demandes: s.demandes.map((d) => (d.id === row.id ? row : d)) }
      if (eventType === 'DELETE')
        return { demandes: s.demandes.filter((d) => d.id !== old.id) }
      return s
    })
  },

  // ── Reset complet ─────────────────────────────────────────
  resetData: () =>
    set({
      produits:          [],
      mouvements:        [],
      demandes:          [],
      mouvementsEntrees: [],
      params: {
        destinations:  [],
        categoriesIT:  [],
        categoriesFin: [],
        emplacements:  [],
        fournisseurs:  [],
      },
      paramsRaw: [],
    }),
}))