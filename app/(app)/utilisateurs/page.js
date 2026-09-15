'use client'
import { usePermissions } from '@/hooks/usePermissions'
import AccessDenied from '@/components/ui/AccessDenied'
import UtilisateursTable from '@/components/tables/UtilisateursTable'

export default function UtilisateursPage() {
  const perm = usePermissions()
  if (!perm.canManUsers) return <AccessDenied />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestion des Utilisateurs</h1>
          <p className="page-subtitle">Rôles, départements et statut des comptes</p>
        </div>
      </div>
      <UtilisateursTable />
    </>
  )
}