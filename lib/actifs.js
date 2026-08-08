// ═══════════════════════════════════════════════════════
//  Connecteo Stock — Actifs Individuels : constantes & helpers
//  Miroir de js/actifs.js (SPA vanilla), adapté aux imports ES modules.
// ═══════════════════════════════════════════════════════

// ── Statuts ─────────────────────────────────────────────────
export const STATUS_ACTIF = {
  EN_SERVICE:   'En service',
  EN_PRET:      'En prêt',
  HORS_SERVICE: 'Hors service',
  REFORME:      'Réformé',
  SORTI:        'Sorti',
}

// Transitions valides — mirrors TRANSITIONS_ACTIF (vanilla js/actifs.js).
// EN_PRET → EN_SERVICE ne doit JAMAIS passer par un update direct de statut :
// ça doit transiter par retournerPret() (Étape F) pour clôturer le prêt en
// même temps. Ici on documente la transition comme valide au sens "état
// final atteignable", mais actifsStore.reactiverActif() bloque ce chemin
// tant que le module Prêts n'existe pas — voir le commentaire TODO associé.
export const TRANSITIONS_ACTIF = {
  [STATUS_ACTIF.EN_SERVICE]:   [STATUS_ACTIF.HORS_SERVICE, STATUS_ACTIF.REFORME, STATUS_ACTIF.EN_PRET, STATUS_ACTIF.SORTI],
  [STATUS_ACTIF.HORS_SERVICE]: [STATUS_ACTIF.EN_SERVICE, STATUS_ACTIF.REFORME],
  [STATUS_ACTIF.EN_PRET]:      [STATUS_ACTIF.EN_SERVICE],
  [STATUS_ACTIF.SORTI]:        [STATUS_ACTIF.EN_SERVICE],
  [STATUS_ACTIF.REFORME]:      [],
}

export function isValidTransition(transitions, from, to) {
  return !!(transitions[from] && transitions[from].includes(to))
}

// ── Abréviation catégorie (3 lettres) ─────────────────────────
export function getCatAbbr(categorie) {
  if (!categorie) return 'GEN'
  const norm = categorie
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim()
    .toUpperCase()
  const first = (norm.split(/\s+/)[0] || 'GEN')
  return first.padEnd(3, 'X').slice(0, 3)
}

// ── Nomenclature CNTO-{PRODUIT_ID}-{YY}-{SEQ4} ────────────────
// Ex : CNTO-IT-MQMETGM4-26-0001
export function generateNomenclature(produitId, year, seq) {
  const yy = String(year).slice(-2)
  const cleanId = String(produitId || 'GEN')
    .trim()
    .replace(/[^A-Z0-9-]/gi, '')
    .replace(/-+/g, '-')
  return `CNTO-${cleanId}-${yy}-${String(seq).padStart(4, '0')}`
}

// ── Amortissement au niveau d'un actif individuel ──────────────
// Diffère de lib/amortissement.js (qui prend des primitives "produit
// catalogue") : ici on prend l'objet actif complet, car chaque actif porte
// SA PROPRE valeur_achat/date_achat/duree_amortissement (cf.
// actifsStore.createActifUnits), et surtout sa propre valeur_residuelle —
// un plancher sous lequel la VNC ne doit jamais descendre. Ce concept
// n'existe pas au niveau produit catalogue, uniquement au niveau actif.
export function calcVNCActif(actif, refDate = new Date()) {
  const { valeur_achat, date_achat, duree_amortissement, valeur_residuelle } = actif || {}
  if (!valeur_achat || !date_achat || !duree_amortissement || valeur_achat <= 0) return 0

  const achat = new Date(date_achat)
  if (isNaN(achat)) return 0
  const ref = refDate instanceof Date ? refDate : new Date(refDate)
  const moisEcoules = Math.max(
    0,
    (ref.getFullYear() - achat.getFullYear()) * 12 + (ref.getMonth() - achat.getMonth())
  )

  const residuelle    = valeur_residuelle || 0
  const amortissable  = valeur_achat - residuelle
  if (moisEcoules >= duree_amortissement) return residuelle

  const vnc = valeur_achat - (amortissable * moisEcoules / duree_amortissement)
  return Math.max(residuelle, Math.round(vnc))
}

export function amortPctActif(actif, refDate = new Date()) {
  const { valeur_achat } = actif || {}
  if (!valeur_achat || valeur_achat <= 0) return null
  const vnc = calcVNCActif(actif, refDate)
  return Math.min(100, Math.round(((valeur_achat - vnc) / valeur_achat) * 100))
}

// ── Historique consolidé d'un actif (mouvements + prêts) ────────
// Fonction pure — pas d'accès DB. `prets` est optionnel et vide tant que
// le module Prêts (Étape F) n'existe pas : l'historique n'affichera alors
// que les mouvements, ce qui est correct puisqu'aucun prêt ne peut exister.
// ── Note d'audit horodatée ──────────────────────────────────
// Réutilise le champ `observation` de actifs_individuels comme journal
// cumulatif — chaque action s'ajoute au-dessus de l'historique existant.
// Centralisé ici (appelé uniquement par actifsStore, jamais construit à la
// main dans un composant) pour garantir un format unique.
export function buildActifNote(actif, action, userName = 'Système') {
  const line = `${new Date().toLocaleString('fr-FR')} — ${action} (${userName})`
  return actif?.observation ? `${line}\n${actif.observation}` : line
}

export function getHistoriqueActif(actif, mouvements = [], prets = []) {
  if (!actif) return []

  const mvts = (mouvements || [])
    .filter(m => m.actif_id === actif.id || (actif.mouvement_entree_id && m.id === actif.mouvement_entree_id))
    .map(m => ({
      created_at: m.created_at || m.date,
      kind:       'mouvement',
      label:      m.type,
      qty:        m.qty,
      valeur:     m.valeur,
      lieu:       m.destination || m.emplacement || '—',
      user:       m.user_name || '—',
      detail:     m.demande_id
        ? `Demande ${m.demande_id}${m.observation ? ' — ' + m.observation : ''}`
        : (m.observation || ''),
    }))

  // TODO Étape F : reconstruire les événements "Prêt"/"Retour"/"Perdu" une
  // fois que prets contiendra de vraies données (getActifNumero, STATUS_PRET).
  const pretEvents = (prets || [])
    .filter(p => p.actifId === actif.id)
    .flatMap(p => {
      const events = [{
        created_at: p.created_at || p.date_debut,
        kind: 'pret', label: 'Prêt', qty: 1, valeur: null,
        lieu: p.emprunteur || '—', user: p.valideur || '—',
        detail: p.motif || '',
      }]
      if (p.statut === 'Retourné' && p.date_retour_reelle) {
        events.push({
          created_at: p.date_retour_reelle,
          kind: 'pret', label: 'Retour', qty: 1, valeur: null,
          lieu: p.emprunteur || '—', user: '—', detail: 'Retour de prêt',
        })
      } else if (p.statut === 'Perdu') {
        events.push({
          created_at: p.updated_at || p.date_retour_prevue || p.created_at,
          kind: 'pret', label: 'Perdu', qty: 1, valeur: null,
          lieu: p.emprunteur || '—', user: '—', detail: 'Déclaré perdu — réformé',
        })
      }
      return events
    })

  return [...mvts, ...pretEvents].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}
