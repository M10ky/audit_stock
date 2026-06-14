// // TODO: Phase 3 — AmortBar
// export default function AmortBar() { return null }

import { amortColor } from '@/lib/amortissement'

export default function AmortBar({ pct }) {
  const color = amortColor(pct)
  return (
    <div className="amort-bar-wrap">
      <div className="amort-bar-track">
        <div className="amort-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="amort-bar-pct" style={{ color }}>{pct}%</span>
    </div>
  )
}