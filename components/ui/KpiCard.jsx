// 'use client'
// export default function KpiCard() { return null }

'use client'
import { useId, useRef, useState } from 'react'
import { fmtMoney, fmtMoneyExact } from '@/lib/helpers'

function autoSize(display) {
  if (typeof display !== 'string' || display.length < 10) return {}
  if (display.length >= 16) return { fontSize: 14 }
  if (display.length >= 12) return { fontSize: 16 }
  return {}
}

/**
 * KPI premium avec gestion anti-dépassement.
 * - `value`  : texte affiché (ex. « 486 000 MGA » ou un compte)
 * - `raw`    : montant numérique → auto-formaté compact (+ tooltip valeur exacte)
 * - `compact`: force l'affichage compact même sans `raw` (déjà formaté)
 * Passe `index` (stagger d'apparition) pour l'animation d'entrée.
 */
export default function KpiCard({
  icon: Icon, color = 'teal', value, label, sub, raw, compact = false,
  index = 0,
}) {
  const tipId = useId()
  const [tipOpen, setTipOpen] = useState(false)
  const hoverTimer = useRef(null)

  const hasMoney = raw != null && Number.isFinite(Number(raw))
  const display = hasMoney && !compact
    ? fmtMoney(raw)
    : String(value == null ? '' : value)
  const exact = hasMoney ? fmtMoneyExact(raw) : String(value == null ? '' : value)
  const showTip = hasMoney && exact !== display

  const mouseEnter = () => {
    if (!showTip) return
    hoverTimer.current = setTimeout(() => setTipOpen(true), 180)
  }
  const mouseLeave = () => {
    clearTimeout(hoverTimer.current)
    setTipOpen(false)
  }

  return (
    <div
      className="kpi kpi-enter"
      style={index ? { animationDelay: `${Math.min(index * 40, 280)}ms` } : undefined}
    >
      {Icon && (
        <div className={`kpi-icon ${color}`}>
          <Icon size={22} />
        </div>
      )}
      <div
        className="kpi-info"
        role={showTip ? 'tooltip' : undefined}
        aria-describedby={showTip ? tipId : undefined}
        onMouseEnter={mouseEnter}
        onMouseLeave={mouseLeave}
        onFocus={mouseEnter}
        onBlur={mouseLeave}
      >
        <div className="kpi-val" style={autoSize(display)}>
          {display}
          {showTip && <span className="kpi-exact-dot" aria-hidden="true" />}
        </div>
        <div className="kpi-label">{label}{sub ? ` · ${sub}` : ''}</div>
        {showTip && (
          <span id={tipId} className={`kpi-tip ${tipOpen ? 'open' : ''}`} role="tooltip">
            {exact}
          </span>
        )}
      </div>
    </div>
  )
}