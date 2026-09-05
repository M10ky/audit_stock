'use client'
import { useEffect } from 'react'
import { IconClipboardList, IconPlus, IconCheck, IconX, IconClock } from '@tabler/icons-react'
import { useDataStore }    from '@/store/dataStore'
import { useAuthStore }    from '@/store/authStore'
import { useUiStore }      from '@/store/uiStore'
import { usePermissions }  from '@/hooks/usePermissions'
import { useInlineFilter } from '@/hooks/useInlineFilter'
import { createClient }    from '@/lib/supabase/client'
import { fmtDTSplit, genId } from '@/lib/helpers'
import { useActifsStore } from '@/store/actifsStore'
import { highlight }       from '@/hooks/useSearch'
import Button              from '@/components/ui/Button'
import UrgBadge            from '@/components/ui/badges/UrgBadge'
import StatBadge           from '@/components/ui/badges/StatBadge'
import InlineSearchBar     from '@/components/search/InlineSearchBar'

export default function DemandesTable({ dept }) {
  const supabase = createClient()

  const demandes            = useDataStore(s => s.demandes.filter(d => d.dept === dept))
  const loadDemandes        = useDataStore(s => s.loadDemandes)
  const loadProduits        = useDataStore(s => s.loadProduits)
  const loadMouvements      = useDataStore(s => s.loadMouvements)
  const loadMouvementsEntrees = useDataStore(s => s.loadMouvementsEntrees)
  const validDemAction      = useDataStore(s => s.validDem)
  const profile  = useAuthStore(s => s.profile)
  const { openModal, showToast } = useUiStore()
  const perm = usePermissions()
  const { withSubmitLock } = useUiStore()
  const pageKey = `dem-${dept === 'IT' ? 'it' : 'fin'}`
  const { filterState, setFilterState, applyFilters } = useInlineFilter(pageKey)

  const canVal = dept === 'IT' ? perm.canValidIT : perm.canValidFin
  const color  = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  useEffect(() => { loadDemandes(supabase, dept) }, [dept]) // eslint-disable-line

  const filtered  = applyFilters(demandes, 'demande')
  const enAttente = filtered.filter(d => d.statut === 'En attente').length
  const q         = filterState.query

  const handleValid = (d, action) => withSubmitLock(async () => {
    if (action === 'Refusé') {
      // Aucun impact stock — simple mise à jour de statut, pas besoin de RPC.
      const { error } = await validDemAction(supabase, d.id, {
        statut: 'Refusé',
        valideur: profile?.name || '',
        valideur_id: profile?.id,
        updated_at: new Date().toISOString(),
      })
      if (error) return showToast('Erreur: ' + error.message, 'error')
      showToast('Demande refusée')
      return loadDemandes(supabase, dept)
    }

    // action === 'Validé'
    await loadProduits(supabase, dept)
    const fresh = useDataStore.getState().produits
    const prod  = fresh.find(p =>
      p.dept === dept &&
      p.nom.trim().toLowerCase() === d.produit.trim().toLowerCase()
    )
    if (!prod) {
      return showToast(`Produit "${d.produit}" introuvable dans l'inventaire ${dept}`, 'error')
    }
    if (prod.actif === false) {
      return showToast(`"${prod.nom}" est désactivé — validation impossible`, 'error')
    }
if (prod.is_amortissable) {
      // Mirrors js/app.js openDemAttribution() : ouvre un sélecteur manuel
      // d'actifs plutôt qu'une attribution FIFO automatique — le validateur
      // choisit précisément quel matériel est attribué avant que la demande
      // ne soit réellement validée.
      openModal('dem-attribution', { demande: d, produit: prod, dept })
      return
    }
    const mvtId = genId(dept === 'IT' ? 'MVT-IT' : 'MVT-FIN')

    // Validation atomique côté DB : vérifie le stock avec verrou (FOR UPDATE),
    // décrémente, insère le mouvement de Sortie et met à jour le statut de la
    // demande dans une seule transaction. Remplace l'ancien enchaînement
    // update + insert + update côté client, non atomique et sujet aux race
    // conditions en cas de validations concurrentes.
    // FIX (paramètres RPC) : les noms ci-dessous ne correspondaient pas à la
    // signature réelle de rpc_valider_demande_simple (cf. js/app.js validDem()) —
    // Supabase RPC résout les paramètres par nom, donc un mismatch fait échouer
    // l'appel (fonction introuvable) plutôt qu'une simple erreur silencieuse.
    // p_dept, p_dest et p_mvt_id étaient en plus totalement absents alors que
    // requis par la fonction SQL pour insérer le mouvement de sortie.
    const { error: rpcErr } = await supabase.rpc('rpc_valider_demande_simple', {
      p_dem_id:     d.id,
      p_produit_id: prod.id,
      p_qty:        d.qty,
      p_dept:       dept,
      p_dest:       d.dest || '',
      p_mvt_id:     mvtId,
      p_user_name:  profile?.name || 'Système',
      p_user_id:    profile?.id || null,
    })
    if (rpcErr) return showToast('Erreur: ' + rpcErr.message, 'error')

    showToast('Demande validée — stock mis à jour')
    await Promise.all([
      loadDemandes(supabase, dept),
      loadProduits(supabase, dept),
      loadMouvements(supabase, dept),
      loadMouvementsEntrees(supabase),
    ])
  })

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Button
          icon={IconPlus}
          style={{ background: color, borderColor: color }}
          onClick={() => openModal('demande', { dept })}
        >
          Nouvelle demande
        </Button>
      </div>

      <InlineSearchBar
        state={filterState}
        onChange={setFilterState}
        options={{ showUrgence: true, showStatDem: true }}
        count={demandes.length}
        filteredCount={filtered.length}
        placeholder={`Rechercher dans les demandes ${dept} (produit, demandeur, motif, destination…)`}
      />

      <div className="card">
        <div className="card-header">
          <div className="card-header-title">
            <IconClipboardList size={16} />
            {enAttente} en attente · {filtered.length} / {demandes.length} total
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th><th>Date & Heure</th><th>Demandeur</th><th>Produit</th>
                <th>Qté</th><th>Urgence</th><th>Destination</th><th>Motif</th>
                <th>Statut</th><th>Mis à jour</th><th>Validé par</th>
                {canVal && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canVal ? 12 : 11}>
                    <div className="empty-state">
                      <p>Aucune demande ne correspond</p>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map(d => {
                const created = fmtDTSplit(d.created_at || d.date)
                const updated = fmtDTSplit(d.updated_at)
                return (
                  <tr key={d.id}>
                    <td className="cell-mono" style={{ fontSize: 11 }}>{d.id}</td>
                    <td className="col-date">
                      <div className="dt-date">{created.date}</div>
                      <div className="dt-time">{created.time}</div>
                    </td>
                    <td className="cell-name">
                      <span dangerouslySetInnerHTML={highlight(d.demandeur, q)} />
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      <span dangerouslySetInnerHTML={highlight(d.produit, q)} />
                    </td>
                    <td style={{ fontWeight: 700 }}>{d.qty}</td>
                    <td><UrgBadge urgence={d.urgence} /></td>
                    <td className="text-muted">
                      <span dangerouslySetInnerHTML={highlight(d.dest || '—', q)} />
                    </td>
                    <td className="text-muted" style={{ maxWidth: 160, fontSize: 12 }}>
                      <span dangerouslySetInnerHTML={highlight((d.motif || '').slice(0, 60), q)} />
                    </td>
                    <td><StatBadge statut={d.statut} /></td>
                    <td className="col-date">
                      <div className="dt-date">{updated.date}</div>
                      <div className="dt-time">{updated.time}</div>
                    </td>
                    <td className="text-muted" style={{ fontSize: 11 }}>{d.valideur || '—'}</td>
                    {canVal && (
                      <td>
                        {d.statut === 'En attente' ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <Button size="sm" icon={IconCheck} onClick={() => handleValid(d, 'Validé')}>
                              Valider
                            </Button>
                            <Button size="icon" variant="outline" onClick={() => handleValid(d, 'Refusé')}>
                              <IconX size={14} />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <IconClock size={12} /> {d.statut}
                          </span>
                        )}
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