'use client'
import { usePermissions } from '@/hooks/usePermissions'
import AccessDenied from '@/components/ui/AccessDenied'
import ParamsPanel from '@/components/tables/ParamsPanel'

export default function ParamsPage() {
  const perm = usePermissions()
  if (!perm.canManParams) return <AccessDenied />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres Système</h1>
          <p className="page-subtitle">Configuration des listes métier</p>
        </div>
      </div>
      <ParamsPanel />
    </>
  )
}