// 'use client'
// export default function ConfirmDialog() { return null }

'use client'
import { useState } from 'react'
import { useUiStore } from '@/store/uiStore'
import { IconAlertTriangle } from '@tabler/icons-react'
import Button from './Button'

export default function ConfirmDialog() {
  const { confirm, closeConfirm, showToast } = useUiStore()
  const [loading, setLoading] = useState(false)
  if (!confirm) return null

  // try/finally : si onConfirm throw (erreur réseau non capturée), la modale
  // se ferme quand même et l'erreur part en toast — avant, la modale restait
  // ouverte indéfiniment et la rejection était silencieuse.
  const handleConfirm = async () => {
    setLoading(true)
    try {
      await confirm.onConfirm?.()
    } catch (e) {
      showToast('Erreur : ' + (e?.message || 'opération échouée'), 'error')
    } finally {
      setLoading(false)
      closeConfirm()
    }
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
          <Button variant="outline" disabled={loading} onClick={closeConfirm}>Annuler</Button>
          <Button variant={confirm.danger ? 'danger' : 'primary'} loading={loading} onClick={handleConfirm}>Confirmer</Button>
        </div>
      </div>
    </div>
  )
}