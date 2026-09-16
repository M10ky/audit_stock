'use client'
import { useParams } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import AccessDenied from '@/components/ui/AccessDenied'
import ProduitsTable from '@/components/tables/ProduitsTable'
import { fmt, getValeurStockActuel, isActif } from '@/lib/helpers'
import { useDataStore } from '@/store/dataStore'

export default function StockPage() {
  const { dept: deptParam } = useParams()
  const dept = deptParam === 'it' ? 'IT' : 'Finance'
  const perm = usePermissions()
  const canSee = dept === 'IT' ? perm.canSeeIT : perm.canSeeFin

  const produits = useDataStore(s => s.produits.filter(p => p.dept === dept))
  const mouvementsEntrees = useDataStore(s => s.mouvementsEntrees)
  const showPrix = perm.canSeePrix
  // Mirrors js/stock.js renderStockIT/Fin : la valeur totale (CUMP) n'inclut
  // QUE les produits actifs ; le compteur d'inactifs reste affiché en info.
  const total    = produits.filter(isActif).reduce((s, p) => s + getValeurStockActuel(p, mouvementsEntrees), 0)
  const inactifs = produits.filter(p => !isActif(p)).length

  if (!canSee) return <AccessDenied />

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventaire {dept}</h1>
          <p className="page-subtitle">
            {showPrix && `Valeur totale : ${fmt(total)} MGA · `}
            {produits.length} référence{produits.length > 1 ? 's' : ''}
            {inactifs > 0 && ` (${inactifs} inactif${inactifs > 1 ? 's' : ''})`}
          </p>
        </div>
      </div>
      <ProduitsTable dept={dept} />
    </>
  )
}