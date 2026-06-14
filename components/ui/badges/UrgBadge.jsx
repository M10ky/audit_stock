// // TODO: Phase 3 — UrgBadge
// export default function UrgBadge() { return null }

export default function UrgBadge({ urgence }) {
  const cls = urgence === 'Critique' ? 'badge-urg-crit'
    : urgence === 'Urgente' ? 'badge-urgente'
    : 'badge-normale'
  return <span className={`badge ${cls}`}>{urgence || 'Normale'}</span>
}