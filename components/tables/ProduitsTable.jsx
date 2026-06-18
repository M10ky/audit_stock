'use client'
import { useEffect } from 'react'
import { IconPlus, IconEdit, IconTrash, IconPackage } from '@tabler/icons-react'
import { useDataStore }    from '@/store/dataStore'
import { useUiStore }      from '@/store/uiStore'
import { usePermissions }  from '@/hooks/usePermissions'
import { useInlineFilter } from '@/hooks/useInlineFilter'
import { createClient }    from '@/lib/supabase/client'
import { fmt }             from '@/lib/helpers'
import { calcVNC, amortPct } from '@/lib/amortissement'
import { highlight }       from '@/hooks/useSearch'
import Button              from '@/components/ui/Button'
import StatusTag           from '@/components/ui/badges/StatusTag'
import AmortBar            from '@/components/ui/badges/AmortBar'
import InlineSearchBar     from '@/components/search/InlineSearchBar'

export default function ProduitsTable({ dept }) {
  const supabase = createClient()

  const produits      = useDataStore(s => s.produits.filter(p => p.dept === dept))
  const loadProduits  = useDataStore(s => s.loadProduits)
  const deleteProduit = useDataStore(s => s.deleteProduit)
  const { openModal, openConfirm, showToast } = useUiStore()
  const perm = usePermissions()

  const pageKey = `stock-${dept === 'IT' ? 'it' : 'fin'}`
  const { filterState, setFilterState, applyFilters } = useInlineFilter(pageKey)

  const canMan   = dept === 'IT' ? perm.canManIT  : perm.canManFin
  const showPrix = perm.canSeePrix

  useEffect(() => { loadProduits(supabase, dept) }, [dept]) // eslint-disable-line

  const cats     = [...new Set(produits.map(p => p.categorie))].sort()
  const filtered = applyFilters(produits, 'produit')
  const valTotal = filtered.reduce((s, p) => s + p.stock * p.prix, 0)
  const q        = filterState.query

  const handleDelete = (p) => {
    openConfirm({
      title: `Supprimer "${p.nom}" ?`,
      message: 'Cette action est irréversible. Les mouvements existants seront conservés.',
      danger: true,
      onConfirm: async () => {
        const { error } = await deleteProduit(supabase, p.id)
        if (error) showToast('Erreur: ' + error.message, 'error')
        else { showToast(`"${p.nom}" supprimé`); await loadProduits(supabase, dept) }
      },
    })
  }

  const colSpan = (canMan ? 1 : 0) + (showPrix ? 3 : 0) + 7

  return (
    <>
      <InlineSearchBar
        state={filterState}
        onChange={setFilterState}
        options={{ showCat: true, cats, showStatut: true }}
        count={produits.length}
        filteredCount={filtered.length}
        placeholder={`Rechercher dans l'inventaire ${dept} (nom, catégorie, emplacement…)`}
      />

      <div className="card">
        <div className="card-header">
          <div className="card-header-title">
            <IconPackage size={16} />
            {filtered.length} référence{filtered.length > 1 ? 's' : ''}
            {showPrix && filtered.length > 0 && ` · Valeur : ${fmt(valTotal)} MGA`}
          </div>
          {canMan && (
            <Button icon={IconPlus} onClick={() => openModal('add-produit', { dept })}>
              Produit
            </Button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Emplacement</th>
                <th>Stock</th>
                <th>Seuil</th>
                {showPrix && <><th>Prix unit.</th><th>Valeur stock</th><th>VNC</th></>}
                <th>Statut</th>
                {canMan && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={colSpan}>
                    <div className="empty-state">
                      <p>Aucun produit ne correspond à votre recherche</p>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map(p => {
                const vnc        = calcVNC(p.valeur_achat, p.date_achat, p.duree_amortissement)
                const pct        = amortPct(p.valeur_achat, p.date_achat, p.duree_amortissement)
                const configured = !!(p.valeur_achat && p.date_achat && p.duree_amortissement)
                const stockColor = p.stock === 0
                  ? 'var(--red)'
                  : p.stock <= p.seuil
                  ? 'var(--amber)'
                  : 'var(--text)'

                return (
                  <tr key={p.id}>
                    <td className="cell-mono" style={{ fontSize: 11 }}>{p.id}</td>

                    <td className="cell-name">
                      <span dangerouslySetInnerHTML={highlight(p.nom, q)} />
                    </td>

                    <td>
                      <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>
                        <span dangerouslySetInnerHTML={highlight(p.categorie, q)} />
                      </span>
                    </td>

                    <td>
                      {p.emplacement
                        ? <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>
                            <span dangerouslySetInnerHTML={highlight(p.emplacement, q)} />
                          </span>
                        : <span className="text-muted">—</span>}
                    </td>

                    <td>
                      <span className="stock-val" style={{ color: stockColor }}>{p.stock}</span>
                    </td>
                    <td className="text-muted">{p.seuil}</td>

                    {showPrix && (
                      <>
                        <td className="text-muted">{fmt(p.prix)} MGA</td>
                        <td style={{ fontWeight: 700 }}>{fmt(p.stock * p.prix)} MGA</td>
                        <td>
                          {configured
                            ? <div>
                                <div style={{ fontWeight: 700, fontSize: 12 }}>{fmt(vnc)} MGA</div>
                                <AmortBar pct={pct} />
                              </div>
                            : <span className="text-muted" style={{ fontSize: 11 }}>Non configuré</span>}
                        </td>
                      </>
                    )}

                    <td><StatusTag stock={p.stock} seuil={p.seuil} /></td>

                    {canMan && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Button
                            size="icon" variant="outline"
                            onClick={() => openModal('edit-produit', { dept, prod: p })}
                            title="Modifier"
                          >
                            <IconEdit size={14} />
                          </Button>
                          {perm.isAdmin && (
                            <Button
                              size="icon" variant="outline"
                              onClick={() => handleDelete(p)}
                              title="Supprimer"
                            >
                              <IconTrash size={14} />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}