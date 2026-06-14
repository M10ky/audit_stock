// // TODO: Phase 3 — TypeBadge
// export default function TypeBadge() { return null }

import { IconArrowDown, IconArrowUp } from '@tabler/icons-react'

export default function TypeBadge({ type }) {
  if (type === 'Entrée')
    return <span className="badge badge-entree"><IconArrowDown size={12} /> Entrée</span>
  return <span className="badge badge-sortie"><IconArrowUp size={12} /> Sortie</span>
}