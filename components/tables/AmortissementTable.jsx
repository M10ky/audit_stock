'use client'
import {
  IconTrendingDown, IconEdit, IconAlertTriangle, IconInfoCircle,
} from '@tabler/icons-react'
import { useActifsStore } from '@/store/actifsStore'
import { usePermissions } from '@/hooks/usePermissions'
import { useUiStore } from '@/store/uiStore'
import { fmt, fmtDate } from '@/lib/helpers'
import {
  STATUS_ACTIF, calcVNCActif, amortPctActif,
} from '@/lib/actifs'
import { tauxLineaire, annuiteLineaire, amortColor } from '@/lib/amortissement'
import AmortBar  from '@/components/ui/badges/AmortBar'
import DeptTag   from '@/components/ui/badges/DeptTag'
import ActifStatutBadge from '@/components/ui/badges/ActifStatutBadge'
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

  // Actifs individuels visibles selon les droits — SOURCE UNIQUE de vérité
  // pour l'amortissement. On ne lit plus jamais produits.valeur_achat /
  // date_achat / duree_amortissement (champs catalogue, quasi jamais
  // renseignés depuis l'introduction du suivi individuel — cf. Étape 0,
  // point 1.2).
  const actifs = useActifsStore(s =>
    s.actifs.filter(a =>
      (perm.canSeeIT  && a.dept === 'IT') ||
      (perm.canSeeFin && a.dept === 'Finance')
    )
  )

  // Un actif est "amortissable exploitable" s'il porte les 3 champs requis.
  // valeur_achat peut être à 0 si l'entrée d'origine n'avait pas de prix
  // saisi (cas limite défensif, cf. createActifUnits) — on le classe alors
  // en "sans données" plutôt que d'afficher une VNC à 0 trompeuse.
  const avecAmort = actifs.filter(
    a => a.valeur_achat > 0 && a.date_achat && a.duree_amortissement
  )
  const sansAmort = actifs.filter(
    a => !(a.valeur_achat > 0 && a.date_achat && a.duree_amortissement)
  )

  // Les actifs Réformés sont exclus des totaux "patrimoine actif" (ils sont
  // sortis pour de bon) mais restent visibles dans le tableau détaillé pour
  // la traçabilité — même logique que ActifsTable.jsx.
  const actifsValorises = avecAmort.filter(a => a.statut !== STATUS_ACTIF.REFORME)

  const totalAchat = actifsValorises.reduce((s, a) => s + (a.valeur_achat || 0), 0)
  const totalVNC   = actifsValorises.reduce((s, a) => s + (calcVNCActif(a) || 0), 0)
  const totalAmort = totalAchat - totalVNC
  const pctGlobal  = totalAchat > 0 ? Math.round((totalAmort / totalAchat) * 100) : 0
  const nbExpires  = actifsValorises.filter(a => calcVNCActif(a) === 0).length

  // Tri par valeur d'achat décroissante — tous statuts confondus (y compris
  // Réformé) pour que le tableau reste un registre complet.
  const sorted = [...avecAmort].sort((a, b) => (b.valeur_achat || 0) - (a.valeur_achat || 0))

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
          <strong>Méthode linéaire, par actif individuel :</strong> chaque actif amortit depuis sa
          propre date et sa propre valeur d&apos;achat, jusqu&apos;à sa valeur résiduelle éventuelle.
          Les actifs réformés sont exclus des totaux ci-dessous.
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        <KpiAmort
          label="Valeur Achat Totale"
          value={`${fmt(totalAchat)} MGA`}
          sub={`${actifsValorises.length} actif${actifsValorises.length > 1 ? 's' : ''} actif${actifsValorises.length > 1 ? 's' : ''}`}
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
          sub={actifsValorises.length > 0 ? `${pctGlobal} % de la valeur initiale` : '—'}
          colorKey="amber"
          icon={IconTrendingDown}
        />
        <KpiAmort
          label="Actifs Totalement Amortis"
          value={nbExpires}
          sub="VNC au plancher (résiduelle ou 0)"
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
              Registre d&apos;amortissement — {avecAmort.length} actif{avecAmort.length > 1 ? 's' : ''}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Dépt</th>
                  <th>Actif</th>
                  <th>Numéro de série</th>
                  <th>Catégorie</th>
                  <th>Valeur Achat</th>
                  <th>Date Achat</th>
                  <th>Durée · Taux</th>
                  <th>Dotation/an</th>
                  <th>VNC · Avancement</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(a => {
                  const vnc      = calcVNCActif(a)
                  const pct      = amortPctActif(a) ?? 0
                  const color    = amortColor(pct)
                  const taux     = tauxLineaire(a.duree_amortissement)
                  const annuite  = annuiteLineaire(a.valeur_achat, a.duree_amortissement)
                  const canEdit  = (a.dept === 'IT' && perm.canManIT) ||
                                   (a.dept === 'Finance' && perm.canManFin)
                  const estReforme = a.statut === STATUS_ACTIF.REFORME

                  return (
                    <tr key={a.id} className={estReforme ? 'alerte-row' : ''}>
                      <td><DeptTag dept={a.dept} /></td>

                      <td className="cell-name">{a.produit_nom}</td>

                      <td className="cell-mono" style={{ fontSize: 11 }}>{a.id}</td>

                      <td>
                        <span
                          className="badge"
                          style={{ background: 'var(--bg)', color: 'var(--text2)' }}
                        >
                          {a.categorie}
                        </span>
                      </td>

                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                        {fmt(a.valeur_achat)} MGA
                      </td>

                      <td className="text-muted">{fmtDate(a.date_achat)}</td>

                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {(a.duree_amortissement / 12).toFixed(1)} a ·{' '}
                        <strong>{taux} %/an</strong>
                      </td>

                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {annuite ? `${fmt(annuite)} MGA/an` : '—'}
                      </td>

                      <td>
                        {estReforme ? (
                          <span className="text-muted" style={{ fontSize: 11 }}>Exclu (réformé)</span>
                        ) : vnc === (a.valeur_residuelle || 0) && pct >= 100 ? (
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

                      <td><ActifStatutBadge statut={a.statut} /></td>

                      <td>
                        {canEdit && (
                          <Button
                            size="icon"
                            variant="outline"
                            title="Modifier les paramètres d'amortissement"
                            onClick={() => openModal('edit-actif', { actif: a })}
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

      {/* Actifs sans données d'amortissement exploitables */}
      {sansAmort.length > 0 && (
        <div
          className="card"
          style={{ borderLeft: '3px solid var(--amber)', marginTop: 16 }}
        >
          <div className="card-header">
            <div className="card-header-title" style={{ color: 'var(--amber)' }}>
              <IconAlertTriangle size={16} />
              {sansAmort.length} actif{sansAmort.length > 1 ? 's' : ''} sans données d&apos;amortissement exploitables
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Dépt</th>
                  <th>Actif</th>
                  <th>Numéro de série</th>
                  <th>Catégorie</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sansAmort.slice(0, 5).map(a => {
                  const canEdit =
                    (a.dept === 'IT' && perm.canManIT) ||
                    (a.dept === 'Finance' && perm.canManFin)
                  return (
                    <tr key={a.id}>
                      <td><DeptTag dept={a.dept} /></td>
                      <td style={{ fontWeight: 500 }}>{a.produit_nom}</td>
                      <td className="cell-mono" style={{ fontSize: 11 }}>{a.id}</td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: 'var(--bg)', color: 'var(--text2)' }}
                        >
                          {a.categorie}
                        </span>
                      </td>
                      <td>
                        {canEdit && (
                          <Button
                            size="sm"
                            onClick={() => openModal('edit-actif', { actif: a })}
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
                      colSpan={5}
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