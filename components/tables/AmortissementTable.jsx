'use client'
import {
  IconTrendingDown, IconEdit, IconAlertTriangle, IconInfoCircle,
} from '@tabler/icons-react'
import { useDataStore }   from '@/store/dataStore'
import { usePermissions } from '@/hooks/usePermissions'
import { useUiStore }     from '@/store/uiStore'
import { fmt, fmtDate }  from '@/lib/helpers'
import {
  calcVNC, amortPct, amortColor, tauxLineaire, annuiteLineaire,
} from '@/lib/amortissement'
import AmortBar  from '@/components/ui/badges/AmortBar'
import DeptTag   from '@/components/ui/badges/DeptTag'
import Button    from '@/components/ui/Button'

// ── Couleurs de bordure pour les KPI cards ────────────────────
const KPI_COLORS = {
  indigo: 'var(--indigo)',
  green:  'var(--green)',
  amber:  'var(--amber)',
  red:    'var(--red)',
}

function KpiAmort({ label, value, sub, colorKey, icon: Icon }) {
  const borderColor = KPI_COLORS[colorKey] || KPI_COLORS.indigo
  return (
    <div className="kpi" style={{ borderLeft: `3px solid ${borderColor}` }}>
      <div className={`kpi-icon ${colorKey}`}>
        <Icon size={22} />
      </div>
      <div className="kpi-info">
        <div className="kpi-val">{value}</div>
        <div className="kpi-label">{label}{sub ? ` · ${sub}` : ''}</div>
      </div>
    </div>
  )
}

export default function AmortissementTable() {
  const perm       = usePermissions()
  const { openModal } = useUiStore()

  // Produits visibles selon les droits
  const produits = useDataStore(s =>
    s.produits.filter(p =>
      (perm.canSeeIT  && p.dept === 'IT') ||
      (perm.canSeeFin && p.dept === 'Finance')
    )
  )

  // Séparation : avec / sans données d'amortissement
  const avecAmort = produits.filter(
    p => p.valeur_achat > 0 && p.date_achat && p.duree_amortissement
  )
  const sansAmort = produits.filter(
    p => !p.valeur_achat || !p.date_achat || !p.duree_amortissement
  )

  // KPIs agrégés
  const totalAchat  = avecAmort.reduce((s, p) => s + (p.valeur_achat || 0), 0)
  const totalVNC    = avecAmort.reduce(
    (s, p) => s + calcVNC(p.valeur_achat, p.date_achat, p.duree_amortissement),
    0
  )
  const totalAmort  = totalAchat - totalVNC
  const pctGlobal   = totalAchat > 0 ? Math.round((totalAmort / totalAchat) * 100) : 0
  const nbExpires   = avecAmort.filter(
    p => calcVNC(p.valeur_achat, p.date_achat, p.duree_amortissement) === 0
  ).length

  // Tri par valeur d'achat décroissante
  const sorted = [...avecAmort].sort((a, b) => (b.valeur_achat || 0) - (a.valeur_achat || 0))

  // ── Rendu ──────────────────────────────────────────────────
  return (
    <>
      {/* Bannière méthode */}
      <div style={{
        background: '#fffbeb',
        border: '1px solid #fcd34d',
        borderRadius: 'var(--r)',
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12,
        color: '#92400e',
      }}>
        <IconInfoCircle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
        <div>
          <strong>Méthode linéaire :</strong> L&apos;actif perd une valeur égale chaque année.
          Taux annuel = 100 % / Durée en années.
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        <KpiAmort
          label="Valeur Achat Totale"
          value={`${fmt(totalAchat)} MGA`}
          sub={`${avecAmort.length} actif${avecAmort.length > 1 ? 's' : ''}`}
          colorKey="indigo"
          icon={IconTrendingDown}
        />
        <KpiAmort
          label="VNC Actuelle Totale"
          value={`${fmt(totalVNC)} MGA`}
          sub="Valeur nette comptable"
          colorKey="green"
          icon={IconTrendingDown}
        />
        <KpiAmort
          label="Amortissement Cumulé"
          value={`${fmt(totalAmort)} MGA`}
          sub={avecAmort.length > 0 ? `${pctGlobal} % de la valeur initiale` : '—'}
          colorKey="amber"
          icon={IconTrendingDown}
        />
        <KpiAmort
          label="Actifs Totalement Amortis"
          value={nbExpires}
          sub="VNC nulle"
          colorKey="red"
          icon={IconAlertTriangle}
        />
      </div>

      {/* Table principale */}
      {avecAmort.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-header-title">
              <IconTrendingDown size={16} />
              Tableau de bord des amortissements ({avecAmort.length})
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Dépt</th>
                  <th>Actif</th>
                  <th>Catégorie</th>
                  <th>Emplacement</th>
                  <th>Valeur Achat</th>
                  <th>Date Achat</th>
                  <th>Durée · Taux</th>
                  <th>Dotation/an</th>
                  <th>VNC · Avancement</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => {
                  const vnc      = calcVNC(p.valeur_achat, p.date_achat, p.duree_amortissement)
                  const pct      = amortPct(p.valeur_achat, p.date_achat, p.duree_amortissement)
                  const color    = amortColor(pct)
                  const taux     = tauxLineaire(p.duree_amortissement)
                  const annuite  = annuiteLineaire(p.valeur_achat, p.duree_amortissement)
                  const canEdit  = (p.dept === 'IT' && perm.canManIT) ||
                                   (p.dept === 'Finance' && perm.canManFin)

                  return (
                    <tr key={p.id}>
                      <td><DeptTag dept={p.dept} /></td>

                      <td className="cell-name">{p.nom}</td>

                      <td>
                        <span
                          className="badge"
                          style={{ background: 'var(--bg)', color: 'var(--text2)' }}
                        >
                          {p.categorie}
                        </span>
                      </td>

                      <td>
                        {p.emplacement
                          ? <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>
                              {p.emplacement}
                            </span>
                          : <span className="text-muted">—</span>
                        }
                      </td>

                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                        {fmt(p.valeur_achat)} MGA
                      </td>

                      <td className="text-muted">{fmtDate(p.date_achat)}</td>

                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {(p.duree_amortissement / 12).toFixed(1)} a ·{' '}
                        <strong>{taux} %/an</strong>
                      </td>

                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {annuite ? `${fmt(annuite)} MGA/an` : '—'}
                      </td>

                      <td>
                        {vnc === 0 ? (
                          <span
                            className="badge"
                            style={{ background: '#fef2f2', color: '#dc2626' }}
                          >
                            Totalement amorti
                          </span>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 12, color, marginBottom: 3 }}>
                              {fmt(vnc)} MGA
                            </div>
                            <AmortBar pct={pct} />
                          </div>
                        )}
                      </td>

                      <td>
                        {canEdit && (
                          <Button
                            size="icon"
                            variant="outline"
                            title="Modifier les paramètres d'amortissement"
                            onClick={() =>
                              openModal('edit-produit', { dept: p.dept, prod: p })
                            }
                          >
                            <IconEdit size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Produits sans données d'amortissement */}
      {sansAmort.length > 0 && (
        <div
          className="card"
          style={{ borderLeft: '3px solid var(--amber)', marginTop: 16 }}
        >
          <div className="card-header">
            <div className="card-header-title" style={{ color: 'var(--amber)' }}>
              <IconAlertTriangle size={16} />
              {sansAmort.length} actif{sansAmort.length > 1 ? 's' : ''} sans données d&apos;amortissement
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Dépt</th>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sansAmort.slice(0, 5).map(p => {
                  const canEdit =
                    (p.dept === 'IT' && perm.canManIT) ||
                    (p.dept === 'Finance' && perm.canManFin)
                  return (
                    <tr key={p.id}>
                      <td><DeptTag dept={p.dept} /></td>
                      <td style={{ fontWeight: 500 }}>{p.nom}</td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: 'var(--bg)', color: 'var(--text2)' }}
                        >
                          {p.categorie}
                        </span>
                      </td>
                      <td>
                        {canEdit && (
                          <Button
                            size="sm"
                            onClick={() =>
                              openModal('edit-produit', { dept: p.dept, prod: p })
                            }
                          >
                            Configurer
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {sansAmort.length > 5 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-muted"
                      style={{ textAlign: 'center', fontSize: 11 }}
                    >
                      … et {sansAmort.length - 5} autre{sansAmort.length - 5 > 1 ? 's' : ''}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* État vide */}
      {avecAmort.length === 0 && sansAmort.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <IconTrendingDown size={40} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 700 }}>Aucun produit trouvé</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Ajoutez des produits depuis les pages Stock IT ou Stock Finance.
            </p>
          </div>
        </div>
      )}
    </>
  )
}