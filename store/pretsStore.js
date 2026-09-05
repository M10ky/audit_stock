// Nouveau fichier — mirrors js/prets.js
import { create } from 'zustand'
import { genId } from '@/lib/helpers'

export const STATUS_PRET = {
  EN_COURS:  'En cours',
  EN_RETARD: 'En retard',
  RETOURNE:  'Retourné',
  PERDU:     'Perdu',
}

// Mirrors js/constants.js TRANSITIONS_PRET
export const TRANSITIONS_PRET = {
  [STATUS_PRET.EN_COURS]:  [STATUS_PRET.RETOURNE, STATUS_PRET.PERDU],
  [STATUS_PRET.EN_RETARD]: [STATUS_PRET.RETOURNE, STATUS_PRET.PERDU],
  [STATUS_PRET.RETOURNE]:  [],
  [STATUS_PRET.PERDU]:     [STATUS_PRET.RETOURNE], // réversible : matériel retrouvé
}

export function isValidTransition(map, from, to) {
  return Array.isArray(map[from]) && map[from].includes(to)
}

// getActifNumero : compat ancienne colonne produit_id vs actif_numero
export function getActifNumero(pret) {
  return pret.actif_numero || pret.produit_id || null
}

export function joursRestants(pret) {
  if (!pret.date_retour_prevue) return null
  if (pret.statut === STATUS_PRET.RETOURNE || pret.statut === STATUS_PRET.PERDU) return null
  const diff = new Date(pret.date_retour_prevue) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export const usePretsStore = create((set, get) => ({
  prets:        [],
  loadingPrets: false,

  // ── Chargement + enrichissement "En cours" → "En retard" ────
  loadPrets: async (supabase) => {
    set({ loadingPrets: true })
    const { data, error } = await supabase
      .from('prets')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) {
      const now = new Date()
      const enriched = data.map(p => {
        if (
          p.statut === STATUS_PRET.EN_COURS &&
          p.date_retour_prevue &&
          new Date(p.date_retour_prevue) < now
        ) {
          return { ...p, statut: STATUS_PRET.EN_RETARD }
        }
        return p
      })
      set({ prets: enriched })
    }
    set({ loadingPrets: false })
    return { data, error }
  },

  // ── Création : actif + prêt + statut, atomique via RPC dédiée ────
  // Mirrors js/prets.js submitPret() → rpc_creer_pret.
  creerPret: async (supabase, { dept, actifId, emprunteur, emprunteurId, dateRetourPrevue, motif, notes, valideur, valideurId }) => {
    const id = genId(dept === 'IT' ? 'PRT-IT' : 'PRT-FIN')
    const { error } = await supabase.rpc('rpc_creer_pret', {
      p_pret_id:            id,
      p_actif_id:           actifId,
      p_dept:               dept,
      p_emprunteur:         emprunteur,
      p_emprunteur_id:      emprunteurId || null,
      p_date_retour_prevue: dateRetourPrevue,
      p_motif:              motif,
      p_notes:              notes || '',
      p_valideur:           valideur || '',
      p_valideur_id:        valideurId || null,
    })
    return { error, id }
  },

  // ── Retour d'un actif prêté ────────────────────────────────
  retournerPret: async (supabase, pretId, userName, userId) => {
    const { error } = await supabase.rpc('rpc_retourner_pret', {
      p_pret_id:   pretId,
      p_user_name: userName || 'Système',
      p_user_id:   userId || null,
    })
    return { error }
  },

  // ── Déclaration de perte ────────────────────────────────────
  perdreActif: async (supabase, pretId, userName, userId) => {
    const { error } = await supabase.rpc('rpc_perdre_pret', {
      p_pret_id:   pretId,
      p_user_name: userName || 'Système',
      p_user_id:   userId || null,
    })
    return { error }
  },

  // ── Retrouvaille d'un actif déclaré perdu (réversibilité) ───
  retrouverActifPret: async (supabase, pretId, userName, userId) => {
    const { data, error } = await supabase.rpc('rpc_retrouver_actif', {
      p_pret_id:   pretId,
      p_user_name: userName || 'Système',
      p_user_id:   userId || null,
      p_obs:       '',
    })
    return { data, error }
  },

  // ── Realtime ─────────────────────────────────────────────────
  onRealtimePret: (payload) => {
    const { eventType, new: row, old } = payload
    set((s) => {
      if (eventType === 'INSERT') return { prets: [row, ...s.prets] }
      if (eventType === 'UPDATE')
        return { prets: s.prets.map((p) => (p.id === row.id ? row : p)) }
      if (eventType === 'DELETE')
        return { prets: s.prets.filter((p) => p.id !== old.id) }
      return s
    })
  },

  resetPrets: () => set({ prets: [] }),
}))