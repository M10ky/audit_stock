'use client'
import { useMemo } from 'react'
import {
  IconCash, IconPackage, IconAlertTriangle, IconClipboardList,
  IconTrendingUp, IconTrendingDown, IconTags, IconChartBar,
} from '@tabler/icons-react'
import { useDataStore } from '@/store/dataStore'
import { useActifsStore } from '@/store/actifsStore'
import { usePermissions } from '@/hooks/usePermissions'
import { useDateFilter } from '@/hooks/useDateFilter'
import { fmt, fmtDTSplit, fmtMoney, fmtMoneyExact, getValeurStockActuel } from '@/lib/helpers'
import {
  getProduitsVisibles, tauxValidationGlobal, topProduitsDistribues,
  topProduitsCouteux, repartitionActifsStatut, evolutionValeurStock,
  produitsSansMouvement90j, coutMoyenSorties, valeurMoyenneParCategorie,
} from '@/lib/reports'
import KpiCard from '@/components/ui/KpiCard'
import DeptTag from '@/components/ui/badges/DeptTag'
import TypeBadge from '@/components/ui/badges/TypeBadge'
import BarChartCard from '@/components/charts/BarChartCard'
import LineChartCard from '@/components/charts/LineChartCard'
import DoughnutChartCard from '@/components/charts/DoughnutChartCard'

export default function RapportsPage() {
  const perm = usePermissions()
  const { filterByDate } = useDateFilter()

  const produits          = useDataStore(s => s.produits)
  const mouvements        = useDataStore(s => s.mouvements)
  const demandes          = useDataStore(s => s.demandes)
  const mouvementsEntrees = useDataStore(s => s.mouvementsEntrees)
  const actifs            = useActifsStore(s => s.actifs)

  const prodsVisibles = getProduitsVisibles(produits, perm)

  const vIT = produits.filter(p => p.dept === 'IT')
    .reduce((s, p) => s + getValeurStockActuel(p, mouvementsEntrees), 0)
  const vFin = produits.filter(p => p.dept === 'Finance')
    .reduce((s, p) => s + getValeurStockActuel(p, mouvementsEntrees), 0)

  // ── Période sélectionnée (Topbar) ──────────────────────────────
  const mvtPeriode = mouvements.filter(m => filterByDate(m.created_at || m.date))
  const entreesP    = mvtPeriode.filter(m => m.type === 'Entrée')
  const sortiesP    = mvtPeriode.filter(m => m.type === 'Sortie')
  const valEntreesP = entreesP.reduce((s, m) => s + (m.valeur || 0), 0)
  const valSortiesP = sortiesP.reduce((s, m) => s + (m.valeur || 0), 0)

  const demVisibles = demandes.filter(d => filterByDate(d.created_at || d.date))
  const tauxValid   = tauxValidationGlobal(demVisibles)
  const nbAttente   = demVisibles.filter(d => d.statut === 'En attente').length

  const nbProduits  = prodsVisibles.length
  const nbUnites    = prodsVisibles.reduce((s, p) => s + (p.stock || 0), 0)
  const nbCritiques = prodsVisibles.filter(p => p.actif !== false && (p.stock === 0 || p.stock <= p.seuil)).length
  const nbAmort     = prodsVisibles.filter(p => p.is_amortissable).length

  const kpis = [
    { icon: IconCash,          color: 'indigo', value: fmtMoneyExact(vIT),          raw: vIT, label: 'Valeur Stock IT',           sub: 'Non-amortissables (CUMP)' },
    { icon: IconCash,          color: 'green',  value: fmtMoneyExact(vFin),         raw: vFin, label: 'Valeur Stock Finance',      sub: 'Non-amortissables (CUMP)' },
    { icon: IconPackage,       color: 'purple', value: nbProduits,                 label: 'Produits (total)',          sub: `${nbAmort} amortissable(s)` },
    { icon: IconPackage,       color: 'teal',   value: fmt(nbUnites),              label: 'Unités en stock',           sub: 'toutes références' },
    { icon: IconTrendingUp,    color: 'indigo', value: mvtPeriode.length,          label: 'Mouvements (période)',      sub: `${entreesP.length} entrée(s) · ${sortiesP.length} sortie(s)` },
    { icon: IconTrendingUp,    color: 'green',  value: fmtMoneyExact(valEntreesP), raw: valEntreesP, label: 'Valeur Entrées (période)',  sub: "coût d'acquisition" },
    { icon: IconTrendingDown,  color: 'red',    value: fmtMoneyExact(valSortiesP), raw: valSortiesP, label: 'Valeur Sorties (période)',  sub: 'valorisées au CUMP' },
    { icon: IconAlertTriangle, color: 'red',    value: nbCritiques,                label: 'Produits critiques',        sub: 'sous seuil ou rupture' },
    { icon: IconTags,          color: 'purple', value: nbAmort,                    label: 'Produits amortissables',    sub: 'suivi individuel actif' },
    { icon: IconClipboardList, color: 'amber',  value: nbAttente,                  label: 'Demandes en attente',       sub: 'à traiter' },
    { icon: IconChartBar,      color: 'amber',  value: `${tauxValid}%`,            label: 'Taux de validation',        sub: 'Validé / (Validé+Refusé)' },
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

  // ── Données charts ──────────────────────────────────────────────
  const catData = valMoyCat.slice(0, 8)

  const monthlyEvol = useMemo(() => {
    const today = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) months.push(new Date(today.getFullYear(), today.getMonth() - i, 1))
    const labels = months.map(d => d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }))
    const countFor = (type, mDate, next) =>
      mouvements
        .filter(m => m.type === type && new Date(m.created_at || m.date) >= mDate && new Date(m.created_at || m.date) < next)
        .reduce((s, m) => s + m.qty, 0)
    const entrees = months.map((mDate, i) => countFor('Entrée', mDate, i < 5 ? months[i + 1] : new Date(mDate.getFullYear(), mDate.getMonth() + 1, 1)))
    const sorties = months.map((mDate, i) => countFor('Sortie', mDate, i < 5 ? months[i + 1] : new Date(mDate.getFullYear(), mDate.getMonth() + 1, 1)))
    return { labels, entrees, sorties }
  }, [mouvements])

  const topDistrib = topProduitsDistribues(sortiesP, 10)
  const topCouteux = topProduitsCouteux(produits, actifs, mouvementsEntrees, perm, 10)
  const repActifs  = repartitionActifsStatut(actifs, perm)
  const evolStock  = evolutionValeurStock(produits, mouvements, perm, 6)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rapports & Statistiques</h1>
          <p className="page-subtitle">Tableau de bord décisionnel — période sélectionnée</p>
        </div>
      </div>

      <div className="kpi-grid">
        {kpis.map((k, i) => <KpiCard key={i} index={i} {...k} />)}
      </div>

      <div className="chart-grid">
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
      </div>

      <div className="chart-grid">
        <div className="card">
          <div className="card-header"><div className="card-header-title">Top 10 produits les plus distribués (période)</div></div>
          <div className="card-body">
            <BarChartCard
              labels={topDistrib.map(p => p.nom.slice(0, 16))}
              datasets={[{ data: topDistrib.map(p => p.qty), color: '#f59e0b' }]}
              indexAxis="y"
            />
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-header-title">Top 10 produits les plus coûteux</div></div>
          <div className="card-body">
            <BarChartCard
              labels={topCouteux.map(p => p.nom.slice(0, 16))}
              datasets={[{ data: topCouteux.map(p => Math.round(p.valeur / 1000)), color: topCouteux.map(p => p.amort ? '#7c3aed' : '#4f46e5') }]}
              indexAxis="y"
              tickFormat={v => v + 'K'}
            />
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="card">
          <div className="card-header"><div className="card-header-title">Actifs amortissables par statut</div></div>
          <div className="card-body">
            <DoughnutChartCard
              labels={repActifs.map(r => r.statut)}
              data={repActifs.map(r => r.n)}
              colors={['#16a34a', '#1d4ed8', '#f59e0b', '#dc2626', '#94a3b8']}
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

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-icon indigo"><IconTrendingDown size={20} /></div>
          <div className="kpi-info">
            <div className="kpi-val">{fmtCompact(Math.round(coutMoySortie))} MGA</div>
            <div className="kpi-label">Coût moyen des sorties</div>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-icon teal"><IconPackage size={20} /></div>
          <div className="kpi-info">
            <div className="kpi-val">{nbActifsProd} / {nbInactifsProd}</div>
            <div className="kpi-label">Produits actifs / inactifs</div>
          </div>
        </div>
        <div className="kpi">
          <div className={`kpi-icon ${sansMvt.length ? 'amber' : 'green'}`}><IconAlertTriangle size={20} /></div>
          <div className="kpi-info">
            <div className="kpi-val">{sansMvt.length}</div>
            <div className="kpi-label">Produits sans mouvement &gt;90j</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header"><div className="card-header-title">Valeur moyenne par catégorie</div></div>
          <div className="table-wrap" style={{ boxShadow: 'none', border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead><tr><th>Catégorie</th><th>Nb produits</th><th>Valeur totale</th><th>Valeur moyenne</th></tr></thead>
              <tbody>
                {valMoyCat.length === 0 && (
                  <tr><td colSpan={4} className="empty-state">Aucune donnée</td></tr>
                )}
                {valMoyCat.slice(0, 8).map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{c.cat}</td>
                    <td className="text-muted">{c.n}</td>
                    <td style={{ fontWeight: 700 }} title={`${fmt(c.total)} MGA`}>{fmtMoney(c.total)}</td>
                    <td title={`${fmt(Math.round(c.moyenne))} MGA`}>{fmtMoney(Math.round(c.moyenne))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-header-title">Produits sans mouvement &gt;90j</div></div>
          <div className="table-wrap" style={{ boxShadow: 'none', border: 'none', borderRadius: 0 }}>
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
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-header-title">Dernières entrées / sorties (période)</div></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Date & Heure</th><th>Dépt</th><th>Type</th><th>Produit</th><th>Qté</th><th>Valeur</th></tr></thead>
            <tbody>
              {dernieres.length === 0 && (
                <tr><td colSpan={6} className="empty-state">Aucun mouvement sur la période</td></tr>
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
                    <td style={{ fontWeight: 700 }} title={`${fmt(m.valeur)} MGA`}>{fmtMoney(m.valeur)}</td>
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