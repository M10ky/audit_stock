// ═══════════════════════════════════════════════════════
//  ARGOS — Export CSV générique (client-side)
// ═══════════════════════════════════════════════════════
import { useUiStore } from '@/store/uiStore'
import { getActifNumero } from '@/store/pretsStore'
import { fmtDT, labelSemaine, weekDayKey } from '@/lib/helpers'

// Parité vanilla (js/export.js todayFileDate) : date au format YYYY-MM-DD —
// les noms de fichiers téléchargés doivent être identiques au Vanilla
// (ex: inventaire_it_2026-09-15.csv), pas un compact YYYYMMDD.
export function todayFileDate() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Règle métier reprise à l'identique de js/export.js escapeCell :
// 1) suppression des balises HTML résiduelles + décodage des entités HTML
//    (les colonnes peuvent contenir du contenu marké/highlighté),
// 2) encapsulation entre guillemets (doublés en "") si la valeur contient un
//    séparateur ';', une virgule, un guillemet ou un saut de ligne (\r inclus).
function csvEscape(val) {
  const s = String(val == null ? '' : val)
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
  if (/[";,\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Génère et télécharge un CSV (séparateur ';', BOM UTF-8 pour Excel FR).
 * @param {Array<Array>} rows
 * @param {Array<string>} headers
 * @param {string} filename
 */
export function exportToCSV(rows, headers, filename) {
  const lines = [headers.map(csvEscape).join(';')]
  rows.forEach(r => lines.push(r.map(csvEscape).join(';')))
  const csv = '\uFEFF' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
  // Parité vanilla (js/export.js) : feedback utilisateur systématique après
  // téléchargement — toast succès mentionnant le nom du fichier exporté.
  useUiStore.getState().showToast(`Export "${filename}" téléchargé`)
}

// Miroir de window.exportRapportHebdoCSV() (js/export.js:342-473).
// Reçoit les stats déjà calculées par la page : aucun ST global, aucun recalcul.
export function exportRapportHebdoCSV({
  dept, stats, entry, weekStart, weekEnd, perm, canSeeAssets, actifs = [],
}) {
  const ui = useUiStore.getState()
  if (!perm?.canSeeHist) { ui.showToast('Accès restreint', 'error'); return }
  if (dept === 'IT' && !perm?.canSeeIT) { ui.showToast('Accès restreint', 'error'); return }
  if (dept === 'Finance' && !perm?.canSeeFin) { ui.showToast('Accès restreint', 'error'); return }
  if (!stats || !entry?.data?.current) {
    ui.showToast('Rapport hebdomadaire en cours de chargement — réessayez dans un instant', 'error')
    return
  }

  const showP = !!perm?.canSeePrix
  const showAssets = canSeeAssets ?? (dept === 'IT' ? !!perm?.canSeeActifsIT : !!perm?.canSeeActifsFin)

  const headers = ['Section', 'ID / Réf.', 'Date', 'Type / Statut', 'Produit / Actif', 'Qté']
  if (showP) headers.push('Valeur (MGA)')
  headers.push('Destinataire / Emprunteur', 'Fournisseur / Agent', 'Détail')

  const rows = []
  const row = (section, id, date, type, produit, qty, valeur, dest, agent, detail) => {
    const r = [section, id || '', date || '', type || '', produit || '', qty == null ? '' : qty]
    if (showP) r.push(valeur == null ? '' : valeur)
    r.push(dest || '', agent || '', detail || '')
    return r
  }

  rows.push([`EN-TÊTE — ${dept} — ${labelSemaine(weekStart, weekEnd)}`])
  rows.push(['RÈGLE', 'Semaine lundi → dimanche', 'Date transaction = created_at || date'])
  rows.push([])

  rows.push(['MOUVEMENTS'])
  ;[...stats.mvts]
    .sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date))
    .forEach(m => rows.push(row(
      'Mouvement', m.id, fmtDT(m.created_at || m.date), m.type, m.produit_nom || '', m.qty,
      m.valeur || 0, m.destination || '', [m.fournisseur, m.user_name].filter(Boolean).join(' · '),
      [m.actif_id, m.ref_document, m.observation].filter(Boolean).join(' · ')
    )))

  rows.push([])
  rows.push(['DEMANDES'])
  ;[...stats.dms]
    .sort((a, b) => new Date(a.created_at || a.date) - new Date(b.created_at || b.date))
    .forEach(d => rows.push(row(
      'Demande', d.id, fmtDT(d.created_at || d.date), d.statut, d.produit || '', d.qty,
      null, d.dest || '', d.demandeur || '', d.motif || ''
    )))

  if (showAssets) {
    rows.push([])
    rows.push(['ACTIFS CRÉÉS'])
    stats.actifsCrees.forEach(a => rows.push(row(
      'Actif créé', a.id, fmtDT(a.date_entree), a.statut, a.produit_nom || '', 1,
      a.valeur_achat || 0, a.emplacement || '', '', a.categorie || ''
    )))

    rows.push([])
    rows.push(['ACTIFS SORTIS'])
    stats.actifsSortis.forEach(a => rows.push(row(
      'Actif sorti', a.id, fmtDT(a.sortie.created_at || a.sortie.date), a.statut || 'Sorti', a.produit_nom || '', 1,
      a.sortie.valeur || a.valeur_achat || 0, '', a.sortie.user_name || '', a.categorie || ''
    )))

    const actifById = new Map((actifs.length ? actifs : stats.actifs || []).map(a => [a.id, a]))
    const valeurPret = p => (actifById.get(getActifNumero(p)) || {}).valeur_achat || 0

    rows.push([])
    rows.push(['PRÊTS DÉMARRÉS'])
    stats.pretsDemarres.forEach(p => rows.push(row(
      'Prêt démarré', p.id, fmtDT(p.date_debut || p.created_at), p.statut, getActifNumero(p) || '',
      1, valeurPret(p), p.emprunteur || '', p.valideur || '', p.motif || ''
    )))

    rows.push([])
    rows.push(['PRÊTS RENDUS'])
    stats.pretsRendus.forEach(p => rows.push(row(
      'Prêt rendu', p.id, fmtDT(p.date_retour_reelle), p.statut, getActifNumero(p) || '',
      1, valeurPret(p), p.emprunteur || '', '', p.motif || ''
    )))
  }

  rows.push([])
  rows.push(['ACTIVITÉ PAR AGENT'])
  if (showP) {
    rows.push(['Agent', 'Dept', 'Total', 'Entrées', 'Sorties', 'Qty entrées', 'Qty sorties', 'Valeur entrées', 'Valeur sorties'])
  } else {
    rows.push(['Agent', 'Dept', 'Total', 'Entrées', 'Sorties', 'Qty entrées', 'Qty sorties'])
  }
  const agentMap = {}
  ;(stats.mvts || []).forEach(m => {
    const key = (m.user_id != null && m.user_id !== '') ? `id:${m.user_id}` : `name:${m.user_name || m.agent || '—'}`
    if (!agentMap[key]) {
      agentMap[key] = {
        agent: m.user_name || m.agent || '—', dept: m.dept || dept,
        total: 0, entrees: 0, sorties: 0, qtyEntree: 0, qtySortie: 0, valEntree: 0, valSortie: 0,
      }
    }
    agentMap[key].total += 1
    if (m.type === 'Entrée') {
      agentMap[key].entrees += 1
      agentMap[key].qtyEntree += (m.qty || 0)
      agentMap[key].valEntree += (m.valeur || 0)
    } else if (m.type === 'Sortie') {
      agentMap[key].sorties += 1
      agentMap[key].qtySortie += (m.qty || 0)
      agentMap[key].valSortie += (m.valeur || 0)
    }
  })
  const agentRowsArr = Object.values(agentMap).filter(x => x.total > 0).sort((a, b) => b.total - a.total)
  if (agentRowsArr.length === 0) {
    rows.push(['Aucune transaction cette semaine', '', '', '', '', '', ''])
  } else {
    agentRowsArr.forEach(a => {
      if (showP) {
        rows.push([a.agent, a.dept, a.total, a.entrees, a.sorties, a.qtyEntree, a.qtySortie, a.valEntree, a.valSortie])
      } else {
        rows.push([a.agent, a.dept, a.total, a.entrees, a.sorties, a.qtyEntree, a.qtySortie])
      }
    })
  }

  const fname = `rapport_hebdo_${dept.toLowerCase()}_${weekDayKey(weekStart).replace(/-/g, '')}_${weekDayKey(weekEnd).replace(/-/g, '')}.csv`
  exportToCSV(rows, headers, fname)
}