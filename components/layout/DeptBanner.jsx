// 'use client'
// export default function DeptBanner() { return null }

'use client'
import { IconDeviceLaptop, IconCash, IconShieldCheck, IconEye } from '@tabler/icons-react'
import { useAuthStore } from '@/store/authStore'
import { normalizeRole, ROLES } from '@/lib/permissions'

export default function DeptBanner() {
  const profile = useAuthStore(s => s.profile)
  const role = normalizeRole(profile)

  if (role === ROLES.LECTEUR)
    return (
      <div className="dept-banner" style={{ background: 'rgba(124,58,237,.12)', color: '#7c3aed' }}>
        <IconEye size={16} /> Vue Lecture
      </div>
    )
  if (role === ROLES.ADMIN)
    return (
      <div className="dept-banner" style={{ background: 'rgba(124,58,237,.12)', color: '#7c3aed' }}>
        <IconShieldCheck size={16} /> Administrateur
      </div>
    )
  if (role === ROLES.SUP_IT)
    return <div className="dept-banner it"><IconDeviceLaptop size={16} /> Support IT</div>
  if (role === ROLES.RES_FIN)
    return <div className="dept-banner fin"><IconCash size={16} /> Responsable Finance</div>
  if (role === ROLES.USER_IT)
    return <div className="dept-banner it"><IconDeviceLaptop size={16} /> Utilisateur IT</div>
  if (role === ROLES.USER_FIN)
    return <div className="dept-banner fin"><IconCash size={16} /> Utilisateur Finance</div>
  return null
}