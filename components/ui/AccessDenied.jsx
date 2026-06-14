// 'use client'
// // TODO: Phase 3 — AccessDenied
// export default function AccessDenied() { return null }

'use client'
import { IconLock } from '@tabler/icons-react'

export default function AccessDenied() {
  return (
    <div className="access-denied">
      <IconLock size={48} />
      <h3>Accès restreint</h3>
      <p>Vous n&apos;avez pas les droits nécessaires pour consulter cette section.</p>
    </div>
  )
}