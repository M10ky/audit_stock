'use client'
import { usePermissions } from '@/hooks/usePermissions'
import AccessDenied from '@/components/ui/AccessDenied'
import HistoriqueTable from '@/components/tables/HistoriqueTable'

export default function HistoriquePage() {
  const perm = usePermissions()
  if (!perm.canSeeHist) return <AccessDenied />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Historique Complet</h1>
          <p className="page-subtitle">Vue consolidée des mouvements et demandes</p>
        </div>
      </div>
      <HistoriqueTable />
    </>
  )
}