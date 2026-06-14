// // TODO: Phase correspondante — DemandesPage
// export default function DemandesPage() {
//   return <div>DemandesPage — TODO</div>
// }

'use client'
import { useParams } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import AccessDenied from '@/components/ui/AccessDenied'
import DemandesTable from '@/components/tables/DemandesTable'

export default function DemandesPage() {
  const { dept: deptParam } = useParams()
  const dept = deptParam === 'it' ? 'IT' : 'Finance'
  const perm = usePermissions()
  const canSee = dept === 'IT' ? perm.canSeeIT : perm.canSeeFin

  if (!canSee) return <AccessDenied />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Demandes {dept}</h1>
          <p className="page-subtitle">Gestion des demandes de matériel</p>
        </div>
      </div>
      <DemandesTable dept={dept} />
    </>
  )
}