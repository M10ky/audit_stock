// TODO: Phase 1 — Zustand store: user, profile, allProfiles
import { create } from 'zustand'

/**
 * Store authentification.
 * Gère : session Supabase, profil utilisateur, liste tous les profils (admin).
 */
export const useAuthStore = create((set, get) => ({
  // ── State ───────────────────────────────────────────────────
  user:        null,   // auth.User de Supabase
  profile:     null,   // ligne de la table profiles
  allProfiles: [],     // tous les profils (chargé par admin)
  loading:     true,   // chargement initial

  // ── Setters basiques ─────────────────────────────────────────
  setUser:    (user)    => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  // ── Chargement du profil courant ─────────────────────────────
  loadProfile: async (supabase, userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && data) {
      set({ profile: data })
    }
    return { data, error }
  },

  // ── Chargement de tous les profils (admin) ───────────────────
  loadAllProfiles: async (supabase) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name')

    if (!error && data) {
      set({ allProfiles: data })
    }
    return { data, error }
  },

  // ── Toggle is_active (admin) ──────────────────────────────────
  toggleUserActive: async (supabase, userId, isActive) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', userId)

    if (!error) {
      set((s) => ({
        allProfiles: s.allProfiles.map((p) =>
          p.id === userId ? { ...p, is_active: isActive } : p
        ),
      }))
    }
    return { error }
  },

  // ── Mise à jour rôle/dept (admin) ────────────────────────────
  updateUserRole: async (supabase, userId, updates) => {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (!error) {
      set((s) => ({
        allProfiles: s.allProfiles.map((p) =>
          p.id === userId ? { ...p, ...updates } : p
        ),
      }))
    }
    return { error }
  },

  // ── Réinitialisation (logout) ────────────────────────────────
  reset: () =>
    set({ user: null, profile: null, allProfiles: [], loading: false }),
}))