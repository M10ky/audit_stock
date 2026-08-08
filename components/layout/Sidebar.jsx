'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconLayoutDashboard, IconPackage, IconArrowsExchange,
  IconClipboardList, IconBell, IconHistory,
  IconChartBar, IconTrendingDown, IconUsers,
  IconSettings, IconLogout, IconX,
} from '@tabler/icons-react'
import { useAuthStore } from '@/store/authStore'
import { useDataStore } from '@/store/dataStore'
import { useUiStore }   from '@/store/uiStore'
import { usePermissions } from '@/hooks/usePermissions'
import { createClient }   from '@/lib/supabase/client'
import { useRouter }      from 'next/navigation'

// Importation du composant DeptBanner
import DeptBanner from '@/components/layout/DeptBanner'

function NavLink({ href, icon: Icon, label, badge, deptClass }) {
  const pathname = usePathname()
  const active   = pathname === href || pathname.startsWith(href + '/')

  const activeClass = deptClass === 'fin'
    ? 'nav-link active active-fin'
    : 'nav-link active'

  return (
    <li className="nav-item">
      <Link href={href} className={active ? activeClass : 'nav-link'}>
        <Icon size={17} />
        <span>{label}</span>
        {badge > 0 && <span className="nav-badge">{badge}</span>}
      </Link>
    </li>
  )
}

export default function Sidebar() {
  const router   = useRouter()
  const supabase = createClient()
  const profile  = useAuthStore(s => s.profile)
  const reset    = useAuthStore(s => s.reset)
  const resetData = useDataStore(s => s.resetData)
  const { sidebarOpen, closeSidebar } = useUiStore()
  const p = usePermissions()

  // Compter les alertes stock
  const produits  = useDataStore(s => s.produits)
  const demandes  = useDataStore(s => s.demandes)
  const alertesIT  = produits.filter(pr => pr.dept === 'IT'      && pr.stock <= pr.seuil).length
  const alertesFin = produits.filter(pr => pr.dept === 'Finance' && pr.stock <= pr.seuil).length
  const demandesEnAttenteIT  = demandes.filter(d => d.dept === 'IT'      && d.statut === 'En attente').length
  const demandesEnAttenteFin = demandes.filter(d => d.dept === 'Finance' && d.statut === 'En attente').length

  // Initiales utilisateur
  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const logout = async () => {
    await supabase.auth.signOut()
    reset()
    resetData()
    router.push('/login')
  }

  return (
    <>
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        {/* ── Header ── */}
        <div className="sidebar-header">
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--teal)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>CS</span>
          </div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">Connecteo</span>
            <span className="sidebar-logo-sub">Stock Manager</span>
          </div>
          {/* Bouton fermer sur mobile */}
          <button
            onClick={closeSidebar}
            style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.4)', padding: 4 }}
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Ajout du DeptBanner ici */}
        <DeptBanner />

        {/* ── Navigation ── */}
        <nav className="sidebar-nav">

          {/* Dashboard */}
          <div className="sidebar-section">
            <span className="sidebar-section-label">Tableau de bord</span>
          </div>
          <ul>
            <NavLink href="/dashboard" icon={IconLayoutDashboard} label="Dashboard" />
          </ul>

          {/* Département IT */}
          {p.canSeeIT && (
            <>
              <div className="sidebar-section">
                <span className="sidebar-section-label" style={{ color: 'rgba(0,201,167,.6)' }}>
                  Informatique
                </span>
              </div>
              <ul>
                <NavLink href="/stock/it"      icon={IconPackage}       label="Stock IT"       />
                {p.canManIT && (
                  <NavLink href="/mouvements/it" icon={IconArrowsExchange} label="Mouvements IT"  />
                )}
                {p.canDemIT && (
                  <NavLink
                    href="/demandes/it"
                    icon={IconClipboardList}
                    label="Demandes IT"
                    badge={p.canValidIT ? demandesEnAttenteIT : 0}
                  />
                )}
                {p.canManIT && (
                  <NavLink
                    href="/alertes/it"
                    icon={IconBell}
                    label="Alertes IT"
                    badge={alertesIT}
                    deptClass="it"
                  />
                )}
              </ul>
            </>
          )}

          {/* Département Finance */}
          {p.canSeeFin && (
            <>
              <div className="sidebar-section">
                <span className="sidebar-section-label" style={{ color: 'rgba(79,70,229,.7)' }}>
                  Finance
                </span>
              </div>
  <ul>
                <NavLink href="/stock/fin"      icon={IconPackage}       label="Stock Finance"      deptClass="fin" />
                {p.canManFin && (
                  <NavLink href="/mouvements/fin" icon={IconArrowsExchange} label="Mouvements Finance" deptClass="fin" />
                )}
                {p.canDemFin && (
                  <NavLink
                    href="/demandes/fin"
                    icon={IconClipboardList}
                    label="Demandes Finance"
                    badge={p.canValidFin ? demandesEnAttenteFin : 0}
                    deptClass="fin"
                  />
                )}
                {p.canManFin && (
                  <NavLink
                    href="/alertes/fin"
                    icon={IconBell}
                    label="Alertes Finance"
                    badge={alertesFin}
                    deptClass="fin"
                  />
                )}
              </ul>
            </>
          )}

          {/* Analyse */}
          {p.canSeeHist && (
            <>
              <div className="sidebar-section">
                <span className="sidebar-section-label">Analyse</span>
              </div>
              <ul>
                <NavLink href="/historique"    icon={IconHistory}      label="Historique"     />
                <NavLink href="/rapports"      icon={IconChartBar}     label="Rapports"       />
                <NavLink href="/amortissement" icon={IconTrendingDown} label="Amortissement"  />
              </ul>
            </>
          )}

          {/* Administration */}
          {p.isAdmin && (
            <>
              <div className="sidebar-section">
                <span className="sidebar-section-label">Administration</span>
              </div>
              <ul>
                <NavLink href="/utilisateurs" icon={IconUsers}    label="Utilisateurs" />
                <NavLink href="/params"       icon={IconSettings} label="Paramètres"   />
              </ul>
            </>
          )}
        </nav>

        {/* ── Footer utilisateur ── */}
        <div className="sidebar-footer">
          <div className="user-pill" onClick={logout} title="Se déconnecter">
            <div
              className="user-avatar"
              style={{ background: profile?.color || 'var(--teal)' }}
            >
              {initials}
            </div>
            <div className="user-info">
              <div className="user-name">{profile?.name || '…'}</div>
              <div className="user-role">{profile?.role || ''}</div>
            </div>
            <IconLogout size={16} style={{ color: 'rgba(255,255,255,.4)', flexShrink: 0 }} />
          </div>
        </div>
      </aside>
    </>
  )
}
