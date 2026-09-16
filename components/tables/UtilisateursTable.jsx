'use client'
import { useEffect, useMemo } from 'react'
import { IconUsers, IconShieldCheck, IconDownload, IconTrash, IconMail } from '@tabler/icons-react'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { useInlineFilter } from '@/hooks/useInlineFilter'
import { createClient } from '@/lib/supabase/client'
import { fmtDT } from '@/lib/helpers'
import { exportToCSV, todayFileDate } from '@/lib/csv'
import { getPermissions } from '@/lib/permissions'
import Button from '@/components/ui/Button'
import InlineSearchBar from '@/components/search/InlineSearchBar'

// Colonnes de la matrice — un rôle par colonne, calculé via getPermissions()
// plutôt que recopié à la main : tout futur changement de RBAC (lib/permissions.js)
// se répercute ici automatiquement, ce qui aurait évité le bug canDemIT/canDemFin
// corrigé en Étape D si cette matrice avait existé à l'époque.
const ROLE_DEFS = [
  { role: 'Administrateur',      dept: 'both',    label: 'Admin',         color: '#6d28d9' },
  { role: 'Support IT',          dept: 'IT',      label: 'Support IT',    color: '#3730a3' },
  { role: 'Responsable Finance', dept: 'Finance', label: 'Resp. Finance', color: '#065f46' },
  { role: 'Utilisateur IT',      dept: 'IT',      label: 'Util. IT',      color: '#1e40af' },
  { role: 'Utilisateur Finance', dept: 'Finance', label: 'Util. Finance', color: '#064e3b' },
  { role: 'Lecteur',             dept: 'both',    label: 'Lecteur',       color: '#7c3aed' },
]

const FEATURES = [
  { label: 'Inventaire IT',              key: 'canSeeIT' },
  { label: 'Inventaire Finance',         key: 'canSeeFin' },
  { label: 'Mouvements IT',              key: 'canManIT' },
  { label: 'Mouvements Finance',         key: 'canManFin' },
  { label: 'Demandes IT (créer)',        key: 'canDemIT' },
  { label: 'Demandes Finance (créer)',   key: 'canDemFin' },
  { label: 'Valider demandes IT',        key: 'canValidIT' },
  { label: 'Valider demandes Finance',   key: 'canValidFin' },
  { label: 'Actifs individuels IT',      key: 'canSeeActifsIT' },
  { label: 'Actifs individuels Finance', key: 'canSeeActifsFin' },
  { label: 'Prêts IT',                   key: 'canSeePretsIT' },
  { label: 'Prêts Finance',              key: 'canSeePretsFin' },
  { label: 'Historique & Rapports',      key: 'canSeeHist' },
  { label: 'Voir prix / valeurs',        key: 'canSeePrix' },
  { label: 'Gestion utilisateurs',       key: 'canManUsers' },
  { label: 'Paramètres système',         key: 'canManParams' },
]

const ROLES_OPTIONS = ROLE_DEFS.map(r => r.role)
const DEPT_OPTIONS = [
  { value: 'IT', label: 'IT' },
  { value: 'Finance', label: 'Finance' },
  { value: 'both', label: 'IT + Finance' },
]

export default function UtilisateursTable() {
  const supabase = createClient()
  const user             = useAuthStore(s => s.user)
  const allProfiles       = useAuthStore(s => s.allProfiles)
  const loadAllProfiles   = useAuthStore(s => s.loadAllProfiles)
  const toggleUserActive  = useAuthStore(s => s.toggleUserActive)
  const updateUserRole    = useAuthStore(s => s.updateUserRole)
  const { showToast, openConfirm } = useUiStore()

  useEffect(() => { loadAllProfiles(supabase) }, []) // eslint-disable-line

  // Mirrors js/settings.js renderUtilisateurs() : recherche inline (query, rôle,
  // statut) sur la même liste de profils — clé 'utilisateur' de useInlineFilter.
  const { filterState, setFilterState, applyFilters } = useInlineFilter('users')
  const filtered = applyFilters(allProfiles, 'utilisateur')

  // ── KPIs (miroir js/settings.js renderUtilisateurs) ──────────
  // Total (avec répartition actifs/inactifs), Actifs, Inactifs, puis un KPI par
  // rôle peuplé — raccourcis « Resp. » / « Util. » comme dans le Vanilla.
  const total    = allProfiles.length
  const actifs   = allProfiles.filter(u => u.is_active).length
  const inactifs = total - actifs
  const kpis = [
    { lbl: 'Total comptes', val: total,    s: `${actifs} actif(s) · ${inactifs} inactif(s)`, c: '#4f46e5' },
    { lbl: 'Actifs',        val: actifs,   s: 'comptes actifs',     c: '#10b981' },
    { lbl: 'Inactifs',      val: inactifs, s: 'comptes désactivés', c: '#94a3b8' },
    ...ROLE_DEFS
      .map(r => ({ r, n: allProfiles.filter(u => u.role === r.role).length }))
      .filter(({ n }) => n > 0)
      .map(({ r, n }) => ({ lbl: r.label, val: n, s: 'utilisateur(s)', c: r.color })),
  ].slice(0, 8)

  const matrixRows = useMemo(() => FEATURES.map(f => ({
    label: f.label,
    values: ROLE_DEFS.map(rd => getPermissions({ role: rd.role, dept: rd.dept })[f.key]),
  })), [])

  // Auto-protection : on ne permet jamais à un admin de modifier son propre
  // rôle/département/statut depuis ce tableau — un mauvais clic sur sa
  // propre ligne pourrait le verrouiller hors de la page qui permet de
  // se corriger. La seule voie de sortie reste Supabase directement.
  const handleRoleChange = async (p, newRole) => {
    if (newRole === p.role) return
    // Mirrors js/settings.js changeUserRole() : confirmation avant tout
    // changement de rôle — en cas d'annulation, le sélecteur contrôlé ne bouge
    // pas (on ne met à jour le store qu'après confirmation).
    openConfirm({
      title: `Changer le rôle de « ${p.name} » ?`,
      message: `${p.role} → ${newRole}. Ce changement prend effet immédiatement à la prochaine connexion de l'utilisateur.`,
      onConfirm: async () => {
        const { error } = await updateUserRole(supabase, p.id, { role: newRole })
        if (error) return showToast('Erreur : ' + error.message, 'error')
        showToast(`Rôle de « ${p.name} » → ${newRole}`)
      },
    })
  }

  const handleDeptChange = async (p, newDept) => {
    if (newDept === p.dept) return
    const { error } = await updateUserRole(supabase, p.id, { dept: newDept })
    if (error) return showToast('Erreur : ' + error.message, 'error')
    showToast(`Département de ${p.name} mis à jour → ${newDept}`)
  }

  const handleToggleActive = async (p) => {
    const { error } = await toggleUserActive(supabase, p.id, !p.is_active)
    if (error) return showToast('Erreur : ' + error.message, 'error')
    showToast(p.is_active ? `${p.name} désactivé` : `${p.name} activé`)
  }

  // Mirrors js/settings.js resetUserPassword() : envoi d'un e-mail de
  // récupération via le Route Handler /api/users/reset-password (jamais
  // d'écriture directe d'un mot de passe provisoire côté client).
  const handleResetPassword = (p) => {
    if (!p.email) return
    openConfirm({
      title: `Réinitialiser le mot de passe de ${p.email} ?`,
      message: "Un e-mail avec un lien de réinitialisation sera envoyé. L'utilisateur devra cliquer sur le lien pour définir un nouveau mot de passe.",
      onConfirm: async () => {
        const res = await fetch('/api/users/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: p.email, redirectTo: window.location.origin }),
        })
        const data = await res.json()
        if (!res.ok || data?.error) return showToast('Erreur: ' + (data?.error || 'échec envoi'), 'error')
        showToast(`Lien de réinitialisation envoyé à ${p.email}`)
      },
    })
  }

  // Mirrors js/settings.js deleteUserProfile() (garde « compte actuel » incluse)
  // — suppression via Route Handler service_role : profil + compte Supabase Auth
  // (le Vanilla exigeait de supprimer l'auth séparément dans le dashboard).
  const handleDelete = (p) => {
    if (p.id === user?.id) return showToast('Impossible de supprimer votre propre compte', 'error')
    openConfirm({
      title: `Supprimer le profil de « ${p.name} » ?`,
      message: 'Le profil sera retiré de l’application et le compte Supabase Auth supprimé. Cette action est irréversible.',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/users/${p.id}`, { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok || data?.error) return showToast('Erreur: ' + (data?.error || 'échec suppression'), 'error')
        showToast(`Profil de « ${p.name} » supprimé`)
        await loadAllProfiles(supabase)
      },
    })
  }

  // Règle métier (js/export.js exportUtilisateursCSV) : export sans filtre de
  // la liste complète des profils ; ouverture réservée à l'administrateur
  // (gating page canManUsers). Département 'both' → « IT + Finance » ;
  // is_active traduit en Actif/Inactif.
  const handleExport = () => {
    const headers = ['Nom', 'Email', 'Rôle', 'Département', 'Statut', 'Créé le']
    const rows = allProfiles.map(u => [
      u.name,
      u.email || '',
      u.role,
      u.dept === 'both' ? 'IT + Finance' : u.dept,
      u.is_active ? 'Actif' : 'Inactif',
      fmtDT(u.created_at),
    ])
    exportToCSV(rows, headers, `utilisateurs_${todayFileDate()}.csv`)
  }

  return (
    <>
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div key={i} className="kpi" style={{ borderLeftColor: k.c }}>
            <div className="kpi-lbl">{k.lbl}</div>
            <div className="kpi-val">{k.val}</div>
            <div className="kpi-s">{k.s}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12, background: 'var(--indigo-l)', borderColor: '#c7d2fe' }}>
        <div style={{ padding: '13px 16px', fontSize: 12, color: 'var(--indigo)' }}>
          <IconShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Pour créer un utilisateur : <strong>Supabase → Authentication → Users → Invite User</strong>,
          puis insérer le profil correspondant dans <code>profiles</code> avec le même UUID.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <div className="card-header-title"><IconShieldCheck size={16} /> Matrice des droits par rôle</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Fonctionnalité</th>
                {ROLE_DEFS.map(rd => (
                  <th key={rd.role} style={{ color: rd.color, textAlign: 'center' }}>{rd.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500, fontSize: 12 }}>{row.label}</td>
                  {row.values.map((v, j) => (
                    <td key={j} style={{ textAlign: 'center', fontSize: 13 }}>{v ? '✅' : '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <InlineSearchBar
          state={filterState}
          onChange={setFilterState}
          options={{
            showUserStat: true,
            showRoles: true,
            roles: ROLE_DEFS.map(r => ({ label: r.label, value: r.role, color: r.color })),
          }}
          count={allProfiles.length}
          filteredCount={filtered.length}
          placeholder="Rechercher par nom, email, rôle, département…"
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-header-title">
            <IconUsers size={16} /> Annuaire des comptes — {filtered.length} / {allProfiles.length}
          </div>
          <Button variant="outline" icon={IconDownload} onClick={handleExport}>CSV</Button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Utilisateur</th><th>Rôle</th><th>Département</th><th>Statut</th><th>Créé le</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state"><p>Aucun utilisateur trouvé — réinitialisez les filtres</p></div></td></tr>
              )}
              {filtered.map(p => {
                const isSelf = p.id === user?.id
                return (
                  <tr key={p.id} className={!p.is_active ? 'row-inactif' : undefined}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', background: p.color || 'var(--teal)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          {(p.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12.5 }}>{p.name}{isSelf ? ' (vous)' : ''}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{p.email || p.id.slice(0, 12) + '…'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="form-select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                        value={p.role} disabled={isSelf}
                        onChange={e => handleRoleChange(p, e.target.value)}
                      >
                        {ROLES_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                        value={p.dept} disabled={isSelf}
                        onChange={e => handleDeptChange(p, e.target.value)}
                      >
                        {DEPT_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="status-dot" style={{ background: p.is_active ? '#22c55e' : '#94a3b8' }} />
                        <span style={{ fontSize: 11.5, color: p.is_active ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                          {p.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    </td>
                    <td className="text-muted">{fmtDT(p.created_at)}</td>
                    <td>
                      {isSelf
                        ? <span className="text-muted" style={{ fontSize: 11 }}>Compte actuel</span>
                        : (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                              className="btn btn-sm btn-outline"
                              style={{ borderColor: p.is_active ? 'var(--red)' : 'var(--green)', color: p.is_active ? 'var(--red)' : 'var(--green)' }}
                              onClick={() => handleToggleActive(p)}
                            >
                              {p.is_active ? 'Désactiver' : 'Activer'}
                            </button>
                            {p.email && (
                              <Button size="sm" variant="outline" icon={IconMail}
                                onClick={() => handleResetPassword(p)}>
                                Réinit. mdp
                              </Button>
                            )}
                            <Button size="icon" variant="outline" icon={IconTrash}
                              onClick={() => handleDelete(p)} title="Supprimer le profil" />
                          </div>
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