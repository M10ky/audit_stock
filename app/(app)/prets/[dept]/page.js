'use client'
import { useParams } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import AccessDenied from '@/components/ui/AccessDenied'
import PretsTable from '@/components/tables/PretsTable'

export default function PretsPage() {
  const { dept: deptParam } = useParams()
  const dept = deptParam === 'it' ? 'IT' : 'Finance'
  const perm = usePermissions()
  const canSee = dept === 'IT' ? perm.canSeePretsIT : perm.canSeePretsFin

  if (!canSee) return <AccessDenied />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestion des Prêts {dept}</h1>
          <p className="page-subtitle">Suivi des actifs prêtés et de leurs retours</p>
        </div>
      </div>
      <PretsTable dept={dept} />
    </>
  )
}