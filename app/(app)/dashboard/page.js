'use client'
import { useMemo } from 'react'
import {
  IconDeviceLaptop, IconCash, IconBellRinging, IconClipboardList, IconActivity, IconTrophy,
} from '@tabler/icons-react'
import { useDataStore } from '@/store/dataStore'
import { useActifsStore } from '@/store/actifsStore'
import { usePretsStore } from '@/store/pretsStore'
import { usePermissions } from '@/hooks/usePermissions'
import { useDateFilter } from '@/hooks/useDateFilter'
import { fmt, fmtDTSplit, getValeurStockActuel } from '@/lib/helpers'
import { calcVNCActif, STATUS_ACTIF } from '@/lib/actifs'
import {
  getVNCGlobaleActifs, getPretsValorises, getTauxRotationStock,
  getTopCategoriesValorisees, getRepartitionActifsEtat, getAlertesMajeures,
  evolutionValeurStock,
} from '@/lib/reports'
import KpiCard from '@/components/ui/KpiCard'
import TypeBadge from '@/components/ui/badges/TypeBadge'
import DeptTag from '@/components/ui/badges/DeptTag'
import BarChartCard from '@/components/charts/BarChartCard'
import DoughnutChartCard from '@/components/charts/DoughnutChartCard'
import LineChartCard from '@/components/charts/LineChartCard'

export default function DashboardPage() {
  const perm = usePermissions()
  const { filterByDate, hasFilter } = useDateFilter()

  const produits   = useDataStore(s => s.produits)
  const mouvements = useDataStore(s => s.mouvements)
  const demandes   = useDataStore(s => s.demandes)
  const mouvementsEntrees = useDataStore(s => s.mouvementsEntrees)
  const actifs     = useActifsStore(s => s.actifs)
  const prets      = usePretsStore(s => s.prets)

  const prodIT  = produits.filter(p => p.dept === 'IT')
  const prodFin = produits.filter(p => p.dept === 'Finance')
  const valIT   = prodIT.reduce((s, p) => s + getValeurStockActuel(p, mouvementsEntrees), 0)
  const valFin  = prodFin.reduce((s, p) => s + getValeurStockActuel(p, mouvementsEntrees), 0)

  // Mirrors js/utils.js alertsIT()/alertsFin() : les alertes n'embarquent QUE les
  // produits actifs (un produit inactif ne génère plus d'alerte de seuil).
  const alIT  = prodIT.filter(p => p.actif !== false && p.stock <= p.seuil).length
  const alFin = prodFin.filter(p => p.actif !== false && p.stock <= p.seuil).length

  // Mirrors js/reports.js renderDashboard() (FIX KPI) : la valeur CUMP n'inclut
  // que les produits non-amortissables. On additionne la VNC des actifs
  // individuels « vivants » (En service/En prêt) pour une vision patrimoine
  // complète, cohérente avec les camemberts chart-pie / chart-lecteur-repart.
  const vncIT  = actifs
    .filter(a => a.dept === 'IT' && (a.statut === STATUS_ACTIF.EN_SERVICE || a.statut === STATUS_ACTIF.EN_PRET))
    .reduce((s, a) => s + (calcVNCActif(a) || 0), 0)
  const vncFin = actifs
    .filter(a => a.dept === 'Finance' && (a.statut === STATUS_ACTIF.EN_SERVICE || a.statut === STATUS_ACTIF.EN_PRET))
    .reduce((s, a) => s + (calcVNCActif(a) || 0), 0)
  const totIT  = valIT + vncIT
  const totFin = valFin + vncFin
  const nbActifsIT  = actifs.filter(a => a.dept === 'IT'      && (a.statut === STATUS_ACTIF.EN_SERVICE || a.statut === STATUS_ACTIF.EN_PRET)).length
  const nbActifsFin = actifs.filter(a => a.dept === 'Finance' && (a.statut === STATUS_ACTIF.EN_SERVICE || a.statut === STATUS_ACTIF.EN_PRET)).length

  const attIT   = demandes.filter(d => d.dept === 'IT' && d.statut === 'En attente').length
  const attFin  = demandes.filter(d => d.dept === 'Finance' && d.statut === 'En attente').length

  const kpis = []
  if (perm.canSeeIT) kpis.push(perm.canSeePrix
    ? { icon: IconDeviceLaptop, color: 'indigo', value: `${fmt(totIT)} MGA`, label: 'Valeur Totale IT', sub: `${prodIT.length} réf. stock${nbActifsIT ? ` · ${nbActifsIT} actif(s) amort.` : ''}` }
    : { icon: IconDeviceLaptop, color: 'indigo', value: prodIT.length, label: 'Produits IT', sub: 'références' })
  if (perm.canSeeFin) kpis.push(perm.canSeePrix
    ? { icon: IconCash, color: 'green', value: `${fmt(totFin)} MGA`, label: 'Valeur Totale Finance', sub: `${prodFin.length} réf. stock${nbActifsFin ? ` · ${nbActifsFin} actif(s) amort.` : ''}` }
    : { icon: IconCash, color: 'green', value: prodFin.length, label: 'Produits Finance', sub: 'références' })
  if (perm.canManIT)  kpis.push({ icon: IconBellRinging, color: alIT  > 0 ? 'red' : 'green', value: alIT,  label: 'Alertes IT',      sub: alIT  > 0 ? 'à traiter' : 'Niveaux OK' })
  if (perm.canManFin) kpis.push({ icon: IconBellRinging, color: alFin > 0 ? 'red' : 'green', value: alFin, label: 'Alertes Finance', sub: alFin > 0 ? 'à traiter' : 'Niveaux OK' })
  if (perm.canManIT)  kpis.push({ icon: IconClipboardList, color: 'amber', value: attIT,  label: 'Demandes IT en attente',      sub: 'à traiter' })
  if (perm.canManFin) kpis.push({ icon: IconClipboardList, color: 'amber', value: attFin, label: 'Demandes Finance en attente', sub: 'à traiter' })

  const recent = [...mouvements]
    .filter(m => filterByDate(m.created_at || m.date))
    .filter(m => (m.dept === 'IT' ? perm.canSeeIT : perm.canSeeFin))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)

  // Mirrors js/reports.js drawCharts() chart-mvt : uniquement la PÉRIODE
  // sélectionnée (fMvtIT/fMvtFin = inRange), par jour, puis les 8 dernières dates.
  const mvtPeriode = mouvements.filter(m => filterByDate(m.created_at || m.date))
  const mvtByDay = useMemo(() => {
    const dates = [...new Set(mvtPeriode.map(m => (m.created_at || m.date).slice(0, 10)))].sort().slice(-8)
    const countFor = (d, type) => mvtPeriode
      .filter(m => (m.created_at || m.date).slice(0, 10) === d && m.type === type)
      .reduce((s, m) => s + m.qty, 0)
    return {
      labels: dates.map(d => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })),
      entrees: dates.map(d => countFor(d, 'Entrée')),
      sorties: dates.map(d => countFor(d, 'Sortie')),
    }
  }, [mvtPeriode])

  // Mirrors js/reports.js drawCharts() chart-pie : valeur stock (CUMP) + VNC des
  // actifs En service/En prêt par département, arrondie en millions.
  const pieIT  = Math.round(totIT / 1e6)
  const pieFin = Math.round(totFin / 1e6)
  const pieData = [], pieLabels = [], pieColors = []
  if (perm.canSeeIT)  { pieData.push(pieIT);  pieLabels.push('IT');      pieColors.push('#4f46e5') }
  if (perm.canSeeFin) { pieData.push(pieFin); pieLabels.push('Finance'); pieColors.push('#10b981') }

  // Mirrors js/reports.js renderDashboard() : bandeau « mode lecture » pour les
  // rôles sans accès prix ou sans historique.
  const showP  = perm.canSeePrix
  const showInfoBanner = !showP || !perm.canSeeHist

  // ── Bloc Lecteur (vue de pilotage) — mirrors js/reports.js lecteurBlock ──
  const lecteur = useMemo(() => {
    if (!perm.isLecteur) return null
    const vncGlobale = getVNCGlobaleActifs(actifs, perm)
    const pretsInfo  = getPretsValorises(prets, actifs, perm)
    const rotation   = getTauxRotationStock(produits, mouvements, mouvementsEntrees, perm)
    const etatActifs = getRepartitionActifsEtat(actifs, perm)
    const topCats    = getTopCategoriesValorisees(produits, actifs, mouvementsEntrees, perm, 5)
    const alertesMaj = getAlertesMajeures(produits, prets, actifs, perm)
    const serieEvol  = evolutionValeurStock(produits, mouvements, perm, 12)
    const kpis = [
      { lbl: 'Valeur Totale Stock (IT+Fin)',        val: `${fmt(valIT + valFin)} MGA`, s: 'stock non-amortissable (CUMP)', c: '#0ea5e9' },
      { lbl: 'VNC Globale Actifs Amortissables',    val: `${fmt(vncGlobale.vnc)} MGA`, s: `sur ${fmt(vncGlobale.brute)} MGA d'acquisition · ${vncGlobale.nb} actif(s)`, c: '#4f46e5' },
      { lbl: 'Taux de rotation du stock',           val: rotation, s: 'sorties valorisées / stock (période)', c: '#f59e0b' },
      { lbl: 'Actifs En service',                   val: etatActifs.enService, s: `${etatActifs.enPret} actuellement en prêt`, c: '#10b981' },
      { lbl: 'Actifs HS / Réformés',                val: etatActifs.horsService + etatActifs.reforme, s: `${etatActifs.horsService} HS · ${etatActifs.reforme} réformé(s)`, c: '#94a3b8' },
      { lbl: 'Prêts en cours',                      val: pretsInfo.enCours, s: `${fmt(pretsInfo.valeurEnCours)} MGA valorisés`, c: '#3b82f6' },
      { lbl: 'Prêts en retard',                     val: pretsInfo.enRetard, s: `${fmt(pretsInfo.valeurEnRetard)} MGA valorisés`, c: pretsInfo.enRetard > 0 ? '#ef4444' : '#22c55e' },
    ]
    return {
      vncGlobale, pretsInfo, rotation, etatActifs, topCats, alertesMaj, serieEvol, kpis,
      // chart-lecteur-repart : totaux MGA → millions, 2 décimales (mirror vanilla)
      repartIT:  Math.round((totIT / 1e6) * 100) / 100,
      repartFin: Math.round((totFin / 1e6) * 100) / 100,
    }
  }, [perm, actifs, prets, produits, mouvements, mouvementsEntrees, valIT, valFin, totIT, totFin])

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {showInfoBanner && (
        <div className="info-banner">
          <i className="ti ti-info-circle" />
          <div>
            Vous consultez en <strong>mode lecture</strong>. Pour demander du matériel,
            utilisez la section <strong>Demandes</strong>.
          </div>
        </div>
      )}

      {lecteur && (
        <>
          <div className="info-banner" style={{ background: 'linear-gradient(135deg,#eef2ff,#f0fdf9)', borderColor: '#c7d2fe', color: '#3730a3', marginBottom: 14 }}>
            <i className="ti ti-chart-infographic" style={{ color: '#4f46e5' }} />
            <div><strong>Vue de pilotage stratégique.</strong> Synthèse consolidée IT + Finance — lecture seule.</div>
          </div>

          {(lecteur.alertesMaj.ruptures > 0 || lecteur.alertesMaj.retard30 > 0) && (
            <div className="info-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626', marginBottom: 14 }}>
              <i className="ti ti-alert-triangle" style={{ color: '#dc2626' }} />
              <div>
                {lecteur.alertesMaj.ruptures > 0 && <><strong>{lecteur.alertesMaj.ruptures}</strong> produit(s) en rupture critique. </>}
                {lecteur.alertesMaj.retard30 > 0 && <><strong>{lecteur.alertesMaj.retard30}</strong> prêt(s) en retard de plus de 30 jours.</>}
              </div>
            </div>
          )}

          <div className="kpi-grid">
            {lecteur.kpis.map((k, i) => (
              <div key={i} className="kpi" style={{ borderLeftColor: k.c }}>
                <div className="kpi-lbl">{k.lbl}</div>
                <div className="kpi-val">{k.val}</div>
                <div className="kpi-s">{k.s || ''}</div>
              </div>
            ))}
          </div>

          <div className="chart-grid">
            <div className="card">
              <div className="card-header"><div className="card-header-title">Évolution de la valeur du stock (12 mois)</div></div>
              <div className="card-body">
                <LineChartCard
                  labels={lecteur.serieEvol.map(s => s.label)}
                  data={lecteur.serieEvol.map(s => Math.round(s.val / 1e3))}
                  color="#4f46e5"
                  tickFormat={v => v + 'K'}
                />
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div className="card-header-title">Répartition IT vs Finance (valeur totale, M MGA)</div></div>
              <div className="card-body">
                <BarChartCard
                  labels={['IT', 'Finance']}
                  datasets={[
                    { label: 'IT',      data: [lecteur.repartIT, 0], color: '#4f46e5' },
                    { label: 'Finance', data: [0, lecteur.repartFin], color: '#10b981' },
                  ]}
                  tickFormat={v => v + 'M'}
                />
              </div>
            </div>
          </div>

          <div className="chart-grid">
            <div className="card">
              <div className="card-header"><div className="card-header-title">Actifs individuels par état</div></div>
              <div className="card-body">
                <DoughnutChartCard
                  labels={['En service', 'En prêt', 'Hors service', 'Réformé', 'Sorti']}
                  data={[lecteur.etatActifs.enService, lecteur.etatActifs.enPret, lecteur.etatActifs.horsService, lecteur.etatActifs.reforme, lecteur.etatActifs.sorti]}
                  colors={['#16a34a', '#1d4ed8', '#f59e0b', '#94a3b8', '#dc2626']}
                />
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <div className="card-header-title"><IconTrophy size={16} style={{ color: '#f59e0b' }} /> Top 5 catégories les plus valorisées</div>
              </div>
              <div className="table-wrap" style={{ boxShadow: 'none', border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr><th>Rang</th><th>Catégorie</th><th>Valeur</th></tr>
                  </thead>
                  <tbody>
                    {lecteur.topCats.length === 0 && (
                      <tr><td colSpan={3} className="empty-state">Aucune donnée</td></tr>
                    )}
                    {lecteur.topCats.map((c, i) => (
                      <tr key={c.cat}>
                        <td style={{ fontWeight: 700, color: 'var(--text3)' }}>#{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{c.cat}</td>
                        <td style={{ fontWeight: 800, color: '#4f46e5' }}>{fmt(c.val)} MGA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="kpi-grid">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {perm.canSeeHist && (
        <div className="dashboard-grid">
          <div className="card span-2">
            <div className="card-header"><div className="card-header-title">Mouvements par jour (période)</div></div>
            <div className="card-body">
              <BarChartCard
                labels={mvtByDay.labels}
                datasets={[
                  { label: 'Entrées', data: mvtByDay.entrees, color: '#10b981' },
                  { label: 'Sorties', data: mvtByDay.sorties, color: '#ef4444' },
                ]}
                showLegend
              />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-header-title">Répartition valeur totale — Stock + Actifs (M MGA)</div></div>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 200, height: 200 }}>
                <DoughnutChartCard
                  labels={pieLabels}
                  data={pieData}
                  colors={pieColors}
                  tooltipLabel={ctx => `${ctx.label}: ${ctx.raw}M MGA`}
                />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <div className="card-header-title"><IconActivity size={16} /> Activités récentes</div>
            </div>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 260 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th><th>Dépt</th><th>Type</th><th>Produit</th>
                    <th>Qté</th><th>Emplacement</th><th>Destination</th><th>Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 && (
                    <tr><td colSpan={8} className="empty-state">Aucun mouvement {hasFilter ? 'sur la période' : ''}</td></tr>
                  )}
                  {recent.map(m => {
                    const { date, time } = fmtDTSplit(m.created_at || m.date)
                    return (
                      <tr key={m.id}>
                        <td className="col-date"><div className="dt-date">{date}</div><div className="dt-time">{time}</div></td>
                        <td><DeptTag dept={m.dept} /></td>
                        <td><TypeBadge type={m.type} /></td>
                        <td className="cell-name">{m.produit_nom}</td>
                        <td style={{ fontWeight: 700 }}>{m.qty}</td>
                        <td className="text-muted">{m.emplacement || '—'}</td>
                        <td className="text-muted">{m.destination || '—'}</td>
                        <td className="text-muted">{m.user_name}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}