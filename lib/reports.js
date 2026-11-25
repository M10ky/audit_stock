// ═══════════════════════════════════════════════════════
//  ARGOS — Rapports & Statistiques : helpers
//  Miroir de js/reports.js (SPA vanilla), adapté pour recevoir
//  les données en paramètres plutôt que lire ST global.
//
//  NOTE ARCHITECTURE : dans le vanilla, ST.mouvements est borné par
//  ST.dateFrom/ST.dateTo (filtre topbar, par défaut le mois en cours) —
//  evolutionValeurStock()/produitsSansMouvement90j() héritent donc
//  silencieusement de cette limite dans le vanilla. Dans le Next.js,
//  dataStore.mouvements charge TOUT l'historique sans filtre de date
//  (cf. dataStore.js: loadMouvements), et le filtrage par période se
//  fait côté page via useDateFilter().filterByDate() — convention déjà
//  établie par DashboardPage. Ces deux helpers reçoivent donc ici
//  l'historique complet, ce qui est plus correct que le comportement
//  vanilla par défaut plutôt qu'une divergence introduite par cette étape.
// ═══════════════════════════════════════════════════════

import { fmt, getValeurStockActuel, inWeek, weekDayKey } from '@/lib/helpers'
import { calcVNCActif } from '@/lib/actifs'

// ── Visibilité produits ────────────────────────────────────────
export function getProduitsNonAmort(produits) {
  return (produits || []).filter(p => !p.is_amortissable)
}

export function getProduitsVisibles(produits, perm) {
  return (produits || []).filter(p =>
    (perm?.canSeeIT && p.dept === 'IT') || (perm?.canSeeFin && p.dept === 'Finance')
  )
}

// ── Taux de validation des demandes ─────────────────────────────
// "En attente" exclu du calcul — Validé / (Validé + Refusé).
export function tauxValidationGlobal(demandes) {
  const valide = (demandes || []).filter(d => d.statut === 'Validé').length
  const refuse = (demandes || []).filter(d => d.statut === 'Refusé').length
  const total = valide + refuse
  return total ? Math.round((valide / total) * 100) : 0
}

// ── Top produits distribués (quantité + valeur sortie, période) ─
export function topProduitsDistribues(mvtSortie, n = 10) {
  const map = {}
  ;(mvtSortie || []).forEach(m => {
    if (!map[m.produit_id]) map[m.produit_id] = { id: m.produit_id, nom: m.produit_nom, qty: 0, valeur: 0 }
    map[m.produit_id].qty += (m.qty || 0)
    map[m.produit_id].valeur += (m.valeur || 0)
  })
  return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, n)
}

// ── Top produits les plus coûteux ────────────────────────────────
// Non-amortissables : CUMP × stock. Amortissables : somme valeur_achat
// des actifs "vivants" (En service / En prêt).
export function topProduitsCouteux(produits, actifs, mouvementsEntrees, perm, n = 10) {
  const visibles = getProduitsVisibles(produits, perm)
  return visibles
    .map(p => {
      const valeur = p.is_amortissable
        ? (actifs || [])
            .filter(a => a.produit_id === p.id && (a.statut === 'En service' || a.statut === 'En prêt'))
            .reduce((s, a) => s + (a.valeur_achat || 0), 0)
        : getValeurStockActuel(p, mouvementsEntrees)
      return { nom: p.nom, dept: p.dept, valeur, amort: !!p.is_amortissable }
    })
    .filter(x => x.valeur > 0)
    .sort((a, b) => b.valeur - a.valeur)
    .slice(0, n)
}

// ── Répartition des actifs individuels par statut ────────────────
// Mirrors vanilla : gate par canSeeIT/canSeeFin (lecteurs inclus) —
// actifsStore.loadActifs() charge tous départements sans filtre dept, donc
// ce filtrage de visibilité doit être fait ici explicitement.
export function repartitionActifsStatut(actifs, perm) {
  const statuts = ['En service', 'En prêt', 'Hors service', 'Sorti', 'Réformé']
  const visibles = (actifs || []).filter(a =>
    (perm?.canSeeIT && a.dept === 'IT') || (perm?.canSeeFin && a.dept === 'Finance')
  )
  return statuts.map(s => ({ statut: s, n: visibles.filter(a => a.statut === s).length }))
}

// ── Évolution de la valeur du stock (non-amortissables), N mois ──
// Reconstruite depuis l'historique des mouvements : Entrée:+valeur,
// Sortie:-valeur, valeur plancher à 0.
export function evolutionValeurStock(produits, mouvements, perm, nbMois = 6) {
  const nonAmortIds = new Set(
    getProduitsNonAmort(produits)
      .filter(p => (perm?.canSeeIT && p.dept === 'IT') || (perm?.canSeeFin && p.dept === 'Finance'))
      .map(p => p.id)
  )
  const mvt = (mouvements || [])
    .filter(m => nonAmortIds.has(m.produit_id))
    .sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date))

  const today = new Date()
  const months = []
  for (let i = nbMois - 1; i >= 0; i--) months.push(new Date(today.getFullYear(), today.getMonth() - i, 1))

  return months.map(mDate => {
    const nextMonth = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 1)
    const val = mvt
      .filter(m => new Date(m.created_at || m.date) < nextMonth)
      .reduce((s, m) => s + (m.type === 'Entrée' ? (m.valeur || 0) : -(m.valeur || 0)), 0)
    return {
      label: mDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      val: Math.max(0, val),
    }
  })
}

// ── Produits sans mouvement depuis plus de 90 jours ──────────────
export function produitsSansMouvement90j(produits, mouvements, perm) {
  const seuil = new Date()
  seuil.setDate(seuil.getDate() - 90)
  return getProduitsVisibles(produits, perm).filter(p => {
    const mvts = (mouvements || []).filter(m => m.produit_id === p.id)
    if (!mvts.length) return true
    const derniere = mvts.reduce((max, m) => {
      const d = new Date(m.created_at || m.date)
      return d > max ? d : max
    }, new Date(0))
    return derniere < seuil
  })
}

// ── Coût moyen des sorties (période) ─────────────────────────────
export function coutMoyenSorties(mvtSortie) {
  const totalQty = (mvtSortie || []).reduce((s, m) => s + (m.qty || 0), 0)
  const totalVal = (mvtSortie || []).reduce((s, m) => s + (m.valeur || 0), 0)
  return totalQty ? totalVal / totalQty : 0
}

// ── Valeur moyenne par catégorie (non-amortissables) ─────────────
export function valeurMoyenneParCategorie(produits, mouvementsEntrees, perm) {
  const cats = {}
  getProduitsNonAmort(produits)
    .filter(p => (perm?.canSeeIT && p.dept === 'IT') || (perm?.canSeeFin && p.dept === 'Finance'))
    .forEach(p => {
      const cat = p.categorie || '—'
      if (!cats[cat]) cats[cat] = { total: 0, n: 0 }
      cats[cat].total += getValeurStockActuel(p, mouvementsEntrees)
      cats[cat].n += 1
    })
  return Object.entries(cats)
    .map(([cat, { total, n }]) => ({ cat, total, n, moyenne: n ? total / n : 0 }))
    .sort((a, b) => b.total - a.total)
}

// ── Helpers Lecteur (Dashboard — vue de pilotage) ────────────────
// Mirrors js/reports.js getVNCGlobaleActifs()/getPretsValorises()/… Consommés
// uniquement par le bloc « Vue de pilotage stratégique » (gate perm.isLecteur).
// Données passées en paramètres (pas de ST global) — convention du fichier.

// VNC consolidée des actifs « vivants » sur les départements visibles.
export function getVNCGlobaleActifs(actifs, perm) {
  const visibles = (actifs || []).filter(a =>
    (a.statut === 'En service' || a.statut === 'En prêt') &&
    ((perm?.canSeeIT && a.dept === 'IT') || (perm?.canSeeFin && a.dept === 'Finance'))
  )
  const brute = visibles.reduce((s, a) => s + (a.valeur_achat || 0), 0)
  const vnc   = visibles.reduce((s, a) => s + (calcVNCActif(a) || 0), 0)
  return { brute, vnc, amorti: brute - vnc, nb: visibles.length }
}

// Prêts en cours / en retard valorisés via la valeur d'achat de l'actif prêté.
// Visibilité mirrors canManX() || isLecteur() du Vanilla (canSeePretsX).
// retard30 reflète strictement le Vanilla : p.date_retour_prevue requis, > 30j.
export function getPretsValorises(prets, actifs, perm) {
  const visibles = (prets || []).filter(p =>
    (perm?.canSeePretsIT && p.dept === 'IT') || (perm?.canSeePretsFin && p.dept === 'Finance')
  )
  const enCours  = visibles.filter(p => p.statut === 'En cours')
  const enRetard = visibles.filter(p => p.statut === 'En retard')
  const valoriser = liste => liste.reduce((s, p) => {
    // getActifNumero(p) = pret.actif_numero || pret.produit_id (pretsStore)
    const numero = p.actif_numero || p.produit_id
    const a = (actifs || []).find(x => x.id === numero)
    return s + (a?.valeur_achat || 0)
  }, 0)
  const retard30 = enRetard.filter(p => {
    if (!p.date_retour_prevue) return false
    const jours = Math.ceil((new Date() - new Date(p.date_retour_prevue)) / 86400000)
    return jours > 30
  })
  return {
    enCours: enCours.length, enRetard: enRetard.length,
    valeurEnCours: valoriser(enCours), valeurEnRetard: valoriser(enRetard),
    retard30: retard30.length,
  }
}

// Taux de rotation approximatif : valeur des sorties (période) / valeur du
// stock actuel (non-amortissables uniquement — même périmètre que getValeurStockActuel).
export function getTauxRotationStock(produits, mouvements, mouvementsEntrees, perm) {
  const nonAmortIds = new Set(
    getProduitsNonAmort(produits)
      .filter(p => (perm?.canSeeIT && p.dept === 'IT') || (perm?.canSeeFin && p.dept === 'Finance'))
      .map(p => p.id)
  )
  const sortiesVal = (mouvements || [])
    .filter(m => m.type === 'Sortie' && nonAmortIds.has(m.produit_id))
    .reduce((s, m) => s + (m.valeur || 0), 0)
  const stockVal = getProduitsVisibles(produits, perm)
    .filter(p => !p.is_amortissable)
    .reduce((s, p) => s + getValeurStockActuel(p, mouvementsEntrees), 0)
  return stockVal > 0 ? Math.round((sortiesVal / stockVal) * 100) / 100 : 0
}

// Top N catégories les plus valorisées — stock CUMP (non-amort.) + VNC (amortissables).
export function getTopCategoriesValorisees(produits, actifs, mouvementsEntrees, perm, n = 5) {
  const map = {}
  getProduitsVisibles(produits, perm).filter(p => !p.is_amortissable).forEach(p => {
    const cat = p.categorie || '—'
    map[cat] = (map[cat] || 0) + getValeurStockActuel(p, mouvementsEntrees)
  })
  ;(actifs || [])
    .filter(a => (a.statut === 'En service' || a.statut === 'En prêt') &&
      ((perm?.canSeeIT && a.dept === 'IT') || (perm?.canSeeFin && a.dept === 'Finance')))
    .forEach(a => {
      const cat = a.categorie || '—'
      map[cat] = (map[cat] || 0) + (calcVNCActif(a) || 0)
    })
  return Object.entries(map).map(([cat, val]) => ({ cat, val }))
    .sort((a, b) => b.val - a.val).slice(0, n)
}

// Répartition des actifs individuels par état, départements visibles confondus.
export function getRepartitionActifsEtat(actifs, perm) {
  const visibles = (actifs || []).filter(a =>
    (perm?.canSeeIT && a.dept === 'IT') || (perm?.canSeeFin && a.dept === 'Finance')
  )
  return {
    enService:   visibles.filter(a => a.statut === 'En service').length,
    enPret:      visibles.filter(a => a.statut === 'En prêt').length,
    horsService: visibles.filter(a => a.statut === 'Hors service').length,
    reforme:     visibles.filter(a => a.statut === 'Réformé').length,
    sorti:       visibles.filter(a => a.statut === 'Sorti').length,
  }
}

// Alertes majeures consolidées pour le pilotage — mirrors alertsIT()/alertsFin()
// (utils.js : isActif + stock<=seuil), puis rupture = stock===0 exactement.
// Pas de gate de visibilité ici : conforme au Vanilla (bloc Lecteur = les 2 dépts).
export function getAlertesMajeures(produits, prets, actifs, perm) {
  const ruptures = (produits || [])
    .filter(p => (p.dept === 'IT' || p.dept === 'Finance') && p.actif !== false && (p.stock <= p.seuil || p.stock === 0))
    .filter(p => p.stock === 0).length
  const { retard30 } = getPretsValorises(prets, actifs, perm)
  return { ruptures, retard30 }
}

// ═══════════════════════════════════════════════════════════════
//  RAPPORT HEBDOMADAIRE — flux lun → dim (miroir js/reports.js:336-583)
//  Règle métier : date transaction = created_at || date.
//  Aucun ST global : supabase / perm / données sont passés en arguments.
// ═══════════════════════════════════════════════════════════════

export const WEEK_CACHE_TTL = 30000 // ms — TTL du cache client (voir page Rapports)

export function getWeekVisibleDepts(perm) {
  const depts = []
  if (perm?.canSeeIT) depts.push('IT')
  if (perm?.canSeeFin) depts.push('Finance')
  return depts
}

// created_at dans la plage OU created_at absent + date élargie d'un jour
// (fuseaux) — le filtrage exact est refait côté client par inWeek().
export function weekQueryFilter(start, end) {
  const sIso = start.toISOString(), eIso = end.toISOString()
  const sDay = weekDayKey(new Date(start.getTime() - 86400000))
  const eDay = weekDayKey(new Date(end.getTime() + 86400000))
  return `and(created_at.gte.${sIso},created_at.lte.${eIso}),and(created_at.is.null,date.gte.${sDay},date.lte.${eDay})`
}

// Lecture paginée : PostgREST plafonne à 1000 lignes par requête.
export async function fetchWeekRows(supabase, table, start, end, depts = []) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select('*')
      .or(weekQueryFilter(start, end))
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (depts.length) q = q.in('dept', depts)
    const { data, error } = await q
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return rows
}

// Une seule passe mouvements couvre S et S−1 ; demandes = semaine S.
export async function loadWeekFluxData(supabase, weekStart, weekEnd, perm) {
  const prevStart = new Date(weekStart)
  prevStart.setDate(prevStart.getDate() - 7)
  const prevEnd = new Date(weekEnd)
  prevEnd.setDate(prevEnd.getDate() - 7)

  const depts = getWeekVisibleDepts(perm)
  const [mvts, dms] = await Promise.all([
    fetchWeekRows(supabase, 'mouvements', prevStart, weekEnd, depts),
    fetchWeekRows(supabase, 'demandes', weekStart, weekEnd, depts),
  ])

  return {
    current: {
      mouvements: mvts.filter(m => inWeek(m.created_at || m.date, weekStart, weekEnd)),
      demandes:   dms.filter(d => inWeek(d.created_at || d.date, weekStart, weekEnd)),
    },
    previous: {
      mouvements: mvts.filter(m => inWeek(m.created_at || m.date, prevStart, prevEnd)),
    },
  }
}

// Top N produits d'un sens de flux (Entrée / Sortie).
export function topProduitsFlux(mouvements, type, n = 5) {
  const map = {}
  ;(mouvements || []).filter(m => m.type === type).forEach(m => {
    const key = m.produit_id || m.produit_nom || '—'
    if (!map[key]) map[key] = { nom: m.produit_nom || m.produit_id || '—', qty: 0, valeur: 0 }
    map[key].qty    += (m.qty || 0)
    map[key].valeur += (m.valeur || 0)
  })
  return Object.values(map).sort((a, b) => b.qty - a.qty || b.valeur - a.valeur).slice(0, n)
}

// Variation S vs S−1 : flèche + delta + pourcentage (n/a si S−1 = 0).
export function variationLabel(current, previous, money = false) {
  const delta = (current || 0) - (previous || 0)
  const arrow = delta > 0 ? '↗' : delta < 0 ? '↘' : '→'
  const deltaTxt = `${delta > 0 ? '+' : ''}${fmt(Math.round(delta))}${money ? ' MGA' : ''}`
  const pct = previous === 0
    ? (current === 0 ? '0 %' : 'n/a')
    : `${delta > 0 ? '+' : ''}${Math.round((delta / Math.abs(previous)) * 1000) / 10} %`
  return `${arrow} ${deltaTxt} · ${pct} vs S−1`
}

// Brief stats hebdo par agent — total transactions (Entrée/Sortie) sur la semaine.
export function statsAgentsSemaine(mouvementsSemaine) {
  const list = Array.isArray(mouvementsSemaine) ? mouvementsSemaine : []
  const map = {}
  list.forEach(m => {
    if (!m) return
    const key = (m.user_id != null && m.user_id !== '') ? `id:${m.user_id}` : `name:${m.user_name || m.agent || '—'}`
    if (!map[key]) {
      map[key] = {
        user_id: m.user_id || null,
        agent: m.user_name || m.agent || '—',
        total: 0, entrees: 0, sorties: 0,
        qtyEntree: 0, qtySortie: 0, valEntree: 0, valSortie: 0,
      }
    }
    map[key].total += 1
    if (m.type === 'Entrée') {
      map[key].entrees += 1
      map[key].qtyEntree += (m.qty || 0)
      map[key].valEntree += (m.valeur || 0)
    } else if (m.type === 'Sortie') {
      map[key].sorties += 1
      map[key].qtySortie += (m.qty || 0)
      map[key].valSortie += (m.valeur || 0)
    }
  })
  return Object.values(map)
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total || (a.agent || '').localeCompare(b.agent || ''))
}

// Agrégats purs d'un département pour S + comparaison S−1.
// prêts / actifs (déjà chargés côté page) arrivent en paramètres.
export function computeWeekDeptStats(dept, entry, weekStart, weekEnd, prets = [], actifs = []) {
  const current  = entry?.data?.current  || { mouvements: [], demandes: [] }
  const previous = entry?.data?.previous || { mouvements: [] }

  const mvts     = (current.mouvements || []).filter(m => m.dept === dept)
  const prevMvts = (previous.mouvements || []).filter(m => m.dept === dept)
  const dms      = (current.demandes || []).filter(d => d.dept === dept)

  const entrees     = mvts.filter(m => m.type === 'Entrée')
  const sorties     = mvts.filter(m => m.type === 'Sortie')
  const prevEntrees = prevMvts.filter(m => m.type === 'Entrée')
  const prevSorties = prevMvts.filter(m => m.type === 'Sortie')

  const sumQty = list => list.reduce((s, m) => s + (m.qty || 0), 0)
  const sumVal = list => list.reduce((s, m) => s + (m.valeur || 0), 0)

  const pretsDept  = (prets || []).filter(p => p.dept === dept)
  const actifsDept = (actifs || []).filter(a => a.dept === dept)

  const pretsDemarres = pretsDept.filter(p => inWeek(p.date_debut || p.created_at, weekStart, weekEnd))
  const pretsRendus   = pretsDept.filter(p => p.date_retour_reelle && inWeek(p.date_retour_reelle, weekStart, weekEnd))
  const pretsRetard   = pretsDept.filter(p => p.statut === 'En retard')

  const actifsCrees = actifsDept.filter(a => inWeek(a.date_entree, weekStart, weekEnd))

  const sortieParActif = {}
  sorties.filter(m => m.actif_id).forEach(m => {
    if (!sortieParActif[m.actif_id]) sortieParActif[m.actif_id] = m
  })
  const actifsSortis = Object.keys(sortieParActif).map(id => {
    const a = actifsDept.find(x => x.id === id)
    return { ...(a || { id, produit_nom: '—', dept }), sortie: sortieParActif[id] }
  })

  const demandes = {
    total:    dms.length,
    validees: dms.filter(d => d.statut === 'Validé').length,
    refusees: dms.filter(d => d.statut === 'Refusé').length,
    attente:  dms.filter(d => d.statut === 'En attente').length,
  }

  const daily = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart)
    day.setDate(day.getDate() + i)
    const dStart = new Date(day); dStart.setHours(0, 0, 0, 0)
    const dEnd   = new Date(day); dEnd.setHours(23, 59, 59, 999)
    const dayMvts = mvts.filter(m => inWeek(m.created_at || m.date, dStart, dEnd))
    const dIn  = dayMvts.filter(m => m.type === 'Entrée')
    const dOut = dayMvts.filter(m => m.type === 'Sortie')
    const vIn  = sumVal(dIn), vOut = sumVal(dOut)
    daily.push({
      date: day,
      label: day.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      qtyIn: sumQty(dIn), qtyOut: sumQty(dOut),
      valIn: vIn, valOut: vOut, net: vIn - vOut,
    })
  }

  return {
    dept, mvts, prevMvts, dms, entrees, sorties, prevEntrees, prevSorties,
    qtyIn: sumQty(entrees), qtyOut: sumQty(sorties),
    valIn: sumVal(entrees), valOut: sumVal(sorties),
    net: sumVal(entrees) - sumVal(sorties),
    nbMvt: mvts.length, nbMvtPrev: prevMvts.length,
    produitsTouches: new Set(mvts.map(m => m.produit_id || m.produit_nom).filter(Boolean)).size,
    topEntrees: topProduitsFlux(mvts, 'Entrée', 5),
    topSorties: topProduitsFlux(mvts, 'Sortie', 5),
    daily, demandes, prets: pretsDept, pretsDemarres, pretsRendus, pretsRetard,
    actifs: actifsDept, actifsCrees, actifsSortis,
    hasData: mvts.length || dms.length || actifsCrees.length || actifsSortis.length || pretsDemarres.length || pretsRendus.length,
  }
}