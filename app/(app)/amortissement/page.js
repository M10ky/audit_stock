'use client'
import { usePermissions } from '@/hooks/usePermissions'
import AccessDenied from '@/components/ui/AccessDenied'
import AmortissementTable from '@/components/tables/AmortissementTable'

export default function AmortissementPage() {
  const perm = usePermissions()
  if (!perm.canSeeHist) return <AccessDenied />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Amortissement Linéaire</h1>
          <p className="page-subtitle">
            Valeur Nette Comptable (VNC) — Méthode linéaire
          </p>
        </div>
      </div>
      <AmortissementTable />
    </>
  )
}