// 'use client'
import { useUiStore } from '@/store/uiStore'
import { IconCheck, IconX, IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react'

const ICONS = { success: IconCheck, error: IconX, info: IconInfoCircle, warning: IconAlertTriangle }

export default function Toast() {
  const { toast, hideToast } = useUiStore()
  if (!toast.visible) return null
  const Icon = ICONS[toast.type] || IconCheck

  return (
    <div className="toast-container">
      <div className={`toast toast-${toast.type}`}>
        <Icon size={16} />
        <span className="toast-text">{toast.msg}</span>
        <IconX size={14} className="toast-close" onClick={hideToast} />
      </div>
    </div>
  )
}