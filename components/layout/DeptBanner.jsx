// 'use client'
// // TODO: Phase 3 — DeptBanner
// export default function DeptBanner() { return null }

'use client'
import { IconDeviceLaptop, IconCash, IconShieldCheck } from '@tabler/icons-react'
import { useAuthStore } from '@/store/authStore'

export default function DeptBanner() {
  const profile = useAuthStore(s => s.profile)
  const dept = profile?.dept

  if (dept === 'IT')
    return <div className="dept-banner it"><IconDeviceLaptop size={16} /> Département IT</div>
  if (dept === 'Finance')
    return <div className="dept-banner fin"><IconCash size={16} /> Département Finance</div>
  return (
    <div className="dept-banner" style={{ background: 'rgba(124,58,237,.12)', color: '#7c3aed' }}>
      <IconShieldCheck size={16} /> Administrateur
    </div>
  )
}