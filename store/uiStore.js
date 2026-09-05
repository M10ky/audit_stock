// TODO: Phase 1 — Zustand store: modal, toast, search{}, dateFrom, dateTo
import { create } from 'zustand'

/**
 * Store UI global.
 * Remplace toutes les manipulations directes du DOM du fichier ST.
 * Gère : modales, toasts, recherche globale, inline search, filtre dates, sidebar.
 */
export const useUiStore = create((set, get) => ({

  // ══════════════════════════════════════════════════════════
  //  MODALES
  //  modal = null | { type, dept?, data? }
  //  types : 'entree' | 'sortie' | 'add-produit' | 'edit-produit'
  //         | 'demande' | 'confirm-delete' | 'confirm-action'
  // ══════════════════════════════════════════════════════════
  modal: null,

  openModal: (type, extras = {}) =>
    set({ modal: { type, ...extras } }),

  closeModal: () => set({ modal: null }),

  // ══════════════════════════════════════════════════════════
  //  TOAST
  //  type : 'success' | 'error' | 'info' | 'warning'
  // ══════════════════════════════════════════════════════════
  toast:      { visible: false, msg: '', type: 'success' },
  toastTimer: null,

  showToast: (msg, type = 'success') => {
    const prev = get().toastTimer
    if (prev) clearTimeout(prev)

    const timer = setTimeout(() => {
      set({ toast: { visible: false, msg: '', type: 'success' }, toastTimer: null })
    }, 3500)

    set({ toast: { visible: true, msg, type }, toastTimer: timer })
  },

  hideToast: () => {
    const prev = get().toastTimer
    if (prev) clearTimeout(prev)
    set({ toast: { visible: false, msg: '', type: 'success' }, toastTimer: null })
  },

  // ══════════════════════════════════════════════════════════
  //  RECHERCHE GLOBALE (overlay Ctrl+K)
  //  filter : 'all' | 'produits' | 'mouvements' | 'demandes'
  // ══════════════════════════════════════════════════════════
  searchOpen:   false,
  searchQuery:  '',
  searchFilter: 'all',

  openSearch:  () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false, searchQuery: '' }),

  setSearchQuery:  (query)  => set({ searchQuery: query }),
  setSearchFilter: (filter) => set({ searchFilter: filter }),

  // ══════════════════════════════════════════════════════════
  //  RECHERCHE INLINE (par page)
  //  inlineSearch = { [pageKey]: query }
  //  ex: { 'stock-it': 'dell', 'mouvements-fin': 'entrée' }
  // ══════════════════════════════════════════════════════════
  inlineSearch: {},

  setInlineQuery: (pageKey, query) =>
    set((s) => ({ inlineSearch: { ...s.inlineSearch, [pageKey]: query } })),

  clearInlineQuery: (pageKey) =>
    set((s) => {
      const next = { ...s.inlineSearch }
      delete next[pageKey]
      return { inlineSearch: next }
    }),

  getInlineQuery: (pageKey) => get().inlineSearch[pageKey] ?? '',

  // ══════════════════════════════════════════════════════════
  //  FILTRE DATES (partagé Topbar → tables)
  // ══════════════════════════════════════════════════════════
  dateFrom: '',
  dateTo:   '',

  setDateFrom:    (v) => set({ dateFrom: v }),
  setDateTo:      (v) => set({ dateTo: v }),
  clearDateFilter: () => set({ dateFrom: '', dateTo: '' }),

  // ══════════════════════════════════════════════════════════
  //  SIDEBAR MOBILE
  // ══════════════════════════════════════════════════════════
  sidebarOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar:  () => set({ sidebarOpen: false }),

  // ══════════════════════════════════════════════════════════
  //  CONFIRM DIALOG (réutilisable)
  //  Ouvrir : openConfirm({ title, message, onConfirm })
  // ══════════════════════════════════════════════════════════
  confirm: null,   // null | { title, message, onConfirm, danger? }

  openConfirm:  (opts) => set({ confirm: opts }),
  closeConfirm: ()     => set({ confirm: null }),

  // ══════════════════════════════════════════════════════════
  //  ANTI-DOUBLE-CLIC (soumissions réseau)
  //  Mirrors ST.isSubmitting + withSubmitLock() du vanilla (js/utils.js).
  //  Le vanilla désactive le(s) bouton(s) DOM directement (pas d'état React
  //  ici) ; on expose la même garantie via un flag global + un helper qui
  //  encapsule l'appel réseau, à consommer par chaque composant de
  //  formulaire via <Button loading={isSubmitting}>.
  // ══════════════════════════════════════════════════════════
  isSubmitting: false,

  // withSubmitLock(fn) : verrouille isSubmitting, exécute fn(), déverrouille
  // systématiquement (même en cas d'erreur). Si une soumission est déjà en
  // cours, affiche un toast et n'exécute pas fn() — mirrors le comportement
  // du vanilla (`if (ST.isSubmitting) { showToast(...); return; }`).
  withSubmitLock: async (fn) => {
    if (get().isSubmitting) {
      get().showToast('Une opération est déjà en cours…', 'error')
      return
    }
    set({ isSubmitting: true })
    try {
      await fn()
    } finally {
      set({ isSubmitting: false })
    }
  },
}))