'use client'
import { useEffect, useState } from 'react'
import {
  IconDevices, IconDownload, IconEdit, IconHistory, IconMapPin,
  IconRotate, IconAlertTriangle, IconX, IconArrowBackUp,
} from '@tabler/icons-react'
import { useDataStore } from '@/store/dataStore'
import { useActifsStore } from '@/store/actifsStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { usePermissions } from '@/hooks/usePermissions'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDate } from '@/lib/helpers'
import { matchesQuery, highlight } from '@/hooks/useSearch'
import {
  STATUS_ACTIF, TRANSITIONS_ACTIF, isValidTransition,
  calcVNCActif, amortPctActif,
} from '@/lib/actifs'
import { exportToCSV, todayFileDate } from '@/lib/csv'
import Button from '@/components/ui/Button'
import ActifStatutBadge from '@/components/ui/badges/ActifStatutBadge'
import AmortBar from '@/components/ui/badges/AmortBar'

export default function ActifsTable({ dept }) {
  const supabase = createClient()
  const perm = usePermissions()
  const profile = useAuthStore(s => s.profile)
  const { openModal, openConfirm, showToast } = useUiStore()
  const loadProduits = useDataStore(s => s.loadProduits)

  const actifs                = useActifsStore(s => s.actifs.filter(a => a.dept === dept))
  const loadActifs            = useActifsStore(s => s.loadActifs)
  const horsServiceActif      = useActifsStore(s => s.horsServiceActif)
  const reactiverActif        = useActifsStore(s => s.reactiverActif)
  const reformerActif         = useActifsStore(s => s.reformerActif)
  const reintegrerActif       = useActifsStore(s => s.reintegrerActif)
  const syncStockDepuisActifs = useActifsStore(s => s.syncStockDepuisActifs)

  const canM  = dept === 'IT' ? perm.canManIT : perm.canManFin
  const color = dept === 'IT' ? 'var(--indigo)' : 'var(--green)'

  const [query, setQuery] = useState('')

  useEffect(() => { loadActifs(supabase) }, []) // eslint-disable-line

  const filtered = actifs.filter(a =>
    matchesQuery([a.id, a.produit_nom, a.categorie, a.emplacement, a.statut, a.mouvement_entree_id], query)
  )

  const nbSv = actifs.filter(a => a.statut === STATUS_ACTIF.EN_SERVICE).length
  const nbPr = actifs.filter(a => a.statut === STATUS_ACTIF.EN_PRET).length
  const nbHs = actifs.filter(a => a.statut === STATUS_ACTIF.HORS_SERVICE).length
  const nbSo = actifs.filter(a => a.statut === STATUS_ACTIF.SORTI).length
  const nbRf = actifs.filter(a => a.statut === STATUS_ACTIF.REFORME).length

  const vncTotale = actifs
    .filter(a => a.statut === STATUS_ACTIF.EN_SERVICE || a.statut === STATUS_ACTIF.EN_PRET)
    .reduce((s, a) => s + (calcVNCActif(a) || 0), 0)
  const valTotale = actifs
    .filter(a => a.statut === STATUS_ACTIF.EN_SERVICE || a.statut === STATUS_ACTIF.EN_PRET)
    .reduce((s, a) => s + (a.valeur_achat || 0), 0)

  const kpis = [
    { lbl: 'En service',   val: nbSv, s: 'actifs opérationnels', c: 'var(--green)' },
    { lbl: 'En prêt',      val: nbPr, s: 'actifs sortis',        c: 'var(--indigo)' },
    { lbl: 'Hors service', val: nbHs, s: 'à vérifier/réparer',   c: 'var(--amber)' },
    { lbl: 'Sortis',       val: nbSo, s: 'sortis du stock',      c: 'var(--red)' },
    { lbl: 'Réformés',     val: nbRf, s: 'fin de vie',           c: 'var(--text3)' },
  ]
  if (perm.canSeePrix && actifs.length) {
    kpis.push({ lbl: 'VNC Totale', val: `${fmt(vncTotale)} MGA`, s: `sur ${fmt(valTotale)} MGA d'achat`, c: 'var(--indigo)' })
  }

  const afterActifChange = async (produitId) => {
    await loadActifs(supabase)
    await syncStockDepuisActifs(supabase, produitId)
    await loadProduits(supabase, dept)
  }

  const handleHorsService = async (a) => {
    const { error } = await horsServiceActif(supabase, a, profile)
    if (error) return showToast('Erreur : ' + error.message, 'error')
    showToast(`"${a.id}" mis hors service`)
    await afterActifChange(a.produit_id)
  }

  const handleReactiver = async (a) => {
    const { error } = await reactiverActif(supabase, a, profile)
    if (error) return showToast(error.message, 'error')
    showToast(`"${a.id}" réactivé en service`)
    await afterActifChange(a.produit_id)
  }

  const handleReformer = (a) => {
    openConfirm({
      title: `Réformer "${a.id}" ?`,
      message: `L'actif "${a.produit_nom}" sera définitivement réformé. Cette action est irréversible.`,
      danger: true,
      onConfirm: async () => {
        const { error } = await reformerActif(supabase, a, profile)
        if (error) return showToast('Erreur : ' + error.message, 'error')
        showToast(`"${a.id}" réformé`)
        await afterActifChange(a.produit_id)
      },
    })
  }

  const handleReintegrer = (a) => {
    openConfirm({
      title: `Réintégrer "${a.id}" en service ?`,
      message: `L'actif "${a.produit_nom}" redeviendra disponible et le stock du produit sera réincrémenté de 1.`,
      onConfirm: async () => {
        const { error } = await reintegrerActif(supabase, a.id, profile)
        if (error) return showToast('Erreur : ' + error.message, 'error')
        showToast(`"${a.id}" réintégré — remis en service`)
        await loadActifs(supabase)
        await loadProduits(supabase, dept)
      },
    })
  }

  const handleExport = () => {
    const showP = perm.canSeePrix
    const headers = ['Produit', 'Numéro de série', 'Catégorie', 'Emplacement', 'Statut', 'Date entrée', 'Mouvement entrée']
    if (showP) headers.push('Valeur achat (MGA)', 'Date achat', 'Durée amort. (mois)', 'VNC (MGA)', '% Amorti')
    const rows = actifs.map(a => {
      const row = [a.produit_nom, a.id, a.categorie, a.emplacement || '', a.statut, fmtDate(a.date_entree), a.mouvement_entree_id || '']
      if (showP) {
        const vnc = calcVNCActif(a)
        const pct = amortPctActif(a)
        row.push(a.valeur_achat || 0, a.date_achat || '', a.duree_amortissement || '', vnc, pct != null ? pct + '%' : '')
      }
      return row
    })
    exportToCSV(rows, headers, `actifs_${dept.toLowerCase()}_${todayFileDate()}.csv`)
  }

  if (!actifs.length) {
    return (
      <>
        <div className="card">
          <div className="empty-state">
            <IconDevices size={40} style={{ opacity: .3, margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 700 }}>Aucun actif individuel</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Activez « Suivi individuel amortissable » sur un produit, puis enregistrez une entrée de stock.
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
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
      </div>

      <div className="inline-search" style={{ marginBottom: 12, maxWidth: 420 }}>
        <input
          placeholder="Rechercher (numéro de série, produit, emplacement, statut…)"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-header-title">
            <IconDevices size={16} /> Registre des actifs {dept} — {filtered.length} / {actifs.length}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Produit</th><th>Numéro de série</th><th>Catégorie</th><th>Emplacement</th><th>Date entrée</th>
                {perm.canSeePrix && <th>Valeur achat</th>}
                <th>Durée</th>
                {perm.canSeePrix && <th>VNC · Avanc.</th>}
                <th>Statut</th>
                {canM && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={12}><div className="empty-state"><p>Aucun actif ne correspond</p></div></td></tr>
              )}
              {filtered.map(a => {
                const vnc = calcVNCActif(a)
                const pct = amortPctActif(a)
                return (
                  <tr key={a.id} className={a.statut === STATUS_ACTIF.REFORME ? 'alerte-row' : ''}>
                    <td className="cell-name"><span dangerouslySetInnerHTML={highlight(a.produit_nom, query)} /></td>
                    <td className="cell-mono"><span dangerouslySetInnerHTML={highlight(a.id, query)} /></td>
                    <td><span className="badge" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>{a.categorie}</span></td>
                    <td>{a.emplacement
                      ? <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>{a.emplacement}</span>
                      : <span className="text-muted">—</span>}</td>
                    <td className="text-muted">{fmtDate(a.date_entree)}</td>
                    {perm.canSeePrix && <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{fmt(a.valeur_achat)} MGA</td>}
                    <td className="text-muted" style={{ fontSize: 11 }}>
                      {a.duree_amortissement ? `${(a.duree_amortissement / 12).toFixed(1)} a` : '—'}
                    </td>
                    {perm.canSeePrix && (
                      <td>
                        {pct != null
                          ? <><div style={{ fontWeight: 700, fontSize: 12 }}>{fmt(vnc)} MGA</div><AmortBar pct={pct} /></>
                          : <span className="text-muted">—</span>}
                      </td>
                    )}
                    <td><ActifStatutBadge statut={a.statut} /></td>
                    {canM && (
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {a.statut === STATUS_ACTIF.SORTI && (
                            <Button size="sm" variant="outline" icon={IconArrowBackUp} onClick={() => handleReintegrer(a)}>Réintégrer</Button>
                          )}
                          {isValidTransition(TRANSITIONS_ACTIF, a.statut, STATUS_ACTIF.HORS_SERVICE) && (
                            <Button size="icon" variant="outline" title="Mettre hors service" onClick={() => handleHorsService(a)}>
                              <IconAlertTriangle size={14} />
                            </Button>
                          )}
                          {a.statut !== STATUS_ACTIF.SORTI && isValidTransition(TRANSITIONS_ACTIF, a.statut, STATUS_ACTIF.EN_SERVICE) && (
                            <Button size="icon" variant="outline" title="Réactiver" onClick={() => handleReactiver(a)}>
                              <IconRotate size={14} />
                            </Button>
                          )}
                          {isValidTransition(TRANSITIONS_ACTIF, a.statut, STATUS_ACTIF.REFORME) && (
                            <Button size="icon" variant="outline" title="Réformer" onClick={() => handleReformer(a)}>
                              <IconX size={14} />
                            </Button>
                          )}
                          {a.statut !== STATUS_ACTIF.REFORME && a.statut !== STATUS_ACTIF.SORTI && (
                            <Button size="icon" variant="outline" title="Transférer"
                              onClick={() => openModal('actif-transfer', { actif: a })}>
                              <IconMapPin size={14} />
                            </Button>
                          )}
                          <Button size="icon" variant="outline" title="Modifier"
                            onClick={() => openModal('edit-actif', { actif: a })}>
                            <IconEdit size={14} />
                          </Button>
                          <Button size="icon" variant="outline" title="Historique"
                            onClick={() => openModal('actif-historique', { actif: a })}>
                            <IconHistory size={14} />
                          </Button>
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