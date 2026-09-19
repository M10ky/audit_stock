'use client'
import { useState } from 'react'
import {
  IconTrendingDown, IconEdit, IconAlertTriangle, IconInfoCircle,
  IconDownload, IconHistory, IconX,
} from '@tabler/icons-react'
import { useActifsStore } from '@/store/actifsStore'
import { usePermissions } from '@/hooks/usePermissions'
import { useUiStore } from '@/store/uiStore'
import { fmt, fmtDate, fmtMoney, fmtMoneyExact, fmtCompact } from '@/lib/helpers'
import { STATUS_ACTIF, calcVNCActif, amortPctActif } from '@/lib/actifs'
import { tauxLineaire, annuiteLineaire, amortColor } from '@/lib/amortissement'
import { exportToCSV, todayFileDate } from '@/lib/csv'
import AmortBar from '@/components/ui/badges/AmortBar'
import DeptTag from '@/components/ui/badges/DeptTag'
import Button from '@/components/ui/Button'
import BarChartCard from '@/components/charts/BarChartCard'
import DoughnutChartCard from '@/components/charts/DoughnutChartCard'

const KPI_COLORS = { indigo: 'var(--indigo)', green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)' }

function KpiAmort({ label, value, sub, colorKey, icon: Icon, raw }) {
  const borderColor = KPI_COLORS[colorKey] || KPI_COLORS.indigo
  return (
    <div className="kpi kpi-enter" style={{ borderLeft: `3px solid ${borderColor}` }} title={raw != null ? fmtMoneyExact(raw) : undefined}>
      <div className={`kpi-icon ${colorKey}`}><Icon size={22} /></div>
      <div className="kpi-info">
        <div className="kpi-val">{raw != null ? fmtMoney(raw) : value}</div>
        <div className="kpi-label">{label}{sub ? ` · ${sub}` : ''}</div>
      </div>
    </div>
  )
}

export default function AmortissementTable() {
  const perm = usePermissions()
  const { openModal } = useUiStore()

  const [deptFilter, setDeptFilter] = useState('')
  const [anneeFilter, setAnneeFilter] = useState('')

  // Actifs individuels visibles selon les droits — SOURCE UNIQUE de vérité
  // pour l'amortissement (jamais produits.valeur_achat/date_achat/duree_amortissement).
  const actifs = useActifsStore(s =>
    s.actifs.filter(a =>
      (perm.canSeeIT && a.dept === 'IT') || (perm.canSeeFin && a.dept === 'Finance')
    )
  )

  const avecAmort = actifs.filter(a => a.valeur_achat > 0 && a.date_achat && a.duree_amortissement)
  const sansAmort = actifs.filter(a => !(a.valeur_achat > 0 && a.date_achat && a.duree_amortissement))

  const annees = [...new Set(avecAmort.map(a => (a.date_achat || '').slice(0, 4)).filter(Boolean))].sort((a, b) => b - a)

  // Mirrors js/reports.js renderAmortissement() : AUCUNE exclusion par statut
  // ici (les actifs Réformés restent inclus dans les totaux, contrairement à
  // la logique de la page Actifs — deux pages vanilla, deux règles distinctes).
  const filtered = avecAmort.filter(a => {
    if (deptFilter && a.dept !== deptFilter) return false
    if (anneeFilter && (a.date_achat || '').slice(0, 4) !== anneeFilter) return false
    return true
  })

  const totalAchat = filtered.reduce((s, a) => s + (a.valeur_achat || 0), 0)
  const totalVNC   = filtered.reduce((s, a) => s + (calcVNCActif(a) || 0), 0)
  const totalAmort = totalAchat - totalVNC
  const pctGlobal   = totalAchat > 0 ? Math.round((totalAmort / totalAchat) * 100) : 0
  // Strict === 0, mirrors vanilla — un actif avec valeur_residuelle > 0 ne
  // peut jamais atteindre 0 (il plafonne à sa valeur résiduelle), ce qui est
  // le comportement voulu, pas un cas à généraliser en "au plancher".
  const nbExpires = filtered.filter(a => calcVNCActif(a) === 0).length

  const sorted = [...filtered].sort((a, b) => (b.valeur_achat || 0) - (a.valeur_achat || 0))

  // ── Charts (mirrors js/reports.js drawCharts() chart-amort / chart-amort-pie) ──
  // chart-amort : top 8 en valeur d'acquisition, montants en millions (M MGA).
  // chart-amort-pie : répartition sur TOUS les actifs filtrés (pas le top 8).
  const top8     = sorted.slice(0, 8)
  const nbFully   = filtered.filter(a => calcVNCActif(a) === 0).length
  const nbPartial = filtered.filter(a => {
    const pct = amortPctActif(a)
    return pct !== null && pct > 50 && pct < 100
  }).length
  const nbLow     = filtered.filter(a => {
    const pct = amortPctActif(a)
    return pct !== null && pct <= 50
  }).length

  const handleExportCSV = () => {
    const headers = [
      'Département', 'Produit', 'N° CNTO', 'Catégorie', 'Emplacement',
      'Valeur acquisition (MGA)', 'Date acquisition', 'Durée (mois)', 'Taux (%/an)',
      'Dotation annuelle (MGA)', 'VNC (MGA)', '% Amorti', 'Statut amortissement',
    ]
    const rows = sorted.map(a => {
      const vnc  = calcVNCActif(a)
      const pct  = amortPctActif(a)
      const taux = tauxLineaire(a.duree_amortissement)
      const ann  = annuiteLineaire(a.valeur_achat, a.duree_amortissement)
      return [
        a.dept, a.produit_nom || '', a.id, a.categorie || '', a.emplacement || '',
        a.valeur_achat || 0, a.date_achat || '', a.duree_amortissement || '',
        taux ?? '', ann ?? '',
        vnc !== null ? vnc : '',
        pct !== null ? pct + '%' : '',
        pct === 100 ? 'Totalement amorti' : pct !== null && pct > 50 ? 'Partiel (>50%)' : pct !== null ? 'Faible (<50%)' : 'Non configuré',
      ]
    })
    exportToCSV(rows, headers, `amortissement_${todayFileDate()}.csv`)
  }

  const resetFilters = () => { setDeptFilter(''); setAnneeFilter('') }

  return (
    <>
      <div className="info-banner" style={{
        background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 'var(--r)',
        padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 12, color: '#92400e',
      }}>
        <IconInfoCircle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
        <div>
          <strong>Méthode linéaire, par actif individuel :</strong> chaque actif amortit depuis sa
          propre date et sa propre valeur d&apos;achat, jusqu&apos;à sa valeur résiduelle éventuelle.
        </div>
      </div>

      <div className="kpi-grid">
        <KpiAmort label="Valeur Acquisition Totale" value={`${fmt(totalAchat)} MGA`} raw={totalAchat} sub={`${filtered.length} actif(s)`} colorKey="indigo" icon={IconTrendingDown} />
        <KpiAmort label="VNC Actuelle Totale" value={`${fmt(totalVNC)} MGA`} raw={totalVNC} sub="Valeur nette comptable" colorKey="green" icon={IconTrendingDown} />
        <KpiAmort label="Amortissement Cumulé" value={`${fmt(totalAmort)} MGA`} raw={totalAmort} sub={filtered.length > 0 ? `${pctGlobal}% de la valeur initiale` : '—'} colorKey="amber" icon={IconTrendingDown} />
        <KpiAmort label="Actifs Totalement Amortis" value={nbExpires} sub="VNC nulle" colorKey="red" icon={IconAlertTriangle} />
      </div>

      <div className="inline-filter-bar" style={{ marginBottom: 12 }}>
        <div className="ifb-filters">
          <span className="ifb-label">Dépt</span>
          <button type="button" className={`ifb-pill${deptFilter === 'IT' ? ' on-it on' : ''}`} onClick={() => setDeptFilter(deptFilter === 'IT' ? '' : 'IT')}>IT</button>
          <button type="button" className={`ifb-pill${deptFilter === 'Finance' ? ' on-fin on' : ''}`} onClick={() => setDeptFilter(deptFilter === 'Finance' ? '' : 'Finance')}>Finance</button>
        </div>
        <div className="ifb-sep" />
        <div className="ifb-filters">
          <span className="ifb-label">Année d&apos;acquisition</span>
          <select className="form-select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }} value={anneeFilter} onChange={e => setAnneeFilter(e.target.value)}>
            <option value="">Toutes années</option>
            {annees.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {(deptFilter || anneeFilter) && (
          <button type="button" className="ifb-reset" onClick={resetFilters}>
            <IconX size={11} /> Réinitialiser
          </button>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <Button variant="outline" icon={IconDownload} onClick={handleExportCSV}>CSV Amortissement</Button>
      </div>

      {sorted.length > 0 ? (
        <>
        <div className="chart-grid">
          <div className="card">
            <div className="card-header"><div className="card-header-title">VNC vs Valeur initiale — Top 8 actifs</div></div>
            <div className="card-body">
              <BarChartCard
                labels={top8.map(a => (a.produit_nom || a.id).slice(0, 14))}
                datasets={[
                  { label: 'Valeur acquisition', data: top8.map(a => Math.round(((a.valeur_achat || 0) / 1e6) * 100) / 100), color: '#e0e7ff' },
                  { label: 'VNC', data: top8.map(a => Math.round(((calcVNCActif(a) || 0) / 1e6) * 100) / 100), color: '#4f46e5' },
                ]}
                showLegend
                tickFormat={v => v + 'M'}
              />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-header-title">Répartition par statut d&apos;amortissement</div></div>
            <div className="card-body">
              <DoughnutChartCard
                labels={['Faible <50%', 'Partiel 50–99%', 'Totalement amorti']}
                data={[nbLow, nbPartial, nbFully]}
                colors={['#10b981', '#f59e0b', '#ef4444']}
              />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-header-title">
              <IconTrendingDown size={16} /> Registre d&apos;amortissement — {sorted.length} actif{sorted.length > 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Dépt</th><th>Actif</th><th>Catégorie</th><th>Emplacement</th>
                  <th>Valeur Acquisition</th><th>Date Acquisition</th><th>Durée · Taux</th>
                  <th>Dotation/an</th><th>VNC · Avanc.</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(a => {
                  const vnc     = calcVNCActif(a)
                  const pct     = amortPctActif(a) ?? 0
                  const color   = amortColor(pct)
                  const taux    = tauxLineaire(a.duree_amortissement)
                  const annuite = annuiteLineaire(a.valeur_achat, a.duree_amortissement)

                  return (
                    <tr key={a.id}>
                      <td><DeptTag dept={a.dept} /></td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.produit_nom || '—'}</div>
                        <code className="cell-mono" style={{ fontSize: 11, marginTop: 2, display: 'inline-block' }}>{a.id}</code>
                      </td>
                      <td><span className="badge" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>{a.categorie}</span></td>
                      <td>{a.emplacement
                        ? <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>{a.emplacement}</span>
                        : <span className="text-muted">—</span>}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }} title={`${fmt(a.valeur_achat)} MGA`}>{fmtMoney(a.valeur_achat)}</td>
                      <td className="text-muted">{fmtDate(a.date_achat)}</td>
                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {(a.duree_amortissement / 12).toFixed(1)} a · <strong>{taux}%/an</strong>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>{annuite ? `${fmtCompact(annuite)} MGA/an` : '—'}</td>
                      <td>
                        {vnc === 0 ? (
                          <span className="badge" style={{ background: '#fef2f2', color: '#dc2626' }}>Totalement amorti</span>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 12, color, marginBottom: 3 }} title={`${fmt(vnc)} MGA`}>{fmtMoney(vnc)}</div>
                            <AmortBar pct={pct} />
                          </div>
                        )}
                      </td>
                      <td>
                        {perm.isLecteur ? (
                          <Button size="icon" variant="outline" title="Historique" onClick={() => openModal('actif-historique', { actif: a })}>
                            <IconHistory size={14} />
                          </Button>
                        ) : (
                          <Button size="icon" variant="outline" title="Modifier les paramètres d'amortissement" onClick={() => openModal('edit-actif', { actif: a })}>
                            <IconEdit size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ background: 'var(--bg)', fontWeight: 800 }}>
                  <td colSpan={4} style={{ textAlign: 'right' }}>TOTAUX</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{fmt(totalAchat)} MGA</td>
                  <td></td><td></td>
                  <td style={{ fontSize: 11 }}>{fmt(totalAmort)} MGA amorti</td>
                  <td>{fmt(totalVNC)} MGA</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        </>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div style={{ fontSize: 40, marginBottom: 10 }}>📉</div>
            <p style={{ fontWeight: 700, color: 'var(--text)' }}>Aucun actif amortissable ne correspond aux filtres</p>
          </div>
        </div>
      )}

      {sansAmort.length > 0 && (
        <div className="card" style={{ borderLeft: '3px solid var(--amber)', marginTop: 16 }}>
          <div className="card-header">
            <div className="card-header-title" style={{ color: 'var(--amber)' }}>
              <IconAlertTriangle size={16} />
              {sansAmort.length} actif{sansAmort.length > 1 ? 's' : ''} sans données d&apos;amortissement exploitables
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Dépt</th><th>Actif</th><th>Catégorie</th><th>Action</th></tr></thead>
              <tbody>
                {sansAmort.slice(0, 5).map(a => (
                  <tr key={a.id}>
                    <td><DeptTag dept={a.dept} /></td>
                    <td style={{ fontWeight: 500 }}>
                      {a.produit_nom || '—'} <code className="cell-mono" style={{ fontSize: 11 }}>{a.id}</code>
                    </td>
                    <td><span className="badge" style={{ background: 'var(--bg)', color: 'var(--text2)' }}>{a.categorie}</span></td>
                    <td>
                      {perm.isLecteur ? (
                        <span className="text-muted" style={{ fontSize: 11 }}>—</span>
                      ) : (
                        <Button size="sm" onClick={() => openModal('edit-actif', { actif: a })}>Configurer</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {sansAmort.length > 5 && (
                  <tr>
                    <td colSpan={4} className="text-muted" style={{ textAlign: 'center', fontSize: 11 }}>
                      … et {sansAmort.length - 5} autre{sansAmort.length - 5 > 1 ? 's' : ''}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {actifs.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <IconTrendingDown size={40} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 700 }}>Aucun actif individuel enregistré</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Activez « Suivi individuel amortissable » sur un produit, puis enregistrez une entrée de stock
              — les actifs et leur amortissement apparaîtront ici automatiquement.
            </p>
          </div>
        </div>
      )}
    </>
  )
}