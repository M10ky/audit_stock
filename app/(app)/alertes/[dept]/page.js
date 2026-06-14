// // TODO: Phase correspondante — AlertesPage
// export default function AlertesPage() {
//   return <div>AlertesPage — TODO</div>
// }

'use client'
import { useParams } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import AccessDenied from '@/components/ui/AccessDenied'
import AlertesTable from '@/components/tables/AlertesTable'

export default function AlertesPage() {
  const { dept: deptParam } = useParams()
  const dept = deptParam === 'it' ? 'IT' : 'Finance'
  const perm = usePermissions()
  const canMan = dept === 'IT' ? perm.canManIT : perm.canManFin

  if (!canMan) return <AccessDenied />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alertes {dept}</h1>
          <p className="page-subtitle">Produits nécessitant un réapprovisionnement</p>
        </div>
      </div>
      <AlertesTable dept={dept} />
    </>
  )
}