// ═══════════════════════════════════════════════════════
//  Connecteo Stock — Export CSV générique (client-side)
// ═══════════════════════════════════════════════════════
import { useUiStore } from '@/store/uiStore'

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
  URL.revokeObjectURL(url)
  // Parité vanilla (js/export.js) : feedback utilisateur systématique après
  // téléchargement — toast succès mentionnant le nom du fichier exporté.
  useUiStore.getState().showToast(`Export "${filename}" téléchargé`)
}