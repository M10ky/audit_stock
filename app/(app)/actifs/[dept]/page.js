'use client'
import { useParams } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import AccessDenied from '@/components/ui/AccessDenied'
import ActifsTable from '@/components/tables/ActifsTable'

export default function ActifsPage() {
  const { dept: deptParam } = useParams()
  const dept = deptParam === 'it' ? 'IT' : 'Finance'
  const perm = usePermissions()
  const canSee = dept === 'IT' ? perm.canSeeActifsIT : perm.canSeeActifsFin

  if (!canSee) return <AccessDenied />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Actifs Individuels {dept}</h1>
          <p className="page-subtitle">Suivi numéroté (CNTO-…) des équipements amortissables</p>
        </div>
      </div>
      <ActifsTable dept={dept} />
    </>
  )
}