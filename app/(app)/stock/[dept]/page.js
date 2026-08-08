'use client'
import { useParams } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import AccessDenied from '@/components/ui/AccessDenied'
import ProduitsTable from '@/components/tables/ProduitsTable'
import { fmt, getValeurStockActuel } from '@/lib/helpers'
import { useDataStore } from '@/store/dataStore'

export default function StockPage() {
  const { dept: deptParam } = useParams()
  const dept = deptParam === 'it' ? 'IT' : 'Finance'
  const perm = usePermissions()
  const canSee = dept === 'IT' ? perm.canSeeIT : perm.canSeeFin

  const produits = useDataStore(s => s.produits.filter(p => p.dept === dept))
  const mouvementsEntrees = useDataStore(s => s.mouvementsEntrees)
  const showPrix = perm.canSeePrix
  const total = produits.reduce((s, p) => s + getValeurStockActuel(p, mouvementsEntrees), 0)

  if (!canSee) return <AccessDenied />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventaire {dept}</h1>
          <p className="page-subtitle">
            {showPrix && `Valeur totale : ${fmt(total)} MGA · `}
            {produits.length} référence{produits.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <ProduitsTable dept={dept} />
    </>
  )
}