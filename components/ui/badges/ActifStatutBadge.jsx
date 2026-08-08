const MAP = {
  'En service':   { cls: 'badge-dispo',           icon: '●' },
  'En prêt':      { cls: 'badge-amort-avance',    icon: '⇄' },
  'Hors service': { cls: 'badge-critique',        icon: '⚠' },
  'Réformé':      { cls: 'badge-rupture',         icon: '✕' },
  'Sorti':        { cls: 'badge-amort-critique',  icon: '↗' },
}

export default function ActifStatutBadge({ statut }) {
  const m = MAP[statut] || { cls: 'badge', icon: '' }
  return <span className={`badge ${m.cls}`}>{m.icon} {statut || '—'}</span>
}