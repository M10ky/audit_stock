// // TODO: Phase 3 — StatBadge
// export default function StatBadge() { return null }

import { IconCircleCheck, IconCircleX, IconClock } from '@tabler/icons-react'

export default function StatBadge({ statut }) {
  if (statut === 'Validé')
    return <span className="badge badge-approved"><IconCircleCheck size={12} /> Validé</span>
  if (statut === 'Refusé')
    return <span className="badge badge-rejected"><IconCircleX size={12} /> Refusé</span>
  return <span className="badge badge-pending"><IconClock size={12} /> En attente</span>
}