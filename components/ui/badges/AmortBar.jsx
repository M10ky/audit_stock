// export default function AmortBar() { return null }

import { amortColor } from '@/lib/amortissement'

export default function AmortBar({ pct }) {
  const color = amortColor(pct)
  const value = pct == null ? null : Math.max(0, Math.min(100, pct))
  return (
    <div className="amort-bar-wrap">
      <div className="amort-bar-track">
        <div className="amort-bar-fill" style={{ width: `${value || 0}%`, background: color }} />
      </div>
      <span className="amort-bar-pct" style={{ color }}>{value == null ? '—' : `${value}%`}</span>
    </div>
  )
}