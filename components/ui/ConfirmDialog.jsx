// 'use client'
// // TODO: Phase 3 — ConfirmDialog
// export default function ConfirmDialog() { return null }

'use client'
import { useUiStore } from '@/store/uiStore'
import { IconAlertTriangle } from '@tabler/icons-react'
import Button from './Button'

export default function ConfirmDialog() {
  const { confirm, closeConfirm } = useUiStore()
  if (!confirm) return null

  const handleConfirm = async () => {
    await confirm.onConfirm?.()
    closeConfirm()
  }

  return (
    <div className="modal-overlay" onClick={closeConfirm}>
      <div className="modal-box modal-sm" onClick={e => e.stopPropagation()} style={{ padding: 24 }}>
        <div className={`confirm-icon ${confirm.danger ? 'danger' : 'warn'}`}>
          <IconAlertTriangle size={24} />
        </div>
        <div className="modal-title">{confirm.title}</div>
        <div className="confirm-msg" style={{ marginTop: 8, marginBottom: 20 }}>{confirm.message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="outline" onClick={closeConfirm}>Annuler</Button>
          <Button variant={confirm.danger ? 'danger' : 'primary'} onClick={handleConfirm}>Confirmer</Button>
        </div>
      </div>
    </div>
  )
}