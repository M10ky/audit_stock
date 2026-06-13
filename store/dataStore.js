// TODO: Phase 1 — Zustand store: produits, mouvements, demandes, params
// actions: load*, submitMvt, submitAdd, submitEdit, deleteProduct, submitDem, validDem
import { create } from 'zustand'
import { genId } from '@/lib/helpers'

/**
 * Store données métier.
 * Centralise tous les appels Supabase CRUD.
 * Le Realtime met à jour ces arrays via les actions reload*.
 */
export const useDataStore = create((set, get) => ({

  // ── State ───────────────────────────────────────────────────
  produits:          [],
  mouvements:        [],
  demandes:          [],
  params:            {},     // { cle: valeur } pour accès direct
  paramsRaw:         [],     // array brut { id, cle, valeur } pour admin

  loadingProduits:   false,
  loadingMouvements: false,
  loadingDemandes:   false,
  loadingParams:     false,

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
    let q = supabase
      .from('mouvements')
      .select('*')
      .order('created_at', { ascending: false })
    if (dept && dept !== 'both') q = q.eq('dept', dept)
    const { data, error } = await q
    if (!error && data) set({ mouvements: data })
    set({ loadingMouvements: false })
    return { data, error }
  },

  loadDemandes: async (supabase, dept) => {
    set({ loadingDemandes: true })
    let q = supabase
      .from('demandes')
      .select('*')
      .order('created_at', { ascending: false })
    if (dept && dept !== 'both') q = q.eq('dept', dept)
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
      .order('cle')
    if (!error && data) {
      const obj = {}
      data.forEach((p) => { obj[p.cle] = p.valeur })
      set({ params: obj, paramsRaw: data })
    }
    set({ loadingParams: false })
    return { data, error }
  },

  // ══════════════════════════════════════════════════════════
  //  PRODUITS — MUTATIONS
  // ══════════════════════════════════════════════════════════

  submitAdd: async (supabase, payload) => {
    const { error } = await supabase
      .from('produits')
      .insert([{ id: genId(), ...payload }])
    return { error }
  },

  submitEdit: async (supabase, id, payload) => {
    const { error } = await supabase
      .from('produits')
      .update(payload)
      .eq('id', id)
    return { error }
  },

  deleteProduit: async (supabase, id) => {
    const { error } = await supabase
      .from('produits')
      .delete()
      .eq('id', id)
    return { error }
  },

  // ══════════════════════════════════════════════════════════
  //  MOUVEMENTS — MUTATIONS
  // ══════════════════════════════════════════════════════════

  submitMvt: async (supabase, payload) => {
    const { error } = await supabase
      .from('mouvements')
      .insert([{ id: genId(), ...payload }])
    return { error }
  },

  // ══════════════════════════════════════════════════════════
  //  DEMANDES — MUTATIONS
  // ══════════════════════════════════════════════════════════

  submitDem: async (supabase, payload) => {
    const { error } = await supabase
      .from('demandes')
      .insert([{ id: genId(), ...payload }])
    return { error }
  },

  validDem: async (supabase, id, updates) => {
    // updates = { statut, valideur, valideur_id, observation? }
    const { error } = await supabase
      .from('demandes')
      .update(updates)
      .eq('id', id)
    return { error }
  },

  // ══════════════════════════════════════════════════════════
  //  PARAMETRES — MUTATIONS
  // ══════════════════════════════════════════════════════════

  setParam: async (supabase, cle, valeur) => {
    const { error } = await supabase
      .from('parametres')
      .upsert({ cle, valeur }, { onConflict: 'cle' })

    if (!error) {
      set((s) => ({
        params:    { ...s.params, [cle]: valeur },
        paramsRaw: s.paramsRaw.some((p) => p.cle === cle)
          ? s.paramsRaw.map((p) => (p.cle === cle ? { ...p, valeur } : p))
          : [...s.paramsRaw, { id: genId(), cle, valeur }],
      }))
    }
    return { error }
  },

  removeParam: async (supabase, cle) => {
    const { error } = await supabase
      .from('parametres')
      .delete()
      .eq('cle', cle)

    if (!error) {
      set((s) => {
        const next = { ...s.params }
        delete next[cle]
        return {
          params:    next,
          paramsRaw: s.paramsRaw.filter((p) => p.cle !== cle),
        }
      })
    }
    return { error }
  },

  // ══════════════════════════════════════════════════════════
  //  REALTIME — mise à jour locale après événement
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
      produits: [], mouvements: [], demandes: [],
      params: {}, paramsRaw: [],
    }),
}))