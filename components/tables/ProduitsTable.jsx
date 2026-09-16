'use client'
import { useEffect } from 'react'
import { IconPlus, IconEdit, IconTrash, IconPackage, IconDownload } from '@tabler/icons-react'
import { useDataStore }    from '@/store/dataStore'
import { useUiStore }      from '@/store/uiStore'
import { usePermissions }  from '@/hooks/usePermissions'
import { useInlineFilter } from '@/hooks/useInlineFilter'
import { createClient }    from '@/lib/supabase/client'
import { fmt, getValeurStockActuel, isActif } from '@/lib/helpers'
import { exportToCSV, todayFileDate } from '@/lib/csv'
import { highlight }       from '@/hooks/useSearch'
import Button              from '@/components/ui/Button'
import StatusTag, { getStockStatus } from '@/components/ui/badges/StatusTag'
import AmortBar            from '@/components/ui/badges/AmortBar'
import InlineSearchBar     from '@/components/search/InlineSearchBar'

export default function ProduitsTable({ dept }) {
  const supabase = createClient()

  const produits          = useDataStore(s => s.produits.filter(p => p.dept === dept))
  const mouvementsEntrees = useDataStore(s => s.mouvementsEntrees)
  const loadProduits      = useDataStore(s => s.loadProduits)
  const deleteProduit     = useDataStore(s => s.deleteProduit)
  const toggleProductActif = useDataStore(s => s.toggleProductActif)
  const { openModal, openConfirm, showToast } = useUiStore()
  const perm = usePermissions()

  const pageKey = `stock-${dept === 'IT' ? 'it' : 'fin'}`
  const { filterState, setFilterState, applyFilters } = useInlineFilter(pageKey)

  const canMan   = dept === 'IT' ? perm.canManIT  : perm.canManFin
  const showPrix = perm.canSeePrix

  useEffect(() => { loadProduits(supabase, dept) }, [dept]) // eslint-disable-line

  const cats     = [...new Set(produits.map(p => p.categorie))].sort()
  const filtered = applyFilters(produits, 'produit')
  // Mirrors js/stock.js prodTable() headerInfo : la valeur CUMP agrégée
  // n'inclut QUE les produits actifs (un produit inactif est exclu des
  // totaux, cohérent avec sa sortie du périmètre opérationnel).
  const valTotal = filtered.filter(isActif).reduce((s, p) => s + getValeurStockActuel(p, mouvementsEntrees), 0)
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

  // Mirrors js/stock.js toggleProductActif() : confirm avant bascule, toast succès
  // ou erreur, reload local après MAJ en base (« update actif + updated_at »).
  const handleToggleActif = (p) => {
    const currentlyActif = isActif(p)
    openConfirm({
      title: `${currentlyActif ? 'Désactiver' : 'Réactiver'} "${p.nom}" ?`,
      message: currentlyActif
        ? 'Le produit ne sera plus sélectionnable dans les nouveaux mouvements et demandes, et n\'apparaîtra plus dans le Dashboard (alertes/KPIs).'
        : 'Le produit sera de nouveau sélectionnable et apparaîtra dans le Dashboard.',
      danger: !currentlyActif,
      onConfirm: async () => {
        const { error } = await toggleProductActif(supabase, p.id, !currentlyActif)
        if (error) showToast('Erreur: ' + error.message, 'error')
        else {
          showToast(currentlyActif ? `"${p.nom}" désactivé` : `"${p.nom}" réactivé`)
          await loadProduits(supabase, dept)
        }
      },
    })
  }

  // Règle métier (js/export.js exportProduitsCSV) : export de la liste filtrée
  // courante uniquement (query/cat/statut). Les 4 colonnes prix/valeur ne sont
  // ajoutées que si canSeePrix() ; la valeur stock CUMP reste vide pour les
  // produits amortissables (valorisés dans le module Actifs, jamais ici).
  const handleExport = () => {
    const headers = ['ID', 'Produit', 'Catégorie', 'Département', 'Emplacement', 'Stock', 'Seuil critique', 'Statut']
    if (showPrix) headers.push('Valeur Stock CUMP (MGA)', 'Valeur achat (MGA)', 'Date achat', 'Durée amort. (mois)')
    const rows = filtered.map(p => {
      const row = [p.id, p.nom, p.categorie, p.dept, p.emplacement || '', p.stock, p.seuil, getStockStatus(p.stock, p.seuil)]
      if (showPrix) row.push(
        p.is_amortissable ? '' : getValeurStockActuel(p, mouvementsEntrees),
        p.valeur_achat || 0,
        p.date_achat || '',
        p.duree_amortissement || ''
      )
      return row
    })
    exportToCSV(rows, headers, `inventaire_${dept.toLowerCase()}_${todayFileDate()}.csv`)
  }

  const colSpan = (canMan ? 1 : 0) + (showPrix ? 1 : 0) + 7

  // Mirrors js/stock.js (Étape B) : compteur d'inactifs affiché dans le header,
  // pour signaler que la ligne grisée n'est pas une erreur mais un produit désactivé.
  const nbInactifs = produits.filter(p => !isActif(p)).length

  return (
    <>
      <InlineSearchBar
        state={filterState}
        onChange={setFilterState}
        options={{ showCat: true, cats, showStatut: true, showActif: true }}
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
            {nbInactifs > 0 && (
              <span className="badge"
                style={{ background: 'var(--bg)', color: 'var(--text3)', fontWeight: 600 }}>
                {nbInactifs} inactif{nbInactifs > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" icon={IconDownload} onClick={handleExport}>CSV</Button>
            {canMan && (
              <Button icon={IconPlus} onClick={() => openModal('add-produit', { dept })}>
                Produit
              </Button>
            )}
          </div>
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
                {showPrix && <th>Valeur Stock (CUMP)</th>}
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
                const stockColor = p.stock === 0
                  ? 'var(--red)'
                  : p.stock <= p.seuil
                  ? 'var(--amber)'
                  : 'var(--text)'
                const inactif = !isActif(p)

                return (
                  <tr key={p.id} className={inactif ? 'row-inactif' : undefined}>
                    <td className="cell-mono" style={{ fontSize: 11 }}>{p.id}</td>

                    <td className="cell-name">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span dangerouslySetInnerHTML={highlight(p.nom, q)} />
                        {/* Mirrors js/stock.js : mention « Produit inactif » sous le nom */}
                        {inactif && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', letterSpacing: 0.2 }}>
                            ✕ Produit inactif
                          </span>
                        )}
                      </div>
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
                      <td style={{ fontWeight: 700 }}>
                        {p.is_amortissable
                          ? <span className="text-muted" style={{ fontSize: 11 }}>Voir Actifs</span>
                          : `${fmt(getValeurStockActuel(p, mouvementsEntrees))} MGA`}
                      </td>
                    )}

                    {/* Mirrors js/stock.js prodTable() : la cellule Statut affiche
                        le statut stock UNIQUEMENT pour les produits actifs (un
                        inactif montre « — ») + badge actif/inactif systématique. */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 }}>
                        {inactif
                          ? <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>
                          : <StatusTag stock={p.stock} seuil={p.seuil} />}
                        <span style={{
                          fontSize: 9.5, fontWeight: 700,
                          color: inactif ? '#94a3b8' : '#16a34a',
                          background: inactif ? '#f1f5f9' : '#dcfce7',
                          padding: '1px 6px', borderRadius: 9999, alignSelf: 'flex-start',
                        }}>
                          {inactif ? '✕ Inactif' : '✓ Actif'}
                        </span>
                      </div>
                    </td>

                    {canMan && (
                      <td>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {/* Mirrors js/stock.js (Étape B) : bascule actif/inactif */}
                          <button
                            type="button"
                            className={`actif-toggle${inactif ? ' off' : ' on'}`}
                            onClick={() => handleToggleActif(p)}
                            title={inactif ? 'Cliquer pour réactiver ce produit' : 'Cliquer pour désactiver ce produit'}
                          >
                            {inactif ? '✓ Activer' : '✕ Désactiver'}
                          </button>
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