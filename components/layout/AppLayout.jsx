'use client'
import { useAuthStore } from '@/store/authStore'
import { useAuth }        from '@/hooks/useAuth'
import { useRealtime }    from '@/hooks/useRealtime'
import { useInitialData } from '@/hooks/useInitialData'
import Sidebar          from './Sidebar'
import Topbar           from './Topbar'
import GlobalLoader     from './GlobalLoader'
import Toast            from '@/components/ui/Toast'
import ConfirmDialog    from '@/components/ui/ConfirmDialog'
import ModalRoot        from '@/components/modals/ModalRoot'

export default function AppLayout({ children }) {
  useAuth()
  useInitialData()
  useRealtime()

  const loading = useAuthStore(s => s.loading)
  if (loading) return <GlobalLoader />

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <main className="page-body">{children}</main>
      </div>

      <Toast />
      <ConfirmDialog />
      <ModalRoot />
    </div>
  )
}