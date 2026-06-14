'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useAuth }      from '@/hooks/useAuth'
import { useRealtime }  from '@/hooks/useRealtime'
import Sidebar          from './Sidebar'
import Topbar           from './Topbar'
import GlobalLoader     from './GlobalLoader'
import Toast            from '@/components/ui/Toast'
import ConfirmDialog    from '@/components/ui/ConfirmDialog'

export default function AppLayout({ children }) {
  // Initialise session + profil + onAuthStateChange
  useAuth()

  // Abonnement Realtime (actif dès qu'un profil est chargé)
  useRealtime()

  const loading = useAuthStore(s => s.loading)

  if (loading) return <GlobalLoader />

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <main className="page-body">
          {children}
        </main>
      </div>

      {/* Globaux UI */}
      <Toast />
      <ConfirmDialog />
    </div>
  )
}