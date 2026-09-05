'use client'
import { useEffect, useState } from 'react'
import { IconTransfer, IconPlus, IconDownload, IconEye } from '@tabler/icons-react'
import { usePretsStore, STATUS_PRET, TRANSITIONS_ACTIF_UNUSED, isValidTransition, joursRestants, getActifNumero } from '@/store/pretsStore'
import { useActifsStore } from '@/store/actifsStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { usePermissions } from '@/hooks/usePermissions'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/helpers'
import { matchesQuery, highlight } from '@/hooks/useSearch'
import Button from '@/components/ui/Button'
import { exportToCSV, todayFileDate } from '@/lib/csv'

const STATUT_BADGE = {
  [STATUS_PRET.EN_COURS]:  { cls: 'badge-amort-avance',   label: '⇄ En cours' },
  [STATUS_PRET.EN_RETARD]: { cls: 'badge-critique',       label: '⚠ En retard' },
  [STATUS_PRET.RETOURNE]:  { cls: 'badge-dispo',          label: '✓ Retourné' },
  [STATUS_PRET.PERDU]:     { cls: 'badge-rupture',        label: '✕ Perdu' },
}

function PretStatutBadge({ statut }) {
  const m = STATUT_BADGE[statut] || { cls: 'badge', label: statut || '—' }
  return <span className={`badge ${m.cls}`}>{m.label}</span>
}

export default function PretsTable({ dept }) {
  const supabase = createClient()
  const perm = usePermissions()
  const profile = useAuthStore(s => s.profile)
  const { openModal, openConfirm, showToast, withSubmitLock } = useUiStore()

  const prets                 = usePretsStore(s => s.prets.filter(p => p.dept === dept))
  const loadPrets              = usePretsStore(s => s.loadPrets)
  const retournerPretAction    = usePretsStore(s => s.retournerPret)
  const perdreActifAction      = usePretsStore(s => s.perdreActif)
  const retrouverActifAction   = usePretsStore(s => s.retrouverActifPret)
  const syncStockDepuisActifs  = useActifsStore(s => s.syncStockDepuisActifs)

  const canM  = dept === 'IT' ? perm.canManIT : perm.canManFin
  const isLecteur = perm.isLecteur
  const color = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  const [query, setQuery] = useState('')

  useEffect(() => { loadPrets(supabase) }, []) // eslint-disable-line

  const filtered = prets.filter(p =>
    matchesQuery([getActifNumero(p), p.emprunteur, p.produit_nom, p.motif, p.notes, p.statut, p.id], query)
  )

  const enCours   = prets.filter(p => p.statut === STATUS_PRET.EN_COURS)
  const enRetard  = prets.filter(p => p.statut === STATUS_PRET.EN_RETARD)
  const retournes = prets.filter(p => p.statut === STATUS_PRET.RETOURNE)
  const perdus    = prets.filter(p => p.statut === STATUS_PRET.PERDU)

  const kpis = [
    { lbl: 'En cours',  val: enCours.length,   s: 'prêts actifs',                  c: '#3b82f6' },
    { lbl: 'En retard', val: enRetard.length,  s: 'dépassement échéance',          c: '#ef4444' },
    { lbl: 'Retournés', val: retournes.length, s: 'sur la période',                c: '#10b981' },
    { lbl: 'Perdus',    val: perdus.length,    s: 'actifs définitivement perdus',  c: '#7c3aed' },
    { lbl: 'Total',     val: prets.length,     s: 'enregistrements',               c: '#64748b' },
  ]

  const afterPretChange = async (produitId) => {
    await loadPrets(supabase)
    if (produitId) await syncStockDepuisActifs(supabase, produitId)
  }

  const handleRetour = (p) => {
    const actifNum = getActifNumero(p)
    openConfirm({
      title: `Confirmer le retour de "${actifNum}" ?`,
      message: `L'actif "${p.produit_nom || actifNum}" confié à ${p.emprunteur} repassera en statut En service.`,
      onConfirm: () => withSubmitLock(async () => {
        const { error } = await retournerPretAction(supabase, p.id, profile?.name, profile?.id)
        if (error) return showToast('Erreur : ' + error.message, 'error')
        showToast(`"${actifNum}" retourné — remis en service`)
        await afterPretChange(p.produit_id)
      }),
    })
  }

  const handlePerte = (p) => {
    const actifNum = getActifNumero(p)
    openConfirm({
      title: `Déclarer "${actifNum}" comme perdu ?`,
      message: `L'actif "${p.produit_nom || actifNum}" confié à ${p.emprunteur} sera définitivement réformé. Cette action est irréversible.`,
      danger: true,
      onConfirm: () => withSubmitLock(async () => {
        const { error } = await perdreActifAction(supabase, p.id, profile?.name, profile?.id)
        if (error) return showToast('Erreur : ' + error.message, 'error')
        showToast(`"${actifNum}" déclaré perdu — réformé`)
        await afterPretChange(p.produit_id)
      }),
    })
  }

  const handleRetrouve = (p) => {
    const actifNum = getActifNumero(p)
    openConfirm({
      title: `Confirmer que "${actifNum}" a été retrouvé ?`,
      message: `L'actif "${p.produit_nom || actifNum}" repassera en statut En service.`,
      onConfirm: () => withSubmitLock(async () => {
        const { data, error } = await retrouverActifAction(supabase, p.id, profile?.name, profile?.id)
        if (error) return showToast('Erreur : ' + error.message, 'error')
        showToast(`"${actifNum}" retrouvé et réintégré par ${data?.par || profile?.name}`)
        await afterPretChange(p.produit_id)
      }),
    })
  }
  const handleExport = () => {
    const headers = ['ID Prêt', 'N° Actif (CNTO)', 'Produit', 'Emprunteur', 'Valideur', 'Date début', 'Retour prévu', 'Retour effectif', 'Notes', 'Motif', 'Statut']
    const rows = prets.map(p => [
      p.id, getActifNumero(p) || '', p.produit_nom || '', p.emprunteur || '', p.valideur || '',
      fmtDate(p.date_debut || p.created_at), p.date_retour_prevue || '',
      p.date_retour_reelle ? fmtDate(p.date_retour_reelle) : '', p.notes || '', p.motif || '', p.statut,
    ])
    exportToCSV(rows, headers, `prets_${dept.toLowerCase()}_${todayFileDate()}.csv`)
  }

  return (
    <>
      {(enRetard.length > 0) && (
        <div className="info-banner" style={{ background: 'var(--red-l)', borderColor: '#fecaca', color: 'var(--red)', marginBottom: 14 }}>
          <strong>{enRetard.length} actif(s) en retard de restitution.</strong> Contactez les emprunteurs concernés.
        </div>
      )}
      {(perdus.length > 0) && (
        <div className="info-banner" style={{ background: 'var(--purple-l)', borderColor: '#c4b5fd', color: 'var(--purple)', marginBottom: 14 }}>
          <strong>{perdus.length} actif(s) déclaré(s) perdu(s).</strong> Ces actifs ont été réformés automatiquement.
        </div>
      )}

      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div key={i} className="kpi" style={{ borderLeft: `3px solid ${k.c}` }}>
            <div className="kpi-info">
              <div className="kpi-val">{k.val}</div>
              <div className="kpi-label">{k.lbl} · {k.s}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button variant="outline" icon={IconDownload} onClick={handleExport}>CSV</Button>
        {!isLecteur && canM && (
          <Button icon={IconPlus} style={{ background: color, borderColor: color }} onClick={() => openModal('pret', { dept })}>
            Nouveau prêt
          </Button>
        )}
      </div>

      <div className="inline-search" style={{ marginBottom: 12, maxWidth: 420 }}>
        <input
          placeholder="Rechercher (n° actif, emprunteur, produit, motif…)"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-header-title">
            <IconTransfer size={16} /> Registre des prêts {dept} — {filtered.length} / {prets.length}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Produit</th><th>Emprunteur</th><th>Date début</th><th>Retour prévu</th>
                <th>Délai</th><th>Notes</th><th>Motif</th><th>Statut</th><th>Retour effectif</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10}><div className="empty-state"><p>Aucun prêt ne correspond</p></div></td></tr>
              )}
              {filtered.map(p => {
                const actifNum = getActifNumero(p)
                const jours = joursRestants(p)
                let delaiLabel = '—', delaiColor = 'var(--text3)'
                if (jours !== null) {
                  delaiColor = jours < 0 ? 'var(--red)' : jours <= 2 ? 'var(--amber)' : 'var(--green)'
                  delaiLabel = jours < 0 ? `${Math.abs(jours)}j de retard` : jours === 0 ? "Aujourd'hui" : `J−${jours}`
                }

                return (
                  <tr key={p.id} style={p.statut === STATUS_PRET.EN_RETARD ? { background: '#fff5f5' } : p.statut === STATUS_PRET.PERDU ? { background: 'var(--purple-l)' } : {}}>
                    <td className="cell-name">
                      <span dangerouslySetInnerHTML={highlight(p.produit_nom || '—', query)} /><br />
                      <code className="cell-mono" style={{ fontSize: 11 }}>
                        <span dangerouslySetInnerHTML={highlight(actifNum || '—', query)} />
                      </code>
                    </td>
                    <td style={{ fontWeight: 500 }}><span dangerouslySetInnerHTML={highlight(p.emprunteur || '—', query)} /></td>
                    <td className="text-muted">{fmtDate(p.date_debut || p.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>{p.date_retour_prevue ? fmtDate(p.date_retour_prevue) : '—'}</td>
                    <td style={{ color: delaiColor, fontWeight: 700, fontSize: 11 }}>{delaiLabel}</td>
                    <td className="text-muted" style={{ fontSize: 11 }}>{p.notes || '—'}</td>
                    <td className="text-muted" style={{ maxWidth: 120, fontSize: 11 }}>{(p.motif || '').slice(0, 55)}</td>
                    <td><PretStatutBadge statut={p.statut} /></td>
                    <td className="text-muted" style={{ fontSize: 11 }}>{p.date_retour_reelle ? fmtDate(p.date_retour_reelle) : '—'}</td>
                    <td>
                      {isLecteur ? (
                        <span className="text-muted" style={{ fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <IconEye size={12} /> Lecture seule
                        </span>
                      ) : !canM ? (
                        <span className="text-muted" style={{ fontSize: 11 }}>—</span>
                      ) : p.statut === STATUS_PRET.PERDU ? (
                        <Button size="sm" onClick={() => handleRetrouve(p)}>🔎 Retrouvé</Button>
                      ) : isValidTransition({
                          [STATUS_PRET.EN_COURS]: [STATUS_PRET.RETOURNE, STATUS_PRET.PERDU],
                          [STATUS_PRET.EN_RETARD]: [STATUS_PRET.RETOURNE, STATUS_PRET.PERDU],
                        }, p.statut, STATUS_PRET.RETOURNE) ? (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <Button size="sm" onClick={() => handleRetour(p)}>↩ Retour</Button>
                          <Button size="sm" variant="outline" onClick={() => handlePerte(p)}>✕ Perdu</Button>
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 11 }}>—</span>
                      )}
                    </td>
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