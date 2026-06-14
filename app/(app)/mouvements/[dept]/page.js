// // TODO: Phase correspondante — MouvementsPage
// export default function MouvementsPage() {
//   return <div>MouvementsPage — TODO</div>
// }

'use client'
import { useParams } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import AccessDenied from '@/components/ui/AccessDenied'
import MouvementsTable from '@/components/tables/MouvementsTable'

export default function MouvementsPage() {
  const { dept: deptParam } = useParams()
  const dept = deptParam === 'it' ? 'IT' : 'Finance'
  const perm = usePermissions()
  const canMan = dept === 'IT' ? perm.canManIT : perm.canManFin

  if (!canMan) return <AccessDenied />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mouvements {dept}</h1>
          <p className="page-subtitle">Historique des entrées et sorties de stock</p>
        </div>
      </div>
      <MouvementsTable dept={dept} />
    </>
  )
}