// // TODO: Phase 3 — StatusTag
// export default function StatusTag() { return null }

import { IconCircleCheck, IconAlertTriangle, IconCircleX } from '@tabler/icons-react'

export function getStockStatus(stock, seuil) {
  if (stock === 0) return 'Rupture'
  if (stock <= seuil) return 'Critique'
  return 'Disponible'
}

export default function StatusTag({ stock, seuil }) {
  const status = getStockStatus(stock, seuil)
  if (status === 'Rupture')
    return <span className="badge badge-rupture"><IconCircleX size={12} /> Rupture</span>
  if (status === 'Critique')
    return <span className="badge badge-critique"><IconAlertTriangle size={12} /> Critique</span>
  return <span className="badge badge-dispo"><IconCircleCheck size={12} /> Dispo</span>
}