'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconCash, IconAlertTriangle, IconClipboardList,
  IconTrendingUp, IconTrendingDown, IconChartBar,
  IconLayoutDashboard, IconCalendarWeek, IconCalendarStats, IconBox, IconDevices,
  IconChevronLeft, IconChevronRight, IconCalendar, IconDownload,
  IconActivity, IconFilter, IconCalendarOff, IconHeartbeat, IconCategory,
  IconClockOff, IconInfoCircle, IconDevicesOff, IconArrowRight,
} from '@tabler/icons-react'
import { useDataStore } from '@/store/dataStore'
import { useActifsStore } from '@/store/actifsStore'
import { usePretsStore, getActifNumero } from '@/store/pretsStore'
import { usePermissions } from '@/hooks/usePermissions'
import AccessDenied from '@/components/ui/AccessDenied'
import { useDateFilter } from '@/hooks/useDateFilter'
import { createClient } from '@/lib/supabase/client'
import { exportRapportHebdoCSV } from '@/lib/csv'
import { fmt, fmtDate, fmtDTSplit, getValeurStockActuel, startOfWeekMonday, endOfWeekSunday, weekDayKey, labelSemaine } from '@/lib/helpers'
import { calcVNCActif } from '@/lib/actifs'
import {
  getProduitsVisibles, tauxValidationGlobal, topProduitsDistribues,
  repartitionActifsStatut, evolutionValeurStock,
  produitsSansMouvement90j, coutMoyenSorties, valeurMoyenneParCategorie,
  WEEK_CACHE_TTL, getWeekVisibleDepts, loadWeekFluxData, computeWeekDeptStats,
  statsAgentsSemaine, variationLabel,
} from '@/lib/reports'
import KpiCard from '@/components/ui/KpiCard'
import Button from '@/components/ui/Button'
import DeptTag from '@/components/ui/badges/DeptTag'
import StatBadge from '@/components/ui/badges/StatBadge'
import TypeBadge from '@/components/ui/badges/TypeBadge'
import BarChartCard from '@/components/charts/BarChartCard'
import LineChartCard from '@/components/charts/LineChartCard'
import DoughnutChartCard from '@/components/charts/DoughnutChartCard'

const RAPPORTS_TABS = [
  { id: 'synthese', lbl: 'Synthèse', icon: IconLayoutDashboard },
  { id: 'hebdo', lbl: 'Hebdomadaire', icon: IconCalendarWeek },
  { id: 'periode', lbl: 'Période', icon: IconCalendarStats },
  { id: 'stock', lbl: 'Stock', icon: IconBox },
  { id: 'actifs', lbl: 'Actifs', icon: IconDevices },
]

function MoreRowsNote({ total, shown }) {
  return total > shown ? (
    <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
      … et {total - shown} autre(s) non affiché(s).
    </div>
  ) : null
}

// Miroir de renderWeekDeptBlock() : une carte par département visible.
function WeekDeptBlock({ dept, stats, showP, canSeeAssets, onExport }) {
  const color = dept === 'IT' ? '#4f46e5' : '#10b981'
  const agents = statsAgentsSemaine(stats.mvts)
  const demandes = [...stats.dms]
    .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
    .slice(0, 5)
  const topRows = list => list.length
    ? list.map((p, i) => (
        <tr key={i}>
          <td style={{ fontWeight: 600 }}>{p.nom}</td>
          <td>{fmt(p.qty)}</td>
          {showP && <td>{fmt(p.valeur)} MGA</td>}
        </tr>
      ))
    : <tr><td colSpan={showP ? 3 : 2} className="empty-state">Aucune donnée</td></tr>
  const moreNote = (total, shown) => total > shown
    ? <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
        … et {total - shown} autre(s) — voir l&apos;export CSV.
      </div>
    : null

  return (
    <>
      <div className="card" style={{ borderLeft: `3px solid ${color}`, marginBottom: 14 }}>
        <div className="card-header">
          <div className="card-header-title">{dept} — flux de la semaine</div>
          <Button variant="outline" size="sm" icon={IconDownload} onClick={onExport}>
            Export CSV semaine
          </Button>
        </div>
        <div className="card-body">
          {!stats.hasData && (
            <div style={{ marginBottom: 12, padding: 10, background: 'var(--amber-l)', color: 'var(--amber-d)', fontSize: 12 }}>
              Aucune transaction enregistrée pour {dept} sur cette semaine.
            </div>
          )}
          <div className="kpi-grid">
            <KpiCard value={stats.nbMvt} label="Mouvements" sub={variationLabel(stats.nbMvt, stats.nbMvtPrev)} accent="#6366f1" />
            <KpiCard value={fmt(stats.qtyIn)} label="Entrées (qté)" sub={`${stats.entrees.length} mouvement(s)`} accent="#16a34a" />
            <KpiCard value={fmt(stats.qtyOut)} label="Sorties (qté)" sub={`${stats.sorties.length} mouvement(s)`} accent="#dc2626" />
            {showP && (
              <>
                <KpiCard
                  value={`${fmt(stats.valIn)} MGA`}
                  label="Valeur entrées"
                  sub={variationLabel(stats.valIn, stats.prevEntrees.reduce((s, m) => s + (m.valeur || 0), 0), true)}
                  accent="#16a34a"
                />
                <KpiCard
                  value={`${fmt(stats.valOut)} MGA`}
                  label="Valeur sorties"
                  sub={variationLabel(stats.valOut, stats.prevSorties.reduce((s, m) => s + (m.valeur || 0), 0), true)}
                  accent="#dc2626"
                />
                <KpiCard value={`${fmt(stats.net)} MGA`} label="Solde net" sub="entrées − sorties" accent={stats.net >= 0 ? '#16a34a' : '#dc2626'} />
              </>
            )}
          </div>

          <div className="card-header-title" style={{ margin: '10px 0 6px' }}>Flux jour par jour (lun → dim)</div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Jour</th><th>Entrées (qté)</th><th>Sorties (qté)</th>{showP && <><th>Valeur entrées</th><th>Valeur sorties</th><th>Net</th></>}</tr>
              </thead>
              <tbody>
                {stats.daily.map((d, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{d.label}</td>
                    <td style={{ color: '#16a34a', fontWeight: 700 }}>{fmt(d.qtyIn)}</td>
                    <td style={{ color: '#dc2626', fontWeight: 700 }}>{fmt(d.qtyOut)}</td>
                    {showP && (
                      <>
                        <td>{fmt(d.valIn)} MGA</td>
                        <td>{fmt(d.valOut)} MGA</td>
                        <td style={{ fontWeight: 700, color: d.net >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(d.net)} MGA</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header"><div className="card-header-title">Activité par agent</div></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Agent</th><th>Total transactions</th><th>Entrées</th><th>Sorties</th><th>Qté Entrées / Sorties</th>{showP && <th>Valeur Entrées / Sorties</th>}</tr>
            </thead>
            <tbody>
              {agents.length === 0 && <tr><td colSpan={showP ? 6 : 5} className="empty-state">Aucune transaction cette semaine</td></tr>}
              {agents.map((a, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{a.agent}</td>
                  <td style={{ fontWeight: 800 }}>{fmt(a.total)}</td>
                  <td style={{ color: '#16a34a', fontWeight: 700 }}>{fmt(a.entrees)}</td>
                  <td style={{ color: '#dc2626', fontWeight: 700 }}>{fmt(a.sorties)}</td>
                  <td>{fmt(a.qtyEntree)} / {fmt(a.qtySortie)}</td>
                  {showP && <td>{fmt(a.valEntree)} MGA / {fmt(a.valSortie)} MGA</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header"><div className="card-header-title">Demandes de la semaine ({stats.demandes.total})</div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Demandeur</th><th>Produit</th><th>Qté</th><th>Statut</th></tr></thead>
            <tbody>
              {demandes.length === 0 && <tr><td colSpan={5} className="empty-state">Aucune demande créée cette semaine</td></tr>}
              {demandes.map(d => {
                const { date, time } = fmtDTSplit(d.created_at || d.date)
                return (
                  <tr key={d.id}>
                    <td className="col-date"><div className="dt-date">{date}</div><div className="dt-time">{time}</div></td>
                    <td>{d.demandeur || '—'}</td>
                    <td>{d.produit || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{d.qty || 0}</td>
                    <td><StatBadge statut={d.statut} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {moreNote(stats.dms.length, demandes.length)}
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header"><div className="card-header-title">Top entrées</div></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Produit</th><th>Qté</th>{showP && <th>Valeur</th>}</tr></thead>
              <tbody>{topRows(stats.topEntrees)}</tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-header-title">Top sorties</div></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Produit</th><th>Qté</th>{showP && <th>Valeur</th>}</tr></thead>
              <tbody>{topRows(stats.topSorties)}</tbody>
            </table>
          </div>
        </div>
      </div>

      {canSeeAssets && (
        <div className="dashboard-grid" style={{ marginTop: 14 }}>
          <div className="card">
            <div className="card-header"><div className="card-header-title">Actifs créés ({stats.actifsCrees.length})</div></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>N° actif</th><th>Produit</th><th>Statut</th></tr></thead>
                <tbody>
                  {stats.actifsCrees.slice(0, 5).map(a => {
                    const { date, time } = fmtDTSplit(a.date_entree)
                    return (
                      <tr key={a.id}>
                        <td className="col-date"><div className="dt-date">{date}</div><div className="dt-time">{time}</div></td>
                        <td className="cell-mono">{a.id}</td>
                        <td>{a.produit_nom || '—'}</td>
                        <td>{a.statut || '—'}</td>
                      </tr>
                    )
                  })}
                  {!stats.actifsCrees.length && <tr><td colSpan={4} className="empty-state">Aucun actif créé cette semaine</td></tr>}
                </tbody>
              </table>
            </div>
            {moreNote(stats.actifsCrees.length, 5)}
          </div>
          <div className="card">
            <div className="card-header"><div className="card-header-title">Actifs sortis ({stats.actifsSortis.length})</div></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date sortie</th><th>N° actif</th><th>Produit</th><th>Statut</th></tr></thead>
                <tbody>
                  {stats.actifsSortis.slice(0, 5).map(a => {
                    const { date, time } = fmtDTSplit(a.sortie?.created_at || a.sortie?.date)
                    return (
                      <tr key={a.id}>
                        <td className="col-date"><div className="dt-date">{date}</div><div className="dt-time">{time}</div></td>
                        <td className="cell-mono">{a.id}</td>
                        <td>{a.produit_nom || '—'}</td>
                        <td>{a.statut || '—'}</td>
                      </tr>
                    )
                  })}
                  {!stats.actifsSortis.length && <tr><td colSpan={4} className="empty-state">Aucun actif sorti cette semaine</td></tr>}
                </tbody>
              </table>
            </div>
            {moreNote(stats.actifsSortis.length, 5)}
          </div>
          <div className="card">
            <div className="card-header"><div className="card-header-title">Prêts démarrés ({stats.pretsDemarres.length})</div></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date début</th><th>Actif</th><th>Produit</th><th>Emprunteur</th><th>Statut</th></tr></thead>
                <tbody>
                  {stats.pretsDemarres.slice(0, 5).map((p, i) => {
                    const { date, time } = fmtDTSplit(p.date_debut || p.created_at)
                    return (
                      <tr key={i}>
                        <td className="col-date"><div className="dt-date">{date}</div><div className="dt-time">{time}</div></td>
                        <td className="cell-mono">{getActifNumero(p) || '—'}</td>
                        <td>{p.produit_nom || '—'}</td>
                        <td>{p.emprunteur || '—'}</td>
                        <td>{p.statut || '—'}</td>
                      </tr>
                    )
                  })}
                  {!stats.pretsDemarres.length && <tr><td colSpan={5} className="empty-state">Aucun prêt démarré cette semaine</td></tr>}
                </tbody>
              </table>
            </div>
            {moreNote(stats.pretsDemarres.length, 5)}
          </div>
          <div className="card">
            <div className="card-header"><div className="card-header-title">Prêts rendus ({stats.pretsRendus.length})</div></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date retour</th><th>Actif</th><th>Produit</th><th>Emprunteur</th><th>Statut</th></tr></thead>
                <tbody>
                  {stats.pretsRendus.slice(0, 5).map((p, i) => {
                    const { date, time } = fmtDTSplit(p.date_retour_reelle)
                    return (
                      <tr key={i}>
                        <td className="col-date"><div className="dt-date">{date}</div><div className="dt-time">{time}</div></td>
                        <td className="cell-mono">{getActifNumero(p) || '—'}</td>
                        <td>{p.produit_nom || '—'}</td>
                        <td>{p.emprunteur || '—'}</td>
                        <td>{p.statut || '—'}</td>
                      </tr>
                    )
                  })}
                  {!stats.pretsRendus.length && <tr><td colSpan={5} className="empty-state">Aucun prêt rendu cette semaine</td></tr>}
                </tbody>
              </table>
            </div>
            {moreNote(stats.pretsRendus.length, 5)}
          </div>
        </div>
      )}
    </>
  )
}

export default function RapportsPage() {
  const perm = usePermissions()
  if (!perm.canSeeHist) return <AccessDenied />

  return <RapportsContent perm={perm} />
}

function RapportsContent({ perm }) {
  const router = useRouter()
  const { dateFrom, dateTo, filterByDate } = useDateFilter()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState('synthese')
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()))
  const [weekCache, setWeekCache] = useState({})
  const [weekReload, setWeekReload] = useState(0)

  const tabs = RAPPORTS_TABS.filter(t => t.id !== 'actifs' || perm.canSeeActifsRapports)
  const tab = tabs.some(t => t.id === activeTab) ? activeTab : 'synthese'

  useEffect(() => {
    if (activeTab !== tab) setActiveTab(tab)
  }, [activeTab, tab])
  const weekEnd = useMemo(() => endOfWeekSunday(weekStart), [weekStart])
  const weekKey = weekDayKey(weekStart)
  const weekDepts = getWeekVisibleDepts(perm)
  const weekEntry = weekCache[weekKey] || {}
  const showP = !!perm.canSeePrix
  const currentWeekStart = startOfWeekMonday(new Date())
  const isCurrentWeek = weekStart.getTime() === currentWeekStart.getTime()

  const produits          = useDataStore(s => s.produits)
  const mouvements        = useDataStore(s => s.mouvements)
  const demandes          = useDataStore(s => s.demandes)
  const mouvementsEntrees = useDataStore(s => s.mouvementsEntrees)
  const actifs            = useActifsStore(s => s.actifs)
  const prets             = usePretsStore(s => s.prets)
  const deptsVisibles     = weekDepts

  // Cache client léger (TTL 30s) — chargement S/S−1 uniquement sur l'onglet actif.
  useEffect(() => {
    if (tab !== 'hebdo') return
    const entry = weekCache[weekKey]
    if (entry?.loading || (entry?.data && Date.now() - (entry.ts || 0) < WEEK_CACHE_TTL)) return
    setWeekCache(c => ({ ...c, [weekKey]: { ...(c[weekKey] || {}), loading: true, error: null } }))
    loadWeekFluxData(
      supabase, weekStart, weekEnd,
      { canSeeIT: perm.canSeeIT, canSeeFin: perm.canSeeFin }
    )
      .then(data => setWeekCache(c => ({ ...c, [weekKey]: { data, loading: false, error: null, ts: Date.now() } })))
      .catch(err => setWeekCache(c => ({
        ...c,
        [weekKey]: { data: c[weekKey]?.data, loading: false, error: err?.message || 'Erreur de chargement', ts: Date.now() },
      })))
  }, [tab, weekKey, weekReload]) // eslint-disable-line react-hooks/exhaustive-deps

  const goWeek = delta => setWeekStart(s => {
    const d = new Date(s)
    d.setDate(d.getDate() + delta * 7)
    return d
  })
  const goNext = () => {
    const current = startOfWeekMonday(new Date())
    setWeekStart(s => {
      const d = new Date(s)
      d.setDate(d.getDate() + 7)
      return d > current ? current : d
    })
  }
  const goToday = () => {
    const current = startOfWeekMonday(new Date())
    setWeekStart(current)
    setWeekCache(c => {
      const next = { ...c }
      delete next[weekDayKey(current)]
      return next
    })
    setWeekReload(n => n + 1)
  }
  const retryWeek = () => {
    setWeekCache(c => {
      const next = { ...c }
      delete next[weekKey]
      return next
    })
    setWeekReload(n => n + 1)
  }
  const weekStats = weekDepts.map(dept =>
    computeWeekDeptStats(dept, weekEntry, weekStart, weekEnd, prets, actifs)
  )

  const prodsVisibles = getProduitsVisibles(produits, perm)

  const vIT = produits.filter(p => p.dept === 'IT')
    .reduce((s, p) => s + getValeurStockActuel(p, mouvementsEntrees), 0)
  const vFin = produits.filter(p => p.dept === 'Finance')
    .reduce((s, p) => s + getValeurStockActuel(p, mouvementsEntrees), 0)
  const vnc = list => list
    .filter(a => a.statut === 'En service' || a.statut === 'En prêt')
    .reduce((s, a) => s + (calcVNCActif(a) || 0), 0)
  const totIT = vIT + vnc(actifs.filter(a => a.dept === 'IT'))
  const totFin = vFin + vnc(actifs.filter(a => a.dept === 'Finance'))

  // ── Période sélectionnée (Topbar) ──────────────────────────────
  const mvtPeriode = mouvements.filter(m => deptsVisibles.includes(m.dept) && filterByDate(m.created_at || m.date))
  const entreesP    = mvtPeriode.filter(m => m.type === 'Entrée')
  const sortiesP    = mvtPeriode.filter(m => m.type === 'Sortie')
  const valEntreesP = entreesP.reduce((s, m) => s + (m.valeur || 0), 0)
  const valSortiesP = sortiesP.reduce((s, m) => s + (m.valeur || 0), 0)
  const qtyEntreesP = entreesP.reduce((s, m) => s + (m.qty || 0), 0)
  const qtySortiesP = sortiesP.reduce((s, m) => s + (m.qty || 0), 0)
  const soldeNet    = showP ? valEntreesP - valSortiesP : qtyEntreesP - qtySortiesP
  const periodeLbl  = `${fmtDate(dateFrom)} → ${fmtDate(dateTo)}`

  const demVisibles = demandes.filter(d => deptsVisibles.includes(d.dept) && filterByDate(d.created_at || d.date))
  const tauxValid   = tauxValidationGlobal(demVisibles)
  const nbAttente   = demVisibles.filter(d => d.statut === 'En attente').length

  const nbProduits  = prodsVisibles.length
  const nbUnites    = prodsVisibles.reduce((s, p) => s + (p.stock || 0), 0)
  const critiques   = prodsVisibles
    .filter(p => p.actif !== false && (p.stock <= p.seuil || p.stock === 0))
    .sort((a, b) => (a.stock || 0) - (b.stock || 0))
  const nbCritiques = critiques.length
  const nbRuptures  = critiques.filter(p => p.stock === 0).length
  const nbAmort     = prodsVisibles.filter(p => p.is_amortissable).length

  const kpis = [
    ...(showP && perm.canSeeIT ? [{ icon: IconCash, color: 'indigo', value: `${fmt(totIT)} MGA`, label: 'Valeur stock IT', sub: 'CUMP + VNC actifs' }] : []),
    ...(showP && perm.canSeeFin ? [{ icon: IconCash, color: 'green', value: `${fmt(totFin)} MGA`, label: 'Valeur stock Finance', sub: 'CUMP + VNC actifs' }] : []),
    { icon: IconTrendingUp,    color: 'indigo', value: mvtPeriode.length, label: 'Mouvements (période)', sub: `${fmt(qtyEntreesP)} entrées · ${fmt(qtySortiesP)} sorties` },
    { icon: IconAlertTriangle, color: 'red',    value: nbCritiques, label: 'Produits critiques', sub: `${nbRuptures} rupture(s)` },
    { icon: IconClipboardList, color: 'amber',  value: nbAttente, label: 'Demandes en attente', sub: 'à traiter' },
    { icon: IconChartBar,      color: 'amber',  value: `${tauxValid}%`, label: 'Taux de validation', sub: 'Validé / (Validé + Refusé)' },
    ...(showP ? [
      { icon: IconTrendingUp,   color: 'green', value: `${fmt(valEntreesP)} MGA`, label: 'Valeur entrées (période)', sub: "coût d'acquisition" },
      { icon: IconTrendingDown, color: 'red',   value: `${fmt(valSortiesP)} MGA`, label: 'Valeur sorties (période)', sub: 'valorisées au CUMP' },
    ] : []),
  ]

  // ── Analyse détaillée ───────────────────────────────────────────
  const valMoyCat    = valeurMoyenneParCategorie(produits, mouvementsEntrees, perm)
  const coutMoySortie = coutMoyenSorties(sortiesP)
  const sansMvt        = produitsSansMouvement90j(produits, mouvements, perm)
  const dernieres      = [...mvtPeriode]
    .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
    .slice(0, 8)
  const nbActifsProd   = prodsVisibles.filter(p => p.actif !== false).length
  const nbInactifsProd = nbProduits - nbActifsProd

  const actifsVisibles = actifs.filter(a => deptsVisibles.includes(a.dept))
  const actifsCreesPeriode = actifsVisibles.filter(a => a.date_entree && filterByDate(a.date_entree)).length
  const actifsSortisPeriode = new Set(
    mvtPeriode
      .filter(m => m.actif_id && m.type === 'Sortie' && (m.created_at || m.date) && deptsVisibles.includes(m.dept))
      .map(m => m.actif_id)
  ).size

  // ── Données charts ──────────────────────────────────────────────
  const catData = valMoyCat.slice(0, 8)

  const monthlyEvol = useMemo(() => {
    const today = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) months.push(new Date(today.getFullYear(), today.getMonth() - i, 1))
    const labels = months.map(d => d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }))
    const countFor = (type, mDate, next) =>
      mvtPeriode
        .filter(m => m.type === type && new Date(m.created_at || m.date) >= mDate && new Date(m.created_at || m.date) < next)
        .reduce((s, m) => s + m.qty, 0)
    const entrees = months.map((mDate, i) => countFor('Entrée', mDate, i < 5 ? months[i + 1] : new Date(mDate.getFullYear(), mDate.getMonth() + 1, 1)))
    const sorties = months.map((mDate, i) => countFor('Sortie', mDate, i < 5 ? months[i + 1] : new Date(mDate.getFullYear(), mDate.getMonth() + 1, 1)))
    return { labels, entrees, sorties }
  }, [mvtPeriode])

  const topDistrib = topProduitsDistribues(sortiesP, 10)
  const repActifs  = repartitionActifsStatut(actifs, perm)
  const evolStock  = evolutionValeurStock(produits, mouvements, perm, 6)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rapports & Statistiques</h1>
          <p className="page-subtitle">
            {tab === 'hebdo'
              ? 'Flux opérationnels de la semaine (lundi → dimanche)'
              : tab === 'periode'
                ? 'Analyse des mouvements et de la valeur sur la période sélectionnée'
                : tab === 'stock'
                  ? 'Santé du catalogue, produits dormants et alertes'
                  : tab === 'actifs'
                    ? 'Vision légère du patrimoine amortissable'
                    : 'Pilotage rapide — période sélectionnée'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <Button
              key={t.id}
              variant={tab === t.id ? 'indigo' : 'outline'}
              icon={Icon}
              onClick={() => setActiveTab(t.id)}
            >
              {t.lbl}
            </Button>
          )
        })}
      </div>

      {tab === 'hebdo' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-header-title">Rapport hebdomadaire — Flux de transactions</div>
              <span className="badge">{showP ? 'Montants visibles' : 'Montants masqués'}</span>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: 12, padding: 10, background: 'var(--bg)', color: 'var(--text2)', fontSize: 12 }}>
                Semaine <strong>lundi → dimanche</strong> · date de transaction = <code>created_at || date</code>. Le rapport est indépendant du filtre de période de la barre supérieure.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, marginRight: 'auto' }}>{labelSemaine(weekStart, weekEnd)}</span>
                <Button variant="outline" icon={IconChevronLeft} onClick={() => goWeek(-1)}>Semaine précédente</Button>
                <Button variant="indigo" icon={IconCalendar} onClick={goToday}>Cette semaine</Button>
                <Button variant="outline" icon={IconChevronRight} disabled={isCurrentWeek} onClick={goNext}>Semaine suivante</Button>
              </div>
            </div>
          </div>

          {weekEntry.loading && !weekEntry.data ? (
            <div className="card"><div className="card-body">Chargement du rapport hebdomadaire…</div></div>
          ) : weekEntry.error ? (
            <div className="card"><div className="card-body">
              Impossible de charger le rapport : {weekEntry.error} ·{' '}
              <button type="button" className="btn btn-outline" onClick={retryWeek}>Réessayer</button>
            </div></div>
          ) : weekDepts.length ? (
            weekStats.map(stats => (
              <WeekDeptBlock
                key={stats.dept}
                dept={stats.dept}
                stats={stats}
                showP={showP}
                canSeeAssets={stats.dept === 'IT' ? perm.canSeeActifsIT : perm.canSeeActifsFin}
                onExport={() => exportRapportHebdoCSV({
                  dept: stats.dept, stats,
                  entry: weekEntry, weekStart, weekEnd,
                  perm, canSeeAssets: stats.dept === 'IT' ? perm.canSeeActifsIT : perm.canSeeActifsFin,
                  actifs,
                })}
              />
            ))
          ) : (
            <div className="card"><div className="card-body">Aucun département accessible.</div></div>
          )}
        </>
      )}

      {tab === 'synthese' && (
        <>
          <div className="kpi-grid">
            {kpis.map((k, i) => <KpiCard key={i} index={i} {...k} />)}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-header-title">
                <IconActivity size={16} style={{ color: 'var(--teal)' }} />
                Pulse — {showP ? 'solde net valorisé' : 'solde net des quantités'}
              </div>
              <span className="badge" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>{periodeLbl}</span>
            </div>
            <div style={{ padding: 16, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <div className="kpi-val" style={{ color: soldeNet >= 0 ? '#16a34a' : '#dc2626' }}>
                {showP ? `${fmt(soldeNet)} MGA` : fmt(soldeNet)}
              </div>
              <div className="kpi-sub" style={{ marginTop: 0 }}>
                {showP ? 'entrées − sorties valorisées sur la période' : 'entrées − sorties en unités sur la période'}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'actifs' && (
        <>
          <div
            className="info-banner"
            style={{
              marginBottom: 14,
              flexWrap: 'wrap',
              background: 'linear-gradient(135deg, var(--info-bg, #eff6ff), var(--ok-bg, #f0fdf4))',
              border: '1px solid var(--info-bd, #bfdbfe)',
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: 'var(--info-fg, #1d4ed8)',
            }}
          >
            <IconInfoCircle size={16} style={{ color: '#0ea5e9' }} />
            <div>Vue patrimoniale légère. Le registre complet et l&apos;amortissement restent sur la page <strong>Amortissement</strong>.</div>
            <div style={{ marginLeft: 'auto' }}>
              <Button variant="indigo" icon={IconArrowRight} onClick={() => router.push('/amortissement')}>
                Ouvrir Amortissement
              </Button>
            </div>
          </div>

          <div className="kpi-grid">
            <KpiCard color="purple" value={actifsCreesPeriode} label="Actifs créés sur la période" sub="date d'entrée" />
            <KpiCard color="red" value={actifsSortisPeriode} label="Actifs sortis sur la période" sub="sorties individuelles" />
          </div>

          {actifsVisibles.length ? (
            <div className="chart-grid">
              <div className="card">
                <div className="card-header">
                  <div className="card-header-title">Répartition des actifs par statut ({actifsVisibles.length})</div>
                </div>
                <div className="card-body">
                  <DoughnutChartCard
                    labels={repActifs.map(r => r.statut)}
                    data={repActifs.map(r => r.n)}
                    colors={['#16a34a', '#1d4ed8', '#f59e0b', '#dc2626', '#94a3b8']}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              className="info-banner"
              style={{
                background: 'linear-gradient(135deg, var(--info-bg, #eff6ff), var(--ok-bg, #f0fdf4))',
                border: '1px solid var(--info-bd, #bfdbfe)',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                color: 'var(--info-fg, #1d4ed8)',
              }}
            >
              <IconDevicesOff size={16} style={{ color: '#94a3b8' }} />
              <div>Aucun actif individuel visible pour votre périmètre.</div>
            </div>
          )}
        </>
      )}

      {tab === 'stock' && (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <div className="card-header-title"><IconHeartbeat size={16} style={{ color: 'var(--teal)' }} />Santé du catalogue</div>
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
              <div>
                <div className="kpi-label">Coût moyen des sorties</div>
                <div className="kpi-val" style={{ fontSize: 18 }}>{showP ? `${fmt(Math.round(coutMoySortie))} MGA` : '—'}</div>
                <div className="kpi-sub">{showP ? 'sur la période sélectionnée' : 'montants masqués'}</div>
              </div>
              <div>
                <div className="kpi-label">Produits actifs / inactifs</div>
                <div className="kpi-val" style={{ fontSize: 18 }}>{nbActifsProd} / {nbInactifsProd}</div>
                <div className="kpi-sub">{nbAmort} amortissable(s)</div>
              </div>
              <div>
                <div className="kpi-label">Unités en stock</div>
                <div className="kpi-val" style={{ fontSize: 18 }}>{fmt(nbUnites)}</div>
                <div className="kpi-sub">toutes références visibles</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <div className="card-header-title"><IconCategory size={16} style={{ color: '#4f46e5' }} />Valeur moyenne par catégorie (non-amortissables)</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead><tr><th>Catégorie</th><th>Nb produits</th>{showP && <th>Valeur moyenne</th>}</tr></thead>
                <tbody>
                  {valMoyCat.length === 0 && (
                    <tr><td colSpan={showP ? 3 : 2} className="empty-state">Aucune donnée</td></tr>
                  )}
                  {valMoyCat.slice(0, 8).map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{c.cat}</td>
                      <td className="text-muted">{c.n}</td>
                      {showP && <td>{fmt(Math.round(c.moyenne))} MGA</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <MoreRowsNote total={valMoyCat.length} shown={8} />
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <div className="card-header-title"><IconClockOff size={16} style={{ color: '#f59e0b' }} />Produits sans mouvement &gt; 90 j ({sansMvt.length})</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead><tr><th>Dépt</th><th>Produit</th><th>Catégorie</th><th>Stock</th></tr></thead>
                <tbody>
                  {sansMvt.length === 0 && (
                    <tr><td colSpan={4} className="empty-state">Aucun produit dormant</td></tr>
                  )}
                  {sansMvt.slice(0, 10).map(p => (
                    <tr key={p.id}>
                      <td><DeptTag dept={p.dept} /></td>
                      <td style={{ fontWeight: 600 }}>{p.nom}</td>
                      <td><span className="badge" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>{p.categorie}</span></td>
                      <td className="text-muted">{p.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <MoreRowsNote total={sansMvt.length} shown={10} />
          </div>

          {critiques.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-header-title"><IconAlertTriangle size={16} style={{ color: '#dc2626' }} />Alertes stock ({critiques.length})</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead><tr><th>Dépt</th><th>Produit</th><th>Stock</th><th>Seuil</th></tr></thead>
                  <tbody>
                    {critiques.slice(0, 8).map(p => (
                      <tr key={p.id}>
                        <td><DeptTag dept={p.dept} /></td>
                        <td style={{ fontWeight: 600 }}>{p.nom}</td>
                        <td style={{ fontWeight: 700, color: p.stock === 0 ? '#dc2626' : '#f59e0b' }}>{p.stock}</td>
                        <td className="text-muted">{p.seuil ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <MoreRowsNote total={critiques.length} shown={8} />
            </div>
          )}
        </>
      )}

      {tab === 'periode' && (
        <>
          <div
            className="info-banner"
            style={{
              marginBottom: 14,
              background: 'linear-gradient(135deg, var(--info-bg, #eff6ff), var(--ok-bg, #f0fdf4))',
              border: '1px solid var(--info-bd, #bfdbfe)',
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: 'var(--info-fg, #1d4ed8)',
            }}
          >
            <IconFilter size={16} style={{ color: '#0ea5e9' }} />
            <div>Période analysée : <strong>{periodeLbl}</strong> — filtre de la barre supérieure.</div>
          </div>

          {mvtPeriode.length === 0 && (
            <div
              className="info-banner"
              style={{
                marginBottom: 14,
                background: 'var(--warn-bg, #fef3c7)',
                border: '1px solid var(--warn-bd, #fcd34d)',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                color: 'var(--warn-fg, #b45309)',
              }}
            >
              <IconCalendarOff size={16} style={{ color: '#f59e0b' }} />
              <div>Aucun mouvement enregistré sur la période sélectionnée.</div>
            </div>
          )}

          <div className="chart-grid">
            <div className="card">
              <div className="card-header"><div className="card-header-title">Entrées vs Sorties — 6 derniers mois</div></div>
              <div className="card-body">
                <BarChartCard
                  labels={monthlyEvol.labels}
                  datasets={[
                    { label: 'Entrées', data: monthlyEvol.entrees, color: '#10b981' },
                    { label: 'Sorties', data: monthlyEvol.sorties, color: '#ef4444' },
                  ]}
                  showLegend
                />
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-header-title">Valeur du stock par catégorie (non-amortissables)</div></div>
              <div className="card-body">
                <BarChartCard
                  labels={catData.map(c => c.cat)}
                  datasets={[{ data: catData.map(c => Math.round(c.total / 1000)), color: '#4f46e5' }]}
                  indexAxis="y"
                  tickFormat={v => v + 'K'}
                />
              </div>
            </div>
          </div>

          <div className="chart-grid">
            <div className="card">
              <div className="card-header"><div className="card-header-title">Top produits distribués (période)</div></div>
              <div className="card-body">
                <BarChartCard
                  labels={topDistrib.map(p => p.nom.slice(0, 16))}
                  datasets={[{ data: topDistrib.map(p => p.qty), color: '#f59e0b' }]}
                  indexAxis="y"
                />
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-header-title">Évolution de la valeur du stock (6 mois)</div></div>
              <div className="card-body">
                <LineChartCard
                  labels={evolStock.map(s => s.label)}
                  data={evolStock.map(s => Math.round(s.val / 1000))}
                  color="#0ea5e9"
                  tickFormat={v => v + 'K'}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-header-title"><IconClipboardList size={16} style={{ color: 'var(--teal)' }} />Derniers mouvements de la période</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead><tr><th>Date & Heure</th><th>Dépt</th><th>Type</th><th>Produit</th><th>Qté</th>{showP && <th>Valeur</th>}</tr></thead>
                <tbody>
                  {dernieres.length === 0 && (
                    <tr><td colSpan={showP ? 6 : 5} className="empty-state">Aucun mouvement sur la période</td></tr>
                  )}
                  {dernieres.map(m => {
                    const { date, time } = fmtDTSplit(m.created_at || m.date)
                    return (
                      <tr key={m.id}>
                        <td className="col-date"><div className="dt-date">{date}</div><div className="dt-time">{time}</div></td>
                        <td><DeptTag dept={m.dept} /></td>
                        <td><TypeBadge type={m.type} /></td>
                        <td style={{ fontWeight: 500 }}>{m.produit_nom}</td>
                        <td style={{ fontWeight: 700 }}>{m.qty}</td>
                        {showP && <td style={{ fontWeight: 700 }}>{fmt(m.valeur)} MGA</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}