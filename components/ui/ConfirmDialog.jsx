// 'use client'
// export default function ConfirmDialog() { return null }

'use client'
import { useState } from 'react'
import { useUiStore } from '@/store/uiStore'
import { IconAlertTriangle } from '@tabler/icons-react'
import Button from './Button'

const TONE_STYLES = {
  danger:  { color: '#dc2626', background: 'rgba(220,38,38,.08)', borderColor: 'rgba(220,38,38,.3)' },
  warning: { color: '#b45309', background: 'rgba(245,158,11,.1)', borderColor: 'rgba(245,158,11,.35)' },
  success: { color: '#15803d', background: 'rgba(22,163,74,.08)', borderColor: 'rgba(22,163,74,.3)' },
}

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

  const tone = confirm.tone ?? confirm.content?.tone ?? (confirm.danger ? 'danger' : 'warning')
  const boxStyle = {
    marginTop: 8,
    marginBottom: 20,
    border: '1px solid transparent',
    borderRadius: 8,
    padding: '10px 12px',
    ...(TONE_STYLES[tone] || TONE_STYLES.warning),
  }
  const html = confirm.html ?? confirm.content?.html
  const lines = Array.isArray(confirm.content) ? confirm.content : confirm.content?.lines
  const rich = confirm.tone != null || confirm.content != null || confirm.html != null

  const renderMessage = () => {
    if (html != null) {
      return <div className="confirm-msg" style={boxStyle} dangerouslySetInnerHTML={{ __html: html }} />
    }
    if (lines) {
      return (
        <div className="confirm-msg" style={boxStyle}>
          {lines.map((line, i) => {
            const item = typeof line === 'string' ? { text: line, tone } : line
            return (
              <div
                key={i}
                style={{ color: TONE_STYLES[item?.tone || tone]?.color, marginBottom: i < lines.length - 1 ? 6 : 0 }}
              >
                {item?.text ?? item}
              </div>
            )
          })}
        </div>
      )
    }
    if (confirm.content != null && typeof confirm.content === 'object') {
      return <div className="confirm-msg" style={boxStyle}>{confirm.content.text ?? confirm.content}</div>
    }
    if (typeof confirm.content === 'string') {
      return <div className="confirm-msg" style={boxStyle}>{confirm.content}</div>
    }
    return (
      <div className="confirm-msg" style={rich ? boxStyle : { marginTop: 8, marginBottom: 20 }}>
        {confirm.message}
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={closeConfirm}>
      <div className="modal-box modal-sm" onClick={e => e.stopPropagation()} style={{ padding: 24 }}>
        <div className={`confirm-icon ${confirm.danger ? 'danger' : 'warn'}`}>
          <IconAlertTriangle size={24} />
        </div>
        <div className="modal-title">{confirm.title}</div>
        {renderMessage()}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="outline" disabled={loading} onClick={closeConfirm}>Annuler</Button>
          <Button variant={confirm.danger ? 'danger' : 'primary'} loading={loading} onClick={handleConfirm}>Confirmer</Button>
        </div>
      </div>
    </div>
  )
}