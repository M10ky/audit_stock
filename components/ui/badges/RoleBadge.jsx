// // TODO: Phase 3 — RoleBadge
// export default function RoleBadge() { return null }

const MAP = {
  'Administrateur':      'badge-admin',
  'Support IT':          'badge-supit',
  'Responsable Finance': 'badge-resfin',
  'Utilisateur IT':      'badge-userit',
  'Utilisateur Finance': 'badge-userfin',
}

export default function RoleBadge({ role }) {
  return <span className={`badge ${MAP[role] || 'badge-userit'}`}>{role}</span>
}