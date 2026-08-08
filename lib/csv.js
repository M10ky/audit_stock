// ═══════════════════════════════════════════════════════
//  Connecteo Stock — Export CSV générique (client-side)
// ═══════════════════════════════════════════════════════

export function todayFileDate() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

function csvEscape(val) {
  const s = val == null ? '' : String(val)
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
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
}