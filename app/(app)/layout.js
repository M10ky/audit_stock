// // TODO: Phase 3 — AppLayout (Sidebar + Topbar + Providers)
// export default function AppLayout({ children }) {
//   return <div className="app">{children}</div>
// }

import AppLayout from '@/components/layout/AppLayout'

export default function Layout({ children }) {
  return <AppLayout>{children}</AppLayout>
}