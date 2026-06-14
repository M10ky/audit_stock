// 'use client'
// // TODO: Phase 3 — Modal
// export default function Modal() { return null }

'use client'
import { IconX } from '@tabler/icons-react'
import { cx } from '@/lib/helpers'

export default function Modal({ title, subtitle, onClose, children, footer, size }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={cx('modal-box', size === 'sm' && 'modal-sm', size === 'lg' && 'modal-lg')}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="modal-subtitle">{subtitle}</div>}
          </div>
          <button className="modal-close" onClick={onClose}><IconX size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}